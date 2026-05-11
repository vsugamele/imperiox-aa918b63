import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Step = {
  kind: "image" | "video" | "audio";
  provider: "openrouter" | "kie" | "luma" | "elevenlabs";
  model: string;
  prompt: string;
  params?: Record<string, any>;
  voice_id?: string;
  image_url?: string;
};

function resolveVars(text: string | undefined, outputs: Record<string, string>): string | undefined {
  if (!text) return text;
  return text.replace(/\{\{step(\d+)\.output\}\}/g, (_, n) => outputs[n] || "");
}

function resolveStep(step: Step, outputs: Record<string, string>): Step {
  return {
    ...step,
    prompt: resolveVars(step.prompt, outputs) || step.prompt,
    image_url: resolveVars(step.image_url, outputs) || undefined,
  };
}

async function pollGeneration(admin: any, generationId: string, timeoutMs = 300_000): Promise<{ ok: boolean; output_url?: string; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data: g } = await admin.from("imphq_studio_generations").select("status,output_url,error").eq("id", generationId).single();
    if (!g) return { ok: false, error: "generation não encontrada" };
    if (g.status === "completed" && g.output_url) return { ok: true, output_url: g.output_url };
    if (g.status === "failed") return { ok: false, error: g.error || "falhou" };
    // trigger status check for async providers
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/studio-generate-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: generationId }),
      });
    } catch (_) { /* ignore */ }
    await new Promise((r) => setTimeout(r, 6000));
  }
  return { ok: false, error: "timeout aguardando geração" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    let steps: Step[] = body.steps;
    let workflowId: string | null = body.workflow_id || null;
    const projetoId: string | null = body.projeto_id || null;

    if (!steps && workflowId) {
      const { data: wf } = await supabase.from("imphq_studio_workflows").select("steps").eq("id", workflowId).eq("user_id", userId).single();
      if (!wf) throw new Error("workflow não encontrado");
      steps = wf.steps as Step[];
    }
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return new Response(JSON.stringify({ error: "steps obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: run, error: runErr } = await supabase.from("imphq_studio_workflow_runs").insert({
      workflow_id: workflowId,
      user_id: userId,
      status: "running",
      current_step: 0,
      step_outputs: {},
      generation_ids: {},
    }).select().single();
    if (runErr) throw runErr;

    // Run async (fire and return). Use waitUntil-like background task.
    (async () => {
      const outputs: Record<string, string> = {};
      const genIds: Record<string, string> = {};
      for (let i = 0; i < steps.length; i++) {
        const stepNum = i + 1;
        await supabase.from("imphq_studio_workflow_runs").update({ current_step: stepNum }).eq("id", run.id);

        const step = resolveStep(steps[i], outputs);
        const payload: any = {
          kind: step.kind,
          provider: step.provider,
          model: step.model,
          prompt: step.prompt,
          params: step.params || {},
          projeto_id: projetoId,
        };
        if (step.image_url) payload.image_url = step.image_url;
        if (step.voice_id) payload.voice_id = step.voice_id;

        // call studio-generate as user
        const r = await fetch(`${SUPABASE_URL}/functions/v1/studio-generate`, {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const gen = await r.json();
        if (!gen?.ok || !gen?.id) {
          await supabase.from("imphq_studio_workflow_runs").update({
            status: "failed",
            error: `Step ${stepNum}: ${gen?.error || "falha ao iniciar"}`,
          }).eq("id", run.id);
          return;
        }
        genIds[String(stepNum)] = gen.id;
        await supabase.from("imphq_studio_workflow_runs").update({ generation_ids: genIds }).eq("id", run.id);

        let outputUrl: string | undefined = gen.output_url;
        if (!outputUrl) {
          const polled = await pollGeneration(supabase, gen.id);
          if (!polled.ok) {
            await supabase.from("imphq_studio_workflow_runs").update({
              status: "failed",
              error: `Step ${stepNum}: ${polled.error}`,
            }).eq("id", run.id);
            return;
          }
          outputUrl = polled.output_url;
        }
        outputs[String(stepNum)] = outputUrl!;
        await supabase.from("imphq_studio_workflow_runs").update({ step_outputs: outputs }).eq("id", run.id);
      }
      await supabase.from("imphq_studio_workflow_runs").update({ status: "completed" }).eq("id", run.id);
    })().catch(async (e) => {
      console.error("workflow run fatal:", e);
      await supabase.from("imphq_studio_workflow_runs").update({
        status: "failed",
        error: String(e?.message || e),
      }).eq("id", run.id);
    });

    return new Response(JSON.stringify({ ok: true, run_id: run.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("studio-workflow-run:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
