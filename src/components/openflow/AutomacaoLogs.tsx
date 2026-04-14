import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Loader2, User, Phone, Package } from "lucide-react";
import { toast } from "sonner";

interface AutomacaoLogsProps {
  automacoes: { id: string; nome: string }[];
  projects: { id: string; name: string }[];
}

export function AutomacaoLogs({ automacoes, projects }: AutomacaoLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterAuto, setFilterAuto] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadLogs = async () => {
    const { data } = await supabase.from("imphq_automacao_logs" as any).select("*").order("created_at", { ascending: false }).limit(100);
    setLogs(data || []);
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = logs.filter(l => {
    if (filterAuto !== "all" && l.automacao_id !== filterAuto) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    return true;
  });

  const autoName = (id: string) => automacoes.find(a => a.id === id)?.nome || id.slice(0, 8);
  const projName = (id: string) => projects.find(p => p.id === id)?.name || id;

  const retryLog = async (log: any) => {
    setRetrying(log.id);
    try {
      const triggerData = (log.trigger_data as any) || {};
      const { data, error } = await supabase.functions.invoke("openflow-executor", {
        body: {
          trigger_tipo: triggerData.trigger_tipo || "manual",
          project_id: log.project_id || triggerData.project_id || "retry",
          automacao_id: log.automacao_id,
          lead_data: triggerData.lead_data || triggerData,
        },
      });
      if (error) throw error;
      toast[data?.ok ? "success" : "error"](data?.ok ? "Reenvio executado!" : (data?.error || "Erro"));
      loadLogs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setRetrying(null);
    }
  };

  const getLeadInfo = (log: any) => {
    const td = (log.trigger_data as any) || {};
    const ld = td.lead_data || td;
    return {
      nome: ld.nome || ld.name || "",
      telefone: ld.telefone || ld.phone || "",
      produto: ld.produto || ld.product || "",
      email: ld.email || "",
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filterAuto} onValueChange={setFilterAuto}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Automação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas automações</SelectItem>
            {automacoes.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} logs</Badge>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nenhum log encontrado</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filtered.map(log => {
            const lead = getLeadInfo(log);
            return (
              <Card key={log.id} className="bg-card border-border">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[9px] ${log.status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {log.status === "success" ? "Sucesso" : "Erro"}
                      </Badge>
                      <span className="text-xs font-medium">{autoName(log.automacao_id)}</span>
                      {log.project_id && <Badge variant="outline" className="text-[9px]">{projName(log.project_id)}</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        title="Reenviar automação"
                        onClick={() => retryLog(log)}
                        disabled={retrying === log.id}
                      >
                        {retrying === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                      <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  
                  {/* Lead info from trigger_data */}
                  {(lead.nome || lead.telefone || lead.produto) && (
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      {lead.nome && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-2.5 w-2.5" /> {lead.nome}
                        </span>
                      )}
                      {lead.telefone && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-2.5 w-2.5" /> {lead.telefone}
                        </span>
                      )}
                      {lead.produto && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Package className="h-2.5 w-2.5" /> {lead.produto}
                        </span>
                      )}
                    </div>
                  )}

                  {log.error_message && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 px-2 py-1 rounded">{log.error_message}</p>
                  )}
                  {log.acoes_executadas && Array.isArray(log.acoes_executadas) && log.acoes_executadas.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {log.acoes_executadas.map((a: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">
                          {a.tipo || `Step ${i + 1}`}
                          {a.status && <span className={`ml-1 ${a.status === "sent" || a.status === "completed" ? "text-emerald-400" : a.status === "error" ? "text-red-400" : ""}`}>• {a.status}</span>}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
