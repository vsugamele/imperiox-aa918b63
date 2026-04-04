import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, PieChart, Pie, Legend } from "recharts";
import { Brain, TrendingUp, Users } from "lucide-react";

interface Props {
  projects: { id: string; name: string; icon?: string }[];
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function FormInsights({ projects }: Props) {
  const [responses, setResponses] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [filterForm, setFilterForm] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [respRes, formsRes, leadsRes] = await Promise.all([
        supabase.from("imphq_lead_responses").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("imphq_capture_forms").select("id, name, project_id, fields"),
        supabase.from("imphq_leads").select("id, status, project_id, total_gasto"),
      ]);
      setResponses(respRes.data || []);
      setForms(formsRes.data || []);
      setLeads(leadsRes.data || []);
    };
    load();
  }, []);

  const filteredResponses = useMemo(() => {
    let data = responses;
    if (filterForm !== "all") data = data.filter(r => r.form_id === filterForm);
    if (filterProject !== "all") {
      const formIds = forms.filter(f => f.project_id === filterProject).map(f => f.id);
      data = data.filter(r => formIds.includes(r.form_id));
    }
    return data;
  }, [responses, filterForm, filterProject, forms]);

  // Aggregate answers by field
  const fieldStats = useMemo(() => {
    const stats = new Map<string, Map<string, number>>();
    filteredResponses.forEach(r => {
      const answers = r.answers || {};
      Object.entries(answers).forEach(([key, value]) => {
        if (!value || key === "email" || key === "phone" || key === "nome") return;
        if (!stats.has(key)) stats.set(key, new Map());
        const valStr = String(value).substring(0, 50);
        const fieldMap = stats.get(key)!;
        fieldMap.set(valStr, (fieldMap.get(valStr) || 0) + 1);
      });
    });
    return stats;
  }, [filteredResponses]);

  // Conversion rate by answer
  const conversionByAnswer = useMemo(() => {
    const leadMap = new Map(leads.map(l => [l.id, l]));
    const results: { field: string; value: string; total: number; converted: number; rate: number }[] = [];
    
    const fieldAnswers = new Map<string, Map<string, { total: number; converted: number }>>();
    filteredResponses.forEach(r => {
      const lead = leadMap.get(r.lead_id);
      const isConverted = lead?.status === "cliente";
      const answers = r.answers || {};
      Object.entries(answers).forEach(([key, value]) => {
        if (!value || key === "email" || key === "phone" || key === "nome") return;
        const valStr = String(value).substring(0, 50);
        if (!fieldAnswers.has(key)) fieldAnswers.set(key, new Map());
        const fm = fieldAnswers.get(key)!;
        const prev = fm.get(valStr) || { total: 0, converted: 0 };
        prev.total++;
        if (isConverted) prev.converted++;
        fm.set(valStr, prev);
      });
    });

    fieldAnswers.forEach((vals, field) => {
      vals.forEach((data, value) => {
        if (data.total >= 2) {
          results.push({ field, value, total: data.total, converted: data.converted, rate: Math.round((data.converted / data.total) * 100) });
        }
      });
    });

    return results.sort((a, b) => b.rate - a.rate).slice(0, 20);
  }, [filteredResponses, leads]);

  const chartConfig = { count: { label: "Respostas", color: "hsl(var(--primary))" } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Insights de Captura
          </h3>
          <p className="text-xs text-muted-foreground">{filteredResponses.length} respostas analisadas</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Projetos</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterForm} onValueChange={setFilterForm}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Formulário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Forms</SelectItem>
              {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredResponses.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Sem respostas ainda. Crie formulários e integre nas suas páginas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Field distribution charts */}
          {Array.from(fieldStats.entries()).slice(0, 6).map(([field, valMap]) => {
            const data = Array.from(valMap.entries())
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 8);
            return (
              <Card key={field} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize">{field.replace(/_/g, " ")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <BarChart data={data} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="name" className="text-[9px]" angle={-20} textAnchor="end" height={50} />
                      <YAxis className="text-[10px]" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            );
          })}

          {/* Conversion by answer */}
          {conversionByAnswer.length > 0 && (
            <Card className="bg-card border-border md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Taxa de Conversão por Resposta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversionByAnswer.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-secondary/50 rounded border border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[9px] shrink-0">{item.field.replace(/_/g, " ")}</Badge>
                        <span className="text-xs truncate">{item.value}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{item.converted}/{item.total}</span>
                        <Badge variant={item.rate > 20 ? "default" : "secondary"} className="text-[10px]">
                          {item.rate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
