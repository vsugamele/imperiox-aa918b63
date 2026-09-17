// wa-learn-from-sale
// Aprende com vendas fechadas: extrai a conversa do lead vencida e armazena
// como exemplo few-shot dinâmico em imphq_wa_knowledge (source='sale_winning').
// Roda manual (POST { venda_id }) ou via cron */15 min processando até 20 vendas pendentes.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model: "google/gemini-embedding-001", input: text.slice(0, 6000) }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

function makeClient(url: string, key: string) { return createClient(url, key); }
interface LearningSale { id: string; lead_id: string | null; project_id: string | null; data_venda: string | null; created_at: string; produto_nome?: string | null; valor?: number | null }
interface KnowledgeInsert { project_id: string; pergunta: string; resposta: string; source: string; aprovada: boolean; score_uso: number; conversation_id: string; lead_id: string; answered: boolean; embedding?: number[] }
async function processarVenda(supabase: ReturnType<typeof makeClient>, venda: LearningSale) {
  const leadId = venda.lead_id;
  const projectId = venda.project_id;
  if (!leadId || !projectId) {
    await supabase.from("imphq_vendas").update({ learned_at: new Date().toISOString() }).eq("id", venda.id);
    return { ok: false, venda_id: venda.id, reason: "sem lead/project" };
  }

  // Conversa do lead
  const { data: conv } = await supabase
    .from("imphq_wa_conversations")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();

  let convId = conv?.id;
  if (!convId) {
    // Tenta pelo phone do lead
    const { data: lead } = await supabase
      .from("imphq_leads")
      .select("phone, telefone")
      .eq("id", leadId)
      .maybeSingle();
    const ph = (lead?.phone || lead?.telefone || "").replace(/\D/g, "");
    if (ph) {
      const { data: c2 } = await supabase
        .from("imphq_wa_conversations")
        .select("id")
        .eq("project_id", projectId)
        .ilike("contact_phone", `%${ph.slice(-8)}%`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      convId = c2?.id;
    }
  }

  if (!convId) {
    await supabase.from("imphq_vendas").update({ learned_at: new Date().toISOString() }).eq("id", venda.id);
    return { ok: false, venda_id: venda.id, reason: "sem conversa WA" };
  }

  // Pega últimas 40 msgs antes da venda
  const dataVenda = venda.data_venda || venda.created_at;
  const { data: msgs } = await supabase
    .from("imphq_wa_messages")
    .select("role, content, direction, created_at")
    .eq("conversation_id", convId)
    .lte("created_at", dataVenda)
    .order("created_at", { ascending: false })
    .limit(40);

  const msgsOrdered = (msgs || []).reverse().filter((m) => m.content && m.content.trim());
  if (msgsOrdered.length < 4) {
    await supabase.from("imphq_vendas").update({ learned_at: new Date().toISOString() }).eq("id", venda.id);
    return { ok: false, venda_id: venda.id, reason: "conversa muito curta" };
  }

  // Constrói pares pergunta(lead) -> resposta(IA/atendente) de alto valor
  // Estratégia: pega a primeira mensagem do lead e a última resposta da casa antes da venda
  const inbound = msgsOrdered.filter((m) => m.direction === "inbound" || m.role === "user");
  const outbound = msgsOrdered.filter((m) => m.direction === "outbound" || m.role === "assistant");

  const pergunta = inbound[0]?.content?.slice(0, 1500) || msgsOrdered[0]?.content?.slice(0, 1500);
  const resposta_seq = outbound.slice(-3).map((m) => m.content).join("\n---\n").slice(0, 3000);
  const conversa_full = msgsOrdered
    .map((m) => `${m.direction === "inbound" || m.role === "user" ? "LEAD" : "CASA"}: ${m.content}`)
    .join("\n")
    .slice(0, 5500);

  if (!pergunta || !resposta_seq) {
    await supabase.from("imphq_vendas").update({ learned_at: new Date().toISOString() }).eq("id", venda.id);
    return { ok: false, venda_id: venda.id, reason: "sem par P/R" };
  }

  const embedTxt = `${pergunta}\n\n${resposta_seq}`;
  const vec = await embed(embedTxt);

  const insertRow: KnowledgeInsert = {
    project_id: projectId,
    pergunta,
    resposta: resposta_seq,
    source: "sale_winning",
    aprovada: true,
    score_uso: 10,
    conversation_id: convId,
    lead_id: leadId,
    answered: true,
  };
  if (vec) insertRow.embedding = vec;

  const { error: insErr } = await supabase.from("imphq_wa_knowledge").insert(insertRow);
  if (insErr) {
    console.error("[wa-learn-from-sale] insert err:", insErr.message);
  }

  // Salva também a conversa completa como contexto adicional
  const vec2 = await embed(conversa_full);
  await supabase.from("imphq_wa_knowledge").insert({
    project_id: projectId,
    pergunta: `[Conversa que virou venda — ${venda.produto_nome || "produto"} — R$${venda.valor || 0}]`,
    resposta: conversa_full,
    source: "sale_winning_full",
    aprovada: true,
    score_uso: 5,
    conversation_id: convId,
    lead_id: leadId,
    answered: true,
    ...(vec2 ? { embedding: vec2 } : {}),
  });

  await supabase.from("imphq_vendas").update({ learned_at: new Date().toISOString() }).eq("id", venda.id);
  return { ok: true, venda_id: venda.id, msgs: msgsOrdered.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    let venda_id: string | null = null;
    let limit = 20;
    try {
      const body = await req.json();
      venda_id = body?.venda_id || null;
      limit = Math.min(body?.limit || 20, 50);
    } catch { /* Optional body: cron calls may omit JSON. */ }

    let vendasQuery = supabase
      .from("imphq_vendas")
      .select("id, lead_id, project_id, produto_nome, valor, data_venda, created_at, tipo_venda, status")
      .is("learned_at", null)
      .eq("status", "approved");

    if (venda_id) {
      vendasQuery = supabase
        .from("imphq_vendas")
        .select("id, lead_id, project_id, produto_nome, valor, data_venda, created_at, tipo_venda, status")
        .eq("id", venda_id);
    } else {
      vendasQuery = vendasQuery.order("created_at", { ascending: false }).limit(limit);
    }

    const { data: vendas, error } = await vendasQuery;
    if (error) throw error;

    const results = [];
    for (const v of vendas || []) {
      try {
        results.push(await processarVenda(supabase, v));
      } catch (e) {
    const eMessage = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : undefined;
        console.error("[wa-learn-from-sale] erro venda", v.id, eMessage);
        results.push({ ok: false, venda_id: v.id, reason: eMessage });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const eMessage = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : undefined;
    console.error("[wa-learn-from-sale] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: eMessage || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
