import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Pause, Pencil, Copy, AlertCircle, CheckCircle2, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityId: string | null;
  entityName: string | null;
  projectId?: string;
}

interface ActionRow {
  id: string;
  acao: string;
  tipo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  resultado: string;
  erro_msg: string | null;
  duracao_ms: number | null;
  created_at: string;
}

const ICONS: Record<string, any> = {
  ativou: Play,
  pausou: Pause,
  editou_orcamento: Pencil,
  duplicou: Copy,
  renomeou: Pencil,
};

export function RowHistoryDrawer({ open, onOpenChange, entityId, entityName, projectId }: Props) {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entityId) return;
    (async () => {
      setLoading(true);
      let q = supabase.from("imphq_ads_actions").select("*").eq("entidade_id", entityId).order("created_at", { ascending: false }).limit(80);
      if (projectId) q = q.eq("project_id", projectId);
      const { data } = await q;
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, [open, entityId, projectId]);

  const fmt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const brl = (s: string | null) => s ? `R$ ${Number(s).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  const renderChange = (r: ActionRow) => {
    if (r.acao === "editou_orcamento") return <span className="tabular-nums">{brl(r.valor_anterior)} → <strong className="text-primary">{brl(r.valor_novo)}</strong></span>;
    if (r.acao === "renomeou") return <span className="text-foreground/80">"{r.valor_anterior}" → <strong className="text-primary">"{r.valor_novo}"</strong></span>;
    if (r.acao === "ativou" || r.acao === "pausou") return <span className="capitalize">{r.valor_anterior?.toLowerCase() || "—"} → <strong className="text-primary">{r.valor_novo?.toLowerCase()}</strong></span>;
    return <span>{r.valor_novo}</span>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-secondary/40 border-border/40 backdrop-blur overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg font-light tracking-tight">
            <History className="h-4 w-4 text-primary" /> Histórico
          </SheetTitle>
          <SheetDescription className="text-xs leading-6 text-muted-foreground">
            Todas as ações registradas para <strong className="text-foreground/90">{entityName || "—"}</strong>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {loading && <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!loading && rows.length === 0 && (
            <div className="text-center py-12 text-xs text-muted-foreground">Nenhuma ação registrada ainda.</div>
          )}
          {!loading && rows.map((r) => {
            const Icon = ICONS[r.acao] || History;
            const ok = r.resultado === "ok";
            return (
              <div key={r.id} className="flex gap-3 p-3 rounded-lg border border-border/30 bg-background/30 text-xs">
                <div className={cn("h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0", ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="capitalize font-medium text-foreground/90">{r.acao.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{fmt(r.created_at)}</span>
                  </div>
                  <div className="leading-6">{renderChange(r)}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertCircle className="h-3 w-3 text-red-400" />}
                    <span>{ok ? "ok" : (r.erro_msg || "erro")}</span>
                    {r.duracao_ms != null && <span className="opacity-60">· {r.duracao_ms}ms</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
