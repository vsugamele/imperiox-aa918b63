// Processa jobs pending de imagem de um blueprint: chama gpt-image-2 e salva no bucket flow-media (signed URL).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function generateImage(prompt: string): Promise<Uint8Array> {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-image-2',
      prompt,
      quality: 'low',
      size: '1024x1024',
      n: 1,
    }),
  });
  if (!resp.ok) throw new Error(`Image gen failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No b64_json returned');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { blueprint_id, job_id } = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let q = supabase.from('imphq_flow_image_jobs').select('*').eq('status', 'pending');
    if (job_id) q = q.eq('id', job_id);
    else if (blueprint_id) q = q.eq('blueprint_id', blueprint_id);
    else return new Response(JSON.stringify({ error: 'blueprint_id ou job_id' }), { status: 400, headers: corsHeaders });

    const { data: jobs } = await q.limit(20);
    if (!jobs?.length) return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let done = 0;
    for (const job of jobs) {
      try {
        const bytes = await generateImage(job.prompt);
        const path = `${job.blueprint_id}/${job.block_id}-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage.from('flow-media').upload(path, bytes, {
          contentType: 'image/png', upsert: true,
        });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from('flow-media').createSignedUrl(path, 60 * 60 * 24 * 365);
        const url = signed?.signedUrl;

        await supabase.from('imphq_flow_image_jobs').update({ status: 'done', url }).eq('id', job.id);

        // Atualiza o blueprint inline
        const { data: bp } = await supabase.from('imphq_flow_blueprints').select('blueprint').eq('id', job.blueprint_id).maybeSingle();
        if (bp) {
          const blueprint: any = bp.blueprint;
          blueprint.nodes = (blueprint.nodes || []).map((n: any) => ({
            ...n,
            blocks: (n.blocks || []).map((b: any) => b.id === job.block_id ? { ...b, image_url: url } : b),
          }));
          await supabase.from('imphq_flow_blueprints').update({ blueprint }).eq('id', job.blueprint_id);
        }
        done++;
      } catch (e: any) {
        await supabase.from('imphq_flow_image_jobs').update({ status: 'error', error: e.message }).eq('id', job.id);
      }
    }
    return new Response(JSON.stringify({ processed: done }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
