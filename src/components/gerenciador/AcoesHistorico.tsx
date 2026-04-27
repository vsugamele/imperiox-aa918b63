import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Play, Pause, Check, X } from "lucide-react";

interface Action {
  id: string;
  created_at: string;
  plataforma: string;
  tipo: string;
  entidade_id: string;
  entidade_nome: string | null;
  acao: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  resultado: string;
  erro_msg: string | null;
  duracao_ms: number | null;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function AcoesHistorico({ projectId }: { projectId?: string }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let q = supabase.from("imphq_ads_actions").select("*").order("created_at", { ascending: false }).limit(50);
      if (projectId) q = q.eq("project_id", projectId);
      const { data } = await q;
      if (active) {
        setActions((data as Action[]) || []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [projectId]);

  return (
    <Card className="bg-secondary/40 border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-light tracking-wide">
          <Activity className="h-4 w-4 text-primary" />
          Histórico de Ações
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider">Quando</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Ação</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Plat.</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Entidade</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Mudança</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Resultado</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-right">Duração</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-xs">Carregando...</TableCell></TableRow>
            )}
            {!loading && actions.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-xs">Nenhuma ação registrada ainda.</TableCell></TableRow>
            )}
            {actions.map((a) => (
              <TableRow key={a.id} className="border-border/20 text-xs">
                <TableCell className="tabular-nums text-muted-foreground">{fmtTime(a.created_at)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {a.acao === "ativou" ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-amber-400" />}
                    {a.acao.charAt(0).toUpperCase() + a.acao.slice(1)}
                  </span>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] uppercase font-medium">{a.plataforma === "Facebook" ? "META" : a.plataforma}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{a.tipo}</TableCell>
                <TableCell className="max-w-[260px] truncate" title={a.entidade_nome || a.entidade_id}>{a.entidade_nome || a.entidade_id}</TableCell>
                <TableCell className="text-muted-foreground">→ {a.valor_novo}</TableCell>
                <TableCell>
                  {a.resultado === "ok" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="h-3 w-3" />ok</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-300" title={a.erro_msg || ""}><X className="h-3 w-3" />erro</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{a.duracao_ms ? `${a.duracao_ms}ms` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
