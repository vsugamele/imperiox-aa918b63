// lead-score-updater: atualiza score dinâmico de leads baseado em comportamento real
// Roda via cron diário. Score reflete engajamento recente e probabilidade de conversão.
// v2: detecta cruzamento de threshold (CLOSER_THRESHOLD) e seta closer_triggered_at
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Score a partir do qual o lead é considerado "hot" e ativa closer automático
const CLOSER_THRESHOLD = 70;

// Regras de pontuação
const SCORE_RULES = {
  wa_message_incoming: 8,      // lead respondeu no WA
  wa_message_incoming_max: 48, // cap: 6 mensagens
  email_opened: 4,
  email_opened_max: 20,
  email_clicked: 12,
  email_clicked_max: 36,
  checkout_visited: 20,
  purchase_approved: 100,
  flow_attribution: 15,        // estava em fluxo quando converteu
  in_active_flow: 8,           // ainda em fluxo ativo
  inactivity_per_7d: -10,      // penalidade por semana de silêncio
  inactivity_max_penalty: -40,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Permite rodar para um projeto específico ou todos
    let projectFilter: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        projectFilter = body?.project_id || null;
      } catch (_) {}
    }

    // Busca todos os projetos (ou o filtrado)
    let projQuery = supabase.from("imphq_projects").select("id");
    if (projectFilter) projQuery = projQuery.eq("id", projectFilter);
    const { data: projects } = await projQuery;

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ ok: true, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const since7d  = new Date(Date.now() -  7 * 24 * 3600 * 1000).toISOString();
    let totalUpdated = 0;

    for (const proj of projects) {
      const projectId = proj.id;

      // Busca todos os leads do projeto
      const { data: leads } = await supabase
        .from("imphq_leads")
        .select("id, phone, email, score, closer_triggered_at")
        .eq("project_id", projectId)
        .limit(2000);

      if (!leads || leads.length === 0) continue;

      // Dados agregados por projeto (uma query por tipo, não por lead)
      const phones = leads.map((l: any) => l.phone).filter(Boolean);
      const leadIds = leads.map((l: any) => l.id);
      const emails = leads.map((l: any) => l.email).filter(Boolean);

      const [
        waMsgsRes,
        emailEventsRes,
        checkoutEventsRes,
        purchasesRes,
        activeFlowsRes,
        attributionRes,
        lastActivityRes,
      ] = await Promise.all([
        // Mensagens WA incoming por telefone nos últimos 30d
        supabase.from("imphq_wa_messages")
          .select("phone")
          .in("phone", phones.length ? phones : ["_none_"])
          .eq("direction", "incoming")
          .gte("created_at", since30d),

        // Eventos de email por email nos últimos 30d
        supabase.from("imphq_events")
          .select("event_data, event_name")
          .in("event_name", ["email_opened", "email_clicked"])
          .eq("project_id", projectId)
          .gte("created_at", since30d),

        // Eventos de checkout nos últimos 30d
        supabase.from("imphq_events")
          .select("event_data")
          .in("event_name", ["checkout_visited", "checkout_clicked", "link_clicked"])
          .eq("project_id", projectId)
          .gte("created_at", since30d),

        // Compras aprovadas
        supabase.from("imphq_vendas")
          .select("lead_id")
          .in("lead_id", leadIds.length ? leadIds : ["_none_"])
          .eq("status", "aprovado"),

        // Leads em fluxo ativo
        supabase.from("imphq_flow_executions")
          .select("lead_id")
          .in("lead_id", leadIds.length ? leadIds : ["_none_"])
          .in("status", ["running", "waiting"]),

        // Flow attributions (converteu dentro de fluxo)
        supabase.from("imphq_events")
          .select("event_data")
          .eq("event_name", "flow_attribution")
          .eq("project_id", projectId)
          .gte("created_at", since30d),

        // Última atividade (mensagem incoming) por telefone
        supabase.from("imphq_wa_messages")
          .select("phone, created_at")
          .in("phone", phones.length ? phones : ["_none_"])
          .eq("direction", "incoming")
          .gte("created_at", new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString())
          .order("created_at", { ascending: false }),
      ]);

      // Indexa dados por phone/lead_id
      const waMsgsByPhone: Record<string, number> = {};
      for (const m of (waMsgsRes.data || [])) {
        waMsgsByPhone[m.phone] = (waMsgsByPhone[m.phone] || 0) + 1;
      }

      const emailOpensByEmail: Record<string, number> = {};
      const emailClicksByEmail: Record<string, number> = {};
      for (const e of (emailEventsRes.data || [])) {
        const email = (e.event_data as any)?.to_email || (e.event_data as any)?.email;
        if (!email) continue;
        if (e.event_name === "email_opened") emailOpensByEmail[email] = (emailOpensByEmail[email] || 0) + 1;
        if (e.event_name === "email_clicked") emailClicksByEmail[email] = (emailClicksByEmail[email] || 0) + 1;
      }

      const checkoutByLeadId = new Set<string>();
      for (const e of (checkoutEventsRes.data || [])) {
        const leadId = (e.event_data as any)?.lead_id;
        if (leadId) checkoutByLeadId.add(leadId);
      }

      const purchasedLeadIds = new Set((purchasesRes.data || []).map((p: any) => p.lead_id));
      const activeFlowLeadIds = new Set((activeFlowsRes.data || []).map((f: any) => f.lead_id));
      const attributedLeadIds = new Set(
        (attributionRes.data || []).map((e: any) => (e.event_data as any)?.lead_id).filter(Boolean)
      );

      // Última atividade indexada por phone
      const lastActivityByPhone: Record<string, string> = {};
      for (const m of (lastActivityRes.data || [])) {
        if (!lastActivityByPhone[m.phone]) lastActivityByPhone[m.phone] = m.created_at;
      }

      // Calcula e atualiza score de cada lead
      for (const lead of leads) {
        let score = 0;

        // WA engagement
        const waMsgs = Math.min(waMsgsByPhone[lead.phone] || 0, 6);
        score += waMsgs * SCORE_RULES.wa_message_incoming;

        // Email engagement
        const opens = Math.min(emailOpensByEmail[lead.email] || 0, 5);
        const clicks = Math.min(emailClicksByEmail[lead.email] || 0, 3);
        score += opens * SCORE_RULES.email_opened;
        score += clicks * SCORE_RULES.email_clicked;

        // Checkout / link
        if (checkoutByLeadId.has(lead.id)) score += SCORE_RULES.checkout_visited;

        // Purchase
        if (purchasedLeadIds.has(lead.id)) score += SCORE_RULES.purchase_approved;

        // Active flow
        if (activeFlowLeadIds.has(lead.id)) score += SCORE_RULES.in_active_flow;

        // Flow attribution
        if (attributedLeadIds.has(lead.id)) score += SCORE_RULES.flow_attribution;

        // Inactivity penalty (por semana de silêncio, máx 4 semanas)
        const lastActivity = lastActivityByPhone[lead.phone];
        if (lastActivity) {
          const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 3600 * 24);
          const weeksSilent = Math.floor(daysSince / 7);
          const penalty = Math.max(SCORE_RULES.inactivity_max_penalty, weeksSilent * SCORE_RULES.inactivity_per_7d);
          score += penalty;
        }

        score = Math.max(0, Math.min(200, score)); // clamp 0–200

        const prevScore = lead.score || 0;
        const crossedThreshold =
          prevScore < CLOSER_THRESHOLD &&
          score >= CLOSER_THRESHOLD &&
          !lead.closer_triggered_at; // só aciona uma vez

        // Só atualiza se mudou
        if (score !== prevScore || crossedThreshold) {
          const updatePayload: Record<string, any> = {
            score,
            updated_at: new Date().toISOString(),
          };

          // Novo! Marca lead como "hot" quando cruza o threshold
          if (crossedThreshold) {
            updatePayload.closer_triggered_at = new Date().toISOString();
            console.log(`[lead-score-updater] 🔥 Lead ${lead.id} (${lead.phone}) cruzou threshold! Score: ${prevScore} → ${score}`);
          }

          await supabase
            .from("imphq_leads")
            .update(updatePayload)
            .eq("id", lead.id);
          totalUpdated++;
        }
      }

      console.log(`[lead-score-updater] Project ${projectId}: ${leads.length} leads avaliados`);
    }

    return new Response(JSON.stringify({ ok: true, updated: totalUpdated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[lead-score-updater] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
