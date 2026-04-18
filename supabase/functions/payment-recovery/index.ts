// Payment Recovery — busca vendas pendentes (Pix/Boleto) e envia follow-up via WhatsApp
// Tenta 3 níveis de recovery: 2h, 12h, 24h após criação. Marca metadata para não duplicar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PENDING_STATUSES = ["aguardando_pagamento", "pix_gerado", "boleto_gerado", "pendente"];

// Janelas (horas) de envio. Após N horas, envia mensagem nivel X.
const RECOVERY_LEVELS = [
  { level: 1, minHours: 2, maxHours: 11.99, msg: (nome: string, produto: string) =>
    `Oi ${nome || ""}! 👋 Vi que você iniciou a compra de *${produto}* mas o pagamento ainda não foi confirmado. Quer ajuda pra finalizar? Posso te enviar o link novamente.` },
  { level: 2, minHours: 12, maxHours: 23.99, msg: (nome: string, produto: string) =>
    `${nome || "Olá"}, ainda dá tempo! 🔥 Sua reserva de *${produto}* está prestes a expirar. Se precisar de um novo link de pagamento ou de uma condição especial, me avise agora.` },
  { level: 3, minHours: 24, maxHours: 48, msg: (nome: string, produto: string) =>
    `Última chamada, ${nome || ""}! ⏰ A oferta de *${produto}* expira hoje. Posso liberar uma condição exclusiva pra você fechar agora — me responde aqui se tiver interesse.` },
];

function normalizePhone(p: string): string {
  return (p || "").replace(/\D/g, "");
}

async function findActiveProvider(supabase: any, projectId: string | null) {
  if (projectId) {
    const { data } = await supabase
      .from("imphq_whatsapp_config")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("imphq_whatsapp_config")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data;
}

async function sendWhatsApp(provider: any, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!provider) return { ok: false, error: "no_provider" };
  try {
    if (provider.provider === "evolution") {
      const url = `${provider.api_url.replace(/\/$/, "")}/message/sendText/${provider.instance_name}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: provider.api_key },
        body: JSON.stringify({ number: phone, text: message }),
      });
      if (!res.ok) return { ok: false, error: `evolution_${res.status}` };
      return { ok: true };
    }
    return { ok: false, error: "provider_unsupported" };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // Busca vendas pendentes nas últimas 48h
    const { data: vendas, error: vendasErr } = await supabase
      .from("imphq_vendas")
      .select("id, lead_id, project_id, valor, produto_nome, status, metadata, created_at")
      .in("status", PENDING_STATUSES)
      .gte("created_at", cutoff48h)
      .limit(500);

    if (vendasErr) throw vendasErr;
    if (!vendas || vendas.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;
    const details: any[] = [];

    for (const v of vendas) {
      const ageMs = now.getTime() - new Date(v.created_at).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      const meta: any = v.metadata || {};
      const sentLevels: number[] = Array.isArray(meta.recovery_sent_levels) ? meta.recovery_sent_levels : [];

      const targetLevel = RECOVERY_LEVELS.find(
        (r) => ageHours >= r.minHours && ageHours <= r.maxHours && !sentLevels.includes(r.level)
      );
      if (!targetLevel) { skipped++; continue; }

      // Busca lead p/ telefone e nome
      if (!v.lead_id) { skipped++; continue; }
      const { data: lead } = await supabase
        .from("imphq_leads")
        .select("id, nome, phone, project_id")
        .eq("id", v.lead_id)
        .maybeSingle();

      const phone = normalizePhone(lead?.phone || "");
      if (!phone || phone.length < 10) { skipped++; continue; }

      const provider = await findActiveProvider(supabase, v.project_id || lead?.project_id);
      const message = targetLevel.msg(lead?.nome || "", v.produto_nome || "seu pedido");
      const result = await sendWhatsApp(provider, phone, message);

      // Persiste resultado em metadata
      const newMeta = {
        ...meta,
        recovery_sent_levels: [...sentLevels, targetLevel.level],
        recovery_last: {
          level: targetLevel.level,
          at: now.toISOString(),
          ok: result.ok,
          error: result.error || null,
          provider: provider?.id || null,
        },
      };
      await supabase.from("imphq_vendas").update({ metadata: newMeta }).eq("id", v.id);

      // Log em events
      await supabase.from("imphq_events").insert({
        project_id: v.project_id || lead?.project_id || null,
        lead_id: v.lead_id,
        event_name: result.ok ? "payment_recovery_sent" : "payment_recovery_failed",
        event_data: { level: targetLevel.level, venda_id: v.id, error: result.error || null, age_hours: Math.round(ageHours * 10) / 10 },
      });

      if (result.ok) sent++; else skipped++;
      details.push({ venda_id: v.id, level: targetLevel.level, ok: result.ok, error: result.error });
    }

    return new Response(
      JSON.stringify({ ok: true, processed: vendas.length, sent, skipped, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[payment-recovery] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
