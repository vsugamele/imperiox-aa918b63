// Processa fila de mensagens WA do webinar + reconcilia vendas (cancela mensagens pendentes se lead comprou)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function findActiveProvider(supabase: any, projectId: string) {
  const { data } = await supabase
    .from("imphq_wa_providers")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  if (data) return data;
  const { data: g } = await supabase
    .from("imphq_wa_providers")
    .select("*")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  return g;
}

async function sendWA(provider: any, phone: string, message: string) {
  if (!provider || provider.provider !== "evolution") return { ok: false, error: "no_provider" };
  try {
    const url = `${provider.api_url.replace(/\/$/, "")}/message/sendText/${provider.instance_name}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: provider.api_key },
      body: JSON.stringify({ number: phone, text: message }),
    });
    if (!res.ok) return { ok: false, error: `evolution_${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date().toISOString();

  // 1. Reconcilia vendas (últimas 48h): se houve venda do email/phone, cancela pendentes do click
  const { data: openClicks } = await supabase
    .from("imphq_webinar_clicks")
    .select("id, registration_id, session_id, clicked_at, imphq_webinar_registrations(email, phone, lead_id, status, session_id)")
    .is("recovered_at", null)
    .is("sale_id", null)
    .gte("clicked_at", new Date(Date.now() - 48 * 3600_000).toISOString());

  for (const c of openClicks || []) {
    const reg: any = (c as any).imphq_webinar_registrations;
    if (!reg?.email && !reg?.phone) continue;
    const { data: vendas } = await supabase
      .from("imphq_vendas")
      .select("id, data, data_venda")
      .gte("data_venda", c.clicked_at)
      .limit(50);
    let matched: any = null;
    for (const v of vendas || []) {
      const d: any = typeof v.data === "string" ? JSON.parse(v.data) : v.data || {};
      const emails = [d.email, d.customer_email, d.payer?.email].filter(Boolean).map((x: string) => x.toLowerCase());
      const phones = [d.phone, d.customer_phone, d.payer?.phone].filter(Boolean).map((x: string) => x.replace(/\D/g, ""));
      if ((reg.email && emails.includes(reg.email.toLowerCase())) ||
          (reg.phone && phones.includes(reg.phone.replace(/\D/g, "")))) {
        matched = v; break;
      }
    }
    if (matched) {
      await supabase.from("imphq_webinar_clicks").update({ sale_id: matched.id, recovered_at: now }).eq("id", c.id);
      await supabase.from("imphq_webinar_registrations").update({ status: "bought" }).eq("id", reg ? (c as any).registration_id : c.registration_id);
      await supabase.from("imphq_webinar_wa_queue").update({ status: "cancelled" })
        .eq("click_id", c.id).eq("status", "pending");
    }
  }

  // 2. Envia fila pendente cuja send_at já chegou
  const { data: pending } = await supabase
    .from("imphq_webinar_wa_queue")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", now)
    .limit(50);

  const providersByProject: Record<string, any> = {};
  let sent = 0, failed = 0;

  for (const msg of pending || []) {
    if (!providersByProject[msg.project_id]) {
      providersByProject[msg.project_id] = await findActiveProvider(supabase, msg.project_id);
    }
    const provider = providersByProject[msg.project_id];
    const result = await sendWA(provider, msg.phone, msg.message);
    if (result.ok) {
      await supabase.from("imphq_webinar_wa_queue").update({ status: "sent", sent_at: now }).eq("id", msg.id);
      sent++;
    } else {
      await supabase.from("imphq_webinar_wa_queue").update({ status: "failed", error: result.error }).eq("id", msg.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({
    reconciled: (openClicks || []).length,
    sent, failed,
    pending_total: (pending || []).length,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
