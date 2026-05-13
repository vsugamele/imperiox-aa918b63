// Payment Recovery — 3 toques escalonados (15min, 2h, 24h) com A/B copy.
// Persiste estado em imphq_vendas.data, log em imphq_recovery_logs e imphq_ai_actions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PENDING_STATUSES = ["aguardando_pagamento", "pix_gerado", "boleto_gerado", "pendente"];

type Variant = { id: string; build: (nome: string, produto: string) => string };
type Level = { level: number; minMin: number; maxMin: number; variants: Variant[] };

// 3 toques: 15min, 2h, 24h. Cada nível tem 2 variantes A/B.
const RECOVERY_LEVELS: Level[] = [
  {
    level: 1,
    minMin: 15,
    maxMin: 119,
    variants: [
      { id: "L1A", build: (n, p) => `Oi ${n || ""}! 👋 Vi que você gerou o pagamento de *${p}* mas ainda não foi confirmado. Posso te ajudar a finalizar agora?` },
      { id: "L1B", build: (n, p) => `${n || "Olá"}! Notei que o pagamento de *${p}* está pendente há alguns minutos. Tá tudo certo? Se precisar de outro link ou Pix, me chama aqui.` },
    ],
  },
  {
    level: 2,
    minMin: 120,
    maxMin: 1439,
    variants: [
      { id: "L2A", build: (n, p) => `${n || "Ei"}, ainda dá tempo! 🔥 Sua reserva de *${produto(p)}* está prestes a expirar. Quer que eu gere um novo link rápido?` },
      { id: "L2B", build: (n, p) => `${n || "Olá"}! Sua intenção de compra de *${produto(p)}* continua aberta. Se rolou alguma dúvida (preço, prazo, formato), me responde aqui que resolvo agora.` },
    ],
  },
  {
    level: 3,
    minMin: 1440,
    maxMin: 2880,
    variants: [
      { id: "L3A", build: (n, p) => `Última chamada, ${n || ""}! ⏰ A oferta de *${produto(p)}* expira hoje. Posso liberar uma condição exclusiva pra você fechar agora — me responde se ainda quiser.` },
      { id: "L3B", build: (n, p) => `${n || "Olá"}, vou ser direto: *${produto(p)}* sai do carrinho em poucas horas. Se faltou só um empurrão, fala comigo que faço por você.` },
    ],
  },
];

function produto(p: string) { return p || "seu pedido"; }

function normalizePhone(p: string): string {
  let s = (p || "").replace(/\D/g, "");
  if (s.length === 10 || s.length === 11) s = "55" + s;
  return s;
}

function pickVariant(level: Level, vendaId: string): Variant {
  // Hash determinístico do venda_id para A/B estável
  let h = 0;
  for (let i = 0; i < vendaId.length; i++) h = (h * 31 + vendaId.charCodeAt(i)) | 0;
  return level.variants[Math.abs(h) % level.variants.length];
}

async function findActiveProvider(supabase: any, projectId: string | null) {
  if (projectId) {
    const { data } = await supabase
      .from("imphq_whatsapp_config")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("imphq_whatsapp_config")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data;
}

async function sendWhatsApp(provider: any, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { data: vendas, error: vendasErr } = await supabase
      .from("imphq_vendas")
      .select("id, lead_id, project_id, valor, produto_nome, status, data, created_at")
      .in("status", PENDING_STATUSES)
      .gte("created_at", cutoff48h)
      .limit(500);

    if (vendasErr) throw vendasErr;
    if (!vendas || vendas.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;
    const details: any[] = [];

    for (const v of vendas) {
      const ageMin = (now.getTime() - new Date(v.created_at).getTime()) / 60000;
      const meta: any = v.data || {};
      const sentLevels: number[] = Array.isArray(meta.recovery_sent_levels) ? meta.recovery_sent_levels : [];

      const targetLevel = RECOVERY_LEVELS.find(
        (r) => ageMin >= r.minMin && ageMin <= r.maxMin && !sentLevels.includes(r.level)
      );
      if (!targetLevel) { skipped++; continue; }

      if (!v.lead_id) { skipped++; continue; }
      const { data: lead } = await supabase
        .from("imphq_leads")
        .select("id, nome, phone, project_id")
        .eq("id", v.lead_id)
        .maybeSingle();

      const phone = normalizePhone(lead?.phone || "");
      if (!phone || phone.length < 12) { skipped++; continue; }

      const variant = pickVariant(targetLevel, v.id);
      const provider = await findActiveProvider(supabase, v.project_id || lead?.project_id);
      const message = variant.build(lead?.nome || "", v.produto_nome || "");
      const result = await sendWhatsApp(provider, phone, message);

      const newMeta = {
        ...meta,
        recovery_sent_levels: [...sentLevels, targetLevel.level],
        recovery_last: {
          level: targetLevel.level,
          variant: variant.id,
          at: now.toISOString(),
          ok: result.ok,
          error: result.error || null,
          provider: provider?.id || null,
        },
      };
      await supabase.from("imphq_vendas").update({ data: newMeta }).eq("id", v.id);

      // Log em recovery_logs (compat)
      await supabase.from("imphq_recovery_logs").insert({
        project_id: v.project_id || lead?.project_id || null,
        lead_id: v.lead_id,
        venda_id: v.id,
        acao: `recovery_l${targetLevel.level}`,
        bucket: `pix_pendente_${targetLevel.level}`,
        canal: "whatsapp",
        status: result.ok ? "enviado" : "falha",
        valor: v.valor || null,
        observacao: `Variant ${variant.id}${result.error ? ` | ${result.error}` : ""}`,
      });

      // Log em ai_actions (autonomia)
      await supabase.from("imphq_ai_actions").insert({
        kind: "payment_recovery",
        risk_level: "low",
        confidence: 0.9,
        title: `Recovery L${targetLevel.level} → ${lead?.nome || phone}`,
        reason: `Pix/Boleto pendente há ${Math.round(ageMin)}min. Variante ${variant.id}.`,
        payload: { venda_id: v.id, lead_id: v.lead_id, level: targetLevel.level, variant: variant.id, valor: v.valor, message },
        result: { ok: result.ok, error: result.error || null },
        projeto_id: v.project_id || lead?.project_id || null,
        source: "payment-recovery",
        status: result.ok ? "executed" : "failed",
        auto_executed: true,
        executed_at: now.toISOString(),
        error: result.ok ? null : (result.error || null),
      });

      if (result.ok) sent++; else skipped++;
      details.push({ venda_id: v.id, level: targetLevel.level, variant: variant.id, ok: result.ok, error: result.error });
    }

    return new Response(
      JSON.stringify({ ok: true, processed: vendas.length, sent, skipped, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[payment-recovery] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
