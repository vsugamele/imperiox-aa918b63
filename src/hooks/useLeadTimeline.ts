import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  subtitle?: string;
  details?: { [key: string]: Json | undefined };
}

export interface TimelineLead {
  id: string;
  email?: string | null;
  project_id?: string | null;
  data?: Json;
}

interface LeadAutomationLog {
  id: string;
  action: string;
  created_at: string | null;
  details: { [key: string]: Json | undefined };
  _source: "activity" | "automacao_log";
  entity_type?: string | null;
  entity_id?: string | null;
  lead_id?: string | null;
}

function fields(value: Json | undefined): { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value: Json | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function pagePath(value: string | null): string | undefined {
  if (!value) return undefined;
  try { return new URL(value).pathname; } catch { return value; }
}

const META_FIELDS = new Set(["nome", "email", "phone", "telefone", "name"]);

export function useLeadTimeline(lead: TimelineLead | null, automations: readonly Pick<Tables<"imphq_automacoes">, "id" | "nome">[]) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [leadAutomationLogs, setLeadAutomationLogs] = useState<LeadAutomationLog[]>([]);
  const [scoreLog, setScoreLog] = useState<{ acao: string; pontos: number; created_at: string }[]>([]);
  const [formResponses, setFormResponses] = useState<{ form_id: string; form_name?: string; question: string; answer: string; created_at: string }[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<{ id: string; bucket: string; acao: string; canal: string; status: string; valor?: number; observacao?: string; venda_id?: string; created_at: string }[]>([]);

  const leadId = lead?.id;
  const leadEmail = lead?.email;
  const projectId = lead?.project_id;
  const visitorId = text(fields(lead?.data).visitor_id);
  const leadUtmSource = text(fields(fields(lead?.data).utms).utm_source);
  const automationsRef = useRef(automations);
  useEffect(() => { automationsRef.current = automations; }, [automations]);

  useEffect(() => {
    if (!leadId) {
      setLoading(false);
      setTimeline([]); setLeadAutomationLogs([]); setScoreLog([]); setFormResponses([]); setRecoveryLogs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setTimeline([]); setLeadAutomationLogs([]); setScoreLog([]); setFormResponses([]); setRecoveryLogs([]);
      const events: TimelineEvent[] = [];
      const promises: PromiseLike<void>[] = [];

      if (visitorId) {
        promises.push(supabase.from("imphq_events").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(100).then(({ data }) => {
          (data || []).forEach((e) => { events.push({ id: e.id, type: e.event_name || "PageView", timestamp: e.created_at, title: e.event_name || "Evento", subtitle: pagePath(e.page_url), details: { ...fields(e.event_data), utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } }); });
        }));
      }
      if (!visitorId || visitorId !== leadId) {
        promises.push(supabase.from("imphq_events").select("*").eq("visitor_id", leadId).order("created_at", { ascending: false }).limit(100).then(({ data }) => {
          (data || []).forEach((e) => { if (!events.find(ev => ev.id === e.id)) events.push({ id: e.id, type: e.event_name || "PageView", timestamp: e.created_at, title: e.event_name || "Evento", subtitle: pagePath(e.page_url), details: { ...fields(e.event_data), utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } }); });
        }));
      }
      if (leadEmail) {
        const eventCols = "id, event_name, event_data, page_url, created_at, utm_source, utm_medium, utm_campaign";
        let lcQ = supabase.from("imphq_events").select(eventCols).eq("event_name", "LeadCapture");
        if (projectId) lcQ = lcQ.eq("project_id", projectId);
        promises.push(lcQ.order("created_at", { ascending: false }).limit(50).then(({ data }) => {
          (data || []).forEach((e) => { const eventEmail = text(fields(e.event_data).email); if (eventEmail && eventEmail.toLowerCase() === leadEmail!.toLowerCase() && !events.find(ev => ev.id === e.id)) events.push({ id: e.id, type: "LeadCapture", timestamp: e.created_at, title: "📥 Lead Capturado", subtitle: pagePath(e.page_url) || text(fields(e.event_data).source) || "formulário", details: { ...fields(e.event_data), utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } }); });
        }));
        let csvQ = supabase.from("imphq_events").select(eventCols).eq("event_name", "CSVImport").eq("utm_source", leadEmail.toLowerCase());
        if (projectId) csvQ = csvQ.eq("project_id", projectId);
        promises.push(csvQ.order("created_at", { ascending: false }).limit(50).then(({ data }) => {
          (data || []).forEach((e) => { const evData = fields(e.event_data); events.push({ id: e.id, type: "CSVImport", timestamp: e.created_at, title: `Importado via ${evData.plataforma || "CSV"}`, subtitle: evData.produto ? `Produto: ${evData.produto}` : undefined, details: { status: evData.status_evento, pagamento: evData.metodo_pagamento, valor: evData.valor ? `R$ ${evData.valor}` : undefined, data_pedido: evData.data_pedido } }); });
        }));
        if (leadUtmSource) {
          promises.push(supabase.from("imphq_clicks").select("id, referer, created_at, utm_source, utm_medium, utm_campaign").eq("utm_source", leadUtmSource).order("created_at", { ascending: false }).limit(50).then(({ data }) => {
            (data || []).forEach((c) => { events.push({ id: c.id, type: "click", timestamp: c.created_at, title: "Click UTM", subtitle: pagePath(c.referer) || c.utm_campaign || undefined, details: { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign } }); });
          }));
        }
      }
      promises.push(supabase.from("imphq_vendas").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).then(({ data }) => {
        (data || []).forEach((v) => { const isRefund = v.status === "reembolsado"; events.push({ id: v.id, type: isRefund ? "Reembolso" : "Purchase", timestamp: v.created_at, title: isRefund ? `Reembolso: ${v.produto_nome || "—"}` : `Compra: ${v.produto_nome || "—"}`, subtitle: `R$ ${parseFloat(String(v.valor || 0)).toFixed(2)} via ${v.plataforma || "—"}`, details: { status: v.status } }); });
      }));
      promises.push(
        Promise.all([
          supabase.from("imphq_activity_log").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50),
          supabase.from("imphq_automacao_logs").select("*").order("created_at", { ascending: false }).limit(200),
        ]).then(([actRes, autoLogRes]) => {
          const actLogs = (actRes.data || []).map((l): LeadAutomationLog => ({ ...l, details: fields(l.details), _source: "activity" }));
          const autoLogs = (autoLogRes.data || []).filter((l) => {
            const td = fields(l.trigger_data);
            const ld = td.lead_data ? fields(td.lead_data) : td;
            return ld.lead_id === leadId || (!!leadEmail && ld.email === leadEmail);
          }).map((l): LeadAutomationLog => {
            const td = fields(l.trigger_data);
            const ld = td.lead_data ? fields(td.lead_data) : td;
            const autoNome = automationsRef.current.find(a => a.id === l.automacao_id)?.nome || l.automacao_id?.slice(0, 8);
            return {
              id: l.id,
              action: l.status === "success" ? "automacao_sucesso" : "automacao_erro",
              entity_type: "automacao",
              entity_id: l.automacao_id,
              lead_id: leadId,
              created_at: l.created_at,
              details: {
                automacao: autoNome,
                status: l.status,
                produto: ld.produto || "",
                erro: l.error_message || "",
                acoes: Array.isArray(l.acoes_executadas) ? l.acoes_executadas.map((a) => `${fields(a).tipo}:${fields(a).status || "ok"}`).join(", ") : "",
              },
              _source: "automacao_log",
            };
          });
          const merged = [...actLogs, ...autoLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (!cancelled) setLeadAutomationLogs(merged);
        })
      );
      promises.push(supabase.from("imphq_lead_responses").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).then(async ({ data }) => {
        const rows = data || [];
        const formIds = [...new Set(rows.map(r => r.form_id).filter((id): id is string => !!id))];
        const formNameMap: Record<string, string> = {};
        if (formIds.length > 0) { const { data: forms } = await supabase.from("imphq_capture_forms").select("id, nome").in("id", formIds); (forms || []).forEach((f) => { formNameMap[f.id] = f.nome; }); }
        const rawResponses = rows.filter((r) => !META_FIELDS.has((r.field_key || r.question || "").toLowerCase().trim())).map((r) => ({ form_id: r.form_id || "", form_name: formNameMap[r.form_id] || "", question: r.question || r.field_key || "—", answer: r.answer || "—", created_at: r.created_at || "" }));
        if (!cancelled) setFormResponses(rawResponses);
        const grouped: Record<string, { formName: string; entries: Array<{ q: string; a: string }>; timestamp: string; id: string }> = {};
        rows.forEach((r) => { const formName = formNameMap[r.form_id] || "Formulário"; const key = `${r.form_id}_${r.created_at?.substring(0, 16)}`; if (!grouped[key]) grouped[key] = { formName, entries: [], timestamp: r.created_at, id: r.id }; grouped[key].entries.push({ q: r.question || r.field_key || "—", a: r.answer || "—" }); });
        Object.values(grouped).forEach((g) => { const subtitle = g.entries.slice(0, 3).map(e => `${e.q}: ${e.a}`).join(" • "); const details: Record<string, string> = {}; g.entries.forEach(e => { details[e.q] = e.a; }); events.push({ id: g.id, type: "FormResponse", timestamp: g.timestamp, title: `📋 ${g.formName}`, subtitle: subtitle || "Sem respostas", details }); });
      }));
      promises.push(supabase.from("imphq_lead_scores_log").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).then(({ data }) => {
        if (!cancelled) setScoreLog((data || []).map((s) => ({ acao: s.acao, pontos: s.pontos, created_at: s.created_at })));
      }));
      promises.push(supabase.from("imphq_recovery_logs").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(100).then(({ data }) => {
        const rows = (data || []).map((r) => ({
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
      promises.push(supabase.from("imphq_lead_tag_history").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(200).then(({ data }) => {
        (data || []).forEach((t) => {
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
  }, [leadId, leadEmail, projectId, visitorId, leadUtmSource]);

  return { timeline, loading, leadAutomationLogs, scoreLog, formResponses, recoveryLogs };
}
