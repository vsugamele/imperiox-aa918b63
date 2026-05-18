// Worker assíncrono: consome um job de imphq_ai_jobs, chama openflow-ai e grava o resultado.
// Frontend faz fire-and-forget desta função e depois faz polling na tabela.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function processJob(jobId: string, callerAuth: string | null) {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: job, error } = await sb.from("imphq_ai_jobs").select("*").eq("id", jobId).single();
  if (error || !job) {
    console.error("[ai-job-runner] Job not found", jobId, error);
    return;
  }

  await sb.from("imphq_ai_jobs").update({ status: "processing" }).eq("id", jobId);

  try {
    const body = { ...(job.payload || {}), action: job.action, model: job.model, project_id: job.project_id };
    const res = await fetch(`${SUPABASE_URL}/functions/v1/openflow-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: callerAuth || `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let result: any;
    try { result = JSON.parse(txt); } catch { result = { raw: txt }; }

    if (!res.ok) {
      await sb.from("imphq_ai_jobs").update({
        status: "failed",
        error: `HTTP ${res.status}: ${(result?.error || txt).toString().slice(0, 500)}`,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    await sb.from("imphq_ai_jobs").update({
      status: "ready",
      result,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (e: any) {
    console.error("[ai-job-runner] Failed", jobId, e);
    await sb.from("imphq_ai_jobs").update({
      status: "failed",
      error: (e?.message || String(e)).slice(0, 500),
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const auth = req.headers.get("Authorization");
    // @ts-ignore EdgeRuntime is provided by Supabase
    EdgeRuntime.waitUntil(processJob(job_id, auth));
    return new Response(JSON.stringify({ ok: true, job_id, status: "processing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
