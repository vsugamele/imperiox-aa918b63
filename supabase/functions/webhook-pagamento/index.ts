import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read project_id from query string (priority)
    const url = new URL(req.url);
    const queryProjectId = url.searchParams.get("project");

    const body = await req.json();
    const hotmartToken = req.headers.get("x-hotmart-hottok");

    let plataforma = "desconhecido";
    let evento = "desconhecido";
    let email = "";
    let nome = "";
    let phone = "";
    let valor = 0;
    let produto = "";
    let projectId: string | null = queryProjectId;

    if (hotmartToken || body?.event?.includes?.("PURCHASE")) {
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
    } else if (body?.webhook_event_type || body?.order_status) {
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
    } else if (body?.tipo_evento || body?.dados) {
      plataforma = "Ticto";
      evento = body.tipo_evento === "venda_aprovada" ? "compra_aprovada" : body.tipo_evento || "desconhecido";
      const dados = body.dados || {};
      email = dados.email_comprador || "";
      nome = dados.nome_comprador || "";
      phone = dados.telefone_comprador || "";
      valor = parseFloat(dados.valor || "0");
      produto = dados.nome_produto || "";
    } else {
      plataforma = body.plataforma || "Outro";
      evento = body.evento || body.event_type || "desconhecido";
      email = body.email || body.customer?.email || "";
      nome = body.nome || body.customer?.name || "";
      phone = body.phone || body.customer?.phone || "";
      valor = parseFloat(body.valor || body.amount || "0");
      produto = body.produto || body.product || "";
    }

    // Try to find project by product name match (only if no query param)
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

    // If purchase approved, create sale and update lead
    if (evento === "compra_aprovada" && leadId && valor > 0) {
      await supabase.from("imphq_vendas").insert({
        id: crypto.randomUUID(),
        lead_id: leadId,
        project_id: projectId,
        produto,
        valor,
        plataforma,
        status: "aprovado",
      });

      await supabase
        .from("imphq_leads")
        .update({ status: "cliente" })
        .eq("id", leadId);

      // Send Facebook CAPI event if project has access token configured
      if (projectId) {
        const { data: proj } = await supabase
          .from("imphq_projects")
          .select("data")
          .eq("id", projectId)
          .single();

        const fbToken = proj?.data?.facebook_access_token;
        const fbPixelId = proj?.data?.facebook_pixel_id;
        const fbTestCode = proj?.data?.facebook_test_event_code;

        if (fbToken && fbPixelId) {
          try {
            const eventData: any = {
              data: [{
                event_name: "Purchase",
                event_time: Math.floor(Date.now() / 1000),
                action_source: "website",
                user_data: {
                  em: [await hashSHA256(email.toLowerCase())],
                  fn: nome ? [await hashSHA256(nome.toLowerCase().split(" ")[0])] : undefined,
                  ph: phone ? [await hashSHA256(phone.replace(/\D/g, ""))] : undefined,
                },
                custom_data: {
                  currency: "BRL",
                  value: valor,
                  content_name: produto,
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
            const capiResult = await capiRes.json();
            console.log(`[webhook-pagamento] CAPI Purchase enviado:`, capiResult);
          } catch (capiErr) {
            console.error("[webhook-pagamento] Erro CAPI:", capiErr);
          }
        }
      }
    }

    // Check automations
    const triggerMap: Record<string, string> = {
      compra_aprovada: "compra_aprovada",
      carrinho_abandonado: "carrinho_abandonado",
      reembolso: "reembolso",
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
