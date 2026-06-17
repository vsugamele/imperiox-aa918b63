// Hot Lead Auto-Responder — varre leads com score>70 com Pix/Boleto recente
// e dispara mensagem personalizada via WhatsApp. Auto-executa (low risk).
// Persona/branding usados via avatar do projeto se disponível.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

function normalizePhone(p: string): string {
  let s = (p || "").replace(/\D/g, "");
  if (s.length === 10 || s.length === 11) s = "55" + s;
  return s;
}

async function findActiveProvider(supabase: any, projectId: string | null) {
  // Hierarquia: 1) provider ativo do projeto  2) qualquer provider ativo global (fallback)
  if (projectId) {
    const { data } = await supabase
      .from("imphq_wa_providers")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(1).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("imphq_wa_providers")
    .select("*")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  return data;
}

async function sendWhatsApp(provider: any, phone: string, message: string) {
  if (!provider) return { ok: false, error: "no_provider" };
  try {
    if (provider.provider === "evolution") {
      const url = `${provider.api_url.replace(/\/$/, "")}/message/sendText/${provider.instance_name}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: provider.api_key },
        body: JSON.stringify({ number: phone, text: message }),
      });
      if (!res.ok) return { ok: false, error: `evolution_${res.status}` };
      return { ok: true };
    }
    return { ok: false, error: "provider_unsupported" };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function aiCopy(nome: string, produto: string, projeto: any): Promise<string> {
  const fallback = `Oi ${nome || ""}! 👋 Vi seu interesse em *${produto || "nossa oferta"}* — quero garantir que você não perca essa chance. Posso te enviar o link de pagamento ou tirar qualquer dúvida agora?`;
  if (!OPENROUTER_API_KEY) return fallback;

  const avatar = projeto?.avatar || {};
  const brand = projeto?.brand_kit || {};
  const persona = avatar?.nome || "consultor";
  const tom = brand?.tom_de_voz || "consultivo, próximo, direto";

  const prompt = `Você é ${persona} de ${projeto?.name || "uma marca premium"}, tom ${tom}. Escreva UMA mensagem WhatsApp curta (máx 2 linhas, com 1 emoji) para ${nome || "o lead"}, que demonstrou intenção de compra de "${produto || "nosso produto"}". Objetivo: reativar e oferecer ajuda imediata. Sem clichês, sem "olá tudo bem". Vá direto ao valor. Responda APENAS com a mensagem.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${OPENROUTER_API_KEY}` 
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3.1",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const txt = json?.choices?.[0]?.message?.content?.trim();
    return txt || fallback;
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const since30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Modo direcionado: { venda_id } enviado pelo webhook-pagamento (inline) → processa SÓ aquela venda
    let body: any = null;
    try { body = await req.json(); } catch { body = null; }
    const targetVendaId: string | null = body?.venda_id || null;

    let vendas: any[] | null = null;
    if (targetVendaId) {
      const { data } = await supabase
        .from("imphq_vendas")
        .select("id, lead_id, project_id, produto_nome, valor, status, data, created_at")
        .eq("id", targetVendaId)
        .limit(1);
      vendas = data || [];
    } else {
      // Modo cron: varre últimos 30min
      const { data } = await supabase
        .from("imphq_vendas")
        .select("id, lead_id, project_id, produto_nome, valor, status, data, created_at")
        .in("status", ["aguardando_pagamento", "pix_gerado", "boleto_gerado", "pendente"])
        .or(`created_at.gte.${since30min},data->>last_intent_at.gte.${since30min}`)
        .limit(100);
      vendas = data || [];
    }

    if (!vendas || vendas.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, sent: 0, mode: targetVendaId ? "direct" : "cron" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0, skipped = 0;
    const details: any[] = [];

    for (const v of vendas) {
      if (!v.lead_id) { skipped++; continue; }
      const meta: any = v.data || {};
      if (meta.hot_lead_responder_sent) { skipped++; continue; }

      const { data: lead } = await supabase
        .from("imphq_leads")
        .select("id, nome, phone, project_id, score")
        .eq("id", v.lead_id)
        .maybeSingle();

      if (!lead) { skipped++; continue; }
      // No modo "direct" (invocado pelo webhook do PIX), ignora threshold de score
      if (!targetVendaId && (lead.score || 0) < 70) { skipped++; continue; }

      const phone = normalizePhone(lead.phone || "");
      if (phone.length < 12) { skipped++; continue; }

      // Anti-spam: já recebeu hot_lead_responder nas últimas 24h?
      const { count: recentCount } = await supabase
        .from("imphq_ai_actions")
        .select("id", { count: "exact", head: true })
        .eq("kind", "hot_lead_responder")
        .gte("created_at", since24h)
        .contains("payload", { lead_id: lead.id });
      if ((recentCount || 0) > 0) { skipped++; continue; }


      const projectId = v.project_id || lead.project_id;
      const { data: projeto } = projectId
        ? await supabase.from("imphq_projects").select("name, avatar, brand_kit").eq("id", projectId).maybeSingle()
        : { data: null } as any;

      const message = await aiCopy(lead.nome || "", v.produto_nome || "", projeto);
      const provider = await findActiveProvider(supabase, projectId);
      const result = await sendWhatsApp(provider, phone, message);

      // Marca venda
      await supabase.from("imphq_vendas").update({
        data: { ...meta, hot_lead_responder_sent: now.toISOString(), hot_lead_responder_ok: result.ok },
      }).eq("id", v.id);

      await supabase.from("imphq_ai_actions").insert({
        kind: "hot_lead_responder",
        risk_level: "low",
        confidence: 0.88,
        title: `Hot lead reativado: ${lead.nome || phone}`,
        reason: `Score ${lead.score}, Pix/Boleto há <30min sem confirmação. Mensagem IA enviada.`,
        payload: { lead_id: lead.id, venda_id: v.id, valor: v.valor, message },
        result: { ok: result.ok, error: result.error || null },
        projeto_id: projectId || null,
        source: "hot-lead-responder",
        status: result.ok ? "executed" : "failed",
        auto_executed: true,
        executed_at: now.toISOString(),
        error: result.ok ? null : (result.error || null),
      });

      if (result.ok) sent++; else skipped++;
      details.push({ lead_id: lead.id, venda_id: v.id, ok: result.ok });
    }

    return new Response(
      JSON.stringify({ ok: true, processed: vendas.length, sent, skipped, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[hot-lead-responder] Error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno.", code: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
