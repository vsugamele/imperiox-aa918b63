// Aviso no grupo Imperio X quando um lead fala no WhatsApp e ninguém responde em 1 h (OF2.1). Roda a cada 15 min.
// Anti-spam: uma mensagem por rodada com a lista, um aviso por espera (conversa + última mensagem do lead),
// silêncio das 22h às 8h e parada após 3 falhas de envio. dry_run=true devolve o texto sem enviar nem gravar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { formatWaiting, pickWaiting, quietHours, WAIT_MAX_HOURS, type WaitingConv } from "../_shared/wa-waiting.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMPERIO_X_JID = "120363409438175766@g.us";
const ACTION = "wa_waiting_alert";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = url.searchParams.get("dry_run") === "true" || body?.dry_run === true;
    const now = new Date();
    if (!dryRun && quietHours(now)) return json({ ok: true, skipped: "quiet_hours" });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const since = new Date(now.getTime() - WAIT_MAX_HOURS * 3600000).toISOString();
    const [convRes, sentRes, projRes, failRes] = await Promise.all([
      sb.from("imphq_wa_conversations")
        .select("id, project_id, phone, nome, contact_name, last_message, last_incoming_at, last_message_direction, ia_ativa, ai_paused, ai_paused_until, assigned_to, snoozed_until, jid_suffix, lead_id")
        .eq("last_message_direction", "incoming").gte("last_incoming_at", since).limit(500),
      sb.from("imphq_activity_log").select("details").eq("action", ACTION).gte("created_at", since).limit(500),
      sb.from("imphq_projects").select("id, name"),
      sb.from("imphq_activity_log").select("details").eq("action", `${ACTION}_falha`).gte("created_at", new Date(now.getTime() - 6 * 3600000).toISOString()).limit(10),
    ]);
    if (convRes.error) throw convRes.error;

    const alreadySent = new Set<string>();
    for (const row of sentRes.data ?? []) {
      for (const it of ((row.details as { itens?: Array<{ c: string; t: string }> } | null)?.itens ?? [])) alreadySent.add(`${it.c}|${it.t}`);
    }
    const names: Record<string, string> = {};
    for (const p of projRes.data ?? []) names[p.id as string] = (p.name as string) || (p.id as string);

    // Nome do cadastro do lead quando a conversa não tem.
    const convs = (convRes.data ?? []) as Array<WaitingConv & { lead_id?: string | null }>;
    const leadIds = [...new Set(convs.filter((c) => !c.nome && !c.contact_name && c.lead_id).map((c) => c.lead_id as string))];
    if (leadIds.length > 0) {
      const { data: leads } = await sb.from("imphq_leads").select("id, nome").in("id", leadIds);
      const byId = new Map((leads ?? []).map((l) => [String(l.id), l.nome as string | null]));
      for (const c of convs) if (!c.nome && !c.contact_name && c.lead_id) c.nome = byId.get(String(c.lead_id)) ?? null;
    }
    const items = pickWaiting(convs, alreadySent, names, now);
    if (items.length === 0) return json({ ok: true, esperando: 0 });
    const texto = formatWaiting(items);
    if (dryRun) return json({ ok: true, dry_run: true, esperando: items.length, texto });

    // 3 falhas seguidas nas últimas 6 h: para de tentar até alguém olhar o provedor.
    if ((failRes.data ?? []).length >= 3) return json({ ok: false, skipped: "too_many_failures", esperando: items.length });

    const { data: provider } = await sb.from("imphq_wa_providers").select("api_url, api_key, instance_name").eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    const res = provider?.instance_name
      ? await fetch(`${String(provider.api_url).replace(/\/$/, "")}/message/sendText/${provider.instance_name}`, {
          method: "POST", headers: { "Content-Type": "application/json", apikey: String(provider.api_key) },
          body: JSON.stringify({ number: IMPERIO_X_JID, text: texto }),
        }).catch(() => null)
      : null;
    if (!res?.ok) {
      await sb.from("imphq_activity_log").insert({ action: `${ACTION}_falha`, entity_type: "whatsapp", actor: "sistema", source: "wa-waiting-alert",
        details: { status: res?.status ?? null, esperando: items.length } });
      return json({ ok: false, erro: "envio_falhou", status: res?.status ?? null }, 502);
    }
    await sb.from("imphq_activity_log").insert({ action: ACTION, entity_type: "whatsapp", actor: "sistema", source: "wa-waiting-alert",
      details: { destino: "Imperio X", texto, itens: items.map((i) => ({ c: i.c, t: i.t })) } });
    return json({ ok: true, enviados: items.length });
  } catch (e) {
    console.error("[wa-waiting-alert]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
