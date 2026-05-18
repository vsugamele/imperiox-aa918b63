// Recovery Bucket Dispatch — dispara WhatsApp para todos itens de um bucket,
// gerando copy personalizada via Lovable AI Gateway. Logs em recovery_logs + ai_actions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

type BucketId = "pix_urgent" | "pix_cooling" | "boleto_due" | "abandoned_cart" | "refunds";

const BUCKET_INTENT: Record<BucketId, string> = {
  pix_urgent: "Pix gerado há poucos minutos sem confirmação. Tom: urgência amigável, oferta de ajuda imediata. Máx 2 linhas.",
  pix_cooling: "Pix gerado há algumas horas, esfriou. Tom: reabrir conversa, perguntar se rolou dúvida. Máx 2 linhas.",
  boleto_due: "Boleto próximo do vencimento. Tom: lembrete prático, oferecer trocar por Pix. Máx 2 linhas.",
  abandoned_cart: "Checkout abandonado sem pagamento gerado. Tom: curiosidade + valor, sem desconto. Máx 2 linhas.",
  refunds: "Reembolso recente. Tom: empatia + entender motivo, sem pressão. Máx 2 linhas.",
};

function normalizePhone(p: string): string {
  let s = (p || "").replace(/\D/g, "");
  if (s.length === 10 || s.length === 11) s = "55" + s;
  return s;
}

async function findActiveProvider(supabase: any, projectId: string) {
  const { data } = await supabase
    .from("imphq_wa_providers")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  if (data) return data;
  const { data: any2 } = await supabase
    .from("imphq_wa_providers")
    .select("*")
    .eq("is_active", true)
    .limit(1).maybeSingle();
  return any2;
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

async function aiCopy(bucket: BucketId, nome: string, produto: string, valor: number, projeto: any): Promise<string> {
  const fallback = `Oi ${nome || ""}! Vi seu interesse em *${produto || "nossa oferta"}*. Posso te ajudar a finalizar agora?`;
  if (!LOVABLE_API_KEY) return fallback;
  const avatar = projeto?.avatar || {};
  const brand = projeto?.brand_kit || {};
  const persona = avatar?.nome || "consultor";
  const tom = brand?.tom_de_voz || "consultivo, próximo, direto";
  const intent = BUCKET_INTENT[bucket];
  const prompt = `Você é ${persona} de ${projeto?.name || "uma marca premium"}, tom ${tom}.
Contexto: ${intent}
Lead: ${nome || "(sem nome)"} | Produto: ${produto || "(genérico)"} | Valor: R$ ${valor || 0}.
Escreva UMA mensagem WhatsApp curta com 1 emoji. Sem "olá tudo bem", sem clichês. Responda APENAS com a mensagem.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch { return fallback; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const projectId: string = body?.project_id;
    const bucket: BucketId = body?.bucket;
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    const maxSend: number = Math.min(Math.max(Number(body?.max) || 25, 1), 100);

    if (!projectId || !bucket || items.length === 0) {
      return new Response(JSON.stringify({ error: "project_id, bucket e items são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const provider = await findActiveProvider(supabase, projectId);
    if (!provider) {
      return new Response(JSON.stringify({ error: "Nenhum provider WhatsApp ativo para o projeto." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: projeto } = await supabase
      .from("imphq_projects").select("name, avatar, brand_kit").eq("id", projectId).maybeSingle();

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const target = items.slice(0, maxSend);
    let sent = 0, skipped = 0;
    const details: any[] = [];

    for (const it of target) {
      const phone = normalizePhone(it.phone || "");
      if (phone.length < 12 || !it.leadId) { skipped++; details.push({ id: it.id, ok: false, error: "phone_invalid" }); continue; }

      // Anti-spam: já houve dispatch deste bucket nas últimas 24h?
      const { count } = await supabase
        .from("imphq_recovery_logs")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", it.leadId)
        .eq("bucket", bucket)
        .eq("acao", "bucket_dispatch_ai")
        .gte("created_at", since24h);
      if ((count || 0) > 0) { skipped++; details.push({ id: it.id, ok: false, error: "already_sent_24h" }); continue; }

      const message = await aiCopy(bucket, it.leadName || "", it.product || "", Number(it.value) || 0, projeto);
      const result = await sendWhatsApp(provider, phone, message);

      await supabase.from("imphq_recovery_logs").insert({
        project_id: projectId,
        lead_id: it.leadId,
        venda_id: it.vendaId || null,
        bucket,
        acao: "bucket_dispatch_ai",
        canal: "whatsapp",
        status: result.ok ? "enviado" : "falha",
        valor: it.value || 0,
        observacao: result.ok ? "Disparo IA por bucket" : (result.error || "falha"),
      } as any);

      await supabase.from("imphq_ai_actions").insert({
        kind: "recovery_bucket_dispatch",
        risk_level: "low",
        confidence: 0.85,
        title: `Recuperação ${bucket} → ${it.leadName || phone}`,
        reason: `Disparo manual de bucket com copy IA.`,
        payload: { lead_id: it.leadId, venda_id: it.vendaId, bucket, message, valor: it.value },
        result: { ok: result.ok, error: result.error || null },
        projeto_id: projectId,
        source: "recovery-bucket-dispatch",
        status: result.ok ? "executed" : "failed",
        auto_executed: false,
        executed_at: now.toISOString(),
        error: result.ok ? null : (result.error || null),
      } as any);

      if (result.ok) sent++; else skipped++;
      details.push({ id: it.id, ok: result.ok, error: result.error });
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, total: target.length, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[recovery-bucket-dispatch] Error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
