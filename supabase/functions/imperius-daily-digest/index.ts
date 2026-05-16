// Imperius Daily Digest — manhã, 8h
// Envia e-mail + push com resumo da fila + ações executadas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: pending }, { data: executed }] = await Promise.all([
      supabase
        .from("imphq_ai_actions")
        .select("id, title, impact_brl, priority_score, risk_level, projeto_id")
        .eq("status", "proposed")
        .order("priority_score", { ascending: false })
        .limit(10),
      supabase
        .from("imphq_ai_actions")
        .select("id, title, kind, impact_brl, status")
        .gte("executed_at", since)
        .in("status", ["executed", "failed"])
        .limit(50),
    ]);

    const totalImpact = (pending || []).reduce((s: number, a: any) => s + Number(a.impact_brl || 0), 0);
    const recoveredImpact = (executed || [])
      .filter((a: any) => a.status === "executed")
      .reduce((s: number, a: any) => s + Number(a.impact_brl || 0), 0);

    const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#080607;color:#e8e6e3;padding:24px;border-radius:12px;">
        <h1 style="font-family:Georgia,serif;color:#c9922a;margin:0 0 6px;font-size:28px;">Imperius — Briefing</h1>
        <p style="color:#a39c93;font-size:14px;margin:0 0 24px;">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        
        <div style="background:#0f0d0e;border:1px solid #2a2625;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="margin:0 0 4px;color:#c9922a;font-size:11px;letter-spacing:2px;">AGUARDANDO APROVAÇÃO</p>
          <p style="margin:0;font-size:24px;font-weight:bold;">${pending?.length || 0} ações · ${fmt(totalImpact)} em jogo</p>
        </div>

        <div style="background:#0f0d0e;border:1px solid #2a2625;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 4px;color:#5cbdb9;font-size:11px;letter-spacing:2px;">EXECUTADAS ONTEM</p>
          <p style="margin:0;font-size:24px;font-weight:bold;">${(executed || []).length} ações · ${fmt(recoveredImpact)} recuperados</p>
        </div>

        ${(pending || []).length > 0 ? `
          <h3 style="color:#c9922a;font-family:Georgia,serif;border-bottom:1px solid #2a2625;padding-bottom:8px;">Top prioridade</h3>
          ${(pending || []).slice(0, 5).map((a: any) => `
            <div style="padding:12px 0;border-bottom:1px solid #1a1716;">
              <p style="margin:0 0 4px;font-weight:600;">${a.title}</p>
              <p style="margin:0;color:#a39c93;font-size:12px;">${fmt(Number(a.impact_brl || 0))} · risco ${a.risk_level}</p>
            </div>
          `).join("")}
        ` : ""}

        <div style="text-align:center;margin-top:32px;">
          <a href="https://imperiox.lovable.app/imperius" style="background:#c9922a;color:#080607;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;display:inline-block;">Abrir Imperius</a>
        </div>
      </div>
    `;

    // Busca admins para enviar
    const { data: admins } = await supabase
      .from("imphq_team_members")
      .select("email, name")
      .in("role", ["admin", "owner"]);

    let sent = 0;
    for (const a of admins || []) {
      if (!a.email) continue;
      try {
        await supabase.functions.invoke("send-project-email", {
          body: {
            to: a.email,
            subject: `⚡ Imperius: ${pending?.length || 0} ações · ${fmt(totalImpact)} em jogo`,
            html,
          },
        });
        sent++;
      } catch (e) {
        console.error("send error", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, pending: pending?.length || 0, executed: executed?.length || 0, totalImpact, recoveredImpact }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("imperius-daily-digest:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
