import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { project_id, trigger_tipo, num_etapas = 4, action, model: requestedModel, openrouter_key, mente_id, produto, product_index } = body;
    const model = requestedModel || "google/gemini-3-flash-preview";

    // ── Mentes IA Personality Lookup ──
    const MENTE_PROMPTS: Record<string, { nome: string; prompt: string }> = {
      dan_kennedy: { nome: "Dan Kennedy", prompt: "Você é Dan Kennedy — o pai do marketing de resposta direta. Pensa em resultados mensuráveis, não em 'branding' vago. Zero tolerância para copy vago ou sem CTA. Todo esforço de marketing deve gerar resposta imediata. Segmentação precisa: a mensagem certa, para a pessoa certa, na hora certa. Preço nunca é o problema — posicionamento e oferta são. TOM: Direto. Magnético. Sem rodeios. Autoridade absoluta." },
      gary_halbert: { nome: "Gary Halbert", prompt: "Você é Gary Halbert — o príncipe do direct mail. Mestre dos ganchos magnéticos que geram curiosidade irresistível. Cada headline deve parar o scroll. Use storytelling pessoal e vulnerável. Escreva como uma carta para um amigo. Comece sempre com um gancho inesperado. TOM: Casual, storytelling, pattern interrupt, confessional." },
      eugene_schwartz: { nome: "Eugene Schwartz", prompt: "Você é Eugene Schwartz — o filósofo do desejo de massa. Analise o nível de consciência do mercado antes de escrever qualquer palavra. Canalize desejos existentes em vez de criar novos. Sofisticação de mercado define a abordagem. TOM: Estratégico, profundo, psicológico, sofisticado." },
      russell_brunson: { nome: "Russell Brunson", prompt: "Você é Russell Brunson — o mestre dos funis e do Expert Secrets. Use Epiphany Bridge Stories para conexão emocional. Estruture tudo em funis com escada de valor clara. Secret Formula: Dream Customer → Where are they → What bait → What result. TOM: Energético, mentor, storytelling transformacional." },
      alex_hormozi: { nome: "Alex Hormozi", prompt: "Você é Alex Hormozi — o arquiteto de ofertas Grand Slam. Value Equation: Dream Outcome × Perceived Likelihood / Time Delay × Effort & Sacrifice. Crie ofertas tão boas que as pessoas se sintam estúpidas em dizer não. Stack de bônus agressivo. Precificação por valor, não por custo. TOM: Confiante, lógico, contundente, sem floreios." },
      robert_cialdini: { nome: "Robert Cialdini", prompt: "Você é Robert Cialdini — o cientista da persuasão. Aplique os 7 princípios: Reciprocidade, Compromisso, Prova Social, Autoridade, Afinidade, Escassez, Unidade. Cada peça de comunicação deve ativar pelo menos 2-3 princípios simultaneamente. TOM: Acadêmico acessível, preciso, evidence-based." },
      david_ogilvy: { nome: "David Ogilvy", prompt: "Você é David Ogilvy — o pai da publicidade moderna. Pesquisa é a fundação de tudo. Headlines são 80% do sucesso. Fatos vendem mais que adjetivos. Elegância e clareza acima de tudo. Longo copy vende quando é relevante. TOM: Elegante, factual, sofisticado, baseado em dados." },
      claude_hopkins: { nome: "Claude Hopkins", prompt: "Você é Claude Hopkins — o pai da publicidade científica. Teste tudo. Cupons e rastreamento são obrigatórios. Sampling e trials reduzem risco percebido. Razões específicas vendem mais que claims vagos. Copy baseado em serviço ao cliente, não em autopromoção. TOM: Científico, preciso, orientado a dados, humilde." },
    };

    let mentePrefix = "";
    if (mente_id && MENTE_PROMPTS[mente_id]) {
      mentePrefix = `## PERSONALIDADE ATIVA: ${MENTE_PROMPTS[mente_id].nome}\n${MENTE_PROMPTS[mente_id].prompt}\n\n---\n\n`;
    }

    // Hybrid routing: determine which gateway to use based on model prefix
    const isLovableModel = model.startsWith("google/") || model.startsWith("openai/");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = openrouter_key || Deno.env.get("OPENROUTER_API_KEY");
    
    if (isLovableModel && !LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!isLovableModel && !OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY não configurada. Adicione nas Configurações ou nos secrets do Supabase.");
    
    const aiBaseUrl = isLovableModel ? "https://ai.gateway.lovable.dev/v1" : "https://openrouter.ai/api/v1";
    const aiApiKey = isLovableModel ? LOVABLE_API_KEY! : OPENROUTER_API_KEY!;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch relevant skills for context enrichment
    let skillsContext = "";
    try {
      const { data: skills } = await sb.from("imphq_skills").select("nome, system_prompt, categoria").eq("status", "Ativa").not("system_prompt", "is", null).limit(5);
      if (skills && skills.length > 0) {
        skillsContext = "\n## Skills disponíveis para referência:\n";
        for (const skill of skills) {
          skillsContext += `- **${skill.nome}** (${skill.categoria || "geral"}): ${(skill.system_prompt || "").slice(0, 300)}\n`;
        }
      }
    } catch (e) { console.error("Error fetching skills:", e); }

    // Gather project context
    let projectData: any = {};
    let projectContext = "";
    if (project_id) {
      const { data: project } = await sb.from("imphq_projects").select("*").eq("id", project_id).single();
      if (project) {
        projectData = project;
        projectContext += `\n## Projeto: ${project.name}\n`;
        const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
        if (d.briefing) projectContext += `Briefing: ${JSON.stringify(d.briefing).slice(0, 800)}\n`;
        if (d.expert) projectContext += `Expert: ${JSON.stringify(d.expert).slice(0, 800)}\n`;
        if (d.kpis) projectContext += `KPIs existentes: ${JSON.stringify(d.kpis).slice(0, 500)}\n`;

        // Enrich with individual product data (mecanismo, contexto, copy_arsenal, links)
        if (d.produtos && Array.isArray(d.produtos)) {
          projectContext += `\n## Produtos do Projeto (${d.produtos.length}):\n`;
          for (const prod of d.produtos) {
            projectContext += `### Produto: ${prod.nome || prod.name || "Sem nome"}\n`;
            if (prod.mecanismo_unico) projectContext += `Mecanismo Único: ${prod.mecanismo_unico}\n`;
            if (prod.contexto) projectContext += `Contexto: ${prod.contexto}\n`;
            if (prod.copy_arsenal) {
              const ca = prod.copy_arsenal;
              const caStr = typeof ca === "string" ? ca : JSON.stringify({
                promessa: ca.promessa?.slice?.(0,3),
                inimigo_comum: ca.inimigo_comum?.slice?.(0,3),
                metodo: ca.metodo_simplificado?.slice?.(0,3),
              });
              projectContext += `Arsenal de Copy: ${caStr.slice(0, 500)}\n`;
            }
            if (prod.links) projectContext += `Links do produto: ${JSON.stringify(prod.links).slice(0, 300)}\n`;
          }
        } else if (d.produtos) {
          projectContext += `Produtos: ${JSON.stringify(d.produtos).slice(0, 500)}\n`;
        }

        // Active social links from briefing
        if (d.links) {
          const activeLinks = Object.entries(d.links).filter(([_, v]) => v && String(v).trim() !== "");
          if (activeLinks.length > 0) {
            projectContext += `\n## Redes Sociais Ativas: ${activeLinks.map(([k]) => k).join(", ")}\n`;
            projectContext += `Links: ${JSON.stringify(Object.fromEntries(activeLinks)).slice(0, 500)}\n`;
          }
        }
        
        const avatar = project.avatar || {};
        if (avatar.dores) projectContext += `Dores do Avatar: ${JSON.stringify(avatar.dores).slice(0, 500)}\n`;
        if (avatar.desejos) projectContext += `Desejos do Avatar: ${JSON.stringify(avatar.desejos).slice(0, 500)}\n`;
        if (avatar.problemas) projectContext += `Problemas do Avatar: ${JSON.stringify(avatar.problemas).slice(0, 500)}\n`;
        if (avatar.voyerismos) projectContext += `Voyerismos: ${JSON.stringify(avatar.voyerismos).slice(0, 500)}\n`;
        if (avatar.gatilhos) projectContext += `Gatilhos existentes: ${JSON.stringify(avatar.gatilhos).slice(0, 500)}\n`;
        if (avatar.perfil_psicologico) projectContext += `Perfil Psicológico: ${JSON.stringify(avatar.perfil_psicologico).slice(0, 500)}\n`;
        
        const bk = project.brand_kit || {};
        if (Object.keys(bk).length > 0) projectContext += `Brand Kit: ${JSON.stringify(bk).slice(0, 800)}\n`;
      }

      const { data: vendas } = await sb.from("imphq_vendas").select("produto_nome, valor, status").eq("project_id", project_id).limit(50);
      if (vendas && vendas.length > 0) {
        const produtos = [...new Set(vendas.map((v: any) => v.produto_nome).filter(Boolean))];
        if (produtos.length > 0) projectContext += `Produtos vendidos: ${produtos.join(", ")}\n`;
        const totalVendas = vendas.filter((v: any) => v.status === "aprovado").reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);
        projectContext += `Total vendas aprovadas: R$ ${totalVendas.toFixed(2)}\n`;
      }

      const { data: leads, count: leadsCount } = await sb.from("imphq_leads").select("id", { count: "exact" }).eq("project_id", project_id);
      if (leadsCount) projectContext += `Total leads: ${leadsCount}\n`;

      const { data: costs } = await sb.from("imphq_project_costs").select("nome, valor, categoria").eq("project_id", project_id).limit(20);
      if (costs && costs.length > 0) {
        const totalCosts = costs.reduce((s: number, c: any) => s + (parseFloat(c.valor) || 0), 0);
        projectContext += `Custos do projeto: R$ ${totalCosts.toFixed(2)}\n`;
      }

      const { data: adsData } = await sb.from("imphq_ads_spend").select("valor, leads, cliques").eq("project_id", project_id).limit(50);
      if (adsData && adsData.length > 0) {
        const totalAds = adsData.reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
        const totalAdsLeads = adsData.reduce((s: number, a: any) => s + (a.leads || 0), 0);
        projectContext += `Investimento em Ads: R$ ${totalAds.toFixed(2)}, Leads de Ads: ${totalAdsLeads}\n`;
      }
    }

    // Route by action — pass mentePrefix for personality injection
    if (action === "execute_skill") return await handleExecuteSkill(body, sb, projectContext, skillsContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_content") return await handleGenerateContent(body, projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_copy_arsenal") return await handleCopyArsenal(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix, projectData, product_index);
    if (action === "generate_branding") return await handleBranding(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_gatilhos") return await handleGatilhos(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_kpis") return await handleKPIs(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_expert") return await handleExpert(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_avatar_perfil") return await handleAvatarPerfil(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_campaign_drafts") return await handleCampaignDrafts(body, projectContext, projectData, sb, aiApiKey, model, aiBaseUrl);
    if (action === "analyze_ads_performance") return await handleAnalyzeAds(body, projectContext, projectData, sb, aiApiKey, model, aiBaseUrl);
    if (action === "analyze_lead") return await handleAnalyzeLead(body, projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_content_plan") return await handleContentPlan(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix, body);
    if (action === "generate_expert_notes") return await handleExpertNotes(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_campaign_message") return await handleCampaignMessage(body, projectContext, sb, aiApiKey, model, aiBaseUrl, mentePrefix);

    // Default: automation flow generation
    const triggerLabels: Record<string, string> = {
      carrinho_abandonado: "Carrinho Abandonado — o lead iniciou checkout mas não concluiu",
      compra_aprovada: "Compra Aprovada — o lead acabou de comprar",
      lead_novo: "Novo Lead — acabou de se cadastrar/capturar",
      reembolso: "Reembolso — o cliente pediu reembolso",
    };

    const produtoFoco = produto ? `\nO PRODUTO EM FOCO desta automação é: "${produto}". Direcione toda a copy especificamente para este produto.\n` : "";

    const systemPrompt = `Você é um copywriter brasileiro especialista em automações de marketing digital e sequências multicanal (email, WhatsApp, Telegram).
Seu objetivo: criar uma sequência de ${num_etapas} mensagens para a automação de "${triggerLabels[trigger_tipo] || trigger_tipo}".
${produtoFoco}${projectContext ? `Contexto do projeto:\n${projectContext}` : ""}
${skillsContext}
REGRAS:
- Use linguagem conversacional e persuasiva em português brasileiro
- Cada mensagem deve ter um propósito claro
- Intercale canais diferentes quando possível
- Inclua delays realistas entre mensagens
- Use variáveis como {{nome}}, {{produto}}, {{link}}
- Retorne EXATAMENTE o JSON solicitado, sem markdown`;

    const userPrompt = `Gere uma sequência de ${num_etapas} ações para o trigger "${trigger_tipo}".
Retorne um JSON array: [{ "tipo": "email|whatsapp|telegram|aguardar", "template": "texto", "delay_min": número }]`;

    const makeH = (key: string, or: boolean): Record<string, string> => {
      const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
      if (or) { h["HTTP-Referer"] = "https://imperiox.lovable.app"; h["X-Title"] = "ImperioHQ"; }
      return h;
    };
    const flowPayload = JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "generate_flow",
            description: "Generate automation flow actions",
            parameters: {
              type: "object",
              properties: {
                acoes: { type: "array", items: { type: "object", properties: { tipo: { type: "string", enum: ["email", "whatsapp", "telegram", "aguardar"] }, template: { type: "string" }, delay_min: { type: "number" } }, required: ["tipo", "template", "delay_min"], additionalProperties: false } },
              },
              required: ["acoes"], additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_flow" } },
    });

    let response = await fetch(`${aiBaseUrl}/chat/completions`, { method: "POST", headers: makeH(aiApiKey, !isLovableModel), body: flowPayload });

    // Fallback: if Lovable gateway returns 402, retry via OpenRouter
    if (isLovableModel && response.status === 402) {
      const orKey = Deno.env.get("OPENROUTER_API_KEY");
      if (orKey) {
        console.log("Lovable gateway 402, falling back to OpenRouter (default flow)");
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: makeH(orKey, true), body: flowPayload });
      }
    }

    if (!response.ok) return handleAIError(response);
    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let acoes: any[] = [];
    if (toolCall?.function?.arguments) acoes = JSON.parse(toolCall.function.arguments).acoes || [];
    return new Response(JSON.stringify({ acoes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("openflow-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function handleAIError(response: Response) {
  const status = response.status;
  if (status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const t = await response.text();
  console.error("AI gateway error:", status, t);
  throw new Error("AI gateway error: " + status);
}

async function callAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string, tools: any[], toolName: string, baseUrl = "https://ai.gateway.lovable.dev/v1") {
  const isOpenRouter = baseUrl.includes("openrouter.ai");
  const makeHeaders = (key: string, openRouter: boolean): Record<string, string> => {
    const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (openRouter) { h["HTTP-Referer"] = "https://imperiox.lovable.app"; h["X-Title"] = "ImperioHQ"; }
    return h;
  };
  const payload = JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], tools, tool_choice: { type: "function", function: { name: toolName } } });
  
  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: makeHeaders(apiKey, isOpenRouter),
    body: payload,
  });

  // Fallback: if Lovable gateway returns 402 (no credits), retry via OpenRouter
  if (!isOpenRouter && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log("Lovable gateway 402, falling back to OpenRouter for model:", model);
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: makeHeaders(orKey, true),
        body: payload,
      });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const tc = result.choices?.[0]?.message?.tool_calls?.[0];
  return tc?.function?.arguments ? JSON.parse(tc.function.arguments) : {};
}

async function handleCopyArsenal(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "", projectData: any = {}, productIndex?: number) {
  // Enrich context with scraped website content via Firecrawl
  let scrapedContext = "";
  try {
    const d = typeof projectData?.data === "string" ? JSON.parse(projectData.data) : (projectData?.data || {});
    const produtos = Array.isArray(d.produtos) ? d.produtos : [];
    
    // Get product links to scrape
    const productLinks: string[] = [];
    if (typeof productIndex === "number" && produtos[productIndex]) {
      const prod = produtos[productIndex];
      if (prod.checkout_urls) {
        const urls = Array.isArray(prod.checkout_urls) ? prod.checkout_urls : [prod.checkout_urls];
        productLinks.push(...urls.map((u: any) => typeof u === "string" ? u : u.url).filter(Boolean));
      }
      if (prod.links) {
        const links = typeof prod.links === "object" ? Object.values(prod.links) : [];
        productLinks.push(...(links as string[]).filter(Boolean));
      }
    }
    // Also try project-level links
    if (d.links) {
      const projLinks = Object.values(d.links).filter(v => v && String(v).trim() !== "" && String(v).startsWith("http")) as string[];
      productLinks.push(...projLinks);
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (firecrawlKey && productLinks.length > 0) {
      const uniqueUrls = [...new Set(productLinks)].slice(0, 2);
      for (const url of uniqueUrls) {
        try {
          console.log("Scraping URL for copy arsenal:", url);
          const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
          });
          if (scrapeRes.ok) {
            const scrapeData = await scrapeRes.json();
            const md = scrapeData?.data?.markdown || scrapeData?.markdown || "";
            if (md) scrapedContext += `\n### Conteúdo de ${url}:\n${md.slice(0, 2000)}\n`;
          }
        } catch (e) { console.error("Firecrawl scrape error:", e); }
      }
    }
  } catch (e) { console.error("Error preparing scrape context:", e); }

  const fullCtx = scrapedContext ? `${ctx}\n\n## Conteúdo scraped do site do produto:\n${scrapedContext}` : ctx;

  const arsenal = await callAI(
    `${mentePrefix}Você é um copywriter brasileiro de alto nível. Analise o contexto e gere copy de alta conversão.\n${fullCtx}\nREGRAS: Use linguagem persuasiva, emocional e direta. Seja específico para este projeto. Se houver conteúdo scraped do site, use-o para criar copy mais precisa e alinhada à página real do produto.`,
    "Gere o Arsenal de Copy completo.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_copy_arsenal", description: "Generate copy arsenal", parameters: { type: "object", properties: { promessa: { type: "array", items: { type: "string" } }, inimigo_comum: { type: "array", items: { type: "string" } }, efeito_colateral: { type: "array", items: { type: "string" } }, oportunidade: { type: "array", items: { type: "string" } }, metodo_simplificado: { type: "array", items: { type: "string" } }, hora_do_show: { type: "array", items: { type: "string" } } }, required: ["promessa", "inimigo_comum", "efeito_colateral", "oportunidade", "metodo_simplificado", "hora_do_show"], additionalProperties: false } } }],
    "generate_copy_arsenal", baseUrl
  );
  if (arsenal instanceof Response) return arsenal;
  return new Response(JSON.stringify({ arsenal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleBranding(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const branding = await callAI(
    `${mentePrefix}Você é um estrategista de marca brasileiro. Analise o contexto e sugira branding.\n${ctx}\nEscolha arquétipo dentre: heroi, mentor, fora_da_lei, explorador, criador, cuidador, rei, mago, bobo`,
    "Analise e gere sugestões de branding completas.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_branding", description: "Generate branding", parameters: { type: "object", properties: { arquetipo: { type: "string" }, inimigo_comum: { type: "string" }, mecanismo_chave: { type: "string" }, personalidade: { type: "string" }, manifesto: { type: "string" }, palavras_usa: { type: "array", items: { type: "string" } }, palavras_evita: { type: "array", items: { type: "string" } } }, required: ["arquetipo", "inimigo_comum", "mecanismo_chave", "personalidade", "manifesto", "palavras_usa", "palavras_evita"], additionalProperties: false } } }],
    "generate_branding", baseUrl
  );
  if (branding instanceof Response) return branding;
  return new Response(JSON.stringify({ branding }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleGatilhos(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const gatilhos = await callAI(
    `${mentePrefix}Você é um especialista em psicologia do consumo e copywriting emocional brasileiro.\n${ctx}\nGere 5-7 gatilhos emocionais específicos com storyboard narrativo.`,
    "Gere gatilhos emocionais + storyboard narrativo completo.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_gatilhos", description: "Generate triggers", parameters: { type: "object", properties: { gatilhos: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, categoria: { type: "string" }, intensidade: { type: "string" }, situacao: { type: "string" }, copy_sugerido: { type: "string" } }, required: ["nome", "categoria", "intensidade", "situacao", "copy_sugerido"], additionalProperties: false } }, storyboard: { type: "object", properties: { antes: { type: "string" }, trigger: { type: "string" }, busca: { type: "string" }, objecao: { type: "string" }, decisao: { type: "string" } }, required: ["antes", "trigger", "busca", "objecao", "decisao"], additionalProperties: false }, gatilho_nuclear: { type: "string" }, the_high: { type: "string" }, the_hell: { type: "string" }, segredo_final: { type: "string" } }, required: ["gatilhos", "storyboard", "gatilho_nuclear", "the_high", "the_hell", "segredo_final"], additionalProperties: false } } }],
    "generate_gatilhos", baseUrl
  );
  if (gatilhos instanceof Response) return gatilhos;
  return new Response(JSON.stringify({ gatilhos }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleKPIs(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const kpis = await callAI(
    `${mentePrefix}Você é um analista de marketing digital brasileiro. Com base nos dados reais do projeto, calcule ou estime os KPIs.\n${ctx}\nUse os dados de vendas, leads, custos e ads para calcular valores reais. Se não houver dados suficientes, estime com base no mercado.`,
    "Calcule os KPIs do projeto com base nos dados disponíveis.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_kpis", description: "Calculate KPIs", parameters: { type: "object", properties: { cpl: { type: "string" }, cac: { type: "string" }, roi: { type: "string" }, roas: { type: "string" }, ticket_medio: { type: "string" }, ltv: { type: "string" }, taxa_conversao: { type: "string" }, leads_mes: { type: "string" } }, required: ["cpl", "cac", "roi", "roas", "ticket_medio", "ltv", "taxa_conversao", "leads_mes"], additionalProperties: false } } }],
    "generate_kpis", baseUrl
  );
  if (kpis instanceof Response) return kpis;
  return new Response(JSON.stringify({ kpis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleExpert(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const expert = await callAI(
    `${mentePrefix}Você é um consultor de posicionamento de experts e infoprodutores brasileiro.\n${ctx}\nCom base no contexto do projeto, preencha os dados do expert de forma coerente.`,
    "Preencha os dados do expert com base no contexto disponível.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_expert", description: "Generate expert profile", parameters: { type: "object", properties: { bio: { type: "string" }, tom_voz: { type: "string" }, metodo: { type: "string" }, pilares: { type: "array", items: { type: "string" } }, transformacao: { type: "string" }, temas: { type: "array", items: { type: "string" } }, palavras_usa: { type: "array", items: { type: "string" } }, palavras_evita: { type: "array", items: { type: "string" } } }, required: ["bio", "tom_voz", "metodo", "pilares", "transformacao", "temas"], additionalProperties: false } } }],
    "generate_expert", baseUrl
  );
  if (expert instanceof Response) return expert;
  return new Response(JSON.stringify({ expert }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleAvatarPerfil(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const avatar_perfil = await callAI(
    `${mentePrefix}Você é um psicólogo de consumo e especialista em avatar de marketing brasileiro.\n${ctx}\nCom base nas pesquisas, dores, desejos e concorrentes, preencha o perfil psicológico completo do avatar.`,
    "Preencha o perfil psicológico e desejos do avatar.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_avatar_perfil", description: "Generate avatar profile", parameters: { type: "object", properties: { perfil_psicologico: { type: "object", properties: { retrato: { type: "string" }, arquetipo: { type: "string" }, ferida_central: { type: "string" }, padrao: { type: "string" }, contradicao: { type: "string" } }, required: ["retrato", "arquetipo", "ferida_central", "padrao", "contradicao"], additionalProperties: false }, desejo_externo: { type: "string" }, desejo_interno: { type: "string" }, inimigo: { type: "string" }, resultado_sonhado: { type: "string" }, trigger_event: { type: "string" }, fase_consciencia: { type: "string" }, crenca_bloqueadora: { type: "string" }, crenca_necessaria: { type: "string" }, epifania_central: { type: "string" }, camadas_psique: { type: "object", properties: { c1_observaveis: { type: "string" }, c2_conscientes: { type: "string" }, c3_subconscientes: { type: "string" }, c4_trauma: { type: "string" } }, required: ["c1_observaveis", "c2_conscientes", "c3_subconscientes", "c4_trauma"], additionalProperties: false } }, required: ["perfil_psicologico", "desejo_externo", "desejo_interno", "camadas_psique"], additionalProperties: false } } }],
    "generate_avatar_perfil", baseUrl
  );
  if (avatar_perfil instanceof Response) return avatar_perfil;
  return new Response(JSON.stringify({ avatar_perfil }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleExecuteSkill(body: any, sb: any, projectContext: string, skillsContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const { skill_id, skill_slug, skill_system_prompt, produto, extra_instructions } = body;

  // Get skill system prompt - prefer passed prompt, fallback to DB by id, then by slug/nome
  let systemPrompt = skill_system_prompt || "";
  let skillCategoria = "";
  if (!systemPrompt && skill_id) {
    const { data: skill } = await sb.from("imphq_skills").select("system_prompt, categoria").eq("id", skill_id).single();
    if (skill?.system_prompt) { systemPrompt = skill.system_prompt; skillCategoria = skill.categoria || ""; }
  }
  if (!systemPrompt && skill_slug) {
    // Search by slug (nome field, case-insensitive partial match)
    const { data: skills } = await sb.from("imphq_skills").select("system_prompt, categoria, nome")
      .eq("status", "Ativa").not("system_prompt", "is", null)
      .ilike("nome", `%${skill_slug}%`).limit(1);
    if (skills?.[0]?.system_prompt) { systemPrompt = skills[0].system_prompt; skillCategoria = skills[0].categoria || ""; }
  }
  if (!systemPrompt) throw new Error("Skill sem system_prompt");

  // Auto-enrich with complementary skills
  let complementaryContext = "";
  try {
    const complementaryCats: Record<string, string[]> = {
      "Copy & Persuasão": ["Pesquisa & Avatar", "Estratégia & Posicionamento"],
      "Pesquisa & Avatar": ["Copy & Persuasão", "Estratégia & Posicionamento"],
      "Estratégia & Posicionamento": ["Copy & Persuasão", "Pesquisa & Avatar"],
      "Vendas High-Ticket": ["Copy & Persuasão", "Pesquisa & Avatar"],
      "Inteligência Competitiva": ["Estratégia & Posicionamento", "Copy & Persuasão"],
    };
    const cats = complementaryCats[skillCategoria] || [];
    if (cats.length > 0) {
      const { data: compSkills } = await sb.from("imphq_skills").select("nome, system_prompt, categoria")
        .eq("status", "Ativa").not("system_prompt", "is", null).in("categoria", cats).limit(3);
      if (compSkills?.length) {
        complementaryContext = "\n\n## Skills complementares para referência:\n";
        for (const s of compSkills) {
          complementaryContext += `### ${s.nome} (${s.categoria})\n${(s.system_prompt || "").slice(0, 500)}\n\n`;
        }
      }
    }
  } catch (e) { console.error("Error fetching complementary skills:", e); }

  // Mentes IA: use specific mente if selected, otherwise generic summary
  const mentesRef = mentePrefix
    ? "" // Already injected via mentePrefix
    : `\n## Referências de Mentes IA:\n- Dan Kennedy: Marketing direto, urgência real, ROI mensurável\n- Gary Halbert: Headlines magnéticas, leads irresistíveis\n- Eugene Schwartz: Níveis de consciência, sofisticação de mercado\n- Russell Brunson: Funis, Expert Secrets, Epiphany Bridge\n- Alex Hormozi: Value equation, Grand Slam Offers\n- Robert Cialdini: 6 princípios de influência\n- David Ogilvy: Pesquisa, elegância, brand\n- Claude Hopkins: Scientific Advertising, testes\n`;

  // Product context
  let produtoContext = "";
  if (produto) produtoContext = `\n## Produto selecionado: ${produto}\n`;

  const fullSystem = `${mentePrefix}${systemPrompt}\n\n---\n\n## CONTEXTO DO PROJETO\n${projectContext}${produtoContext}${complementaryContext}${mentesRef}${skillsContext}`;

  const userMsg = extra_instructions
    ? `Execute a skill com base no contexto completo do projeto. Instruções adicionais: ${extra_instructions}`
    : "Execute a skill com base no contexto completo do projeto. Gere o resultado mais completo e detalhado possível.";

  const isOR = baseUrl.includes("openrouter.ai");
  const mkH = (key: string, or: boolean): Record<string, string> => {
    const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (or) { h["HTTP-Referer"] = "https://imperiox.lovable.app"; h["X-Title"] = "ImperioHQ"; }
    return h;
  };
  const skillPayload = JSON.stringify({ model, messages: [{ role: "system", content: fullSystem }, { role: "user", content: userMsg }] });

  let response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: skillPayload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log("Lovable gateway 402, falling back to OpenRouter (skill)");
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: skillPayload });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({ result: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleGenerateContent(body: any, projectContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const { prompt, content_type } = body;
  const systemPrompt = `${mentePrefix}Você é um estrategista de conteúdo e copywriter brasileiro de alto nível.
Especialista em criar conteúdos para redes sociais, marketing digital e lançamentos.
${projectContext}
REGRAS:
- Use linguagem conversacional e persuasiva em português brasileiro
- Seja específico para o projeto e avatar
- Inclua CTAs em cada peça de conteúdo
- Formate de forma organizada e prática`;

  const userMsg = prompt || `Gere conteúdo do tipo "${content_type}" para este projeto.`;

  const isOR = baseUrl.includes("openrouter.ai");
  const mkH = (key: string, or: boolean): Record<string, string> => {
    const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (or) { h["HTTP-Referer"] = "https://imperiox.lovable.app"; h["X-Title"] = "ImperioHQ"; }
    return h;
  };
  const payload = JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }] });

  let response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: payload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log("Lovable gateway 402, falling back to OpenRouter (generate_content)");
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: payload });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({ result: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleAnalyzeLead(body: any, projectContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const { lead, form_responses, score_log } = body;

  let leadContext = `\n## Dados do Lead:\n`;
  if (lead) {
    leadContext += `Nome: ${lead.nome || "—"}\nEmail: ${lead.email || "—"}\nTelefone: ${lead.phone || "—"}\n`;
    leadContext += `Plataforma: ${lead.plataforma || "—"}\nScore: ${lead.score || 0}\nTotal Gasto: R$ ${lead.total_gasto || 0}\n`;
    if (lead.tags?.length) leadContext += `Tags: ${lead.tags.join(", ")}\n`;
    if (lead.data?.interacoes?.length) leadContext += `Interações: ${JSON.stringify(lead.data.interacoes).slice(0, 1000)}\n`;
    if (lead.data?.qualificacao) leadContext += `Qualificação atual: ${JSON.stringify(lead.data.qualificacao).slice(0, 500)}\n`;
  }

  if (form_responses?.length) {
    leadContext += `\n## Respostas de Formulário:\n`;
    form_responses.forEach((r: any) => { leadContext += `- ${r.question}: ${r.answer}\n`; });
  }

  if (score_log?.length) {
    leadContext += `\n## Log de Score:\n`;
    score_log.forEach((s: any) => { leadContext += `- ${s.acao}: +${s.pontos}\n`; });
  }

  const systemPrompt = `${mentePrefix}Você é um analista de leads brasileiro especialista em qualificação e comportamento do consumidor.
Analise TODOS os dados disponíveis deste lead e retorne uma qualificação estruturada.
${projectContext}${leadContext}
REGRAS:
- Analise as respostas do formulário para identificar dores e nível de consciência
- Use o score e interações para inferir engajamento
- Seja específico e baseado nos dados reais, não invente`;

  const result = await callAI(systemPrompt, "Analise este lead e retorne a qualificação completa.", apiKey, model,
    [{ type: "function", function: { name: "analyze_lead", description: "Analyze lead qualification", parameters: { type: "object", properties: {
      qualificacao: { type: "object", properties: {
        dor_principal: { type: "string", description: "Principal dor/frustração identificada" },
        nivel_consciencia: { type: "string", enum: ["inconsciente", "problema", "solucao", "produto", "totalmente"] },
        objecoes: { type: "array", items: { type: "string" }, description: "Possíveis objeções identificadas" },
        notas_vendedor: { type: "string", description: "Resumo analítico e recomendações de abordagem" },
        renda: { type: "string", enum: ["ate3k", "3k-8k", "8k-15k", "15k-30k", "30k+"], description: "Renda estimada com base nos dados" },
        canal: { type: "string", description: "Canal principal de origem" },
      }, required: ["dor_principal", "nivel_consciencia", "objecoes", "notas_vendedor"], additionalProperties: false },
    }, required: ["qualificacao"], additionalProperties: false } } }],
    "analyze_lead", baseUrl
  );
  if (result instanceof Response) return result;
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleCampaignDrafts(body: any, projectContext: string, projectData: any, sb: any, apiKey: string, model: string, baseUrl: string) {
  const { project_id, user_prompt } = body;

  // Fetch existing ads data for context
  let adsContext = "";
  try {
    const { data: adsData } = await sb.from("imphq_ads_spend").select("campanha, conjunto_anuncios, valor, cliques, leads, compras, ctr, data_ref").eq("project_id", project_id).order("data_ref", { ascending: false }).limit(30);
    if (adsData?.length) {
      adsContext = "\n## Dados de Ads recentes:\n" + JSON.stringify(adsData.slice(0, 15), null, 2);
    }
  } catch (e) { console.error("Error fetching ads:", e); }

  // Fetch creatives
  let creativesContext = "";
  const d = typeof projectData?.data === "string" ? JSON.parse(projectData.data) : (projectData?.data || {});
  if (d.facebook_creatives?.length) {
    creativesContext = "\n## Criativos sincronizados do Facebook:\n" + JSON.stringify(d.facebook_creatives.slice(0, 10), null, 2);
  }

  // Copy arsenal
  let copyContext = "";
  if (d.copy_arsenal) copyContext = "\n## Arsenal de Copy:\n" + JSON.stringify(d.copy_arsenal).slice(0, 1000);

  const systemPrompt = `Você é um media buyer brasileiro de alto nível, especialista em Meta Ads (Facebook/Instagram).
Analise o contexto completo do projeto, incluindo avatar, produtos, copy arsenal e dados históricos de ads.
Gere drafts de campanhas prontos para serem criados no Gerenciador de Anúncios.
${projectContext}${adsContext}${creativesContext}${copyContext}
REGRAS:
- Gere campanhas realistas e específicas para este projeto
- Use a linguagem e tom do projeto
- Sugira públicos baseados no avatar
- Considere dados históricos para otimizar`;

  const userMsg = user_prompt || "Gere 3 campanhas de conversão otimizadas para este projeto.";

  const campaigns = await callAI(systemPrompt, userMsg, apiKey, model,
    [{ type: "function", function: { name: "generate_campaign_drafts", description: "Generate campaign drafts", parameters: { type: "object", properties: {
      campaigns: { type: "array", items: { type: "object", properties: {
        nome: { type: "string" },
        objetivo: { type: "string", enum: ["conversao", "trafego", "leads", "alcance", "engajamento"] },
        budget_diario: { type: "number" },
        publico: { type: "object", properties: {
          idade_min: { type: "number" }, idade_max: { type: "number" },
          genero: { type: "string", enum: ["todos", "masculino", "feminino"] },
          interesses: { type: "array", items: { type: "string" } },
          exclusoes: { type: "array", items: { type: "string" } },
        }, required: ["idade_min", "idade_max", "genero", "interesses"], additionalProperties: false },
        copies: { type: "array", items: { type: "object", properties: {
          headline: { type: "string" }, texto_primario: { type: "string" }, cta: { type: "string" },
        }, required: ["headline", "texto_primario", "cta"], additionalProperties: false } },
        sugestao_criativo: { type: "string" },
        justificativa: { type: "string" },
      }, required: ["nome", "objetivo", "budget_diario", "publico", "copies", "justificativa"], additionalProperties: false } },
      resumo_estrategico: { type: "string" },
    }, required: ["campaigns", "resumo_estrategico"], additionalProperties: false } } }],
    "generate_campaign_drafts", baseUrl
  );
  if (campaigns instanceof Response) return campaigns;
  return new Response(JSON.stringify({ campaigns }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleAnalyzeAds(body: any, projectContext: string, projectData: any, sb: any, apiKey: string, model: string, baseUrl: string) {
  const { project_id } = body;

  // Fetch all ads data
  const { data: adsData } = await sb.from("imphq_ads_spend").select("*").eq("project_id", project_id).order("data_ref", { ascending: false }).limit(100);
  const { data: vendasData } = await sb.from("imphq_vendas").select("produto_nome, valor, status, data_venda").eq("project_id", project_id).eq("status", "aprovado").limit(100);

  const d = typeof projectData?.data === "string" ? JSON.parse(projectData.data) : (projectData?.data || {});
  let creativesInfo = "";
  if (d.facebook_creatives?.length) creativesInfo = "\n## Criativos:\n" + JSON.stringify(d.facebook_creatives.slice(0, 10), null, 2);

  const systemPrompt = `Você é um analista de performance de anúncios brasileiro especialista em Meta Ads.
Analise os dados REAIS de ads e vendas deste projeto e gere um relatório completo de otimização.
${projectContext}
## Dados de Ads:
${JSON.stringify(adsData || [], null, 2)}
## Vendas aprovadas:
${JSON.stringify(vendasData || [], null, 2)}
${creativesInfo}
REGRAS:
- Use dados reais, não invente números
- Identifique padrões claros
- Dê recomendações acionáveis e específicas
- Compare métricas com benchmarks do mercado brasileiro`;

  const analysis = await callAI(systemPrompt,
    "Analise a performance completa dos anúncios e gere recomendações de otimização.",
    apiKey, model,
    [{ type: "function", function: { name: "analyze_ads_performance", description: "Analyze ads performance", parameters: { type: "object", properties: {
      resumo_geral: { type: "string" },
      melhor_campanha: { type: "object", properties: { nome: { type: "string" }, motivo: { type: "string" }, metricas: { type: "string" } }, required: ["nome", "motivo", "metricas"], additionalProperties: false },
      pior_campanha: { type: "object", properties: { nome: { type: "string" }, motivo: { type: "string" }, sugestao: { type: "string" } }, required: ["nome", "motivo", "sugestao"], additionalProperties: false },
      alertas: { type: "array", items: { type: "object", properties: { tipo: { type: "string", enum: ["frequencia_alta", "ctr_baixo", "cpc_alto", "budget_mal_distribuido", "criativo_saturado", "outro"] }, mensagem: { type: "string" }, acao_sugerida: { type: "string" } }, required: ["tipo", "mensagem", "acao_sugerida"], additionalProperties: false } },
      otimizacoes: { type: "array", items: { type: "object", properties: { area: { type: "string" }, recomendacao: { type: "string" }, impacto_esperado: { type: "string" } }, required: ["area", "recomendacao", "impacto_esperado"], additionalProperties: false } },
      novos_publicos: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, descricao: { type: "string" }, interesses: { type: "array", items: { type: "string" } } }, required: ["nome", "descricao", "interesses"], additionalProperties: false } },
      redistribuicao_budget: { type: "string" },
    }, required: ["resumo_geral", "alertas", "otimizacoes"], additionalProperties: false } } }],
    "analyze_ads_performance", baseUrl
  );
  if (analysis instanceof Response) return analysis;
  return new Response(JSON.stringify({ analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleContentPlan(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "", body: any = {}) {
  const objective = body.content_objective || "";
  const postsPerDay = body.posts_per_day || 2;
  const platforms = body.priority_platforms?.length ? body.priority_platforms.join(", ") : "Instagram, YouTube, TikTok, LinkedIn, Blog, Email, WhatsApp";
  const productName = body.product_name || "";

  let productFocus = "";
  if (productName) {
    productFocus = `\n## PRODUTO EM FOCO: "${productName}"\nTodo o conteúdo deve ser direcionado para este produto. Use o mecanismo único, contexto e arsenal de copy deste produto nos temas.\n`;
  }

  const dayItemSchema = { type: "object", properties: { id: { type: "string" }, platform: { type: "string" }, type: { type: "string" }, description: { type: "string" }, cross_platforms: { type: "array", items: { type: "string" } } }, required: ["id", "platform", "type", "description"], additionalProperties: false };
  const weekSchema = { type: "object", properties: {
    seg: { type: "array", items: dayItemSchema }, ter: { type: "array", items: dayItemSchema },
    qua: { type: "array", items: dayItemSchema }, qui: { type: "array", items: dayItemSchema },
    sex: { type: "array", items: dayItemSchema }, "sáb": { type: "array", items: dayItemSchema },
    dom: { type: "array", items: dayItemSchema },
  }, required: ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"], additionalProperties: false };

  const weekSummarySchema = { type: "object", properties: { focus: { type: "string" }, event: { type: "string" } }, required: ["focus"], additionalProperties: false };

  const result = await callAI(
    `${mentePrefix}Você é um estrategista de conteúdo brasileiro especialista em redes sociais e marketing digital.
${ctx}
${objective ? `\n## OBJETIVOS DO MOVIMENTO\n${objective}\n` : ""}${productFocus}
REGRAS:
- Gere um plano de conteúdo MENSAL completo (4 semanas: semana_1 a semana_4)
- Cada semana tem 7 dias (seg a dom)
- Para cada dia, sugira ${postsPerDay} peças de conteúdo com plataforma, tipo e tema
- Plataformas prioritárias: ${platforms}
- Tipos possíveis: Post, Reels, Story, Live, Artigo, Email, Vídeo, Carousel, Video Longo

## FASES ESTRATÉGICAS SEMANAIS
- Cada semana deve ter uma FASE estratégica (week_labels). Exemplo:
  - Semana 1: "Atração" (conteúdo educativo, topo de funil)
  - Semana 2: "Autoridade" (prova social, lives, casos)
  - Semana 3: "Objeções" (FAQ, bastidores, depoimentos)
  - Semana 4: "Conversão" (oferta, escassez, CTA direto)
- Adapte as fases ao objetivo declarado pelo usuário.

## RESUMO POR SEMANA (week_summaries)
- Para cada semana, inclua um objeto com "focus" (foco estratégico resumido) e "event" (evento central, ex: "Live de autoridade", "Webinário", ou vazio)

## REGRAS DE FORMATO
- STORIES: inclua 1-2 Stories por dia (bastidores, enquetes, CTA, quicktips, caixinha de perguntas)
- REELS: quando criar um Reels, adicione cross_platforms: ["TikTok", "YouTube Shorts"]
- VIDEO LONGO: para YouTube, inclua pelo menos 1 "Video Longo" por semana
- Baseie os temas nas dores do avatar, expert, brand kit e arsenal de copy
- Varie formatos e plataformas ao longo do mês
- Construa uma narrativa progressiva ao longo das 4 semanas${objective ? ` alinhada aos objetivos: "${objective}"` : ""}
- Retorne EXATAMENTE o JSON solicitado`,
    "Gere o plano de conteúdo mensal completo (4 semanas) com fases estratégicas.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_content_plan", description: "Generate monthly content plan (4 weeks) with strategic phases", parameters: { type: "object", properties: {
      content_plan: { type: "object", properties: {
        semana_1: weekSchema, semana_2: weekSchema, semana_3: weekSchema, semana_4: weekSchema,
        week_labels: { type: "object", properties: { semana_1: { type: "string" }, semana_2: { type: "string" }, semana_3: { type: "string" }, semana_4: { type: "string" } }, required: ["semana_1", "semana_2", "semana_3", "semana_4"], additionalProperties: false },
        week_summaries: { type: "object", properties: { semana_1: weekSummarySchema, semana_2: weekSummarySchema, semana_3: weekSummarySchema, semana_4: weekSummarySchema }, required: ["semana_1", "semana_2", "semana_3", "semana_4"], additionalProperties: false },
      }, required: ["semana_1", "semana_2", "semana_3", "semana_4", "week_labels", "week_summaries"], additionalProperties: false }
    }, required: ["content_plan"], additionalProperties: false } } }],
    "generate_content_plan", baseUrl
  );
  if (result instanceof Response) return result;
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleExpertNotes(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const isOR = baseUrl.includes("openrouter.ai");
  const mkH = (key: string, or: boolean): Record<string, string> => {
    const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (or) { h["HTTP-Referer"] = "https://imperiox.lovable.app"; h["X-Title"] = "ImperioHQ"; }
    return h;
  };

  const systemPrompt = `${mentePrefix}Você é um diretor de operações e estrategista de conteúdo brasileiro.
${ctx}
Gere instruções claras e objetivas para o expert da semana, incluindo:
- Objetivos principais da semana
- Foco estratégico de conteúdo
- Lembretes importantes
- Orientações de tom e abordagem
- Prioridades de engajamento
Seja direto, prático e motivacional. Máximo 500 palavras.`;

  const payload = JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Gere as instruções da semana para o expert." }] });

  let response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: payload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: payload });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({ expert_notes: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleCampaignMessage(body: any, projectContext: string, sb: any, apiKey: string, model: string, baseUrl: string, mentePrefix: string) {
  const { campaign_id, produto, step_order, total_steps, media_type } = body;

  let campaignName = "";
  if (campaign_id) {
    const { data: camp } = await sb.from("imphq_wa_campaigns").select("name, produto").eq("id", campaign_id).single();
    if (camp) {
      campaignName = camp.name || "";
      if (!produto && camp.produto) body.produto_fallback = camp.produto;
    }
  }

  const produtoFinal = produto || body.produto_fallback || "";
  const mediaLabel = media_type === "text" ? "mensagem de texto" : media_type === "image" ? "mensagem com imagem (gere o texto/caption)" : media_type === "audio" ? "roteiro de áudio" : media_type === "video" ? "roteiro de vídeo" : "mensagem";

  const systemPrompt = `${mentePrefix}Você é um copywriter brasileiro especialista em WhatsApp Marketing.
Seu objetivo: criar UMA ${mediaLabel} persuasiva para WhatsApp.

## Contexto da Campanha
- Nome: ${campaignName}
- Produto: ${produtoFinal || "não especificado"}
- Etapa ${(step_order || 0) + 1} de ${total_steps || "?"} na sequência
- Tipo de mídia: ${media_type}

${projectContext}

REGRAS:
- Linguagem conversacional, direta, em português BR
- Use emojis com moderação
- Inclua variáveis como {{nome}} quando apropriado
- Para etapa 1: abertura/boas-vindas com gancho
- Para etapas intermediárias: valor, prova social, storytelling
- Para última etapa: CTA forte, urgência, escassez
- Máximo 300 palavras
- NÃO use markdown. Texto puro formatado para WhatsApp (negrito com *asteriscos*, itálico com _underscores_)
- Retorne APENAS o texto da mensagem, sem explicações`;

  const userPrompt = `Gere a mensagem para a etapa ${(step_order || 0) + 1} de ${total_steps || "?"} da campanha "${campaignName}" sobre o produto "${produtoFinal}". Tipo: ${mediaLabel}.`;

  const isOpenRouter = baseUrl.includes("openrouter.ai");
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (isOpenRouter) { headers["HTTP-Referer"] = "https://imperiox.lovable.app"; headers["X-Title"] = "ImperioHQ"; }

  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
  });

  if (!isOpenRouter && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      const orHeaders: Record<string, string> = { Authorization: `Bearer ${orKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://imperiox.lovable.app", "X-Title": "ImperioHQ" };
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: orHeaders, body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }) });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
