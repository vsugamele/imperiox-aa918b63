import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProactiveAlert = {
  key: string;
  kind: "roas_drop" | "stale_conv" | "pix_pending" | "sales_spike";
  severity: "info" | "warning" | "critical" | "success";
  title: string;
  description: string;
  action_label?: string;
  action_href?: string;
  created_at: string;
};

const POLL_MS = 60_000;

async function detectAlerts(): Promise<ProactiveAlert[]> {
  const out: ProactiveAlert[] = [];
  const now = Date.now();

  // 1) PIX emitido sem follow-up > 15min
  try {
    const since = new Date(now - 60 * 60_000).toISOString();
    const cutoff = new Date(now - 15 * 60_000).toISOString();
    const { data: pix } = await supabase
      .from("imphq_vendas")
      .select("id, lead_id, nome, valor, created_at, status")
      .eq("status", "pendente")
      .gte("created_at", since)
      .lte("created_at", cutoff)
      .limit(5);
    (pix || []).forEach((v: any) => {
      out.push({
        key: `pix:${v.id}`,
        kind: "pix_pending",
        severity: "warning",
        title: `PIX pendente · ${v.nome || "lead"}`,
        description: `R$ ${Number(v.valor || 0).toFixed(2)} emitido há +15min sem follow-up.`,
        action_label: "Abrir lead",
        action_href: v.lead_id ? `/lead/${v.lead_id}` : "/leads",
        created_at: v.created_at,
      });
    });
  } catch {}

  // 2) Conversas paradas > 2h aguardando resposta nossa
  try {
    const cutoff = new Date(now - 2 * 3600_000).toISOString();
    const { data: convs } = await supabase
      .from("imphq_wa_conversations")
      .select("id, phone, nome, last_message_at, last_direction")
      .eq("last_direction", "in")
      .lte("last_message_at", cutoff)
      .order("last_message_at", { ascending: false })
      .limit(5);
    (convs || []).forEach((c: any) => {
      out.push({
        key: `stale:${c.id}`,
        kind: "stale_conv",
        severity: "warning",
        title: `Conversa parada · ${c.nome || c.phone}`,
        description: `Aguardando resposta há +2h.`,
        action_label: "Abrir conversa",
        action_href: `/inbox?conv=${c.id}`,
        created_at: c.last_message_at,
      });
    });
  } catch {}

  // 3) Pico de vendas última 1h (>= 3 vendas)
  try {
    const since = new Date(now - 60 * 60_000).toISOString();
    const { count } = await supabase
      .from("imphq_vendas")
      .select("id", { count: "exact", head: true })
      .eq("status", "aprovada")
      .gte("created_at", since);
    if ((count ?? 0) >= 3) {
      out.push({
        key: `spike:${new Date().toISOString().slice(0, 13)}`,
        kind: "sales_spike",
        severity: "success",
        title: `🔥 Pico de vendas`,
        description: `${count} vendas aprovadas na última hora.`,
        action_label: "Ver dashboard",
        action_href: "/dashboard",
        created_at: new Date().toISOString(),
      });
    }
  } catch {}

  return out;
}

export function useProactiveAlerts() {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        const { data } = await supabase
          .from("imphq_alert_dismissals")
          .select("alert_key, expires_at")
          .eq("user_id", uid);
        const now = Date.now();
        const set = new Set<string>(
          (data || [])
            .filter((d: any) => !d.expires_at || new Date(d.expires_at).getTime() > now)
            .map((d: any) => d.alert_key as string)
        );
        if (mounted) setDismissed(set);
      }
    })();

    const run = async () => {
      const a = await detectAlerts();
      if (mounted) {
        setAlerts(a);
        setLoading(false);
      }
    };
    run();
    const id = setInterval(run, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const dismiss = async (key: string) => {
    setDismissed(prev => new Set(prev).add(key));
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    const expires = new Date(Date.now() + 12 * 3600_000).toISOString();
    await supabase
      .from("imphq_alert_dismissals")
      .upsert({ user_id: uid, alert_key: key, expires_at: expires }, { onConflict: "user_id,alert_key" });
  };

  const visible = alerts.filter(a => !dismissed.has(a.key));

  return { alerts: visible, total: visible.length, loading, dismiss };
}
