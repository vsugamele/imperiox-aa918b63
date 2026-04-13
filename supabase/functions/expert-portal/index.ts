import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return jsonRes({ error: "Token obrigatório" }, 400);

    // Resolve project from token
    const { data: projects, error } = await sb
      .from("imphq_projects")
      .select("id, name, data, avatar, brand_kit")
      .filter("data->>expert_share_token", "eq", token);

    if (error) throw error;
    if (!projects || projects.length === 0) return jsonRes({ error: "Token inválido ou expirado" }, 404);

    const project = projects[0];
    const projectId = project.id;

    // ─── POST routes ───
    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action;

      if (action === "mark_done") {
        const { content_id, week, day, done } = body;
        if (!content_id) return jsonRes({ error: "content_id obrigatório" }, 400);

        if (done === false) {
          await sb.from("imphq_expert_logs").delete().match({ project_id: projectId, content_id, action: "mark_done" });
        } else {
          await sb.from("imphq_expert_logs").delete().match({ project_id: projectId, content_id, action: "mark_done" });
          await sb.from("imphq_expert_logs").insert({ project_id: projectId, content_id, week, day, action: "mark_done" });
        }
        return jsonRes({ ok: true });
      }

      if (action === "upload_url") {
        const { content_id, filename } = body;
        if (!content_id || !filename) return jsonRes({ error: "content_id e filename obrigatórios" }, 400);

        const ext = filename.split(".").pop() || "mp4";
        const path = `expert-uploads/${projectId}/${content_id}_${Date.now()}.${ext}`;

        const { data: signedData, error: signError } = await sb.storage
          .from("project-media")
          .createSignedUploadUrl(path);

        if (signError) throw signError;

        return jsonRes({ signed_url: signedData.signedUrl, token: signedData.token, path });
      }

      if (action === "register_upload") {
        const { content_id, week, day, file_path, filename } = body;
        if (!content_id || !file_path) return jsonRes({ error: "content_id e file_path obrigatórios" }, 400);

        const { data: urlData } = sb.storage.from("project-media").getPublicUrl(file_path);

        await sb.from("imphq_expert_logs").insert({
          project_id: projectId,
          content_id,
          week,
          day,
          action: "video_upload",
          metadata: { url: urlData.publicUrl, filename: filename || file_path, path: file_path },
        });

        return jsonRes({ ok: true, url: urlData.publicUrl });
      }

      return jsonRes({ error: "Ação desconhecida" }, 400);
    }

    // ─── GET route ───
    const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});

    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [evRes, taskRes, procRes, adsRes, waCampRes, logsRes, docsRes] = await Promise.all([
      sb.from("imphq_calendar_events").select("id, title, start_date, end_date, type").eq("project_id", projectId).gte("start_date", now.toISOString()).lte("start_date", weekEnd.toISOString()).order("start_date"),
      sb.from("imphq_kanban_cards").select("id, title, priority, due_date, column_id, checklist").contains("tags", [projectId]).order("position").limit(20),
      sb.from("imphq_processes").select("id, title, name, steps").eq("project_id", projectId),
      sb.from("imphq_ad_accounts").select("id, platform, account_name, is_active").eq("project_id", projectId).limit(10),
      sb.from("imphq_wa_campaigns").select("id, name, status").eq("project_id", projectId).eq("status", "active").limit(10),
      sb.from("imphq_expert_logs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(500),
      // Fetch docs shared with expert (tagged with expert_visible)
      sb.from("imphq_docs").select("id, title, content, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);

    // Filter docs that are marked as expert_visible in project data
    const expertDocIds: string[] = d.expert_doc_ids || [];
    const allDocs = docsRes.data || [];
    const sharedDocs = expertDocIds.length > 0
      ? allDocs.filter((doc: any) => expertDocIds.includes(doc.id))
      : [];

    const tasks = (taskRes.data || []).map((t: any) => {
      const checklist = t.checklist || [];
      return {
        id: t.id, title: t.title, priority: t.priority, due_date: t.due_date,
        column_id: t.column_id, checklist_total: checklist.length,
        checklist_done: checklist.filter((c: any) => c.done).length,
      };
    });

    const adAccounts = adsRes.data || [];
    const activeAds = adAccounts.filter((a: any) => a.is_active);
    const waCampaigns = waCampRes.data || [];

    const operational_status = {
      ads_connected: adAccounts.length > 0,
      ads_active: activeAds.length,
      ads_accounts: adAccounts.map((a: any) => ({ platform: a.platform, name: a.account_name, active: a.is_active })),
      wa_campaigns_active: waCampaigns.length,
      wa_campaigns: waCampaigns.map((c: any) => ({ name: c.name })),
    };

    const response = {
      project_name: project.name,
      expert: d.expert || null,
      content_plan: d.content_plan || {},
      content_objective: d.content_objective || "",
      content_objectives: d.content_objectives || [],
      expert_notes: d.expert_notes || "",
      movement_context: d.movement_context || "",
      brand_kit: project.brand_kit || {},
      events: evRes.data || [],
      tasks,
      processes: (procRes.data || []).map((p: any) => ({
        id: p.id, title: p.title || p.name, steps: p.steps || [],
      })),
      operational_status,
      expert_logs: logsRes.data || [],
      shared_docs: sharedDocs.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        created_at: doc.created_at,
      })),
    };

    return jsonRes(response);
  } catch (e: any) {
    console.error("expert-portal error:", e);
    return jsonRes({ error: e.message || "Erro interno" }, 500);
  }
});
