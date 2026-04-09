import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: projects, error } = await sb
      .from("imphq_projects")
      .select("id, name, data, avatar, brand_kit")
      .filter("data->>expert_share_token", "eq", token);

    if (error) throw error;
    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const project = projects[0];
    const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});

    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [evRes, taskRes, procRes] = await Promise.all([
      sb.from("imphq_calendar_events").select("id, title, start_date, end_date, type").eq("project_id", project.id).gte("start_date", now.toISOString()).lte("start_date", weekEnd.toISOString()).order("start_date"),
      sb.from("imphq_kanban_cards").select("id, title, priority, due_date, column_id, checklist").contains("tags", [project.id]).order("position").limit(20),
      sb.from("imphq_processes").select("id, title, name, steps").eq("project_id", project.id),
    ]);

    // Enrich tasks with checklist summary
    const tasks = (taskRes.data || []).map((t: any) => {
      const checklist = t.checklist || [];
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
        column_id: t.column_id,
        checklist_total: checklist.length,
        checklist_done: checklist.filter((c: any) => c.done).length,
      };
    });

    const response = {
      project_name: project.name,
      expert: d.expert || null,
      content_plan: d.content_plan || {},
      content_objective: d.content_objective || "",
      expert_notes: d.expert_notes || "",
      brand_kit: project.brand_kit || {},
      events: evRes.data || [],
      tasks,
      processes: (procRes.data || []).map((p: any) => ({
        id: p.id,
        title: p.title || p.name,
        steps: p.steps || [],
      })),
    };

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("expert-portal error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
