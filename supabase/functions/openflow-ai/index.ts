import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ALL_SLUGS, ANGLE_BY_SLUG, anglesCatalogBlock, qualityChecklistBlock } from "../_shared/creativeAngles.ts";
import { validateAndFixAngles, withRetry } from "./_validators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { project_id, trigger_tipo, num_etapas = 4, action, model: requestedModel, openrouter_key, mente_id, produto, product_index, skill_slugs, stories_per_day, extra_urls, briefing_extra } = body;
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
      // If specific skills requested, fetch those; otherwise fetch top 5
      if (skill_slugs && Array.isArray(skill_slugs) && skill_slugs.length > 0) {
        const { data: skills } = await sb.from("imphq_skills").select("nome, system_prompt, categoria").in("slug", skill_slugs).limit(10);
        if (skills && skills.length > 0) {
          skillsContext = "\n## Skills ATIVADAS pelo usuário (aplique obrigatoriamente):\n";
          for (const skill of skills) {
            skillsContext += `### ${skill.nome} (${skill.categoria || "geral"})\n${(skill.system_prompt || "").slice(0, 800)}\n\n`;
          }
        }
      } else {
        const { data: skills } = await sb.from("imphq_skills").select("nome, system_prompt, categoria").eq("status", "Ativa").not("system_prompt", "is", null).limit(5);
        if (skills && skills.length > 0) {
          skillsContext = "\n## Skills disponíveis para referência:\n";
          for (const skill of skills) {
            skillsContext += `- **${skill.nome}** (${skill.categoria || "geral"}): ${(skill.system_prompt || "").slice(0, 300)}\n`;
          }
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

      // ── KPIs REAIS calculados (últimos 30d quando aplicável) ──
      const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

      const { data: vendas } = await sb.from("imphq_vendas").select("produto_nome, valor, status, created_at").eq("project_id", project_id).limit(500);
      const vendasAprovadas = (vendas || []).filter((v: any) => v.status === "aprovado");
      const totalVendas = vendasAprovadas.reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);
      const totalVendasCount = vendasAprovadas.length;
      const ticketMedio = totalVendasCount > 0 ? totalVendas / totalVendasCount : 0;
      const produtosVendidos = [...new Set((vendas || []).map((v: any) => v.produto_nome).filter(Boolean))];
      const vendas30d = vendasAprovadas.filter((v: any) => v.created_at >= since30d);
      const receita30d = vendas30d.reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);

      const { count: leadsCount } = await sb.from("imphq_leads").select("id", { count: "exact", head: true }).eq("project_id", project_id);
      const { count: leads30d } = await sb.from("imphq_leads").select("id", { count: "exact", head: true }).eq("project_id", project_id).gte("created_at", since30d);

      const { data: costs } = await sb.from("imphq_project_costs").select("valor").eq("project_id", project_id).limit(100);
      const totalCosts = (costs || []).reduce((s: number, c: any) => s + (parseFloat(c.valor) || 0), 0);

      const { data: adsData } = await sb.from("imphq_ads_spend").select("valor, leads, cliques, impressoes, data").eq("project_id", project_id).limit(200);
      const totalAds = (adsData || []).reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
      const totalAdsLeads = (adsData || []).reduce((s: number, a: any) => s + (a.leads || 0), 0);
      const totalCliques = (adsData || []).reduce((s: number, a: any) => s + (a.cliques || 0), 0);
      const totalImpr = (adsData || []).reduce((s: number, a: any) => s + (a.impressoes || 0), 0);
      const ads30d = (adsData || []).filter((a: any) => a.data >= since30d.slice(0, 10));
      const spend30d = ads30d.reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);

      // KPIs derivados
      const cpl = totalAdsLeads > 0 ? totalAds / totalAdsLeads : 0;
      const cac = totalVendasCount > 0 ? totalAds / totalVendasCount : 0;
      const ctr = totalImpr > 0 ? (totalCliques / totalImpr) * 100 : 0;
      const roas = totalAds > 0 ? totalVendas / totalAds : 0;
      const lucro = totalVendas - totalAds - totalCosts;
      const margem = totalVendas > 0 ? (lucro / totalVendas) * 100 : 0;
      const txConv = (leadsCount || 0) > 0 ? (totalVendasCount / (leadsCount || 1)) * 100 : 0;

      projectContext += `\n## 📊 KPIs REAIS DO PROJETO (calculados agora)\n`;
      projectContext += `Receita total aprovada: R$ ${totalVendas.toFixed(2)} (${totalVendasCount} vendas)\n`;
      projectContext += `Receita últimos 30d: R$ ${receita30d.toFixed(2)} (${vendas30d.length} vendas)\n`;
      projectContext += `Ticket médio: R$ ${ticketMedio.toFixed(2)}\n`;
      projectContext += `Total leads: ${leadsCount || 0} | Leads últimos 30d: ${leads30d || 0}\n`;
      projectContext += `Investimento Ads: R$ ${totalAds.toFixed(2)} (últimos 30d: R$ ${spend30d.toFixed(2)})\n`;
      projectContext += `Custos operacionais: R$ ${totalCosts.toFixed(2)}\n`;
      projectContext += `**CPL**: R$ ${cpl.toFixed(2)} | **CAC**: R$ ${cac.toFixed(2)} | **CTR**: ${ctr.toFixed(2)}% | **ROAS**: ${roas.toFixed(2)}x\n`;
      projectContext += `**Taxa de Conversão Lead→Venda**: ${txConv.toFixed(2)}%\n`;
      projectContext += `**Lucro estimado**: R$ ${lucro.toFixed(2)} | **Margem**: ${margem.toFixed(1)}%\n`;
      if (produtosVendidos.length > 0) projectContext += `Produtos com vendas: ${produtosVendidos.join(", ")}\n`;
      projectContext += `\n👉 USE ESSES NÚMEROS REAIS no copy quando fizer sentido (provas, urgência, ROI, ofertas baseadas em ticket médio).\n`;
    }

    // Route by action — pass mentePrefix for personality injection
    if (action === "generate_flowchart") return await handleGenerateFlowchart(body, projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_image") return await handleGenerateImage(body, sb, projectContext, aiApiKey, mentePrefix);
    if (action === "edit_image") return await handleEditImage(body, sb, projectContext, aiApiKey, mentePrefix);
    if (action === "generate_brainstorm") return await handleBrainstorm(body, projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "market_intel_research") return await handleMarketIntelResearch(body, sb, projectContext, skillsContext, aiApiKey, model, aiBaseUrl, mentePrefix, projectData);
    if (action === "execute_skill") return await handleExecuteSkill(body, sb, projectContext, skillsContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_content") return await handleGenerateContent(body, projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_copy_arsenal") return await handleCopyArsenal(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix, projectData, product_index, skillsContext, extra_urls, briefing_extra);
    if (action === "generate_avatar_angles") return await handleAvatarAngles(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix, projectData);
    if (action === "generate_product_intel") return await handleProductIntel(projectContext, aiApiKey, model, aiBaseUrl, mentePrefix, projectData, product_index, skillsContext);
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
    if (action === "generate_content_pack") return await handleContentPack(body, projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "ai_organize_funnel") return await handleOrganizeFunnel(body, projectContext, skillsContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_funnel_from_prompt") return await handleGenerateFunnelFromPrompt(body, projectContext, skillsContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "generate_funnel_pipeline") return await handleGenerateFunnelPipeline(body, projectContext, skillsContext, aiApiKey, model, aiBaseUrl, mentePrefix);
    if (action === "refine_skill") return await handleRefineSkill(body, sb, aiApiKey, model, aiBaseUrl);

    // Default: automation flow generation
    const triggerLabels: Record<string, string> = {
      carrinho_abandonado: "Carrinho Abandonado — o lead iniciou checkout mas não concluiu",
      compra_aprovada: "Compra Aprovada — o lead acabou de comprar",
      lead_novo: "Novo Lead — acabou de chegar do anúncio/captura no WhatsApp",
      reembolso: "Reembolso — o cliente pediu reembolso",
    };

    const produtoFoco = produto ? `\nO PRODUTO EM FOCO desta automação é: "${produto}". Direcione toda a copy especificamente para este produto.\n` : "";

    // Heurística: detectar se é funil de AQUISIÇÃO X1 (lead do ads → WhatsApp → venda)
    const isAcquisition = trigger_tipo === "lead_novo" || /aquisi|x1|ads|funil|capta|venda direta|qualifica/i.test(String(body.intent || body.objective || ""));

    const acquisitionGuidance = isAcquisition ? `
## CONTEXTO ESPECIAL: FUNIL DE AQUISIÇÃO X1 (ADS → WHATSAPP → VENDA)
Este fluxo recebe leads vindos diretamente do anúncio para o WhatsApp. Sua missão é criar um funil COMPLETO de venda consultiva multimodal:

1. **Abertura humana** (whatsapp): cumprimento + 1 pergunta de qualificação aberta.
2. **Aguardar resposta** (wait_reply) com timeout 60-180min.
3. **IA conversacional** (ia_message) qualificando progressivamente:
   - UMA pergunta por vez (situação → dor → urgência → decisor)
   - Use ia_vision=true se o lead pode mandar print/foto (boleto, situação atual)
   - Use ia_voice_response=true se faz sentido a IA responder com áudio
4. **Áudio de apresentação** (audio): tipo "audio" — IA gera áudio de 60-90s explicando como o produto resolve a dor declarada.
5. **Prova social** (whatsapp): print/depoimento de cliente. Use placeholder {{print_resultado}} ou {{depoimento_cliente}}.
6. **IA fechando objeções** (ia_message): identifica objeção principal e responde.
7. **Qualify_lead** + **notify_operator**: marca como pronto-fechamento e avisa o time.
8. **CTA com link** (whatsapp): envia {{link}} de checkout com escassez real.
9. **Follow-up** (whatsapp em 12h-24h) + **stop_on_event** ("compra_aprovada") para sair quando converter.

Use tipos: whatsapp, audio, ia_message, wait_reply, aguardar, qualify_lead, notify_operator, stop_on_event, adicionar_tag.
` : "";

    const systemPrompt = `Você é um copywriter brasileiro especialista em automações de marketing digital e sequências multicanal (email, WhatsApp, Telegram, áudio, IA conversacional).
Seu objetivo: criar uma sequência de ${num_etapas} ações para a automação de "${triggerLabels[trigger_tipo] || trigger_tipo}".
${produtoFoco}${acquisitionGuidance}${projectContext ? `\nContexto do projeto:\n${projectContext}` : ""}
${skillsContext}
REGRAS:
- Use linguagem conversacional e persuasiva em português brasileiro
- Cada ação deve ter um propósito claro
- Intercale canais quando fizer sentido (whatsapp + audio + ia_message)
- Inclua delays realistas (use "aguardar" entre toques)
- Para IA conversacional use tipo "ia_message" e descreva no template o COMPORTAMENTO esperado (não a mensagem literal)
- Variáveis: {{nome}}, {{produto}}, {{link}}, {{telefone}}, {{print_resultado}}, {{depoimento_cliente}}
- Retorne EXATAMENTE o JSON solicitado, sem markdown

ESTILO DE ESCRITA (REGRAS SUGAMELE — OBRIGATÓRIO em todo template de mensagem):
A copy deve soar como CONVERSA REAL, não artigo, não texto de IA.
- Conectivos entre ideias (E, Mas, Só que aí, Então, E olha, Agora, Porque daí). Proibida frase telegráfica ("Comprou. Aprendeu. Tentou.") — sempre fluir.
- Artigo antes de todo substantivo.
- Reticências (…) para ritmo de fala em reflexão/suspense.
- Especificidade extrema: números, prazos, valores, exemplos concretos. Proibido "bons resultados", "muita gente". Forte: "R$ 12.300 em 14 dias com R$ 480 de tráfego".
- Imagens mentais em vez de rótulos abstratos.
- Sem dicotomia simplista, sem travessão (—), sem adjetivo vazio (incrível, transformador, revolucionário, profundo).
- Coloquial natural ("tá", "pra", "na prática", "de tudo que é jeito") sem vulgaridade.
- CTA conversacional, nunca interrupção. Errado: "Compre agora". Certo: "se isso fizer sentido pra você, dá uma olhada aqui embaixo".
- Pergunta de engajamento curta quando couber ("faz sentido?", "sabe o que acontece?") — não em toda mensagem.
- Em mensagens curtas de WhatsApp, mantenha o tom Sugamele mesmo em 2-3 frases.`;

    const userPrompt = `Gere uma sequência de ${num_etapas} ações para o trigger "${trigger_tipo}".
Retorne JSON array com { tipo, template, delay_min, ia_vision?, ia_voice_response?, questioning_strategy?, timeout_min?, tag?, stop_event_type? }.`;

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
                acoes: { type: "array", items: { type: "object", properties: {
                  tipo: { type: "string", enum: ["email", "whatsapp", "telegram", "aguardar", "audio", "ia_message", "wait_reply", "qualify_lead", "notify_operator", "stop_on_event", "adicionar_tag"] },
                  template: { type: "string" },
                  delay_min: { type: "number" },
                  ia_vision: { type: "boolean" },
                  ia_voice_response: { type: "boolean" },
                  questioning_strategy: { type: "string" },
                  timeout_min: { type: "number" },
                  tag: { type: "string" },
                  stop_event_type: { type: "string" },
                }, required: ["tipo", "template", "delay_min"], additionalProperties: false } },
              },
              required: ["acoes"], additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_flow" } },
    });

    let response = await fetchAI(`${aiBaseUrl}/chat/completions`, { method: "POST", headers: makeH(aiApiKey, !isLovableModel), body: flowPayload });

    // Fallback: if Lovable gateway returns 402, retry via OpenRouter
    if (isLovableModel && response.status === 402) {
      const orKey = Deno.env.get("OPENROUTER_API_KEY");
      if (orKey) {
        console.log("Lovable gateway 402, falling back to OpenRouter (default flow)");
        response = await fetchAI("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: makeH(orKey, true), body: flowPayload });
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

async function fetchAI(url: string, init: RequestInit, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return new Response(JSON.stringify({ error: "TIMEOUT_GUARD", message: "Modelo demorou mais de 60s. Use modo background ou um modelo mais rápido (ex.: gemini-3-flash).", suggest_background: true }), {
        status: 408,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function handleAIError(response: Response) {
  const status = response.status;
  if (status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (status === 408) return new Response(JSON.stringify({ error: "Modelo demorou demais. Use background, modelo mais rápido ou reduza contexto." }), { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

  // Abort upstream calls before edge runtime's 150s IDLE_TIMEOUT to return a clear error
  const fetchWithTimeout = async (url: string, headers: Record<string, string>, timeoutMs = 60_000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { method: "POST", headers, body: payload, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/chat/completions`, makeHeaders(apiKey, isOpenRouter));
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { error: `Modelo "${model}" demorou demais (>60s). Use um modelo mais rápido (ex.: gemini-3-flash, gpt-5-mini) ou reduza o contexto.` };
    }
    throw e;
  }

  // Fallback: se Lovable gateway retornar qualquer erro (402, 401, 500, etc.), tenta OpenRouter
  if (!isOpenRouter && !response.ok) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log(`Lovable gateway error ${response.status}, falling back to OpenRouter for model:`, model);
      try {
        response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", makeHeaders(orKey, true));
      } catch (e: any) {
        if (e?.name === "AbortError") {
          return { error: `Modelo "${model}" via OpenRouter excedeu 60s. Tente um modelo mais rápido.` };
        }
        throw e;
      }
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const tc = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) {
    // Fallback: o modelo respondeu em texto (sem tool_calls) — tenta extrair JSON do conteúdo
    const textContent = result.choices?.[0]?.message?.content || "";
    console.warn(`[callAI] No tool_calls for tool "${toolName}" (model: ${model}). Attempting JSON text fallback. Content: ${textContent.slice(0, 300)}`);
    if (textContent) {
      // Tenta extrair bloco JSON da resposta em texto (```json ... ``` ou { ... } direto)
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) || textContent.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          console.log("[callAI] JSON fallback successful");
          return parsed;
        } catch (e) {
          console.error("[callAI] JSON fallback parse error:", e);
        }
      }
    }
    return null;
  }
  return JSON.parse(tc.function.arguments);
}

async function handleCopyArsenal(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "", projectData: any = {}, productIndex?: number, skillsContext = "", extraUrls: string[] = [], briefingExtra = "") {
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
    // Ad-hoc URLs vindas do modal "Gerar Arsenal"
    if (Array.isArray(extraUrls) && extraUrls.length > 0) {
      productLinks.push(...extraUrls.filter((u) => typeof u === "string" && u.trim().startsWith("http")));
    }
    console.log("Copy arsenal generated for product_index:", productIndex, "extra_urls:", extraUrls?.length || 0, "briefing_extra:", briefingExtra ? "yes" : "no");

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (firecrawlKey && productLinks.length > 0) {
      const uniqueUrls = [...new Set(productLinks)].slice(0, 3);
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
            if (md) scrapedContext += `\n### Conteúdo de ${url}:\n${md.slice(0, 2500)}\n`;
          }
        } catch (e) { console.error("Firecrawl scrape error:", e); }
      }
    }
  } catch (e) { console.error("Error preparing scrape context:", e); }

  const fullCtx = scrapedContext ? `${ctx}\n\n## Conteúdo scraped do site do produto:\n${scrapedContext}` : ctx;

  const briefingBlock = briefingExtra && briefingExtra.trim()
    ? `\n## BRIEFING DIRETO DO USUÁRIO (prioridade máxima — use isso como base):\n${briefingExtra.trim()}\n`
    : "";

  // Resolve selected product name for a more specific user prompt
  let selectedProductName = "";
  try {
    const d2 = typeof projectData?.data === "string" ? JSON.parse(projectData.data) : (projectData?.data || {});
    const prods2 = Array.isArray(d2.produtos) ? d2.produtos : [];
    if (typeof productIndex === "number" && prods2[productIndex]) {
      selectedProductName = prods2[productIndex].nome || prods2[productIndex].name || "";
    }
  } catch (_) { /* ignore */ }

  const arsenal = await callAI(
    `${mentePrefix}Você é um copywriter brasileiro de alto nível, especialista em copy de alta conversão para o mercado brasileiro.
IMPORTANTE: Você DEVE usar a função generate_copy_arsenal para retornar sua resposta. Não responda em texto livre.
${fullCtx}
${skillsContext}${briefingBlock}
REGRAS:
- Use linguagem persuasiva, emocional e direta. Seja específico para este projeto${selectedProductName ? ` e para o produto "${selectedProductName}"` : ""}.
- Gere pelo menos 3 variações para cada bloco de copy (promessa, inimigo_comum, efeito_colateral, oportunidade, metodo_simplificado, hora_do_show).
- Se houver conteúdo scraped do site, use-o para criar copy mais precisa e alinhada à página real do produto.
- Se houver BRIEFING DIRETO DO USUÁRIO, ele tem prioridade máxima sobre tudo.
- Gere também o mecanismo_unico (o que diferencia este produto de todos os outros no mercado) e o contexto (resumo estratégico do produto).
- Aplique as Skills disponíveis/ativadas para elevar a qualidade do copy: use frameworks de persuasão, gatilhos emocionais e estruturas de copy profissional.
- Mesmo com contexto limitado, gere copy baseado no nicho e tipo de produto inferido.`,
    `Gere o Arsenal de Copy completo${selectedProductName ? ` para o produto "${selectedProductName}"` : ""}, incluindo mecanismo único e contexto estratégico. Use OBRIGATORIAMENTE a função generate_copy_arsenal.`,
    apiKey, model,
    [{ type: "function", function: { name: "generate_copy_arsenal", description: "Generate copy arsenal with mecanismo and contexto", parameters: { type: "object", properties: { mecanismo_unico: { type: "string", description: "O diferencial único do produto que torna a concorrência irrelevante" }, contexto: { type: "string", description: "Resumo estratégico do produto: objetivo, posicionamento e público" }, promessa: { type: "array", items: { type: "string" } }, inimigo_comum: { type: "array", items: { type: "string" } }, efeito_colateral: { type: "array", items: { type: "string" } }, oportunidade: { type: "array", items: { type: "string" } }, metodo_simplificado: { type: "array", items: { type: "string" } }, hora_do_show: { type: "array", items: { type: "string" } } }, required: ["mecanismo_unico", "contexto", "promessa", "inimigo_comum", "efeito_colateral", "oportunidade", "metodo_simplificado", "hora_do_show"], additionalProperties: false } } }],
    "generate_copy_arsenal", baseUrl
  );
  if (arsenal instanceof Response) return arsenal;
  if (!arsenal || Object.keys(arsenal).length === 0) {
    console.error("[handleCopyArsenal] AI returned empty/null arsenal — no tool_calls. Check model tool support.");
    return new Response(
      JSON.stringify({ error: "A IA não gerou o arsenal de copy. O modelo não suportou tool_calls. Tente novamente ou use um modelo diferente." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return new Response(JSON.stringify({ arsenal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleProductIntel(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "", projectData: any = {}, productIndex?: number, skillsContext = "") {
  // Scrape product URLs to generate mecanismo, contexto, and suggested offers
  let scrapedContext = "";
  try {
    const d = typeof projectData?.data === "string" ? JSON.parse(projectData.data) : (projectData?.data || {});
    const produtos = Array.isArray(d.produtos) ? d.produtos : [];
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
    if (d.links) {
      const projLinks = Object.values(d.links).filter(v => v && String(v).trim() !== "" && String(v).startsWith("http")) as string[];
      productLinks.push(...projLinks);
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (firecrawlKey && productLinks.length > 0) {
      const uniqueUrls = [...new Set(productLinks)].slice(0, 3);
      for (const url of uniqueUrls) {
        try {
          console.log("Scraping URL for product intel:", url);
          const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
          });
          if (scrapeRes.ok) {
            const scrapeData = await scrapeRes.json();
            const md = scrapeData?.data?.markdown || scrapeData?.markdown || "";
            if (md) scrapedContext += `\n### Conteúdo de ${url}:\n${md.slice(0, 3000)}\n`;
          }
        } catch (e) { console.error("Firecrawl scrape error:", e); }
      }
    }
  } catch (e) { console.error("Error preparing scrape for product intel:", e); }

  const fullCtx = scrapedContext ? `${ctx}\n\n## Conteúdo scraped do site do produto:\n${scrapedContext}` : ctx;

  const intel = await callAI(
    `${mentePrefix}Você é um estrategista de infoprodutos brasileiro de alto nível. Analise o conteúdo do site/página de vendas e o contexto do projeto para gerar inteligência completa do produto.
${fullCtx}
${skillsContext}
REGRAS:
- Extraia o mecanismo único a partir do que está na página (o que diferencia de tudo no mercado)
- Defina o contexto estratégico do produto (para quem, que problema resolve, posicionamento)
- Sugira ofertas complementares (order bump, upsell) baseadas no que faz sentido para o produto
- Cada oferta sugerida deve ter nome, tipo, e faixa de preço sugerida
- Use dados scraped do site para ser preciso e específico`,
    "Analise a página do produto e gere mecanismo único, contexto e sugestões de ofertas.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_product_intel", description: "Generate product intelligence from page analysis", parameters: { type: "object", properties: { mecanismo: { type: "string", description: "Mecanismo único do produto" }, contexto: { type: "string", description: "Contexto estratégico completo" }, ofertas_sugeridas: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, tipo_oferta: { type: "string", enum: ["order_bump", "upsell", "downsell", "tripwire"] }, preco_sugerido: { type: "string" }, descricao: { type: "string" } }, required: ["nome", "tipo_oferta", "preco_sugerido", "descricao"], additionalProperties: false } } }, required: ["mecanismo", "contexto", "ofertas_sugeridas"], additionalProperties: false } } }],
    "generate_product_intel", baseUrl
  );
  if (intel instanceof Response) return intel;
  return new Response(JSON.stringify({ product_intel: intel }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

async function handleAvatarAngles(ctx: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "", projectData: any = {}) {
  // Extrai top 3 dores e desejos do avatar pra dar foco ao prompt
  const avatar = projectData?.avatar || {};
  const topDores = (avatar.dores || []).slice(0, 3).map((d: any) => d.descricao || d.text || "").filter(Boolean);
  const topDesejos = (avatar.desejos || []).slice(0, 3).map((d: any) => d.descricao || d.text || "").filter(Boolean);
  const focus = `\n\nTOP 3 DORES:\n- ${topDores.join("\n- ") || "(usar avatar do contexto)"}\n\nTOP 3 DESEJOS:\n- ${topDesejos.join("\n- ") || "(usar avatar do contexto)"}\n`;

  const angles = await callAI(
    `${mentePrefix}Você é um copywriter de resposta direta brasileiro. Seu trabalho é SELECIONAR ângulos do catálogo canônico abaixo (NÃO invente novos) e adaptá-los para o avatar.\n${ctx}${focus}${anglesCatalogBlock()}${qualityChecklistBlock()}\nEscolha 5 ângulos do catálogo diversificando a emoção dominante. Para cada um, escreva UMA headline pronta de anúncio (até 140 chars) derivada de UMA dor ou desejo específico.`,
    "Selecione 5 ângulos do catálogo e escreva a headline de cada um.",
    apiKey, model,
    [{ type: "function", function: { name: "generate_avatar_angles", description: "Select 5 attack angles from the canonical catalog", parameters: { type: "object", properties: { angulos: { type: "array", items: { type: "object", properties: { slug: { type: "string", enum: ALL_SLUGS, description: "Slug do ângulo escolhido no catálogo" }, categoria: { type: "string", description: "Origem no avatar (ex: Dor #1, Desejo #2)" }, texto: { type: "string", description: "Headline pronta de até 140 caracteres" }, gancho_emocional: { type: "string" } }, required: ["slug", "categoria", "texto", "gancho_emocional"], additionalProperties: false } } }, required: ["angulos"], additionalProperties: false } } }],
    "generate_avatar_angles", baseUrl
  );
  if (angles instanceof Response) return angles;
  // Adapta {texto} -> {headline/corpo/cta} para reaproveitar o validator
  const asAngleOut = (angles.angulos || []).map((a: any) => ({
    slug: a.slug,
    headline: a.texto || "",
    corpo: a.gancho_emocional || a.categoria || "",
    cta: "saiba mais",
    categoria: a.categoria,
    gancho_emocional: a.gancho_emocional,
    texto: a.texto,
  }));
  const { angles: clean, drops } = validateAndFixAngles(asAngleOut, { min: 3, seed: "avatar-angles" });
  if (drops.length) console.warn("[handleAvatarAngles] saneados:", drops);
  const hydrated = { angulos: clean.map((a: any) => ({ ...a, nome: a.nome, emocao: a.emocao_dominante, estrutura: ANGLE_BY_SLUG[a.slug]?.estrutura })) };
  return new Response(JSON.stringify({ angles: hydrated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

async function handleMarketIntelResearch(body: any, sb: any, projectContext: string, skillsContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "", projectData: any = {}) {
  const { mode = "DISCOVERY", search_query, deep_dive_target } = body;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

  // Extract nicho from project context
  const d = typeof projectData?.data === "string" ? JSON.parse(projectData.data) : (projectData?.data || {});
  const briefing = d.briefing || {};
  const nicho = search_query || briefing.nicho || briefing.sub_nicho || projectData?.name || "";

  // Step 1: Use Firecrawl Search to find real products in the niche
  let searchResults = "";
  const scraped: { url: string; title: string; content: string }[] = [];

  if (firecrawlKey && nicho) {
    // Build queries based on mode
    let searchQueries: string[] = [];

    if (mode === "DEEP_DIVE" && deep_dive_target) {
      // Deep dive into specific micro-niche/offer
      searchQueries = [
        `"${deep_dive_target}" infoproduto curso hotmart kiwify eduzz 2025 2026`,
        `"${deep_dive_target}" página vendas checkout oferta funil`,
        `"${deep_dive_target}" depoimento resultado aluno case`,
        `"${deep_dive_target}" concorrente alternativa similar`,
        `"${deep_dive_target}" preço ticket plano assinatura`,
      ];
    } else if (mode === "TREND_SCAN") {
      // Multi-niche trend scanning
      const nichos = nicho.split(",").map((n: string) => n.trim()).filter(Boolean);
      for (const n of nichos.slice(0, 3)) {
        searchQueries.push(
          `${n} tendência 2025 2026 infoproduto digital crescimento`,
          `${n} micro nicho inexplorado oportunidade 2026 2027`,
          `${n} mercado brasileiro emergente sem rosto faceless`,
        );
      }
    } else {
      // Standard DISCOVERY mode with trend focus
      searchQueries = [
        `${nicho} infoproduto curso online hotmart kiwify 2025 2026`,
        `${nicho} método curso digital resultado depoimento tendência`,
        `${nicho} página de vendas oferta checkout funil`,
        `${nicho} micro nicho emergente oportunidade 2026 2027`,
        `${nicho} mercado digital tendência previsão crescimento`,
      ];
    }

    for (const query of searchQueries) {
      try {
        console.log("Firecrawl search for market intel:", query);
        const searchRes = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit: 5, lang: "pt-br", country: "BR", scrapeOptions: { formats: ["markdown"] } }),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData?.data || [];
          for (const r of results) {
            if (r.url && r.markdown) {
              scraped.push({ url: r.url, title: r.title || r.url, content: r.markdown.slice(0, 2000) });
            } else if (r.url && r.title) {
              scraped.push({ url: r.url, title: r.title, content: r.description || "" });
            }
          }
        }
      } catch (e) { console.error("Firecrawl search error:", e); }
    }

    if (scraped.length > 0) {
      searchResults = "\n\n## RESULTADOS REAIS DE PESQUISA WEB:\n";
      for (const s of scraped.slice(0, 12)) {
        searchResults += `\n### ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 1500)}\n---\n`;
      }
    }
  }

  // Step 2: Get market-intel skill prompt from DB
  let skillPrompt = "";
  try {
    const { data: skill } = await sb.from("imphq_skills").select("system_prompt").eq("slug", "market-intel").eq("status", "Ativa").limit(1);
    if (skill?.[0]?.system_prompt) skillPrompt = skill[0].system_prompt.slice(0, 4000);
  } catch (e) { console.error("Error fetching market-intel skill:", e); }

  const fullSystem = `${mentePrefix}${skillPrompt || "Você é um analista de inteligência de mercado para infoprodutos brasileiros."}

## CONTEXTO DO PROJETO
${projectContext}
${skillsContext}
${searchResults}

## MODO DE OPERAÇÃO: ${mode}
## NICHO/BUSCA: ${nicho}
${mode === "DEEP_DIVE" ? `## ALVO DO DEEP DIVE: ${deep_dive_target}\nFaça uma análise PROFUNDA deste micro-nicho/oferta específica. Detalhe:\n- Concorrentes diretos e indiretos\n- Ticket médio e variações de preço\n- Order bumps e upsells usados\n- Mecanismos únicos encontrados\n- Ângulos de copy que convertem\n- Gaps e oportunidades inexploradas\n- Público exato (idade, dor, situação)\n- Facilidade de entrada e barreiras\n- Veredicto: entrar ou não entrar (e por quê)` : ""}
${mode === "TREND_SCAN" ? `## VARREDURA DE TENDÊNCIAS 2025-2027\nFoco em:\n- O que está crescendo AGORA (2025-2026)\n- Micro-nichos emergentes com pouca concorrência\n- Previsões para 2027 baseadas nos padrões atuais\n- Nichos que estão saturando vs. nichos nascendo\n- Oportunidades "sem rosto" / faceless` : ""}

REGRAS CRÍTICAS:
- Analise TODOS os resultados de pesquisa web acima com profundidade
- Para cada produto/oferta encontrada, extraia: nome, nicho, ticket, bump, upsell, mecanismo único, ângulo de copy, promessa central, plataforma
- Gere um SCORE de 1 a 10 para cada oportunidade baseado em: demanda comprovada, concorrência, ticket, potencial sem rosto, facilidade de criação
- Identifique gaps e oportunidades que ninguém está explorando
- Sugira produtos promissores com detalhes concretos (nome, ticket, formato, copy angle)
- Use os dados REAIS encontrados na pesquisa, não invente
- Seja extremamente detalhado e específico
- Inclua TENDÊNCIAS para 2025, 2026 e previsões 2027`;

  const userMsg = mode === "DEEP_DIVE"
    ? `Faça um DEEP DIVE completo no micro-nicho/oferta "${deep_dive_target}" dentro do contexto "${nicho}". Quero uma análise profunda para tomada de decisão: devo entrar nesse micro-nicho? Quais são os riscos, oportunidades e o melhor ângulo de entrada?`
    : mode === "TREND_SCAN"
    ? `Execute uma varredura de tendências 2025-2027 nos nichos: "${nicho}". Identifique micro-nichos emergentes, oportunidades inexploradas, e gere recomendações detalhadas para cada um.`
    : `Execute a pesquisa de mercado completa no modo ${mode} para "${nicho}". 
Analise os resultados da web, identifique os produtos que estão vendendo, seus funis, tickets, e gere recomendações detalhadas de oportunidades. Foque em tendências 2025-2027.
Retorne a análise completa via tool call.`;

  const intel = await callAI(
    fullSystem, userMsg, apiKey, model,
    [{
      type: "function",
      function: {
        name: "market_intel_report",
        description: "Generate complete market intelligence report with real product data",
        parameters: {
          type: "object",
          properties: {
            resumo_executivo: { type: "string", description: "Resumo geral do mercado pesquisado" },
            produtos_encontrados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  url: { type: "string" },
                  nicho: { type: "string" },
                  sub_nicho: { type: "string" },
                  ticket: { type: "string" },
                  bump: { type: "string" },
                  upsell: { type: "string" },
                  plataforma: { type: "string" },
                  mecanismo_unico: { type: "string" },
                  angulo_copy: { type: "string" },
                  promessa: { type: "string" },
                  score: { type: "number" },
                  sem_rosto: { type: "boolean" },
                  observacoes: { type: "string" },
                },
                required: ["nome", "nicho", "score"],
                additionalProperties: false,
              },
            },
            oportunidades: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome_sugerido: { type: "string" },
                  nicho: { type: "string" },
                  sub_nicho: { type: "string" },
                  micro_nicho: { type: "string" },
                  dor_central: { type: "string" },
                  ticket_sugerido: { type: "string" },
                  bump_sugerido: { type: "string" },
                  upsell_sugerido: { type: "string" },
                  formato: { type: "string" },
                  mecanismo_unico: { type: "string" },
                  angulo_copy: { type: "string" },
                  sem_rosto: { type: "boolean" },
                  score: { type: "number" },
                  justificativa: { type: "string" },
                },
                required: ["nome_sugerido", "nicho", "dor_central", "score"],
                additionalProperties: false,
              },
            },
            angulos_recomendados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  angulo: { type: "string" },
                  hook_exemplo: { type: "string" },
                  headline_vsl: { type: "string" },
                  ctr_esperado: { type: "string" },
                  melhor_para: { type: "string" },
                },
                required: ["angulo", "hook_exemplo"],
                additionalProperties: false,
              },
            },
            gaps_mercado: { type: "array", items: { type: "string" } },
            tendencias: { type: "array", items: { type: "string" } },
            analise_markdown: { type: "string", description: "Análise completa em markdown para exibição" },
          },
          required: ["resumo_executivo", "produtos_encontrados", "oportunidades", "analise_markdown"],
          additionalProperties: false,
        },
      },
    }],
    "market_intel_report", baseUrl
  );

  if (intel instanceof Response) return intel;

  // Auto-save opportunities to DB
  const project_id = body.project_id;
  if (project_id && intel.oportunidades && Array.isArray(intel.oportunidades)) {
    try {
      for (const opp of intel.oportunidades.slice(0, 10)) {
        await sb.from("imphq_mi_opportunities").upsert({
          nicho: opp.nicho || nicho,
          sub_nicho: opp.sub_nicho || opp.micro_nicho || null,
          produto: opp.nome_sugerido,
          score: opp.score || 7,
          ticket: opp.ticket_sugerido ? parseFloat(opp.ticket_sugerido.replace(/[^\d.]/g, "")) || null : null,
          plataforma: opp.formato || null,
          sem_rosto: opp.sem_rosto || false,
          flags: [opp.angulo_copy, opp.mecanismo_unico].filter(Boolean),
        }, { onConflict: "id" });
      }
    } catch (e) { console.error("Error saving opportunities:", e); }
  }

  // Save full result to project
  if (project_id) {
    try {
      const { data: proj } = await sb.from("imphq_projects").select("data").eq("id", project_id).single();
      const currentData = (proj?.data as Record<string, any>) || {};
      await sb.from("imphq_projects").update({
        data: {
          ...currentData,
          ai_market_intel: intel.analise_markdown || JSON.stringify(intel),
          ai_market_intel_data: {
            produtos: intel.produtos_encontrados,
            oportunidades: intel.oportunidades,
            angulos: intel.angulos_recomendados,
            gaps: intel.gaps_mercado,
            tendencias: intel.tendencias,
            resumo: intel.resumo_executivo,
            updated_at: new Date().toISOString(),
          },
        },
      }).eq("id", project_id);
    } catch (e) { console.error("Error saving market intel to project:", e); }
  }

  return new Response(JSON.stringify({ intel }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleRefineSkill(body: any, sb: any, apiKey: string, model: string, baseUrl: string) {
  const { skill_id } = body;
  if (!skill_id) throw new Error("skill_id obrigatório");

  // 1. Busca a skill
  const { data: skill, error: skillErr } = await sb
    .from("imphq_skills")
    .select("*")
    .eq("id", skill_id)
    .single();

  if (skillErr || !skill) throw new Error(`Skill ${skill_id} não encontrada`);

  // 2. Busca feedbacks não refinados (limitamos a 30 por segurança)
  const { data: outputs, error: outErr } = await sb
    .from("imphq_skill_outputs")
    .select("id, result, extra_instructions, feedback, feedback_correction")
    .eq("skill_id", skill_id)
    .not("feedback", "is", null)
    .eq("refined", false)
    .limit(30);

  if (outErr) throw outErr;
  if (!outputs || outputs.length < 20) {
    return new Response(JSON.stringify({ ok: true, skipped: "not_enough_feedbacks", count: outputs?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 3. Monta o relatório de feedbacks para a IA
  const feedbackReport = outputs.map((out: any, idx: number) => {
    return `Execução #${idx + 1}:
- Instruções Extras: "${out.extra_instructions || 'Nenhuma'}"
- Avaliação: ${out.feedback === 'thumbs_up' ? '👍 APROVADO' : '👎 REPROVADO'}
- Correção do usuário: "${out.feedback_correction || 'Nenhuma'}"
- Output Gerado (resumo): "${out.result.slice(0, 400)}..."`;
  }).join("\n\n");

  const systemPrompt = `Você é um engenheiro de prompts especialista em otimização contínua de IA.
Seu objetivo é analisar o System Prompt atual de uma skill de marketing/código e refinar esse prompt com base em 20+ avaliações reais de usuários.

System Prompt Atual:
\`\`\`markdown
${skill.system_prompt}
\`\`\`

Feedbacks e Avaliações Recentes dos Usuários:
${feedbackReport}

Instruções de Refinamento:
1. Identifique os padrões nos feedbacks reprovados (👎). O que a IA errou? (ex: tom formal demais, faltou focar na dor, ignorou instrução X).
2. Identifique os padrões nos feedbacks aprovados (👍). O que funcionou bem?
3. Crie uma versão otimizada do System Prompt que corrija os erros apontados e reforce as qualidades.
4. Mantenha a mesma estrutura básica (markdown) do prompt original.
5. Retorne um objeto JSON contendo:
   - "analise": resumo curto da análise dos feedbacks.
   - "prompt_refinado": o novo prompt do sistema completo em markdown.`;

  const orRes = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://imperiox.lovable.app",
      "X-Title": "Imperio HQ",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro" || "openai/gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Refine o prompt com base na análise e retorne o JSON solicitado." }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!orRes.ok) {
    const err = await orRes.text();
    throw new Error(`OpenRouter falhou no refinamento: ${orRes.status} ${err}`);
  }

  const orData = await orRes.json();
  const resObj = JSON.parse(orData?.choices?.[0]?.message?.content || "{}");
  const refinedPrompt = resObj.prompt_refinado;
  const analise = resObj.analise || "Refinamento automático baseado em feedback.";

  if (!refinedPrompt) throw new Error("Refined prompt not generated by AI");

  // 4. Incrementa versão da skill
  let currentVersion = skill.versao || "V1.0";
  let nextVersion = "V1.1";
  const verMatch = currentVersion.match(/V(\d+)\.(\d+)/i);
  if (verMatch) {
    const major = parseInt(verMatch[1]);
    const minor = parseInt(verMatch[2]);
    nextVersion = `V${major}.${minor + 1}`;
  }

  // 5. Salva a nova versão na skill
  await sb.from("imphq_skills")
    .update({
      system_prompt: refinedPrompt,
      versao: nextVersion,
      updated_at: new Date().toISOString()
    })
    .eq("id", skill_id);

  // 6. Marca os outputs como refinados
  const outputIds = outputs.map((out: any) => out.id);
  await sb.from("imphq_skill_outputs")
    .update({ refined: true })
    .in("id", outputIds);

  // 7. Cria ação no painel Imperius
  await sb.from("imphq_ai_actions").insert({
    kind: "notify",
    risk_level: "low",
    confidence: 1.0,
    title: `🤖 Skill "${skill.nome}" evoluiu para ${nextVersion}!`,
    reason: `Prompt refinado automaticamente após 20 avaliações de usuário. Análise: ${analise}`,
    payload: {
      skill_id,
      old_version: currentVersion,
      new_version: nextVersion,
      analise,
      changes: "Prompt refinado com sucesso"
    },
    projeto_id: skill.project_id || null,
    source: "skill-refiner",
    status: "executed",
    auto_executed: true,
    executed_at: new Date().toISOString()
  });

  return new Response(JSON.stringify({ ok: true, refined: true, nextVersion, analise }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
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
    // First try exact slug match
    const { data: bySlug } = await sb.from("imphq_skills").select("system_prompt, categoria, nome")
      .eq("status", "Ativa").not("system_prompt", "is", null)
      .eq("slug", skill_slug).limit(1);
    if (bySlug?.[0]?.system_prompt) { systemPrompt = bySlug[0].system_prompt; skillCategoria = bySlug[0].categoria || ""; }
    // Fallback to nome partial match
    if (!systemPrompt) {
      const { data: byNome } = await sb.from("imphq_skills").select("system_prompt, categoria, nome")
        .eq("status", "Ativa").not("system_prompt", "is", null)
        .ilike("nome", `%${skill_slug}%`).limit(1);
      if (byNome?.[0]?.system_prompt) { systemPrompt = byNome[0].system_prompt; skillCategoria = byNome[0].categoria || ""; }
    }
  }
  if (!systemPrompt) {
    console.warn(`[execute_skill] Skill not found: id=${skill_id} slug=${skill_slug}. Using fallback.`);
    systemPrompt = "Você é um especialista em marketing digital, copy e infoprodutos. Gere conteúdo de alta qualidade baseado no contexto do projeto.";
  }

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

  let response = await fetchAI(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: skillPayload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log("Lovable gateway 402, falling back to OpenRouter (skill)");
      response = await fetchAI("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: skillPayload });
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

  let response = await fetchAI(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: payload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log("Lovable gateway 402, falling back to OpenRouter (generate_content)");
      response = await fetchAI("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: payload });
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
  const { project_id, user_prompt, objective, campaign_count, funnel_stage, budget_range, previous_result } = body;
  const numCampaigns = Math.min(campaign_count || 3, 5);

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

  // Previous result for refinement
  let prevContext = "";
  if (previous_result) prevContext = "\n## Resultado anterior (para refinar):\n" + previous_result.slice(0, 3000);

  const objectiveLabels: Record<string, string> = {
    conversao: "Conversão (vendas diretas)",
    leads: "Geração de Leads",
    trafego: "Tráfego para página",
    alcance: "Alcance e reconhecimento",
    engajamento: "Engajamento social",
    retargeting: "Retargeting de visitantes/compradores",
  };
  const objectiveLabel = objectiveLabels[objective] || "Conversão";

  const funnelLabels: Record<string, string> = {
    topo: "Topo de funil (Awareness) — público frio, ainda não conhece a marca",
    meio: "Meio de funil (Consideração) — público morno, já demonstrou interesse",
    fundo: "Fundo de funil (Decisão) — público quente, pronto para comprar",
    retencao: "Retenção/Upsell — clientes existentes",
    todas: "Todas as etapas do funil",
  };
  const funnelLabel = funnelLabels[funnel_stage] || "Todas";

  const systemPrompt = `Você é um media buyer brasileiro de ALTO nível, especialista em Meta Ads (Facebook/Instagram) com experiência em escalar campanhas de infoprodutos e e-commerce.

${projectContext}${adsContext}${creativesContext}${copyContext}${prevContext}

## PARÂMETROS DO PEDIDO:
- Objetivo principal: ${objectiveLabel}
- Etapa do funil: ${funnelLabel}
- Quantidade de campanhas: ${numCampaigns}
${budget_range ? `- Range de budget diário: ${budget_range}` : "- Budget: sugerir baseado no contexto"}

## REGRAS OBRIGATÓRIAS:
1. Gere EXATAMENTE ${numCampaigns} campanhas distintas e complementares
2. Cada campanha deve ter pelo menos 2 variações de copy (headline + texto primário + CTA)
3. Sugira conjuntos de anúncios com segmentação detalhada
4. Para retargeting: especifique janelas de tempo (7d, 14d, 30d visitantes)
5. Use a linguagem e tom do projeto/avatar
6. Sugira públicos baseados no avatar e dados históricos
7. Considere dados de performance anteriores para otimizar
8. Inclua sugestão de criativo visual detalhada (formato, cores, elementos, estilo)
9. Justifique cada decisão estratégica`;

  const userMsg = user_prompt || `Gere ${numCampaigns} campanhas de ${objectiveLabel.toLowerCase()} otimizadas para este projeto.`;

  const campaigns = await callAI(systemPrompt, userMsg, apiKey, model,
    [{ type: "function", function: { name: "generate_campaign_drafts", description: "Generate campaign drafts", parameters: { type: "object", properties: {
      campaigns: { type: "array", items: { type: "object", properties: {
        nome: { type: "string", description: "Nome da campanha" },
        objetivo: { type: "string", enum: ["conversao", "trafego", "leads", "alcance", "engajamento", "retargeting"] },
        etapa_funil: { type: "string", enum: ["topo", "meio", "fundo", "retencao"], description: "Etapa do funil" },
        budget_diario: { type: "number" },
        publico: { type: "object", properties: {
          idade_min: { type: "number" }, idade_max: { type: "number" },
          genero: { type: "string", enum: ["todos", "masculino", "feminino"] },
          interesses: { type: "array", items: { type: "string" } },
          exclusoes: { type: "array", items: { type: "string" } },
          lookalike: { type: "string", description: "Sugestão de público lookalike, se aplicável" },
          retargeting: { type: "string", description: "Janela e critério de retargeting, se aplicável" },
        }, required: ["idade_min", "idade_max", "genero", "interesses"], additionalProperties: false },
        conjuntos: { type: "array", items: { type: "object", properties: {
          nome: { type: "string", description: "Nome do conjunto de anúncios" },
          segmentacao: { type: "string", description: "Descrição da segmentação" },
          posicionamento: { type: "string", description: "Feed, Stories, Reels, Automático, etc." },
        }, required: ["nome", "segmentacao"], additionalProperties: false }, description: "Conjuntos de anúncios sugeridos" },
        copies: { type: "array", items: { type: "object", properties: {
          headline: { type: "string" },
          texto_primario: { type: "string" },
          descricao: { type: "string", description: "Descrição/link description do anúncio" },
          cta: { type: "string" },
        }, required: ["headline", "texto_primario", "cta"], additionalProperties: false } },
        sugestao_criativo: { type: "string", description: "Descrição detalhada do criativo visual (formato, estilo, cores, elementos)" },
        justificativa: { type: "string", description: "Por que esta campanha vai funcionar para este projeto" },
      }, required: ["nome", "objetivo", "etapa_funil", "budget_diario", "publico", "copies", "sugestao_criativo", "justificativa"], additionalProperties: false } },
      resumo_estrategico: { type: "string", description: "Visão geral da estratégia e como as campanhas se complementam" },
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
  const storiesPerDay = body.stories_per_day || 0;
  const skillSlugsUsed = body.skill_slugs || [];

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
- STORIES: ${storiesPerDay > 0 ? `inclua EXATAMENTE ${storiesPerDay} Stories SEQUENCIAIS por dia com narrativa encadeada (bastidores, enquetes, CTA, quicktips, caixinha de perguntas). Cada story deve conectar ao anterior formando uma mini-série diária.` : "inclua 1-2 Stories por dia (bastidores, enquetes, CTA, quicktips, caixinha de perguntas)"}
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

  let response = await fetchAI(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: payload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      response = await fetchAI("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: payload });
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
  let otherStepsContext = "";
  if (campaign_id) {
    const [campRes, otherStepsRes] = await Promise.all([
      sb.from("imphq_wa_campaigns").select("name, produto").eq("id", campaign_id).maybeSingle(),
      sb.from("imphq_wa_campaign_steps").select("step_order, content, media_type").eq("campaign_id", campaign_id).order("step_order", { ascending: true })
    ]);
    const camp = campRes.data;
    if (camp) {
      campaignName = camp.name || "";
      if (!produto && camp.produto) body.produto_fallback = camp.produto;
    }
    const otherSteps = otherStepsRes.data;
    if (otherSteps && otherSteps.length > 0) {
      otherStepsContext = "\n## Mensagens existentes nesta sequência (leia atentamente para garantir coesão e evitar repetição):\n";
      otherSteps.forEach((s: any) => {
        const isCurrent = s.step_order === step_order;
        otherStepsContext += `### Passo #${s.step_order + 1} (${s.media_type}) ${isCurrent ? "[ESTA ETAPA - GERANDO AGORA]" : ""}\n`;
        if (isCurrent) {
          otherStepsContext += `(Você deve gerar o texto para esta etapa agora, garantindo perfeita continuidade com as anteriores e posteriores)\n\n`;
        } else {
          otherStepsContext += `Texto: "${s.content || "(vazia)"}"\n\n`;
        }
      });
    }
  }

  const produtoFinal = produto || body.produto_fallback || "";
  const mediaLabel = media_type === "text" ? "mensagem de texto" : media_type === "image" ? "mensagem com imagem (gere o texto/caption)" : media_type === "audio" ? "roteiro de áudio" : media_type === "video" ? "roteiro de vídeo" : "mensagem";

  const systemPrompt = `${mentePrefix}Você é um copywriter de elite especialista em WhatsApp Marketing.
Seu objetivo é criar a mensagem do Passo ${(step_order || 0) + 1} da sequência.

## IMPORTANTE: COESÃO E SEQUÊNCIA NARRATIVA
Para esta mensagem fazer sentido, ela deve ser uma CONTINUAÇÃO direta e complementar das mensagens anteriores da sequência, e antecipar as mensagens seguintes (se houver).
NUNCA repita apresentações, saudações de boas-vindas, ganchos ou explicações se elas já foram feitas nas mensagens anteriores!

Abaixo está a lista completa de todas as mensagens cadastradas nesta campanha. O seu passo está claramente marcado como [ESTA ETAPA - GERANDO AGORA].
Use este contexto para fazer uma transição suave e focar em novos pontos de copy, prova social ou quebra de objeções específicos para o momento da sequência.

${otherStepsContext}

## Informações do Produto & Projeto
- Campanha: ${campaignName}
- Produto: ${produtoFinal || "não especificado"}
- Tipo de mídia a gerar: ${media_type}

${projectContext}

REGRAS DE CONTEÚDO E ESCRITA:
- Idioma: Português brasileiro conversacional, direto, sem jargões corporativos exagerados.
- Use emojis com inteligência e moderação (apenas no início de ganchos ou CTAs).
- Inclua variáveis como {{nome}}, {{link}}, {{produto}}, {{valor}} onde se encaixar perfeitamente.
- Se for a primeira etapa (Passo 1), faça um gancho forte ou saudação inicial.
- Se for uma etapa intermediária, traga valor, prova social, storytelling ou quebre objeções.
- Se for a última etapa da sequência, faça um fechamento com oferta direta, CTA explícito e senso de urgência/escassez.
- Formate o texto para WhatsApp: use *negrito* para destacar palavras-chave, _itálico_ para termos específicos ou ênfase. Não use títulos em markdown (#).
- Retorne APENAS o texto final da mensagem, sem introduções, notas ou explicações extras.`;

  const userPrompt = `Gere a mensagem para a etapa ${(step_order || 0) + 1} de ${total_steps || "?"} da campanha "${campaignName}" sobre o produto "${produtoFinal}". Tipo: ${mediaLabel}.`;

  const isOpenRouter = baseUrl.includes("openrouter.ai");
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (isOpenRouter) { headers["HTTP-Referer"] = "https://imperiox.lovable.app"; headers["X-Title"] = "ImperioHQ"; }

  let response = await fetchAI(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
  });

  if (!isOpenRouter && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      const orHeaders: Record<string, string> = { Authorization: `Bearer ${orKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://imperiox.lovable.app", "X-Title": "ImperioHQ" };
      response = await fetchAI("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: orHeaders, body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }) });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleContentPack(body: any, projectContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const { content_type, trigger, custom_prompt, funnel_stage } = body;
  const stageGuidance: Record<string, string> = {
    topo: "ESTÁGIO: TOPO DO FUNIL (Awareness). Foco: atrair atenção, educar sobre o problema, gerar curiosidade. NÃO venda diretamente — desperte interesse.",
    meio: "ESTÁGIO: MEIO DO FUNIL (Consideração). Foco: nutrir o lead, mostrar autoridade, comparar soluções, gerar desejo. CTA suave para próximo passo.",
    fundo: "ESTÁGIO: FUNDO DO FUNIL (Decisão). Foco: converter, quebrar objeções, urgência real, prova social forte, CTA direto de compra.",
  };
  const stageNote = funnel_stage ? `\n\n🎯 ${stageGuidance[funnel_stage] || ""}` : "";

  const typePrompts: Record<string, string> = {
    recovery_email: `Gere 3 variações de EMAIL DE RECUPERAÇÃO para o gatilho "${trigger}".
Para cada variação inclua: Assunto (subject), Preview text, Corpo do email (com formatação), CTA.
Use urgência real, dados do projeto e personalização com {{nome}}, {{produto}}, {{link_checkout}}.
Variação 1: Tom urgente. Variação 2: Tom empático. Variação 3: Tom de escassez.`,

    ad_copy: `Gere 4 variações de COPY DE ANÚNCIO (Facebook/Instagram Ads) para o contexto "${trigger}".
Para cada variação: Headline (máx 40 chars), Texto principal (máx 125 chars para feed), Descrição do link, CTA.
Variação 1: Curiosidade. Variação 2: Prova social. Variação 3: Dor/Agitação. Variação 4: Benefício direto.
Inclua sugestões de criativo (imagem/vídeo) para cada.`,

    video_script: `Gere 2 ROTEIROS DE VÍDEO CURTO (Reels/TikTok, 30-60 seg) para o contexto "${trigger}".
Para cada roteiro: Hook (3 seg), Desenvolvimento (20-40 seg), CTA (5 seg).
Inclua: texto na tela, instruções de gravação, tom sugerido.
Roteiro 1: Storytelling pessoal. Roteiro 2: Educacional rápido.`,

    whatsapp_sequence: `Gere uma SEQUÊNCIA DE 5 MENSAGENS WHATSAPP para o gatilho "${trigger}".
Para cada mensagem: Texto (máx 300 chars), Delay recomendado, Tipo (texto/áudio/imagem).
Use variáveis {{nome}}, {{produto}}, {{link}}, {{valor}}. Tom conversacional e informal.
Msg 1: Imediata. Msg 2: +2h. Msg 3: +24h. Msg 4: +48h. Msg 5: +72h.`,

    email_sequence: `Gere uma SEQUÊNCIA DE 5 EMAILS para o gatilho "${trigger}".
Para cada email: Assunto, Preview, Corpo formatado, Delay.
Email 1: Boas-vindas/Urgência. Email 2: Autoridade. Email 3: Prova social. Email 4: Objeções. Email 5: Última chance.`,

    sales_page_blocks: `Gere BLOCOS DE PÁGINA DE VENDAS para o contexto "${trigger}".
Inclua: 5 Headlines (variações), 10 Bullet points de benefício, 3 CTAs, Seção de prova social, Seção FAQ (5 perguntas), Garantia.
Use gatilhos emocionais alinhados ao avatar.`,

    reels_viral: `Gere 3 ROTEIROS VIRAIS DE REELS (15-60 seg) para o contexto "${trigger}", usando estruturas testadas das categorias: Dica Direta, Esquema, Passo a Passo, React, Antes/Depois e Provocação.

Para cada roteiro, retorne:
**Roteiro [N] — [Categoria] — [Nome da Estrutura]**
- 🎯 Hook (0-3s): frase de impacto que para o scroll
- 📜 Desenvolvimento (3-45s): aplique a estrutura escolhida preenchendo TODOS os [colchetes] com contexto REAL do projeto (avatar, dores, produto, mecanismo único)
- 🎬 CTA (últimos 5s): comando claro (comenta, salva, segue, link bio)
- 📝 Texto na tela: legendas curtas para cada cena
- 🎥 Direção: como gravar (close, plano médio, B-roll), tom de voz, ritmo
- #️⃣ 5 hashtags estratégicas

REGRAS CRÍTICAS:
- NUNCA deixe [colchetes] sem preencher — use sempre dados reais do projeto
- Tom: nativo do TikTok/Reels, conversacional, sem "marketês"
- Cada roteiro deve usar uma CATEGORIA DIFERENTE para diversificar
- Inclua quebras de padrão a cada 5-7s para reter audiência`,
  };

  const systemPrompt = `${mentePrefix}Você é um copywriter e estrategista de conteúdo brasileiro de ELITE.
Especialista em marketing digital, funis de vendas e persuasão avançada.
${projectContext}
REGRAS ABSOLUTAS:
- Use TODOS os dados do projeto (briefing, avatar, branding, produtos, KPIs) para personalizar
- Linguagem persuasiva em português brasileiro
- Inclua variáveis dinâmicas ({{nome}}, {{produto}}, {{link}}) onde aplicável
- Formate com Markdown (headers, bullets, negrito) para fácil leitura
- Seja específico — NUNCA genérico
${custom_prompt ? `\nINSTRUÇÕES EXTRAS DO USUÁRIO: ${custom_prompt}` : ""}${stageNote}`;

  const userPrompt = typePrompts[content_type] || `Gere conteúdo do tipo "${content_type}" para o gatilho "${trigger}".`;

  const isOR = baseUrl.includes("openrouter.ai");
  const mkH = (key: string, or: boolean): Record<string, string> => {
    const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (or) { h["HTTP-Referer"] = "https://imperiox.lovable.app"; h["X-Title"] = "ImperioHQ"; }
    return h;
  };
  const payload = JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] });

  let response = await fetchAI(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: payload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log("Lovable gateway 402, falling back to OpenRouter (content_pack)");
      response = await fetchAI("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: payload });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({ result: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleOrganizeFunnel(body: any, projectContext: string, skillsContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix: string) {
  const { extra } = body;
  const products = extra?.products || [];
  const projectName = extra?.project_name || "";
  const nicho = extra?.nicho || "";
  const existingEtapas = extra?.existing_etapas || [];

  const systemPrompt = `${mentePrefix}Você é um estrategista de funis de marketing digital brasileiro, especialista em escadas de valor e arquitetura de funis de alta conversão.

${projectContext}
${skillsContext}

## SUA MISSÃO
Organize um funil de vendas completo e estratégico baseado nos produtos e dados do projeto.

## REGRAS DE ORGANIZAÇÃO
1. SEMPRE comece com etapas de aquisição (anúncio/criativo → página de captura)
2. Organize produtos na ordem correta da escada de valor: Tripwire → Produto Principal → Order Bump → Upsell → Downsell
3. Inclua etapas de nutrição quando relevante (email, WhatsApp)
4. Posicione visualmente em LINHAS (rows) usando pos_x e pos_y:
   - Linha de Aquisição (y=80): Anúncios, Landing Pages
   - Linha de Conversão (y=400): Checkout, Produtos principais
   - Linha de Maximização (y=720): Upsells, Order Bumps, Downsells
   - Linha de Retenção (y=1040): Email, WhatsApp, Remarketing
5. Espaçamento horizontal: 320px entre etapas na mesma linha
6. connects_to deve formar um fluxo lógico (indices 0-based)
7. Tipos válidos: criativo, pagina, vsl, checkout, upsell, face_ads, instagram, email, whatsapp, outro
8. Inclua URLs dos produtos quando disponíveis
9. Adicione descrições estratégicas explicando o propósito de cada etapa`;

  const userPrompt = `Projeto: ${projectName}
Nicho: ${nicho}
Produtos disponíveis: ${JSON.stringify(products)}
${existingEtapas.length > 0 ? `Etapas existentes (reorganize): ${JSON.stringify(existingEtapas.map((e: any) => ({ nome: e.nome, tipo: e.tipo })))}` : "Crie um funil do zero."}

Organize o funil completo com todas as etapas necessárias.`;

  const isOR = baseUrl.includes("openrouter.ai");
  const mkH = (key: string, or: boolean): Record<string, string> => {
    const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (or) { h["HTTP-Referer"] = "https://imperiox.lovable.app"; h["X-Title"] = "ImperioHQ"; }
    return h;
  };

  const payload = JSON.stringify({
    model,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    tools: [{
      type: "function",
      function: {
        name: "organize_funnel",
        description: "Organize funnel stages strategically",
        parameters: {
          type: "object",
          properties: {
            etapas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string", description: "Nome da etapa" },
                  tipo: { type: "string", enum: ["criativo", "pagina", "vsl", "checkout", "upsell", "face_ads", "instagram", "tiktok", "email", "whatsapp", "blog", "outro"] },
                  url: { type: "string", description: "URL da etapa (checkout, página, etc)" },
                  descricao: { type: "string", description: "Descrição estratégica da etapa" },
                  pos_x: { type: "number", description: "Posição X no canvas (multiplo de 320)" },
                  pos_y: { type: "number", description: "Posição Y no canvas (80, 400, 720 ou 1040)" },
                  connects_to: { type: "array", items: { type: "integer" }, description: "Indices das etapas destino (0-based)" },
                },
                required: ["nome", "tipo", "pos_x", "pos_y"],
                additionalProperties: false,
              },
            },
            estrategia: { type: "string", description: "Resumo da estratégia do funil em 2-3 frases" },
          },
          required: ["etapas", "estrategia"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "organize_funnel" } },
  });

  let response = await fetchAI(`${baseUrl}/chat/completions`, { method: "POST", headers: mkH(apiKey, isOR), body: payload });

  if (!isOR && response.status === 402) {
    const orKey = Deno.env.get("OPENROUTER_API_KEY");
    if (orKey) {
      console.log("Lovable gateway 402, falling back to OpenRouter (organize_funnel)");
      response = await fetchAI("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: mkH(orKey, true), body: payload });
    }
  }

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    return new Response(JSON.stringify({ etapas: [], estrategia: "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return new Response(JSON.stringify({ etapas: parsed.etapas || [], estrategia: parsed.estrategia || "" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGenerateFunnelFromPrompt(body: any, projectContext: string, skillsContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix: string) {
  const { extra } = body;
  const prompt = extra?.prompt || "";
  const products = extra?.products || [];
  const projectName = extra?.project_name || "";
  const nicho = extra?.nicho || "";

  let productsSection = "";
  if (products.length > 0) {
    productsSection = `\n## Produtos do projeto:\n${JSON.stringify(products, null, 2)}`;
  }

  const systemPrompt = `${mentePrefix}Você é um estrategista de funis de marketing digital brasileiro de alto nível. O usuário vai descrever um funil e você deve criar todas as etapas com posicionamento visual no canvas.

${projectContext}
${skillsContext}
${productsSection}

## REGRAS DE POSICIONAMENTO VISUAL
Posicione em LINHAS lógicas usando pos_x e pos_y:
- Linha de Aquisição (y=80): Anúncios, Landing Pages, Captura
- Linha de Conversão (y=400): VSL, Webinar, Checkout, Produtos
- Linha de Maximização (y=720): Upsells, Order Bumps, Downsells
- Linha de Retenção (y=1040): Email, WhatsApp, Remarketing, Obrigado
- Espaçamento horizontal: 320px entre etapas na mesma linha (pos_x: 80, 400, 720, 1040, 1360...)
- connects_to: array de índices 0-based formando o fluxo lógico

## TIPOS VÁLIDOS
criativo, pagina, vsl, checkout, upsell, face_ads, instagram, tiktok, email, whatsapp, blog, video, imagem, caixa, texto, outro

## REGRAS
1. Interprete o que o usuário quer e crie TODAS as etapas necessárias
2. Adicione descrições estratégicas em cada etapa
3. Conecte as etapas formando o fluxo completo
4. Se o usuário mencionar produtos específicos, use-os; senão, use nomes genéricos
5. Inclua etapas de nutrição e follow-up quando relevante
6. Gere entre 4 e 15 etapas dependendo da complexidade`;

  const userPrompt = `${projectName ? `Projeto: ${projectName}\nNicho: ${nicho}\n` : ""}Crie o seguinte funil: ${prompt}`;

  const result = await callAI(systemPrompt, userPrompt, apiKey, model,
    [{
      type: "function",
      function: {
        name: "generate_funnel",
        description: "Generate funnel stages from description",
        parameters: {
          type: "object",
          properties: {
            etapas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string", description: "Nome da etapa" },
                  tipo: { type: "string", enum: ["criativo", "pagina", "vsl", "checkout", "upsell", "face_ads", "instagram", "tiktok", "email", "whatsapp", "blog", "video", "imagem", "caixa", "texto", "outro"] },
                  url: { type: "string", description: "URL se aplicável" },
                  descricao: { type: "string", description: "Descrição estratégica da etapa" },
                  pos_x: { type: "number", description: "Posição X no canvas" },
                  pos_y: { type: "number", description: "Posição Y no canvas" },
                  connects_to: { type: "array", items: { type: "integer" }, description: "Indices das etapas destino (0-based)" },
                },
                required: ["nome", "tipo", "pos_x", "pos_y"],
                additionalProperties: false,
              },
            },
            estrategia: { type: "string", description: "Resumo da estratégia do funil" },
          },
          required: ["etapas", "estrategia"],
          additionalProperties: false,
        },
      },
    }],
    "generate_funnel", baseUrl
  );
  if (result instanceof Response) return result;
  return new Response(JSON.stringify({ etapas: result.etapas || [], estrategia: result.estrategia || "" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Image Generation ──
async function handleGenerateImage(body: any, sb: any, projectContext: string, apiKey: string, mentePrefix = "") {
  const { project_id, prompt, quality = "fast", image_style } = body;
  const imageModel = quality === "high" ? "google/gemini-3-pro-image-preview" : "google/gemini-3.1-flash-image-preview";

  const systemParts = [mentePrefix, "Você é um designer gráfico especialista em criativos de marketing digital brasileiro."];
  if (projectContext) systemParts.push(`Contexto do projeto:\n${projectContext.slice(0, 2000)}`);
  if (image_style) systemParts.push(`Estilo visual desejado: ${image_style}`);

  const userPrompt = `Gere um criativo visual de alta qualidade com base na descrição: "${prompt}". A imagem deve ser profissional, atrativa e adequada para uso em anúncios ou redes sociais.`;

  const response = await fetchAI("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: imageModel,
      messages: [
        { role: "system", content: systemParts.join("\n") },
        { role: "user", content: userPrompt },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const imageData = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const textResponse = result.choices?.[0]?.message?.content || "";

  if (!imageData) {
    return new Response(JSON.stringify({ error: "Nenhuma imagem gerada. Tente novamente com um prompt diferente." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upload to storage
  let publicUrl = imageData; // fallback to base64
  try {
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const filePath = `ai-generated/${project_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { error: uploadErr } = await sb.storage.from("project-content").upload(filePath, bytes, { contentType: "image/png", upsert: true });
    if (!uploadErr) {
      const { data: urlData } = sb.storage.from("project-content").getPublicUrl(filePath);
      publicUrl = urlData.publicUrl;
    } else {
      console.error("Storage upload error:", uploadErr);
    }
  } catch (e) { console.error("Error uploading generated image:", e); }

  return new Response(JSON.stringify({ image_url: publicUrl, text: textResponse, model: imageModel }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Image Editing ──
async function handleEditImage(body: any, sb: any, projectContext: string, apiKey: string, mentePrefix = "") {
  const { project_id, source_image_url, instruction } = body;

  const response = await fetchAI("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: instruction },
          { type: "image_url", image_url: { url: source_image_url } },
        ],
      }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) return handleAIError(response);
  const result = await response.json();
  const imageData = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageData) {
    return new Response(JSON.stringify({ error: "Falha na edição. Tente uma instrução diferente." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let publicUrl = imageData;
  try {
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const filePath = `ai-edited/${project_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { error: uploadErr } = await sb.storage.from("project-content").upload(filePath, bytes, { contentType: "image/png", upsert: true });
    if (!uploadErr) {
      const { data: urlData } = sb.storage.from("project-content").getPublicUrl(filePath);
      publicUrl = urlData.publicUrl;
    }
  } catch (e) { console.error("Error uploading edited image:", e); }

  return new Response(JSON.stringify({ image_url: publicUrl, text: result.choices?.[0]?.message?.content || "" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Brainstorm Ideas ──
async function handleBrainstorm(body: any, projectContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix = "") {
  const { content_focus, num_ideas = 10 } = body;
  const isOpenRouter = baseUrl.includes("openrouter.ai");
  const brainstorm = await callAI(
    `${mentePrefix}Você é um estrategista de conteúdo digital brasileiro altamente criativo.
${projectContext}
Gere ${num_ideas} ideias de conteúdo únicas e criativas. Cada uma com título magnético, formato sugerido e gancho de engajamento.
${content_focus ? `Foco: ${content_focus}` : "Diversifique entre formatos (reels, carrossel, stories, vídeo, email, ads)."}`,
    `Gere ${num_ideas} ideias de conteúdo criativas e práticas.`,
    apiKey, model,
    [{ type: "function", function: { name: "brainstorm_ideas", description: "Generate content brainstorm", parameters: { type: "object", properties: { ideas: { type: "array", items: { type: "object", properties: { titulo: { type: "string" }, formato: { type: "string", enum: ["reels", "carrossel", "stories", "video_longo", "email", "ads_imagem", "ads_video", "thread", "live"] }, gancho: { type: "string" }, nivel_dificuldade: { type: "string", enum: ["facil", "medio", "avancado"] }, potencial_viral: { type: "number" } }, required: ["titulo", "formato", "gancho"], additionalProperties: false } } }, required: ["ideas"], additionalProperties: false } } }],
    "brainstorm_ideas", baseUrl
  );
  if (brainstorm instanceof Response) return brainstorm;
  return new Response(JSON.stringify({ brainstorm }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Generate Flowchart ──
async function handleGenerateFlowchart(body: any, projectContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix: string) {
  const { description, num_nodes = 8 } = body;
  if (!description) return new Response(JSON.stringify({ error: "description is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const systemPrompt = `${mentePrefix}Você é um especialista em desenho de processos e fluxogramas estratégicos.
${projectContext}

O usuário vai descrever um processo/fluxo e você deve gerar os nós (nodes) de um fluxograma visual.
Cada nó tem: title, subtitle (descrição curta), type (etapa|decisao|resultado|nota), color (hex).
As conexões entre nós são definidas por connects_to (array de índices dos nós destino, começando em 0).
Posicione os nós de forma organizada no canvas (pos_x, pos_y). Use espaçamento de ~280px horizontal e ~160px vertical.
Gere entre 4 e ${num_nodes} nós dependendo da complexidade.`;

  const result = await callAI(
    systemPrompt,
    `Gere um fluxograma para: ${description}`,
    apiKey, model,
    [{
      type: "function",
      function: {
        name: "create_flowchart",
        description: "Create flowchart nodes with connections",
        parameters: {
          type: "object",
          properties: {
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  subtitle: { type: "string" },
                  type: { type: "string", enum: ["etapa", "decisao", "resultado", "nota"] },
                  color: { type: "string" },
                  pos_x: { type: "number" },
                  pos_y: { type: "number" },
                  connects_to: { type: "array", items: { type: "number" } }
                },
                required: ["title", "type", "pos_x", "pos_y"],
                additionalProperties: false
              }
            }
          },
          required: ["nodes"],
          additionalProperties: false
        }
      }
    }],
    "create_flowchart", baseUrl
  );
  if (result instanceof Response) return result;
  
  // Convert index-based connects_to to UUID-based
  const nodesRaw = result.nodes || [];
  const ids = nodesRaw.map(() => crypto.randomUUID());
  const nodes = nodesRaw.map((n: any, i: number) => ({
    id: ids[i],
    title: n.title || `Nó ${i + 1}`,
    subtitle: n.subtitle || "",
    type: n.type || "etapa",
    color: n.color || "#3b82f6",
    pos_x: n.pos_x || 100 + (i % 4) * 280,
    pos_y: n.pos_y || 100 + Math.floor(i / 4) * 180,
    connects_to: (n.connects_to || []).filter((idx: number) => idx >= 0 && idx < nodesRaw.length && idx !== i).map((idx: number) => ids[idx]),
  }));

  return new Response(JSON.stringify({ nodes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Funnel Pipeline (one-click full generation) ──
async function handleGenerateFunnelPipeline(body: any, projectContext: string, skillsContext: string, apiKey: string, model: string, baseUrl: string, mentePrefix: string) {
  const { extra } = body;
  const briefing = extra?.briefing || {};
  const products = extra?.products || [];

  const produto = briefing.produto || "";
  const transformacao = briefing.transformacao || "";
  const nicho = briefing.nicho || "";
  const publico = briefing.publico || "";
  const naoPublico = briefing.nao_publico || "";
  const palavrasProibidas: string[] = Array.isArray(briefing.palavras_proibidas)
    ? briefing.palavras_proibidas.map((s: any) => String(s).toLowerCase().trim()).filter(Boolean)
    : [];
  const preco = briefing.preco || "";
  const objection = briefing.objection || "";
  const modelo = briefing.modelo || "vsl";

  const guardBlock = (publico || naoPublico || palavrasProibidas.length)
    ? `

## REGRA CRÍTICA DE PÚBLICO (INVIOLÁVEL)
Você fala EXCLUSIVAMENTE com o público descrito abaixo. Qualquer headline, ângulo, exemplo ou linguagem que se dirija a outro público é INVÁLIDO e será rejeitado.
${publico ? `- PÚBLICO ALVO: ${publico}` : ""}
${naoPublico ? `- PÚBLICO QUE NÃO É (proibido citar/aludir): ${naoPublico}` : ""}
${palavrasProibidas.length ? `- PALAVRAS/TERMOS PROIBIDOS (NUNCA use em headlines, corpo, CTA): ${palavrasProibidas.join(", ")}` : ""}
Se você não tiver certeza sobre um termo, prefira linguagem neutra que caiba no público-alvo. Nunca invente estereótipos.`
    : "";

  const briefingText = `
PRODUTO: ${produto}
TRANSFORMAÇÃO PROMETIDA: ${transformacao}
NICHO/AVATAR: ${nicho}
${publico ? `PÚBLICO ESPECÍFICO: ${publico}` : ""}
${naoPublico ? `PÚBLICO QUE NÃO É: ${naoPublico}` : ""}
${palavrasProibidas.length ? `PALAVRAS PROIBIDAS: ${palavrasProibidas.join(", ")}` : ""}
PREÇO/MODELO: ${preco}
OBJEÇÃO PRINCIPAL: ${objection}
MODELO DE FUNIL: ${modelo.toUpperCase()}
${products.length > 0 ? `\nPRODUTOS CADASTRADOS:\n${JSON.stringify(products, null, 2)}` : ""}
`.trim();

  // ── PHASE 1 — Intel (avatar + market + mechanism + angles) ──
  const intelSystem = `${mentePrefix}Você é um estrategista de marketing digital especializado em análise de avatar e mercado. Use os frameworks dos melhores copywriters brasileiros e internacionais (Gary Bencivenga, Eugene Schwartz, Dan Kennedy, Alex Hormozi).

${projectContext}
${skillsContext}
${anglesCatalogBlock()}
${qualityChecklistBlock()}${guardBlock}`;

  const intelPrompt = `Com base no briefing abaixo, execute a análise completa:

${briefingText}

Você deve retornar:
1. AVATAR DETALHADO: dores profundas (físicas, emocionais, financeiras), desejos, frustrações, linguagem que usa, dia a dia
2. NÍVEL DE CONSCIÊNCIA (Eugene Schwartz): qual dos 5 níveis o avatar está (inconsciente / consciente do problema / consciente da solução / consciente do produto / mais consciente) — e por quê
3. MECANISMO ÚNICO: por que esta solução funciona de forma diferente de tudo que o avatar já tentou — o elemento secreto/novo
4. 4 ÂNGULOS CRIATIVOS: SELECIONE 4 ângulos do catálogo canônico acima (use o campo "slug"). Regras obrigatórias: cada ângulo escolhido deve ter uma EMOÇÃO DOMINANTE diferente dos outros três; a headline deve seguir a "estrutura" documentada no catálogo; NÃO invente ângulos novos; RESPEITE a REGRA CRÍTICA DE PÚBLICO acima.
5. POSICIONAMENTO: como o produto deve ser posicionado para se diferenciar`;

  const intelResult = await callAI(intelSystem, intelPrompt, apiKey, model, [{
    type: "function",
    function: {
      name: "intel_analysis",
      description: "Complete avatar and market intelligence analysis",
      parameters: {
        type: "object",
        properties: {
          avatar: { type: "object", properties: {
            dores: { type: "array", items: { type: "string" } },
            desejos: { type: "array", items: { type: "string" } },
            linguagem: { type: "string" },
            nivel_consciencia: { type: "string" },
          }, required: ["dores", "desejos"], additionalProperties: true },
          mecanismo_unico: { type: "string" },
          angles: { type: "array", items: { type: "object", properties: {
            slug: { type: "string" },
            nome: { type: "string" },
            headline: { type: "string" },
            cta: { type: "string" },
          }, required: ["slug", "headline"], additionalProperties: true } },
          posicionamento: { type: "string" },
        },
        required: ["avatar", "mecanismo_unico", "angles", "posicionamento"],
        additionalProperties: false,
      },
    },
  }], "intel_analysis", baseUrl);

  if (intelResult instanceof Response) return intelResult;

  // Valida + hidrata os ângulos com metadados do catálogo canônico
  const { angles: cleanAngles, drops: angleDrops } = validateAndFixAngles(intelResult.angles, { min: 4, seed: produto });
  intelResult.angles = cleanAngles;
  if (angleDrops.length) console.warn("[openflow-ai] angles saneados:", angleDrops);

  // ── Guarda-corpo determinístico: rejeita ângulos que violem palavras proibidas ──
  if (palavrasProibidas.length && intelResult.angles?.length) {
    const violates = (a: any) => {
      const blob = `${a.headline || ""} ${a.cta || ""} ${a.nome || ""}`.toLowerCase();
      return palavrasProibidas.some(p => blob.includes(p));
    };
    const invalid = intelResult.angles.filter(violates);
    if (invalid.length) {
      console.warn(`[openflow-ai] ${invalid.length}/${intelResult.angles.length} ângulos violam palavras proibidas — regerando`);
      const retryPrompt = `Você gerou ângulos que VIOLAM a regra crítica de público. Refaça APENAS estes ${invalid.length} ângulo(s), substituindo por novos slugs do catálogo, respeitando as PALAVRAS PROIBIDAS (${palavrasProibidas.join(", ")}) e o público (${publico || nicho}).

Ângulos rejeitados:
${invalid.map((a: any, i: number) => `${i + 1}. slug=${a.slug} headline="${a.headline}"`).join("\n")}

Retorne apenas o array "angles" com ${invalid.length} novos ângulos válidos.`;
      const retry = await callAI(intelSystem, retryPrompt, apiKey, model, [{
        type: "function",
        function: {
          name: "regen_angles",
          description: "Regenerate rejected angles",
          parameters: {
            type: "object",
            properties: {
              angles: { type: "array", items: { type: "object", properties: {
                slug: { type: "string" }, nome: { type: "string" }, headline: { type: "string" }, cta: { type: "string" },
              }, required: ["slug", "headline"], additionalProperties: true } },
            },
            required: ["angles"], additionalProperties: false,
          },
        },
      }], "regen_angles", baseUrl);
      if (!(retry instanceof Response) && Array.isArray(retry?.angles)) {
        const { angles: retryClean } = validateAndFixAngles(retry.angles, { min: invalid.length, seed: `${produto}-retry` });
        const stillOk = retryClean.filter((a: any) => !violates(a));
        const keeping = intelResult.angles.filter((a: any) => !violates(a));
        intelResult.angles = [...keeping, ...stillOk].slice(0, 4);
      } else {
        intelResult.angles = intelResult.angles.filter((a: any) => !violates(a));
      }
    }
  }

  const anglesList = intelResult.angles.map((a: any) => `${a.nome || a.slug}: ${a.headline} → ${a.cta}${a.risk_warning ? ` ⚠️ ${a.risk_warning}` : ""}`);



  // ── PHASE 2 — Funnel structure ──
  const MODELO_CONFIGS: Record<string, string> = {
    vsl: "Aquisição (criativo/anúncio) → Página de captura → VSL (vídeo de vendas) → Checkout → Order Bump → Upsell → Email de nurturing",
    webinar: "Aquisição (criativo/anúncio) → Página de inscrição → Página de confirmação → Webinar (ao vivo ou gravado) → Replay/VSL → Checkout → Email de follow-up",
    isca: "Aquisição (criativo/anúncio) → Página de captura → Entrega da isca → Sequência de emails → VSL/Oferta → Checkout",
    tripwire: "Aquisição (criativo/anúncio) → Página de oferta low-ticket → Checkout tripwire → Upsell core offer → Email de onboarding",
    lancamento: "Pré-aquecimento (remarketing/email) → Página de inscrição → PLC 1 (oportunidade) → PLC 2 (transformação) → PLC 3 (prova social) → Abertura de carrinho → Checkout → Sequência de fechamento",
  };

  const funnelSystem = `${mentePrefix}Você é um especialista em arquitetura de funis de marketing digital brasileiro. Posicione etapas visualmente com lógica de canvas.

## REGRAS DE POSICIONAMENTO VISUAL
- Linha de Aquisição (y=80): Anúncios e criativos de entrada
- Linha de Conversão (y=400): Landing pages, VSL, Checkout
- Linha de Maximização (y=720): Upsells, Order Bumps, Downsells
- Linha de Retenção (y=1040): Email, WhatsApp, Obrigado, Remarketing
- Espaçamento horizontal: 320px (pos_x: 80, 400, 720, 1040, 1360...)
- connects_to: índices 0-based formando fluxo lógico

## TIPOS VÁLIDOS
criativo, pagina, vsl, checkout, upsell, face_ads, instagram, tiktok, email, whatsapp, blog, video, imagem, caixa, texto, outro`;

  const funnelPrompt = `Crie a estrutura completa de etapas para este funil:

BRIEFING:
${briefingText}

MODELO BASE: ${MODELO_CONFIGS[modelo] || MODELO_CONFIGS.vsl}

INTELIGÊNCIA DE MERCADO:
- Avatar: ${intelResult.avatar?.linguagem || nicho}
- Nível de Consciência: ${intelResult.avatar?.nivel_consciencia || "Consciente do problema"}
- Mecanismo Único: ${intelResult.mecanismo_unico || ""}
- Posicionamento: ${intelResult.posicionamento || ""}

Crie entre 6 e 14 etapas com nomes específicos para este produto (não genéricos), descrições estratégicas, e posicionamento visual correto.`;

  const funnelResult = await callAI(funnelSystem, funnelPrompt, apiKey, model, [{
    type: "function",
    function: {
      name: "generate_funnel_pipeline",
      description: "Generate complete funnel stages with positioning",
      parameters: {
        type: "object",
        properties: {
          etapas: { type: "array", items: { type: "object", properties: {
            nome: { type: "string" },
            tipo: { type: "string", enum: ["criativo", "pagina", "vsl", "checkout", "upsell", "face_ads", "instagram", "tiktok", "email", "whatsapp", "blog", "video", "imagem", "caixa", "texto", "outro"] },
            descricao: { type: "string" },
            url: { type: "string" },
            pos_x: { type: "number" },
            pos_y: { type: "number" },
            connects_to: { type: "array", items: { type: "integer" } },
          }, required: ["nome", "tipo", "pos_x", "pos_y", "descricao"], additionalProperties: false } },
          estrategia: { type: "string" },
        },
        required: ["etapas", "estrategia"],
        additionalProperties: false,
      },
    },
  }], "generate_funnel_pipeline", baseUrl);

  if (funnelResult instanceof Response) return funnelResult;

  // ── PHASE 3 — VSL outline + email sequence (parallel-ish, sequential calls) ──
  const vslSystem = `${mentePrefix}Você é o maior roteirista de VSL do Brasil. Use a estrutura VSL™ de 7 blocos obrigatórios com base no briefing e no mecanismo único do produto.`;

  const vslPrompt = `Crie a ESTRUTURA COMPLETA de VSL para:

BRIEFING:
${briefingText}

MECANISMO ÚNICO: ${intelResult.mecanismo_unico || ""}
NÍVEL DE CONSCIÊNCIA DO AVATAR: ${intelResult.avatar?.nivel_consciencia || ""}
DORES PRINCIPAIS: ${(intelResult.avatar?.dores || []).slice(0, 3).join(", ")}

Estruture os 7 blocos: 1-Pattern Interrupt/Gancho, 2-Amplificação da Dor, 3-Epifania/Mecanismo, 4-Prova Social, 5-Oferta, 6-Urgência/Escassez, 7-CTA Final.
Para cada bloco: título + roteiro de 3-5 linhas + tempo estimado.`;

  const emailSystem = `${mentePrefix}Você é um estrategista de email marketing que usa o framework SOAP e as técnicas de Andre Chaperon (Autoresponder Madness) e Ben Settle. Escreva sequências que geram engajamento e vendas.`;

  const emailPrompt = `Crie uma SEQUÊNCIA DE 7 EMAILS para:

BRIEFING:
${briefingText}

AVATAR: ${intelResult.avatar?.linguagem || nicho}
DORES: ${(intelResult.avatar?.dores || []).slice(0, 2).join(", ")}

Emails: 1-Boas-vindas+Quick Win, 2-História de origem, 3-Mecanismo único, 4-Prova social, 5-Demolição de objeção, 6-Urgência/CTA, 7-Último chamado.
Para cada email: assunto, preheader, corpo (8-12 linhas), CTA.`;

  const vslTools = [{
    type: "function",
    function: {
      name: "vsl_outline",
      description: "VSL script structure",
      parameters: {
        type: "object",
        properties: {
          blocos: { type: "array", items: { type: "object", properties: {
            numero: { type: "number" },
            nome: { type: "string" },
            roteiro: { type: "string" },
            duracao: { type: "string" },
          }, required: ["numero", "nome", "roteiro", "duracao"], additionalProperties: false } },
          duracao_total: { type: "string" },
        },
        required: ["blocos", "duracao_total"],
        additionalProperties: false,
      },
    },
  }];

  const emailTools = [{
    type: "function",
    function: {
      name: "email_sequence",
      description: "7-email nurturing sequence",
      parameters: {
        type: "object",
        properties: {
          emails: { type: "array", items: { type: "object", properties: {
            numero: { type: "number" },
            assunto: { type: "string" },
            preheader: { type: "string" },
            corpo: { type: "string" },
            cta: { type: "string" },
          }, required: ["numero", "assunto", "preheader", "corpo", "cta"], additionalProperties: false } },
        },
        required: ["emails"],
        additionalProperties: false,
      },
    },
  }];

  // Retry-wrapped paralelo com falha parcial
  const runVsl = () => withRetry(async () => {
    const r = await callAI(vslSystem, vslPrompt, apiKey, model, vslTools, "vsl_outline", baseUrl);
    if (r instanceof Response) throw new Error(`vsl callAI status ${r.status}`);
    if (!r?.blocos?.length) throw new Error("vsl vazio");
    return r;
  }, 2, 500);

  const runEmails = () => withRetry(async () => {
    const r = await callAI(emailSystem, emailPrompt, apiKey, model, emailTools, "email_sequence", baseUrl);
    if (r instanceof Response) throw new Error(`emails callAI status ${r.status}`);
    if (!r?.emails?.length) throw new Error("emails vazio");
    return r;
  }, 2, 500);

  const [vslSettled, emailSettled] = await Promise.allSettled([runVsl(), runEmails()]);

  const phaseErrors: Record<string, string> = {};
  const phases: Record<string, string> = { intel: "done", angles: "done", funnel: "done", vsl: "done", emails: "done" };

  // Build VSL outline text
  let vslOutlineText = "";
  if (vslSettled.status === "fulfilled") {
    const vslResult = vslSettled.value;
    vslOutlineText = vslResult.blocos.map((b: any) => `[${b.numero}] ${b.nome} (${b.duracao})\n${b.roteiro}`).join("\n\n");
    if (vslResult.duracao_total) vslOutlineText += `\n\nDuração Total: ${vslResult.duracao_total}`;
  } else {
    phases.vsl = "failed";
    phaseErrors.vsl = String(vslSettled.reason?.message || vslSettled.reason || "falha desconhecida");
    console.error("[openflow-ai] Fase 3 VSL falhou:", phaseErrors.vsl);
  }

  // Build email list
  let emailsData: any[] = [];
  if (emailSettled.status === "fulfilled") {
    emailsData = emailSettled.value.emails;
  } else {
    phases.emails = "failed";
    phaseErrors.emails = String(emailSettled.reason?.message || emailSettled.reason || "falha desconhecida");
    console.error("[openflow-ai] Fase 3 Emails falhou:", phaseErrors.emails);
  }

  // Map etapas to final format
  const etapas = (funnelResult.etapas || []).map((e: any) => ({
    nome: e.nome || "Etapa",
    tipo: e.tipo || "outro",
    visitantes: 0,
    conversoes: 0,
    url: e.url || "",
    pos_x: e.pos_x ?? 80,
    pos_y: e.pos_y ?? 400,
    descricao: e.descricao || "",
    connects_to: e.connects_to || [],
  }));

  return new Response(JSON.stringify({
    etapas,
    estrategia: funnelResult.estrategia || `Funil ${modelo.toUpperCase()} para ${produto}`,
    phases,
    ...(Object.keys(phaseErrors).length ? { phase_errors: phaseErrors } : {}),
    assets: {
      angles: anglesList,
      vsl_outline: vslOutlineText,
      emails: emailsData,
      avatar: intelResult.avatar,
      mecanismo_unico: intelResult.mecanismo_unico,
      posicionamento: intelResult.posicionamento,
    },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
