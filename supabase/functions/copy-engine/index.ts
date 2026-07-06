// Motor de Copy unificado. Recebe { intent, input, context } e devolve texto/JSON.
// Resolve system_prompt + model + reasoning + output_format via tabela imphq_copy_engine_prompts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { loadCopyContext, contextToSystemAddendum } from "../_shared/context-loader.ts";
import { deriveAudienceGuardrails, buildGuardBlock, findForbiddenHits } from "../_shared/audience-guardrails.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("copy-engine");


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

function resolveProvider(model: string): { url: string; apiKey: string } {
  const isLovable = /^(google|openai)\//.test(model);
  if (isLovable) {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: LOVABLE_API_KEY };
  }
  if (!OPENROUTER_API_KEY) throw new Error(`OPENROUTER_API_KEY não configurada (modelo ${model})`);
  return { url: "https://openrouter.ai/api/v1/chat/completions", apiKey: OPENROUTER_API_KEY };
}

interface ReqBody {
  intent: string;
  input: string | { messages: Array<{ role: string; content: string }> };
  context?: {
    project_id?: string;
    product_slug?: string;
    lead_id?: string;
    extra?: Record<string, unknown>;
  };
  model_override?: string;
  stream?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.intent) {
      return json({ error: "intent obrigatório" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: cfg, error: cfgErr } = await sb
      .from("imphq_copy_engine_prompts")
      .select("*")
      .eq("intent", body.intent)
      .eq("enabled", true)
      .maybeSingle();

    if (cfgErr) console.error("[copy-engine] cfg error", cfgErr);
    if (!cfg) return json({ error: `intent não encontrado: ${body.intent}` }, 404);

    const ctx = body.context
      ? await loadCopyContext(body.context, SERVICE_ROLE, SUPABASE_URL)
      : { project: null, product: null, branding: null, avatar: null, expert: null, lead: null };

    // Carrega bloco de estilo AUST quando o intent estiver marcado com apply_style
    let styleAddendum = "";
    if (cfg.apply_style === true) {
      const { data: styleRow } = await sb
        .from("imphq_copy_engine_prompts")
        .select("system_prompt")
        .eq("intent", "_style_aust_pt")
        .eq("enabled", true)
        .maybeSingle();
      if (styleRow?.system_prompt) {
        styleAddendum = `\n\n---\n${styleRow.system_prompt}`;
      }
    }

    // Guardrails de público (auto a partir do projeto) — evita alucinação de estereótipo.
    const guardrails = ctx.project
      ? deriveAudienceGuardrails((ctx.project as any).data, body.context?.product_slug)
      : { publico: "", naoPublico: "", palavrasProibidas: [] as string[] };
    const guardBlock = buildGuardBlock(guardrails);

    const systemPrompt = `${cfg.system_prompt}${contextToSystemAddendum(ctx)}${guardBlock}${styleAddendum}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];
    if (typeof body.input === "string") {
      messages.push({ role: "user", content: body.input });
    } else if (body.input?.messages) {
      messages.push(...body.input.messages);
    }

    const model = body.model_override || cfg.model || "google/gemini-2.5-flash";
    const stream = body.stream === true && cfg.output_format !== "json";
    const payload: Record<string, unknown> = { model, messages, stream };
    if (cfg.output_format === "json") {
      payload.response_format = { type: "json_object" };
    }

    const { url: providerUrl, apiKey: providerKey } = resolveProvider(model);
    const upstream = await fetch(providerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      console.error("[copy-engine] upstream", upstream.status, txt);
      return json({ error: txt }, upstream.status);
    }

    if (stream) {
      return new Response(upstream.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await upstream.json();
    let content: string = data.choices?.[0]?.message?.content ?? "";

    // Validador determinístico: se output viola palavras proibidas, tenta 1 retry corretivo.
    let guardrailViolations: string[] = [];
    if (guardrails.palavrasProibidas.length && content && !stream) {
      guardrailViolations = findForbiddenHits(content, guardrails.palavrasProibidas);
      if (guardrailViolations.length) {
        console.warn("[copy-engine] guardrail violado:", guardrailViolations);
        const retryPayload: Record<string, unknown> = {
          model,
          messages: [
            ...messages,
            { role: "assistant", content },
            {
              role: "user",
              content: `Sua resposta violou a REGRA CRÍTICA DE PÚBLICO. Reescreva a resposta INTEIRA removendo/substituindo estas palavras proibidas: ${guardrailViolations.join(", ")}. Mantenha o mesmo formato e intenção original. Responda APENAS com o texto corrigido.`,
            },
          ],
          stream: false,
        };
        if (cfg.output_format === "json") retryPayload.response_format = { type: "json_object" };
        const retryRes = await fetch(providerUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(retryPayload),
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryContent = retryData.choices?.[0]?.message?.content ?? "";
          if (retryContent && findForbiddenHits(retryContent, guardrails.palavrasProibidas).length === 0) {
            content = retryContent;
            guardrailViolations = [];
          }
        }
      }
    }

    return json({
      intent: body.intent,
      model,
      output_format: cfg.output_format,
      content,
      raw: data,
      guardrail_violations: guardrailViolations,
    });
  } catch (err: any) {
    console.error("[copy-engine] error", err);
    return json({ error: err?.message || "erro interno" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
