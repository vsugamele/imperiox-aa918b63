import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectList } from "@/hooks/useProjectList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

type Baseline = {
  spend: number;
  impressoes: number;
  cliques: number;
  checkouts: number;
  vendas: number;
  receita: number;
};

export default function FunilSimulador() {
  const { data: projects = [] } = useProjectList();
  const [projectId, setProjectId] = useState<string>("");
  const [days, setDays] = useState<number>(30);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [loading, setLoading] = useState(false);

  // sliders (multiplicadores em % do real)
  const [ctrMult, setCtrMult] = useState(100);
  const [cvrLpMult, setCvrLpMult] = useState(100);
  const [cvrCheckoutMult, setCvrCheckoutMult] = useState(100);
  const [ticketMult, setTicketMult] = useState(100);
  const [comissao, setComissao] = useState(80); // % líquido do produtor

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const [adsR, vendasR] = await Promise.all([
      supabase.from("imphq_ads_spend")
        .select("valor, impressoes, cliques, checkouts_iniciados")
        .eq("project_id", projectId)
        .gte("data_ref", dateFrom),
      supabase.from("imphq_vendas")
        .select("valor, status")
        .eq("projeto_id", projectId)
        .gte("data_venda", dateFrom),
    ] as any);

    const spend = (adsR.data || []).reduce((s: number, r: any) => s + (+r.valor || 0), 0);
    const impressoes = (adsR.data || []).reduce((s: number, r: any) => s + (+r.impressoes || 0), 0);
    const cliques = (adsR.data || []).reduce((s: number, r: any) => s + (+r.cliques || 0), 0);
    const checkouts = (adsR.data || []).reduce((s: number, r: any) => s + (+r.checkouts_iniciados || 0), 0);
    const vendasAprovadas = (vendasR.data || []).filter((v: any) => v.status === "approved" || v.status === "aprovado");
    const vendas = vendasAprovadas.length;
    const receita = vendasAprovadas.reduce((s: number, v: any) => s + (+v.valor || 0), 0);

    setBaseline({ spend, impressoes, cliques, checkouts, vendas, receita });
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, days]);

  const scenario = useMemo(() => {
    if (!baseline) return null;
    const ctrBase = baseline.impressoes ? baseline.cliques / baseline.impressoes : 0.01;
    const cvrLpBase = baseline.cliques ? baseline.checkouts / baseline.cliques : 0.1;
    const cvrCheckoutBase = baseline.checkouts ? baseline.vendas / baseline.checkouts : 0.2;
    const ticketBase = baseline.vendas ? baseline.receita / baseline.vendas : 0;

    const ctr = ctrBase * (ctrMult / 100);
    const cvrLp = cvrLpBase * (cvrLpMult / 100);
    const cvrChk = cvrCheckoutBase * (cvrCheckoutMult / 100);
    const ticket = ticketBase * (ticketMult / 100);

    const cliques = baseline.impressoes * ctr;
    const checkouts = cliques * cvrLp;
    const vendas = checkouts * cvrChk;
    const receita = vendas * ticket;
    const liquido = receita * (comissao / 100);
    const lucro = liquido - baseline.spend;
    const roas = baseline.spend ? receita / baseline.spend : 0;

    return { ctr, cvrLp, cvrChk, ticket, cliques, checkouts, vendas, receita, liquido, lucro, roas };
  }, [baseline, ctrMult, cvrLpMult, cvrCheckoutMult, ticketMult, comissao]);

  const real = useMemo(() => {
    if (!baseline) return null;
    const liquido = baseline.receita * (comissao / 100);
    return {
      ...baseline,
      liquido,
      lucro: liquido - baseline.spend,
      roas: baseline.spend ? baseline.receita / baseline.spend : 0,
    };
  }, [baseline, comissao]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

  const delta = (a: number, b: number) => {
    if (!b) return 0;
    return ((a - b) / b) * 100;
  };

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Simulador de Funil</h1>
            <p className="text-xs text-muted-foreground">Mexa nos sliders e veja impacto em receita e lucro</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(+v)}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!baseline ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Carregando dados base do projeto…</CardContent></Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Sliders (multiplicador % sobre real)</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {[
                { label: "CTR (cliques / impressões)", v: ctrMult, set: setCtrMult },
                { label: "Conv. LP → Checkout", v: cvrLpMult, set: setCvrLpMult },
                { label: "Conv. Checkout → Venda", v: cvrCheckoutMult, set: setCvrCheckoutMult },
                { label: "Ticket médio", v: ticketMult, set: setTicketMult },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <Label className="text-xs">{s.label}</Label>
                    <span className={`font-mono ${s.v === 100 ? "" : s.v > 100 ? "text-emerald-400" : "text-rose-400"}`}>{s.v}%</span>
                  </div>
                  <Slider value={[s.v]} onValueChange={([n]) => s.set(n)} min={20} max={300} step={5} />
                </div>
              ))}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <Label className="text-xs">Sua parte (% líquido)</Label>
                  <span className="font-mono">{comissao}%</span>
                </div>
                <Slider value={[comissao]} onValueChange={([n]) => setComissao(n)} min={10} max={100} step={5} />
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => {
                setCtrMult(100); setCvrLpMult(100); setCvrCheckoutMult(100); setTicketMult(100);
              }}>Resetar sliders</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Atual vs Cenário</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border/30">
                  <tr><th className="text-left py-2">Métrica</th><th className="text-right">Atual</th><th className="text-right">Cenário</th><th className="text-right">Δ</th></tr>
                </thead>
                <tbody className="text-xs">
                  {[
                    ["Cliques", real!.cliques, scenario!.cliques, fmt],
                    ["Checkouts", real!.checkouts, scenario!.checkouts, fmt],
                    ["Vendas", real!.vendas, scenario!.vendas, fmt],
                    ["Receita bruta", real!.receita, scenario!.receita, brl],
                    ["Líquido (sua parte)", real!.liquido, scenario!.liquido, brl],
                    ["Investimento", real!.spend, real!.spend, brl],
                    ["Lucro", real!.lucro, scenario!.lucro, brl],
                    ["ROAS", real!.roas, scenario!.roas, (n: number) => n.toFixed(2) + "x"],
                  ].map(([label, a, b, f]: any) => {
                    const d = delta(b, a);
                    return (
                      <tr key={label} className="border-b border-border/10">
                        <td className="py-2 text-muted-foreground">{label}</td>
                        <td className="text-right font-mono">{f(a)}</td>
                        <td className="text-right font-mono font-bold">{f(b)}</td>
                        <td className={`text-right font-mono ${d > 0 ? "text-emerald-400" : d < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                          {d === 0 ? "—" : (
                            <span className="inline-flex items-center gap-0.5">
                              {d > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {Math.abs(d).toFixed(0)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Button
                size="sm"
                className="w-full mt-4"
                onClick={async () => {
                  const { error } = await supabase.from("imphq_funnel_snapshots").insert({
                    projeto_id: projectId,
                    label: `Simulação ${new Date().toLocaleDateString("pt-BR")}`,
                    motivo: "simulador",
                    canvas: { baseline, scenario, sliders: { ctrMult, cvrLpMult, cvrCheckoutMult, ticketMult, comissao } } as any,
                  });
                  if (error) toast.error(error.message);
                  else toast.success("Cenário salvo");
                }}
              >Salvar cenário</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
