import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pushNotifyByPref, resolveProjectRecipients } from "../_shared/push-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Map event names to Facebook CAPI event names
const CAPI_EVENT_MAP: Record<string, string> = {
  compra_aprovada: "Purchase",
  lead_capturado: "Lead",
  inicio_checkout: "InitiateCheckout",
  visualizacao_conteudo: "ViewContent",
};

async function sendCAPIEvent(
  fbToken: string,
  fbPixelId: string,
  fbTestCode: string | undefined,
  eventName: string,
  email: string,
  nome: string,
  phone: string,
  valor: number,
  produto: string,
) {
  const eventData: any = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: {
        em: email ? [await hashSHA256(email.toLowerCase())] : undefined,
        fn: nome ? [await hashSHA256(nome.toLowerCase().split(" ")[0])] : undefined,
        ph: phone ? [await hashSHA256(phone.replace(/\D/g, ""))] : undefined,
      },
      custom_data: {
        currency: "BRL",
        value: valor || 0,
        content_name: produto || undefined,
      },
    }],
  };
  if (fbTestCode) eventData.test_event_code = fbTestCode;

  const capiRes = await fetch(
    `https://graph.facebook.com/v18.0/${fbPixelId}/events?access_token=${fbToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    }
  );
  return await capiRes.json();
}

function extractFinanceiro(body: any, plataforma: string): Record<string, any> | null {
  try {
    if (plataforma === "Ticto") {
      const order = body?.order || {};
      const comms = body?.commissions || [];
      const paidAmount = (order.paid_amount || 0) / 100;
      const netAmount = (order.net_amount || 0) / 100;
      const platformFee = (order.platform_fee || 0) / 100;
      const txFee = (order.transaction_fee || 0) / 100;
      const prodComm = comms.find((c: any) => c.role === "producer" || c.role === "PRODUCER");
      const affComm = comms.find((c: any) => c.role === "affiliate" || c.role === "AFFILIATE");
      if (paidAmount > 0 || netAmount > 0) {
        return {
          valor_bruto: paidAmount || undefined,
          comissao_plataforma: platformFee || undefined,
          taxa_transacao: txFee || undefined,
          comissao_produtor: prodComm ? (prodComm.value || 0) / 100 : undefined,
          comissao_afiliado: affComm ? (affComm.value || 0) / 100 : undefined,
          valor_liquido: netAmount || undefined,
          metodo_pagamento: order.payment_method || body?.payment?.method || undefined,
          parcelas: order.installments || body?.payment?.installments || undefined,
          codigo_pedido: order.code || order.id || undefined,
          bandeira_cartao: body?.payment?.card_brand || undefined,
        };
      }
    }
    if (plataforma === "Hotmart") {
      const purchase = body?.data?.purchase || {};
      const price = purchase.price || {};
      const comm = purchase.commission_as || purchase.commission;
      const hotValue = price.value || 0;
      if (hotValue > 0) {
        return {
          valor_bruto: hotValue,
          comissao_plataforma: purchase.hotmart_fee || undefined,
          taxa_transacao: undefined,
          comissao_produtor: typeof comm === "number" ? comm : comm?.value || undefined,
          comissao_afiliado: purchase.affiliate_commission?.value || undefined,
          valor_liquido: purchase.full_price?.value || purchase.original_offer_price?.value || undefined,
          metodo_pagamento: purchase.payment?.type || purchase.payment_method || undefined,
          parcelas: purchase.payment?.installments_number || undefined,
          codigo_pedido: purchase.transaction || purchase.order_bump?.id || undefined,
          oferta: purchase.offer?.code || undefined,
        };
      }
    }
    if (plataforma === "Kiwify") {
      const saleAmount = parseFloat(body?.sale_amount || body?.order_value || "0");
      const comms = body?.commissions || body?.Commissions || {};
      if (saleAmount > 0) {
        return {
          valor_bruto: saleAmount,
          comissao_plataforma: parseFloat(comms.charge_amount || comms.kiwify_fee || "0") || undefined,
          taxa_transacao: undefined,
          comissao_produtor: parseFloat(comms.producer_amount || comms.my_commission || "0") || undefined,
          comissao_afiliado: parseFloat(comms.affiliate_amount || "0") || undefined,
          valor_liquido: parseFloat(comms.receive_amount || comms.net_amount || "0") || undefined,
          metodo_pagamento: body?.payment_method || undefined,
          parcelas: body?.installments || undefined,
          codigo_pedido: body?.order_id || body?.order_ref || undefined,
        };
      }
    }
  } catch (e) {
    console.warn("[webhook-pagamento] Erro ao extrair financeiro:", e);
  }
  return null;
}

// Decode common encodings used by trackers (xcod often uses pipe encoded as %7C)
function decodeXcod(raw: string): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  try {
    const decoded = decodeURIComponent(raw);
    // Format: campaign|adset|ad|content OR key=value pairs separated by | or &
    if (decoded.includes("=")) {
      decoded.split(/[|&]/).forEach((kv) => {
        const [k, ...rest] = kv.split("=");
        if (k && rest.length) out[k.trim().toLowerCase()] = rest.join("=").trim();
      });
    } else if (decoded.includes("|")) {
      const parts = decoded.split("|");
      if (parts[0]) out.utm_campaign = parts[0];
      if (parts[1]) out.utm_content = parts[1]; // adset
      if (parts[2]) out.utm_term = parts[2]; // ad
    } else {
      out.utm_campaign = decoded;
    }
  } catch { /* ignore */ }
  return out;
}

function extractUtms(body: any): Record<string, string> | null {
  // 1) Direct UTMs from common locations
  let src = body?.utm_source || body?.data?.purchase?.tracking?.source || body?.tracking?.utm_source || body?.tracking?.source;
  let med = body?.utm_medium || body?.data?.purchase?.tracking?.medium || body?.tracking?.utm_medium;
  let cmp = body?.utm_campaign || body?.data?.purchase?.tracking?.campaign || body?.tracking?.utm_campaign;
  let cnt = body?.utm_content || body?.tracking?.utm_content;
  let trm = body?.utm_term || body?.tracking?.utm_term;

  // 2) Ticto / Hotmart "src" (often contains campaign name)
  const srcParam = body?.src || body?.data?.purchase?.tracking?.source_sck || body?.tracking?.src;
  if (!cmp && srcParam) cmp = srcParam;
  if (!src && srcParam) src = srcParam;

  // 3) sck (Ticto subscriber tracking code)
  const sck = body?.sck || body?.tracking?.sck;
  if (sck) {
    const sckParts = decodeXcod(String(sck));
    cmp = cmp || sckParts.utm_campaign;
    cnt = cnt || sckParts.utm_content;
    trm = trm || sckParts.utm_term;
  }

  // 4) xcod (universal tracker code we use in /Tracker)
  const xcod = body?.xcod || body?.tracking?.xcod || body?.data?.purchase?.tracking?.xcod;
  if (xcod) {
    const xcodParts = decodeXcod(String(xcod));
    src = src || xcodParts.utm_source || xcodParts.src;
    med = med || xcodParts.utm_medium;
    cmp = cmp || xcodParts.utm_campaign;
    cnt = cnt || xcodParts.utm_content || xcodParts.adset_name;
    trm = trm || xcodParts.utm_term || xcodParts.ad_name;
  }

  if (src || med || cmp || cnt || trm) {
    return {
      utm_source: src || "",
      utm_medium: med || "",
      utm_campaign: cmp || "",
      utm_content: cnt || "",
      utm_term: trm || "",
    };
  }
  return null;
}

// Reverse-match utm_campaign to imphq_ads_spend.campanha to recover campaign_id
async function findCampaignIdByUtm(supabase: any, projectId: string | null, utmCampaign: string): Promise<string | null> {
  if (!utmCampaign || !projectId) return null;
  try {
    // Try exact match first
    const { data: exact } = await supabase
      .from("imphq_ads_spend")
      .select("campaign_id, campanha")
      .eq("project_id", projectId)
      .eq("campanha", utmCampaign)
      .not("campaign_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (exact?.campaign_id) return exact.campaign_id;

    // Fallback: contains (case-insensitive)
    const { data: fuzzy } = await supabase
      .from("imphq_ads_spend")
      .select("campaign_id, campanha")
      .eq("project_id", projectId)
      .ilike("campanha", `%${utmCampaign}%`)
      .not("campaign_id", "is", null)
      .limit(1)
      .maybeSingle();
    return fuzzy?.campaign_id || null;
  } catch (e) {
    console.warn("[webhook-pagamento] findCampaignIdByUtm error:", e);
    return null;
  }
}

function parseWebhookBody(body: any, hotmartToken: string | null) {
  let plataforma = "desconhecido";
  let evento = "desconhecido";
  let email = "";
  let nome = "";
  let phone = "";
  let valor = 0;
  let produto = "";
  let data_compra: string | null = null;
  let tipo_venda: string = "principal";

  // ── Ticto v2 detection (version field or token in body) ──
  if (body?.version === "2.0" || (body?.token && body?.item && body?.customer)) {
    plataforma = "Ticto";
    const status = body.status || "";
    const statusMap: Record<string, string> = {
      authorized: "compra_aprovada",
      abandoned_cart: "carrinho_abandonado",
      refunded: "reembolso",
      waiting_payment: "aguardando_pagamento",
      pix_created: "pix_gerado",
      pix_expired: "pagamento_expirado",
      chargeback: "chargeback",
      blocked: "bloqueado",
      started: "inicio_checkout",
      refused: "pagamento_recusado",
      expired: "pagamento_expirado",
      trial_started: "trial_iniciado",
      bank_slip_created: "boleto_gerado",
      bank_slip_expired: "pagamento_expirado",
    };
    evento = statusMap[status] || status || "desconhecido";

    const customer = body.customer || {};
    email = customer.email || "";
    nome = customer.name || "";
    const ph = customer.phone || {};
    phone = ph.ddd && ph.number ? `${ph.ddd}${ph.number}` : "";

    const order = body.order || {};
    const item = body.item || {};
    // Use item-level price (individual product) instead of order.paid_amount (total incl. bumps)
    valor = ((item.price || item.amount || order.paid_amount || 0)) / 100;

    produto = item.product_name || "";
    data_compra = order.approved_at || order.created_at || body.created_at || null;

    // Detect bump/upsell for Ticto
    if (item.is_bump === true) tipo_venda = "orderbump";
    else if (item.is_upsell === true) tipo_venda = "upsell";
  }
  // ── Ticto v1 (legacy) ──
  else if (body?.tipo_evento || body?.dados) {
    plataforma = "Ticto";
    evento = body.tipo_evento === "venda_aprovada" ? "compra_aprovada" : body.tipo_evento || "desconhecido";
    const dados = body.dados || {};
    email = dados.email_comprador || "";
    nome = dados.nome_comprador || "";
    phone = dados.telefone_comprador || "";
    valor = parseFloat(dados.valor || "0");
    produto = dados.nome_produto || "";
    data_compra = dados.data_compra || dados.criado_em || null;
  }
  // ── Hotmart ──
  else if (hotmartToken || body?.event?.includes?.("PURCHASE") || body?.event?.includes?.("SUBSCRIPTION") || body?.event?.includes?.("CLUB") || body?.event?.includes?.("SWITCH") || body?.event?.includes?.("TRIAL")) {
    plataforma = "Hotmart";
    const ev = body.event || "";
    const hotmartEventMap: Record<string, string> = {
      "PURCHASE_APPROVED": "compra_aprovada",
      "PURCHASE_COMPLETE": "compra_aprovada",
      "PURCHASE_REFUNDED": "reembolso",
      "PURCHASE_CANCELED": "compra_cancelada",
      "PURCHASE_CHARGEBACK": "chargeback",
      "PURCHASE_EXPIRED": "pagamento_expirado",
      "PURCHASE_DELAYED": "pagamento_pendente",
      "PURCHASE_BILLET_PRINTED": "boleto_gerado",
      "PURCHASE_PROTEST": "chargeback",
      "PURCHASE_OUT_OF_SHOPPING_CART": "carrinho_abandonado",
      "SUBSCRIPTION_CANCELLATION": "assinatura_cancelada",
      "SWITCH_PLAN": "troca_plano",
      "CLUB_FIRST_ACCESS": "primeiro_acesso",
      "TRIAL_STARTED": "trial_iniciado",
    };
    // Try exact match first, then partial
    evento = hotmartEventMap[ev] || Object.entries(hotmartEventMap).find(([k]) => ev.includes(k.split("_").slice(1).join("_")))?.[1] || ev.toLowerCase();

    const buyer = body.data?.buyer || {};
    email = buyer.email || "";
    nome = buyer.name || "";
    phone = buyer.checkout_phone || "";
    valor = body.data?.purchase?.price?.value || 0;
    produto = body.data?.product?.name || "";
    const purchase = body.data?.purchase || {};
    const rawDate = purchase.approved_date || purchase.order_date || purchase.date || null;
    if (rawDate) {
      data_compra = typeof rawDate === "number" ? new Date(rawDate).toISOString() : rawDate;
    }

    // Detect bump/upsell for Hotmart
    if (purchase.is_order_bump === true) tipo_venda = "orderbump";
    else if (body.data?.product?.has_co_production === true) tipo_venda = "upsell";
  }
  // ── Kiwify ──
  else if (body?.webhook_event_type || body?.order_status) {
    plataforma = "Kiwify";
    const status = body.order_status || body.webhook_event_type || "";
    if (status === "paid" || status === "approved" || status === "aprovado" || status === "aprovada") evento = "compra_aprovada";
    else if (status === "refunded") evento = "reembolso";
    else if (status === "waiting_payment") evento = "carrinho_abandonado";
    else evento = status;

    const customer = body.Customer || body.customer || {};
    email = customer.email || body.customer_email || "";
    nome = customer.full_name || customer.name || "";
    phone = customer.mobile || "";
    valor = parseFloat(body.sale_amount || body.order_value || "0");
    produto = body.product_name || body.Product?.name || "";
    data_compra = body.sale_date || body.approved_date || body.created_at || null;

    // Detect bump for Kiwify
    if (body.is_bump === true || body.bump_id) tipo_venda = "orderbump";
  }
  // ── Generic fallback ──
  else {
    plataforma = body.plataforma || "Outro";
    evento = body.evento || body.event_type || "desconhecido";
    email = body.email || body.customer?.email || "";
    nome = body.nome || body.customer?.name || "";
    phone = body.phone || body.customer?.phone || "";
    valor = parseFloat(body.valor || body.amount || "0");
    produto = body.produto || body.product || "";
    data_compra = body.data_compra || body.created_at || null;
  }

  // Extract financial breakdown and UTMs
  const financeiro = extractFinanceiro(body, plataforma);
  const utms = extractUtms(body);

  // Extract external transaction id (codigo_pedido) for cross-platform deduplication
  const externalTxId = financeiro?.codigo_pedido || null;

  return { plataforma, evento, email, nome, phone, valor, produto, data_compra, tipo_venda, financeiro, utms, externalTxId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: any = null;
  let projectId: string | null = null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const queryProjectId = url.searchParams.get("project");
    // Allow overriding event type via query param (e.g. ?event=Lead)
    const queryEvent = url.searchParams.get("event");

    body = await req.json();
    const hotmartToken = req.headers.get("x-hotmart-hottok");

    let { plataforma, evento, email, nome, phone, valor, produto, data_compra, tipo_venda, financeiro, utms: webhookUtms, externalTxId } = parseWebhookBody(body, hotmartToken);

    // Override evento if query param ?event= is provided
    if (queryEvent) {
      const eventMap: Record<string, string> = {
        Lead: "lead_capturado",
        InitiateCheckout: "inicio_checkout",
        ViewContent: "visualizacao_conteudo",
        Purchase: "compra_aprovada",
      };
      evento = eventMap[queryEvent] || queryEvent.toLowerCase();
    }

    projectId = queryProjectId;

    // Try to find project by product name match
    if (!projectId && produto) {
      const { data: proj } = await supabase
        .from("imphq_projects")
        .select("id")
        .ilike("name", `%${produto.substring(0, 20)}%`)
        .limit(1)
        .maybeSingle();
      if (proj) projectId = proj.id;
    }

    // Try to match lead by email
    let leadId: string | null = null;
    if (email) {
      const { data: lead } = await supabase
        .from("imphq_leads")
        .select("id")
        .eq("email", email.toLowerCase())
        .limit(1)
        .maybeSingle();

      if (lead) {
        leadId = lead.id;
        // Update existing lead with normalized event so recovery buckets can detect abandoned carts
        try {
          const { data: existing } = await supabase
            .from("imphq_leads")
            .select("data")
            .eq("id", lead.id)
            .maybeSingle();
          const prevData = (existing?.data || {}) as Record<string, any>;
          const eventTimestamp = data_compra || new Date().toISOString();
          const newData = {
            ...prevData,
            ultimo_evento: evento,
            ultimo_evento_em: eventTimestamp,
            ultimo_produto: produto || prevData.ultimo_produto || null,
            ultimo_valor: valor || prevData.ultimo_valor || null,
          };
          await supabase
            .from("imphq_leads")
            .update({ data: newData, updated_at: eventTimestamp, phone: phone || undefined })
            .eq("id", lead.id);
        } catch (e) {
          console.warn("[webhook-pagamento] Erro ao atualizar lead existente:", e);
        }
      } else {
        const newId = crypto.randomUUID();
        const eventTimestamp = data_compra || new Date().toISOString();
        const leadInsert: any = {
          id: newId,
          nome: nome || email,
          email: email.toLowerCase(),
          phone: phone || null,
          plataforma,
          status: evento === "compra_aprovada" ? "cliente" : "lead",
          project_id: projectId,
          updated_at: eventTimestamp,
          data: { ultimo_evento: evento, ultimo_evento_em: eventTimestamp, ultimo_produto: produto || null, ultimo_valor: valor || null },
        };
        if (data_compra) leadInsert.criado_em = data_compra;
        await supabase.from("imphq_leads").insert(leadInsert);
        leadId = newId;
      }
    }

    // Save webhook
    const { data: webhookRow } = await supabase.from("imphq_webhooks").insert({
      project_id: projectId,
      plataforma,
      evento,
      payload: body,
      lead_id: leadId,
      processado: false,
    }).select("id").single();

    // Get project config (CAPI + platform token validation)
    let fbToken: string | undefined;
    let fbPixelId: string | undefined;
    let fbTestCode: string | undefined;

    if (projectId) {
      const { data: proj } = await supabase
        .from("imphq_projects")
        .select("data")
        .eq("id", projectId)
        .single();

      fbToken = (proj?.data?.facebook_access_token || "").replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
      fbPixelId = proj?.data?.facebook_pixel_id;
      fbTestCode = proj?.data?.facebook_test_event_code;

      // Validate Hotmart hottok against project config
      if (hotmartToken && proj?.data?.hotmart_token) {
        if (hotmartToken !== proj.data.hotmart_token) {
          console.warn("[webhook-pagamento] Hotmart token mismatch for project", projectId);
          return new Response(
            JSON.stringify({ error: "Invalid hotmart token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Validate Ticto token against project config
      if (plataforma === "Ticto" && body?.token && proj?.data?.ticto_token) {
        if (body.token !== proj.data.ticto_token) {
          console.warn("[webhook-pagamento] Ticto token mismatch for project", projectId);
          return new Response(
            JSON.stringify({ error: "Invalid ticto token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Handle checkout intent (inicio_checkout, carrinho_abandonado, pix_gerado, boleto_gerado, aguardando_pagamento, pagamento_pendente, pagamento_recusado, pagamento_expirado)
    const checkoutIntentEvents = ["inicio_checkout", "carrinho_abandonado", "pix_gerado", "boleto_gerado", "aguardando_pagamento", "pagamento_pendente", "pagamento_recusado", "pagamento_expirado"];

    // Log missing leadId as observability error (so /configuracoes shows it)
    if (checkoutIntentEvents.includes(evento) && !leadId) {
      console.warn("[webhook-pagamento] checkout-intent sem leadId resolvido:", evento, plataforma);
      await supabase.from("imphq_webhook_errors").insert({
        webhook_id: webhookRow?.id || null,
        project_id: projectId,
        plataforma,
        evento,
        erro: "lead_not_resolved: checkout-intent recebido mas não foi possível resolver o lead (email/phone ausentes ou desconhecidos).",
        payload: body,
      });
    }

    let touchedVendaId: string | null = null;

    if (checkoutIntentEvents.includes(evento) && leadId) {
      const statusMap: Record<string, string> = {
        inicio_checkout: "inicio_checkout",
        carrinho_abandonado: "carrinho_abandonado",
        pix_gerado: "pix_gerado",
        boleto_gerado: "boleto_gerado",
        aguardando_pagamento: "aguardando_pagamento",
        pagamento_pendente: "pendente",
        pagamento_recusado: "recusado",
        pagamento_expirado: "expirado",
      };
      const vendaStatus = statusMap[evento] || evento;

      // Dedup: try by external_transaction_id first (strongest), fallback to lead+status window
      let dupCheck: any[] | null = null;
      if (externalTxId && projectId) {
        const { data } = await supabase
          .from("imphq_vendas")
          .select("id, status, created_at")
          .eq("project_id", projectId)
          .eq("external_transaction_id", externalTxId)
          .eq("produto_nome", produto || "")
          .limit(1);
        dupCheck = data;
      }
      if (!dupCheck || dupCheck.length === 0) {
        const { data } = await supabase
          .from("imphq_vendas")
          .select("id, status, created_at")
          .eq("lead_id", leadId)
          .eq("status", vendaStatus)
          .gte("created_at", new Date(Date.now() - 30 * 60000).toISOString())
          .limit(1);
        dupCheck = data;
      }

      if (!dupCheck || dupCheck.length === 0) {
        // Reverse-match campaign_id from utm_campaign
        const matchedCampaignId = webhookUtms?.utm_campaign
          ? await findCampaignIdByUtm(supabase, projectId, webhookUtms.utm_campaign)
          : null;

        const vendaInsert: any = {
          id: crypto.randomUUID(),
          lead_id: leadId,
          project_id: projectId,
          produto_nome: produto || null,
          valor: valor || 0,
          plataforma,
          status: vendaStatus,
          tipo_venda: tipo_venda || "principal",
          external_transaction_id: externalTxId,
          utm_source: webhookUtms?.utm_source || null,
          utm_medium: webhookUtms?.utm_medium || null,
          utm_campaign: webhookUtms?.utm_campaign || null,
          utm_content: webhookUtms?.utm_content || null,
          utm_term: webhookUtms?.utm_term || null,
          data: {
            ...(webhookUtms ? { utms: webhookUtms } : {}),
            ...(matchedCampaignId ? { matched_campaign_id: matchedCampaignId } : {}),
            last_intent_at: new Date().toISOString(),
            last_intent_event: evento,
          },
        };
        if (data_compra) {
          vendaInsert.created_at = data_compra;
          vendaInsert.data_venda = data_compra;
        }
        const { error: ciErr } = await supabase.from("imphq_vendas").insert(vendaInsert);
        if (ciErr) {
          console.error("[webhook-pagamento] Erro ao inserir checkout intent (code=", ciErr.code, "):", ciErr.message);
          if (ciErr.code !== "23505") {
            await supabase.from("imphq_webhook_errors").insert({
              webhook_id: webhookRow?.id || null,
              project_id: projectId,
              plataforma,
              evento,
              erro: `insert_venda_failed: ${ciErr.message}`,
              payload: body,
            });
          }
        } else {
          console.log("[webhook-pagamento] Checkout intent inserido:", vendaInsert.id, vendaStatus, "utm:", webhookUtms?.utm_campaign);
          touchedVendaId = vendaInsert.id;
        }
      } else {
        // Existing venda — bump activity timestamp so hot-lead-responder reconhece como reemissão
        const existingId = dupCheck[0].id;
        touchedVendaId = existingId;
        const { data: existVenda } = await supabase
          .from("imphq_vendas")
          .select("data")
          .eq("id", existingId)
          .maybeSingle();
        const prevData = (existVenda?.data || {}) as Record<string, any>;
        // Clear stale hot_lead_responder_sent if older than 24h, so re-disparo is possível
        const hlrSent = prevData.hot_lead_responder_sent;
        const hlrOlderThan24h = !hlrSent || (Date.now() - new Date(hlrSent).getTime() > 24 * 3600 * 1000);
        const newData = {
          ...prevData,
          last_intent_at: new Date().toISOString(),
          last_intent_event: evento,
          intent_reemissions: ((prevData.intent_reemissions as number) || 0) + 1,
          ...(hlrOlderThan24h ? { hot_lead_responder_sent: null, hot_lead_responder_ok: null } : {}),
        };
        await supabase
          .from("imphq_vendas")
          .update({ data: newData, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        console.log("[webhook-pagamento] Reemissão", evento, "→ venda existente", existingId, "(reemissoes:", newData.intent_reemissions, ")");
      }

      // Hot lead notification + AUTO-FIRE hot-lead-responder p/ pix_gerado
      if (evento === "pix_gerado") {
        const recipients = await resolveProjectRecipients(supabase, projectId);
        await pushNotifyByPref({
          supabase,
          prefKey: "hot_lead",
          title: "🔥 Lead quente — Pix gerado",
          message: `${nome || email || "Um lead"} gerou um Pix${produto ? ` para ${produto}` : ""}${valor ? ` (R$ ${valor.toFixed(2)})` : ""}.`,
          user_ids: recipients,
        });

        // Dispara responder IMEDIATAMENTE para a venda específica (não espera cron)
        if (touchedVendaId) {
          try {
            supabase.functions.invoke("hot-lead-responder", {
              body: { venda_id: touchedVendaId, source: "webhook_pix_inline" },
            }).then((r: any) => {
              console.log("[webhook-pagamento] hot-lead-responder inline:", r?.data?.ok ?? r?.error);
            }).catch((e: any) => {
              console.warn("[webhook-pagamento] hot-lead-responder inline error:", e?.message);
            });
          } catch (e) {
            console.warn("[webhook-pagamento] failed to invoke hot-lead-responder:", e);
          }
        }
      }
    }

    // Notify on payment failure / expiration
    if (["pagamento_recusado", "pagamento_expirado"].includes(evento) && leadId) {
      const recipients = await resolveProjectRecipients(supabase, projectId);
      await pushNotifyByPref({
        supabase,
        prefKey: "venda_recusada",
        title: evento === "pagamento_recusado" ? "❌ Venda recusada" : "⌛ Pagamento expirado",
        message: `${nome || email || "Cliente"}${produto ? ` • ${produto}` : ""}${valor ? ` • R$ ${valor.toFixed(2)}` : ""}`,
        user_ids: recipients,
      });
    }

    // Handle purchase
    if (evento === "compra_aprovada" && leadId && valor > 0) {
      // STEP 1: try to PROMOTE an existing pending sale (pix_gerado / boleto_gerado / aguardando_pagamento / pendente / inicio_checkout)
      // for the same lead+product within the last 7 days. This avoids creating a duplicate row when Ticto/Hotmart
      // first sends pix_created and later sends authorized for the same transaction.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let pendingQ: any = supabase
        .from("imphq_vendas")
        .select("id, status, valor, data_venda")
        .eq("lead_id", leadId)
        .in("status", ["pix_gerado", "boleto_gerado", "aguardando_pagamento", "pendente", "inicio_checkout"])
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5);
      if (produto) pendingQ = pendingQ.eq("produto_nome", produto);
      const { data: pendingRows } = await pendingQ;
      const promotable = (pendingRows || []).find((r: any) => Math.abs((parseFloat(r.valor) || 0) - valor) < 0.01) || (pendingRows || [])[0];

      if (promotable) {
        const upd: any = { status: "aprovado" };
        if (data_compra) upd.data_venda = data_compra;
        if (externalTxId) upd.external_transaction_id = externalTxId;
        if (webhookUtms?.utm_campaign) {
          upd.utm_source = webhookUtms.utm_source || null;
          upd.utm_medium = webhookUtms.utm_medium || null;
          upd.utm_campaign = webhookUtms.utm_campaign || null;
          upd.utm_content = webhookUtms.utm_content || null;
          upd.utm_term = webhookUtms.utm_term || null;
        }
        await supabase.from("imphq_vendas").update(upd).eq("id", promotable.id);
        console.log("[webhook-pagamento] Promoted pending sale to aprovado:", promotable.id);

        // ── Flow Attribution: record which OpenFlow automation led to this purchase
        try {
          if (leadId) {
            const { data: lastExec } = await supabase
              .from('imphq_flow_executions')
              .select('id, automacao_id, current_step')
              .eq('lead_id', leadId)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (lastExec?.automacao_id) {
              const { data: autoInfo } = await supabase
                .from('imphq_automacoes')
                .select('nome')
                .eq('id', lastExec.automacao_id)
                .maybeSingle();
              const { data: existingVendaData } = await supabase
                .from('imphq_vendas')
                .select('data')
                .eq('id', promotable.id)
                .maybeSingle();
              const attributionData = {
                flow_attribution_id: lastExec.automacao_id,
                flow_attribution_step: lastExec.current_step,
                flow_attribution_nome: autoInfo?.nome || null,
              };
              await supabase
                .from('imphq_vendas')
                .update({ data: { ...(existingVendaData?.data || {}), ...attributionData } })
                .eq('id', promotable.id);
              console.log('[webhook-pagamento] Flow attribution recorded (promote):', attributionData);
            }
          }
        } catch (attrErr: any) {
          console.warn('[webhook-pagamento] Flow attribution error (non-blocking):', attrErr.message);
        }

        // Register A/B test conversion
        try {
          const { data: recentLog } = await supabase
            .from("imphq_wa_ab_test_logs")
            .select("id, variant_id")
            .eq("lead_id", leadId)
            .eq("converted", false)
            .order("enrolled_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (recentLog) {
            await supabase
              .from("imphq_wa_ab_test_logs")
              .update({ converted: true, converted_at: new Date().toISOString() })
              .eq("id", recentLog.id);
            await supabase.rpc("increment_ab_variant_conversion", { p_variant_id: recentLog.variant_id });
            console.log(`[webhook-pagamento] Registered A/B test conversion for variant: ${recentLog.variant_id}`);
          }
        } catch (abErr: any) {
          console.error("[webhook-pagamento] Error updating A/B test conversion:", abErr.message);
        }
      } else {

      // Deduplication: try external_transaction_id first (strongest), fallback to 5-min window
      let existingDup: any[] | null = null;
      if (externalTxId && projectId) {
        const { data } = await supabase
          .from("imphq_vendas")
          .select("id")
          .eq("project_id", projectId)
          .eq("external_transaction_id", externalTxId)
          .eq("produto_nome", produto || "")
          .limit(1);
        existingDup = data;
      }
      if (!existingDup || existingDup.length === 0) {
        const { data } = await supabase
          .from("imphq_vendas")
          .select("id")
          .eq("lead_id", leadId)
          .eq("produto_nome", produto)
          .eq("valor", valor)
          .eq("status", "aprovado")
          .gte("created_at", new Date(Date.now() - 5 * 60000).toISOString())
          .limit(1);
        existingDup = data;
      }

      if (existingDup && existingDup.length > 0) {
        console.log("[webhook-pagamento] Venda duplicada ignorada para lead", leadId);
      } else {
        const vendaData: Record<string, any> = {};
        if (financeiro) Object.assign(vendaData, financeiro);
        if (webhookUtms) vendaData.utms = webhookUtms;
        if (tipo_venda !== "principal") vendaData.tipo_venda = tipo_venda;

        // Reverse-match campaign_id from utm_campaign
        const matchedCampaignId = webhookUtms?.utm_campaign
          ? await findCampaignIdByUtm(supabase, projectId, webhookUtms.utm_campaign)
          : null;
        if (matchedCampaignId) vendaData.matched_campaign_id = matchedCampaignId;

        const vendaInsert: any = {
          id: crypto.randomUUID(),
          lead_id: leadId,
          project_id: projectId,
          produto_nome: produto,
          valor,
          plataforma,
          status: "aprovado",
          tipo_venda,
          external_transaction_id: externalTxId,
          utm_source: webhookUtms?.utm_source || null,
          utm_medium: webhookUtms?.utm_medium || null,
          utm_campaign: webhookUtms?.utm_campaign || null,
          utm_content: webhookUtms?.utm_content || null,
          utm_term: webhookUtms?.utm_term || null,
          data: Object.keys(vendaData).length > 0 ? vendaData : null,
        };
        if (data_compra) {
          vendaInsert.created_at = data_compra;
          vendaInsert.data_venda = data_compra;
        }
        const { error: vendaErr } = await supabase.from("imphq_vendas").insert(vendaInsert);
        if (vendaErr) {
          // 23505 = unique_violation: another concurrent webhook already inserted this transaction. Treat as success.
          if (vendaErr.code === "23505") {
            console.log("[webhook-pagamento] Venda já existente (unique_violation), ignorando duplicata:", externalTxId);
          } else {
            console.error("[webhook-pagamento] Erro ao inserir venda:", vendaErr);
          }
        } else {
          console.log("[webhook-pagamento] Venda inserida:", vendaInsert.id);

          // ── Flow Attribution: record which OpenFlow automation led to this purchase
          try {
            if (leadId) {
              const { data: lastExec } = await supabase
                .from('imphq_flow_executions')
                .select('id, automacao_id, current_step')
                .eq('lead_id', leadId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (lastExec?.automacao_id) {
                const { data: autoInfo } = await supabase
                  .from('imphq_automacoes')
                  .select('nome')
                  .eq('id', lastExec.automacao_id)
                  .maybeSingle();
                const attributionData = {
                  flow_attribution_id: lastExec.automacao_id,
                  flow_attribution_step: lastExec.current_step,
                  flow_attribution_nome: autoInfo?.nome || null,
                };
                await supabase
                  .from('imphq_vendas')
                  .update({ data: { ...(vendaInsert.data || {}), ...attributionData } })
                  .eq('id', vendaInsert.id);
                console.log('[webhook-pagamento] Flow attribution recorded (insert):', attributionData);
              }
            }
          } catch (attrErr: any) {
            console.warn('[webhook-pagamento] Flow attribution error (non-blocking):', attrErr.message);
          }

          // Register A/B test conversion
          try {
            const { data: recentLog } = await supabase
              .from("imphq_wa_ab_test_logs")
              .select("id, variant_id")
              .eq("lead_id", leadId)
              .eq("converted", false)
              .order("enrolled_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (recentLog) {
              await supabase
                .from("imphq_wa_ab_test_logs")
                .update({ converted: true, converted_at: new Date().toISOString() })
                .eq("id", recentLog.id);
              await supabase.rpc("increment_ab_variant_conversion", { p_variant_id: recentLog.variant_id });
              console.log(`[webhook-pagamento] Registered A/B test conversion for variant: ${recentLog.variant_id}`);
            }
          } catch (abErr: any) {
            console.error("[webhook-pagamento] Error updating A/B test conversion:", abErr.message);
          }
        }
      }
      } // end of else (no promotable pending sale)

      // Handle Ticto bumps as separate sales (with dedup by external_transaction_id+produto)
      if (plataforma === "Ticto" && body?.order?.bumps && Array.isArray(body.order.bumps)) {
        for (const bump of body.order.bumps) {
          const bumpValor = ((bump.price || bump.amount || 0)) / 100;
          const bumpProduto = bump.product_name || bump.name || "Order Bump";
          if (bumpValor > 0) {
            const bumpTxId = externalTxId ? `${externalTxId}:bump:${bump.hash || bump.id || bumpProduto}` : null;
            const bumpId = crypto.randomUUID();
            const { error: bumpErr } = await supabase.from("imphq_vendas").insert({
              id: bumpId,
              lead_id: leadId,
              project_id: projectId,
              produto_nome: bumpProduto,
              valor: bumpValor,
              plataforma,
              status: "aprovado",
              tipo_venda: "orderbump",
              external_transaction_id: bumpTxId,
              data: { tipo_venda: "orderbump" },
              ...(data_compra ? { created_at: data_compra, data_venda: data_compra } : {}),
            });
            if (bumpErr && bumpErr.code === "23505") {
              console.log("[webhook-pagamento] Bump duplicado ignorado:", bumpTxId);
            } else if (bumpErr) {
              console.error("[webhook-pagamento] Erro ao inserir bump:", bumpErr);
            } else {
              console.log("[webhook-pagamento] Bump inserido:", bumpId, bumpProduto, bumpValor);
            }
          }
        }
      }

      // Recalculate total_gasto from actual approved sales (not increment)
      const { data: salesSum } = await supabase
        .from("imphq_vendas")
        .select("valor")
        .eq("lead_id", leadId)
        .eq("status", "aprovado");
      const newTotal = (salesSum || []).reduce((s: number, v: any) => s + parseFloat(String(v.valor) || "0"), 0);
      await supabase
        .from("imphq_leads")
        .update({ status: "cliente", total_gasto: newTotal, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      // Lead scoring for purchase — update score field + log
      try {
        const pts = tipo_venda === "principal" ? 50 : tipo_venda === "upsell" ? 30 : tipo_venda === "orderbump" ? 20 : 50;
        await supabase.from("imphq_lead_scores_log").insert({ lead_id: leadId, acao: `compra_${tipo_venda}`, pontos: pts });
        // compra_aprovada always sets score to 100 (confirmed customer)
        await supabase.from("imphq_leads").update({ score: 100, updated_at: new Date().toISOString() }).eq("id", leadId);
      } catch (e) { console.warn("[webhook-pagamento] Score error:", e); }

      // Push notification: venda aprovada
      const recipients = await resolveProjectRecipients(supabase, projectId);
      await pushNotifyByPref({
        supabase,
        prefKey: "venda_aprovada",
        title: `💰 Venda aprovada — R$ ${valor.toFixed(2)}`,
        message: `${nome || email || "Cliente"}${produto ? ` • ${produto}` : ""}${tipo_venda && tipo_venda !== "principal" ? ` (${tipo_venda})` : ""}`,
        user_ids: recipients,
      });

      // Daily revenue goal check (one notification per day per project)
      if (projectId) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const { data: projGoal } = await supabase
            .from("imphq_projects")
            .select("daily_revenue_goal, meta_diaria_notified_date, name")
            .eq("id", projectId)
            .maybeSingle();
          const goal = projGoal?.daily_revenue_goal ? Number(projGoal.daily_revenue_goal) : 0;
          if (goal > 0 && projGoal?.meta_diaria_notified_date !== today) {
            // Sum today's approved sales for this project
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const { data: todaySales } = await supabase
              .from("imphq_vendas")
              .select("valor")
              .eq("project_id", projectId)
              .eq("status", "aprovado")
              .gte("created_at", startOfDay.toISOString());
            const todayTotal = (todaySales || []).reduce((s: number, v: any) => s + parseFloat(String(v.valor) || "0"), 0);
            if (todayTotal >= goal) {
              await supabase
                .from("imphq_projects")
                .update({ meta_diaria_notified_date: today })
                .eq("id", projectId);
              await pushNotifyByPref({
                supabase,
                prefKey: "meta_diaria_atingida",
                title: `🎯 Meta diária batida — ${projGoal?.name || "Projeto"}`,
                message: `R$ ${todayTotal.toFixed(2)} faturado hoje (meta: R$ ${goal.toFixed(2)}).`,
                user_ids: recipients,
              });
            }
          }
        } catch (e) {
          console.warn("[webhook-pagamento] Meta diária check error:", e);
        }
      }
    }

    // Handle refund
    if (evento === "reembolso" && leadId) {
      // Try to find existing sale to mark as refunded
      const { data: existingVenda } = await supabase
        .from("imphq_vendas")
        .select("id")
        .eq("lead_id", leadId)
        .eq("status", "aprovado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingVenda) {
        await supabase.from("imphq_vendas").update({ status: "reembolsado" }).eq("id", existingVenda.id);
      } else {
        // Create retroactive refunded sale for history
        const vendaInsert: any = {
          id: crypto.randomUUID(),
          lead_id: leadId,
          project_id: projectId,
          produto_nome: produto,
          valor,
          plataforma,
          status: "reembolsado",
        };
        if (data_compra) {
          vendaInsert.created_at = data_compra;
          vendaInsert.data_venda = data_compra;
        }
        await supabase.from("imphq_vendas").insert(vendaInsert);
      }

      // Check if lead still has approved sales
      const { data: remainingSales } = await supabase
        .from("imphq_vendas")
        .select("id")
        .eq("lead_id", leadId)
        .eq("status", "aprovado")
        .limit(1);

      const newStatus = (remainingSales && remainingSales.length > 0) ? "cliente" : "lead";
      await supabase.from("imphq_leads").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", leadId);

      // Push notification: reembolso
      const recipients = await resolveProjectRecipients(supabase, projectId);
      await pushNotifyByPref({
        supabase,
        prefKey: "reembolso_solicitado",
        title: `↩️ Reembolso — R$ ${(valor || 0).toFixed(2)}`,
        message: `${nome || email || "Cliente"}${produto ? ` • ${produto}` : ""}`,
        user_ids: recipients,
      });
    }

    // Handle chargeback / cancelamento — mark sale + lead as cancelado
    const cancelEvents = ["chargeback", "compra_cancelada", "assinatura_cancelada"];
    if (cancelEvents.includes(evento) && leadId) {
      const cancelStatus = evento === "chargeback" ? "chargeback" : "cancelado";

      // Find latest approved sale to mark
      const { data: existingVenda } = await supabase
        .from("imphq_vendas")
        .select("id")
        .eq("lead_id", leadId)
        .eq("status", "aprovado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingVenda) {
        await supabase.from("imphq_vendas").update({ status: cancelStatus }).eq("id", existingVenda.id);
      } else {
        // Create retroactive cancelled sale for history
        const vendaInsert: any = {
          id: crypto.randomUUID(),
          lead_id: leadId,
          project_id: projectId,
          produto_nome: produto,
          valor,
          plataforma,
          status: cancelStatus,
        };
        if (data_compra) {
          vendaInsert.created_at = data_compra;
          vendaInsert.data_venda = data_compra;
        }
        await supabase.from("imphq_vendas").insert(vendaInsert);
      }

      // Recompute total_gasto and lead status
      const { data: salesSum } = await supabase
        .from("imphq_vendas")
        .select("valor")
        .eq("lead_id", leadId)
        .eq("status", "aprovado");
      const newTotal = (salesSum || []).reduce((s: number, v: any) => s + parseFloat(String(v.valor) || "0"), 0);
      const leadStatus = newTotal > 0 ? "cliente" : "cancelado";

      await supabase.from("imphq_leads").update({
        status: leadStatus,
        total_gasto: newTotal,
        updated_at: new Date().toISOString(),
      }).eq("id", leadId);

      console.log(`[webhook-pagamento] Lead ${leadId} marcado como ${leadStatus} (evento: ${evento})`);
    }

    // Register journey event in imphq_events
    const JOURNEY_EVENT_MAP: Record<string, string> = {
      compra_aprovada: "CompraAprovada",
      carrinho_abandonado: "CarrinhoAbandonado",
      pix_gerado: "PixGerado",
      aguardando_pagamento: "PixGerado",
      reembolso: "Reembolso",
      lead_capturado: "LeadNovo",
      inicio_checkout: "AddToCart",
      pagamento_recusado: "PagamentoRecusado",
      pagamento_expirado: "PagamentoExpirado",
      boleto_gerado: "BoletoGerado",
      compra_cancelada: "CompraCancelada",
      chargeback: "Chargeback",
      pagamento_pendente: "PagamentoPendente",
      assinatura_cancelada: "AssinaturaCancelada",
      troca_plano: "TrocaPlano",
      primeiro_acesso: "PrimeiroAcesso",
      trial_iniciado: "TrialIniciado",
    };
    const journeyEventName = JOURNEY_EVENT_MAP[evento];
    if (journeyEventName && leadId) {
      try {
        const eventInsert: any = {
          id: crypto.randomUUID(),
          event_name: journeyEventName,
          project_id: projectId,
          visitor_id: leadId,
          page_url: `webhook://${plataforma}`,
          event_data: { produto, valor, plataforma, evento, tipo_venda },
          utm_source: email?.toLowerCase() || null,
        };
        const { error: evtErr } = await supabase.from("imphq_events").insert(eventInsert);
        if (evtErr) {
          console.error("[webhook-pagamento] Erro ao inserir evento:", evtErr);
        }

        // Accumulate interaction + update ultimo_evento
        const { data: leadData } = await supabase.from("imphq_leads").select("data").eq("id", leadId).single();
        const currentData = (leadData?.data as Record<string, any>) || {};
        const interacoes: any[] = currentData.interacoes || [];
        const eventTimestamp = data_compra || new Date().toISOString();
        interacoes.push({
          evento,
          data: eventTimestamp,
          produto,
          valor,
          plataforma,
          tipo_venda,
          utms: { utm_source: body?.utm_source, utm_medium: body?.utm_medium, utm_campaign: body?.utm_campaign },
        });
        await supabase.from("imphq_leads").update({
          updated_at: eventTimestamp,
          data: { ...currentData, interacoes, ultimo_evento: evento, ultimo_evento_em: eventTimestamp, ultimo_produto: produto || currentData.ultimo_produto || null, ultimo_valor: valor || currentData.ultimo_valor || null },
        }).eq("id", leadId);

        // Scoring for non-purchase events
        if (evento !== "compra_aprovada") {
          const scoreMap: Record<string, number> = {
            inicio_checkout: 15,
            aguardando_pagamento: 20,
            pix_gerado: 20,
            carrinho_abandonado: 10,
            lead_capturado: 10,
            pagamento_recusado: 15,
            pagamento_expirado: 12,
            boleto_gerado: 18,
            compra_cancelada: -5,
            chargeback: -10,
            pagamento_pendente: 15,
            trial_iniciado: 25,
            primeiro_acesso: 30,
          };
          const pts = scoreMap[evento];
          if (pts) {
            await supabase.from("imphq_lead_scores_log").insert({ lead_id: leadId, acao: evento, pontos: pts });
            // Also update score field on imphq_leads incrementally
            const { data: curLead } = await supabase.from("imphq_leads").select("score").eq("id", leadId).maybeSingle();
            const curScore = Number(curLead?.score ?? 40);
            const newScore = Math.max(0, Math.min(99, curScore + pts));
            await supabase.from("imphq_leads").update({ score: newScore, updated_at: new Date().toISOString() }).eq("id", leadId);
          }
        }
      } catch (e) {
        console.warn("[webhook-pagamento] Erro ao registrar evento de jornada:", e);
      }
    }

    // Auto-create product in briefing if not exists
    if (produto && projectId) {
      try {
        const { data: projData } = await supabase
          .from("imphq_projects")
          .select("data")
          .eq("id", projectId)
          .single();
        if (projData?.data) {
          const currentData = projData.data as Record<string, any>;
          const produtos: any[] = currentData.produtos || [];
          const exists = produtos.some((p: any) => p.nome?.toLowerCase() === produto.toLowerCase());
          if (!exists) {
            produtos.push({ nome: produto, tipo: "Infoproduto", valor: valor || null, plataforma: plataforma || null });
            await supabase.from("imphq_projects").update({ data: { ...currentData, produtos } }).eq("id", projectId);
            console.log(`[webhook-pagamento] Produto "${produto}" adicionado ao briefing do projeto ${projectId}`);
          }
        }
      } catch (e) {
        console.warn("[webhook-pagamento] Erro ao auto-criar produto:", e);
      }
    }

    // Send CAPI event for supported event types
    const capiEventName = CAPI_EVENT_MAP[evento];
    if (capiEventName && fbToken && fbPixelId) {
      try {
        const capiResult = await sendCAPIEvent(
          fbToken, fbPixelId, fbTestCode,
          capiEventName, email, nome, phone, valor, produto
        );
        console.log(`[webhook-pagamento] CAPI ${capiEventName} enviado:`, capiResult);
      } catch (capiErr) {
        console.error("[webhook-pagamento] Erro CAPI:", capiErr);
      }
    }

    // Check automations — use aliases so lead_novo matches lead_capturado etc.
    const triggerAliases: Record<string, string[]> = {
      compra_aprovada: ["compra_aprovada"],
      carrinho_abandonado: ["carrinho_abandonado"],
      reembolso: ["reembolso"],
      lead_capturado: ["lead_capturado", "lead_novo"],
      inicio_checkout: ["inicio_checkout"],
      aguardando_pagamento: ["aguardando_pagamento"],
      pix_gerado: ["aguardando_pagamento", "pix_gerado"],
      pix_expired: ["aguardando_pagamento", "pagamento_expirado"],
      pagamento_recusado: ["pagamento_recusado", "carrinho_abandonado"],
      refused: ["pagamento_recusado", "carrinho_abandonado"],
      pagamento_expirado: ["pagamento_expirado", "carrinho_abandonado"],
      expired: ["pagamento_expirado", "carrinho_abandonado"],
      boleto_gerado: ["boleto_gerado", "aguardando_pagamento"],
      compra_cancelada: ["compra_cancelada", "reembolso"],
      chargeback: ["chargeback", "reembolso"],
      pagamento_pendente: ["pagamento_pendente", "aguardando_pagamento"],
      assinatura_cancelada: ["assinatura_cancelada"],
      troca_plano: ["troca_plano"],
      primeiro_acesso: ["primeiro_acesso", "compra_aprovada"],
      trial_iniciado: ["trial_iniciado"],
    };
    const triggerVariants = triggerAliases[evento] || [evento];

    if (triggerVariants.length > 0) {
      const { data: automacoes } = await supabase
        .from("imphq_automacoes")
        .select("*")
        .in("trigger_tipo", triggerVariants)
        .eq("ativo", true);

      // Filter by project and product
      const matched = (automacoes || []).filter((a: any) => {
        if (a.project_id && a.project_id !== projectId) return false;
        if (a.produto && produto && a.produto.toLowerCase() !== produto.toLowerCase()) return false;
        return true;
      });

      // Auto-create default automation if none is configured for the project
      if (matched.length === 0 && projectId && ["inicio_checkout", "pix_gerado"].includes(evento)) {
        try {
          const defaultName = evento === "pix_gerado" ? "Recuperação de Pix (Automático)" : "Recuperação de Carrinho (Automático)";
          const defaultDelay = evento === "pix_gerado" ? 5 : 10;
          const { data: newAuto, error: createErr } = await supabase
            .from("imphq_automacoes")
            .insert({
              nome: defaultName,
              trigger_tipo: evento,
              ativo: true,
              project_id: projectId,
              acoes: [
                { tipo: "delay", delay_min: defaultDelay },
                { tipo: "ia_message" }
              ]
            })
            .select("*")
            .single();
          if (createErr) {
            console.error("[webhook-pagamento] Erro ao criar automação padrão:", createErr.message);
          } else if (newAuto) {
            console.log("[webhook-pagamento] Automação padrão criada:", newAuto.nome);
            matched.push(newAuto);
          }
        } catch (err: any) {
          console.error("[webhook-pagamento] Catch erro ao criar automação padrão:", err.message);
        }
      }

      let executorSuccess = true;
      let executorError: string | null = null;
      if (matched.length > 0) {
        console.log(`[webhook-pagamento] ${matched.length} automações encontradas para ${evento}`);
        try {
          const execRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/openflow-executor`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                trigger_tipo: evento,
                project_id: projectId,
                lead_data: {
                  lead_id: leadId,
                  email,
                  nome,
                  phone,
                  produto,
                  valor,
                  plataforma,
                  tipo_venda,
                  link: body?.checkout_url || body?.order?.checkout_url || body?.data?.purchase?.checkout_url || "",
                },
              }),
            }
          );
          const execData = await execRes.json();
          console.log("[webhook-pagamento] openflow-executor result:", JSON.stringify(execData).slice(0, 300));
          // Strict check: only true when explicitly ok
          if (execData.ok !== true) {
            executorSuccess = false;
            executorError = execData.error || execData.message || "Executor retornou sem ok=true";
          }
        } catch (flowErr: any) {
          console.error("[webhook-pagamento] Erro ao chamar openflow-executor:", flowErr);
          executorSuccess = false;
          executorError = flowErr.message || String(flowErr);
        }
      }

      // Mark webhook as processed only when executor succeeded or no automations matched
      if (webhookRow?.id) {
        if (executorSuccess) {
          await supabase.from("imphq_webhooks").update({ processado: true }).eq("id", webhookRow.id);
        } else if (executorError) {
          // Log the error linked to this webhook
          await supabase.from("imphq_webhook_errors").insert({
            webhook_id: webhookRow.id,
            plataforma,
            evento,
            erro: executorError,
            payload: body,
            project_id: projectId,
          });
          console.warn(`[webhook-pagamento] Webhook ${webhookRow.id} NOT marked as processed. Error: ${executorError}`);
        }
      }
    } else {
      // No trigger mapping — still mark as processed (data was saved)
      if (webhookRow?.id) {
        await supabase.from("imphq_webhooks").update({ processado: true }).eq("id", webhookRow.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, plataforma, evento, lead_id: leadId, project_id: projectId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[webhook-pagamento] Erro:", err);

    // Log error to imphq_webhook_errors
    try {
      const supabaseErr = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseErr.from("imphq_webhook_errors").insert({
        plataforma: body?.plataforma || "desconhecido",
        evento: body?.evento || body?.event || "desconhecido",
        erro: String(err),
        payload: body,
        project_id: projectId,
      });
    } catch (logErr) {
      console.error("[webhook-pagamento] Erro ao logar falha:", logErr);
    }

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
