// Cron: detecta carrinhos Pix/Boleto gerados há 30min-24h ainda não pagos
// e dispara push notification 1x por venda (dedup via imphq_notifications).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pushNotifyByPref, resolveProjectRecipients } from "../_shared/push-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const min30 = new Date(now - 30 * 60 * 1000).toISOString();
  const h24 = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { data: vendas, error } = await supabase
    .from("imphq_vendas")
    .select("id, lead_id, project_id, produto_nome, valor, status, data_venda, plataforma")
    .in("status", ["pix_gerado", "boleto_gerado", "aguardando_pagamento", "pendente", "inicio_checkout"])
    .gte("data_venda", h24)
    .lte("data_venda", min30)
    .limit(200);

  if (error) {
    console.error("[checkout-abandoned-scanner]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let notified = 0;
  for (const v of vendas || []) {
    // Dedup: já notificamos esta venda?
    const { data: existing } = await supabase
      .from("imphq_notifications")
      .select("id")
      .eq("type", "checkout_abandonado")
      .eq("entity_type", "venda")
      .eq("entity_id", v.id)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    let nomeLead = "Lead";
    if (v.lead_id) {
      const { data: lead } = await supabase
        .from("imphq_leads")
        .select("nome")
        .eq("id", v.lead_id)
        .maybeSingle();
      if (lead?.nome) nomeLead = lead.nome;
    }

    const tipo = v.status === "boleto_gerado" ? "Boleto" : v.status === "pix_gerado" ? "Pix" : "Checkout";
    const valor = v.valor ? ` R$ ${Number(v.valor).toFixed(2)}` : "";
    const title = `🛒 ${tipo} abandonado`;
    const message = `${nomeLead} gerou ${tipo}${valor} (${v.produto_nome || "produto"}) e não pagou.`;

    const recipients = await resolveProjectRecipients(supabase, v.project_id);
    await pushNotifyByPref({
      supabase,
      prefKey: "checkout_abandonado",
      title,
      message,
      user_ids: recipients.length > 0 ? recipients : undefined,
    });

    await supabase.from("imphq_notifications").insert({
      type: "checkout_abandonado",
      entity_type: "venda",
      entity_id: v.id,
      title,
      message,
    });
    notified++;
  }

  return new Response(
    JSON.stringify({ scanned: vendas?.length || 0, notified }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
