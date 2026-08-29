// channel-ai-reply — agente de resposta para canais não-WhatsApp (Messenger via Zernio, Webchat do site).
// Responde perguntas fora do script, manda o link de checkout quando há intenção de compra
// e retoma o fluxo do OpenFlow no passo correto (wait_reply / input_capture).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
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

function findLink(steps: any[], kind: "checkout" | "advertorial"): string | null {
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

    let steps: any[] = [];
    let activeStep: any = null;
    let automacaoNome = "";
    if (exec?.automacao_id) {
      const { data: auto } = await supabase
        .from("imphq_automacoes")
        .select("id, nome, acoes")
        .eq("id", exec.automacao_id)
        .maybeSingle();
      if (auto) {
        automacaoNome = auto.nome || "";
        steps = (auto.acoes || auto.etapas || []) as any[];
        activeStep = steps[exec.current_step] || null;
      }
    }

    // ── Histórico curto da conversa ────────────────────────────────────────
    const { data: hist } = await supabase
      .from("imphq_channel_messages")
      .select("direction, texto, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(14);
    const history = (hist || []).reverse().map((m: any) => ({
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

    const sent = await sendToChannel(supabase, session as any, reply);

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
      }).catch((e: any) => console.error("[channel-ai-reply] resume error:", e?.message));
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
