import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  subtitle?: string;
  details?: Record<string, any>;
}

interface AnyLead {
  id: string;
  email?: string | null;
  project_id?: string | null;
  data?: any;
}

const META_FIELDS = new Set(["nome", "email", "phone", "telefone", "name"]);

export function useLeadTimeline(lead: AnyLead | null, automations: any[]) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [leadAutomationLogs, setLeadAutomationLogs] = useState<any[]>([]);
  const [scoreLog, setScoreLog] = useState<{ acao: string; pontos: number; created_at: string }[]>([]);
  const [formResponses, setFormResponses] = useState<{ form_id: string; form_name?: string; question: string; answer: string; created_at: string }[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<{ id: string; bucket: string; acao: string; canal: string; status: string; valor?: number; observacao?: string; venda_id?: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!lead) {
      setTimeline([]); setLeadAutomationLogs([]); setScoreLog([]); setFormResponses([]); setRecoveryLogs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setTimeline([]); setLeadAutomationLogs([]); setScoreLog([]); setFormResponses([]); setRecoveryLogs([]);
      const events: TimelineEvent[] = [];
      const visitorId = lead.data?.visitor_id;
      const promises: PromiseLike<any>[] = [];

      if (visitorId) {
        promises.push(supabase.from("imphq_events").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(100).then(({ data }) => {
          (data || []).forEach((e: any) => { events.push({ id: e.id, type: e.event_name || "PageView", timestamp: e.created_at, title: e.event_name || "Evento", subtitle: e.page_url ? new URL(e.page_url).pathname : undefined, details: { ...e.event_data, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } }); });
        }));
      }
      if (!visitorId || visitorId !== lead.id) {
        promises.push(supabase.from("imphq_events").select("*").eq("visitor_id", lead.id).order("created_at", { ascending: false }).limit(100).then(({ data }) => {
          (data || []).forEach((e: any) => { if (!events.find(ev => ev.id === e.id)) events.push({ id: e.id, type: e.event_name || "PageView", timestamp: e.created_at, title: e.event_name || "Evento", subtitle: e.page_url ? new URL(e.page_url).pathname : undefined, details: { ...e.event_data, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } }); });
        }));
      }
      if (lead.email) {
        const eventCols = "id, event_name, event_data, page_url, created_at, utm_source, utm_medium, utm_campaign";
        let lcQ = supabase.from("imphq_events").select(eventCols).eq("event_name", "LeadCapture");
        if (lead.project_id) lcQ = lcQ.eq("project_id", lead.project_id);
        promises.push(lcQ.order("created_at", { ascending: false }).limit(50).then(({ data }) => {
          (data || []).forEach((e: any) => { const eventEmail = e.event_data?.email; if (eventEmail && eventEmail.toLowerCase() === lead.email!.toLowerCase() && !events.find(ev => ev.id === e.id)) events.push({ id: e.id, type: "LeadCapture", timestamp: e.created_at, title: "📥 Lead Capturado", subtitle: e.page_url ? new URL(e.page_url).pathname : (e.event_data?.source || "formulário"), details: { ...e.event_data, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } }); });
        }));
        let csvQ = supabase.from("imphq_events").select(eventCols).eq("event_name", "CSVImport").eq("utm_source", lead.email.toLowerCase());
        if (lead.project_id) csvQ = csvQ.eq("project_id", lead.project_id);
        promises.push(csvQ.order("created_at", { ascending: false }).limit(50).then(({ data }) => {
          (data || []).forEach((e: any) => { const evData = e.event_data || {}; events.push({ id: e.id, type: "CSVImport", timestamp: e.created_at, title: `Importado via ${evData.plataforma || "CSV"}`, subtitle: evData.produto ? `Produto: ${evData.produto}` : undefined, details: { status: evData.status_evento, pagamento: evData.metodo_pagamento, valor: evData.valor ? `R$ ${evData.valor}` : undefined, data_pedido: evData.data_pedido } }); });
        }));
        const leadUtmSource = lead.data?.utms?.utm_source;
        if (leadUtmSource) {
          promises.push(supabase.from("imphq_clicks").select("id, page_url, created_at, utm_source, utm_medium, utm_campaign").eq("utm_source", leadUtmSource).order("created_at", { ascending: false }).limit(50).then(({ data }) => {
            (data || []).forEach((c: any) => { events.push({ id: c.id, type: "click", timestamp: c.created_at, title: "Click UTM", subtitle: c.page_url ? new URL(c.page_url).pathname : c.utm_campaign, details: { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign } }); });
          }));
        }
      }
      promises.push(supabase.from("imphq_vendas").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).then(({ data }) => {
        (data || []).forEach((v: any) => { const isRefund = v.status === "reembolsado"; events.push({ id: v.id, type: isRefund ? "Reembolso" : "Purchase", timestamp: v.created_at, title: isRefund ? `Reembolso: ${v.produto_nome || "—"}` : `Compra: ${v.produto_nome || "—"}`, subtitle: `R$ ${parseFloat(v.valor || 0).toFixed(2)} via ${v.plataforma || "—"}`, details: { status: v.status } }); });
      }));
      promises.push(
        Promise.all([
          supabase.from("imphq_activity_log").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(50),
          supabase.from("imphq_automacao_logs" as any).select("*").order("created_at", { ascending: false }).limit(200),
        ]).then(([actRes, autoLogRes]) => {
          const actLogs = (actRes.data || []).map((l: any) => ({ ...l, _source: "activity" }));
          const autoLogs = (autoLogRes.data || []).filter((l: any) => {
            const td = (l.trigger_data as any) || {};
            const ld = td.lead_data || td;
            return ld.lead_id === lead.id || ld.email === lead.email;
          }).map((l: any) => {
            const td = (l.trigger_data as any) || {};
            const ld = td.lead_data || td;
            const autoNome = automations.find(a => a.id === l.automacao_id)?.nome || l.automacao_id?.slice(0, 8);
            return {
              id: l.id,
              action: l.status === "success" ? "automacao_sucesso" : "automacao_erro",
              entity_type: "automacao",
              entity_id: l.automacao_id,
              lead_id: lead.id,
              created_at: l.created_at,
              details: {
                automacao: autoNome,
                status: l.status,
                produto: ld.produto || "",
                erro: l.error_message || "",
                acoes: Array.isArray(l.acoes_executadas) ? l.acoes_executadas.map((a: any) => `${a.tipo}:${a.status || "ok"}`).join(", ") : "",
              },
              _source: "automacao_log",
            };
          });
          const merged = [...actLogs, ...autoLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (!cancelled) setLeadAutomationLogs(merged);
        })
      );
      promises.push(supabase.from("imphq_lead_responses").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).then(async ({ data }) => {
        const rows = data || [];
        const formIds = [...new Set(rows.map(r => (r as any).form_id).filter(Boolean))];
        let formNameMap: Record<string, string> = {};
        if (formIds.length > 0) { const { data: forms } = await supabase.from("imphq_capture_forms").select("id, name").in("id", formIds); (forms || []).forEach((f: any) => { formNameMap[f.id] = f.name; }); }
        const rawResponses = rows.filter((r: any) => !META_FIELDS.has((r.field_key || r.question || "").toLowerCase().trim())).map((r: any) => ({ form_id: r.form_id || "", form_name: formNameMap[r.form_id] || "", question: r.question || r.field_key || "—", answer: r.answer || "—", created_at: r.created_at || "" }));
        if (!cancelled) setFormResponses(rawResponses);
        const grouped: Record<string, { formName: string; entries: Array<{ q: string; a: string }>; timestamp: string; id: string }> = {};
        rows.forEach((r: any) => { const formName = formNameMap[r.form_id] || "Formulário"; const key = `${r.form_id}_${r.created_at?.substring(0, 16)}`; if (!grouped[key]) grouped[key] = { formName, entries: [], timestamp: r.created_at, id: r.id }; grouped[key].entries.push({ q: r.question || r.field_key || "—", a: r.answer || "—" }); });
        Object.values(grouped).forEach((g) => { const subtitle = g.entries.slice(0, 3).map(e => `${e.q}: ${e.a}`).join(" • "); const details: Record<string, string> = {}; g.entries.forEach(e => { details[e.q] = e.a; }); events.push({ id: g.id, type: "FormResponse", timestamp: g.timestamp, title: `📋 ${g.formName}`, subtitle: subtitle || "Sem respostas", details }); });
      }));
      promises.push(supabase.from("imphq_lead_scores_log").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).then(({ data }) => {
        if (!cancelled) setScoreLog((data || []).map((s: any) => ({ acao: s.acao, pontos: s.pontos, created_at: s.created_at })));
      }));
      promises.push(supabase.from("imphq_recovery_logs").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(100).then(({ data }) => {
        const rows = (data || []).map((r: any) => ({
          id: r.id, bucket: r.bucket || "", acao: r.acao || "", canal: r.canal || "",
          status: r.status || "", valor: r.valor, observacao: r.observacao, venda_id: r.venda_id, created_at: r.created_at,
        }));
        if (!cancelled) setRecoveryLogs(rows);
        rows.forEach((r) => {
          events.push({
            id: `rec_${r.id}`,
            type: "Recovery",
            timestamp: r.created_at,
            title: `🔄 Recuperação: ${r.bucket || "—"}`,
            subtitle: [r.canal, r.acao, r.status].filter(Boolean).join(" • "),
            details: { canal: r.canal, status: r.status, valor: r.valor, obs: r.observacao, venda_id: r.venda_id },
          });
        });
      }));
      promises.push(supabase.from("imphq_lead_tag_history" as any).select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(200).then(({ data }) => {
        (data || []).forEach((t: any) => {
          const added = t.action === "added";
          events.push({
            id: `tag_${t.id}`,
            type: added ? "TagAdded" : "TagRemoved",
            timestamp: t.created_at,
            title: `🏷️ Tag ${added ? "adicionada" : "removida"}: ${t.tag}`,
            subtitle: t.source ? `Origem: ${t.source}` : undefined,
            details: { tag: t.tag, action: t.action, source: t.source, project_id: t.project_id },
          });
        });
      }));
      await Promise.all(promises);
      if (cancelled) return;
      const unique = new Map(events.map(e => [e.id, e]));
      const deduped = Array.from(unique.values());
      deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimeline(deduped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [lead?.id]);

  return { timeline, loading, leadAutomationLogs, scoreLog, formResponses, recoveryLogs };
}
