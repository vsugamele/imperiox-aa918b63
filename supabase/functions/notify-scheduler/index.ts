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

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const inserted: string[] = [];

    // Helper: check if notification already exists (avoid dupes)
    async function alreadyNotified(entityType: string, entityId: string, type: string): Promise<boolean> {
      const { data } = await supabase
        .from("imphq_notifications")
        .select("id")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("type", type)
        .gte("created_at", todayStr + "T00:00:00Z")
        .limit(1);
      return (data && data.length > 0);
    }

    // Helper: get all user IDs (team owner + members)
    async function getAllUserIds(): Promise<string[]> {
      const { data: members } = await supabase
        .from("imphq_team_members")
        .select("user_id")
        .not("user_id", "is", null);
      const ids = new Set<string>();
      if (members) members.forEach((m: any) => { if (m.user_id) ids.add(m.user_id); });
      // Also get distinct owner_ids from projects
      const { data: projects } = await supabase
        .from("imphq_projects")
        .select("owner_id")
        .limit(100);
      if (projects) projects.forEach((p: any) => { if (p.owner_id) ids.add(p.owner_id); });
      return Array.from(ids);
    }

    const userIds = await getAllUserIds();
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: "No users found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Tarefas vencendo hoje
    const { data: dueTodayCards } = await supabase
      .from("imphq_kanban_cards")
      .select("id, title, due_date, column_id")
      .eq("due_date", todayStr);

    if (dueTodayCards) {
      // Get done columns
      const { data: doneCols } = await supabase
        .from("imphq_kanban_columns")
        .select("id, title");
      const doneColIds = new Set(
        (doneCols || []).filter((c: any) => /feito|done|conclu/i.test(c.title)).map((c: any) => c.id)
      );

      for (const card of dueTodayCards) {
        if (doneColIds.has(card.column_id)) continue;
        if (await alreadyNotified("card", card.id, "tarefa_vence_hoje")) continue;
        for (const uid of userIds) {
          await supabase.from("imphq_notifications").insert({
            user_id: uid,
            title: `⏰ Tarefa vence hoje: ${card.title}`,
            message: `A tarefa "${card.title}" vence hoje.`,
            type: "tarefa",
            entity_type: "card",
            entity_id: card.id,
          });
        }
        inserted.push(`tarefa_vence_hoje:${card.id}`);
      }
    }

    // 2. Tarefas atrasadas
    const { data: overdueCards } = await supabase
      .from("imphq_kanban_cards")
      .select("id, title, due_date, column_id")
      .lt("due_date", todayStr);

    if (overdueCards) {
      const { data: doneCols } = await supabase
        .from("imphq_kanban_columns")
        .select("id, title");
      const doneColIds = new Set(
        (doneCols || []).filter((c: any) => /feito|done|conclu/i.test(c.title)).map((c: any) => c.id)
      );

      for (const card of overdueCards) {
        if (doneColIds.has(card.column_id)) continue;
        if (await alreadyNotified("card", card.id, "tarefa_atrasada")) continue;
        for (const uid of userIds) {
          await supabase.from("imphq_notifications").insert({
            user_id: uid,
            title: `🚨 Tarefa atrasada: ${card.title}`,
            message: `A tarefa "${card.title}" está atrasada (vencia em ${card.due_date}).`,
            type: "tarefa",
            entity_type: "card",
            entity_id: card.id,
          });
        }
        inserted.push(`tarefa_atrasada:${card.id}`);
      }
    }

    // 3. Rotinas não completadas (verificar após 18h)
    if (now.getUTCHours() >= 21) { // 18h BRT = 21h UTC
      const { data: routines } = await supabase
        .from("imphq_daily_routines")
        .select("id, title, user_id")
        .eq("is_active", true);

      if (routines) {
        for (const routine of routines) {
          const { data: checks } = await supabase
            .from("imphq_routine_checks")
            .select("id")
            .eq("routine_id", routine.id)
            .eq("check_date", todayStr)
            .limit(1);

          if (checks && checks.length > 0) continue;
          if (await alreadyNotified("routine", routine.id, "rotina_pendente")) continue;

          await supabase.from("imphq_notifications").insert({
            user_id: routine.user_id,
            title: `📋 Rotina pendente: ${routine.title}`,
            message: `A rotina "${routine.title}" ainda não foi completada hoje.`,
            type: "tarefa",
            entity_type: "routine",
            entity_id: routine.id,
          });
          inserted.push(`rotina_pendente:${routine.id}`);
        }
      }
    }

    // 4. Novos leads (últimos 30 min)
    const { data: newLeads } = await supabase
      .from("imphq_leads")
      .select("id, nome, email, created_at")
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false });

    if (newLeads) {
      for (const lead of newLeads) {
        if (await alreadyNotified("lead", lead.id, "lead")) continue;
        for (const uid of userIds) {
          await supabase.from("imphq_notifications").insert({
            user_id: uid,
            title: `👤 Novo lead: ${lead.nome || lead.email}`,
            message: `Lead capturado: ${lead.email}`,
            type: "lead",
            entity_type: "lead",
            entity_id: lead.id,
          });
        }
        inserted.push(`lead:${lead.id}`);
      }
    }

    // 5. Vendas aprovadas (últimos 30 min via events)
    const { data: salesEvents } = await supabase
      .from("imphq_events")
      .select("id, event_data, project_id, created_at")
      .in("event_name", ["Purchase", "pix_aprovado", "venda_aprovada"])
      .gte("created_at", thirtyMinAgo);

    if (salesEvents) {
      for (const ev of salesEvents) {
        if (await alreadyNotified("event", ev.id, "venda")) continue;
        const d = (ev.event_data as any) || {};
        const valor = d.value || d.valor || "";
        for (const uid of userIds) {
          await supabase.from("imphq_notifications").insert({
            user_id: uid,
            title: `💰 Nova venda${valor ? `: R$ ${valor}` : "!"}`,
            message: d.product || d.produto || "Venda registrada",
            type: "venda",
            entity_type: "event",
            entity_id: ev.id,
          });
        }
        inserted.push(`venda:${ev.id}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notified: inserted.length, details: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[notify-scheduler] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
