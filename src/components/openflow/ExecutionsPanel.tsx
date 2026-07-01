import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, XCircle, Loader2, Clock, RotateCcw, User, Phone, Search, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { StepHeatmap } from "./StepHeatmap";

interface ExecutionsPanelProps {
  automacoes: { id: string; nome: string }[];
  projects: { id: string; name: string }[];
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  running: { label: "Executando", className: "bg-blue-500/20 text-blue-400", icon: Loader2 },
  completed: { label: "Concluído", className: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 },
  partial: { label: "Parcial", className: "bg-amber-500/20 text-amber-400", icon: CheckCircle2 },
  failed: { label: "Falhou", className: "bg-red-500/20 text-red-400", icon: XCircle },
  waiting: { label: "Aguardando", className: "bg-amber-500/20 text-amber-400", icon: Clock },
};

const PAGE_SIZE = 25;

export function ExecutionsPanel({ automacoes, projects }: ExecutionsPanelProps) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Record<string, { nome: string; phone: string }>>({});
  const [retrying, setRetrying] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [automacaoFilter, setAutomacaoFilter] = useState<string>("__all__");
  const [projectFilter, setProjectFilter] = useState<string>("__all__");
  const [period, setPeriod] = useState<string>("7d");
  const [search, setSearch] = useState("");
  const [realtime, setRealtime] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [page, setPage] = useState(0);
  const debounceRef = useRef<any>(null);

  const periodDate = useMemo(() => {
    const d = new Date();
    if (period === "24h") d.setHours(d.getHours() - 24);
    else if (period === "7d") d.setDate(d.getDate() - 7);
    else if (period === "30d") d.setDate(d.getDate() - 30);
    else return null;
    return d.toISOString();
  }, [period]);

  const loadExecs = async () => {
    setLoading(true);
    let q = supabase
      .from("imphq_flow_executions")
      .select("id, automacao_id, project_id, lead_id, trigger_tipo, current_step, status, step_results, next_run_at, error_message, created_at, updated_at, waiting_for")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusFilter !== "__all__") q = q.eq("status", statusFilter);
    if (automacaoFilter !== "__all__") q = q.eq("automacao_id", automacaoFilter);
    if (projectFilter !== "__all__") q = q.eq("project_id", projectFilter);
    if (periodDate) q = q.gte("created_at", periodDate);

    const { data } = await q;
    const execs = data || [];
    setExecutions(execs);

    const leadIds = [...new Set(execs.map((e: any) => e.lead_id).filter(Boolean))];
    if (leadIds.length > 0) {
      const { data: leadRows } = await supabase.from("imphq_leads").select("id, nome, phone").in("id", leadIds);
      const map: Record<string, { nome: string; phone: string }> = {};
      (leadRows || []).forEach((l: any) => { map[l.id] = { nome: l.nome || "", phone: l.phone || "" }; });
      setLeads((prev) => ({ ...prev, ...map }));
    }
    setLoading(false);
  };

  useEffect(() => { loadExecs(); /* eslint-disable-next-line */ }, [statusFilter, automacaoFilter, projectFilter, period, page]);

  // Realtime
  useEffect(() => {
    if (!realtime) return;
    const channel = supabase
      .channel("flow_executions_panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "imphq_flow_executions" }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(loadExecs, 800);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line
  }, [realtime, statusFilter, automacaoFilter, projectFilter, period, page]);

  const filtered = useMemo(() => {
    if (!search.trim()) return executions;
    const s = search.toLowerCase();
    return executions.filter((e) => {
      const lead = e.lead_id ? leads[e.lead_id] : null;
      return (
        (lead?.nome || "").toLowerCase().includes(s) ||
        (lead?.phone || "").includes(s) ||
        (e.error_message || "").toLowerCase().includes(s) ||
        (e.trigger_tipo || "").toLowerCase().includes(s)
      );
    });
  }, [executions, search, leads]);

  const autoName = (id: string) => automacoes.find(a => a.id === id)?.nome || id?.slice(0, 8);
  const projName = (id: string) => projects.find(p => p.id === id)?.name || "";
  const waitingCount = executions.filter(e => e.status === "waiting").length;
  const failedCount = executions.filter(e => e.status === "failed").length;

  const retryExecution = async (exec: any, fromStep?: number) => {
    setRetrying(exec.id);
    try {
      const { data: logData } = await supabase.from("imphq_automacao_logs" as any)
        .select("trigger_data")
        .eq("automacao_id", exec.automacao_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const triggerData = (logData?.[0] as any)?.trigger_data || {};
      const { data, error } = await supabase.functions.invoke("openflow-executor", {
        body: {
          trigger_tipo: exec.trigger_tipo,
          project_id: exec.project_id,
          automacao_id: exec.automacao_id,
          lead_data: triggerData,
          start_from_step: fromStep,
        },
      });
      if (error) throw error;
      toast[data?.ok ? "success" : "error"](
        data?.ok ? (fromStep != null ? `Reexecutado a partir do step #${fromStep}` : "Reenvio executado!") : (data?.error || "Erro")
      );
      loadExecs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setRetrying(null);
    }
  };

  const copyPayload = (step: any) => {
    navigator.clipboard.writeText(JSON.stringify(step, null, 2));
    toast.success("Payload copiado");
  };

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar lead, telefone, erro…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos status</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={automacaoFilter} onValueChange={(v) => { setAutomacaoFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas automações</SelectItem>
            {automacoes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Últimas 24h</SelectItem>
            <SelectItem value="7d">Últimos 7d</SelectItem>
            <SelectItem value="30d">Últimos 30d</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 ml-auto">
          <Switch checked={realtime} onCheckedChange={setRealtime} id="rt-flow" />
          <label htmlFor="rt-flow" className="text-[10px] text-muted-foreground cursor-pointer">Realtime</label>
        </div>
        <Button size="sm" variant={showHeatmap ? "default" : "outline"} className="h-8 text-xs" onClick={() => setShowHeatmap(v => !v)}>
          <BarChart3 className="h-3 w-3 mr-1" /> Heatmap
        </Button>
      </div>

      {/* Counters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">{filtered.length} de {executions.length} carregadas</Badge>
        {waitingCount > 0 && (
          <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" /> {waitingCount} aguardando
          </Badge>
        )}
        {failedCount > 0 && (
          <Badge className="text-[9px] bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" /> {failedCount} falhas
          </Badge>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Heatmap */}
      {showHeatmap && (
        <StepHeatmap
          automacaoId={automacaoFilter !== "__all__" ? automacaoFilter : undefined}
          projectId={projectFilter !== "__all__" ? projectFilter : undefined}
        />
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma execução encontrada</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filtered.map(exec => {
            const sc = statusConfig[exec.status] || statusConfig.completed;
            const StatusIcon = sc.icon;
            const isExpanded = expandedId === exec.id;
            const lead = exec.lead_id ? leads[exec.lead_id] : null;

            return (
              <Card key={exec.id} className="bg-card border-border cursor-pointer hover:border-primary/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : exec.id)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[9px] ${sc.className}`}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${exec.status === "running" ? "animate-spin" : ""}`} />
                        {sc.label}
                      </Badge>
                      <span className="text-xs font-medium">{autoName(exec.automacao_id)}</span>
                      {exec.project_id && <Badge variant="outline" className="text-[9px]">{projName(exec.project_id)}</Badge>}
                      {lead && (
                        <Badge variant="secondary" className="text-[9px] gap-1">
                          <User className="h-2.5 w-2.5" /> {lead.nome || "—"}
                          {lead.phone && <><Phone className="h-2.5 w-2.5 ml-1" /> {lead.phone}</> }
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(exec.status === "failed" || exec.status === "completed") && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          title="Reenviar execução"
                          onClick={(e) => { e.stopPropagation(); retryExecution(exec); }}
                          disabled={retrying === exec.id}
                        >
                          {retrying === exec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 text-muted-foreground" />}
                        </Button>
                      )}
                      <span className="text-[10px] text-muted-foreground">{new Date(exec.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>

                  {exec.status === "waiting" && exec.next_run_at && (
                    <p className="text-[10px] text-amber-400">⏰ Próxima: {new Date(exec.next_run_at).toLocaleString("pt-BR")}</p>
                  )}

                  {exec.error_message && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 px-2 py-1 rounded">{exec.error_message}</p>
                  )}

                  {isExpanded && exec.step_results && Array.isArray(exec.step_results) && (
                    <div className="border-t border-border/30 pt-2 space-y-1">
                      {exec.step_results.map((step: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-secondary/50 text-[10px] space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[8px]">#{step.step ?? i}</Badge>
                            <span className="font-medium">{step.tipo || "step"}</span>
                            <Badge className={`text-[8px] ${step.status === "sent" || step.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : step.status === "error" ? "bg-red-500/20 text-red-400" : step.status === "skipped" ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
                              {step.status}
                            </Badge>
                            {step.finished_at && <span className="text-muted-foreground">{new Date(step.finished_at).toLocaleTimeString("pt-BR")}</span>}
                            <div className="ml-auto flex items-center gap-1">
                              <Button
                                variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]"
                                onClick={(e) => { e.stopPropagation(); copyPayload(step); }}
                              >Copiar</Button>
                              <Button
                                variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-primary"
                                onClick={(e) => { e.stopPropagation(); retryExecution(exec, step.step ?? i); }}
                                disabled={retrying === exec.id}
                              >Reexecutar daqui</Button>
                            </div>
                          </div>
                          {step.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-2.5 w-2.5" /> {step.phone}
                            </div>
                          )}
                          {step.provider_id && (
                            <div className="text-muted-foreground">📱 Provider: {step.provider_id.slice(0, 12)}…</div>
                          )}
                          {step.message_preview && (
                            <div className="text-muted-foreground italic truncate">"{step.message_preview}"</div>
                          )}
                          {step.reason && <div className="text-amber-400">⚠ {step.reason}</div>}
                          {step.response && !step.response.success && step.response.error && (
                            <div className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">❌ {step.response.error}</div>
                          )}
                          {step.response?.success && step.response?.message_id && (
                            <div className="text-emerald-400">✓ ID: {step.response.message_id}</div>
                          )}
                          {step.resend_id && (
                            <div className="text-emerald-400">✉ Resend: {step.resend_id}</div>
                          )}
                          {step.condition_met !== undefined && (
                            <div className="text-muted-foreground">Condição: {step.condition_met ? "✅ verdadeira" : "❌ falsa"}{step.skipped_steps ? ` (pulou ${step.skipped_steps} etapas)` : ""}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>← Anterior</Button>
        <span className="text-[10px] text-muted-foreground">Página {page + 1}</span>
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={executions.length < PAGE_SIZE || loading} onClick={() => setPage(p => p + 1)}>Próxima →</Button>
      </div>
    </div>
  );
}
