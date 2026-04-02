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
    const { project_id, trigger_tipo, num_etapas = 4, action, model: requestedModel, openrouter_key } = body;
    const model = requestedModel || "google/gemini-3-flash-preview";

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
        if (d.produtos) projectContext += `Produtos: ${JSON.stringify(d.produtos).slice(0, 500)}\n`;
        if (d.kpis) projectContext += `KPIs existentes: ${JSON.stringify(d.kpis).slice(0, 500)}\n`;
        
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

    // Route by action
    if (action === "execute_skill") return await handleExecuteSkill(body, sb, projectContext, skillsContext, LOVABLE_API_KEY, model);
    if (action === "generate_copy_arsenal") return await handleCopyArsenal(projectContext, LOVABLE_API_KEY, model);
    if (action === "generate_branding") return await handleBranding(projectContext, LOVABLE_API_KEY, model);
    if (action === "generate_gatilhos") return await handleGatilhos(projectContext, LOVABLE_API_KEY, model);
    if (action === "generate_kpis") return await handleKPIs(projectContext, LOVABLE_API_KEY, model);
    if (action === "generate_expert") return await handleExpert(projectContext, LOVABLE_API_KEY, model);
    if (action === "generate_avatar_perfil") return await handleAvatarPerfil(projectContext, LOVABLE_API_KEY, model);
    if (action === "generate_campaign_drafts") return await handleCampaignDrafts(body, projectContext, projectData, sb, LOVABLE_API_KEY, model);
    if (action === "analyze_ads_performance") return await handleAnalyzeAds(body, projectContext, projectData, sb, LOVABLE_API_KEY, model);

    // Default: automation flow generation
    const triggerLabels: Record<string, string> = {
      carrinho_abandonado: "Carrinho Abandonado — o lead iniciou checkout mas não concluiu",
      compra_aprovada: "Compra Aprovada — o lead acabou de comprar",
      lead_novo: "Novo Lead — acabou de se cadastrar/capturar",
      reembolso: "Reembolso — o cliente pediu reembolso",
    };

    const systemPrompt = `Você é um copywriter brasileiro especialista em automações de marketing digital e sequências multicanal (email, WhatsApp, Telegram).
Seu objetivo: criar uma sequência de ${num_etapas} mensagens para a automação de "${triggerLabels[trigger_tipo] || trigger_tipo}".
${projectContext ? `Contexto do projeto:\n${projectContext}` : ""}
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });

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

async function callAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string, tools: any[], toolName: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], tools, tool_choice: { type: "function", function: { name: toolName } } }),
  });
  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const tc = result.choices?.[0]?.message?.tool_calls?.[0];
  return tc?.function?.arguments ? JSON.parse(tc.function.arguments) : {};
}

async function handleCopyArsenal(ctx: string, apiKey: string, model: string) {
  const arsenal = await callAI(
    `Você é um copywriter brasileiro de alto nível. Analise o contexto e gere copy de alta conversão.\n${ctx}\nREGRAS: Use linguagem persuasiva, emocional e direta. Seja específico para este projeto.`,
    "Gere o Arsenal de Copy completo.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_copy_arsenal", description: "Generate copy arsenal", parameters: { type: "object", properties: { promessa: { type: "array", items: { type: "string" } }, inimigo_comum: { type: "array", items: { type: "string" } }, efeito_colateral: { type: "array", items: { type: "string" } }, oportunidade: { type: "array", items: { type: "string" } }, metodo_simplificado: { type: "array", items: { type: "string" } }, hora_do_show: { type: "array", items: { type: "string" } } }, required: ["promessa", "inimigo_comum", "efeito_colateral", "oportunidade", "metodo_simplificado", "hora_do_show"], additionalProperties: false } } }],
    "generate_copy_arsenal"
  );
  if (arsenal instanceof Response) return arsenal;
  return new Response(JSON.stringify({ arsenal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleBranding(ctx: string, apiKey: string, model: string) {
  const branding = await callAI(
    `Você é um estrategista de marca brasileiro. Analise o contexto e sugira branding.\n${ctx}\nEscolha arquétipo dentre: heroi, mentor, fora_da_lei, explorador, criador, cuidador, rei, mago, bobo`,
    "Analise e gere sugestões de branding completas.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_branding", description: "Generate branding", parameters: { type: "object", properties: { arquetipo: { type: "string" }, inimigo_comum: { type: "string" }, mecanismo_chave: { type: "string" }, personalidade: { type: "string" }, manifesto: { type: "string" }, palavras_usa: { type: "array", items: { type: "string" } }, palavras_evita: { type: "array", items: { type: "string" } } }, required: ["arquetipo", "inimigo_comum", "mecanismo_chave", "personalidade", "manifesto", "palavras_usa", "palavras_evita"], additionalProperties: false } } }],
    "generate_branding"
  );
  if (branding instanceof Response) return branding;
  return new Response(JSON.stringify({ branding }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleGatilhos(ctx: string, apiKey: string, model: string) {
  const gatilhos = await callAI(
    `Você é um especialista em psicologia do consumo e copywriting emocional brasileiro.\n${ctx}\nGere 5-7 gatilhos emocionais específicos com storyboard narrativo.`,
    "Gere gatilhos emocionais + storyboard narrativo completo.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_gatilhos", description: "Generate triggers", parameters: { type: "object", properties: { gatilhos: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, categoria: { type: "string" }, intensidade: { type: "string" }, situacao: { type: "string" }, copy_sugerido: { type: "string" } }, required: ["nome", "categoria", "intensidade", "situacao", "copy_sugerido"], additionalProperties: false } }, storyboard: { type: "object", properties: { antes: { type: "string" }, trigger: { type: "string" }, busca: { type: "string" }, objecao: { type: "string" }, decisao: { type: "string" } }, required: ["antes", "trigger", "busca", "objecao", "decisao"], additionalProperties: false }, gatilho_nuclear: { type: "string" }, the_high: { type: "string" }, the_hell: { type: "string" }, segredo_final: { type: "string" } }, required: ["gatilhos", "storyboard", "gatilho_nuclear", "the_high", "the_hell", "segredo_final"], additionalProperties: false } } }],
    "generate_gatilhos"
  );
  if (gatilhos instanceof Response) return gatilhos;
  return new Response(JSON.stringify({ gatilhos }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleKPIs(ctx: string, apiKey: string, model: string) {
  const kpis = await callAI(
    `Você é um analista de marketing digital brasileiro. Com base nos dados reais do projeto, calcule ou estime os KPIs.\n${ctx}\nUse os dados de vendas, leads, custos e ads para calcular valores reais. Se não houver dados suficientes, estime com base no mercado.`,
    "Calcule os KPIs do projeto com base nos dados disponíveis.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_kpis", description: "Calculate KPIs", parameters: { type: "object", properties: { cpl: { type: "string" }, cac: { type: "string" }, roi: { type: "string" }, roas: { type: "string" }, ticket_medio: { type: "string" }, ltv: { type: "string" }, taxa_conversao: { type: "string" }, leads_mes: { type: "string" } }, required: ["cpl", "cac", "roi", "roas", "ticket_medio", "ltv", "taxa_conversao", "leads_mes"], additionalProperties: false } } }],
    "generate_kpis"
  );
  if (kpis instanceof Response) return kpis;
  return new Response(JSON.stringify({ kpis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleExpert(ctx: string, apiKey: string, model: string) {
  const expert = await callAI(
    `Você é um consultor de posicionamento de experts e infoprodutores brasileiro.\n${ctx}\nCom base no contexto do projeto, preencha os dados do expert de forma coerente.`,
    "Preencha os dados do expert com base no contexto disponível.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_expert", description: "Generate expert profile", parameters: { type: "object", properties: { bio: { type: "string" }, tom_voz: { type: "string" }, metodo: { type: "string" }, pilares: { type: "array", items: { type: "string" } }, transformacao: { type: "string" }, temas: { type: "array", items: { type: "string" } }, palavras_usa: { type: "array", items: { type: "string" } }, palavras_evita: { type: "array", items: { type: "string" } } }, required: ["bio", "tom_voz", "metodo", "pilares", "transformacao", "temas"], additionalProperties: false } } }],
    "generate_expert"
  );
  if (expert instanceof Response) return expert;
  return new Response(JSON.stringify({ expert }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleAvatarPerfil(ctx: string, apiKey: string, model: string) {
  const avatar_perfil = await callAI(
    `Você é um psicólogo de consumo e especialista em avatar de marketing brasileiro.\n${ctx}\nCom base nas pesquisas, dores, desejos e concorrentes, preencha o perfil psicológico completo do avatar.`,
    "Preencha o perfil psicológico e desejos do avatar.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_avatar_perfil", description: "Generate avatar profile", parameters: { type: "object", properties: { perfil_psicologico: { type: "object", properties: { retrato: { type: "string" }, arquetipo: { type: "string" }, ferida_central: { type: "string" }, padrao: { type: "string" }, contradicao: { type: "string" } }, required: ["retrato", "arquetipo", "ferida_central", "padrao", "contradicao"], additionalProperties: false }, desejo_externo: { type: "string" }, desejo_interno: { type: "string" }, inimigo: { type: "string" }, resultado_sonhado: { type: "string" }, trigger_event: { type: "string" }, fase_consciencia: { type: "string" }, crenca_bloqueadora: { type: "string" }, crenca_necessaria: { type: "string" }, epifania_central: { type: "string" }, camadas_psique: { type: "object", properties: { c1_observaveis: { type: "string" }, c2_conscientes: { type: "string" }, c3_subconscientes: { type: "string" }, c4_trauma: { type: "string" } }, required: ["c1_observaveis", "c2_conscientes", "c3_subconscientes", "c4_trauma"], additionalProperties: false } }, required: ["perfil_psicologico", "desejo_externo", "desejo_interno", "camadas_psique"], additionalProperties: false } } }],
    "generate_avatar_perfil"
  );
  if (avatar_perfil instanceof Response) return avatar_perfil;
  return new Response(JSON.stringify({ avatar_perfil }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleExecuteSkill(body: any, sb: any, projectContext: string, skillsContext: string, apiKey: string, model: string) {
  const { skill_id, skill_system_prompt, produto, extra_instructions } = body;

  // Get skill system prompt - prefer passed prompt, fallback to DB
  let systemPrompt = skill_system_prompt || "";
  let skillCategoria = "";
  if (!systemPrompt && skill_id) {
    const { data: skill } = await sb.from("imphq_skills").select("system_prompt, categoria").eq("id", skill_id).single();
    if (skill?.system_prompt) { systemPrompt = skill.system_prompt; skillCategoria = skill.categoria || ""; }
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

  // Mentes IA summary
  const mentesRef = `\n## Referências de Mentes IA:\n- Dan Kennedy: Marketing direto, urgência real, ROI mensurável\n- Gary Halbert: Headlines magnéticas, leads irresistíveis\n- Eugene Schwartz: Níveis de consciência, sofisticação de mercado\n- Russell Brunson: Funis, Expert Secrets, Epiphany Bridge\n- Alex Hormozi: Value equation, Grand Slam Offers\n- Robert Cialdini: 6 princípios de influência\n- David Ogilvy: Pesquisa, elegância, brand\n- Claude Hopkins: Scientific Advertising, testes\n`;

  // Product context
  let produtoContext = "";
  if (produto) produtoContext = `\n## Produto selecionado: ${produto}\n`;

  const fullSystem = `${systemPrompt}\n\n---\n\n## CONTEXTO DO PROJETO\n${projectContext}${produtoContext}${complementaryContext}${mentesRef}${skillsContext}`;

  const userMsg = extra_instructions
    ? `Execute a skill com base no contexto completo do projeto. Instruções adicionais: ${extra_instructions}`
    : "Execute a skill com base no contexto completo do projeto. Gere o resultado mais completo e detalhado possível.";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: fullSystem }, { role: "user", content: userMsg }] }),
  });

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({ result: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleCampaignDrafts(body: any, projectContext: string, projectData: any, sb: any, apiKey: string, model: string) {
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
    "generate_campaign_drafts"
  );
  if (campaigns instanceof Response) return campaigns;
  return new Response(JSON.stringify({ campaigns }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleAnalyzeAds(body: any, projectContext: string, projectData: any, sb: any, apiKey: string, model: string) {
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
    "analyze_ads_performance"
  );
  if (analysis instanceof Response) return analysis;
  return new Response(JSON.stringify({ analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
