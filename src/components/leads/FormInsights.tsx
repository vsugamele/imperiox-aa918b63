import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { Brain, TrendingUp, ChevronDown, ExternalLink, Mail, Phone, MessageSquare, Search } from "lucide-react";

interface Props {
  projects: { id: string; name: string; icon?: string }[];
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const STATUS_COLOR: Record<string, string> = {
  cliente: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  vip: "bg-primary/20 text-primary border-primary/30",
  lead: "bg-secondary text-foreground border-border",
  inativo: "bg-muted text-muted-foreground border-border",
  cancelado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  chargeback: "bg-destructive/20 text-destructive border-destructive/30",
};

export function FormInsights({ projects }: Props) {
  const navigate = useNavigate();
  const [responses, setResponses] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [filterForm, setFilterForm] = useState("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const load = async () => {
      const [respRes, formsRes, leadsRes] = await Promise.all([
        supabase.from("imphq_lead_responses").select("id, form_id, lead_id, project_id, answer, field_key, question, created_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("imphq_capture_forms").select("id, name, project_id, fields"),
        supabase.from("imphq_leads").select("id, nome, email, phone, status, project_id, total_gasto, criado_em"),
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

  // Group submissions by lead + form
  const submissions = useMemo(() => {
    const leadMap = new Map(leads.map(l => [l.id, l]));
    const formMap = new Map(forms.map(f => [f.id, f]));
    const grouped = new Map<string, { key: string; lead: any; form: any; responses: any[]; submittedAt: string; answersFromAggregate: Record<string, any> }>();

    filteredResponses.forEach(r => {
      if (!r.lead_id) return;
      // Bucket by lead+form+date(minute precision) to merge per submission
      const dateKey = r.created_at ? r.created_at.substring(0, 16) : "";
      const key = `${r.lead_id}::${r.form_id}::${dateKey}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.responses.push(r);
      } else {
        grouped.set(key, {
          key,
          lead: leadMap.get(r.lead_id),
          form: formMap.get(r.form_id),
          responses: [r],
          submittedAt: r.created_at,
          answersFromAggregate: r.answers || {},
        });
      }
    });

    let list = Array.from(grouped.values()).filter(s => s.lead);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.lead?.nome || "").toLowerCase().includes(q) ||
        (s.lead?.email || "").toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  }, [filteredResponses, leads, forms, search]);

  const visibleSubmissions = submissions.slice(0, pageSize);

  const chartConfig = { count: { label: "Respostas", color: "hsl(var(--primary))" } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Insights de Captura
          </h3>
          <p className="text-xs text-muted-foreground">{filteredResponses.length} respostas analisadas · {submissions.length} submissões</p>
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

          {/* Respostas Recentes por Lead */}
          <Card className="bg-card border-border md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Respostas Recentes por Lead
                </CardTitle>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPageSize(20); }}
                    placeholder="Buscar nome ou email..."
                    className="h-8 pl-7 text-xs w-[240px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {visibleSubmissions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma submissão encontrada.</p>
              ) : (
                <div className="space-y-2">
                  {visibleSubmissions.map(sub => {
                    const lead = sub.lead;
                    const initial = (lead.nome || lead.email || "?").charAt(0).toUpperCase();
                    const status = lead.status || "lead";
                    const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

                    // Build pergunta→resposta list
                    const qaPairs: { question: string; answer: string; step?: number }[] = [];
                    sub.responses.forEach(r => {
                      if (r.question && r.answer != null) {
                        qaPairs.push({ question: r.question, answer: String(r.answer), step: r.step });
                      }
                    });
                    // Fallback: if no individual rows have question/answer, derive from aggregate answers
                    if (qaPairs.length === 0 && sub.answersFromAggregate) {
                      Object.entries(sub.answersFromAggregate).forEach(([k, v]) => {
                        if (v != null && v !== "") qaPairs.push({ question: k.replace(/_/g, " "), answer: String(v) });
                      });
                    }
                    qaPairs.sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

                    return (
                      <Collapsible key={sub.key}>
                        <div className="bg-secondary/40 border border-border rounded-md overflow-hidden">
                          <CollapsibleTrigger className="w-full p-3 hover:bg-secondary/60 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                                {initial}
                              </div>
                              <div className="min-w-0 flex-1 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold truncate">{lead.nome || "(Sem nome)"}</span>
                                  <Badge variant="outline" className={`text-[9px] ${STATUS_COLOR[status] || ""}`}>{status}</Badge>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                  {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</span>}
                                  {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0 hidden sm:block">
                                <div className="text-[10px] text-muted-foreground">{sub.form?.name || "Formulário"}</div>
                                <div className="text-[10px] text-muted-foreground">{date}</div>
                              </div>
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1 border-t border-border/50">
                              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                                <div className="text-[10px] text-muted-foreground sm:hidden">
                                  {sub.form?.name || "Formulário"} · {date}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] ml-auto"
                                  onClick={() => navigate(`/leads?lead=${lead.id}`)}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir no CRM
                                </Button>
                              </div>
                              {qaPairs.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground italic">Sem respostas detalhadas registradas.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {qaPairs.map((qa, i) => (
                                    <div key={i} className="bg-background/40 rounded p-2 border border-border/50">
                                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                                        {qa.question}
                                      </div>
                                      <div className="text-xs leading-7 text-foreground whitespace-pre-wrap break-words">
                                        {qa.answer}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}

                  {submissions.length > pageSize && (
                    <div className="flex justify-center pt-2">
                      <Button size="sm" variant="outline" onClick={() => setPageSize(s => s + 20)} className="h-8 text-xs">
                        Carregar mais ({submissions.length - pageSize} restantes)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
