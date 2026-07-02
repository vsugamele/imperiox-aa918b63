// wa-consultive-followup — régua consultiva 2h/24h/72h
// Toque 1 (2-6h): dúvida.  Toque 2 (24-30h): objeção preço/tempo.  Toque 3 (72-96h): downsell.
// Só age se: última msg é OUTGOING, lead não respondeu, config habilita, horário comercial ok,
// e não há rejeição clara no histórico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const REJECTION_PATTERNS = [
  /n[ãa]o (quero|tenho interesse|preciso|vou)/i,
  /para de mandar/i,
  /desiste/i,
  /me deixa em paz/i,
  /remove/i,
  /descadastr/i,
  /n[ãa]o me manda/i,
];

const TOUCH_WINDOWS = [
  { touch: 1, minH: 2, maxH: 22, angle: "duvida" },
  { touch: 2, minH: 24, maxH: 70, angle: "objecao_preco" },
  { touch: 3, minH: 72, maxH: 168, angle: "downsell" },
];

function inBusinessHours(cfg: any, now: Date): boolean {
  // Config esperada: { start: "09", end: "20", tz: "America/Sao_Paulo", days: [1..5] }
  // Se não houver config, default 9-20 seg-sab horário BR.
  const brNow = new Date(now.toLocaleString("en-US", { timeZone: cfg?.tz || "America/Sao_Paulo" }));
  const h = brNow.getHours();
  const day = brNow.getDay(); // 0=dom
  const start = Number(cfg?.start ?? 9);
  const end = Number(cfg?.end ?? 20);
  const days = Array.isArray(cfg?.days) && cfg.days.length ? cfg.days : [1, 2, 3, 4, 5, 6];
  return days.includes(day) && h >= start && h < end;
}

async function generateCopy(
  angle: string,
  lead: any,
  produto: string | null,
  projeto: any,
): Promise<string> {
  const nome = String(lead?.nome || "").split(" ")[0] || "";
  const fallbacks: Record<string, string> = {
    duvida: `Oi${nome ? " " + nome : ""}! 👋 Só passando pra saber se ficou alguma dúvida sobre ${produto || "o que a gente conversou"}. Posso te explicar melhor qualquer parte antes de você decidir.`,
    objecao_preco: `Oi${nome ? " " + nome : ""}, tudo bem? Se o investimento tá pesando agora, temos formas de começar mais leve — parcelamento, ou até uma alternativa mais acessível pra você entrar. Quer que eu te mostre?`,
    downsell: `Oi${nome ? " " + nome : ""}! Vi que a gente não fechou ${produto || "aquela conversa"} — sem pressão. Se preferir, tenho uma opção mais enxuta pra você começar agora e evoluir depois. Faz sentido eu te mandar?`,
  };
  const fallback = fallbacks[angle] || fallbacks.duvida;
  if (!LOVABLE_API_KEY) return fallback;

  const brand = projeto?.brand_kit || {};
  const tom = brand?.tom_de_voz || "consultivo, próximo, sem pressão";
  const persona = projeto?.avatar?.nome || "consultor";
  const contextos: Record<string, string> = {
    duvida: "toque consultivo de reengajamento — pergunte se ficou alguma dúvida específica",
    objecao_preco: "quebra suave de objeção de preço/tempo — ofereça alternativa (parcelamento ou produto mais leve)",
    downsell: "convite para produto de entrada / low-ticket — sem forçar, deixe fácil dizer sim",
  };

  const prompt = `Você é ${persona} de ${projeto?.name || "uma marca"}, tom ${tom}. Escreva UMA mensagem curta de WhatsApp (máx 2 linhas, 1 emoji opcional) para ${nome || "o lead"}, sobre o produto "${produto || "que ele demonstrou interesse"}". Contexto: ${contextos[angle]}. Sem clichês, sem "olá tudo bem". Termine com uma pergunta consultiva curta. Responda APENAS com a mensagem.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return fallback;
    const j = await res.json();
    return String(j?.choices?.[0]?.message?.content || "").trim() || fallback;
  } catch {
    return fallback;
  }
}

async function findActiveProvider(supabase: any, projectId: string | null) {
  if (projectId) {
    const { data } = await supabase.from("imphq_wa_providers").select("*")
      .eq("project_id", projectId).eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase.from("imphq_wa_providers").select("*")
    .eq("is_active", true).order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const nowMs = now.getTime();
    const cutoffMs = nowMs - 168 * 3600 * 1000; // olha até 7 dias atrás

    // Pega conversas recentes com potencial de follow-up
    const { data: convs, error } = await supabase
      .from("imphq_wa_conversations")
      .select("id, phone, project_id, lead_id, last_message_at, last_message_direction, followup_state, ai_paused")
      .gte("last_message_at", new Date(cutoffMs).toISOString())
      .eq("last_message_direction", "outgoing")
      .limit(500);

    if (error) throw error;
    if (!convs || convs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0, skipped = 0;
    const details: any[] = [];

    for (const conv of convs) {
      try {
        if (!conv.lead_id || !conv.phone) { skipped++; continue; }
        const lastAt = conv.last_message_at ? new Date(conv.last_message_at as string).getTime() : 0;
        const hoursSince = (nowMs - lastAt) / 3600000;

        // Determina qual toque cabe agora
        const state = (conv as any).followup_state || {};
        const lastTouch = Number(state.last_touch || 0);
        const nextWindow = TOUCH_WINDOWS.find(w => w.touch === lastTouch + 1);
        if (!nextWindow) { skipped++; continue; }
        if (hoursSince < nextWindow.minH || hoursSince > nextWindow.maxH) { skipped++; continue; }

        // Config do projeto
        const { data: cfg } = await supabase
          .from("imphq_wa_ai_config")
          .select("consultive_followup_enabled, business_hours")
          .eq("project_id", conv.project_id)
          .maybeSingle();
        if (cfg?.consultive_followup_enabled === false) { skipped++; continue; }
        if (!inBusinessHours(cfg?.business_hours || null, now)) { skipped++; continue; }

        // Checa últimas mensagens: se lead respondeu (incoming) depois do lastAt, aborta;
        // se há rejeição clara nas últimas 5 incoming, aborta permanentemente.
        const { data: recent } = await supabase.from("imphq_wa_messages")
          .select("direction, content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false }).limit(20);

        const hasIncomingAfter = (recent || []).some((m: any) =>
          m.direction === "incoming" && new Date(m.created_at).getTime() > lastAt
        );
        if (hasIncomingAfter) { skipped++; continue; }

        const incomings = (recent || []).filter((m: any) => m.direction === "incoming").slice(0, 5);
        const rejected = incomings.some((m: any) =>
          REJECTION_PATTERNS.some(rx => rx.test(String(m.content || "")))
        );
        if (rejected) {
          await supabase.from("imphq_wa_conversations")
            .update({ followup_state: { ...state, aborted: "rejection", aborted_at: now.toISOString() } })
            .eq("id", conv.id);
          skipped++; continue;
        }

        // Contexto do lead + projeto
        const { data: lead } = await supabase.from("imphq_leads")
          .select("id, nome, lead_memory, ultimo_produto, project_id")
          .eq("id", conv.lead_id).maybeSingle();
        const projectId = conv.project_id || lead?.project_id;
        const { data: projeto } = projectId
          ? await supabase.from("imphq_projects").select("name, avatar, brand_kit").eq("id", projectId).maybeSingle()
          : { data: null } as any;

        const produto = String(lead?.ultimo_produto || (lead?.lead_memory as any)?.interesse_principal || "").slice(0, 80) || null;
        const message = await generateCopy(nextWindow.angle, lead, produto, projeto);

        // Envia via edge send_message (usa infra existente com failover e atribuição)
        const provider = await findActiveProvider(supabase, projectId);
        if (!provider) { skipped++; continue; }

        const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api?action=send_message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            provider_id: provider.id,
            phone: conv.phone,
            content: message,
            conversation_id: conv.id,
            project_id: projectId,
            sent_by: "ai",
            attribution_context: {
              source: "consultive_followup",
              source_detail: nextWindow.angle,
              metadata: { touch: nextWindow.touch, hours_since_last: hoursSince },
            },
          }),
        });
        const sendJson = await sendRes.json().catch(() => ({}));
        const ok = sendRes.ok && sendJson?.success !== false;

        // Atualiza followup_state
        await supabase.from("imphq_wa_conversations").update({
          followup_state: {
            ...state,
            last_touch: nextWindow.touch,
            last_touch_at: now.toISOString(),
            last_angle: nextWindow.angle,
            last_ok: ok,
          },
        }).eq("id", conv.id);

        // Log Imperius
        await supabase.from("imphq_ai_actions").insert({
          kind: "consultive_followup",
          risk_level: "low",
          confidence: 0.85,
          title: `Follow-up T${nextWindow.touch} (${nextWindow.angle}) → ${lead?.nome || conv.phone}`,
          reason: `${Math.round(hoursSince)}h sem resposta desde última mensagem outgoing. Toque ${nextWindow.touch} da régua consultiva.`,
          payload: { conversation_id: conv.id, lead_id: conv.lead_id, touch: nextWindow.touch, angle: nextWindow.angle, message },
          result: { ok, error: ok ? null : (sendJson?.error || `http_${sendRes.status}`) },
          projeto_id: projectId || null,
          source: "wa-consultive-followup",
          status: ok ? "executed" : "failed",
          auto_executed: true,
          executed_at: now.toISOString(),
          error: ok ? null : (sendJson?.error || `http_${sendRes.status}`),
        });

        if (ok) sent++; else skipped++;
        details.push({ conv: conv.id, touch: nextWindow.touch, ok });
      } catch (convErr: any) {
        console.error("[wa-consultive-followup] conv error:", convErr?.message);
        skipped++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: convs.length, sent, skipped, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[wa-consultive-followup] fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
