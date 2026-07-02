import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BLOCK_PROMPTS: Record<string, { system: string; goal: string }> = {
  vsl: { system: "Você é copywriter de VSL. Devolva roteiro em blocos (Hook / História / Prova / Oferta / CTA).", goal: "Roteiro completo de VSL de 8-15min" },
  email: { system: "Você é copywriter de e-mail marketing direto.", goal: "1 e-mail com assunto forte e CTA claro" },
  ad_copy: { system: "Você é copywriter de anúncios pagos Meta.", goal: "3 variações: título curto, primária longa, descrição" },
  landing: { system: "Você é estrategista de landing page de conversão.", goal: "Estrutura em seções (Hero/Prova/Oferta/FAQ/CTA) com copy" },
  wa_seq: { system: "Você é especialista em copy de WhatsApp humano e consultivo.", goal: "Sequência de 4-6 mensagens curtas" },
  reels: { system: "Você é roteirista de Reels/Story para Instagram.", goal: "Roteiro cena a cena de 30-60s com hook forte" },
  qualif: { system: "Você é especialista em qualificação de leads.", goal: "5-7 perguntas de qualificação que separam curioso de comprador" },
};

const ETAPA_MIX: Record<string, string[]> = {
  descoberta: ["reels", "ad_copy"],
  interesse: ["email", "landing"],
  consideracao: ["vsl", "email"],
  decisao: ["wa_seq", "ad_copy"],
  compra: ["email"],
  pos: ["email", "wa_seq"],
};

async function callAI(system: string, user: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || "";
}

function buildProductContext(proj: any, produtoIdx: number) {
  const data = typeof proj.data === "string" ? JSON.parse(proj.data) : (proj.data || {});
  const b = data.briefing || {};
  const produtos = b.produtos || data.produtos || [];
  const p = produtos[produtoIdx] || {};
  const avatar = data.avatar || b.avatar || {};
  const links = Array.isArray(p.links) ? p.links : [];
  const preferido = links.find((l: any) => l?.prioridade_ia === "preferido" && l.tipo === "checkout")?.url || links.find((l: any) => l.tipo === "checkout")?.url || "";
  return {
    nome_projeto: proj.name || proj.nome,
    produto: p.nome || p.name || "",
    preco: p.preco_por || p.preco || "",
    descricao: p.descricao || "",
    promessa: p.promessa || b.promessa || "",
    avatar_resumo: typeof avatar === "string" ? avatar : (avatar?.descricao || avatar?.resumo || JSON.stringify(avatar).slice(0, 400)),
    dores: (avatar?.dores || b?.dores || []).slice(0, 5),
    objecoes: (avatar?.objecoes || b?.objecoes || []).slice(0, 5),
    link_checkout: preferido,
    links_disponiveis: links.map((l: any) => ({ tipo: l.tipo, url: l.url, prio: l.prioridade_ia })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SB_URL, SB_SVC);

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "generate_step") {
      const { step_id, projeto_id, produto_idx } = body;
      const { data: step } = await sb.from("imphq_journey_steps").select("*").eq("id", step_id).single();
      if (!step) throw new Error("step not found");
      const { data: proj } = await sb.from("imphq_projects").select("*").eq("id", projeto_id).single();
      const ctx = buildProductContext(proj, produto_idx || 0);
      const prompt = BLOCK_PROMPTS[step.bloco_tipo] || { system: "Copywriter", goal: "gerar conteúdo" };
      const notas = step.config?.notas || "";
      const user = `PRODUTO: ${ctx.produto} — R$ ${ctx.preco}\nPROMESSA: ${ctx.promessa}\nDORES: ${JSON.stringify(ctx.dores)}\nOBJECOES: ${JSON.stringify(ctx.objecoes)}\nAVATAR: ${ctx.avatar_resumo}\nCHECKOUT: ${ctx.link_checkout}\n\nETAPA DA JORNADA: ${step.etapa}\nBRIEFING EXTRA: ${notas}\n\nOBJETIVO: ${prompt.goal}. Responda em português BR, direto, sem preâmbulo.`;
      const texto = await callAI(prompt.system, user);
      await sb.from("imphq_journey_steps").update({ status: "gerado", output: { texto, generated_at: new Date().toISOString() } }).eq("id", step_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "auto_plan") {
      const { journey_id } = body;
      const { data: existing } = await sb.from("imphq_journey_steps").select("etapa, bloco_tipo").eq("journey_id", journey_id);
      const has = new Set((existing || []).map((s: any) => `${s.etapa}:${s.bloco_tipo}`));
      const inserts: any[] = [];
      for (const [etapa, blocos] of Object.entries(ETAPA_MIX)) {
        blocos.forEach((bt, idx) => {
          if (!has.has(`${etapa}:${bt}`)) {
            inserts.push({ journey_id, etapa, bloco_tipo: bt, titulo: null, config: {}, output: {}, status: "pendente", order_idx: idx });
          }
        });
      }
      if (inserts.length) await sb.from("imphq_journey_steps").insert(inserts);
      return new Response(JSON.stringify({ ok: true, planted: inserts.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("journey-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
