// Shared helper to fan out push notifications respecting user preferences.
// Each preference key in `imphq_notification_preferences` controls one event type.

export type NotificationKey =
  | "novo_lead"
  | "grupo_capacidade"
  | "disparo_concluido"
  | "erro_conexao"
  | "resposta_ia"
  | "venda_aprovada"
  | "venda_recusada"
  | "reembolso_solicitado"
  | "meta_diaria_atingida"
  | "hot_lead"
  | "checkout_abandonado"
  | "lead_inativo_voltou"
  | "expert_marcou_done"
  | "expert_subiu_video"
  | "expert_mensagem";

interface NotifyOpts {
  supabase: any;
  prefKey: NotificationKey;
  title: string;
  message: string;
  // If user_ids omitted -> broadcast to ALL users that have the pref enabled.
  user_ids?: string[];
}

export async function pushNotifyByPref({ supabase, prefKey, title, message, user_ids }: NotifyOpts): Promise<void> {
  try {
    let q = supabase
      .from("imphq_notification_preferences")
      .select("user_id")
      .eq(prefKey, true);
    if (user_ids && user_ids.length > 0) q = q.in("user_id", user_ids);
    const { data: prefRows, error } = await q;
    if (error) {
      console.error(`[push-notify:${prefKey}] pref query error:`, error);
      return;
    }
    let recipients = (prefRows || []).map((r: any) => r.user_id).filter(Boolean);

    // If a user has no preference row yet AND user_ids was provided, also notify
    // them (defaults are mostly ON), so first-time users still receive alerts.
    if (user_ids && user_ids.length > 0) {
      const present = new Set(recipients);
      const missing = user_ids.filter((u) => !present.has(u));
      recipients = [...recipients, ...missing];
    }

    if (recipients.length === 0) return;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    await Promise.all(
      recipients.map((uid: string) =>
        fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ user_id: uid, title, message }),
        }).catch((e) => console.error(`[push-notify:${prefKey}] send error:`, e))
      )
    );
  } catch (e) {
    console.error(`[push-notify:${prefKey}] unexpected:`, e);
  }
}

// Resolve which user IDs should receive notifications for a given project.
// Strategy: project owner + team members with role admin/manager.
export async function resolveProjectRecipients(supabase: any, projectId: string | null | undefined): Promise<string[]> {
  if (!projectId) return [];
  try {
    const ids = new Set<string>();
    const { data: project } = await supabase
      .from("imphq_projects")
      .select("user_id, owner_id, created_by")
      .eq("id", projectId)
      .maybeSingle();
    if (project) {
      for (const k of ["user_id", "owner_id", "created_by"] as const) {
        if (project[k]) ids.add(project[k]);
      }
    }
    // Team members linked to project (best-effort, table may or may not exist with these columns)
    try {
      const { data: members } = await supabase
        .from("imphq_team_members")
        .select("user_id, role")
        .eq("project_id", projectId);
      (members || []).forEach((m: any) => {
        if (m.user_id) ids.add(m.user_id);
      });
    } catch {/* ignore */ }
    return Array.from(ids);
  } catch (e) {
    console.error("[resolveProjectRecipients] error:", e);
    return [];
  }
}
