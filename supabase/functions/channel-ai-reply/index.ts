import { isNativeCinna, readCinnaRuntime, writeCinnaRuntime, planCinnaReply } from "../_shared/cinna-openflow.ts";
import { z } from "https://esm.sh/zod@3.25.76";
const stepSchema = z.object({ tipo: z.string().nullish(), mensagem: z.string().nullish(), template: z.string().nullish(), texto: z.string().nullish(), url: z.string().nullish() }).passthrough();
// channel-ai-reply — agente de resposta para canais não-WhatsApp (Messenger via Zernio, Webchat do site).
// Responde perguntas fora do script, manda o link de checkout quando há intenção de compra
// e retoma o fluxo do OpenFlow no passo correto (wait_reply / input_capture).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAiChat } from "../_shared/ai-call.ts";
import { sendToChannel } from "../_shared/channel-out.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUY_INTENT = [
  /\b(buy|order|purchase|checkout|how (do|can) i (get|buy|order))\b/i,
  /\b(i(?:'m| am)? in|let'?s do it|send (me )?the link|where do i pay|take my money)\b/i,
  /\b(quero|comprar|link|finalizar|pagar|fechado|vou querer)\b/i,
];

const BANNED = ["cure", "cures", "heal disease", "guaranteed results", "miracle", "fda approved"];

function findLink(steps: z.infer<typeof stepSchema>[], kind: "checkout" | "advertorial"): string | null {
  const needle = kind === "checkout" ? /(shop|checkout|cart|buy)/i : /(advertorial|article|journal)/i;
  for (const s of steps || []) {
    const txt = `${s?.mensagem || ""} ${s?.template || ""} ${s?.texto || ""} ${s?.url || ""}`;
    for (const m of txt.match(/https?:\/\/[^\s)"']+/g) || []) {
      if (needle.test(m)) return m;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const body = await req.json();
    const sessionId = body.session_id;
    const incoming = String(body.message || body.text || "").trim();
    if (!sessionId) throw new Error("session_id obrigatório");

    const { data: session } = await supabase
      .from("imphq_channel_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) throw new Error("sessão não encontrada");

    const projectId = body.project_id || session.project_id;

    // ── Execução ativa deste canal ─────────────────────────────────────────
    const { data: exec } = await supabase
      .from("imphq_flow_executions")
      .select("id, automacao_id, current_step, trigger_tipo, status, step_results")
      .eq("channel_session_id", sessionId)
      .in("status", ["running", "waiting"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let steps: z.infer<typeof stepSchema>[] = [];
    let activeStep: z.infer<typeof stepSchema> | null = null;
    let automacaoNome = "";
    if (exec?.automacao_id) {
      const { data: auto } = await supabase
        .from("imphq_automacoes")
        .select("id, nome, acoes")
        .eq("id", exec.automacao_id)
        .maybeSingle();
      if (auto) {
        automacaoNome = auto.nome || "";
        steps = z.array(stepSchema).parse(auto.acoes || []);
        activeStep = steps[exec.current_step] || null;
      }
    }

    // Cinna uses the pinned native script and intent-only policy, never the generic closer.
    const cinnaRuntime = readCinnaRuntime(exec?.step_results);
    if (cinnaRuntime || isNativeCinna(steps)) {
      if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return Response.json({ error: "Unauthorized Cinna caller" }, { status: 401, headers: corsHeaders });
      if (!exec || !cinnaRuntime) throw new Error("Cinna execution snapshot missing; restart from native executor");
      if (session.project_id !== projectId || !["messenger", "webchat"].includes(session.canal)) throw new Error("Unsupported Cinna channel/project");
      if (cinnaRuntime.state.status !== "active") return Response.json({ ok: true, ignored: true, status: cinnaRuntime.state.status }, { headers: corsHeaders });
      if (exec.status !== "waiting" || cinnaRuntime.pending) throw new Error("Cinna turn already claimed or delivery uncertain; review execution");
      let eventQuery = supabase.from("imphq_channel_messages").select("id, texto").eq("session_id", session.id).eq("direction", "in");
      if (typeof body.event_id === "string") eventQuery = eventQuery.eq("id", body.event_id);
      const { data: event, error: eventError } = await eventQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (eventError || !event || typeof event.id !== "string" || String(event.texto || "").trim() !== incoming) throw new Error("Persisted incoming event required");
      if (cinnaRuntime.state.processedEventIds.includes(event.id)) return Response.json({ ok: true, ignored: true }, { headers: corsHeaders });
      const { data: claimed, error: claimError } = await supabase.from("imphq_flow_executions")
        .update({ status: "running", next_run_at: null }).eq("id", exec.id).eq("status", "waiting")
        .eq("current_step", exec.current_step).eq("step_results", JSON.stringify(exec.step_results)).select("id").maybeSingle();
      if (claimError || !claimed) throw new Error("Cinna turn concurrently claimed");
      const save = async (status: string, errorMessage: string | null = null) => {
        const { error } = await supabase.from("imphq_flow_executions").update({ status, next_run_at: null,
          step_results: writeCinnaRuntime(exec.step_results, cinnaRuntime), error_message: errorMessage }).eq("id", exec.id);
        if (error) throw new Error("Unable to persist Cinna turn; delivery requires review");
      };
      let dispatched = false;
      try {
        const plan = await planCinnaReply(cinnaRuntime, exec.current_step, event.id, incoming, async request => {
          const response = await callAiChat({ model: cinnaRuntime.snapshot.model, temperature: 0,
            messages: [{ role: "system", content: `Classify intent only. Return JSON {"intent":"..."}. Allowed: ${request.allowedIntents.join(",")}. Question: ${request.question}` },
              { role: "user", content: request.message }], tag: "cinna-native-intent", timeoutMs: 25000 });
          return JSON.parse(response.content);
        });
        cinnaRuntime.pending = { eventId: event.id, decision: plan.decision, messages: plan.messages, confirmed: 0, uncertain: false };
        await save("running");
        for (const message of plan.messages) {
          // Persist uncertainty before network I/O; a crash must never trigger a blind resend.
          cinnaRuntime.pending.uncertain = true;
          await save("running");
          const sent = await sendToChannel(supabase, session, message);
          if (!sent.success) {
            await save("running", "Cinna delivery unconfirmed; manual reconciliation required");
            return Response.json({ ok: false, sent: false, partial: cinnaRuntime.pending.confirmed > 0, resumed: false }, { status: 502, headers: corsHeaders });
          }
          cinnaRuntime.pending.confirmed++;
          cinnaRuntime.pending.uncertain = false;
          await save("running");
        }
        cinnaRuntime.state = plan.decision.state;
        delete cinnaRuntime.pending;
        if (plan.resumeStep !== null) {
          cinnaRuntime.resumeToken = crypto.randomUUID();
          await save("running");
          dispatched = true;
          const response = await fetch(`${SUPABASE_URL}/functions/v1/openflow-executor`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ trigger_tipo: exec.trigger_tipo || `${session.canal}_mensagem_recebida`, project_id: projectId,
              automacao_id: exec.automacao_id, execution_id: exec.id, cinna_resume_token: cinnaRuntime.resumeToken,
              resume_from_step: plan.resumeStep, lead_data: { canal: session.canal, channel_session_id: session.id } }),
          });
          const resumedBody: unknown = await response.json();
          const { data: resumedExecution, error: resumedError } = await supabase.from("imphq_flow_executions").select("current_step, status, error_message")
            .eq("id", exec.id).maybeSingle();
          if (!response.ok || !resumedBody || resumedError || !resumedExecution || resumedExecution.current_step <= exec.current_step ||
              !["waiting", "completed"].includes(resumedExecution.status) || resumedExecution.error_message) throw new Error("Cinna resume unconfirmed; review execution before retry");
          return Response.json({ ok: true, sent: true, resumed: true, action: plan.decision.action }, { headers: corsHeaders });
        }
        // Terminal states stay waiting without a timer, preventing new automated conversations.
        await save("waiting");
        return Response.json({ ok: true, sent: true, resumed: false, action: plan.decision.action }, { headers: corsHeaders });
      } catch (error) {
        if (!dispatched) await save("running", "Cinna turn interrupted; manual reconciliation required");
        // Once dispatched the executor owns checkpoints; never overwrite its delivery evidence.
        throw error;
      }
    }

    // ── Histórico curto da conversa ────────────────────────────────────────
    const { data: hist } = await supabase
      .from("imphq_channel_messages")
      .select("direction, texto, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(14);
    const history = (hist || []).reverse().map((m) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: String(m.texto || "").slice(0, 900),
    }));

    const linkCheckout = session.meta?.link_checkout || findLink(steps, "checkout");
    const linkAdvertorial = session.meta?.link_advertorial || findLink(steps, "advertorial");
    const wantsToBuy = BUY_INTENT.some((re) => re.test(incoming));

    const stepInstruction = activeStep?.mensagem || activeStep?.template || activeStep?.texto || "";
    const isEn = /\[EN-US\]|EN-US/i.test(automacaoNome) || session.canal === "messenger";

    const system = [
      `You are the closer inside the "${automacaoNome || "sales"}" conversation flow on ${session.canal}.`,
      isEn ? "Reply in natural US English." : "Responda em português do Brasil.",
      "Style: short WhatsApp-style messages (1-3 sentences), no bullet lists, no emojis spam, human tone.",
      "Your job: answer the lead's question honestly, keep the sale moving, then hand control back to the script.",
      "Never make medical claims. Never use these words: " + BANNED.join(", ") + ".",
      "Never invent prices, shipping times or guarantees that were not stated in the conversation.",
      "If the lead shows any buying intent, give the checkout link immediately and confirm the next step.",
      linkCheckout ? `Checkout link: ${linkCheckout}` : "No checkout link available — ask the lead to hold on.",
      linkAdvertorial ? `Reference article: ${linkAdvertorial}` : "",
      stepInstruction ? `Current script step (return to this after answering): "${String(stepInstruction).slice(0, 500)}"` : "",
      wantsToBuy ? "The lead just showed buying intent — send the checkout link in this reply." : "",
      "Output only the message text.",
    ].filter(Boolean).join("\n");

    const { content } = await callAiChat({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: incoming || "(no text)" },
      ],
      temperature: 0.7,
      timeoutMs: 45_000,
      tag: "channel-ai-reply",
    });

    let reply = String(content || "").trim();
    for (const w of BANNED) reply = reply.replace(new RegExp(w, "gi"), "");
    if (wantsToBuy && linkCheckout && !reply.includes(linkCheckout)) {
      reply = `${reply}\n\n${linkCheckout}`.trim();
    }
    if (!reply) reply = isEn ? "One sec — let me check that for you." : "Um instante, já verifico isso pra você.";

    const sent = await sendToChannel(supabase, session, reply);

    // ── Retoma o fluxo quando o passo ativo estava esperando resposta ──────
    let resumed = false;
    if (exec && exec.status === "waiting" && (activeStep?.tipo === "wait_reply" || activeStep?.tipo === "input_capture")) {
      const resumeStep = activeStep.tipo === "input_capture" ? exec.current_step : exec.current_step + 1;
      await supabase
        .from("imphq_flow_executions")
        .update({ status: "running", current_step: resumeStep })
        .eq("id", exec.id);

      fetch(`${SUPABASE_URL}/functions/v1/openflow-executor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          trigger_tipo: exec.trigger_tipo || `${session.canal}_mensagem_recebida`,
          project_id: projectId,
          automacao_id: exec.automacao_id,
          resume_from_step: resumeStep,
          lead_data: {
            canal: session.canal,
            channel_session_id: session.id,
            nome: session.nome || "Lead",
            resumed_by: "reply",
            reply_content: incoming,
            message_content: incoming,
            mensagem_recebida: incoming,
          },
        }),
      }).catch((e: unknown) => console.error("[channel-ai-reply] resume error:", e instanceof Error ? e.message : String(e)));
      resumed = true;
    }

    return new Response(
      JSON.stringify({ ok: true, reply, sent: sent.success, resumed, buy_intent: wantsToBuy }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[channel-ai-reply]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
