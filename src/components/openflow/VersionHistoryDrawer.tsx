import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { History, RotateCcw, Loader2, FileClock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionRow {
  id: string;
  automacao_id: string;
  versao_num: number;
  snapshot: any;
  criado_em: string;
  criado_por: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  automacaoId: string | null;
  automacaoNome?: string;
  onRestore?: (snapshot: any) => void;
}

export function VersionHistoryDrawer({ open, onOpenChange, automacaoId, automacaoNome, onRestore }: Props) {
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !automacaoId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("imphq_automacao_versions" as any)
        .select("*")
        .eq("automacao_id", automacaoId)
        .order("versao_num", { ascending: false })
        .limit(50);
      if (error) toast.error("Erro ao carregar histórico: " + error.message);
      setRows(((data as any) || []) as VersionRow[]);
      setLoading(false);
    })();
  }, [open, automacaoId]);

  const fmt = (s: string) => new Date(s).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
  });

  const countSteps = (snap: any): number => {
    if (!snap) return 0;
    if (Array.isArray(snap?.acoes)) return snap.acoes.length;
    if (Array.isArray(snap)) return snap.length;
    return 0;
  };

  const handleRestore = async (v: VersionRow) => {
    if (!automacaoId) return;
    if (!confirm(`Restaurar versão ${v.versao_num}? A versão atual será arquivada automaticamente.`)) return;
    setRestoring(v.id);
    try {
      const snap = v.snapshot || {};
      // Atualiza a automação com o snapshot; o trigger arquiva a versão atual
      const patch: any = {};
      if (snap.nome) patch.nome = snap.nome;
      if (snap.trigger_tipo) patch.trigger_tipo = snap.trigger_tipo;
      if (Array.isArray(snap.acoes)) patch.acoes = snap.acoes;
      if (snap.produto !== undefined) patch.produto = snap.produto;
      if (snap.flow_objective !== undefined) patch.flow_objective = snap.flow_objective;

      const { error } = await supabase
        .from("imphq_automacoes")
        .update(patch)
        .eq("id", automacaoId);
      if (error) throw error;
      toast.success(`Versão ${v.versao_num} restaurada`);
      onRestore?.(snap);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Falha ao restaurar: " + (e?.message || ""));
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-secondary/40 border-border/40 backdrop-blur overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg font-light tracking-tight">
            <History className="h-4 w-4 text-primary" /> Histórico de Versões
          </SheetTitle>
          <SheetDescription className="text-xs leading-7 text-muted-foreground">
            Cada vez que você salva, uma versão é arquivada automaticamente. Mantemos as 10 mais recentes de
            <strong className="text-foreground/90"> {automacaoNome || "este fluxo"}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-center py-12 text-xs text-muted-foreground leading-7">
              Nenhuma versão arquivada ainda.<br/>
              <span className="opacity-60">Edite e salve o fluxo para começar a registrar o histórico.</span>
            </div>
          )}
          {!loading && rows.map((v, idx) => {
            const isLatest = idx === 0;
            return (
              <div
                key={v.id}
                className={cn(
                  "p-3 rounded-lg border bg-background/30 text-xs space-y-2",
                  isLatest ? "border-primary/40" : "border-border/30"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileClock className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-foreground/90">Versão {v.versao_num}</span>
                    {isLatest && <Badge className="h-4 px-1.5 text-[9px] bg-primary/15 text-primary border-primary/30">mais recente</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{fmt(v.criado_em)}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground leading-6">
                  <span>{countSteps(v.snapshot)} etapas</span>
                  {v.snapshot?.nome && (
                    <span className="truncate opacity-70">"{v.snapshot.nome}"</span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] border-border/60"
                    onClick={() => {
                      // Preview = aplica em memória sem salvar
                      onRestore?.(v.snapshot);
                      onOpenChange(false);
                      toast.info("Visualizando versão " + v.versao_num + " (não salvo)");
                    }}
                  >
                    <Eye className="h-3 w-3 mr-1" /> Visualizar
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[10px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    onClick={() => handleRestore(v)}
                    disabled={restoring === v.id}
                  >
                    {restoring === v.id
                      ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      : <RotateCcw className="h-3 w-3 mr-1" />}
                    Restaurar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
