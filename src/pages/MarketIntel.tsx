import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, TrendingUp, Target, Zap, ShoppingCart, Sparkles, Heart, Brain, Leaf, PawPrint, Users, Star } from "lucide-react";
import { NICHE_OFFERS, MARKETING_ANGLES, OFFER_FACTORY, UNIQUE_NICHOS } from "@/data/marketIntelData";

const NICHO_COLORS: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  "Saúde": { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", icon: Heart },
  "Espiritualidade": { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30", icon: Sparkles },
  "Relacionamento": { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30", icon: Users },
  "Pets": { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", icon: PawPrint },
  "Bem-estar": { bg: "bg-teal-500/15", text: "text-teal-400", border: "border-teal-500/30", icon: Leaf },
  "Desenvolvimento Pessoal": { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", icon: Brain },
  "Finanças": { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30", icon: TrendingUp },
};

const getnichoStyle = (nicho: string) => {
  for (const [key, val] of Object.entries(NICHO_COLORS)) {
    if (nicho.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", icon: Star };
};

const ANGLE_COLORS = [
  "from-blue-500/20 to-cyan-500/20",
  "from-purple-500/20 to-pink-500/20",
  "from-emerald-500/20 to-teal-500/20",
  "from-orange-500/20 to-amber-500/20",
  "from-rose-500/20 to-red-500/20",
  "from-indigo-500/20 to-violet-500/20",
];

export default function MarketIntel() {
  const [opps, setOpps] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [nichoFilter, setNichoFilter] = useState("all");

  useEffect(() => {
    supabase.from("imphq_mi_opportunities").select("*").order("score", { ascending: false }).then(({ data }) => setOpps(data || []));
  }, []);

  const filteredOffers = NICHE_OFFERS.filter((o) => {
    const matchSearch = o.nomeOferta.toLowerCase().includes(search.toLowerCase()) ||
      o.microNicho.toLowerCase().includes(search.toLowerCase()) ||
      o.dorCentral.toLowerCase().includes(search.toLowerCase());
    const matchNicho = nichoFilter === "all" || o.nicho === nichoFilter;
    return matchSearch && matchNicho;
  });

  const filteredOpps = opps.filter((o) =>
    o.nicho?.toLowerCase().includes(search.toLowerCase()) ||
    o.produto?.toLowerCase().includes(search.toLowerCase())
  );

  const avgScore = NICHE_OFFERS.length > 0 ? (NICHE_OFFERS.reduce((s, o) => s + o.score, 0) / NICHE_OFFERS.length).toFixed(1) : "0";
  const topNicho = UNIQUE_NICHOS[0] || "—";
  const semRostoCount = NICHE_OFFERS.filter(o => o.semAparecer.includes("100")).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-display text-3xl font-bold text-primary">🧠 Market Intel</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Ofertas", value: NICHE_OFFERS.length, gradient: "from-emerald-500/10 to-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400" },
          { label: "Média Score", value: avgScore, gradient: "from-violet-500/10 to-violet-500/5", border: "border-violet-500/20", text: "text-violet-400" },
          { label: "Top Nicho", value: topNicho, gradient: "from-pink-500/10 to-pink-500/5", border: "border-pink-500/20", text: "text-pink-400", isText: true },
          { label: "100% Sem Rosto", value: semRostoCount, gradient: "from-amber-500/10 to-amber-500/5", border: "border-amber-500/20", text: "text-amber-400" },
        ].map((s, i) => (
          <Card key={s.label} className={`bg-gradient-to-br ${s.gradient} ${s.border} hover:scale-[1.03] transition-all duration-200 animate-fade-in`} style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
            <CardContent className="p-4">
              <p className={`text-xs ${s.text} mb-1`}>{s.label}</p>
              <p className={`${s.isText ? "text-lg" : "text-2xl"} font-bold font-mono ${s.text} truncate`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="nichos" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="nichos"><Target className="h-3.5 w-3.5 mr-1" /> Mapa de Nichos</TabsTrigger>
          <TabsTrigger value="angulos"><Zap className="h-3.5 w-3.5 mr-1" /> Ângulos de Copy</TabsTrigger>
          <TabsTrigger value="fabrica"><ShoppingCart className="h-3.5 w-3.5 mr-1" /> Fábrica de Ofertas</TabsTrigger>
          <TabsTrigger value="db"><TrendingUp className="h-3.5 w-3.5 mr-1" /> Oportunidades DB</TabsTrigger>
        </TabsList>

        {/* TAB 1: Mapa de Nichos */}
        <TabsContent value="nichos" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar oferta, micro-nicho ou dor..." className="pl-9 bg-secondary" />
            </div>
            <Select value={nichoFilter} onValueChange={setNichoFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar nicho" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Nichos</SelectItem>
                {UNIQUE_NICHOS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">{filteredOffers.length} ofertas</Badge>
          </div>

          <div className="rounded-lg border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Nicho</TableHead>
                  <TableHead className="min-w-[120px]">Micro-Nicho</TableHead>
                  <TableHead className="min-w-[140px]">Dor Central</TableHead>
                  <TableHead className="min-w-[160px]">Oferta</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead className="min-w-[140px]">Bump</TableHead>
                  <TableHead className="min-w-[140px]">Upsell</TableHead>
                  <TableHead>Sem Rosto?</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffers.map((o, i) => {
                  const ns = getnichoStyle(o.nicho);
                  const NichoIcon = ns.icon;
                  return (
                    <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${ns.bg} ${ns.text} ${ns.border}`}>
                          <NichoIcon className="h-2.5 w-2.5 mr-1" />{o.nicho}
                        </Badge>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{o.subNicho}</p>
                      </TableCell>
                      <TableCell className="text-xs">{o.microNicho}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{o.dorCentral}</TableCell>
                      <TableCell className="text-xs font-medium">{o.nomeOferta}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">{o.ticket}</Badge></TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{o.bump}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{o.upsell}</TableCell>
                      <TableCell>
                        <Badge variant={o.semAparecer.includes("100") ? "default" : "secondary"}
                          className={o.semAparecer.includes("100") ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]" : "text-[9px]"}>
                          {o.semAparecer}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-lg font-mono font-bold ${o.score >= 9.5 ? "text-emerald-400" : o.score >= 9.0 ? "text-amber-400" : "text-muted-foreground"}`}>
                            {o.score}
                          </span>
                          <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${o.score >= 9.5 ? "bg-emerald-400" : o.score >= 9.0 ? "bg-amber-400" : "bg-muted-foreground"}`} style={{ width: `${(o.score / 10) * 100}%` }} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 2: Ângulos de Copy */}
        <TabsContent value="angulos" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-muted-foreground">Baseado em: PAS, BAB, AIDA, Star-Story, Cialdini, Gary Halbert, Eugene Schwartz</p>
            <Badge variant="outline" className="text-xs">{filteredAngles.length} de {MARKETING_ANGLES.length} ângulos</Badge>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={angleSearch} onChange={(e) => setAngleSearch(e.target.value)} placeholder="Buscar ângulo, gatilho ou nicho..." className="pl-9 bg-secondary" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAngles.map((a, i) => (
              <Card key={i} className={`bg-gradient-to-br ${ANGLE_COLORS[i % ANGLE_COLORS.length]} border-border hover:border-primary/30 hover:scale-[1.01] transition-all duration-200 animate-fade-in`} style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{a.angulo}</h3>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]">CTR {a.ctrEsperado}</Badge>
                      <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[9px]">Conv {a.convEsperada}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.logica}</p>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gatilho</p>
                    <p className="text-xs">{a.gatilho}</p>
                  </div>
                  <div className="bg-card/50 rounded-lg p-3 border border-border">
                    <p className="text-[10px] text-primary uppercase font-bold tracking-wider mb-1">Hook (3s)</p>
                    <p className="text-sm italic text-primary font-medium">{a.hookPronto}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Headline VSL</p>
                    <p className="text-xs italic">{a.headlineVSL}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">{a.quandoUsar}</Badge>
                    <Badge variant="secondary" className="text-[9px] bg-pink-500/10 text-pink-400 border-pink-500/20">{a.nichoConverte}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: Fábrica de Ofertas */}
        <TabsContent value="fabrica" className="space-y-4">
          <p className="text-sm text-muted-foreground">Estrutura completa para criar em 7 dias — Produto + bump + upsell + como criar sem aparecer</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {OFFER_FACTORY.map((o, i) => {
              const tempoColors = o.tempoCriacao.includes("3") ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : o.tempoCriacao.includes("5") ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-red-500/15 text-red-400 border-red-500/30";
              return (
                <Card key={i} className="bg-card border-border hover:border-primary/20 hover:scale-[1.01] transition-all duration-200 animate-fade-in" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{o.oferta}</h3>
                      <Badge variant="outline" className={`text-[9px] ${tempoColors}`}>{o.tempoCriacao}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{o.promessa}</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div><span className="text-muted-foreground">Formato:</span> <span>{o.formato}</span></div>
                      <div><span className="text-muted-foreground">Plataforma:</span> <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">{o.plataforma}</Badge></div>
                    </div>
                    <div className="text-[10px]"><span className="text-muted-foreground">Sem aparecer:</span> <span className="text-emerald-400">{o.comoSemAparecer}</span></div>
                    <div className="text-[10px]"><span className="text-muted-foreground">Ferramentas:</span> <span>{o.ferramentas}</span></div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">{o.ticket}</Badge>
                      {o.bump && <Badge variant="outline" className="text-[9px]">Bump: {o.bump}</Badge>}
                      {o.upsell && <Badge variant="outline" className="text-[9px]">Up: {o.upsell}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 4: Oportunidades DB */}
        <TabsContent value="db" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por nicho..." className="pl-9 bg-secondary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpps.map((o, i) => {
              const ns = getnichoStyle(o.nicho || "");
              return (
                <Card key={o.id} className={`border-border hover:border-primary/30 hover:scale-[1.02] transition-all duration-200 bg-gradient-to-br ${ns.bg.replace('bg-', 'from-')} to-transparent animate-fade-in`} style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{o.produto}</h3>
                        <p className="text-xs text-muted-foreground">{o.nicho} → {o.sub_nicho}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-mono font-bold ${o.score >= 9 ? "text-emerald-400" : "text-primary"}`}>{o.score}</span>
                        <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${o.score >= 9 ? "bg-emerald-400" : "bg-primary"}`} style={{ width: `${(o.score / 10) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {o.ticket && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">R$ {o.ticket}</Badge>}
                      {o.plataforma && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">{o.plataforma}</Badge>}
                      {o.sem_rosto && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Sem rosto</Badge>}
                    </div>
                    {o.flags && Array.isArray(o.flags) && o.flags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {o.flags.map((f: string, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{f}</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {filteredOpps.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma oportunidade no banco de dados</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
