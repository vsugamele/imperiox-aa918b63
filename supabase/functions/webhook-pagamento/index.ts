import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function parseWebhookBody(body: any, hotmartToken: string | null) {
  let plataforma = "desconhecido";
  let evento = "desconhecido";
  let email = "";
  let nome = "";
  let phone = "";
  let valor = 0;
  let produto = "";

  // ── Ticto v2 detection (version field or token in body) ──
  if (body?.version === "2.0" || (body?.token && body?.item && body?.customer)) {
    plataforma = "Ticto";
    const status = body.status || "";
    const statusMap: Record<string, string> = {
      authorized: "compra_aprovada",
      abandoned_cart: "carrinho_abandonado",
      refunded: "reembolso",
      waiting_payment: "aguardando_pagamento",
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

    // paid_amount comes in cents in v2
    const order = body.order || {};
    valor = (order.paid_amount || 0) / 100;

    const item = body.item || {};
    produto = item.product_name || "";
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
  }

  return { plataforma, evento, email, nome, phone, valor, produto };
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

    let { plataforma, evento, email, nome, phone, valor, produto } = parseWebhookBody(body, hotmartToken);

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
        await supabase.from("imphq_leads").insert({
          id: newId,
          nome: nome || email,
          email: email.toLowerCase(),
          phone: phone || null,
          plataforma,
          status: evento === "compra_aprovada" ? "cliente" : "lead",
          project_id: projectId,
        });
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

      fbToken = proj?.data?.facebook_access_token;
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
      await supabase.from("imphq_vendas").insert({
        id: crypto.randomUUID(),
        lead_id: leadId,
        project_id: projectId,
        produto_nome: produto,
        valor,
        plataforma,
        status: "aprovado",
      });

      await supabase
        .from("imphq_leads")
        .update({ status: "cliente" })
        .eq("id", leadId);
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
        await supabase.from("imphq_events").insert({
          event_name: journeyEventName,
          project_id: projectId,
          visitor_id: leadId,
          page_url: `webhook://${plataforma}`,
          event_data: { produto, valor, plataforma, evento },
          utm_source: email?.toLowerCase() || null,
        });
        // Update ultimo_evento on lead
        const { data: leadData } = await supabase.from("imphq_leads").select("data").eq("id", leadId).single();
        const currentData = (leadData?.data as Record<string, any>) || {};
        await supabase.from("imphq_leads").update({
          data: { ...currentData, ultimo_evento: evento },
        }).eq("id", leadId);
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

      if (automacoes && automacoes.length > 0) {
        console.log(`[webhook-pagamento] ${automacoes.length} automações encontradas para ${triggerTipo}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, plataforma, evento, lead_id: leadId, project_id: projectId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[webhook-pagamento] Erro:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
