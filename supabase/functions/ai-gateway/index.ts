// ============================================================================
// 🏛️ IMPÉRIO HQ — Edge Function: ai-gateway
// Ponto Único de Entrada para Chamadas Multi-IA com Circuit Breaker & Fallback
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  callAiGateway,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  updateCircuitBreakerLimits,
  GatewayCallParams,
} from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);

  try {
    // ------------------------------------------------------------------------
    // GET / Status do Circuit Breaker & Provedores
    // ------------------------------------------------------------------------
    if (req.method === "GET") {
      const status = await getCircuitBreakerStatus(sb);
      return json({
        ok: true,
        circuit_breaker: status,
        providers: {
          openrouter: Boolean(Deno.env.get("OPENROUTER_API_KEY")),
          kie: Boolean(Deno.env.get("KIE_API_KEY")),
          elevenlabs: Boolean(Deno.env.get("ELEVENLABS_API_KEY")),
          lovable: Boolean(Deno.env.get("LOVABLE_API_KEY")),
          zernio: Boolean(Deno.env.get("ZERNIO_API_KEY") || Deno.env.get("FIRECRAWL_API_KEY")),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ------------------------------------------------------------------------
    // POST Handlers
    // ------------------------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const op = body?.op || url.searchParams.get("op") || "call";

    // 1. Status do Circuit Breaker
    if (op === "circuit_status") {
      const status = await getCircuitBreakerStatus(sb);
      return json({ ok: true, circuit_breaker: status });
    }

    // 2. Reset Manual do Circuit Breaker
    if (op === "circuit_reset") {
      const reason = body?.reason || "Reset manual via API";
      const success = await resetCircuitBreaker(sb, reason);
      const newStatus = await getCircuitBreakerStatus(sb);
      return json({ ok: success, circuit_breaker: newStatus });
    }

    // 3. Atualizar Limites e Teto Diário
    if (op === "circuit_config") {
      const success = await updateCircuitBreakerLimits(sb, {
        daily_budget_usd: body?.daily_budget_usd ? Number(body.daily_budget_usd) : undefined,
        hourly_budget_usd: body?.hourly_budget_usd ? Number(body.hourly_budget_usd) : undefined,
        max_rpm: body?.max_rpm ? Number(body.max_rpm) : undefined,
        enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,
      });
      const newStatus = await getCircuitBreakerStatus(sb);
      return json({ ok: success, circuit_breaker: newStatus });
    }

    // 4. Teste de Conexão / Ping dos Provedores
    if (op === "ping_providers") {
      const results: Record<string, { configured: boolean; latency_ms?: number; status?: string }> = {
        openrouter: { configured: Boolean(Deno.env.get("OPENROUTER_API_KEY")) },
        kie: { configured: Boolean(Deno.env.get("KIE_API_KEY")) },
        elevenlabs: { configured: Boolean(Deno.env.get("ELEVENLABS_API_KEY")) },
        lovable: { configured: Boolean(Deno.env.get("LOVABLE_API_KEY")) },
        zernio: { configured: Boolean(Deno.env.get("ZERNIO_API_KEY") || Deno.env.get("FIRECRAWL_API_KEY")) },
      };

      // Teste leve no OpenRouter se configurado
      if (results.openrouter.configured) {
        const t0 = Date.now();
        try {
          const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
            headers: { Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}` },
          });
          results.openrouter.latency_ms = Date.now() - t0;
          results.openrouter.status = r.ok ? "online" : `http_${r.status}`;
        } catch (e) {
          results.openrouter.status = "error";
        }
      }

      return json({ ok: true, providers: results });
    }

    // 5. Execução de Tarefa via Gateway (Default)
    const callParams: GatewayCallParams = {
      type: body?.type || "chat",
      provider: body?.provider,
      fallback_provider: body?.fallback_provider,
      model: body?.model,
      project_id: body?.project_id,
      function_name: body?.function_name || "client-api",
      tag: body?.tag,
      messages: body?.messages,
      prompt: body?.prompt,
      system_prompt: body?.system_prompt,
      text: body?.text,
      voice_id: body?.voice_id,
      url: body?.url,
      image_url: body?.image_url,
      temperature: body?.temperature,
      max_tokens: body?.max_tokens,
      response_format: body?.response_format,
      bypass_circuit_breaker: body?.bypass_circuit_breaker === true,
    };

    const res = await callAiGateway(sb, callParams);

    if (!res.ok && res.error?.includes("Circuit Breaker Bloqueado")) {
      return json({ ok: false, error: res.error, code: "CIRCUIT_BREAKER_TRIPPED" }, 429);
    }

    return json(res, res.ok ? 200 : 502);
  } catch (err) {
    console.error("[ai-gateway] Erro interno:", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
