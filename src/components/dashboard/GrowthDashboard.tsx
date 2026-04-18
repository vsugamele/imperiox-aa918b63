import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { toLocalDateStr } from "@/lib/periodUtils";

interface GrowthMetric {
  id: string;
  project_id: string;
  week_start: string;
  category: string;
  metric_name: string;
  valor: number;
  meta: number | null;
}

const CATEGORIES: Record<string, { label: string; emoji: string; metrics: string[] }> = {
  awareness: { label: "Conscientização", emoji: "👁️", metrics: ["Novos Seguidores", "Page Views", "Público Pixelado"] },
  engagement: { label: "Engajamento", emoji: "💬", metrics: ["Comentários", "Taxa Rejeição"] },
  acquisition: { label: "Aquisição", emoji: "🧲", metrics: ["Leads Gerados", "Inscritos Webinar"] },
  conversion: { label: "Conversão", emoji: "💰", metrics: ["Visitas Checkout", "Compras", "CPA"] },
  retention: { label: "Retenção", emoji: "🔄", metrics: ["Frequência", "Logins", "Churn"] },
  upsell: { label: "Ascensão", emoji: "📈", metrics: ["Taxa Upsell", "LTV"] },
};

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return toLocalDateStr(date);
}

function getWeeks(count: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getMonday(d));
  }
  return [...new Set(weeks)];
}

function statusColor(valor: number, meta: number | null): string {
  if (!meta || meta === 0) return "text-muted-foreground";
  const pct = (valor / meta) * 100;
  if (pct >= 100) return "text-emerald-400";
  if (pct >= 70) return "text-amber-400";
  return "text-destructive";
}

function statusBg(valor: number, meta: number | null): string {
  if (!meta || meta === 0) return "";
  const pct = (valor / meta) * 100;
  if (pct >= 100) return "bg-emerald-500/10";
  if (pct >= 70) return "bg-amber-500/10";
  return "bg-destructive/10";
}

interface Props {
  projectFilter?: string;
}

export default function GrowthDashboard({ projectFilter }: Props) {
  const [metrics, setMetrics] = useState<GrowthMetric[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("all");
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const { user } = useAuth();
  const weeks = getWeeks(4);

  // Sync selectedProject with parent filter
  useEffect(() => {
    if (projectFilter && projectFilter !== "all") {
      setSelectedProject(projectFilter);
    }
  }, [projectFilter]);

  const load = async () => {
    const [metricsRes, projRes] = await Promise.all([
      supabase.from("imphq_growth_metrics").select("*").order("week_start"),
      supabase.from("imphq_projects").select("id, name, icon"),
    ]);
    setMetrics((metricsRes.data || []) as GrowthMetric[]);
    setProjects(projRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const filteredMetrics = selectedProject === "all" ? metrics : metrics.filter(m => m.project_id === selectedProject);

  const getValue = (category: string, metricName: string, weekStart: string): GrowthMetric | undefined => {
    return filteredMetrics.find(m => m.category === category && m.metric_name === metricName && m.week_start === weekStart);
  };

  const cellKey = (cat: string, metric: string, week: string) => `${cat}-${metric}-${week}`;

  const saveCell = async (category: string, metricName: string, weekStart: string) => {
    if (!user || selectedProject === "all") {
      toast.error("Selecione um projeto específico");
      return;
    }
    const valor = parseFloat(editValue) || 0;
    const meta = editMeta ? parseFloat(editMeta) : null;

    const { error } = await supabase.from("imphq_growth_metrics").upsert({
      project_id: selectedProject,
      user_id: user.id,
      week_start: weekStart,
      category,
      metric_name: metricName,
      valor,
      meta,
    }, { onConflict: "project_id,week_start,category,metric_name" });

    if (error) { toast.error(error.message); return; }
    setEditingCell(null);
    load();
  };

  const formatWeek = (w: string) => {
    const d = new Date(w + "T00:00:00");
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  };

  if (projects.length === 0) return null;

  return (
    <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "550ms", animationFillMode: "both" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Growth Dashboard
          </CardTitle>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Filtrar projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-48">Métrica</th>
                {weeks.map(w => (
                  <th key={w} className="text-center py-2 px-2 font-mono text-muted-foreground min-w-[80px]">
                    Sem {formatWeek(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                <>
                  <tr key={catKey}>
                    <td colSpan={weeks.length + 1} className="pt-3 pb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {cat.emoji} {cat.label}
                      </span>
                    </td>
                  </tr>
                  {cat.metrics.map(metricName => (
                    <tr key={`${catKey}-${metricName}`} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-1.5 pr-4 text-foreground">{metricName}</td>
                      {weeks.map(w => {
                        const key = cellKey(catKey, metricName, w);
                        const m = getValue(catKey, metricName, w);
                        const isEditing = editingCell === key;

                        if (isEditing) {
                          return (
                            <td key={w} className="py-1 px-1">
                              <div className="flex flex-col gap-0.5">
                                <Input
                                  className="h-6 text-xs text-center bg-secondary"
                                  placeholder="Valor"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={e => e.key === "Enter" && saveCell(catKey, metricName, w)}
                                />
                                <Input
                                  className="h-6 text-xs text-center bg-secondary"
                                  placeholder="Meta"
                                  value={editMeta}
                                  onChange={e => setEditMeta(e.target.value)}
                                  onKeyDown={e => e.key === "Enter" && saveCell(catKey, metricName, w)}
                                />
                                <Button size="sm" className="h-5 text-[9px]" onClick={() => saveCell(catKey, metricName, w)}>OK</Button>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={w}
                            className={`py-1.5 px-2 text-center cursor-pointer hover:bg-primary/5 rounded transition-colors ${m ? statusBg(m.valor, m.meta) : ""}`}
                            onClick={() => {
                              if (selectedProject === "all") {
                                toast.error("Selecione um projeto para editar");
                                return;
                              }
                              setEditingCell(key);
                              setEditValue(m?.valor?.toString() || "");
                              setEditMeta(m?.meta?.toString() || "");
                            }}
                          >
                            {m ? (
                              <div>
                                <span className={`font-mono font-bold ${statusColor(m.valor, m.meta)}`}>
                                  {m.valor.toLocaleString("pt-BR")}
                                </span>
                                {m.meta && (
                                  <span className="text-[9px] text-muted-foreground block">
                                    meta: {m.meta.toLocaleString("pt-BR")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
