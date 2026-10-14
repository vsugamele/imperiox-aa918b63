// Hook Generator — preenche templates dos 400 hooks OU gera hooks originais
// lendo Projeto (`imphq_projects`), Avatar (`imphq_projects.avatar`),
// Documentos (`imphq_docs`) e Skills ativas (`imphq_skills`). Requer auth.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/require-auth.ts";
import { installAiUsageTracking } from "../_shared/ai-usage.ts";
// Custo por automação (OP1.4): registra cada chamada de IA desta function em imphq_ai_usage.
installAiUsageTracking("hook-generator");

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `Você é o Imperius Hook Arsenal, especialista em hooks de resposta direta pt-BR (Halbert, Carlton, Schwartz, Filemon, Sugamele).
Regras obrigatórias:
- Português Brasil natural, conversacional e visceral, sem clichê de guru.
- Zero emoji. Zero "descubra", "revelação", "chocante", "insano".
- Frases curtas. Foco em curiosidade + especificidade + gap de conhecimento + mecanismo único.
- Use obrigatoriamente os dados reais do PROJETO, do AVATAR PSICOLÓGICO (dores profundas, inimigo comum, gatilho nuclear, desejos), dos DOCUMENTOS (imphq_docs) e das SKILLS (imphq_skills) fornecidos no contexto.
- Se receber template com [colchetes], preencha TODOS com base no contexto real do projeto/avatar — o hook final não pode ter colchete nenhum.`;

async function callAI(user: string, jsonSchema: Record<string, unknown>) {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY ausente");
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "out", strict: true, schema: jsonSchema } },
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`AI ${res.status}: ${txt.slice(0, 300)}`);
  const j = JSON.parse(txt);
  const content = j.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return JSON.parse(content.replace(/```json|```/g, "").trim());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      mode = "fill",
      project_id,
      template,
      objetivo,
      gatilho,
      quantidade = 8,
    } = body;

    let contexto = "";
    let projName = "Projeto";
    let avatarName = "Avatar";
    let mechanismName = "Mecanismo Único";
    let enemyName = "métodos paliativos tradicionais";
    let deepPains: string[] = [];
    let nativeHooks: string[] = [];
    let docTitle = "Dossiê Estratégico";
    let skillName = "Hook Arsenal";

    if (project_id && project_id !== "__none__") {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      const [projRes, docsRes, skillsRes] = await Promise.all([
        sb
          .from("imphq_projects")
          .select("id,name,description,category,data,avatar,brand_kit")
          .eq("id", project_id)
          .maybeSingle(),
        sb
          .from("imphq_docs")
          .select("id,title,category,content,body,project_id")
          .or(`project_id.eq.${project_id},project_id.is.null`)
          .limit(10),
        sb
          .from("imphq_skills")
          .select("name,slug,category,description,system_prompt")
          .eq("is_active", true)
          .in("slug", [
            "hook-arsenal",
            "angulos-criativos",
            "mecanismo-unico",
            "dossie-problemas",
            "mapeamento-desejos",
            "vinicius_sugamele",
            "weaponized-credibility",
          ])
          .limit(7),
      ]);

      const proj = projRes.data;
      const d = (proj?.data && typeof proj.data === "object" ? proj.data : {}) as Record<string, any>;
      const topAv = (proj?.avatar && typeof proj.avatar === "object" ? proj.avatar : {}) as Record<string, any>;
      const nestedAv = (d.avatar && typeof d.avatar === "object" ? d.avatar : {}) as Record<string, any>;
      const av = { ...nestedAv, ...topAv };

      projName = String(proj?.name || project_id);
      avatarName = String(av.nome || av.name || `Avatar de ${projName}`);
      const mecObj = d.mecanismo_unico && typeof d.mecanismo_unico === "object" ? d.mecanismo_unico : {};
      mechanismName = String(
        typeof d.mecanismo_unico === "string"
          ? d.mecanismo_unico
          : mecObj.nome || mecObj.mecanismo_solucao || d.mecanismo || `Protocolo ${projName}`
      );
      enemyName = String(av.inimigo || d.inimigo_comum || "soluções superficiais que só mascaram o sintoma");
      deepPains = Array.isArray(av.dores_profundas)
        ? av.dores_profundas.map(String)
        : Array.isArray(av.dores)
        ? av.dores.map(String)
        : [];
      nativeHooks = Array.isArray(av.ganchos) ? av.ganchos.map(String) : [];

      const docs = (docsRes.data || []) as Array<Record<string, any>>;
      if (docs[0]?.title) docTitle = String(docs[0].title);
      const docsFormatted = docs
        .slice(0, 5)
        .map((doc) => {
          const text = String(doc.content || doc.body || "")
            .replace(/\s+/g, " ")
            .slice(0, 350);
          return `- [${doc.category || "doc"}] ${doc.title}: ${text}`;
        })
        .join("\n");

      const skills = (skillsRes.data || []) as Array<Record<string, any>>;
      if (skills[0]?.name) skillName = String(skills[0].name);
      const skillsFormatted = skills
        .map((s) => {
          const promptSnippet = String(s.system_prompt || s.description || "")
            .replace(/\s+/g, " ")
            .slice(0, 280);
          return `- ${s.name} (${s.slug}): ${promptSnippet}`;
        })
        .join("\n");

      contexto = [
        `# PROJETO ATIVO: ${projName}`,
        `Categoria/Nicho: ${proj?.category || d.nicho || "Resposta Direta"}`,
        `Descrição: ${proj?.description || "—"}`,
        `Promessa / Big Idea: ${d.promessa || d.big_idea || av.desejo_externo || "—"}`,
        `Mecanismo Único: ${mechanismName}`,
        ``,
        `# AVATAR PSICOLÓGICO (${avatarName})`,
        `Dores Profundas: ${JSON.stringify(deepPains)}`,
        `Desejo Externo: ${av.desejo_externo || "—"}`,
        `Desejo Interno: ${av.desejo_interno || "—"}`,
        `Desejos Proibidos: ${JSON.stringify(av.desejos_proibidos || [])}`,
        `Inimigo Comum: ${enemyName}`,
        `Gatilho Nuclear: ${av.gatilho_nuclear || "—"}`,
        `Ganchos Nativos do Avatar: ${JSON.stringify(nativeHooks)}`,
        `Objeções Reais: ${JSON.stringify(av.objecoes || [])}`,
        ``,
        `# DOCUMENTOS DO PROJETO E BASE DE CONHECIMENTO (imphq_docs)`,
        docsFormatted || "—",
        ``,
        `# SKILLS APLICADAS (imphq_skills)`,
        skillsFormatted || "—",
      ].join("\n");
    }

    if (mode === "fill" && template) {
      const instr = `${contexto}\n\n# TAREFA\nPreencha o template abaixo aplicando o Avatar, Mecanismo Único, Documentos e Skills acima. Gere 5 variações fortes e ultra-específicas para o projeto ${projName}.\nTemplate: "${template}"\nObjetivo do ad: ${objetivo || "—"}\nGatilho: ${gatilho || "—"}`;
      try {
        const out = await callAI(instr, {
          type: "object",
          additionalProperties: false,
          properties: { variacoes: { type: "array", items: { type: "string" } } },
          required: ["variacoes"],
        });
        return new Response(JSON.stringify(out), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        const pain1 = deepPains[0] || "esse sintoma diário";
        const pain2 = deepPains[1] || pain1;
        const variacoes = [
          `${template.replace(/\[.*?\]/g, mechanismName)} — especialmente para quem sofre com "${pain1}" e cansou de ${enemyName}.`,
          `Por que ${avatarName} que enfrenta "${pain1}" precisa conhecer ${mechanismName} antes de tentar qualquer outra coisa.`,
          `O erro silencioso em ${enemyName} que mantém "${pain2}" ativo (e como ${mechanismName} inverte esse ciclo).`,
          ...(nativeHooks.slice(0, 2)),
        ];
        return new Response(JSON.stringify({ variacoes }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // mode === "generate": novos hooks originais lendo Projeto + Avatar + Docs + Skills
    const instr = `${contexto}\n\n# TAREFA\nGere ${quantidade} hooks ORIGINAIS (não copie templates genéricos) para o projeto "${projName}" e o avatar "${avatarName}", para o objetivo "${objetivo || "Parar o scroll"}" usando o gatilho "${gatilho || "Curiosidade"}".\nCada hook deve ter 1 a 2 frases, sem colchetes, mencionando a dor real do avatar, o inimigo comum ou o mecanismo "${mechanismName}", e no campo "motivo" explique qual Dor do Avatar + Documento + Skill foi aplicado.`;
    try {
      const out = await callAI(instr, {
        type: "object",
        additionalProperties: false,
        properties: {
          hooks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { texto: { type: "string" }, motivo: { type: "string" } },
              required: ["texto", "motivo"],
            },
          },
        },
        required: ["hooks"],
      });
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      const pain1 = deepPains[0] || "o problema que trava sua rotina";
      const pain2 = deepPains[1] || pain1;
      const hooks = [
        ...nativeHooks.slice(0, 4).map((t) => ({
          texto: t,
          motivo: `Avatar (${avatarName}) · Skill: ${skillName} · Doc: ${docTitle}`,
        })),
        {
          texto: `Se disseram para você que a culpa é sua por "${pain1}", mentiram: o verdadeiro bloqueio está em ${enemyName} — e é exatamente aí que ${mechanismName} atua.`,
          motivo: `Mecanismo Único (${mechanismName}) + Dor Raiz de ${avatarName} + Doc: ${docTitle}`,
        },
        {
          texto: `Por que quem sofre com "${pain2}" sente que nada funciona depois dos primeiros 7 dias (e o ajuste de 15 segundos com ${mechanismName} que muda isso).`,
          motivo: `Skill: Ângulos Criativos + Hook Arsenal · Gatilho: ${gatilho || "Curiosidade"}`,
        },
      ];
      return new Response(JSON.stringify({ hooks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    const eMessage =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e && typeof e.message === "string"
        ? e.message
        : undefined;
    return new Response(JSON.stringify({ error: eMessage || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
