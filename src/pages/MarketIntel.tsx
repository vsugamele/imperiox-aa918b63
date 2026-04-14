import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, TrendingUp, Target, Zap, ShoppingCart, Sparkles, Heart, Brain, Leaf, PawPrint, Users, Star, Download, StarIcon, FileText, Swords } from "lucide-react";
import { NICHE_OFFERS, MARKETING_ANGLES, OFFER_FACTORY, UNIQUE_NICHOS } from "@/data/marketIntelData";
import { AIGenerateButton } from "@/components/projeto/AIGenerateButton";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

// CSV export helper
function downloadCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function MarketIntel() {
  const { user } = useAuth();
  const [opps, setOpps] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [nichoFilter, setNichoFilter] = useState("all");
  const [angleSearch, setAngleSearch] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [aiResult, setAiResult] = useState<string>("");
  const [aiIntelData, setAiIntelData] = useState<any>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("nichos");
  const [searchQuery, setSearchQuery] = useState("");

  // Load data
  useEffect(() => {
    supabase.from("imphq_projects").select("id, name, data").order("name").then(({ data }) => setProjects(data || []));
    supabase.from("imphq_mi_opportunities").select("*").order("score", { ascending: false }).then(({ data }) => setOpps(data || []));
  }, []);

  // Load favorites
  useEffect(() => {
    if (!user) return;
    supabase.from("imphq_mi_favorites").select("tipo, item_key").eq("user_id", user.id).then(({ data }) => {
      if (data) setFavorites(new Set(data.map(f => `${f.tipo}:${f.item_key}`)));
    });
  }, [user]);

  // Load AI result from project data
  useEffect(() => {
    if (!selectedProject) { setAiResult(""); setCompetitors([]); return; }
    const proj = projects.find(p => p.id === selectedProject);
    if (proj?.data?.ai_market_intel) setAiResult(proj.data.ai_market_intel);
    else setAiResult("");
    // Load competitors for integration
    supabase.from("imphq_competitors").select("*").eq("project_id", selectedProject).then(({ data }) => setCompetitors(data || []));
  }, [selectedProject, projects]);

  // Toggle favorite
  const toggleFav = async (tipo: string, itemKey: string) => {
    if (!user) return;
    const key = `${tipo}:${itemKey}`;
    if (favorites.has(key)) {
      await supabase.from("imphq_mi_favorites").delete().eq("user_id", user.id).eq("tipo", tipo).eq("item_key", itemKey);
      setFavorites(prev => { const n = new Set(prev); n.delete(key); return n; });
    } else {
      await supabase.from("imphq_mi_favorites").insert({ user_id: user.id, tipo, item_key: itemKey, project_id: selectedProject || null });
      setFavorites(prev => new Set(prev).add(key));
    }
  };

  const isFav = (tipo: string, key: string) => favorites.has(`${tipo}:${key}`);

  // Save AI result persistently
  const handleAiResult = async (data: any) => {
    const result = data?.result || "";
    setAiResult(result);
    if (selectedProject && result) {
      const proj = projects.find(p => p.id === selectedProject);
      const currentData = (proj?.data as Record<string, any>) || {};
      await supabase.from("imphq_projects").update({ data: { ...currentData, ai_market_intel: result } }).eq("id", selectedProject);
      toast.success("Resultado da IA salvo no projeto!");
    }
  };

  // Filters
  const filteredOffers = useMemo(() => {
    let items = NICHE_OFFERS.filter((o) => {
      const matchSearch = o.nomeOferta.toLowerCase().includes(search.toLowerCase()) ||
        o.microNicho.toLowerCase().includes(search.toLowerCase()) ||
        o.dorCentral.toLowerCase().includes(search.toLowerCase());
      const matchNicho = nichoFilter === "all" || o.nicho === nichoFilter;
      return matchSearch && matchNicho;
    });
    if (showFavsOnly) items = items.filter((_, i) => isFav("offer", String(i)));
    return items;
  }, [search, nichoFilter, showFavsOnly, favorites]);

  const filteredOpps = opps.filter((o) =>
    o.nicho?.toLowerCase().includes(search.toLowerCase()) ||
    o.produto?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAngles = useMemo(() => {
    let items = MARKETING_ANGLES.filter((a) => {
      if (!angleSearch) return true;
      const q = angleSearch.toLowerCase();
      return a.angulo.toLowerCase().includes(q) || a.gatilho.toLowerCase().includes(q) || a.nichoConverte.toLowerCase().includes(q) || a.logica.toLowerCase().includes(q);
    });
    if (showFavsOnly) items = items.filter((_, i) => isFav("angle", String(i)));
    return items;
  }, [angleSearch, showFavsOnly, favorites]);

  const avgScore = NICHE_OFFERS.length > 0 ? (NICHE_OFFERS.reduce((s, o) => s + o.score, 0) / NICHE_OFFERS.length).toFixed(1) : "0";
  const topNicho = UNIQUE_NICHOS[0] || "—";
  const semRostoCount = NICHE_OFFERS.filter(o => o.semAparecer.includes("100")).length;

  // Export handlers
  const handleExport = () => {
    if (activeTab === "nichos") {
      downloadCSV(filteredOffers.map(o => ({ Nicho: o.nicho, SubNicho: o.subNicho, MicroNicho: o.microNicho, Dor: o.dorCentral, Oferta: o.nomeOferta, Ticket: o.ticket, Bump: o.bump, Upsell: o.upsell, SemRosto: o.semAparecer, Score: o.score })), "market-intel-nichos.csv");
    } else if (activeTab === "angulos") {
      downloadCSV(filteredAngles.map(a => ({ Angulo: a.angulo, Logica: a.logica, Gatilho: a.gatilho, NichoConverte: a.nichoConverte, Hook: a.hookPronto, HeadlineVSL: a.headlineVSL, QuandoUsar: a.quandoUsar, CTR: a.ctrEsperado, Conv: a.convEsperada })), "market-intel-angulos.csv");
    } else if (activeTab === "fabrica") {
      downloadCSV(OFFER_FACTORY.map(o => ({ Oferta: o.oferta, Promessa: o.promessa, Formato: o.formato, SemAparecer: o.comoSemAparecer, Ferramentas: o.ferramentas, Tempo: o.tempoCriacao, Plataforma: o.plataforma, Ticket: o.ticket, Bump: o.bump, Upsell: o.upsell })), "market-intel-fabrica.csv");
    } else if (activeTab === "db") {
      downloadCSV(filteredOpps.map(o => ({ Nicho: o.nicho, SubNicho: o.sub_nicho, Produto: o.produto, Score: o.score, Ticket: o.ticket, Plataforma: o.plataforma, SemRosto: o.sem_rosto })), "market-intel-oportunidades.csv");
    }
    toast.success("CSV exportado!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-primary">🧠 Market Intel</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px] bg-secondary">
              <SelectValue placeholder="Selecionar projeto..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <AIGenerateButton
            projectId={selectedProject}
            action="execute_skill"
            label="Pesquisa de Mercado"
            extraBody={{ skill_slug: "market-intel", mode: "DISCOVERY" }}
            onResult={handleAiResult}
            contextSources={["Briefing", "Avatar", "Concorrentes", "Produtos", "Vendas"]}
          />
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant={showFavsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavsOnly(!showFavsOnly)}
            className="gap-1"
          >
            <StarIcon className={`h-3.5 w-3.5 ${showFavsOnly ? "fill-current" : ""}`} />
            Favoritos
          </Button>
        </div>
      </div>

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                  <TableHead className="w-8">⭐</TableHead>
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
                  const origIndex = NICHE_OFFERS.indexOf(o);
                  const ns = getnichoStyle(o.nicho);
                  const NichoIcon = ns.icon;
                  return (
                    <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <button onClick={() => toggleFav("offer", String(origIndex))} className="hover:scale-125 transition-transform">
                          <StarIcon className={`h-4 w-4 ${isFav("offer", String(origIndex)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        </button>
                      </TableCell>
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
                {filteredOffers.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                    {showFavsOnly ? "Nenhuma oferta favorita encontrada" : "Nenhuma oferta encontrada"}
                  </TableCell></TableRow>
                )}
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
            {filteredAngles.map((a, i) => {
              const origIndex = MARKETING_ANGLES.indexOf(a);
              return (
                <Card key={i} className={`bg-gradient-to-br ${ANGLE_COLORS[i % ANGLE_COLORS.length]} border-border hover:border-primary/30 hover:scale-[1.01] transition-all duration-200 animate-fade-in`} style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleFav("angle", String(origIndex))} className="hover:scale-125 transition-transform">
                          <StarIcon className={`h-4 w-4 ${isFav("angle", String(origIndex)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        </button>
                        <h3 className="font-semibold text-sm">{a.angulo}</h3>
                      </div>
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
              );
            })}
            {filteredAngles.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
                {showFavsOnly ? "Nenhum ângulo favorito encontrado" : "Nenhum ângulo encontrado"}
              </p>
            )}
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
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleFav("factory", String(i))} className="hover:scale-125 transition-transform">
                          <StarIcon className={`h-4 w-4 ${isFav("factory", String(i)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        </button>
                        <h3 className="font-medium text-sm">{o.oferta}</h3>
                      </div>
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

        {/* TAB 4: Oportunidades DB + Concorrentes */}
        <TabsContent value="db" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por nicho..." className="pl-9 bg-secondary" />
          </div>

          {/* Concorrentes do projeto selecionado */}
          {selectedProject && competitors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Swords className="h-4 w-4 text-primary" /> Concorrentes do Projeto ({competitors.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {competitors.slice(0, 6).map((c) => (
                  <Card key={c.id} className="border-border bg-card/50 hover:border-primary/20 transition-all">
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        <Badge variant="outline" className="text-[9px]">{c.score_escala}/{c.score_max}</Badge>
                      </div>
                      {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate block">{c.url}</a>}
                      {c.ponto_forte && <p className="text-[10px] text-emerald-400">✓ {c.ponto_forte}</p>}
                      {c.fraqueza && <p className="text-[10px] text-red-400">✗ {c.fraqueza}</p>}
                      {c.mecanismo_unico && <p className="text-[10px] text-muted-foreground">🔑 {c.mecanismo_unico}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Oportunidades DB */}
          {filteredOpps.length > 0 ? (
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
                          {o.flags.map((f: string, j: number) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{f}</span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="p-12 text-center space-y-3">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
                <h3 className="text-lg font-medium text-muted-foreground">Nenhuma oportunidade no banco de dados</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Use o botão "Pesquisa de Mercado" com IA para gerar oportunidades automaticamente, ou adicione manualmente via SQL Editor.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Result — persisted */}
      {aiResult && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <Brain className="h-5 w-5" /> Resultado da Pesquisa IA
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{aiResult.length} chars</Badge>
                {selectedProject && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Salvo no projeto</Badge>}
              </div>
            </div>
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{aiResult}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
