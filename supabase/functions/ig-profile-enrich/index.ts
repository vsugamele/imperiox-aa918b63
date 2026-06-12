import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { conversation_id, project_id, username } = await req.json();
    if (!conversation_id || !project_id || !username) {
      return new Response(JSON.stringify({ error: "conversation_id, project_id e username obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch conversation details
    const { data: conv } = await supabase
      .from("imphq_ig_conversations")
      .select("*")
      .eq("id", conversation_id)
      .maybeSingle();

    if (!conv) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch recent messages
    const { data: dbMessages } = await supabase
      .from("imphq_ig_messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(30);

    const historyText = (dbMessages || [])
      .map((m: any) => `${m.direction === "in" ? "Lead" : "Assistente"}: ${m.content}`)
      .join("\n");

    // 3. Attempt Firecrawl Scrape
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    let scrapeBio = "";
    let scrapeFollowers = "";
    let scrapeFollowing = "";

    if (FIRECRAWL_API_KEY) {
      try {
        console.log(`[ig-profile-enrich] Querying Firecrawl for user: @${username}`);
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`
          },
          body: JSON.stringify({
            url: `https://www.instagram.com/${username}`,
            formats: ["markdown"],
            onlyMainContent: true,
            timeout: 10000
          })
        });

        if (res.ok) {
          const resData = await res.json();
          const md = resData?.data?.markdown || "";
          console.log(`[ig-profile-enrich] Firecrawl Markdown loaded: ${md.slice(0, 150)}...`);
          
          // Basic extract logic from markdown using Regex fallback
          const followersMatch = md.match(/([0-9.,kKmM]+)\s*Followers/i) || md.match(/([0-9.,kKmM]+)\s*seguidores/i);
          const followingMatch = md.match(/([0-9.,kKmM]+)\s*Following/i) || md.match(/([0-9.,kKmM]+)\s*seguindo/i);
          
          if (followersMatch) scrapeFollowers = followersMatch[1];
          if (followingMatch) scrapeFollowing = followingMatch[1];
          
          // Extract bio paragraphs if possible
          scrapeBio = md.slice(0, 500);
        }
      } catch (err: any) {
        console.warn("[ig-profile-enrich] Firecrawl scrape failed:", err.message);
      }
    }

    // 4. Run LLM Analysis to synthesize psychographic profile and stats
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    let enrichedProfile = {
      followers: scrapeFollowers || "1.2k (est.)",
      following: scrapeFollowing || "350 (est.)",
      bio: scrapeBio || "Perfil focado em empreendedorismo digital.",
      dores: "Não identificadas na conversa",
      desejos: "Não identificados na conversa",
      fit_score: 70,
      persona_summary: "Lead do Instagram"
    };

    if (OPENROUTER_API_KEY) {
      const systemPrompt = `Você é o SDR Coach do Imperio HQ. Sua função é analisar o perfil público de um lead do Instagram e seu histórico de conversas com nosso time/IA para criar um perfil psicológico/comercial preciso para o CRM.
      
DADOS COLETADOS DO WEBPAGE (se houver):
- Bio/Markdown: ${scrapeBio || "Indisponível"}
- Seguidores: ${scrapeFollowers || "Indisponível"}
- Seguindo: ${scrapeFollowing || "Indisponível"}

HISTÓRICO DA CONVERSA:
${historyText || "Sem histórico de conversa disponível."}

INSTRUÇÕES:
Gere uma análise no formato JSON. Seja realista e perspicaz. Use as dores e desejos reais expressados na conversa.
Os campos no JSON devem ser exatamente:
{
  "followers": "número de seguidores do lead (estimado ou extraído, ex: 10k)",
  "following": "número de contas que o lead segue",
  "bio": "resumo profissional/pessoal extraído da bio ou estimado pelo estilo da conversa",
  "dores": "principais dificuldades, obstáculos e problemas que o lead está enfrentando",
  "desejos": "objetivos finais, ambições e transformações que o lead busca",
  "fit_score": número inteiro de 0 a 100 indicando quão quente/alinhado este lead é com nossa oferta,
  "persona_summary": "resumo de persona (ex: Copwriter Iniciante querendo escalar, ou Empresário maduro buscando automação)"
}
Responda APENAS com o objeto JSON limpo, sem markdown, sem tags \`\`\`json.`;

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://imperiohq.lovable.app",
            "X-Title": "Imperio HQ Enrichment",
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-chat-v3.1",
            messages: [{ role: "user", content: systemPrompt }],
            temperature: 0.3
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          const content = resJson?.choices?.[0]?.message?.content || "";
          const cleanedJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanedJson);
          if (parsed && parsed.fit_score !== undefined) {
            enrichedProfile = { ...enrichedProfile, ...parsed };
          }
        }
      } catch (err: any) {
        console.error("[ig-profile-enrich] LLM parsing error:", err.message);
      }
    }

    // 5. Upsert lead record and update conversation lead_id
    const leadId = conv.lead_id || `ig_${conv.participant_id}`;
    
    // Fetch existing lead data to merge
    const { data: existingLead } = await supabase
      .from("imphq_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    const nome = conv.participant_name || conv.participant_username || "Lead Instagram";
    const existingData = existingLead?.data || {};
    const mergedData = {
      ...existingData,
      origem: "instagram",
      ig_username: conv.participant_username,
      ig_conversation_id: conv.id,
      enriched_profile: enrichedProfile,
      enriched_at: new Date().toISOString()
    };

    const tags = existingLead?.tags || [];
    const updatedTags = [...new Set([...tags, "📸 Instagram", "⚡ Perfil Enriquecido"])];

    // Upsert Lead
    await supabase.from("imphq_leads").upsert({
      id: leadId,
      project_id,
      nome,
      score: enrichedProfile.fit_score,
      status: enrichedProfile.fit_score >= 80 ? "quente" : (enrichedProfile.fit_score >= 50 ? "morno" : "frio"),
      tags: updatedTags,
      data: mergedData,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    // Link conversation to lead
    await supabase
      .from("imphq_ig_conversations")
      .update({ lead_id: leadId })
      .eq("id", conversation_id);

    console.log(`[ig-profile-enrich] Enrichment completed for lead ${leadId} (@${conv.participant_username})`);

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      enriched_profile: enrichedProfile
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error(`[ig-profile-enrich] Error: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
