import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Calendar, Users, MapPin, Cake, Sparkles, Loader2,
  TrendingDown, AlertTriangle, Zap, Target, Activity, DollarSign,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ===== Heurística leve para inferir gênero a partir de primeiro nome BR =====
const NAMES_M = new Set([
  "joao","jose","carlos","paulo","pedro","lucas","luiz","marcos","luis","gabriel","rafael","daniel",
  "marcelo","bruno","eduardo","felipe","raimundo","rodrigo","manoel","thiago","tiago","francisco",
  "andre","leonardo","mateus","matheus","guilherme","caio","vitor","victor","diego","fabio","gustavo",
  "renato","ricardo","anderson","alex","alexandre","alessandro","sergio","wesley","wellington","leandro",
  "antonio","roberto","robson","ronaldo","douglas","henrique","igor","ivan","jorge","julio","julio cesar",
  "miguel","murilo","nicolas","otavio","raul","samuel","yuri","arthur","artur","benjamin","bernardo",
  "davi","davidson","emanuel","enzo","heitor","ian","kaique","kaio","levi","noah","ravi","theo","valentim",
  "vinicius","wagner","wallace","william","willian","yan","yago"
]);
const NAMES_F = new Set([
  "maria","ana","francisca","antonia","adriana","juliana","marcia","fernanda","patricia","aline",
  "sandra","camila","amanda","bruna","jessica","leticia","julia","luciana","marcia","marcela","marina",
  "natalia","priscila","raquel","renata","sabrina","sara","sarah","simone","tatiana","valeria","vanessa",
  "vera","viviane","alessandra","alice","aliny","alicia","amelia","andrea","angela","beatriz","bianca",
  "carla","carolina","cibele","clara","claudia","cristiane","cristina","daniela","debora","elaine",
  "eliana","elis","elisa","elisangela","emanuela","erika","erica","esther","eva","fabiana","flavia",
  "gabriela","helena","heloisa","iara","ingrid","isabela","isabella","isadora","jaqueline","joana",
  "katia","larissa","laura","lavinia","lais","lara","liliane","livia","luana","lucia","luiza","manuela",
  "margarida","mariana","marta","mayara","melissa","milena","miriam","monica","nadia","nayara","nicole",
  "olivia","paloma","pamela","pietra","poliana","rafaela","regina","roberta","rosana","rose","silvana",
  "silvia","sofia","sonia","stella","suelen","susana","tainara","talita","tamara","tania","thais","valentina",
  "vitoria","yasmin","yara","zilda"
]);

function inferGender(nome?: string | null): "M" | "F" | null {
  if (!nome) return null;
  const first = nome.trim().split(/\s+/)[0]?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!first) return null;
  if (NAMES_M.has(first)) return "M";
  if (NAMES_F.has(first)) return "F";
  if (first.endsWith("a")) return "F";
  if (first.endsWith("o") || first.endsWith("r") || first.endsWith("l")) return "M";
  return null;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ALL_PRODUCTS = "__all__";

// Bandeiras regionais por UF (emoji simplificado)
const UF_REGION_EMOJI: Record<string, string> = {
  SP:"🏙️", RJ:"🏖️", MG:"⛰️", ES:"🌊", PR:"🌲", SC:"❄️", RS:"🐎",
  BA:"🌴", PE:"🥥", CE:"☀️", RN:"🦞", PB:"🌅", AL:"🦀", SE:"🐚", PI:"🌵", MA:"🦜",
  GO:"🌾", DF:"🏛️", MT:"🐂", MS:"🌿", TO:"🌅",
  AM:"🌳", PA:"🐟", AC:"🌴", RO:"🦋", RR:"🌄", AP:"🛶",
};

interface Props { projectId: string }

interface Row { ts: string; valor?: number; lead?: any; produto?: string | null }

interface AdsRow {
  data_ref: string; campanha: string | null; valor: number;
  impressoes: number; alcance: number; link_clicks: number; cliques: number;
  landing_page_views: number; add_to_cart: number; init_checkout: number;
  checkouts_iniciados: number; compras: number; resultados: number;
  hook_rate: number | null; hold_rate: number | null; ctr: number | null;
  cpm: number | null; frequencia: number | null;
}

export function ProjetoInsights({ projectId }: Props) {
  const [period, setPeriod] = useState("90d");
  const [source, setSource] = useState<"vendas" | "leads">("vendas");
  const [produto, setProduto] = useState<string>(ALL_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [adsRows, setAdsRows] = useState<AdsRow[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);

  // Carrega lista de produtos do projeto
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("imphq_vendas")
        .select("produto_nome")
        .eq("project_id", projectId)
        .not("produto_nome", "is", null)
        .limit(2000);
      if (cancel) return;
      const uniq = Array.from(new Set(((data ?? []) as any[]).map(d => d.produto_nome).filter(Boolean))) as string[];
      setProdutos(uniq.sort());
    })();
    return () => { cancel = true; };
  }, [projectId]);

  // Carrega audiência (vendas/leads) + ads em paralelo
  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setAdsLoading(true);
      const days = period === "30d" ? 30 : period === "90d" ? 90 : period === "180d" ? 180 : 365;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const sinceDate = since.slice(0, 10);

      const audiencePromise = (async () => {
        if (source === "vendas") {
          let q = supabase.from("imphq_vendas")
            .select("created_at, valor, lead_id, produto_nome")
            .eq("project_id", projectId)
            .eq("status", "aprovado")
            .gte("created_at", since)
            .limit(8000);
          if (produto !== ALL_PRODUCTS) q = q.eq("produto_nome", produto);
          const { data } = await q;
          const vendas = (data ?? []) as any[];
          const leadIds = [...new Set(vendas.map(v => v.lead_id).filter(Boolean))] as string[];
          const leadsMap = new Map<string, any>();
          if (leadIds.length) {
            const { data: leads } = await (supabase as any)
              .from("imphq_leads")
              .select("id, nome, genero, phone, data")
              .in("id", leadIds);
            ((leads ?? []) as any[]).forEach((l: any) => leadsMap.set(l.id, l));
          }
          return vendas.map((v: any) => ({
            ts: v.created_at, valor: Number(v.valor || 0),
            lead: leadsMap.get(v.lead_id), produto: v.produto_nome,
          })) as Row[];
        } else {
          let q: any = (supabase as any).from("imphq_leads")
            .select("criado_em, nome, genero, phone, data, ultimo_produto")
            .eq("project_id", projectId)
            .gte("criado_em", since)
            .limit(8000);
          if (produto !== ALL_PRODUCTS) q = q.eq("ultimo_produto", produto);
          const { data } = await q;
          return ((data ?? []) as any[]).map((l: any) => ({
            ts: l.criado_em, lead: l, produto: l.ultimo_produto,
          })) as Row[];
        }
      })();

      const adsPromise = (async () => {
        let q = supabase.from("imphq_ads_spend")
          .select("data_ref, campanha, valor, impressoes, alcance, link_clicks, cliques, landing_page_views, add_to_cart, init_checkout, checkouts_iniciados, compras, resultados, hook_rate, hold_rate, ctr, cpm, frequencia")
          .eq("project_id", projectId)
          .gte("data_ref", sinceDate)
          .limit(10000);
        if (produto !== ALL_PRODUCTS) q = q.ilike("campanha", `%${produto}%`);
        const { data } = await q;
        return (data ?? []).map((r: any) => ({
          ...r,
          valor: Number(r.valor || 0),
          impressoes: Number(r.impressoes || 0),
          alcance: Number(r.alcance || 0),
          link_clicks: Number(r.link_clicks || 0),
          cliques: Number(r.cliques || 0),
          landing_page_views: Number(r.landing_page_views || 0),
          add_to_cart: Number(r.add_to_cart || 0),
          init_checkout: Number(r.init_checkout || 0),
          checkouts_iniciados: Number(r.checkouts_iniciados || 0),
          compras: Number(r.compras || 0),
          resultados: Number(r.resultados || 0),
        })) as AdsRow[];
      })();

      const [audience, ads] = await Promise.all([audiencePromise, adsPromise]);
      if (cancel) return;
      setRows(audience);
      setAdsRows(ads);
      setLoading(false);
      setAdsLoading(false);
    }
    load();
    return () => { cancel = true; };
  }, [projectId, period, source, produto]);

  // ===== Agregações de audiência =====
  const insights = useMemo(() => {
    const hourly = new Array(24).fill(0);
    const hourlyValor = new Array(24).fill(0);
    const weekday = new Array(7).fill(0);
    const weekdayValor = new Array(7).fill(0);
    const gender = { M: 0, F: 0, U: 0 };
    const ufCount: Record<string, number> = {};
    const ageBuckets: Record<string, number> = { "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "?": 0 };
    let totalValor = 0;

    rows.forEach(r => {
      const d = new Date(r.ts);
      const local = new Date(d.getTime() - 3 * 3600000);
      const h = local.getUTCHours();
      const w = local.getUTCDay();
      hourly[h]++;
      weekday[w]++;
      if (r.valor) {
        hourlyValor[h] += r.valor;
        weekdayValor[w] += r.valor;
        totalValor += r.valor;
      }
      const lead = r.lead;
      const g = lead?.genero || inferGender(lead?.nome);
      if (g === "M") gender.M++;
      else if (g === "F") gender.F++;
      else gender.U++;

      const phone = (lead?.phone || "").replace(/\D/g, "");
      const ddd = phone.startsWith("55") ? phone.slice(2, 4) : phone.slice(0, 2);
      const uf = DDD_UF[ddd];
      if (uf) ufCount[uf] = (ufCount[uf] || 0) + 1;

      const idade = lead?.data?.idade || calcAge(lead?.data?.aniversario || lead?.data?.nascimento);
      if (idade) {
        if (idade < 25) ageBuckets["18-24"]++;
        else if (idade < 35) ageBuckets["25-34"]++;
        else if (idade < 45) ageBuckets["35-44"]++;
        else if (idade < 55) ageBuckets["45-54"]++;
        else ageBuckets["55+"]++;
      } else {
        ageBuckets["?"]++;
      }
    });

    // Top 3 horários
    const hourRanking = hourly
      .map((v, h) => ({ h, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .filter(x => x.v > 0);

    const peakHour = hourRanking[0]?.h ?? 0;
    const peakDay = weekday.indexOf(Math.max(...weekday));
    const totalGender = Math.max(1, gender.M + gender.F + gender.U);
    const topUFs = Object.entries(ufCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const ticketMedio = rows.filter(r => r.valor).length > 0
      ? totalValor / rows.filter(r => r.valor).length : 0;

    return {
      hourly, hourlyValor, weekday, weekdayValor, gender, ufCount, ageBuckets,
      peakHour, peakDay, totalGender, topUFs, totalValor, ticketMedio, hourRanking,
    };
  }, [rows]);

  const maxHour = Math.max(1, ...insights.hourly);
  const maxDay = Math.max(1, ...insights.weekday);
  const maxUF = insights.topUFs[0]?.[1] ?? 1;
  const totalRecords = rows.length;

  // ===== Agregações de Ads =====
  const adsAgg = useMemo(() => {
    const init = {
      spend: 0, impressoes: 0, alcance: 0, link_clicks: 0, cliques: 0,
      lp_views: 0, atc: 0, ic: 0, compras: 0,
      hook_sum: 0, hook_n: 0, hold_sum: 0, hold_n: 0,
      ctr_sum: 0, ctr_n: 0, cpm_sum: 0, cpm_n: 0,
      freq_sum: 0, freq_n: 0,
    };
    adsRows.forEach(r => {
      init.spend += r.valor;
      init.impressoes += r.impressoes;
      init.alcance += r.alcance;
      init.link_clicks += r.link_clicks;
      init.cliques += r.cliques;
      init.lp_views += r.landing_page_views;
      init.atc += r.add_to_cart;
      init.ic += (r.init_checkout || r.checkouts_iniciados || 0);
      init.compras += r.compras;
      if (r.hook_rate != null) { init.hook_sum += Number(r.hook_rate); init.hook_n++; }
      if (r.hold_rate != null) { init.hold_sum += Number(r.hold_rate); init.hold_n++; }
      if (r.ctr != null) { init.ctr_sum += Number(r.ctr); init.ctr_n++; }
      if (r.cpm != null) { init.cpm_sum += Number(r.cpm); init.cpm_n++; }
      if (r.frequencia != null) { init.freq_sum += Number(r.frequencia); init.freq_n++; }
    });
    const linkClicks = init.link_clicks || init.cliques;
    const hook = init.hook_n ? init.hook_sum / init.hook_n : 0;
    const hold = init.hold_n ? init.hold_sum / init.hold_n : 0;
    const ctr = init.ctr_n ? init.ctr_sum / init.ctr_n : 0;
    const cpm = init.cpm_n ? init.cpm_sum / init.cpm_n : 0;
    const freq = init.freq_n ? init.freq_sum / init.freq_n : 0;

    // Razão cliques/LP — detector de lentidão
    const clickToLpRatio = init.lp_views > 0 ? linkClicks / init.lp_views : 0;
    const lpDropPct = linkClicks > 0 ? Math.max(0, ((linkClicks - init.lp_views) / linkClicks) * 100) : 0;

    return { ...init, linkClicks, hook, hold, ctr, cpm, freq, clickToLpRatio, lpDropPct };
  }, [adsRows]);

  const funnelSteps = useMemo(() => {
    const steps = [
      { key: "imp", label: "Impressões", icon: "👁️", value: adsAgg.impressoes },
      { key: "clk", label: "Cliques", icon: "🖱️", value: adsAgg.linkClicks },
      { key: "lp",  label: "Visitas LP", icon: "🌐", value: adsAgg.lp_views },
      { key: "atc", label: "Add to Cart", icon: "🛒", value: adsAgg.atc },
      { key: "ic",  label: "Checkout", icon: "💳", value: adsAgg.ic },
      { key: "buy", label: "Compras", icon: "✅", value: adsAgg.compras },
    ];
    return steps.map((s, i) => {
      const prev = i > 0 ? steps[i - 1].value : null;
      const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
      const drop = conv != null ? 100 - conv : null;
      return { ...s, conv, drop };
    });
  }, [adsAgg]);

  // Diagnósticos automáticos
  const diagnostics = useMemo(() => {
    const items: { severity: "danger" | "warn" | "ok"; title: string; detail: string }[] = [];
    if (adsAgg.impressoes === 0 && adsRows.length === 0) return items;
    if (adsAgg.hook && adsAgg.hook < 25) {
      items.push({ severity: "warn", title: "Hook fraco", detail: `Hook rate em ${adsAgg.hook.toFixed(1)}% — criativo não prende atenção nos primeiros 3s.` });
    }
    if (adsAgg.linkClicks > 0 && adsAgg.lp_views > 0 && adsAgg.lp_views < adsAgg.linkClicks * 0.7) {
      items.push({
        severity: "danger",
        title: "⚠️ Possível lentidão na LP",
        detail: `${adsAgg.lpDropPct.toFixed(0)}% dos cliques nunca chegam à LP (${adsAgg.linkClicks.toLocaleString()} cliques → ${adsAgg.lp_views.toLocaleString()} views). Audite velocidade/redirects.`,
      });
    }
    if (adsAgg.lp_views > 50 && adsAgg.ic > 0 && (adsAgg.ic / adsAgg.lp_views) < 0.05) {
      items.push({ severity: "warn", title: "LP não converte", detail: `Apenas ${((adsAgg.ic / adsAgg.lp_views) * 100).toFixed(1)}% das visitas iniciam checkout. Copy/oferta da LP precisa de revisão.` });
    }
    if (adsAgg.compras > 0 && adsAgg.ic > adsAgg.compras * 3) {
      items.push({ severity: "warn", title: "Checkout abandonado", detail: `${adsAgg.ic.toLocaleString()} checkouts iniciados vs ${adsAgg.compras.toLocaleString()} compras — fricção no checkout.` });
    }
    if (adsAgg.freq && adsAgg.freq > 4) {
      items.push({ severity: "warn", title: "Audiência saturada", detail: `Frequência média ${adsAgg.freq.toFixed(2)} — público está vendo o mesmo anúncio várias vezes.` });
    }
    if (!items.length && adsAgg.impressoes > 0) {
      items.push({ severity: "ok", title: "Sem gargalos críticos", detail: "Funil dentro de parâmetros saudáveis no período." });
    }
    return items;
  }, [adsAgg, adsRows]);

  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtNum = (v: number) => v.toLocaleString("pt-BR");

  function semaforo(metric: "hook" | "hold" | "ctr" | "freq", v: number) {
    if (metric === "hook") return v >= 35 ? "ok" : v >= 25 ? "warn" : "bad";
    if (metric === "hold") return v >= 20 ? "ok" : v >= 12 ? "warn" : "bad";
    if (metric === "ctr") return v >= 1.5 ? "ok" : v >= 0.8 ? "warn" : "bad";
    if (metric === "freq") return v <= 2 ? "ok" : v <= 4 ? "warn" : "bad";
    return "ok";
  }
  const semColor = (s: string) =>
    s === "ok" ? "text-emerald-400" : s === "warn" ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* ===================== AUDIÊNCIA ===================== */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Insights de Audiência
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={source} onValueChange={(v) => setSource(v as any)}>
              <TabsList className="h-7">
                <TabsTrigger value="vendas" className="text-xs h-6">Vendas</TabsTrigger>
                <TabsTrigger value="leads" className="text-xs h-6">Leads</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PRODUCTS}>Todos os produtos</SelectItem>
                {produtos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
                <SelectItem value="180d">6 meses</SelectItem>
                <SelectItem value="365d">12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando insights...
            </div>
          ) : totalRecords === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem dados de {source === "vendas" ? "vendas" : "leads"} no período para gerar insights.
            </p>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="p-3 rounded-md bg-secondary/40 border border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Registros</p>
                  <p className="text-xl font-bold text-foreground">{fmtNum(totalRecords)}</p>
                </div>
                {source === "vendas" && (
                  <>
                    <div className="p-3 rounded-md bg-secondary/40 border border-border">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faturado</p>
                      <p className="text-xl font-bold text-primary">{fmtMoney(insights.totalValor)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-secondary/40 border border-border">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticket médio</p>
                      <p className="text-xl font-bold text-foreground">{fmtMoney(insights.ticketMedio)}</p>
                    </div>
                  </>
                )}
                <div className="p-3 rounded-md bg-secondary/40 border border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Melhor janela</p>
                  <p className="text-sm font-bold text-foreground">{DAYS[insights.peakDay]} · {String(insights.peakHour).padStart(2, "0")}h</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Heatmap horário 2 linhas (AM/PM) */}
                <div className="space-y-2 p-4 rounded-md bg-secondary/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Horários de Pico (BRT)</h3>
                    <div className="ml-auto flex gap-1">
                      {insights.hourRanking.map((x, i) => (
                        <Badge key={x.h} variant={i === 0 ? "default" : "outline"} className="text-[10px]">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {String(x.h).padStart(2, "0")}h
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {[0, 1].map(row => (
                    <div key={row}>
                      <p className="text-[9px] text-muted-foreground mb-0.5">{row === 0 ? "AM (00–11h)" : "PM (12–23h)"}</p>
                      <div className="grid grid-cols-12 gap-0.5">
                        {insights.hourly.slice(row * 12, row * 12 + 12).map((v, idx) => {
                          const h = row * 12 + idx;
                          const intensity = v / maxHour;
                          const isTop = insights.hourRanking.find(x => x.h === h);
                          return (
                            <div
                              key={h}
                              className={`aspect-square rounded-sm border flex items-center justify-center relative ${isTop ? "border-primary" : "border-border/40"}`}
                              style={{ background: `hsl(var(--primary) / ${0.08 + intensity * 0.85})` }}
                              title={`${String(h).padStart(2, "0")}h: ${v} ${source === "vendas" ? `vendas · ${fmtMoney(insights.hourlyValor[h])}` : "leads"}`}
                            >
                              <span className="text-[8px] font-bold text-foreground/70">{h}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dias da semana */}
                <div className="space-y-2 p-4 rounded-md bg-secondary/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Dias da Semana</h3>
                    <Badge variant="outline" className="ml-auto text-[10px]">Melhor: {DAYS[insights.peakDay]}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {insights.weekday.map((v, w) => (
                      <div key={w} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10">{DAYS[w]}</span>
                        <div className="flex-1 h-5 rounded bg-secondary relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 transition-all"
                            style={{
                              width: `${(v / maxDay) * 100}%`,
                              background: "linear-gradient(90deg, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.9))",
                            }}
                          />
                          <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium gap-2">
                            {source === "vendas" && insights.weekdayValor[w] > 0 && (
                              <span className="text-primary/90">{fmtMoney(insights.weekdayValor[w])}</span>
                            )}
                            <span>{v}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gênero — donut */}
                <div className="space-y-2 p-4 rounded-md bg-secondary/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Gênero</h3>
                    <Badge variant="outline" className="ml-auto text-[10px]">Inferido por nome</Badge>
                  </div>
                  <div className="flex items-center justify-center gap-6 py-2">
                    <Donut
                      f={insights.gender.F} m={insights.gender.M} u={insights.gender.U}
                      total={insights.totalGender}
                    />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-pink-500"/> <span className="text-pink-400 font-bold w-10">{insights.gender.F}</span> Feminino · {Math.round((insights.gender.F / insights.totalGender) * 100)}%</div>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"/> <span className="text-blue-400 font-bold w-10">{insights.gender.M}</span> Masculino · {Math.round((insights.gender.M / insights.totalGender) * 100)}%</div>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground"/> <span className="text-muted-foreground font-bold w-10">{insights.gender.U}</span> N/D · {Math.round((insights.gender.U / insights.totalGender) * 100)}%</div>
                    </div>
                  </div>
                </div>

                {/* Faixa Etária + UFs */}
                <div className="space-y-2 p-4 rounded-md bg-secondary/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Cake className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Faixa Etária</h3>
                  </div>
                  {(() => {
                    const ageEntries = Object.entries(insights.ageBuckets).filter(([k, v]) => k !== "?" && v > 0);
                    const total = ageEntries.reduce((a, [, v]) => a + v, 0);
                    const maxBucket = Math.max(1, ...ageEntries.map(([, v]) => v));
                    if (!ageEntries.length) return <p className="text-[10px] text-muted-foreground italic">Sem dados de idade.</p>;
                    return (
                      <div className="space-y-1">
                        {ageEntries.map(([range, v]) => {
                          const pct = total > 0 ? (v / total) * 100 : 0;
                          const isMax = v === maxBucket;
                          return (
                            <div key={range} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-12">{range}</span>
                              <div className="flex-1 h-4 rounded bg-secondary relative overflow-hidden">
                                <div className={`absolute inset-y-0 left-0 ${isMax ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] w-20 text-right tabular-nums">{v} · {pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {insights.ageBuckets["?"] > 0 && (
                    <p className="text-[10px] text-muted-foreground italic">{insights.ageBuckets["?"]} sem data de nascimento.</p>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Top 10 Estados (DDD)</h3>
                  </div>
                  {insights.topUFs.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">Sem telefones com DDD válido.</p>
                  ) : (
                    <div className="space-y-1 pt-1">
                      {insights.topUFs.map(([uf, n]) => {
                        const pct = (n / maxUF) * 100;
                        return (
                          <div key={uf} className="flex items-center gap-2">
                            <span className="text-xs w-14 flex items-center gap-1">
                              <span>{UF_REGION_EMOJI[uf] || "📍"}</span>
                              <span className="font-bold">{uf}</span>
                            </span>
                            <div className="flex-1 h-3.5 rounded bg-secondary relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-primary/70" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] w-10 text-right tabular-nums">{n}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===================== ADS — FUNIL DE TRÁFEGO ===================== */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Activity className="h-4 w-4" /> Insights de Ads — Funil de Tráfego
            {produto !== ALL_PRODUCTS && (
              <Badge variant="outline" className="ml-2 text-[10px] normal-case">Filtro: {produto}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {adsLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando ads...
            </div>
          ) : adsRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum dado de Ads para este projeto/período{produto !== ALL_PRODUCTS ? " com esse produto" : ""}.
            </p>
          ) : (
            <>
              {/* KPIs auxiliares */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <KpiBox label="Investido" value={fmtMoney(adsAgg.spend)} icon={<DollarSign className="h-3 w-3" />} />
                <KpiBox label="CTR médio" value={`${adsAgg.ctr.toFixed(2)}%`} color={semColor(semaforo("ctr", adsAgg.ctr))} />
                <KpiBox label="CPM" value={fmtMoney(adsAgg.cpm)} />
                <KpiBox label="Hook Rate" value={`${adsAgg.hook.toFixed(1)}%`} color={semColor(semaforo("hook", adsAgg.hook))} />
                <KpiBox label="Hold Rate" value={`${adsAgg.hold.toFixed(1)}%`} color={semColor(semaforo("hold", adsAgg.hold))} />
                <KpiBox label="Frequência" value={adsAgg.freq.toFixed(2)} color={semColor(semaforo("freq", adsAgg.freq))} />
              </div>

              {/* Detector de lentidão — alerta destacado */}
              {adsAgg.linkClicks > 0 && adsAgg.lp_views > 0 && adsAgg.clickToLpRatio > 1.4 && (
                <div className="p-4 rounded-md border-2 border-red-500/60 bg-red-500/10 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-300">Lentidão Detectada na Landing Page</p>
                    <p className="text-xs text-red-200/80 mt-1">
                      Razão cliques/LP = <strong>{adsAgg.clickToLpRatio.toFixed(2)}x</strong> — apenas {((adsAgg.lp_views / adsAgg.linkClicks) * 100).toFixed(0)}% dos cliques chegam à página ({fmtNum(adsAgg.linkClicks)} cliques → {fmtNum(adsAgg.lp_views)} views).
                      <br /><span className="opacity-70">Sugestão: rode PageSpeed Insights, valide redirects/pixel e otimize Core Web Vitals.</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Funil horizontal */}
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" /> Funil de conversão (etapa → próxima)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {funnelSteps.map((step) => {
                    const dropBad = step.drop != null && step.drop > 70;
                    return (
                      <div key={step.key} className="p-3 rounded-md bg-secondary/40 border border-border relative">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>{step.icon}</span> {step.label}
                        </div>
                        <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{fmtNum(step.value)}</p>
                        {step.conv != null && (
                          <p className={`text-[10px] mt-0.5 ${dropBad ? "text-red-400" : "text-emerald-400"}`}>
                            {step.conv.toFixed(1)}% da etapa anterior
                            {dropBad && <span className="block text-red-300/80">⚠ drop {step.drop?.toFixed(0)}%</span>}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Diagnósticos */}
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" /> Diagnóstico automático
                </h3>
                <div className="space-y-2">
                  {diagnostics.map((d, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-md border flex items-start gap-2 ${
                        d.severity === "danger" ? "border-red-500/40 bg-red-500/5" :
                        d.severity === "warn" ? "border-amber-500/40 bg-amber-500/5" :
                        "border-emerald-500/40 bg-emerald-500/5"
                      }`}
                    >
                      {d.severity === "danger" ? <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" /> :
                       d.severity === "warn" ? <TrendingDown className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" /> :
                       <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />}
                      <div>
                        <p className={`text-sm font-semibold ${
                          d.severity === "danger" ? "text-red-300" :
                          d.severity === "warn" ? "text-amber-300" : "text-emerald-300"
                        }`}>{d.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Subcomponentes =====
function KpiBox({ label, value, icon, color }: { label: string; value: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="p-2.5 rounded-md bg-secondary/40 border border-border">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</p>
      <p className={`text-base font-bold tabular-nums ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Donut({ f, m, u, total }: { f: number; m: number; u: number; total: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const fLen = (f / total) * c;
  const mLen = (m / total) * c;
  const uLen = (u / total) * c;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="14" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(236 72 153 / 0.85)" strokeWidth="14"
        strokeDasharray={`${fLen} ${c - fLen}`} strokeDashoffset="0" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(59 130 246 / 0.85)" strokeWidth="14"
        strokeDasharray={`${mLen} ${c - mLen}`} strokeDashoffset={`-${fLen}`} />
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="14"
        strokeDasharray={`${uLen} ${c - uLen}`} strokeDashoffset={`-${fLen + mLen}`} />
      <text x="50" y="54" textAnchor="middle" className="rotate-90 origin-center" style={{ fontSize: 14, fill: "hsl(var(--foreground))", fontWeight: 700, transform: "rotate(90deg)", transformOrigin: "50px 50px" }}>
        {total}
      </text>
    </svg>
  );
}

function calcAge(birth?: string): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
}

// Mapa DDD → UF (Brasil)
const DDD_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF", "62": "GO", "64": "GO", "63": "TO", "65": "MT", "66": "MT", "67": "MS",
  "68": "AC", "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL", "83": "PB", "84": "RN", "85": "CE", "88": "CE", "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR", "96": "AP", "98": "MA", "99": "MA",
};
