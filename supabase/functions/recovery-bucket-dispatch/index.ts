import { z } from "https://esm.sh/zod@3.25.76";
function makeClient(url: string, key: string) { return createClient(url, key); }
interface Provider { id: string; provider: string; api_url: string; api_key: string; instance_name: string }
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

async function findActiveProvider(supabase: ReturnType<typeof makeClient>, projectId: string) {
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

async function sendWhatsApp(provider: Provider | null, phone: string, message: string) {
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
  } catch (e) {
    const eMessage = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : undefined;
    return { ok: false, error: String(eMessage || e) };
  }
}

async function aiCopy(bucket: BucketId, nome: string, produto: string, valor: number, projeto: { name?: string | null; avatar?: { nome?: string } | null; brand_kit?: { tom_de_voz?: string } | null } | null): Promise<string> {
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
    const items = z.array(z.object({
      id: z.string().nullish(),
      phone: z.string().nullish(),
      leadId: z.string().nullish(),
      leadName: z.string().nullish(),
      email: z.string().nullish(),
      product: z.string().nullish(),
      value: z.union([z.string(), z.number()]).nullish(),
      vendaId: z.string().nullish(),
      projectId: z.string().nullish(),
      pixCode: z.string().nullish(),
      paymentLink: z.string().nullish(),
      touchLevel: z.number().nullish(),
      customMessage: z.string().nullish(),
    }).passthrough()).parse(Array.isArray(body?.items) ? body.items : []);
    const maxSend: number = Math.min(Math.max(Number(body?.max) || 25, 1), 100);

    if ((!projectId && items.every((i) => !i.projectId)) || !bucket || items.length === 0) {
      return new Response(JSON.stringify({ error: "project_id, bucket e items são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const target = items.slice(0, maxSend);
    let sent = 0, skipped = 0;
    const details: { id?: string | null; ok: boolean; error?: string }[] = [];
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    for (const it of target) {
      const targetProjectId = it.projectId || projectId;
      const phone = normalizePhone(it.phone || "");
      if (phone.length < 12 || !it.leadId) {
        skipped++;
        details.push({ id: it.id, ok: false, error: "phone_invalid" });
        continue;
      }

      // 1. TRAVA ANTI-DUPLICAÇÃO:
      // Se o lead já possui QUALQUER compra aprovada/paga no sistema, nunca enviar cobrança/recuperação!
      const { data: approvedSales } = await supabase
        .from("imphq_vendas")
        .select("id, status")
        .eq("lead_id", it.leadId)
        .in("status", ["aprovado", "approved", "paid", "compra_aprovada"])
        .limit(1);

      if (approvedSales && approvedSales.length > 0) {
        skipped++;
        details.push({ id: it.id, ok: false, error: "already_purchased" });
        await supabase.from("imphq_recovery_logs").insert({
          project_id: targetProjectId,
          lead_id: it.leadId,
          venda_id: it.vendaId || null,
          bucket,
          acao: "trava_anti_duplicacao",
          canal: "whatsapp",
          status: "bloqueado_ja_comprou",
          valor: Number(it.value) || 0,
          observacao: "Venda aprovada detectada no sistema. Disparo cancelado automaticamente.",
        });
        continue;
      }

      // 2. Anti-spam: já houve dispatch deste bucket nas últimas 24h?
      const { count } = await supabase
        .from("imphq_recovery_logs")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", it.leadId)
        .eq("bucket", bucket)
        .eq("acao", "bucket_dispatch_ai")
        .gte("created_at", since24h);
      if ((count || 0) > 0) {
        skipped++;
        details.push({ id: it.id, ok: false, error: "already_sent_24h" });
        continue;
      }

      // 3. Provider WhatsApp ativo para o projeto
      const provider = await findActiveProvider(supabase, targetProjectId);
      if (!provider) {
        skipped++;
        details.push({ id: it.id, ok: false, error: "no_provider" });
        continue;
      }

      // 4. Construção da mensagem persuasiva respeitando a régua e código Pix
      let message = it.customMessage || "";
      if (!message) {
        const { data: projeto } = await supabase
          .from("imphq_projects")
          .select("name, avatar, brand_kit")
          .eq("id", targetProjectId)
          .maybeSingle();

        const nome = it.leadName || "";
        const produto = it.product || "seu pedido";
        const pixCode = it.pixCode || "";
        const link = it.paymentLink || "";
        const touch = it.touchLevel || 1;

        if (bucket === "pix_urgent" || bucket === "pix_cooling") {
          if (touch === 3) {
            message = `Oi ${nome ? nome : ""}! Último aviso sobre seu pedido de *${produto}*. O sistema vai cancelar o seu Pix e liberar a vaga em poucas horas.\n\nSe quiser garantir seu acesso antes que expire: ${link || "acesse o link do checkout"}`;
          } else if (touch === 2) {
            message = `Oi ${nome ? nome : ""}! Passando para avisar que sua vaga de *${produto}* ainda está reservada. O acesso é liberado na hora no Pix! Se quiser concluir: ${link || "acesse o link do checkout"}\n\nFicou alguma dúvida sobre o pagamento?`;
          } else {
            message = `Oi ${nome ? nome : ""}! Vi que o Pix de *${produto}* foi gerado e está reservado.`;
            if (pixCode) message += `\n\nCódigo Pix Copia e Cola:\n${pixCode}`;
            if (link) message += `\n\nOu link direto: ${link}`;
            message += `\n\nFicou alguma dúvida ou teve algum problema? Me avisa aqui que te ajudo!`;
          }
        } else if (bucket === "abandoned_cart") {
          message = `Oi ${nome ? nome : ""}! Vi que você chegou bem perto de garantir *${produto}*. Ficou alguma dúvida sobre o conteúdo ou pagamento?\n\nSe quiser retomar de onde parou: ${link || "link no seu e-mail"}`;
        } else if (bucket === "boleto_due") {
          message = `Oi ${nome ? nome : ""}! Seu boleto para *${produto}* está perto do vencimento. Se preferir pagar no Pix para liberar o acesso na hora, me avisa aqui! Ou acesse: ${link || "link no seu e-mail"}`;
        } else {
          message = await aiCopy(bucket, nome, produto, Number(it.value) || 0, projeto);
        }
      }

      const result = await sendWhatsApp(provider, phone, message);

      await supabase.from("imphq_recovery_logs").insert({
        project_id: targetProjectId,
        lead_id: it.leadId,
        venda_id: it.vendaId || null,
        bucket,
        acao: "bucket_dispatch_ai",
        canal: "whatsapp",
        status: result.ok ? "enviado" : "falha",
        valor: Number(it.value) || 0,
        observacao: result.ok ? `Disparo 1-Clique Régua (Toque ${it.touchLevel || 1})` : (result.error || "falha"),
      });

      await supabase.from("imphq_ai_actions").insert({
        kind: "recovery_bucket_dispatch",
        risk_level: "low",
        confidence: 0.9,
        title: `Recuperação ${bucket} → ${it.leadName || phone}`,
        reason: `Disparo de régua automática com Pix e Trava Anti-Duplicação.`,
        payload: { lead_id: it.leadId, venda_id: it.vendaId, bucket, message, valor: it.value, touch: it.touchLevel },
        result: { ok: result.ok, error: result.error || null },
        projeto_id: targetProjectId,
        source: "recovery-bucket-dispatch",
        status: result.ok ? "executed" : "failed",
        auto_executed: false,
        executed_at: now.toISOString(),
        error: result.ok ? null : (result.error || null),
      });

      if (result.ok) sent++; else skipped++;
      details.push({ id: it.id, ok: result.ok, error: result.error });
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, total: target.length, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : err && typeof err === "object" && "message" in err && typeof err.message === "string" ? err.message : undefined;
    console.error("[recovery-bucket-dispatch] Error:", err);
    return new Response(JSON.stringify({ error: String(errMessage || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
