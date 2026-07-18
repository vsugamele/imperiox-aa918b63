// Hook Generator — preenche templates dos 400 hooks OU gera hooks originais
// usando avatar/produto do projeto ativo. Requer auth.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/require-auth.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `Você é o Imperius Hook Arsenal, especialista em hooks de resposta direta pt-BR (Halbert, Carlton, Schwartz, Filemon).
Regras:
- Português Brasil, tom direto, sem clichê de guru.
- Zero emoji. Zero "descubra", "revelação", "chocante", "insano".
- Frases curtas. Foco em curiosidade + especificidade + gap de conhecimento.
- Use dados reais do avatar/produto quando disponíveis. Sem inventar números.
- Se receber template com [colchetes], preencha TODOS com base no contexto — o hook final não pode ter colchete nenhum.`;

async function callAI(user: string, jsonSchema: any) {
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
  try { return JSON.parse(content); } catch { return JSON.parse(content.replace(/```json|```/g, "").trim()); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { mode = "fill", project_id, template, objetivo, gatilho, quantidade = 8 } = body;

    let contexto = "";
    if (project_id) {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: proj } = await sb.from("imphq_projects").select("nome,data").eq("id", project_id).maybeSingle();
      const d = (proj as any)?.data || {};
      const av = d.avatar || d.avatars_por_produto;
      contexto = `# PROJETO\n${proj?.nome || ""}\nNicho: ${d.nicho || "—"}\nPromessa: ${d.promessa || d.big_idea || "—"}\nAvatar: ${typeof av === "string" ? av.slice(0, 1500) : JSON.stringify(av || {}).slice(0, 1500)}\n`;
    }

    if (mode === "fill" && template) {
      const instr = `${contexto}\n# TAREFA\nPreencha o template abaixo com base no contexto acima. Gere 5 variações fortes.\nTemplate: "${template}"\nObjetivo do ad: ${objetivo || "—"}\nGatilho: ${gatilho || "—"}`;
      const out = await callAI(instr, {
        type: "object", additionalProperties: false,
        properties: { variacoes: { type: "array", items: { type: "string" } } },
        required: ["variacoes"],
      });
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // mode === "generate": novos hooks originais
    const instr = `${contexto}\n# TAREFA\nGere ${quantidade} hooks ORIGINAIS (não copie templates conhecidos) para o objetivo "${objetivo || "Parar o scroll"}" usando o gatilho "${gatilho || "Curiosidade"}".\nCada hook: 1 frase, máximo 22 palavras, sem colchete, específico ao projeto.`;
    const out = await callAI(instr, {
      type: "object", additionalProperties: false,
      properties: {
        hooks: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            properties: { texto: { type: "string" }, motivo: { type: "string" } },
            required: ["texto", "motivo"],
          },
        },
      },
      required: ["hooks"],
    });
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
