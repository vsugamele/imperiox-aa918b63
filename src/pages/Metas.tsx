import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, TrendingUp, Pencil, Check, X, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PAID_SALE_STATUSES, saleValue, useRevenueMode } from "@/lib/revenueMode";
import { RevenueModeToggle } from "@/components/shared/RevenueModeToggle";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { cn } from "@/lib/utils";

interface GoalRow {
  id: string;
  goalId?: string;
  nome: string;
  meta: number;
}

interface VendaGoalRow {
  project_id: string | null;
  valor: number | null;
  valor_liquido?: number | null;
}

export default function Metas() {
  const { projectId: globalProjectId } = useGlobalProject();
  const [revenueMode] = useRevenueMode();
  const [projects, setProjects] = useState<GoalRow[]>([]);
  const [vendasRaw, setVendasRaw] = useState<VendaGoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftMeta, setDraftMeta] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const load = useCallback(async () => {
    setLoading(true);
    const sb = supabase;
    const monthStart = `${ano}-${String(mes).padStart(2, "0")}-01T03:00:00.000Z`;

    const [{ data: projs }, { data: goals }, { data: vendas }] = await Promise.all([
      sb.from("imphq_projects").select("id, name").or("is_archived.eq.false,is_archived.is.null").order("name"),
      sb.from("imphq_project_goals").select("id, project_id, meta_receita").eq("ano", ano).eq("mes", mes),
      sb
        .from("imphq_vendas")
        .select("project_id, valor, valor_liquido")
        .in("status", [...PAID_SALE_STATUSES])
        .gte("data_venda", monthStart),
    ]);

    const goalMap = new Map((goals || []).map((g) => [g.project_id, g]));
    setProjects(
      (projs || []).map((p) => {
        const g = goalMap.get(p.id);
        return {
          id: p.id,
          goalId: g?.id,
          nome: p.name,
          meta: Number(g?.meta_receita) || 0,
        };
      }),
    );
    setVendasRaw((vendas || []) as VendaGoalRow[]);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const vendasMap = new Map<string, number>();
    vendasRaw.forEach((v) => {
      if (!v.project_id) return;
      vendasMap.set(v.project_id, (vendasMap.get(v.project_id) || 0) + saleValue(v, revenueMode));
    });

    const day = Math.max(1, new Date().getDate());
    const lastDay = new Date(ano, mes, 0).getDate();

    return projects
      .map((p) => {
        const receita = vendasMap.get(p.id) || 0;
        const meta = p.meta;
        const pct = meta > 0 ? Math.min(100, (receita / meta) * 100) : 0;
        const proj = (receita / day) * lastDay;
        let cor = "text-emerald-400";
        if (meta > 0) {
          if (proj < meta * 0.8) cor = "text-red-400";
          else if (proj < meta) cor = "text-amber-400";
        }
        return { ...p, receita, pct, projecao: proj, cor };
      })
      .sort((a, b) => {
        if (globalProjectId) {
          if (a.id === globalProjectId) return -1;
          if (b.id === globalProjectId) return 1;
        }
        return b.pct - a.pct || b.receita - a.receita;
      });
  }, [projects, vendasRaw, revenueMode, ano, mes, globalProjectId]);

  const totals = useMemo(() => {
    const totalMeta = rows.reduce((s, r) => s + r.meta, 0);
    const totalReceita = rows.reduce((s, r) => s + r.receita, 0);
    const totalProj = rows.reduce((s, r) => s + r.projecao, 0);
    const pct = totalMeta > 0 ? Math.min(100, (totalReceita / totalMeta) * 100) : 0;
    return { totalMeta, totalReceita, totalProj, pct };
  }, [rows]);

  const handleSaveMeta = async (row: GoalRow) => {
    const val = Number(draftMeta.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(val) || val < 0) {
      toast.error("Informe um valor de meta válido.");
      return;
    }
    setSavingId(row.id);
    try {
      if (row.goalId) {
        const { error } = await supabase
          .from("imphq_project_goals")
          .update({ meta_receita: val, updated_at: new Date().toISOString() })
          .eq("id", row.goalId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("imphq_project_goals")
          .insert({ project_id: row.id, ano, mes, meta_receita: val });
        if (error) throw error;
      }
      toast.success(`Meta de ${row.nome} atualizada!`);
      setEditingId(null);
      await load();
    } catch {
      toast.error("Não foi possível salvar a meta.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold">Metas Mensais</h1>
            <p className="text-xs text-muted-foreground">
              Progresso de receita ({String(mes).padStart(2, "0")}/{ano}) · clique no ícone de lápis para definir ou ajustar a meta de cada projeto.
            </p>
          </div>
        </div>
        <RevenueModeToggle />
      </div>

      {totals.totalMeta > 0 && (
        <Card className="bg-secondary/20 border-primary/20">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 min-w-[220px] flex-1">
              <div className="flex justify-between text-xs">
                <span className="uppercase tracking-wider text-muted-foreground font-medium">Consolidado do Mês</span>
                <span className="font-mono font-semibold text-primary">{totals.pct.toFixed(1)}%</span>
              </div>
              <Progress value={totals.pct} className="h-2" />
            </div>
            <div className="flex items-center gap-6 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Realizado</p>
                <p className="text-base font-bold tabular-nums">
                  R$ {totals.totalReceita.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Meta Total</p>
                <p className="text-base font-semibold text-muted-foreground tabular-nums">
                  R$ {totals.totalMeta.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Projeção</p>
                <p className="text-base font-bold text-emerald-400 tabular-nums">
                  R$ {totals.totalProj.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => {
          const isEditing = editingId === r.id;
          const isGlobal = globalProjectId === r.id;
          return (
            <Card
              key={r.id}
              className={cn(
                "bg-card border-border hover:border-primary/50 transition-colors h-full",
                isGlobal && "border-primary/60 ring-1 ring-primary/30",
              )}
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Link to={`/projetos/${r.id}`} className="hover:text-primary transition-colors truncate">
                    <CardTitle className="text-sm truncate flex items-center gap-1.5">
                      {r.nome}
                      <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                    </CardTitle>
                  </Link>
                  {isGlobal && (
                    <Badge variant="outline" className="text-[9px] border-primary/40 text-primary shrink-0">
                      Ativo
                    </Badge>
                  )}
                </div>
                {!isEditing && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                    title="Editar meta mensal"
                    onClick={() => {
                      setEditingId(r.id);
                      setDraftMeta(r.meta > 0 ? String(r.meta) : "");
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {isEditing ? (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Input
                      type="number"
                      min={0}
                      step={500}
                      placeholder="Ex: 50000"
                      value={draftMeta}
                      onChange={(e) => setDraftMeta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveMeta(r);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-8 text-xs font-mono"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={savingId === r.id}
                      onClick={() => handleSaveMeta(r)}
                      title="Salvar meta"
                    >
                      {savingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingId(null)}
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : r.meta === 0 ? (
                  <div className="flex items-center justify-between pt-1">
                    <Badge variant="outline" className="text-[10px]">Sem meta definida</Badge>
                    <div className="flex items-center gap-2">
                      {r.receita > 0 && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          R$ {r.receita.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => {
                          setEditingId(r.id);
                          setDraftMeta("");
                        }}
                      >
                        Definir meta
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className={`font-semibold ${r.cor}`}>{r.pct.toFixed(0)}%</span>
                    </div>
                    <Progress value={r.pct} className="h-2" />
                    <div className="flex justify-between text-[10px]">
                      <span className="text-foreground font-medium">
                        R$ {r.receita.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-muted-foreground">
                        / R$ {r.meta.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] pt-1 border-t border-border">
                      <TrendingUp className={`h-3 w-3 ${r.cor}`} />
                      <span className="text-muted-foreground">Projeção:</span>
                      <span className={`font-semibold ${r.cor}`}>
                        R$ {r.projecao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
