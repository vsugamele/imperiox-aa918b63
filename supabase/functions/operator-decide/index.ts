// Operador no grupo (OPR1.2): "ok 1", "não 2", "pago 4", "ok 2: texto" respondidos no Imperio X viram decisão.
// Chamado pelo webhook do WhatsApp (whatsapp-api) só para mensagens do grupo que parecem comando.
// Regras: só gente do time (imphq_team_members.whatsapp_ids) decide; os números valem para a última rodada (24 h);
// a decisão passa pelo project-mcp (decide_approval) com confirmado_por = quem respondeu, então a autonomia vale;
// dúvida do bot só é aprovada com o texto da resposta; cada mensagem é processada uma vez; responde no grupo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { parseOperatorCommand, resolveOperatorCommand, type OperatorItem } from "../_shared/operator.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_KEY = (Deno.env.get("MCP_API_KEYS") ?? "").split(",").map((k) => k.trim()).find((k) => k.length >= 24) ?? "";
const IMPERIO_X_JID = "120363409438175766@g.us";
const DAY_MS = 24 * 3600_000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const DECISION_LABEL = { approve: "aprovado", reject: "recusado", mark_paid: "marcado como pago" } as const;

/** Identificadores possíveis de quem escreveu: o id completo e só os dígitos (número ou @lid). */
export function senderIds(...values: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    ids.add(v.trim());
    const digits = v.split("@")[0].replace(/\D/g, "");
    if (digits.length >= 8) ids.add(digits);
  }
  return [...ids];
}

async function decide(key: string, decision: string, member: string, resposta: string | null) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/project-mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mcp-key": MCP_KEY, "x-imperio-actor": `ia (OK de ${member}) via grupo Imperio X` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "decide_approval", arguments: { key, decision, confirmado_por: member, ...(resposta ? { resposta } : {}) } } }),
  }).catch(() => null);
  const env = await res?.json().catch(() => null) as { result?: { content?: Array<{ text?: string }> }; error?: { message?: string } } | null;
  if (env?.error) return { ok: false, msg: env.error.message ?? "erro" };
  const text = env?.result?.content?.[0]?.text;
  if (!text) return { ok: false, msg: `MCP sem resposta (HTTP ${res?.status ?? "?"})` };
  try {
    const r = JSON.parse(text) as { resultado?: string; success?: boolean };
    return { ok: true, msg: r.resultado ?? "feito" };
  } catch { return { ok: true, msg: "feito" }; }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({})) as { text?: string; participant?: string; participant_alt?: string; push_name?: string; provider_message_id?: string };
    const cmd = parseOperatorCommand(body.text);
    if (!cmd) return json({ ok: true, ignorado: "não é comando" });
    if (!MCP_KEY) return json({ error: "MCP_API_KEYS não configurado" }, 503);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const msgId = body.provider_message_id || null;

    if (msgId) {
      const { data: seen } = await sb.from("imphq_activity_log").select("id").eq("action", "operator_reply").eq("entity_id", msgId).limit(1).maybeSingle();
      if (seen) return json({ ok: true, ignorado: "mensagem já processada" });
    }

    const ids = senderIds(body.participant, body.participant_alt);
    const { data: members } = ids.length
      ? await sb.from("imphq_team_members").select("id, name").overlaps("whatsapp_ids", ids).or("is_active.eq.true,is_active.is.null").limit(2)
      : { data: [] };
    const member = members?.length === 1 ? members[0] as { id: string; name: string } : null;

    const lines: string[] = [];
    const done: Array<Record<string, unknown>> = [];
    if (!member) {
      const tail = ids.map((i) => i.replace(/\D/g, "")).find((d) => d.length >= 4)?.slice(-4) ?? "?";
      lines.push(`🤖 Não reconheci quem mandou (WhatsApp …${tail}). Só gente do time cadastrada decide pelo grupo — nada foi feito.`);
    } else {
      const { data: round } = await sb.from("imphq_activity_log").select("created_at, details").eq("action", "operator_round")
        .gte("created_at", new Date(Date.now() - DAY_MS).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const itens = ((round?.details as { itens?: OperatorItem[] } | null)?.itens ?? []);
      if (!round || !itens.length) {
        lines.push(`🤖 ${member.name}, não há rodada do operador nas últimas 24 h com decisões numeradas — nada foi feito.`);
      } else {
        const { decisoes, desconhecidos } = resolveOperatorCommand(cmd, itens);
        for (const d of decisoes) {
          if (d.key.startsWith("duvida_bot:") && d.decisao === "approve" && !cmd.resposta) {
            lines.push(`✋ *${d.n}.* dúvida do bot precisa do texto: responda \`ok ${d.n}: <resposta>\`.`);
            continue;
          }
          const r = await decide(d.key, d.decisao, member.name, cmd.resposta);
          done.push({ n: d.n, key: d.key, decisao: d.decisao, ok: r.ok, resultado: r.msg });
          lines.push(r.ok ? `✅ *${d.n}.* ${DECISION_LABEL[d.decisao]} — ${r.msg} (OK de ${member.name})` : `⚠️ *${d.n}.* não feito: ${r.msg}`);
        }
        if (desconhecidos.length) lines.push(`❔ Sem decisão com o número ${desconhecidos.join(", ")} na última rodada.`);
      }
    }

    await sb.from("imphq_activity_log").insert({
      action: "operator_reply", entity_type: "operator", entity_id: msgId ?? `sem-id-${Date.now()}`, entity_name: body.text?.slice(0, 80) ?? null,
      actor: member?.name ?? "desconhecido", source: "operator-decide",
      details: { comando: cmd, quem: member?.name ?? null, ids_fim: ids.map((i) => i.replace(/\D/g, "").slice(-4)), resultados: done },
    });

    const { data: provider } = await sb.from("imphq_wa_providers").select("api_url, api_key, instance_name").eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    if (provider?.instance_name && lines.length) {
      await fetch(`${String(provider.api_url).replace(/\/$/, "")}/message/sendText/${provider.instance_name}`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: String(provider.api_key) },
        body: JSON.stringify({ number: IMPERIO_X_JID, text: lines.join("\n") }),
      }).catch(() => null);
    }
    return json({ ok: true, quem: member?.name ?? null, resultados: done, resposta: lines });
  } catch (e) {
    console.error("[operator-decide]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
