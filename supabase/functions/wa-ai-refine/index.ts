// wa-ai-refine — chat de refinamento: usuário ensina a IA, IA salva lições
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const tools = [
  {
    type: "function",
    function: {
      name: "save_lesson",
      description: "Salva uma lição/regra de negócio ou exemplo de boa resposta na base de conhecimento da IA.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Resumo curto da situação (até 120 chars)" },
          regra: { type: "string", description: "Regra ou resposta padrão que a IA deve seguir" },
        },
        required: ["titulo", "regra"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_objection",
      description: "Cadastra uma objeção comum de lead e a resposta padrão para contorná-la.",
      parameters: {
        type: "object",
        properties: {
          objecao: { type: "string", description: "Objeção do lead (ex: 'está caro')" },
          resposta_padrao: { type: "string", description: "Resposta ideal" },
        },
        required: ["objecao", "resposta_padrao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tone",
      description: "Ajusta tom/personalidade ou adiciona instrução geral persistente para a IA.",
      parameters: {
        type: "object",
        properties: {
          instrucao: { type: "string", description: "Instrução a anexar ao prompt da IA" },
        },
        required: ["instrucao"],
      },
    },
  },
];

async function embed(text: string): Promise<number[] | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-embedding-001", input: text, dimensions: 768 }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.[0]?.embedding || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { messages, projeto_id } = await req.json();
    if (!projeto_id) throw new Error("projeto_id obrigatório");
    if (!Array.isArray(messages)) throw new Error("messages obrigatório");

    const sys = `Você é coach de IA de vendas. O usuário (operador humano) está te ensinando como responder melhor leads no WhatsApp.

Sua missão:
1. Entender o ajuste que ele quer fazer (tom, objeção nova, regra, exemplo de boa resposta, erro a evitar).
2. Fazer no máximo 1 pergunta curta de clarificação se faltar contexto crítico.
3. Quando tiver clareza, CHAMAR a ferramenta apropriada:
   - save_objection → quando é uma objeção comum de lead + resposta
   - save_lesson → quando é regra de negócio, exemplo de boa resposta, contexto do produto
   - update_tone → quando é ajuste de tom/personalidade geral
4. Após salvar, confirme em 1-2 frases o que foi gravado.

Responda sempre em pt-BR, direto, sem rodeios. NÃO invente dados — só salve o que o usuário disse claramente.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, ...messages],
        tools,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `AI ${res.status}: ${t.slice(0, 200)}` }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const choice = data?.choices?.[0]?.message || {};
    const toolCalls = choice.tool_calls || [];
    const saved: any[] = [];

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}

      if (name === "save_objection") {
        const { data: ins } = await supabase.from("imphq_wa_objections").insert({
          projeto_id, objecao: args.objecao, resposta_padrao: args.resposta_padrao,
          origem: "refinement", status: "ativa",
        }).select().single();
        saved.push({ tipo: "objecao", ...args, id: ins?.id });
      } else if (name === "save_lesson") {
        const emb = await embed(`${args.titulo}\n${args.regra}`);
        const { data: ins } = await supabase.from("imphq_wa_knowledge").insert({
          project_id: projeto_id,
          pergunta: args.titulo,
          resposta: args.regra,
          embedding: emb,
          source: "refinement",
          aprovada: true,
        }).select().single();
        saved.push({ tipo: "licao", ...args, id: ins?.id });
      } else if (name === "update_tone") {
        const { data: configs } = await supabase
          .from("imphq_wa_ai_config")
          .select("id, custom_instructions, provider_id")
          .eq("project_id", projeto_id)
          .eq("enabled", true);
        const cfg = configs?.find((c: any) => !c.provider_id) || configs?.[0];
        const prev = (cfg as any)?.custom_instructions || "";
        const novo = prev ? `${prev}\n• ${args.instrucao}` : `• ${args.instrucao}`;
        if (cfg?.id) {
          await supabase.from("imphq_wa_ai_config").update({ custom_instructions: novo, updated_at: new Date().toISOString() }).eq("id", cfg.id);
        } else {
          await supabase.from("imphq_wa_ai_config").update({ custom_instructions: novo, updated_at: new Date().toISOString() }).eq("project_id", projeto_id);
        }
        saved.push({ tipo: "tom", ...args });
      }
    }

    return new Response(JSON.stringify({
      reply: choice.content || (saved.length ? "Anotado ✓" : ""),
      saved,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("wa-ai-refine:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
