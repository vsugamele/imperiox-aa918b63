// Envia o briefing diário via WhatsApp para usuários com wa_briefing_enabled = true
// e cuja hora preferida bate com a hora atual (BRT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function brtHour() {
  // BRT = UTC-3
  const d = new Date();
  return (d.getUTCHours() - 3 + 24) % 24;
}

function normalizePhone(raw: string) {
  let p = (raw || "").replace(/\D/g, "");
  if (p.length === 10 || p.length === 11) p = "55" + p;
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const onlyUser = url.searchParams.get("user_id");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const hour = brtHour();

    let q = supabase
      .from("imphq_notification_preferences")
      .select("user_id, wa_briefing_enabled, wa_briefing_phone, wa_briefing_hour")
      .eq("wa_briefing_enabled", true);
    if (onlyUser) q = q.eq("user_id", onlyUser);

    const { data: prefs } = await q;
    const targets = (prefs || []).filter((p: any) =>
      force || onlyUser || Number(p.wa_briefing_hour ?? 8) === hour
    );

    const results: any[] = [];

    for (const pref of targets) {
      try {
        // Gera/recupera briefing global do dia
        const briefingRes = await fetch(`${SUPABASE_URL}/functions/v1/daily-briefing`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const briefingJson = await briefingRes.json();
        const briefing = briefingJson?.briefing;
        if (!briefing) {
          results.push({ user_id: pref.user_id, error: "Sem briefing disponível" });
          continue;
        }

        const lines: string[] = [];
        lines.push("🏛️ *Imperius — Briefing diário*");
        lines.push("");
        lines.push(briefing.briefing_text);
        const m = briefing.metrics || {};
        lines.push("");
        lines.push(`💰 Receita 24h: R$ ${Number(m.receita24h || 0).toFixed(2)} (${m.vendasCount || 0} vendas)`);
        lines.push(`🔥 Hot leads: ${m.hotLeadsCount || 0}`);
        lines.push(`📋 Tarefas atrasadas: ${m.tarefasAtrasadasCount || 0}`);
        if (Array.isArray(briefing.actions) && briefing.actions.length) {
          lines.push("");
          lines.push("*Próximas ações:*");
          briefing.actions.forEach((a: any, i: number) => lines.push(`${i + 1}. ${a.label}`));
        }
        const message = lines.join("\n");

        const phone = normalizePhone(pref.wa_briefing_phone || "");
        if (!phone) {
          results.push({ user_id: pref.user_id, error: "Sem telefone configurado" });
          continue;
        }

        // Provider global ativo
        const { data: provider } = await supabase
          .from("imphq_wa_providers")
          .select("instance_name")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!provider?.instance_name) {
          results.push({ user_id: pref.user_id, error: "Nenhum provider WA ativo" });
          continue;
        }

        const sendRes = await fetch(
          `${SUPABASE_URL}/functions/v1/whatsapp-api/${provider.instance_name}?action=send_message`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ number: phone, text: message }),
          },
        );
        const sendJson = await sendRes.json().catch(() => ({}));
        results.push({ user_id: pref.user_id, status: sendRes.status, send: sendJson });
      } catch (err) {
        results.push({ user_id: pref.user_id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, hour, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
