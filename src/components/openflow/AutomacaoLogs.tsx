import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AutomacaoLogsProps {
  automacoes: { id: string; nome: string }[];
  projects: { id: string; name: string }[];
}

export function AutomacaoLogs({ automacoes, projects }: AutomacaoLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterAuto, setFilterAuto] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    supabase.from("imphq_automacao_logs" as any).select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setLogs(data || []));
  }, []);

  const filtered = logs.filter(l => {
    if (filterAuto !== "all" && l.automacao_id !== filterAuto) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    return true;
  });

  const autoName = (id: string) => automacoes.find(a => a.id === id)?.nome || id.slice(0, 8);
  const projName = (id: string) => projects.find(p => p.id === id)?.name || id;

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
          {filtered.map(log => (
            <Card key={log.id} className="bg-card border-border">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] ${log.status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {log.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                    <span className="text-xs font-medium">{autoName(log.automacao_id)}</span>
                    {log.project_id && <Badge variant="outline" className="text-[9px]">{projName(log.project_id)}</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {log.error_message && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 px-2 py-1 rounded">{log.error_message}</p>
                )}
                {log.acoes_executadas && Array.isArray(log.acoes_executadas) && log.acoes_executadas.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {log.acoes_executadas.map((a: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">{a.tipo || `Step ${i + 1}`}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
