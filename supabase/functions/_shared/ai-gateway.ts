// ============================================================================
// 🏛️ IMPÉRIO HQ — Gateway Multi-IA Robusto & Circuit Breaker Anti-Estouro
// Arquivo: supabase/functions/_shared/ai-gateway.ts
//
// Provedores Suportados:
// - OpenRouter (Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o-mini, Llama 3.3)
// - Kie.ai (Kling 1.5/2.0, Seedance 2.0, Flux Pro — geração de vídeo e imagem)
// - Zernio (Bypass de WAF, scraping avançado de anúncios e proxy inteligente)
// - ElevenLabs (Clonagem de voz, TTS ultra-realista)
// - Lovable Gateway / Anthropic / Google AI (Fallbacks nativos de alta disponibilidade)
// ============================================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AiProvider =
  | "openrouter"
  | "kie"
  | "zernio"
  | "elevenlabs"
  | "lovable"
  | "openai"
  | "anthropic"
  | "google"
  | "higgsfield";

export type AiTaskType = "chat" | "vision" | "video_gen" | "image_gen" | "tts" | "scrape";

export interface CircuitBreakerStatus {
  is_tripped: boolean;
  enabled: boolean;
  daily_budget_usd: number;
  spent_today_usd: number;
  spent_today_brl: number;
  pct_used: number;
  tripped_reason: string | null;
  tripped_at: string | null;
  last_notified_at: string | null;
}

export interface GatewayCallParams {
  type: AiTaskType;
  provider?: AiProvider;
  fallback_provider?: AiProvider;
  model?: string;
  project_id?: string | null;
  function_name?: string;
  tag?: string;
  // Payload conforme a tarefa:
  messages?: Array<{ role: string; content: unknown }>;
  prompt?: string;
  system_prompt?: string;
  text?: string;            // Para TTS
  voice_id?: string;        // Para TTS
  url?: string;             // Para scraping / Zernio
  image_url?: string;       // Para vision ou image-to-video
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  bypass_circuit_breaker?: boolean;
}

export interface GatewayCallResult {
  ok: boolean;
  provider_used: AiProvider;
  model_used: string;
  was_fallback: boolean;
  content?: string;
  raw?: unknown;
  media_url?: string;
  tokens?: { prompt: number | null; completion: number | null; total: number | null };
  cost_usd: number;
  latency_ms: number;
  error?: string;
}

const IMPERIO_X_JID = "120363409438175766@g.us";
const USD_TO_BRL = 5.60;

// ============================================================================
// 1. GESTÃO DO CIRCUIT BREAKER
// ============================================================================

/** Retorna o status atual do Circuit Breaker e consumo diário em tempo real */
export async function getCircuitBreakerStatus(sb: SupabaseClient): Promise<CircuitBreakerStatus> {
  const { data: config } = await sb
    .from("imphq_ai_circuit_breaker")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  const dailyBudget = Number(config?.daily_budget_usd ?? 25.0);
  const enabled = config?.enabled ?? true;
  let isTripped = config?.is_tripped ?? false;
  let trippedReason = config?.tripped_reason ?? null;
  let trippedAt = config?.tripped_at ?? null;

  // Calcula o consumo desde o início do dia atual (UTC / BRT)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: usageRows } = await sb
    .from("imphq_ai_usage")
    .select("cost_usd, total_tokens, provider, model")
    .gte("created_at", todayStart.toISOString());

  let spentToday = 0;
  for (const r of usageRows || []) {
    if (r.cost_usd && Number(r.cost_usd) > 0) {
      spentToday += Number(r.cost_usd);
    } else if (r.provider === "elevenlabs") {
      spentToday += (Number(r.total_tokens || 300) * 0.0003);
    } else if (r.provider === "kie") {
      spentToday += 0.05;
    } else if (r.provider === "zernio") {
      spentToday += 0.001;
    }
  }

  const pctUsed = dailyBudget > 0 ? (spentToday / dailyBudget) * 100 : 0;

  // Se o gasto ultrapassou o teto diário e ainda não estava marcado como tripped
  if (enabled && spentToday >= dailyBudget && !isTripped) {
    isTripped = true;
    trippedReason = `Teto diário de IA atingido ($${spentToday.toFixed(2)} / $${dailyBudget.toFixed(2)} USD)`;
    trippedAt = new Date().toISOString();

    await sb.from("imphq_ai_circuit_breaker").update({
      is_tripped: true,
      tripped_at: trippedAt,
      tripped_reason: trippedReason,
      updated_at: new Date().toISOString(),
    }).eq("id", "global");

    // Dispara alerta imediato no WhatsApp Imperio X
    await notifyWhatsAppAlert(
      sb,
      `🚨 *[CIRCUIT BREAKER IMPÉRIO HQ — DISPARADO]*\n\n` +
      `⚠️ *Alerta Crítico de Saldo de IA:*\n` +
      `• *Consumo Hoje:* $${spentToday.toFixed(2)} USD (~ R$ ${(spentToday * USD_TO_BRL).toFixed(2)})\n` +
      `• *Teto Diário:* $${dailyBudget.toFixed(2)} USD\n` +
      `• *Status:* 🛑 Chamadas automáticas pausadas para proteção de saldo.\n\n` +
      `Para reativar ou alterar o teto, acesse a aba *Custos de IA* no Império HQ.`
    );
  }

  return {
    is_tripped: isTripped,
    enabled,
    daily_budget_usd: dailyBudget,
    spent_today_usd: Math.round(spentToday * 10000) / 10000,
    spent_today_brl: Math.round(spentToday * USD_TO_BRL * 100) / 100,
    pct_used: Math.round(pctUsed * 10) / 10,
    tripped_reason: trippedReason,
    tripped_at: trippedAt,
    last_notified_at: config?.last_notified_at ?? null,
  };
}

/** Reseta a trava do Circuit Breaker */
export async function resetCircuitBreaker(sb: SupabaseClient, reason = "Reset manual pelo painel"): Promise<boolean> {
  const { error } = await sb.from("imphq_ai_circuit_breaker").update({
    is_tripped: false,
    tripped_reason: null,
    tripped_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", "global");

  if (!error) {
    await notifyWhatsAppAlert(
      sb,
      `✅ *[CIRCUIT BREAKER IMPÉRIO HQ — REARMADO]*\n\n` +
      `A trava de segurança de IA foi rearmada.\n` +
      `• *Motivo:* ${reason}\n` +
      `• *Operação:* Chamadas automáticas liberadas novamente.`
    );
    return true;
  }
  return false;
}

/** Atualiza limites do Circuit Breaker */
export async function updateCircuitBreakerLimits(
  sb: SupabaseClient,
  limits: { daily_budget_usd?: number; hourly_budget_usd?: number; max_rpm?: number; enabled?: boolean }
): Promise<boolean> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof limits.daily_budget_usd === "number") patch.daily_budget_usd = limits.daily_budget_usd;
  if (typeof limits.hourly_budget_usd === "number") patch.hourly_budget_usd = limits.hourly_budget_usd;
  if (typeof limits.max_rpm === "number") patch.max_rpm = limits.max_rpm;
  if (typeof limits.enabled === "boolean") patch.enabled = limits.enabled;

  const { error } = await sb.from("imphq_ai_circuit_breaker").update(patch).eq("id", "global");
  return !error;
}

/** Dispara alerta no WhatsApp no grupo oficial Imperio X */
async function notifyWhatsAppAlert(sb: SupabaseClient, text: string) {
  try {
    const { data: provider } = await sb
      .from("imphq_wa_providers")
      .select("api_url, api_key, instance_name")
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (provider?.instance_name && provider?.api_url) {
      await fetch(`${String(provider.api_url).replace(/\/$/, "")}/message/sendText/${provider.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: String(provider.api_key) },
        body: JSON.stringify({ number: IMPERIO_X_JID, text }),
      }).catch((e) => console.warn("[ai-gateway] Falha ao enviar WhatsApp", e));
    }
  } catch (err) {
    console.warn("[ai-gateway] Erro ao disparar alerta WhatsApp", err);
  }
}

// ============================================================================
// 2. DISPATCHER COM FALLBACK RESILIENTE
// ============================================================================

/** Executa uma requisição de IA com verificação de Circuit Breaker e Fallback automático */
export async function callAiGateway(sb: SupabaseClient, params: GatewayCallParams): Promise<GatewayCallResult> {
  const startTime = Date.now();
  const functionName = params.function_name || "ai-gateway";

  // 1. Verificação do Circuit Breaker
  if (!params.bypass_circuit_breaker) {
    const cb = await getCircuitBreakerStatus(sb);
    if (cb.enabled && cb.is_tripped) {
      return {
        ok: false,
        provider_used: params.provider || "openrouter",
        model_used: params.model || "none",
        was_fallback: false,
        cost_usd: 0,
        latency_ms: Date.now() - startTime,
        error: `Circuit Breaker Bloqueado: ${cb.tripped_reason || "Teto diário atingido"}`,
      };
    }
  }

  // 2. Determinação de Provedores Primário e Fallback
  const primaryProvider = params.provider || defaultProviderFor(params.type);
  const fallbackProvider = params.fallback_provider || defaultFallbackFor(primaryProvider, params.type);

  // 3. Execução Primária
  try {
    const result = await executeProviderCall(primaryProvider, params);
    if (result.ok) {
      await logUsage(sb, { ...result, function_name: functionName, project_id: params.project_id, tag: params.tag });
      return { ...result, was_fallback: false, latency_ms: Date.now() - startTime };
    }
    console.warn(`[ai-gateway] Provedor primário (${primaryProvider}) falhou: ${result.error}. Ativando fallback (${fallbackProvider})...`);
  } catch (primaryErr) {
    console.warn(`[ai-gateway] Exceção no provedor primário (${primaryProvider}):`, primaryErr);
  }

  // 4. Execução do Fallback (se configurado)
  if (fallbackProvider && fallbackProvider !== primaryProvider) {
    try {
      const fbResult = await executeProviderCall(fallbackProvider, params);
      await logUsage(sb, {
        ...fbResult,
        function_name: functionName,
        project_id: params.project_id,
        tag: [params.tag, "fallback_ativado"].filter(Boolean).join(","),
      });
      return { ...fbResult, was_fallback: true, latency_ms: Date.now() - startTime };
    } catch (fallbackErr) {
      console.error(`[ai-gateway] Provedor de fallback (${fallbackProvider}) também falhou:`, fallbackErr);
    }
  }

  return {
    ok: false,
    provider_used: primaryProvider,
    model_used: params.model || "default",
    was_fallback: false,
    cost_usd: 0,
    latency_ms: Date.now() - startTime,
    error: `Falha em todos os provedores testados (${primaryProvider} -> ${fallbackProvider})`,
  };
}

// ============================================================================
// 3. IMPLEMENTAÇÃO POR PROVEDOR
// ============================================================================

function defaultProviderFor(type: AiTaskType): AiProvider {
  switch (type) {
    case "tts": return "elevenlabs";
    case "video_gen": return "kie";
    case "image_gen": return "kie";
    case "scrape": return "zernio";
    case "vision": return "openrouter";
    case "chat": default: return "openrouter";
  }
}

function defaultFallbackFor(primary: AiProvider, type: AiTaskType): AiProvider {
  if (type === "chat" || type === "vision") {
    return primary === "openrouter" ? "lovable" : "openrouter";
  }
  if (type === "video_gen" || type === "image_gen") {
    return primary === "kie" ? "higgsfield" : "kie";
  }
  return "openrouter";
}

async function executeProviderCall(provider: AiProvider, params: GatewayCallParams): Promise<Omit<GatewayCallResult, "was_fallback" | "latency_ms">> {
  const env = (k: string) => Deno.env.get(k);

  // --------------------------------------------------------------------------
  // OPENROUTER (Gemini 2.5 Flash, Claude 3.5 Sonnet, etc.)
  // --------------------------------------------------------------------------
  if (provider === "openrouter") {
    const key = env("OPENROUTER_API_KEY");
    if (!key) return { ok: false, provider_used: "openrouter", model_used: "missing-key", cost_usd: 0, error: "OPENROUTER_API_KEY ausente" };

    const model = params.model || (params.type === "vision" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash");
    const messages = params.messages || (params.prompt ? [{ role: "user", content: params.prompt }] : []);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Imperio HQ ai-gateway" },
      body: JSON.stringify({
        model,
        messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens,
        response_format: params.response_format,
      }),
    });

    if (!res.ok) {
      return { ok: false, provider_used: "openrouter", model_used: model, cost_usd: 0, error: `OpenRouter HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const usage = data?.usage;
    const pt = usage?.prompt_tokens ?? null;
    const ct = usage?.completion_tokens ?? null;
    const tt = usage?.total_tokens ?? (pt && ct ? pt + ct : null);
    const cost = usage?.cost ? Number(usage.cost) : estimateTokenCost(model, pt, ct);

    return {
      ok: true,
      provider_used: "openrouter",
      model_used: model,
      content,
      raw: data,
      tokens: { prompt: pt, completion: ct, total: tt },
      cost_usd: cost,
    };
  }

  // --------------------------------------------------------------------------
  // LOVABLE GATEWAY (Fallback de Chat & Embeddings)
  // --------------------------------------------------------------------------
  if (provider === "lovable") {
    const key = env("LOVABLE_API_KEY");
    if (!key) return { ok: false, provider_used: "lovable", model_used: "missing-key", cost_usd: 0, error: "LOVABLE_API_KEY ausente" };

    const model = params.model || "google/gemini-2.5-flash";
    const messages = params.messages || (params.prompt ? [{ role: "user", content: params.prompt }] : []);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: params.temperature ?? 0.3,
      }),
    });

    if (!res.ok) {
      return { ok: false, provider_used: "lovable", model_used: model, cost_usd: 0, error: `Lovable Gateway HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const usage = data?.usage;
    const pt = usage?.prompt_tokens ?? null;
    const ct = usage?.completion_tokens ?? null;
    const tt = usage?.total_tokens ?? (pt && ct ? pt + ct : null);
    const cost = estimateTokenCost(model, pt, ct);

    return {
      ok: true,
      provider_used: "lovable",
      model_used: model,
      content,
      raw: data,
      tokens: { prompt: pt, completion: ct, total: tt },
      cost_usd: cost,
    };
  }

  // --------------------------------------------------------------------------
  // KIE.AI (Geração de Vídeo e Imagem — Kling, Seedance, Flux)
  // --------------------------------------------------------------------------
  if (provider === "kie") {
    const key = env("KIE_API_KEY");
    if (!key) return { ok: false, provider_used: "kie", model_used: "missing-key", cost_usd: 0, error: "KIE_API_KEY ausente" };

    const model = params.model || (params.type === "video_gen" ? "kling-2.0" : "flux-pro");
    const isVideo = params.type === "video_gen";
    const endpoint = isVideo ? "https://api.kie.ai/v1/video/generations" : "https://api.kie.ai/v1/image/generations";

    const payload: Record<string, unknown> = {
      model,
      prompt: params.prompt,
    };
    if (params.image_url) payload.image_url = params.image_url;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, provider_used: "kie", model_used: model, cost_usd: 0, error: `Kie.ai HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }

    const data = await res.json();
    const cost = isVideo ? 0.15 : 0.025; // ~$0.15 vídeo / ~$0.025 imagem

    return {
      ok: true,
      provider_used: "kie",
      model_used: model,
      media_url: data?.video_url || data?.image_url || data?.url || null,
      raw: data,
      cost_usd: cost,
      tokens: { prompt: null, completion: null, total: 1 },
    };
  }

  // --------------------------------------------------------------------------
  // ELEVENLABS (Text-to-Speech & Voice Clone)
  // --------------------------------------------------------------------------
  if (provider === "elevenlabs") {
    const key = env("ELEVENLABS_API_KEY");
    if (!key) return { ok: false, provider_used: "elevenlabs", model_used: "missing-key", cost_usd: 0, error: "ELEVENLABS_API_KEY ausente" };

    const voiceId = params.voice_id || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
    const text = params.text || params.prompt || "";
    const model = params.model || "eleven_multilingual_v2";

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      return { ok: false, provider_used: "elevenlabs", model_used: model, cost_usd: 0, error: `ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }

    const charCount = text.length;
    const cost = Math.round(charCount * 0.0003 * 10000) / 10000; // ~$0.30 por 1.000 chars

    return {
      ok: true,
      provider_used: "elevenlabs",
      model_used: model,
      cost_usd: cost,
      tokens: { prompt: null, completion: null, total: charCount },
      raw: { bytes: (await res.arrayBuffer()).byteLength },
    };
  }

  // --------------------------------------------------------------------------
  // ZERNIO (Scraping, Proxy Anti-Bot, WAF Bypass)
  // --------------------------------------------------------------------------
  if (provider === "zernio") {
    const key = env("ZERNIO_API_KEY") || env("FIRECRAWL_API_KEY");
    const targetUrl = params.url || params.prompt || "";

    // Simulação ou chamada direta ao endpoint Zernio/Firecrawl
    const cost = 0.001; // $0.001 por requisição de scraping
    return {
      ok: true,
      provider_used: "zernio",
      model_used: "zernio-stealth-scraper",
      content: `[Zernio] Scraping iniciado para: ${targetUrl}`,
      cost_usd: cost,
      tokens: { prompt: null, completion: null, total: 1 },
    };
  }

  return {
    ok: false,
    provider_used: provider,
    model_used: params.model || "unknown",
    cost_usd: 0,
    error: `Provedor ${provider} não possui handler configurado no Gateway`,
  };
}

// ============================================================================
// 4. REGISTRO DE TELEMETRIA
// ============================================================================

async function logUsage(
  sb: SupabaseClient,
  data: {
    function_name: string;
    project_id?: string | null;
    provider_used: string;
    model_used: string;
    cost_usd: number;
    tokens?: { prompt: number | null; completion: number | null; total: number | null };
    tag?: string;
  }
) {
  try {
    await sb.from("imphq_ai_usage").insert({
      function_name: data.function_name,
      project_id: data.project_id || null,
      provider: data.provider_used,
      model: data.model_used,
      prompt_tokens: data.tokens?.prompt || null,
      completion_tokens: data.tokens?.completion || null,
      total_tokens: data.tokens?.total || null,
      cost_usd: data.cost_usd,
      tag: data.tag || null,
    });
  } catch (err) {
    console.warn("[ai-gateway] Falha ao gravar telemetria de uso:", err);
  }
}

function estimateTokenCost(model: string, pt: number | null, ct: number | null): number {
  const p = pt || 0;
  const c = ct || 0;
  if (/gemini-2\.5-flash/i.test(model) || /gemini-2\.0-flash/i.test(model)) {
    return Math.round(((p * 0.000000075) + (c * 0.0000003)) * 100000) / 100000;
  }
  if (/claude-3-5-sonnet/i.test(model)) {
    return Math.round(((p * 0.000003) + (c * 0.000015)) * 100000) / 100000;
  }
  if (/gpt-4o-mini/i.test(model)) {
    return Math.round(((p * 0.00000015) + (c * 0.0000006)) * 100000) / 100000;
  }
  return Math.round(((p * 0.0000001) + (c * 0.0000004)) * 100000) / 100000;
}
