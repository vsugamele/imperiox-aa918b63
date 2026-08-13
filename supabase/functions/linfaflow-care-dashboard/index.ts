import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

type CareSession = {
  id: string;
  public_token: string;
  lead_id: string | null;
  name: string | null;
  contact: string | null;
  intake: Record<string, string> | null;
  score: number;
  stage: string;
  status: string;
  script_step: number;
  checkout_clicked_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

const quizStepLabels = [
  "Motivo da busca",
  "Onde aparece",
  "Quando piora",
  "Gatilhos diarios",
  "Ha quanto tempo",
  "O que ja tentou",
  "Impacto no dia",
  "Sinais de seguranca",
  "Medicacao e condicoes",
  "Preferencia de contato",
];

function getClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readAuthPayload(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function recoveryBucket(session: CareSession) {
  if (session.status === "checkout_clicked") return "checkout_clicked";
  if (session.stage === "quiz") return "quiz_paused";
  if (session.stage === "offer") return "offer_no_click";
  if (session.script_step >= 5) return "objection_or_late_consult";
  if (session.stage === "consult") return "consult_abandoned";
  if (session.stage === "queue") return "queue_abandoned";
  return "intake_started";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authPayload = readAuthPayload(req);
    if (authPayload?.role !== "authenticated" || !authPayload?.sub) {
      return new Response(JSON.stringify({ ok: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getClient();
    if (!supabase) throw new Error("Supabase service credentials unavailable");

    const { data: sessions, error: sessionsError } = await supabase
      .from("imphq_linfaflow_care_sessions")
      .select("id, public_token, lead_id, name, contact, intake, score, stage, status, script_step, checkout_clicked_at, last_message_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (sessionsError) throw sessionsError;

    const rows = (sessions || []) as CareSession[];
    const sessionIds = rows.map((row) => row.id);
    const { data: events, error: eventsError } = sessionIds.length
      ? await supabase
          .from("imphq_linfaflow_care_events")
          .select("session_id, event_type")
          .in("session_id", sessionIds)
      : { data: [], error: null };
    if (eventsError) throw eventsError;
    const quizCompletedSessions = new Set((events || []).filter((event) => event.event_type === "quiz_completed").map((event) => event.session_id));
    const totals = {
      sessions: rows.length,
      quiz: rows.filter((row) => row.stage === "quiz").length,
      quiz_completed: quizCompletedSessions.size,
      queue: rows.filter((row) => row.stage === "queue").length,
      consult: rows.filter((row) => row.stage === "consult").length,
      offer: rows.filter((row) => row.stage === "offer").length,
      checkout_clicked: rows.filter((row) => row.status === "checkout_clicked").length,
      hot: rows.filter((row) => row.score >= 80).length,
    };

    const stageOrder = ["quiz_paused", "intake_started", "queue_abandoned", "consult_abandoned", "objection_or_late_consult", "offer_no_click", "checkout_clicked"];
    const recovery = stageOrder.map((bucket) => ({
      bucket,
      count: rows.filter((row) => recoveryBucket(row) === bucket).length,
      sessions: rows
        .filter((row) => recoveryBucket(row) === bucket)
        .slice(0, 8)
        .map((row) => ({
          id: row.id,
          public_token: row.public_token,
          lead_id: row.lead_id,
          name: row.name || "Lead",
          contact: row.contact || "Unknown",
          score: row.score,
          stage: row.stage,
          status: row.status,
          script_step: row.script_step,
          quiz_step_label: row.stage === "quiz" ? quizStepLabels[row.script_step] || "Pergunta nao identificada" : undefined,
          concern: row.intake?.concern || "",
          tried: row.intake?.tried || "",
          updated_at: row.updated_at,
        })),
    }));

    const latest = rows.slice(0, 20).map((row) => ({
      id: row.id,
      public_token: row.public_token,
      lead_id: row.lead_id,
      name: row.name || "Lead",
      contact: row.contact || "Unknown",
      score: row.score,
      stage: row.stage,
      status: row.status,
      script_step: row.script_step,
      quiz_step_label: row.stage === "quiz" ? quizStepLabels[row.script_step] || "Pergunta nao identificada" : undefined,
      checkout_clicked_at: row.checkout_clicked_at,
      concern: row.intake?.concern || "",
      timeline: row.intake?.timeline || "",
      tried: row.intake?.tried || "",
      updated_at: row.updated_at,
      recovery_bucket: recoveryBucket(row),
    }));

    return new Response(JSON.stringify({ ok: true, totals, recovery, latest }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[linfaflow-care-dashboard] error", error?.message || error);
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
