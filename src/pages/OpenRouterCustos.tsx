import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, Cpu, Zap, AlertTriangle, TrendingUp } from "lucide-react";
import { fetchAll } from "@/lib/supabasePaginate";

// Preço Gemini Flash (OpenRouter, USD por token)
const PRICE_PROMPT_PER_TOKEN = 0.075 / 1_000_000;
const PRICE_COMPLETION_PER_TOKEN = 0.30 / 1_000_000;
const USD_TO_BRL = 5.5;

type Log = {
  id: string;
  project_id: string | null;
  conversation_id: string | null;
  lead_id: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
};

function costOf(l: Log): number {
  if (l.cost_usd && l.cost_usd > 0) return Number(l.cost_usd);
  const pt = l.prompt_tokens || 0;
  const ct = l.completion_tokens || 0;
  return pt * PRICE_PROMPT_PER_TOKEN + ct * PRICE_COMPLETION_PER_TOKEN;
}

const fmtUSD = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 });
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export default function OpenRouterCustos() {
  const [days, setDays] = useState("30");
  const [project, setProject] = useState("__all__");
  const [model, setModel] = useState("__all__");
  const [status, setStatus] = useState<"all" | "ok" | "err">("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["or-custos-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["or-custos", days, project, status],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const rows = await fetchAll<Log>((from, to) => {
        let q = supabase
          .from("imphq_wa_ai_logs")
          .select("id, project_id, conversation_id, lead_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, success, error_message, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (project !== "__all__") q = q.eq("project_id", project);
        if (status === "ok") q = q.eq("success", true);
        if (status === "err") q = q.eq("success", false);
        return q;
      }, 1000, 20000);
      return rows;
    },
  });

  const projectName = useMemo(() => {
    const m = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? m.get(id) || id : "—");
  }, [projects]);

  const filtered = useMemo(() => {
    return logs.filter((l) => (model === "__all__" ? true : l.model === model));
  }, [logs, model]);

  const totals = useMemo(() => {
    let cost = 0, prompt = 0, completion = 0, calls = 0, errors = 0;
    filtered.forEach((l) => {
      cost += costOf(l);
      prompt += l.prompt_tokens || 0;
      completion += l.completion_tokens || 0;
      calls++;
      if (!l.success) errors++;
    });
    return { cost, prompt, completion, calls, errors, avg: calls ? cost / calls : 0 };
  }, [filtered]);

  const modelsAvailable = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.model).filter(Boolean))) as string[];
  }, [logs]);

  const byProject = useMemo(() => {
    const map = new Map<string, { project_id: string; calls: number; cost: number; tokens: number }>();
    filtered.forEach((l) => {
      const k = l.project_id || "(sem projeto)";
      const cur = map.get(k) ?? { project_id: k, calls: 0, cost: 0, tokens: 0 };
      cur.calls++;
      cur.cost += costOf(l);
      cur.tokens += l.total_tokens || 0;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; calls: number; cost: number; tokens: number }>();
    filtered.forEach((l) => {
      const d = (l.created_at || "").slice(0, 10);
      const cur = map.get(d) ?? { day: d, calls: 0, cost: 0, tokens: 0 };
      cur.calls++;
      cur.cost += costOf(l);
      cur.tokens += l.total_tokens || 0;
      map.set(d, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day));
  }, [filtered]);

  const byLead = useMemo(() => {
    const map = new Map<string, { key: string; lead_id: string | null; conv: string | null; project_id: string | null; calls: number; cost: number; tokens: number }>();
    filtered.forEach((l) => {
      const k = l.lead_id || l.conversation_id || "(sem lead)";
      const cur = map.get(k) ?? { key: k, lead_id: l.lead_id, conv: l.conversation_id, project_id: l.project_id, calls: 0, cost: 0, tokens: 0 };
      cur.calls++;
      cur.cost += costOf(l);
      cur.tokens += l.total_tokens || 0;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost).slice(0, 25);
  }, [filtered]);

  const topProject = byProject[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-cormorant text-foreground">Custos OpenRouter</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria de tokens e custo das chamadas de IA do WhatsApp/Instagram (Gemini Flash via OpenRouter).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os projetos</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Modelo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os modelos</SelectItem>
              {modelsAvailable.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ok">Sucesso</SelectItem>
              <SelectItem value="err">Erro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 dia</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={<Coins className="size-4" />} label="Custo total (USD)" value={fmtUSD(totals.cost)} hint={fmtBRL(totals.cost * USD_TO_BRL)} tone="emerald" />
            <Kpi icon={<Cpu className="size-4" />} label="Chamadas" value={fmtNum(totals.calls)} hint={`${totals.errors} com erro`} tone="sky" />
            <Kpi icon={<Zap className="size-4" />} label="Tokens (in / out)" value={`${fmtNum(totals.prompt)} / ${fmtNum(totals.completion)}`} hint={`${fmtNum(totals.prompt + totals.completion)} total`} tone="amber" />
            <Kpi icon={<TrendingUp className="size-4" />} label="Custo médio / chamada" value={fmtUSD(totals.avg)} hint={topProject ? `Top: ${projectName(topProject.project_id)}` : "—"} tone="rose" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Por projeto</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projeto</TableHead>
                      <TableHead className="text-right">Chamadas</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo USD</TableHead>
                      <TableHead className="text-right">% do total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byProject.map((p) => (
                      <TableRow key={p.project_id}>
                        <TableCell className="font-medium">{projectName(p.project_id)}</TableCell>
                        <TableCell className="text-right">{fmtNum(p.calls)}</TableCell>
                        <TableCell className="text-right">{fmtNum(p.tokens)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtUSD(p.cost)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {totals.cost > 0 ? ((p.cost / totals.cost) * 100).toFixed(1) : "0"}%
                        </TableCell>
                      </TableRow>
                    ))}
                    {byProject.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Por dia</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Chamadas</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byDay.map((d) => (
                      <TableRow key={d.day}>
                        <TableCell className="font-mono text-xs">{d.day}</TableCell>
                        <TableCell className="text-right">{fmtNum(d.calls)}</TableCell>
                        <TableCell className="text-right">{fmtNum(d.tokens)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtUSD(d.cost)}</TableCell>
                      </TableRow>
                    ))}
                    {byDay.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Top 25 leads / conversas que mais consomem</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead / Conversa</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byLead.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell className="font-mono text-[11px] max-w-[280px] truncate">{l.key}</TableCell>
                      <TableCell className="text-xs">{projectName(l.project_id)}</TableCell>
                      <TableCell className="text-right">{fmtNum(l.calls)}</TableCell>
                      <TableCell className="text-right">{fmtNum(l.tokens)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtUSD(l.cost)}</TableCell>
                    </TableRow>
                  ))}
                  {byLead.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Últimas 50 chamadas</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Custo USD</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 50).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{projectName(l.project_id)}</TableCell>
                      <TableCell className="text-xs font-mono">{l.model || "—"}</TableCell>
                      <TableCell className="text-right text-xs">{fmtNum(l.prompt_tokens || 0)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtNum(l.completion_tokens || 0)}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">{fmtUSD(costOf(l))}</TableCell>
                      <TableCell>
                        {l.success
                          ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">ok</Badge>
                          : <Badge variant="outline" className="bg-rose-500/15 text-rose-300 border-rose-500/30"><AlertTriangle className="size-3 mr-1" />erro</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground">
            Custo é o valor reportado pelo OpenRouter em <code>cost_usd</code>. Quando ausente, é estimado por tokens (Gemini Flash: prompt US$ 0,075/M · completion US$ 0,30/M).
            BRL a US$1 = R${USD_TO_BRL}.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone: "emerald" | "sky" | "amber" | "rose" }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className={`flex items-center gap-2 text-[10px] uppercase tracking-wide ${colorMap[tone]}`}>
          {icon}<span>{label}</span>
        </div>
        <p className="text-xl font-semibold">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
