import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const questionId = typeof body?.questionId === 'string' ? body.questionId : ''
    const pergunta = typeof body?.pergunta === 'string' ? body.pergunta.trim() : ''
    const resposta = typeof body?.resposta === 'string' ? body.resposta.trim() : ''

    if (!questionId || !pergunta || !resposta) {
      return new Response(JSON.stringify({ error: 'questionId, pergunta e resposta são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    let embedding: number[] | null = null

    if (LOVABLE_API_KEY) {
      const embRes = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: pergunta,
          dimensions: 768,
        }),
      })
      if (embRes.ok) {
        const embData = await embRes.json()
        embedding = embData?.data?.[0]?.embedding ?? null
      } else {
        console.error('embedding error', embRes.status, await embRes.text())
      }
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const update: Record<string, unknown> = {
      resposta,
      aprovada: true,
      answered: true,
      source: 'admin_answer',
    }
    if (embedding) update.embedding = embedding

    const { error } = await admin
      .from('imphq_wa_knowledge')
      .update(update)
      .eq('id', questionId)

    if (error) throw error

    return new Response(JSON.stringify({ ok: true, embedded: !!embedding }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
