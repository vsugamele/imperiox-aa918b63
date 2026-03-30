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
      const { data: projects } = await supabase
        .from("imphq_projects")
        .select("owner_id")
        .limit(100);
      if (projects) projects.forEach((p: any) => { if (p.owner_id) ids.add(p.owner_id); });
      return Array.from(ids);
    }

    // Helper: get member phone for WhatsApp notifications
    async function getMemberPhone(memberId: string): Promise<string | null> {
      const { data } = await supabase
        .from("imphq_team_members")
        .select("phone, user_id")
        .eq("id", memberId)
        .maybeSingle();
      return data?.phone || null;
    }

    // Helper: get user_id from member_id
    async function getMemberUserId(memberId: string): Promise<string | null> {
      const { data } = await supabase
        .from("imphq_team_members")
        .select("user_id")
        .eq("id", memberId)
        .maybeSingle();
      return data?.user_id || null;
    }

    // Helper: send WhatsApp message via whatsapp-api
    async function sendWhatsApp(phone: string, message: string) {
      try {
        // Get first active provider config
        const { data: config } = await supabase
          .from("imphq_whatsapp_config")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (!config) return;

        const baseUrl = config.provider === "evolution"
          ? `${config.api_url}/message/sendText/${config.instance_name}`
          : config.api_url;

        if (config.provider === "evolution") {
          await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: config.api_key },
            body: JSON.stringify({ number: phone, text: message }),
          });
        }
      } catch (e) {
        console.error("[notify-scheduler] WhatsApp send error:", e);
      }
    }

    // Helper: create notification + optionally send WhatsApp
    async function notify(userId: string, title: string, message: string, type: string, entityType: string, entityId: string, memberId?: string | null) {
      await supabase.from("imphq_notifications").insert({
        user_id: userId,
        title,
        message,
        type,
        entity_type: entityType,
        entity_id: entityId,
      });

      // Try WhatsApp if member has phone
      if (memberId) {
        const phone = await getMemberPhone(memberId);
        if (phone) {
          await sendWhatsApp(phone, `${title}\n${message}`);
        }
      }
    }

    const userIds = await getAllUserIds();
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: "No users found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Tarefas vencendo hoje
    const { data: dueTodayCards } = await supabase
      .from("imphq_kanban_cards")
      .select("id, title, due_date, column_id, member_id")
      .eq("due_date", todayStr);

    if (dueTodayCards) {
      const { data: doneCols } = await supabase.from("imphq_kanban_columns").select("id, title");
      const doneColIds = new Set(
        (doneCols || []).filter((c: any) => /feito|done|conclu/i.test(c.title)).map((c: any) => c.id)
      );

      for (const card of dueTodayCards) {
        if (doneColIds.has(card.column_id)) continue;
        if (await alreadyNotified("card", card.id, "tarefa_vence_hoje")) continue;

        if (card.member_id) {
          const uid = await getMemberUserId(card.member_id);
          if (uid) {
            await notify(uid, `⏰ Tarefa vence hoje: ${card.title}`, `A tarefa "${card.title}" vence hoje.`, "tarefa", "card", card.id, card.member_id);
          }
        } else {
          for (const uid of userIds) {
            await notify(uid, `⏰ Tarefa vence hoje: ${card.title}`, `A tarefa "${card.title}" vence hoje.`, "tarefa", "card", card.id);
          }
        }
        inserted.push(`tarefa_vence_hoje:${card.id}`);
      }
    }

    // 2. Tarefas atrasadas
    const { data: overdueCards } = await supabase
      .from("imphq_kanban_cards")
      .select("id, title, due_date, column_id, member_id")
      .lt("due_date", todayStr);

    if (overdueCards) {
      const { data: doneCols } = await supabase.from("imphq_kanban_columns").select("id, title");
      const doneColIds = new Set(
        (doneCols || []).filter((c: any) => /feito|done|conclu/i.test(c.title)).map((c: any) => c.id)
      );

      for (const card of overdueCards) {
        if (doneColIds.has(card.column_id)) continue;
        if (await alreadyNotified("card", card.id, "tarefa_atrasada")) continue;

        if (card.member_id) {
          const uid = await getMemberUserId(card.member_id);
          if (uid) {
            await notify(uid, `🚨 Tarefa atrasada: ${card.title}`, `A tarefa "${card.title}" está atrasada (vencia em ${card.due_date}).`, "tarefa", "card", card.id, card.member_id);
          }
        } else {
          for (const uid of userIds) {
            await notify(uid, `🚨 Tarefa atrasada: ${card.title}`, `A tarefa "${card.title}" está atrasada (vencia em ${card.due_date}).`, "tarefa", "card", card.id);
          }
        }
        inserted.push(`tarefa_atrasada:${card.id}`);
      }
    }

    // 3. Rotinas não completadas (após 18h BRT = 21h UTC)
    if (now.getUTCHours() >= 21) {
      const { data: routines } = await supabase
        .from("imphq_daily_routines")
        .select("id, title, user_id, member_id")
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

          const targetUid = routine.member_id
            ? await getMemberUserId(routine.member_id)
            : routine.user_id;

          if (targetUid) {
            await notify(targetUid, `📋 Rotina pendente: ${routine.title}`, `A rotina "${routine.title}" ainda não foi completada hoje.`, "tarefa", "routine", routine.id, routine.member_id);
          }
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
          await notify(uid, `👤 Novo lead: ${lead.nome || lead.email}`, `Lead capturado: ${lead.email}`, "lead", "lead", lead.id);
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
          await notify(uid, `💰 Nova venda${valor ? `: R$ ${valor}` : "!"}`, d.product || d.produto || "Venda registrada", "venda", "event", ev.id);
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
