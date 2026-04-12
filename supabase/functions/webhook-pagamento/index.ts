import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function extractUtms(body: any): Record<string, string> | null {
  const src = body?.utm_source || body?.data?.purchase?.tracking?.source || body?.tracking?.utm_source;
  const med = body?.utm_medium || body?.data?.purchase?.tracking?.medium || body?.tracking?.utm_medium;
  const cmp = body?.utm_campaign || body?.data?.purchase?.tracking?.campaign || body?.tracking?.utm_campaign;
  const cnt = body?.utm_content || body?.tracking?.utm_content;
  const trm = body?.utm_term || body?.tracking?.utm_term;
  if (src || med || cmp) return { utm_source: src || "", utm_medium: med || "", utm_campaign: cmp || "", utm_content: cnt || "", utm_term: trm || "" };
  return null;
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
      chargeback: "chargeback",
      blocked: "bloqueado",
      started: "inicio_checkout",
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
  else if (hotmartToken || body?.event?.includes?.("PURCHASE")) {
    plataforma = "Hotmart";
    const ev = body.event || "";
    if (ev.includes("APPROVED") || ev.includes("COMPLETE")) evento = "compra_aprovada";
    else if (ev.includes("REFUND")) evento = "reembolso";
    else if (ev.includes("ABANDONED") || ev.includes("CHECKOUT")) evento = "carrinho_abandonado";
    else evento = ev.toLowerCase();

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
    if (status === "paid" || status === "approved") evento = "compra_aprovada";
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

  return { plataforma, evento, email, nome, phone, valor, produto, data_compra, tipo_venda, financeiro, utms };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const queryProjectId = url.searchParams.get("project");
    // Allow overriding event type via query param (e.g. ?event=Lead)
    const queryEvent = url.searchParams.get("event");

    const body = await req.json();
    const hotmartToken = req.headers.get("x-hotmart-hottok");

    let { plataforma, evento, email, nome, phone, valor, produto, data_compra, tipo_venda, financeiro, utms: webhookUtms } = parseWebhookBody(body, hotmartToken);

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

    let projectId: string | null = queryProjectId;

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
    await supabase.from("imphq_webhooks").insert({
      project_id: projectId,
      plataforma,
      evento,
      payload: body,
      lead_id: leadId,
      processado: false,
    });

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

    // Handle purchase
    if (evento === "compra_aprovada" && leadId && valor > 0) {
      // Deduplication: check if same sale exists within last 5 minutes
      const { data: existingDup } = await supabase
        .from("imphq_vendas")
        .select("id")
        .eq("lead_id", leadId)
        .eq("produto_nome", produto)
        .eq("valor", valor)
        .gte("created_at", new Date(Date.now() - 5 * 60000).toISOString())
        .limit(1);

      if (existingDup && existingDup.length > 0) {
        console.log("[webhook-pagamento] Venda duplicada ignorada para lead", leadId);
      } else {
        const vendaData: Record<string, any> = {};
        if (financeiro) Object.assign(vendaData, financeiro);
        if (webhookUtms) vendaData.utms = webhookUtms;
        if (tipo_venda !== "principal") vendaData.tipo_venda = tipo_venda;

        const vendaInsert: any = {
          id: crypto.randomUUID(),
          lead_id: leadId,
          project_id: projectId,
          produto_nome: produto,
          valor,
          plataforma,
          status: "aprovado",
          tipo_venda,
          data: Object.keys(vendaData).length > 0 ? vendaData : null,
        };
        if (data_compra) vendaInsert.created_at = data_compra;
        const { error: vendaErr } = await supabase.from("imphq_vendas").insert(vendaInsert);
        if (vendaErr) {
          console.error("[webhook-pagamento] Erro ao inserir venda:", vendaErr);
        } else {
          console.log("[webhook-pagamento] Venda inserida:", vendaInsert.id);
        }
      }

      // Handle Ticto bumps as separate sales
      if (plataforma === "Ticto" && body?.order?.bumps && Array.isArray(body.order.bumps)) {
        for (const bump of body.order.bumps) {
          const bumpValor = ((bump.price || bump.amount || 0)) / 100;
          const bumpProduto = bump.product_name || bump.name || "Order Bump";
          if (bumpValor > 0) {
            const bumpId = crypto.randomUUID();
            await supabase.from("imphq_vendas").insert({
              id: bumpId,
              lead_id: leadId,
              project_id: projectId,
              produto_nome: bumpProduto,
              valor: bumpValor,
              plataforma,
              status: "aprovado",
              tipo_venda: "orderbump",
              data: { tipo_venda: "orderbump" },
              ...(data_compra ? { created_at: data_compra } : {}),
            });
            console.log("[webhook-pagamento] Bump inserido:", bumpId, bumpProduto, bumpValor);
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

      // Lead scoring for purchase
      try {
        const scoreRows: any[] = [{ lead_id: leadId, acao: `compra_${tipo_venda}`, pontos: tipo_venda === "principal" ? 50 : tipo_venda === "upsell" ? 30 : tipo_venda === "orderbump" ? 20 : 50 }];
        await supabase.from("imphq_lead_scores_log").insert(scoreRows);
      } catch (e) { console.warn("[webhook-pagamento] Score error:", e); }
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
        if (data_compra) vendaInsert.created_at = data_compra;
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
          };
          const pts = scoreMap[evento];
          if (pts) {
            await supabase.from("imphq_lead_scores_log").insert({ lead_id: leadId, acao: evento, pontos: pts });
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

    // Check automations
    const triggerMap: Record<string, string> = {
      compra_aprovada: "compra_aprovada",
      carrinho_abandonado: "carrinho_abandonado",
      reembolso: "reembolso",
      lead_capturado: "lead_capturado",
      inicio_checkout: "inicio_checkout",
    };
    const triggerTipo = triggerMap[evento];
    if (triggerTipo) {
      const { data: automacoes } = await supabase
        .from("imphq_automacoes")
        .select("*")
        .eq("trigger_tipo", triggerTipo)
        .eq("ativo", true);

      // Filter by project and product
      const matched = (automacoes || []).filter((a: any) => {
        if (a.project_id && a.project_id !== projectId) return false;
        if (a.produto && produto && a.produto.toLowerCase() !== produto.toLowerCase()) return false;
        return true;
      });

      if (matched.length > 0) {
        console.log(`[webhook-pagamento] ${matched.length} automações encontradas para ${triggerTipo}`);
        // Trigger openflow-executor for each matched automation
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
                trigger_tipo: triggerTipo,
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
                },
              }),
            }
          );
          const execData = await execRes.json();
          console.log("[webhook-pagamento] openflow-executor result:", JSON.stringify(execData).slice(0, 300));
        } catch (flowErr) {
          console.error("[webhook-pagamento] Erro ao chamar openflow-executor:", flowErr);
        }
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
      const rawBody = typeof body !== "undefined" ? body : null;
      await supabaseErr.from("imphq_webhook_errors").insert({
        plataforma: rawBody?.plataforma || "desconhecido",
        evento: rawBody?.evento || rawBody?.event || "desconhecido",
        erro: String(err),
        payload: rawBody,
        project_id: typeof projectId !== "undefined" ? projectId : null,
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
