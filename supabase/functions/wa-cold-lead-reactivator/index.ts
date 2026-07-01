// wa-cold-lead-reactivator
// Cron a cada 30 min — reativa leads que nao responderam em X horas
// com uma mensagem contextual baseada nas objecoes cadastradas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callLLM(prompt: string, systemMsg: string): Promise<string> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return "";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3.1",
      messages: [{ role: "system", content: systemMsg }, { role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.8,
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function sendWhatsApp(
  supa: any,
  provider: { api_url: string; api_key: string; instance_name: string; provider: string },
  phone: string,
  message: string,
): Promise<boolean> {
  try {
    const apiUrl = provider.api_url?.replace(/\/$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: provider.api_key,
    };
    const url = `${apiUrl}/message/sendText/${provider.instance_name}`;
    const body = { number: phone, text: message };
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();

  try {
    // 1. Busca projetos com cold_lead_reactivation_enabled = true
    const { data: configs } = await supa
      .from("imphq_wa_ai_config")
      .select("project_id, provider_id, cold_lead_hours, product_focus, expert_persona, personality, tone")
      .eq("cold_lead_reactivation_enabled", true)
      .eq("enabled", true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "No projects with reactivation enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalReactivated = 0;
    let totalSkipped = 0;

    for (const config of configs) {
      const coldHours = config.cold_lead_hours || 2;
      const cutoffTime = new Date(now.getTime() - coldHours * 3600 * 1000).toISOString();
      const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

      // 2. Busca conversas frias: lead enviou ultima msg ha X horas, sem resposta da IA depois
      const { data: coldConvs } = await supa
        .from("imphq_wa_conversations")
        .select("id, contact_name, contact_phone, provider_id, last_message_at, last_reactivation_at")
        .eq("project_id", config.project_id)
        .eq("status", "open")
        .neq("status", "needs_human")
        .lt("last_message_at", cutoffTime) // ultima msg do lead foi ha X horas
        .or(`last_reactivation_at.is.null,last_reactivation_at.lt.${oneDayAgo}`) // max 1 reativacao/dia
        .limit(10);

      if (!coldConvs || coldConvs.length === 0) continue;

      // 3. Busca objecoes do projeto para usar no contexto de reativacao
      const { data: objections } = await supa
        .from("imphq_wa_objections")
        .select("objecao, resposta_padrao")
        .eq("projeto_id", config.project_id)
        .eq("status", "ativa")
        .limit(5);

      const objectionsCtx = objections?.length
        ? `\nObjecoes comuns e como contornar:\n${objections.map((o: any) => `- "${o.objecao}": ${o.resposta_padrao}`).join("\n")}`
        : "";

      // 4. Busca provider para envio
      const { data: provider } = await supa
        .from("imphq_wa_providers")
        .select("api_url, api_key, instance_name, provider")
        .eq("id", config.provider_id || coldConvs[0]?.provider_id)
        .single();

      if (!provider) continue;

      for (const conv of coldConvs) {
        try {
          // 5. Gera mensagem de reativacao contextual via LLM
          const name = conv.contact_name?.split(" ")[0] || "você";
          const systemMsg = `Você é um SDR especializado em reativação de leads frios pelo WhatsApp.
${config.expert_persona ? `Persona: ${config.expert_persona}` : ""}
${config.product_focus ? `Produto/Oferta: ${config.product_focus}` : ""}
${objectionsCtx}
Regras:
- Mensagem curta (2-3 frases max)
- Tom ${config.tone || "amigavel"} e natural
- Nao seja insistente. Desperte curiosidade ou resolva uma duvida
- Nunca diga que e IA
- Use o nome "${name}"`;

          const reactivationMsg = await callLLM(
            `O lead "${name}" parou de responder ha mais de ${coldHours} horas. Crie UMA mensagem de reativacao natural e contextual.`,
            systemMsg,
          );

          if (!reactivationMsg) {
            console.warn(`[cold-reactivator] LLM returned empty for conv ${conv.id}`);
            totalSkipped++;
            continue;
          }

          // 6. Envia a mensagem
          const sent = await sendWhatsApp(supa, provider, conv.contact_phone, reactivationMsg);

          if (sent) {
            // 7. Registra a reativacao e salva a mensagem
            await Promise.all([
              supa.from("imphq_wa_conversations")
                .update({ last_reactivation_at: now.toISOString() })
                .eq("id", conv.id),
              supa.from("imphq_wa_messages").insert({
                conversation_id: conv.id,
                direction: "outgoing",
                content: reactivationMsg,
                type: "text",
                status: "sent",
                source: "cold_reactivator",
              }),
            ]);
            totalReactivated++;
            console.log(`[cold-reactivator] Reactivated conv ${conv.id} (${name}): "${reactivationMsg.slice(0, 60)}"`);
          } else {
            console.warn(`[cold-reactivator] Failed to send to conv ${conv.id}`);
            totalSkipped++;
          }
        } catch (e: any) {
          console.error(`[cold-reactivator] Conv ${conv.id} error: ${e.message}`);
          totalSkipped++;
        }

        // Pausa entre envios para evitar rate limit
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return new Response(JSON.stringify({ ok: true, reactivated: totalReactivated, skipped: totalSkipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[cold-reactivator] Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
