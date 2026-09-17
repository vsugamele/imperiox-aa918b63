// Scrape um site via Firecrawl: screenshot + branding + summary + markdown
// Persiste o screenshot em Supabase Storage (bucket privado `site-thumbs`)
// e devolve uma signed URL de 1 ano — Firecrawl invalida o link original em horas.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

async function persistScreenshot(rawUrl: string, userId: string | null): Promise<string | null> {
  try {
    if (!rawUrl) return null;
    // Se já é data: URL, devolve como está
    if (rawUrl.startsWith('data:')) return rawUrl;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const resp = await fetch(rawUrl);
    if (!resp.ok) {
      console.error('[site-scrape] failed downloading screenshot', resp.status);
      return rawUrl; // fallback: retorna URL original mesmo que efêmera
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    const ext = (resp.headers.get('content-type') || '').includes('jpeg') ? 'jpg' : 'png';
    const folder = userId || 'public';
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await admin.storage.from('site-thumbs').upload(path, buf, {
      contentType: resp.headers.get('content-type') || 'image/png',
      upsert: false,
    });
    if (upErr) {
      console.error('[site-scrape] upload err', upErr);
      return rawUrl;
    }
    const { data: signed, error: signErr } = await admin.storage
      .from('site-thumbs').createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) {
      console.error('[site-scrape] sign err', signErr);
      return rawUrl;
    }
    return signed.signedUrl;
  } catch (e) {
    console.error('[site-scrape] persist error', e);
    return rawUrl;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL obrigatória' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identifica usuário a partir do JWT (para isolar storage por pasta)
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
        const sb = createClient(supabaseUrl, anon, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await sb.auth.getUser();
        userId = user?.id || null;
      }
    } catch (_) { /* anon */ }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

    console.log('[site-scrape] url:', formattedUrl, 'user:', userId);

    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'screenshot', 'branding', 'summary'],
        onlyMainContent: true,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error('[site-scrape] firecrawl error', json);
      return new Response(JSON.stringify({ success: false, error: json.error || `Firecrawl ${res.status}` }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = json.data || json;
    const rawShot: string | null = data?.screenshot || null;
    const persistedShot = rawShot ? await persistScreenshot(rawShot, userId) : null;

    const result = {
      success: true,
      title: data?.metadata?.title || formattedUrl,
      screenshot: persistedShot,
      branding: data?.branding || null,
      summary: data?.summary || null,
      markdown: data?.markdown || null,
      metadata: data?.metadata || null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[site-scrape] error', e);
    return new Response(JSON.stringify({ success: false, error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
