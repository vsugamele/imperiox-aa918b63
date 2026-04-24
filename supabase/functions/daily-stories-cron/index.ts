// Cron diário (08:00 BRT / 11:00 UTC) — varre projetos com status='vendendo'
// e dispara `daily-stories-ideas` pra cada um, gravando o resultado em imphq_expert_logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: projetos, error } = await supabase
      .from("imphq_projects")
      .select("id, name, status")
      .eq("status", "vendendo");

    if (error) throw error;

    const results: any[] = [];
    for (const p of projetos || []) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/daily-stories-ideas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ project_id: p.id, mode: "daily" }),
        });
        const json = await r.json().catch(() => ({}));
        const ok = r.ok && Array.isArray(json.stories) && json.stories.length > 0;

        // Persistir as ideias geradas pra timeline do Expert / dashboard
        await supabase.from("imphq_expert_logs" as any).insert({
          project_id: p.id,
          action: "daily_stories_generated",
          metadata: {
            stories: json.stories || [],
            resumo: json.resumo_contexto || "",
            contexto: json.contexto_usado || {},
            generated_at: new Date().toISOString(),
            via: "cron",
          },
        });

        results.push({ project_id: p.id, name: p.name, ok, count: (json.stories || []).length });
      } catch (e) {
        results.push({ project_id: p.id, name: p.name, ok: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ ran_at: new Date().toISOString(), total: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("daily-stories-cron error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
