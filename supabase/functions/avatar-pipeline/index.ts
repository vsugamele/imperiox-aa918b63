// Avatar 3.0 Pipeline — 3 estágios:
// 1) EXTRACT: lê todas as fontes do projeto (briefing, expert, pesquisa, concorrentes, dores, desejos,
//    voyerismos, leads-respostas) e produz "evidências" tipadas com source.
// 2) ENRICH: para cada campo do perfil, escolhe top evidências e gera o conteúdo final + cita fontes.
// 3) SCORE: calcula confiança (0-100) por campo com base em quantidade/qualidade das evidências.
// Retorna { perfil, camadas, crencas, evidencias_por_campo, confianca_por_campo }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-2.5-flash";

type Evidence = { source: string; text: string; weight: number };

const FIELDS = [
  { key: "retrato", label: "Retrato do avatar", group: "perfil" },
  { key: "arquetipo", label: "Arquétipo", group: "perfil" },
  { key: "ferida_central", label: "Ferida central", group: "perfil" },
  { key: "padrao", label: "Padrão de autossabotagem", group: "perfil" },
  { key: "contradicao", label: "Contradição central", group: "perfil" },
  { key: "desejo_externo", label: "Desejo externo", group: "root" },
  { key: "desejo_interno", label: "Desejo interno core", group: "root" },
  { key: "inimigo", label: "Inimigo", group: "root" },
  { key: "resultado_sonhado", label: "Resultado sonhado", group: "root" },
  { key: "trigger_event", label: "Trigger event", group: "root" },
  { key: "fase_consciencia", label: "Fase de consciência", group: "root" },
  { key: "crenca_bloqueadora", label: "Crença bloqueadora", group: "root" },
  { key: "crenca_necessaria", label: "Crença necessária", group: "root" },
  { key: "epifania_central", label: "Epifania central", group: "root" },
  { key: "c1_observaveis", label: "C1 — Comportamentos observáveis", group: "camadas" },
  { key: "c2_conscientes", label: "C2 — Desejos conscientes", group: "camadas" },
  { key: "c3_subconscientes", label: "C3 — Crenças subconscientes", group: "camadas" },
  { key: "c4_trauma", label: "C4 — Trauma / Ferida core", group: "camadas" },
];

async function callAI(system: string, user: string, schema?: any, fnName?: string): Promise<any> {
  const body: any = {
    model: MODEL,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  };
  if (schema && fnName) {
    body.tools = [{ type: "function", function: { name: fnName, parameters: schema } }];
    body.tool_choice = { type: "function", function: { name: fnName } };
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (schema && fnName) {
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) : {};
  }
  return data?.choices?.[0]?.message?.content || "";
}

// === STAGE 1: EXTRACT ===
function extractEvidences(project: any, leadAnswers: any[]): Evidence[] {
  const ev: Evidence[] = [];
  const d = project?.data || {};
  const briefing = d.briefing || {};
  const expert = d.expert || {};
  const pesquisa = d.pesquisa || {};
  const concorrentes = d.concorrentes || [];
  const avatar = project.avatar || {};

  const push = (source: string, text: any, weight = 1) => {
    if (!text) return;
    const s = typeof text === "string" ? text : JSON.stringify(text);
    if (s.length < 4) return;
    ev.push({ source, text: s.slice(0, 800), weight });
  };

  // Briefing
  push("briefing.publico", briefing.publico, 3);
  push("briefing.nicho", briefing.nicho, 2);
  push("briefing.transformacao", briefing.transformacao, 3);
  push("briefing.problema", briefing.problema_principal, 3);

  // Expert tone & method
  push("expert.bio", expert.bio, 1);
  push("expert.metodo", expert.metodo, 2);
  push("expert.transformacao", expert.transformacao, 2);
  if (Array.isArray(expert.pilares)) push("expert.pilares", expert.pilares.join(" | "), 1);

  // Pesquisa
  if (Array.isArray(pesquisa.dores)) pesquisa.dores.forEach((d: any, i: number) =>
    push(`pesquisa.dor_${i + 1}`, typeof d === "string" ? d : d?.dor || d?.texto, 3));
  if (Array.isArray(pesquisa.desejos)) pesquisa.desejos.forEach((d: any, i: number) =>
    push(`pesquisa.desejo_${i + 1}`, typeof d === "string" ? d : d?.desejo || d?.texto, 3));
  if (Array.isArray(pesquisa.objecoes)) pesquisa.objecoes.forEach((d: any, i: number) =>
    push(`pesquisa.objecao_${i + 1}`, typeof d === "string" ? d : d?.texto, 2));
  if (Array.isArray(pesquisa.frases_reais)) pesquisa.frases_reais.slice(0, 10).forEach((f: any, i: number) =>
    push(`pesquisa.frase_${i + 1}`, typeof f === "string" ? f : f?.texto, 4));

  // Avatar existente (dores/desejos/voyerismos)
  if (Array.isArray(avatar.dores)) avatar.dores.slice(0, 8).forEach((d: any, i: number) =>
    push(`avatar.dor_${i + 1}`, typeof d === "string" ? d : d?.dor || d?.texto, 3));
  if (Array.isArray(avatar.desejos_externos)) avatar.desejos_externos.slice(0, 5).forEach((d: any, i: number) =>
    push(`avatar.desejo_ext_${i + 1}`, d.nome || d.texto, 2));
  if (Array.isArray(avatar.desejos_internos)) avatar.desejos_internos.slice(0, 5).forEach((d: any, i: number) =>
    push(`avatar.desejo_int_${i + 1}`, d.nome || d.texto, 3));
  if (Array.isArray(avatar.voyerismos)) avatar.voyerismos.slice(0, 5).forEach((v: any, i: number) =>
    push(`avatar.cena_${i + 1}`, [v.nome, v.situacao, v.pensamento].filter(Boolean).join(" — "), 4));
  if (Array.isArray(avatar.problemas)) avatar.problemas.slice(0, 5).forEach((p: any, i: number) =>
    push(`avatar.problema_${i + 1}`, typeof p === "string" ? p : p?.nome, 2));

  // Concorrentes — promessas/headlines
  concorrentes.slice(0, 5).forEach((c: any, i: number) => {
    push(`concorrente.${i + 1}.promessa`, c.promessa || c.headline, 1);
    push(`concorrente.${i + 1}.angulo`, c.angulo, 1);
  });

  // Lead answers (vozes reais!) — peso máximo
  leadAnswers.slice(0, 30).forEach((a: any, i: number) => {
    const txt = a.answer || a.response || a.text;
    if (txt && String(txt).length > 10) push(`lead.resposta_${i + 1}`, txt, 5);
  });

  return ev;
}

// === STAGE 3: SCORE ===
function scoreField(evidences: Evidence[], hasContent: boolean): number {
  if (!hasContent) return 0;
  const totalWeight = evidences.reduce((s, e) => s + e.weight, 0);
  // base 30 if any content; +X per weighted evidence; cap 100
  const score = Math.min(100, 30 + totalWeight * 8);
  return Math.round(score);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("missing auth");
    const supaUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await supaUser.auth.getUser();
    if (!userData?.user) throw new Error("unauthorized");

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json();
    const projectId: string = body.project_id;
    const stage: "extract" | "enrich" | "all" = body.stage || "all";
    if (!projectId) throw new Error("project_id required");

    // Load project + lead answers
    const { data: project } = await supa.from("imphq_projects")
      .select("id, name, data, avatar").eq("id", projectId).single();
    if (!project) throw new Error("project not found");

    let leadAnswers: any[] = [];
    try {
      const { data } = await supa.from("imphq_lead_responses")
        .select("response_data").eq("project_id", projectId).limit(30).order("created_at", { ascending: false });
      leadAnswers = (data || []).flatMap((r: any) => {
        const rd = r.response_data || {};
        return Object.values(rd).filter((v: any) => typeof v === "string" && v.length > 10).map((v: any) => ({ answer: v }));
      });
    } catch (_) { /* table optional */ }

    // ===== STAGE 1: EXTRACT =====
    const allEvidences = extractEvidences(project, leadAnswers);

    if (stage === "extract") {
      return new Response(JSON.stringify({ stage: "extract", evidences: allEvidences, count: allEvidences.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STAGE 2: ENRICH =====
    // Pass top evidences (sorted by weight) to AI; ask it to fill all fields citing source ids
    const topEv = [...allEvidences].sort((a, b) => b.weight - a.weight).slice(0, 60);
    const evidenceBlock = topEv.map((e, i) => `[E${i + 1} | ${e.source} | peso ${e.weight}] ${e.text}`).join("\n");

    const fieldsSpec = FIELDS.map(f => `- ${f.key}: ${f.label}`).join("\n");

    const sys = `Você é o Avatar Architect 3.0 — psicólogo de consumo brasileiro, especialista em criar avatares baseados EXCLUSIVAMENTE em evidências reais do projeto. Você NÃO inventa nada. Para cada campo, você escolhe as evidências mais relevantes e produz o conteúdo final citando os IDs das evidências usadas.`;

    const user = `PROJETO: ${project.name}

EVIDÊNCIAS DISPONÍVEIS (use os IDs E1, E2, ...):
${evidenceBlock}

PREENCHA OS CAMPOS ABAIXO. Para cada campo retorne:
- valor: texto final, em português BR, OBJETIVO (1-3 frases para campos curtos; 1 parágrafo para retrato/camadas)
- evidence_ids: array dos IDs (ex: ["E3","E12"]) usados — vazio se não houver base suficiente
- valor vazio se NÃO HOUVER evidências para fundamentar (não invente).

CAMPOS:
${fieldsSpec}`;

    const schema = {
      type: "object",
      properties: {
        fields: {
          type: "object",
          properties: Object.fromEntries(FIELDS.map(f => [f.key, {
            type: "object",
            properties: {
              valor: { type: "string" },
              evidence_ids: { type: "array", items: { type: "string" } },
            },
            required: ["valor", "evidence_ids"],
            additionalProperties: false,
          }])),
          required: FIELDS.map(f => f.key),
          additionalProperties: false,
        },
      },
      required: ["fields"],
      additionalProperties: false,
    };

    const aiResult = await callAI(sys, user, schema, "fill_avatar");
    const filled = aiResult?.fields || {};

    // ===== STAGE 3: SCORE + assemble =====
    const evidByField: Record<string, Evidence[]> = {};
    const confidenceByField: Record<string, number> = {};
    const perfil: any = {};
    const camadas: any = {};
    const root: any = {};

    for (const f of FIELDS) {
      const cell = filled[f.key] || {};
      const ids: string[] = Array.isArray(cell.evidence_ids) ? cell.evidence_ids : [];
      const evList: Evidence[] = ids.map(id => {
        const idx = parseInt(id.replace(/^E/, ""), 10) - 1;
        return topEv[idx];
      }).filter(Boolean);

      evidByField[f.key] = evList;
      confidenceByField[f.key] = scoreField(evList, !!cell.valor);

      const value = cell.valor || "";
      if (f.group === "perfil") perfil[f.key] = value;
      else if (f.group === "camadas") camadas[f.key] = value;
      else root[f.key] = value;
    }

    const result = {
      stage: "complete",
      perfil_psicologico: perfil,
      camadas_psique: camadas,
      ...root,
      _meta: {
        evidence_count: allEvidences.length,
        evidence_used_count: Object.values(evidByField).flat().length,
        evidences_by_field: Object.fromEntries(
          Object.entries(evidByField).map(([k, v]) => [k, v.map(e => ({ source: e.source, text: e.text.slice(0, 200) }))])
        ),
        confidence_by_field: confidenceByField,
        generated_at: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify({ avatar_pipeline: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[avatar-pipeline] error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
