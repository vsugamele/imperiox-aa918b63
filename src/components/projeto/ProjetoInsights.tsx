import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Users, MapPin, Cake, Sparkles, Loader2 } from "lucide-react";
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
  // Regra de fallback: terminado em 'a' = F (acurácia ~75% em pt-BR)
  if (first.endsWith("a")) return "F";
  if (first.endsWith("o") || first.endsWith("r") || first.endsWith("l")) return "M";
  return null;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Props { projectId: string }

export function ProjetoInsights({ projectId }: Props) {
  const [period, setPeriod] = useState("90d");
  const [source, setSource] = useState<"vendas" | "leads">("vendas");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      const days = period === "30d" ? 30 : period === "90d" ? 90 : period === "180d" ? 180 : 365;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      if (source === "vendas") {
        // Vendas aprovadas com lead_id para cruzar com gênero/uf
        const { data } = await supabase
          .from("imphq_vendas")
          .select("created_at, valor, lead_id")
          .eq("project_id", projectId)
          .eq("status", "aprovado")
          .gte("created_at", since)
          .limit(5000);
        const vendas = data ?? [];
        const leadIds = [...new Set(vendas.map(v => v.lead_id).filter(Boolean))] as string[];
        let leadsMap = new Map<string, any>();
        if (leadIds.length) {
          const { data: leads } = await supabase
            .from("imphq_leads")
            .select("id, nome, genero, phone, data")
            .in("id", leadIds);
          (leads ?? []).forEach(l => leadsMap.set(l.id, l));
        }
        if (cancel) return;
        setRows(vendas.map(v => ({
          ts: v.created_at,
          valor: Number(v.valor || 0),
          lead: leadsMap.get(v.lead_id),
        })));
      } else {
        const { data } = await supabase
          .from("imphq_leads")
          .select("criado_em, nome, genero, phone, data")
          .eq("project_id", projectId)
          .gte("criado_em", since)
          .limit(5000);
        if (cancel) return;
        setRows((data ?? []).map(l => ({ ts: l.criado_em, lead: l })));
      }
      setLoading(false);
    }
    load();
    return () => { cancel = true; };
  }, [projectId, period, source]);

  // ===== Agregações =====
  const insights = useMemo(() => {
    const hourly = new Array(24).fill(0);
    const hourlyValor = new Array(24).fill(0);
    const weekday = new Array(7).fill(0);
    const weekdayValor = new Array(7).fill(0);
    const gender = { M: 0, F: 0, U: 0 };
    const ufCount: Record<string, number> = {};
    const ageBuckets: Record<string, number> = { "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "?": 0 };

    rows.forEach(r => {
      const d = new Date(r.ts);
      // Converter para BRT (-3)
      const local = new Date(d.getTime() - 3 * 3600000);
      const h = local.getUTCHours();
      const w = local.getUTCDay();
      hourly[h]++;
      weekday[w]++;
      if (r.valor) {
        hourlyValor[h] += r.valor;
        weekdayValor[w] += r.valor;
      }
      const lead = r.lead;
      const g = lead?.genero || inferGender(lead?.nome);
      if (g === "M") gender.M++;
      else if (g === "F") gender.F++;
      else gender.U++;

      // UF via DDD do telefone
      const phone = (lead?.phone || "").replace(/\D/g, "");
      const ddd = phone.startsWith("55") ? phone.slice(2, 4) : phone.slice(0, 2);
      const uf = DDD_UF[ddd];
      if (uf) ufCount[uf] = (ufCount[uf] || 0) + 1;

      // Faixa etária via data.idade ou data.aniversario
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

    const peakHour = hourly.indexOf(Math.max(...hourly));
    const peakDay = weekday.indexOf(Math.max(...weekday));
    const totalGender = gender.M + gender.F + gender.U;
    const topUFs = Object.entries(ufCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { hourly, hourlyValor, weekday, weekdayValor, gender, ufCount, ageBuckets, peakHour, peakDay, totalGender, topUFs };
  }, [rows]);

  const maxHour = Math.max(1, ...insights.hourly);
  const maxDay = Math.max(1, ...insights.weekday);
  const totalRecords = rows.length;

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Insights de Audiência
          </CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={source} onValueChange={(v) => setSource(v as any)}>
              <TabsList className="h-7">
                <TabsTrigger value="vendas" className="text-xs h-6">Vendas</TabsTrigger>
                <TabsTrigger value="leads" className="text-xs h-6">Leads</TabsTrigger>
              </TabsList>
            </Tabs>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Heatmap horário */}
              <div className="space-y-2 p-4 rounded-md bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Horários de Pico (BRT)</h3>
                  <Badge variant="outline" className="ml-auto text-[10px]">Pico: {String(insights.peakHour).padStart(2, "0")}h</Badge>
                </div>
                <div className="grid grid-cols-12 gap-0.5">
                  {insights.hourly.map((v, h) => {
                    const intensity = v / maxHour;
                    return (
                      <div
                        key={h}
                        className="aspect-square rounded-sm border border-border/40 flex items-end justify-center relative group"
                        style={{ background: `hsl(var(--primary) / ${0.08 + intensity * 0.8})` }}
                        title={`${String(h).padStart(2, "0")}h: ${v} ${source === "vendas" ? "vendas" : "leads"}`}
                      >
                        <span className="text-[8px] text-muted-foreground absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100">{h}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground pt-1">
                  <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
                </div>
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
                          className="absolute inset-y-0 left-0 bg-primary/70 transition-all"
                          style={{ width: `${(v / maxDay) * 100}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium">{v}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gênero */}
              <div className="space-y-2 p-4 rounded-md bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Gênero</h3>
                  <Badge variant="outline" className="ml-auto text-[10px]">Inferido por nome</Badge>
                </div>
                <div className="flex items-center gap-2 h-8 rounded overflow-hidden border border-border">
                  {insights.gender.F > 0 && (
                    <div className="h-full flex items-center justify-center text-[10px] font-bold text-background bg-pink-500/80" style={{ width: `${(insights.gender.F / insights.totalGender) * 100}%` }}>
                      F {Math.round((insights.gender.F / insights.totalGender) * 100)}%
                    </div>
                  )}
                  {insights.gender.M > 0 && (
                    <div className="h-full flex items-center justify-center text-[10px] font-bold text-background bg-blue-500/80" style={{ width: `${(insights.gender.M / insights.totalGender) * 100}%` }}>
                      M {Math.round((insights.gender.M / insights.totalGender) * 100)}%
                    </div>
                  )}
                  {insights.gender.U > 0 && (
                    <div className="h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-muted" style={{ width: `${(insights.gender.U / insights.totalGender) * 100}%` }}>
                      ? {Math.round((insights.gender.U / insights.totalGender) * 100)}%
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                  <div><span className="text-pink-400 font-bold">{insights.gender.F}</span> femininos</div>
                  <div><span className="text-blue-400 font-bold">{insights.gender.M}</span> masculinos</div>
                  <div><span className="text-muted-foreground font-bold">{insights.gender.U}</span> indefinidos</div>
                </div>
              </div>

              {/* Faixa Etária + UFs */}
              <div className="space-y-2 p-4 rounded-md bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <Cake className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Faixa Etária</h3>
                </div>
                <div className="space-y-1">
                  {Object.entries(insights.ageBuckets).filter(([k]) => k !== "?").map(([range, v]) => {
                    const total = Object.values(insights.ageBuckets).reduce((a, b) => a + b, 0) - insights.ageBuckets["?"];
                    const pct = total > 0 ? (v / total) * 100 : 0;
                    return (
                      <div key={range} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">{range}</span>
                        <div className="flex-1 h-4 rounded bg-secondary relative overflow-hidden">
                          <div className="absolute inset-y-0 left-0 bg-primary/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] w-10 text-right">{v}</span>
                      </div>
                    );
                  })}
                </div>
                {insights.ageBuckets["?"] > 0 && (
                  <p className="text-[10px] text-muted-foreground italic">{insights.ageBuckets["?"]} sem data de nascimento cadastrada.</p>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Top Estados (DDD)</h3>
                </div>
                {insights.topUFs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Sem telefones com DDD válido.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {insights.topUFs.map(([uf, n]) => (
                      <Badge key={uf} variant="secondary" className="text-[10px]">{uf} <span className="ml-1 text-primary font-bold">{n}</span></Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
