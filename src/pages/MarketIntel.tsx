import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, TrendingUp, Target, Zap, ShoppingCart } from "lucide-react";
import { NICHE_OFFERS, MARKETING_ANGLES, OFFER_FACTORY, UNIQUE_NICHOS } from "@/data/marketIntelData";

export default function MarketIntel() {
  const [opps, setOpps] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [nichoFilter, setNichoFilter] = useState("all");

  useEffect(() => {
    supabase.from("imphq_mi_opportunities").select("*").order("score", { ascending: false }).then(({ data }) => setOpps(data || []));
  }, []);

  // Niche offers filtering
  const filteredOffers = NICHE_OFFERS.filter((o) => {
    const matchSearch = o.nomeOferta.toLowerCase().includes(search.toLowerCase()) ||
      o.microNicho.toLowerCase().includes(search.toLowerCase()) ||
      o.dorCentral.toLowerCase().includes(search.toLowerCase());
    const matchNicho = nichoFilter === "all" || o.nicho === nichoFilter;
    return matchSearch && matchNicho;
  });

  // Supabase opps filtering
  const filteredOpps = opps.filter((o) =>
    o.nicho?.toLowerCase().includes(search.toLowerCase()) ||
    o.produto?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">🧠 Market Intel</h1>

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
                  <TableHead className="min-w-[140px]">Nano-Nicho</TableHead>
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
                {filteredOffers.map((o, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="text-xs font-medium">{o.nicho}</span>
                      <p className="text-[10px] text-muted-foreground">{o.subNicho}</p>
                    </TableCell>
                    <TableCell className="text-xs">{o.microNicho}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.nanoNicho}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.dorCentral}</TableCell>
                    <TableCell className="text-xs font-medium">{o.nomeOferta}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-mono">{o.ticket}</Badge></TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{o.bump}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{o.upsell}</TableCell>
                    <TableCell>
                      <Badge variant={o.semAparecer.includes("100") ? "default" : "secondary"} className="text-[9px]">
                        {o.semAparecer}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-lg font-mono font-bold ${o.score >= 9.5 ? "text-emerald-400" : o.score >= 9.0 ? "text-primary" : "text-muted-foreground"}`}>
                        {o.score}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 2: Ângulos de Copy */}
        <TabsContent value="angulos" className="space-y-4">
          <p className="text-sm text-muted-foreground">Baseado em: PAS, BAB, AIDA, Star-Story, Cialdini, Gary Halbert, Eugene Schwartz — aplicados ao mercado BR 2025/26</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {MARKETING_ANGLES.map((a, i) => (
              <Card key={i} className="bg-card border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">{a.angulo}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-mono">CTR {a.ctrEsperado}</Badge>
                      <Badge variant="outline" className="text-[9px] font-mono">Conv {a.convEsperada}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.logica}</p>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Gatilho</p>
                    <p className="text-xs">{a.gatilho}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Hook (3s)</p>
                    <p className="text-xs italic text-primary">{a.hookPronto}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Headline VSL</p>
                    <p className="text-xs italic">{a.headlineVSL}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[9px]">{a.quandoUsar}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{a.nichoConverte}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: Fábrica de Ofertas */}
        <TabsContent value="fabrica" className="space-y-4">
          <p className="text-sm text-muted-foreground">Estrutura completa para criar em 7 dias — Produto + bump + upsell + como criar sem aparecer</p>
          <div className="rounded-lg border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Oferta</TableHead>
                  <TableHead className="min-w-[140px]">Promessa</TableHead>
                  <TableHead className="min-w-[120px]">Formato</TableHead>
                  <TableHead className="min-w-[140px]">Sem Aparecer</TableHead>
                  <TableHead className="min-w-[120px]">Ferramentas</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead className="min-w-[120px]">Bump</TableHead>
                  <TableHead className="min-w-[120px]">Upsell</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {OFFER_FACTORY.map((o, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{o.oferta}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.promessa}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.formato}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.comoSemAparecer}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{o.ferramentas}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px]">{o.tempoCriacao}</Badge></TableCell>
                    <TableCell className="text-xs">{o.plataforma}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-mono">{o.ticket}</Badge></TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{o.bump}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{o.upsell}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 4: Oportunidades do DB */}
        <TabsContent value="db" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por nicho..." className="pl-9 bg-secondary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpps.map((o) => (
              <Card key={o.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{o.produto}</h3>
                      <p className="text-xs text-muted-foreground">{o.nicho} → {o.sub_nicho}</p>
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-lg font-mono font-bold">{o.score}</span>
                    </div>
                  </div>
                  {o.micro_nicho && <p className="text-xs text-muted-foreground">Micro: {o.micro_nicho}</p>}
                  <div className="flex gap-2 flex-wrap">
                    {o.ticket && <Badge variant="outline" className="text-[10px]">R$ {o.ticket}</Badge>}
                    {o.plataforma && <Badge variant="outline" className="text-[10px]">{o.plataforma}</Badge>}
                    {o.sem_rosto && <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-400">Sem rosto</Badge>}
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
            ))}
            {filteredOpps.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma oportunidade no banco de dados</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
