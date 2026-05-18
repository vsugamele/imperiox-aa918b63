import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL_PRIMARY = "google/gemini-3-flash-preview";
const MODEL_FALLBACK = "openai/gpt-5-mini";

const PERSONA = `Você é Imperius, estrategista-chefe do Império HQ.
Tom: direto, afiado, brutalmente honesto, sem rodeios. Português brasileiro.
Sua missão: olhar TODOS os dados do projeto e devolver um Plano de Ataque de Vendas acionável.
Você NUNCA inventa números — só usa o que está no contexto. Se faltar dado, diga claramente.
Você pensa como um diretor comercial que vai ser cobrado pelo resultado em 72h.`;

// ---------- COLETA DE DADOS ----------
async function collectProjectSnapshot(supabase: any, projectId: string) {
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    project,
    vendas90,
    vendas30,
    vendas7,
    leads,
    leadsQuentes,
    ads30,
    funnels,
    sequences,
    integrations,
    creatives,
    expertLogs,
  ] = await Promise.all([
    supabase.from("imphq_projects").select("*").eq("id", projectId).single(),
    supabase.from("imphq_vendas").select("valor, valor_liquido, status, produto_nome, produto_tipo, plataforma, data_venda, utm_source, utm_campaign, utm_medium").eq("project_id", projectId).gte("data_venda", since90).limit(2000),
    supabase.from("imphq_vendas").select("valor, valor_liquido, status, produto_nome, produto_tipo").eq("project_id", projectId).gte("data_venda", since30).limit(2000),
    supabase.from("imphq_vendas").select("valor, valor_liquido, status").eq("project_id", projectId).gte("data_venda", since7).limit(2000),
    supabase.from("imphq_leads").select("id, status, score, ultimo_evento, created_at, utm_source").eq("project_id", projectId).gte("created_at", since30).limit(2000),
    supabase.from("imphq_leads").select("id, nome, email, score, status, ultimo_produto, ultimo_evento").eq("project_id", projectId).gte("score", 70).order("score", { ascending: false }).limit(15),
    supabase.from("imphq_ads_spend").select("valor, plataforma, campanha, conjunto, anuncio, ctr, cpc, cpm, impressions, clicks, leads, checkouts, vendas, data_ref").eq("project_id", projectId).gte("data_ref", since30.slice(0, 10)).limit(1000),
    supabase.from("imphq_funnels").select("name, stage, data").eq("project_id", projectId).limit(50),
    supabase.from("imphq_nurture_sequences").select("name, status, modelo_ia, etapas").eq("project_id", projectId).limit(20),
    supabase.from("imphq_integration_credentials").select("provider, status, created_at").eq("project_id", projectId).limit(20),
    supabase.from("imphq_creatives").select("titulo, tipo, formato, status, created_at").eq("project_id", projectId).gte("created_at", since30).limit(50),
    supabase.from("imphq_expert_logs").select("type, created_at").eq("project_id", projectId).gte("created_at", since30).limit(100),
  ]);

  const proj = project.data || {};
  const v90 = vendas90.data || [];
  const v30 = vendas30.data || [];
  const v7 = vendas7.data || [];
  const lds = leads.data || [];
  const adsRows = ads30.data || [];

  const sumValor = (arr: any[], col = "valor") => arr.reduce((s, r) => s + Number(r[col] || 0), 0);

  const aprovadas90 = v90.filter((v: any) => v.status === "aprovado");
  const aprovadas30 = v30.filter((v: any) => v.status === "aprovado");
  const aprovadas7 = v7.filter((v: any) => v.status === "aprovado");

  // Funnel data
  const totalLeads30 = lds.length;
  const checkouts30 = v30.filter((v: any) => ["aprovado", "pendente", "expirado", "carrinho_abandonado"].includes(v.status)).length;
  const aprovadas30Count = aprovadas30.length;

  // Por produto
  const produtoMap = new Map<string, { receita: number; count: number; tipo: string }>();
  for (const v of aprovadas90) {
    const p = v.produto_nome || "—";
    const cur = produtoMap.get(p) || { receita: 0, count: 0, tipo: v.produto_tipo || "principal" };
    cur.receita += Number(v.valor || 0);
    cur.count += 1;
    produtoMap.set(p, cur);
  }
  const topProdutos = [...produtoMap.entries()]
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 8);

  // Por canal (UTM source)
  const canalMap = new Map<string, { receita: number; vendas: number }>();
  for (const v of aprovadas90) {
    const c = v.utm_source || "direto/n-d";
    const cur = canalMap.get(c) || { receita: 0, vendas: 0 };
    cur.receita += Number(v.valor || 0);
    cur.vendas += 1;
    canalMap.set(c, cur);
  }
  const canais = [...canalMap.entries()].map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.receita - a.receita).slice(0, 6);

  // Ads
  const totalAds30 = sumValor(adsRows, "valor");
  const totalImpr = adsRows.reduce((s: number, a: any) => s + Number(a.impressions || 0), 0);
  const totalClicks = adsRows.reduce((s: number, a: any) => s + Number(a.clicks || 0), 0);
  const totalLeadsAds = adsRows.reduce((s: number, a: any) => s + Number(a.leads || 0), 0);
  const totalCheckoutsAds = adsRows.reduce((s: number, a: any) => s + Number(a.checkouts || 0), 0);
  const totalVendasAds = adsRows.reduce((s: number, a: any) => s + Number(a.vendas || 0), 0);

  const ctrMedio = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
  const cpaMedio = totalVendasAds > 0 ? totalAds30 / totalVendasAds : 0;
  const roas30 = totalAds30 > 0 ? sumValor(aprovadas30) / totalAds30 : 0;

  // Top campanhas por gasto
  const campMap = new Map<string, { gasto: number; clicks: number; impr: number; leads: number; vendas: number }>();
  for (const a of adsRows) {
    const k = a.campanha || "—";
    const cur = campMap.get(k) || { gasto: 0, clicks: 0, impr: 0, leads: 0, vendas: 0 };
    cur.gasto += Number(a.valor || 0);
    cur.clicks += Number(a.clicks || 0);
    cur.impr += Number(a.impressions || 0);
    cur.leads += Number(a.leads || 0);
    cur.vendas += Number(a.vendas || 0);
    campMap.set(k, cur);
  }
  const topCamps = [...campMap.entries()]
    .map(([nome, d]) => ({
      nome,
      ...d,
      ctr: d.impr > 0 ? +((d.clicks / d.impr) * 100).toFixed(2) : 0,
      cpa: d.vendas > 0 ? +(d.gasto / d.vendas).toFixed(2) : null,
    }))
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 10);

  // Lead funnel
  const statusLeadMap: Record<string, number> = {};
  for (const l of lds) statusLeadMap[l.status || "novo"] = (statusLeadMap[l.status || "novo"] || 0) + 1;

  return {
    projeto: {
      nome: proj.name,
      categoria: proj.category,
      descricao: proj.description,
      status: proj.data?.status,
      pipeline: proj.pipeline,
      avatar_resumo: extractAvatarSummary(proj.avatar),
      brand_resumo: extractBrandSummary(proj.brand_kit),
      produtos_cadastrados: proj.data?.produtos || [],
      kpis_meta: proj.data?.kpis || {},
    },
    vendas: {
      receita_90d: +sumValor(aprovadas90).toFixed(2),
      receita_liquida_90d: +sumValor(aprovadas90, "valor_liquido").toFixed(2),
      receita_30d: +sumValor(aprovadas30).toFixed(2),
      receita_7d: +sumValor(aprovadas7).toFixed(2),
      qtd_vendas_30d: aprovadas30Count,
      ticket_medio_30d: aprovadas30Count > 0 ? +(sumValor(aprovadas30) / aprovadas30Count).toFixed(2) : 0,
      top_produtos: topProdutos,
      canais: canais,
    },
    funil_30d: {
      leads: totalLeads30,
      checkouts: checkouts30,
      vendas: aprovadas30Count,
      taxa_lead_checkout: totalLeads30 > 0 ? +((checkouts30 / totalLeads30) * 100).toFixed(2) : 0,
      taxa_checkout_venda: checkouts30 > 0 ? +((aprovadas30Count / checkouts30) * 100).toFixed(2) : 0,
      taxa_lead_venda: totalLeads30 > 0 ? +((aprovadas30Count / totalLeads30) * 100).toFixed(2) : 0,
      status_leads: statusLeadMap,
    },
    leads_quentes: {
      total: (leadsQuentes.data || []).length,
      lista: (leadsQuentes.data || []).map((l: any) => ({ nome: l.nome || l.email, score: l.score, status: l.status, ultimo_produto: l.ultimo_produto, ultimo_evento: l.ultimo_evento })),
    },
    ads_30d: {
      gasto_total: +totalAds30.toFixed(2),
      impressoes: totalImpr,
      clicks: totalClicks,
      leads_via_ads: totalLeadsAds,
      checkouts_via_ads: totalCheckoutsAds,
      vendas_via_ads: totalVendasAds,
      ctr_medio_pct: +ctrMedio.toFixed(2),
      cpa_medio: +cpaMedio.toFixed(2),
      roas_30d: +roas30.toFixed(2),
      top_campanhas: topCamps,
    },
    ativos_marketing: {
      funis_montados: (funnels.data || []).length,
      sequencias_nutricao: (sequences.data || []).length,
      sequencias_ativas: (sequences.data || []).filter((s: any) => s.status === "ativo").length,
      criativos_30d: (creatives.data || []).length,
      integracoes_ativas: (integrations.data || []).filter((i: any) => i.status === "active").map((i: any) => i.provider),
      atividades_expert_30d: (expertLogs.data || []).length,
    },
  };
}

function extractAvatarSummary(avatar: any): any {
  if (!avatar || typeof avatar !== "object") return null;
  return {
    dor_principal: avatar.dor || avatar.dor_principal || avatar.principais_dores || null,
    desejo: avatar.desejo || avatar.desejos || null,
    objecoes: avatar.objecoes || avatar.principais_objecoes || null,
    tem_avatares_por_produto: !!avatar.avatars_por_produto,
  };
}

function extractBrandSummary(brand: any): any {
  if (!brand || typeof brand !== "object") return null;
  return {
    tom_de_voz: brand.tom_de_voz || brand.tone || null,
    arquetipo: brand.arquetipo || brand.archetype || null,
    promessa: brand.promessa || brand.promise || null,
  };
}

// ---------- DIAGNÓSTICO DETERMINÍSTICO ----------
function deterministicDiagnostics(snapshot: any) {
  const flags: string[] = [];
  const f = snapshot.funil_30d;
  const ads = snapshot.ads_30d;
  const v = snapshot.vendas;

  if (f.leads === 0) flags.push("CRÍTICO: zero leads capturados em 30 dias.");
  if (f.taxa_lead_checkout < 5 && f.leads > 50) flags.push(`Lead→Checkout em ${f.taxa_lead_checkout}% (esperado ≥10%). Problema de oferta ou nutrição.`);
  if (f.taxa_checkout_venda < 30 && f.checkouts > 20) flags.push(`Checkout→Venda em ${f.taxa_checkout_venda}% (esperado ≥40%). Problema de checkout, preço ou confiança.`);
  if (ads.gasto_total > 0 && ads.roas_30d < 1) flags.push(`ROAS de ${ads.roas_30d}x — está perdendo dinheiro nos ads.`);
  if (ads.gasto_total > 0 && ads.roas_30d >= 1 && ads.roas_30d < 2) flags.push(`ROAS de ${ads.roas_30d}x — operação no breakeven, sem escala segura.`);
  if (ads.ctr_medio_pct > 2 && ads.cpa_medio > 0 && v.ticket_medio_30d > 0 && ads.cpa_medio > v.ticket_medio_30d * 0.5) {
    flags.push(`CTR alto (${ads.ctr_medio_pct}%) mas CPA caro — anúncio chama atenção, página/oferta não convertem.`);
  }
  if (snapshot.ativos_marketing.sequencias_ativas === 0) flags.push("Nenhuma sequência de nutrição ativa — leads quentes esfriando.");
  if (snapshot.leads_quentes.total > 5 && snapshot.ativos_marketing.atividades_expert_30d === 0) flags.push(`${snapshot.leads_quentes.total} leads quentes sem ativação manual do expert.`);
  if (v.top_produtos.length > 0 && v.top_produtos[0].receita / Math.max(v.receita_90d, 1) > 0.8) {
    flags.push(`Receita 80%+ concentrada em "${v.top_produtos[0].nome}" — risco de produto único.`);
  }

  // Health score (0-100)
  let score = 60;
  if (ads.roas_30d >= 2) score += 10;
  if (ads.roas_30d >= 3) score += 10;
  if (ads.roas_30d > 0 && ads.roas_30d < 1) score -= 25;
  if (f.taxa_checkout_venda >= 40) score += 8;
  if (f.taxa_lead_checkout >= 10) score += 8;
  if (snapshot.ativos_marketing.sequencias_ativas > 0) score += 5;
  if (v.receita_7d > 0) score += 4;
  score -= flags.filter((x) => x.startsWith("CRÍTICO")).length * 15;
  score = Math.max(0, Math.min(100, score));

  return { flags, health_score: score };
}

// ---------- TOOL SCHEMA ----------
const PLAN_TOOL = {
  type: "function",
  function: {
    name: "emit_sales_path",
    description: "Emite o Plano de Ataque de Vendas estruturado.",
    parameters: {
      type: "object",
      properties: {
        resumo_executivo: { type: "string", description: "3-5 linhas: estado atual + onde concentrar foco." },
        diagnostico: {
          type: "array",
          items: {
            type: "object",
            properties: {
              area: { type: "string", description: "Ex: Funil, Ads, Oferta, Nutrição, Produto" },
              problema: { type: "string" },
              evidencia: { type: "string", description: "Cite os números do contexto." },
              severidade: { type: "string", enum: ["critica", "alta", "media", "baixa"] },
            },
            required: ["area", "problema", "evidencia", "severidade"],
          },
        },
        oportunidades: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              alavanca: { type: "string", description: "O que fazer." },
              impacto_estimado_brl: { type: "number", description: "Estimativa de R$ adicional/mês. 0 se não der pra estimar." },
              esforco: { type: "string", enum: ["baixo", "medio", "alto"] },
            },
            required: ["titulo", "alavanca", "esforco"],
          },
        },
        acoes_72h: {
          type: "array",
          items: {
            type: "object",
            properties: {
              acao: { type: "string" },
              responsavel_sugerido: { type: "string", enum: ["voce", "expert", "trafego", "copy", "automacao"] },
              prioridade: { type: "string", enum: ["P0", "P1", "P2"] },
              resultado_esperado: { type: "string" },
            },
            required: ["acao", "responsavel_sugerido", "prioridade", "resultado_esperado"],
          },
        },
        acoes_30d: {
          type: "array",
          items: {
            type: "object",
            properties: {
              semana: { type: "integer", minimum: 1, maximum: 4 },
              acao: { type: "string" },
              objetivo: { type: "string" },
            },
            required: ["semana", "acao", "objetivo"],
          },
        },
        sales_path: {
          type: "object",
          properties: {
            trafego: { type: "string" },
            captura: { type: "string" },
            nutricao: { type: "string" },
            oferta: { type: "string" },
            upsell: { type: "string" },
          },
          required: ["trafego", "captura", "nutricao", "oferta", "upsell"],
        },
        riscos: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["resumo_executivo", "diagnostico", "oportunidades", "acoes_72h", "acoes_30d", "sales_path", "riscos"],
    },
  },
};

async function callAI(model: string, snapshot: any, deterministic: any, reasoningEffort: string) {
  const userPrompt = `# DADOS REAIS DO PROJETO\n\n${JSON.stringify(snapshot, null, 2)}\n\n# DIAGNÓSTICO AUTOMÁTICO (regras determinísticas)\n\nHealth score: ${deterministic.health_score}/100\nFlags: ${deterministic.flags.join(" | ") || "nenhuma"}\n\nUse os dados acima para construir o Plano de Ataque de Vendas. Seja específico, cite números, não invente.`;

  const body: any = {
    model,
    messages: [
      { role: "system", content: PERSONA },
      { role: "user", content: userPrompt },
    ],
    tools: [PLAN_TOOL],
    tool_choice: { type: "function", function: { name: "emit_sales_path" } },
  };

  if (reasoningEffort && model.startsWith("google/gemini-3")) {
    body.reasoning = { effort: reasoningEffort };
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    const err: any = new Error(`AI ${res.status}: ${t}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("IA não retornou tool_call");
  const args = JSON.parse(toolCall.function.arguments);
  return args;
}

// ---------- HANDLER ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { projectId, focus } = await req.json();
    if (!projectId) return new Response(JSON.stringify({ error: "projectId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Cria registro processing
    const { data: pathRow } = await supabase.from("imphq_sales_paths").insert({
      project_id: projectId,
      user_id: user.id,
      status: "processing",
    }).select("id").single();
    const pathId = pathRow?.id;

    // Roda IA em background pra evitar 504 (IDLE_TIMEOUT 150s)
    const runInBackground = async () => {
      try {
        const snapshot = await collectProjectSnapshot(supabase, projectId);
        const deterministic = deterministicDiagnostics(snapshot);
        if (focus) (snapshot as any).foco_solicitado = focus;

        let plan: any;
        let modelUsed = MODEL_PRIMARY;
        try {
          plan = await callAI(MODEL_PRIMARY, snapshot, deterministic, "high");
        } catch (e: any) {
          console.warn("Primary model falhou, tentando fallback:", e.message);
          if (e.status === 429 || e.status === 402) throw e;
          plan = await callAI(MODEL_FALLBACK, snapshot, deterministic, "medium");
          modelUsed = MODEL_FALLBACK;
        }

        await supabase.from("imphq_sales_paths").update({
          status: "ready",
          snapshot,
          health_score: deterministic.health_score,
          diagnostico: plan.diagnostico,
          oportunidades: plan.oportunidades,
          acoes_72h: plan.acoes_72h,
          acoes_30d: plan.acoes_30d,
          sales_path: plan.sales_path,
          riscos: plan.riscos,
          resumo_executivo: plan.resumo_executivo,
          model_used: modelUsed,
        }).eq("id", pathId);
      } catch (innerErr: any) {
        console.error("sales-path-engine inner error:", innerErr);
        await supabase.from("imphq_sales_paths").update({
          status: "failed",
          error_message: innerErr.message || String(innerErr),
        }).eq("id", pathId);
      }
    };

    // @ts-ignore EdgeRuntime fornecido pelo Supabase
    EdgeRuntime.waitUntil(runInBackground());

    return new Response(JSON.stringify({ id: pathId, status: "processing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 202,
    });
  } catch (err: any) {
    console.error("sales-path-engine error", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
