// wa-learn-from-human — captura par (pergunta_lead → resposta_humana) e indexa em imphq_wa_knowledge
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { conversation_id, message_id, project_id, gold, source } = await req.json();
    if (!conversation_id || !project_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aprendizado só roda se learning_mode = true na config
    const { data: configs } = await supabase
      .from("imphq_wa_ai_config")
      .select("learning_mode, provider_id")
      .eq("project_id", project_id)
      .eq("enabled", true);
    const cfg = configs?.find((c: any) => !c.provider_id) || configs?.[0];
    if (cfg && (cfg as any).learning_mode === false) {
      return new Response(JSON.stringify({ ok: true, skipped: "learning_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega a resposta humana
    let humanMsg: any = null;
    if (message_id) {
      const { data } = await supabase.from("imphq_wa_messages").select("*").eq("id", message_id).maybeSingle();
      humanMsg = data;
    } else {
      const { data } = await supabase
        .from("imphq_wa_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .eq("sent_by", "human")
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      humanMsg = data;
    }
    if (!humanMsg || !humanMsg.content || humanMsg.content.length < 15) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_human_msg" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca pergunta antecedente do lead
    const { data: prevIn } = await supabase
      .from("imphq_wa_messages")
      .select("content, created_at")
      .eq("conversation_id", conversation_id)
      .eq("direction", "incoming")
      .lt("created_at", humanMsg.created_at)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    if (!prevIn?.content || prevIn.content.length < 4) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_prev_lead_msg" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pergunta = String(prevIn.content).slice(0, 500);
    const resposta = String(humanMsg.content).slice(0, 1000);

    // Gera embedding (cached)
    const embedding = await getCachedEmbedding(supabase, pergunta);
    if (!embedding) {
      return new Response(JSON.stringify({ ok: false, error: "embed_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup: se já existe par muito similar (>=0.92), incrementa score em vez de inserir
    const { data: similars } = await supabase.rpc("match_wa_knowledge", {
      query_embedding: embedding,
      p_project_id: project_id,
      match_count: 1,
      min_similarity: 0.92,
    });
    if (similars && similars.length > 0) {
      await supabase
        .from("imphq_wa_knowledge")
        .update({ score_uso: (similars[0].score_uso || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", similars[0].id);
      return new Response(JSON.stringify({ ok: true, deduped: similars[0].id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insErr } = await supabase.from("imphq_wa_knowledge").insert({
      project_id, pergunta, resposta, embedding,
      source: source || (gold ? "manual:gold" : "human_reply"),
      conversation_id, aprovada: gold === true,
    }).select("id").maybeSingle();
    if (insErr) {
      console.error("[wa-learn] insert error:", insErr.message);
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: inserted?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wa-learn-from-human] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
