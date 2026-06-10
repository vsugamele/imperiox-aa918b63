/**
 * wa-weekly-report — Relatório semanal automático para donos de projeto
 *
 * Roda toda segunda-feira às 08h. Compila dados da semana anterior:
 *   • Conversões (vendas aprovadas)
 *   • Leads ativos (com conversa WA em andamento)
 *   • Fluxos com melhor ROI
 *   • Perguntas sem resposta no base de conhecimento
 *   • Novos leads captados
 *
 * Entrega via WhatsApp (Evolution API) para o número do dono do projeto.
 * Fallback: grava relatório em imphq_events para exibição no dashboard.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_AI_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results = { processed: 0, sent: 0, errors: [] as string[] };

  try {
    // Janela da semana anterior
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const weekStartIso = weekStart.toISOString();
    const weekLabel = `${weekStart.toLocaleDateString("pt-BR")} – ${now.toLocaleDateString("pt-BR")}`;

    // Busca todos os projetos ativos com owner_phone configurado
    const { data: projects, error: projErr } = await supabase
      .from("imphq_projects")
      .select("id, name, owner_phone, owner_email")
      .eq("active", true);

    if (projErr) throw projErr;
    if (!projects?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhum projeto ativo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const proj of projects) {
      results.processed++;

      try {
        const projectId = proj.id;

        // ── Dados da semana em paralelo ────────────────────────────────────
        const [
          vendasRes,
          novosLeadsRes,
          leadsAtivosRes,
          perguntas0Res,
        ] = await Promise.all([
          // Vendas aprovadas na semana
          supabase.from("imphq_vendas")
            .select("id, valor, lead_id, produto_nome, created_at")
            .eq("project_id", projectId)
            .eq("status", "aprovado")
            .gte("created_at", weekStartIso),

          // Novos leads captados na semana
          supabase.from("imphq_leads")
            .select("id, nome, phone, created_at")
            .eq("project_id", projectId)
            .gte("created_at", weekStartIso),

          // Leads com conversa WA ativa
          supabase.from("imphq_wa_conversations")
            .select("id, phone, status, last_message_at")
            .eq("project_id", projectId)
            .eq("ia_ativa", true)
            .neq("status", "closed"),

          // Perguntas sem resposta no knowledge base
          supabase.from("imphq_wa_knowledge")
            .select("id, question, created_at")
            .eq("project_id", projectId)
            .eq("answered", false)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        const vendas = vendasRes.data || [];
        const novosLeads = novosLeadsRes.data || [];
        const leadsAtivos = leadsAtivosRes.data || [];
        const perguntasSemResposta = perguntas0Res.data || [];

        // ROI por automação (usa RPC criada na migration anterior)
        const { data: roiData } = await supabase.rpc("flow_roi_by_automation", {
          p_project_id: projectId,
          p_since: weekStartIso,
        }).limit(3);

        // ── Calcular métricas ──────────────────────────────────────────────
        const totalRevenue = vendas.reduce((s: number, v: any) => s + (Number(v.valor) || 0), 0);
        const convCount = vendas.length;
        const topFlows = (roiData || []).slice(0, 3);

        // ── Formatar relatório ─────────────────────────────────────────────
        const lines: string[] = [
          `📊 *Relatório Semanal — ${proj.name || "Seu Projeto"}*`,
          `📅 ${weekLabel}`,
          ``,
          `💰 *Conversões*`,
          convCount > 0
            ? `✅ ${convCount} venda${convCount > 1 ? "s" : ""} aprovada${convCount > 1 ? "s" : ""} — R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : `• Nenhuma venda registrada esta semana`,
          ``,
          `👥 *Leads*`,
          `• ${novosLeads.length} novo${novosLeads.length !== 1 ? "s" : ""} lead${novosLeads.length !== 1 ? "s" : ""} captado${novosLeads.length !== 1 ? "s" : ""}`,
          `• ${leadsAtivos.length} conversa${leadsAtivos.length !== 1 ? "s" : ""} ativa${leadsAtivos.length !== 1 ? "s" : ""} no WA`,
        ];

        if (topFlows.length > 0) {
          lines.push(``, `🔄 *Fluxos com melhor desempenho*`);
          for (const f of topFlows) {
            const rev = f.revenue_total > 0
              ? ` — R$ ${Number(f.revenue_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : "";
            lines.push(`• ${f.automacao_nome || "Fluxo"}: ${f.conversions || 0} conversões${rev}`);
          }
        }

        if (perguntasSemResposta.length > 0) {
          lines.push(``, `❓ *Perguntas sem resposta na base de conhecimento*`);
          for (const q of perguntasSemResposta.slice(0, 3)) {
            lines.push(`• "${(q.question || "").slice(0, 60)}${(q.question || "").length > 60 ? "…" : ""}"`);
          }
          if (perguntasSemResposta.length > 3) {
            lines.push(`  _+${perguntasSemResposta.length - 3} outras_`);
          }
        }

        lines.push(``, `_Relatório gerado automaticamente pelo sistema AIOS_ 🤖`);

        const reportText = lines.join("\n");

        // ── Gravar evento (sempre) ─────────────────────────────────────────
        await supabase.from("imphq_events").insert({
          project_id: projectId,
          event_name: "weekly_report_generated",
          page_url: "",
          visitor_id: "system",
          event_data: {
            week_label: weekLabel,
            conversions: convCount,
            revenue: totalRevenue,
            new_leads: novosLeads.length,
            active_conversations: leadsAtivos.length,
            unanswered_questions: perguntasSemResposta.length,
            top_flows: topFlows.slice(0, 3).map((f: any) => ({
              nome: f.automacao_nome,
              conversions: f.conversions,
              revenue: f.revenue_total,
            })),
            report_text: reportText,
          },
        });

        // ── Enviar via WhatsApp se owner_phone configurado ─────────────────
        if (!proj.owner_phone) {
          console.log(`[wa-weekly-report] ${proj.name}: sem owner_phone, relatório salvo no dashboard.`);
          continue;
        }

        // Busca provider Evolution do projeto
        const { data: providers } = await supabase
          .from("imphq_wa_providers")
          .select("id, api_url, api_key, instance_name, provider")
          .eq("project_id", projectId)
          .eq("provider", "evolution")
          .eq("ai_enabled", true)
          .limit(1);

        const provider = providers?.[0];
        if (!provider?.api_url) {
          console.log(`[wa-weekly-report] ${proj.name}: sem provider Evolution disponível.`);
          continue;
        }

        const base = provider.api_url.replace(/\/+$/, "");
        const inst = encodeURIComponent(provider.instance_name);

        const sendRes = await fetch(`${base}/message/sendText/${inst}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: provider.api_key },
          body: JSON.stringify({
            number: proj.owner_phone + "@s.whatsapp.net",
            text: reportText,
            options: { delay: 1200 },
          }),
        });

        if (sendRes.ok) {
          console.log(`[wa-weekly-report] ✅ Relatório enviado para ${proj.owner_phone} (${proj.name})`);
          results.sent++;
        } else {
          const errText = await sendRes.text();
          console.error(`[wa-weekly-report] Erro ao enviar para ${proj.owner_phone}: ${errText.slice(0, 100)}`);
          results.errors.push(`${proj.name}: ${sendRes.status}`);
        }

        // Pausa entre projetos
        await new Promise(r => setTimeout(r, 500));

      } catch (projErr: any) {
        console.error(`[wa-weekly-report] Erro no projeto ${proj.id}:`, projErr.message);
        results.errors.push(`${proj.id}: ${projErr.message}`);
      }
    }

    console.log(`[wa-weekly-report] Concluído:`, results);
    return new Response(JSON.stringify({ ok: true, week: weekLabel, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[wa-weekly-report] Fatal:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
