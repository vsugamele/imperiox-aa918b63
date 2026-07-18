// Swipe File — Motor de geração: variations | extract_template | bulk_campaign
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callAI(messages: any[], json = true) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "{}";
}

async function getProjectContext(supabase: any, project_id: string | null, produto_id: string | null) {
  if (!project_id) return "";
  const { data: p } = await supabase.from("imphq_projects").select("nome, data").eq("id", project_id).single();
  if (!p) return "";
  const d = typeof p.data === "string" ? JSON.parse(p.data) : (p.data || {});
  const produtos = d.produtos || [];
  const produto = produto_id ? produtos.find((x: any) => x.id === produto_id || x.nome === produto_id) : produtos[0];
  return `\n\nCONTEXTO DO PROJETO "${p.nome}":
- Avatar: ${JSON.stringify(d.avatar || {}).slice(0, 1500)}
- Branding/tom: ${JSON.stringify(d.branding || {}).slice(0, 800)}
- Produto-alvo: ${produto ? JSON.stringify(produto).slice(0, 1500) : "(nenhum)"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { mode, swipe_id, swipe_ids = [], n_variations = 5, target_project_id = null, target_produto_id = null, briefing = "" } = body;

    if (mode === "variations") {
      const { data: swipe } = await supabase.from("imphq_swipes").select("*").eq("id", swipe_id).eq("user_id", user.id).single();
      if (!swipe) throw new Error("Swipe não encontrado");
      const ctx = await getProjectContext(supabase, target_project_id, target_produto_id);
      const out = await callAI([
        { role: "system", content: "Você é copywriter de marketing direto. Adapta copys mantendo a fórmula original. Sempre JSON válido." },
        { role: "user", content: `Pegue a copy abaixo e gere ${n_variations} VARIAÇÕES adaptadas ao contexto abaixo, mantendo a estrutura (gancho/participacao_ativa/narrativa/reframe/cta_engajamento/cta_venda).

COPY ORIGINAL:
${JSON.stringify({ title: swipe.title, blocks: swipe.blocks, mecanismo: swipe.mecanismo }, null, 2)}

ENGENHARIA REVERSA (use como guia):
${JSON.stringify(swipe.reverse_engineering || {}, null, 2)}

BRIEFING EXTRA: ${briefing || "(nenhum)"}
${ctx}

Devolva JSON: { "variations": [ { "title": "...", "blocks": { "gancho":"...", "participacao_ativa":"...", "narrativa":"...", "reframe":"...", "cta_engajamento":"...", "cta_venda":"..." } } ] }` },
      ]);
      const parsed = JSON.parse(out);
      const variations = parsed.variations || [];
      const rows = variations.map((v: any) => ({
        user_id: user.id,
        project_id: target_project_id,
        produto_id: target_produto_id,
        title: v.title || `Variação de ${swipe.title}`,
        criador: swipe.criador,
        plataforma: swipe.plataforma,
        formato: swipe.formato,
        mecanismo: swipe.mecanismo,
        gatilhos: swipe.gatilhos,
        nicho: swipe.nicho,
        tags: [...(swipe.tags || []), "variação"],
        blocks: v.blocks || {},
        source_swipe_id: swipe.id,
        status: "rascunho",
      }));
      const { data: inserted } = await supabase.from("imphq_swipes").insert(rows as any).select();
      return new Response(JSON.stringify({ ok: true, count: inserted?.length || 0, variations: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "extract_template") {
      const ids = swipe_id ? [swipe_id] : swipe_ids;
      const { data: swipes } = await supabase.from("imphq_swipes").select("*").in("id", ids).eq("user_id", user.id);
      if (!swipes?.length) throw new Error("Nenhum swipe encontrado");
      const out = await callAI([
        { role: "system", content: "Você destila múltiplas copys numa fórmula reutilizável. Sempre JSON válido." },
        { role: "user", content: `Analise as copys abaixo e destile a FÓRMULA reutilizável que elas compartilham.

COPYS:
${swipes.map((s: any, i: number) => `--- COPY ${i + 1}: ${s.title} ---\n${JSON.stringify(s.blocks)}`).join("\n\n")}

Devolva JSON: { "name": "nome curto", "formula": "descrição em 1 frase", "skeleton": { "gancho": "template com {placeholders}", "participacao_ativa": "...", "narrativa": "...", "reframe": "...", "cta_engajamento": "...", "cta_venda": "..." }, "notes": "quando usar essa fórmula" }` },
      ]);
      const parsed = JSON.parse(out);
      const { data: inserted } = await supabase.from("imphq_swipe_templates").insert({
        user_id: user.id,
        name: parsed.name || "Template sem nome",
        formula: parsed.formula || "",
        skeleton: parsed.skeleton || {},
        notes: parsed.notes || "",
        source_swipe_ids: ids,
      } as any).select().single();
      return new Response(JSON.stringify({ ok: true, template: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "bulk_campaign") {
      const { data: swipes } = await supabase.from("imphq_swipes").select("*").in("id", swipe_ids).eq("user_id", user.id);
      if (!swipes?.length) throw new Error("Nenhum swipe selecionado");
      const ctx = await getProjectContext(supabase, target_project_id, target_produto_id);
      const out = await callAI([
        { role: "system", content: "Você gera campanhas inteiras aplicando fórmulas validadas a um novo produto. JSON válido sempre." },
        { role: "user", content: `Pegue cada copy-fonte abaixo e gere UMA copy nova adaptada ao contexto, mantendo a estrutura única de cada fonte.

COPYS-FONTE:
${swipes.map((s: any, i: number) => `--- ${i + 1}. ${s.title} (${s.mecanismo || "?"}) ---\n${JSON.stringify(s.blocks)}`).join("\n\n")}

BRIEFING: ${briefing || "(nenhum)"}
${ctx}

Devolva JSON: { "copies": [ { "source_index": 0, "title": "...", "blocks": {...} }, ... ] }` },
      ]);
      const parsed = JSON.parse(out);
      const copies = parsed.copies || [];
      const rows = copies.map((c: any) => {
        const src = swipes[c.source_index] || swipes[0];
        return {
          user_id: user.id,
          project_id: target_project_id,
          produto_id: target_produto_id,
          title: c.title || `Bulk de ${src.title}`,
          mecanismo: src.mecanismo,
          gatilhos: src.gatilhos,
          nicho: src.nicho,
          plataforma: src.plataforma,
          formato: src.formato,
          tags: ["bulk"],
          blocks: c.blocks || {},
          source_swipe_id: src.id,
          status: "rascunho",
        };
      });
      const { data: inserted } = await supabase.from("imphq_swipes").insert(rows as any).select();
      return new Response(JSON.stringify({ ok: true, count: inserted?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "vsl_from_swipe") {
      const { data: swipe } = await supabase.from("imphq_swipes").select("*").eq("id", swipe_id).eq("user_id", user.id).single();
      if (!swipe) throw new Error("Swipe não encontrado");
      const re = swipe.reverse_engineering || {};
      const isVsl = (swipe.blocks?.__schema === "vsl7") || (swipe.formato || "").toLowerCase() === "vsl" || re.__schema === "vsl7";
      if (!isVsl) throw new Error("Esta swipe não está marcada como VSL. Rode a engenharia reversa primeiro com schema VSL.");
      const ctx = await getProjectContext(supabase, target_project_id, target_produto_id);

      const out = await callAI([
        { role: "system", content: "Você é um copywriter sênior especializado em VSLs de alto ticket. Sempre devolve JSON válido. Os 7 blocos devem ser texto narrativo e literal, prontos para serem narrados em vídeo (não bullets)." },
        { role: "user", content: `Use a estrutura de 7 blocos da VSL de referência abaixo como MOTOR e gere uma NOVA VSL completa adaptada ao produto/avatar do contexto. Preserve a fórmula, mas troque exemplos, mecanismo, números, bônus e CTA pelo contexto real.

ESTRUTURA DE 7 BLOCOS:
B1 Gancho & Interrupção (0:00-1:30)
B2 Agitação do Problema (1:30-4:00)
B3 História de Origem & Epifania (4:00-8:30)
B4 Mecanismo Único (8:30-11:00)
B5 Revelação da Oferta & Escada de Ancoragem (11:00-14:00)
B6 Value Stack & Bônus (14:00-17:00)
B7 Garantia & CTA Final (17:00-19:30)

VSL DE REFERÊNCIA (esqueleto + blocos originais):
${JSON.stringify({ title: swipe.title, blocks: swipe.blocks, mecanismo: swipe.mecanismo }, null, 2).slice(0, 6000)}

ENGENHARIA REVERSA DA REFERÊNCIA:
${JSON.stringify(re, null, 2).slice(0, 5000)}

BRIEFING DO USUÁRIO: ${briefing || "(nenhum — use só o contexto do projeto)"}
${ctx}

Devolva JSON:
{
  "title": "título da nova VSL",
  "promessa_central": "1 frase",
  "mecanismo_unico": { "nome": "...", "analogia": "...", "pilares": ["..."] },
  "blocks": {
    "__schema": "vsl7",
    "b1_gancho": "texto narrativo completo (200-400 palavras)",
    "b2_agitacao": "texto narrativo completo (400-700 palavras)",
    "b3_origem": "texto narrativo completo (600-1000 palavras)",
    "b4_mecanismo": "texto narrativo completo (400-700 palavras)",
    "b5_oferta": "texto narrativo completo com escada de ancoragem (300-600 palavras)",
    "b6_value_stack": "texto narrativo com bônus mapeados a objeções (300-600 palavras)",
    "b7_garantia_cta": "texto narrativo com garantia + CTA + urgência (200-400 palavras)"
  }
}` },
      ]);
      const parsed = JSON.parse(out);
      const newBlocks = { ...(parsed.blocks || {}), __schema: "vsl7" };
      const { data: inserted } = await supabase
        .from("imphq_swipes")
        .insert({
          user_id: user.id,
          project_id: target_project_id,
          produto_id: target_produto_id,
          title: parsed.title || `VSL gerada de ${swipe.title}`,
          plataforma: "LP",
          formato: "VSL",
          mecanismo: parsed.mecanismo_unico?.nome || swipe.mecanismo,
          gatilhos: swipe.gatilhos,
          nicho: swipe.nicho,
          tags: ["vsl-gerada", "motor"],
          blocks: newBlocks,
          source_swipe_id: swipe.id,
          status: "rascunho",
          reverse_engineering: {
            __schema: "vsl7",
            promessa_central: parsed.promessa_central,
            mecanismo_unico: parsed.mecanismo_unico,
            origem: `Gerada a partir de "${swipe.title}"`,
          },
        } as any)
        .select()
        .single();
      return new Response(JSON.stringify({ ok: true, swipe: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "mode inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[swipe-generate]", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

