import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Onda 6 — WhatsApp Audience Preview
// Evaluates a filter object against imphq_wa_conversations and returns
// { count, sample, breakdown }.

interface Filters {
  project_id: string;
  temperature?: string[];               // ['hot','warm','cold']
  conv_status?: string[];
  current_intent?: string[];
  intent_tags_any?: string[];           // array-overlap on intent_tags
  buy_intent_detected?: boolean;
  emotional_state?: string[];
  has_pitch?: boolean;
  last_message_within_days?: number;    // last_message_at >= now - N days
  last_message_older_than_days?: number;// last_message_at <= now - N days
  bought_produto?: string;              // has sale with this produto
  never_bought?: boolean;               // no rows in imphq_vendas
  nome_search?: string;                 // ilike on contact_name/nome
  exclude_segment_id?: string;          // exclude phones from another segment
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supa.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const filters = (await req.json()) as Filters;
    if (!filters?.project_id) return json({ error: "project_id required" }, 400);

    let q = admin
      .from("imphq_wa_conversations")
      .select(
        "id, phone, contact_name, nome, temperature, current_intent, intent_tags, buy_intent_detected, emotional_state, conv_status, last_message_at, last_pitch_at, last_pitch_produto, avatar_url",
        { count: "exact" }
      )
      .eq("project_id", filters.project_id);

    if (filters.temperature?.length) q = q.in("temperature", filters.temperature);
    if (filters.conv_status?.length) q = q.in("conv_status", filters.conv_status);
    if (filters.current_intent?.length) q = q.in("current_intent", filters.current_intent);
    if (filters.emotional_state?.length) q = q.in("emotional_state", filters.emotional_state);
    if (filters.intent_tags_any?.length) q = q.overlaps("intent_tags", filters.intent_tags_any);
    if (typeof filters.buy_intent_detected === "boolean")
      q = q.eq("buy_intent_detected", filters.buy_intent_detected);
    if (filters.has_pitch === true) q = q.not("last_pitch_at", "is", null);
    if (filters.has_pitch === false) q = q.is("last_pitch_at", null);
    if (filters.last_message_within_days) {
      const cutoff = new Date(Date.now() - filters.last_message_within_days * 86400000).toISOString();
      q = q.gte("last_message_at", cutoff);
    }
    if (filters.last_message_older_than_days) {
      const cutoff = new Date(Date.now() - filters.last_message_older_than_days * 86400000).toISOString();
      q = q.lte("last_message_at", cutoff);
    }
    if (filters.nome_search) {
      const s = filters.nome_search.replace(/[%_]/g, "");
      q = q.or(`contact_name.ilike.%${s}%,nome.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    const limit = Math.min(filters.limit ?? 20, 100);
    q = q.order("last_message_at", { ascending: false, nullsFirst: false }).limit(limit);

    const { data: convs, count, error } = await q;
    if (error) return json({ error: error.message }, 500);

    let rows = convs ?? [];

    // Post-filter: bought_produto / never_bought — requires join with imphq_vendas
    if (filters.bought_produto || filters.never_bought) {
      const phones = rows.map((r: any) => r.phone).filter(Boolean);
      if (phones.length) {
        let vq = admin
          .from("imphq_vendas")
          .select("telefone, produto")
          .eq("projeto_id", filters.project_id)
          .in("telefone", phones);
        if (filters.bought_produto) vq = vq.eq("produto", filters.bought_produto);
        const { data: vendas } = await vq;
        const boughtSet = new Set((vendas ?? []).map((v: any) => v.telefone));
        if (filters.bought_produto) {
          rows = rows.filter((r: any) => boughtSet.has(r.phone));
        } else if (filters.never_bought) {
          rows = rows.filter((r: any) => !boughtSet.has(r.phone));
        }
      }
    }

    // Exclude segment
    if (filters.exclude_segment_id) {
      const { data: seg } = await admin
        .from("imphq_wa_audience_segments")
        .select("filters")
        .eq("id", filters.exclude_segment_id)
        .maybeSingle();
      if (seg?.filters) {
        // recursive-ish: fetch the excluded phones (cap 5k)
        const ex = await fetch(new URL(req.url).toString(), {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ ...seg.filters, project_id: filters.project_id, limit: 5000 }),
        });
        if (ex.ok) {
          const { sample } = await ex.json();
          const exSet = new Set((sample ?? []).map((s: any) => s.phone));
          rows = rows.filter((r: any) => !exSet.has(r.phone));
        }
      }
    }

    // Breakdown by temperature for quick UI feedback
    const breakdown: Record<string, number> = {};
    for (const r of rows) {
      const k = r.temperature || "sem_temp";
      breakdown[k] = (breakdown[k] || 0) + 1;
    }

    return json({
      count: filters.bought_produto || filters.never_bought || filters.exclude_segment_id ? rows.length : count ?? rows.length,
      sample: rows,
      breakdown,
    });
  } catch (e) {
    console.error("wa-audience-preview error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
