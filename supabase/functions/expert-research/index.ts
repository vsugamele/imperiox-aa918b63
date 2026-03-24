const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, project_id } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não configurado. Conecte o Firecrawl nas configurações.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping URL:', formattedUrl);

    // Step 1: Scrape with Firecrawl
    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'summary'],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || `Firecrawl error: ${scrapeRes.status}` }),
        { status: scrapeRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    const summary = scrapeData.data?.summary || scrapeData.summary || '';
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    // Step 2: Use AI to extract structured data
    const aiPrompt = `Analise o conteúdo abaixo de um site/perfil de um expert digital e extraia as seguintes informações em formato JSON:

{
  "nome": "nome completo do expert",
  "area": "área de atuação principal",
  "bio": "biografia curta (2-3 frases)",
  "tom_voz": "tom de voz predominante (ex: direto, motivacional, técnico, informal)",
  "metodo": "método ou framework que ele ensina/usa",
  "temas": ["lista de temas/assuntos que aborda"],
  "palavras_usa": ["palavras e expressões frequentes"],
  "transformacao": "transformação prometida ao público"
}

Se algum campo não puder ser identificado, use null.

Título da página: ${metadata.title || 'N/A'}
Resumo: ${summary}

Conteúdo:
${markdown.substring(0, 8000)}`;

    // Call OpenAI-compatible endpoint via openflow-ai or similar
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

    const aiRes = await fetch(`${SUPABASE_URL}/functions/v1/openflow-ai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: aiPrompt,
        system: 'Você é um analista especializado em marketing digital. Extraia informações de experts/influenciadores digitais. Responda APENAS com JSON válido, sem markdown.',
        max_tokens: 2000,
      }),
    });

    let extracted: Record<string, unknown> = {};

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const text = aiData.text || aiData.content || aiData.response || '';
      try {
        // Try to parse JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extracted = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    } else {
      console.error('AI call failed:', aiRes.status);
      // Fallback: return raw content without AI extraction
      extracted = {
        nome: metadata.title || null,
        area: null,
        bio: summary || null,
        tom_voz: null,
        metodo: null,
        temas: [],
        palavras_usa: [],
        transformacao: null,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted,
        raw_content: markdown.substring(0, 15000),
        summary,
        source_url: formattedUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Expert research error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to research' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
