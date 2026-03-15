import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Simple hash for comparison (in production use bcrypt)
  const keyHash = btoa(apiKey);
  const { data: keyRecord } = await supabase
    .from("imphq_api_keys")
    .select("id, permissions")
    .eq("key_hash", keyHash)
    .limit(1)
    .single();

  if (!keyRecord) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update last_used_at
  await supabase.from("imphq_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRecord.id);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // POST: create_task
    if (req.method === "POST" && action === "create_task") {
      const body = await req.json();
      const { title, board = "agentes", priority = "medium", due_date, project_id } = body;
      if (!title) throw new Error("title is required");

      // Find backlog column for the board
      const { data: cols } = await supabase
        .from("imphq_kanban_columns")
        .select("id")
        .eq("board", board)
        .eq("title", "backlog")
        .limit(1);

      const columnId = cols?.[0]?.id;
      if (!columnId) throw new Error(`No backlog column found for board: ${board}`);

      const { data, error } = await supabase.from("imphq_kanban_cards").insert({
        column_id: columnId,
        title,
        priority,
        due_date: due_date || null,
        board,
        position: 0,
        tags: project_id ? [project_id] : [],
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, card: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: create_lead
    if (req.method === "POST" && action === "create_lead") {
      const body = await req.json();
      const { nome, email, phone, plataforma, project_id, tags, data: leadData } = body;
      if (!nome && !email) throw new Error("nome or email is required");

      const { data, error } = await supabase.from("imphq_leads").insert({
        id: crypto.randomUUID(),
        nome: nome || null,
        email: email || null,
        phone: phone || null,
        plataforma: plataforma || null,
        project_id: project_id || null,
        tags: tags || [],
        status: "lead",
        data: leadData || {},
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, lead: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: project_status
    if (req.method === "GET" && action === "project_status") {
      const projectId = url.searchParams.get("project_id");
      if (!projectId) throw new Error("project_id is required");

      const [projRes, leadsRes, cardsRes, revenueRes] = await Promise.all([
        supabase.from("imphq_projects").select("*").eq("id", projectId).single(),
        supabase.from("imphq_leads").select("id, status", { count: "exact" }).eq("project_id", projectId),
        supabase.from("imphq_kanban_cards").select("id, board, priority").contains("tags", [projectId]),
        supabase.from("imphq_project_revenue").select("valor").eq("project_id", projectId),
      ]);

      const totalRevenue = (revenueRes.data || []).reduce((s: number, r: any) => s + (parseFloat(r.valor) || 0), 0);
      const leadsByStatus: Record<string, number> = {};
      (leadsRes.data || []).forEach((l: any) => {
        leadsByStatus[l.status || "lead"] = (leadsByStatus[l.status || "lead"] || 0) + 1;
      });

      return new Response(JSON.stringify({
        success: true,
        project: projRes.data,
        summary: {
          total_leads: leadsRes.count || 0,
          leads_by_status: leadsByStatus,
          total_tasks: (cardsRes.data || []).length,
          total_revenue: totalRevenue,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: create_task, create_lead, project_status" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
