import { useEffect, useState, useMemo } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Copy, Trash2, TrendingUp, DollarSign, MousePointerClick, Target, AlertTriangle, ArrowUpRight, ArrowDownRight, BarChart3, Filter, Zap, Code, Calendar, Eye } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface TrackingLink {
  id: string; nome: string; destino: string; project_id?: string;
  plataforma?: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; utm_term?: string; ativo: boolean;
  created_at: string; clickCount?: number;
  data_inicio?: string; data_fim?: string;
}

interface AdsSpendRow {
  id: string; project_id: string; plataforma: string; campanha: string;
  conjunto_anuncios: string; anuncio: string; data_ref: string;
  valor: number; impressoes: number; cliques: number; leads: number;
  compras: number; custo_por_compra: number | null; ctr: number;
  cpm: number; frequencia: number; alcance: number;
  hook_rate: number | null; hold_rate: number | null; stop_rate: number;
  checkouts_iniciados: number; cpck: number;
}

interface KPITargets {
  roas_target: number; cpa_target: number; ctr_target: number;
  cpm_target: number; thumbstop_target: number;
}

const DEFAULT_TARGETS: KPITargets = { roas_target: 3, cpa_target: 35, ctr_target: 2, cpm_target: 25, thumbstop_target: 30 };

const PLATAFORMAS = ["Meta Ads", "Google Ads", "TikTok Ads", "Kwai Ads", "Orgânico", "Afiliado", "Email", "Outro"];
const PLATAFORMA_COLORS: Record<string, string> = {
  "Meta Ads": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Google Ads": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "TikTok Ads": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Kwai Ads": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Orgânico": "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "Afiliado": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Email": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Outro": "bg-gray-500/15 text-gray-400 border-gray-500/30",
  "Facebook": "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const UTM_TEMPLATES: Record<string, { utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string; utm_term: string }> = {
  "Meta Ads": {
    utm_source: "{{site_source_name}}",
    utm_medium: "{{placement}}",
    utm_campaign: "{{campaign.name}}",
    utm_content: "{{adset.name}}",
    utm_term: "{{ad.name}}",
  },
  "Google Ads": {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "{campaignid}",
    utm_content: "{adgroupid}",
    utm_term: "{keyword}",
  },
  "TikTok Ads": {
    utm_source: "tiktok",
    utm_medium: "__PLACEMENT__",
    utm_campaign: "__CAMPAIGN_NAME__",
    utm_content: "__AID_NAME__",
    utm_term: "__CID_NAME__",
  },
};

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  let from: string;
  let to = today;
  switch (period) {
    case "today": from = today; break;
    case "yesterday": {
      const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      from = y; to = y; break;
    }
    case "7d": from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10); break;
    case "14d": from = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10); break;
    case "30d": from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10); break;
    case "90d": from = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10); break;
    case "month": from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); break;
    default: from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  }
  return { from, to };
}

export default function Tracker() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [adsSpend, setAdsSpend] = useState<AdsSpendRow[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [targets, setTargets] = useState<KPITargets>(DEFAULT_TARGETS);
  const [filterPlataforma, setFilterPlataforma] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [datePeriod, setDatePeriod] = useState("30d");
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [form, setForm] = useState({ nome: "", destino: "", plataforma: "Meta Ads", project_id: "none", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "", data_inicio: "", data_fim: "" });

  const dateRange = useMemo(() => getDateRange(datePeriod), [datePeriod]);

  const load = async () => {
    const [lRes, adsRes, vRes, pRes] = await Promise.all([
      supabase.from("imphq_tracking_links").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_ads_spend").select("*").gte("data_ref", dateRange.from).lte("data_ref", dateRange.to).order("data_ref", { ascending: false }),
      supabase.from("imphq_vendas").select("*").gte("created_at", dateRange.from + "T00:00:00").lte("created_at", dateRange.to + "T23:59:59"),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    // Also get click counts for links
    const cRes = await supabase.from("imphq_clicks").select("link_id");
    const clicksData = cRes.data || [];
    const enriched = (lRes.data || []).map((l: any) => ({
      ...l, clickCount: clicksData.filter((c: any) => c.link_id === l.id).length,
    }));
    setLinks(enriched);
    setAdsSpend((adsRes.data || []) as any);
    setVendas(vRes.data || []);
    setProjects(pRes.data || []);
    // Extract unique product names
    const prods = [...new Set((vRes.data || []).map((v: any) => v.produto_nome as string).filter(Boolean))].sort();
    setAllProducts(prods);
    const saved = localStorage.getItem("imphq_kpi_targets");
    if (saved) setTargets(JSON.parse(saved));
  };

  useEffect(() => { load(); }, [dateRange.from, dateRange.to]);

  const saveTargets = () => {
    localStorage.setItem("imphq_kpi_targets", JSON.stringify(targets));
    toast.success("Metas salvas!"); setShowTargets(false);
  };

  const applyTemplate = (platform: string) => {
    const tpl = UTM_TEMPLATES[platform];
    if (!tpl) return;
    setForm(prev => ({ ...prev, ...tpl }));
    toast.success(`Template ${platform} aplicado!`);
  };

  const buildUrl = (l: Partial<TrackingLink>) => {
    if (!l.destino) return "";
    const params = new URLSearchParams();
    if (l.utm_source) params.set("utm_source", l.utm_source);
    if (l.utm_medium) params.set("utm_medium", l.utm_medium);
    if (l.utm_campaign) params.set("utm_campaign", l.utm_campaign);
    if (l.utm_content) params.set("utm_content", l.utm_content);
    if (l.utm_term) params.set("utm_term", l.utm_term);
    const qs = params.toString();
    return qs ? `${l.destino}?${qs}` : l.destino;
  };

  const createLink = async () => {
    if (!form.nome || !form.destino) { toast.error("Nome e destino obrigatórios"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_tracking_links").insert({
      id, nome: form.nome, destino: form.destino, plataforma: form.plataforma,
      project_id: form.project_id === "none" ? null : form.project_id || null,
      utm_source: form.utm_source || null, utm_medium: form.utm_medium || null,
      utm_campaign: form.utm_campaign || null, utm_content: form.utm_content || null,
      utm_term: form.utm_term || null, ativo: true,
      data_inicio: form.data_inicio || null, data_fim: form.data_fim || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Link criado!"); setShowNew(false);
    setForm({ nome: "", destino: "", plataforma: "Meta Ads", project_id: "none", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "", data_inicio: "", data_fim: "" });
    load();
  };

  const toggleAtivo = async (link: TrackingLink) => {
    await supabase.from("imphq_tracking_links").update({ ativo: !link.ativo }).eq("id", link.id); load();
  };
  const deleteLink = async (id: string) => {
    await supabase.from("imphq_tracking_links").delete().eq("id", id); toast.success("Link removido"); load();
  };
  const copyLink = (link: TrackingLink) => { navigator.clipboard.writeText(buildUrl(link)); toast.success("URL copiada!"); };

  // Filtered data
  const filteredLinks = links.filter(l => {
    if (filterPlataforma !== "all" && l.plataforma !== filterPlataforma) return false;
    if (filterProject !== "all" && l.project_id !== filterProject) return false;
    return true;
  });
  const filteredAds = adsSpend.filter(a => {
    if (filterProject !== "all" && a.project_id !== filterProject) return false;
    if (filterPlataforma !== "all") {
      const plat = filterPlataforma === "Meta Ads" ? "Facebook" : filterPlataforma;
      if (a.plataforma !== plat) return false;
    }
    return true;
  });
  const filteredVendas = vendas.filter(v => {
    if (filterProject !== "all" && v.project_id !== filterProject) return false;
    if (filterProduct !== "all" && v.produto_nome !== filterProduct) return false;
    return true;
  });

  // KPIs from imphq_ads_spend (real ads data)
  const totalGasto = filteredAds.reduce((s, a) => s + (parseFloat(String(a.valor)) || 0), 0);
  const totalClicks = filteredAds.reduce((s, a) => s + (parseInt(String(a.cliques)) || 0), 0);
  const totalImpressoes = filteredAds.reduce((s, a) => s + (parseInt(String(a.impressoes)) || 0), 0);
  const totalAlcance = filteredAds.reduce((s, a) => s + (parseInt(String(a.alcance)) || 0), 0);
  const totalComprasAds = filteredAds.reduce((s, a) => s + (parseInt(String(a.compras)) || 0), 0);
  const totalVendasCount = filteredVendas.length;
  const totalReceita = filteredVendas.reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);

  const roas = totalGasto > 0 ? totalReceita / totalGasto : 0;
  const cpa = totalVendasCount > 0 ? totalGasto / totalVendasCount : 0;
  const ctr = totalImpressoes > 0 ? (totalClicks / totalImpressoes) * 100 : 0;
  const cpm = totalImpressoes > 0 ? (totalGasto / totalImpressoes) * 1000 : 0;
  const cpl = totalClicks > 0 ? totalGasto / totalClicks : 0;
  const cvr = totalClicks > 0 ? (totalVendasCount / totalClicks) * 100 : 0;
  const ltv = totalVendasCount > 0 ? totalReceita / totalVendasCount : 0;
  const cac = cpa;
  const avgFrequencia = filteredAds.length > 0 ? filteredAds.reduce((s, a) => s + (parseFloat(String(a.frequencia)) || 0), 0) / filteredAds.length : 0;

  // Daily chart data
  const dailyMap = new Map<string, { gasto: number; receita: number; clicks: number }>();
  filteredAds.forEach(a => {
    const d = a.data_ref;
    const prev = dailyMap.get(d) || { gasto: 0, receita: 0, clicks: 0 };
    prev.gasto += parseFloat(String(a.valor)) || 0;
    prev.clicks += parseInt(String(a.cliques)) || 0;
    dailyMap.set(d, prev);
  });
  filteredVendas.forEach(v => {
    const d = (v.created_at || "").slice(0, 10);
    const prev = dailyMap.get(d) || { gasto: 0, receita: 0, clicks: 0 };
    prev.receita += parseFloat(v.valor) || 0;
    dailyMap.set(d, prev);
  });
  const dailyChart = Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

  // Campaign breakdown
  const campaignMap = new Map<string, { campanha: string; gasto: number; cliques: number; impressoes: number; compras: number; frequencia: number[]; ctr: number[] }>();
  filteredAds.forEach(a => {
    const key = a.campanha || "—";
    const prev = campaignMap.get(key) || { campanha: key, gasto: 0, cliques: 0, impressoes: 0, compras: 0, frequencia: [], ctr: [] };
    prev.gasto += parseFloat(String(a.valor)) || 0;
    prev.cliques += parseInt(String(a.cliques)) || 0;
    prev.impressoes += parseInt(String(a.impressoes)) || 0;
    prev.compras += parseInt(String(a.compras)) || 0;
    if (a.frequencia) prev.frequencia.push(parseFloat(String(a.frequencia)));
    if (a.ctr) prev.ctr.push(parseFloat(String(a.ctr)));
    campaignMap.set(key, prev);
  });
  const campaignBreakdown = Array.from(campaignMap.values()).sort((a, b) => b.gasto - a.gasto);

  const getStatus = (real: number, target: number, higherIsBetter: boolean) => {
    if (target === 0) return "neutral";
    return higherIsBetter ? (real >= target ? "good" : "bad") : (real <= target ? "good" : "bad");
  };
  const roasStatus = getStatus(roas, targets.roas_target, true);
  const cpaStatus = getStatus(cpa, targets.cpa_target, false);
  const ctrStatus = getStatus(ctr, targets.ctr_target, true);
  const cpmStatus = getStatus(cpm, targets.cpm_target, false);

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "—";

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  const trackingScript = `<script>
(function(){
  var SB_URL = "${supabaseUrl}";
  var SB_KEY = "${supabaseKey}";
  
  // Persistent visitor ID
  var visitorId = localStorage.getItem("imp_visitor_id");
  if(!visitorId){ visitorId = crypto.randomUUID(); localStorage.setItem("imp_visitor_id", visitorId); }
  
  // Session ID (resets after 30min inactivity)
  var sessionId = sessionStorage.getItem("imp_session_id");
  var lastActivity = parseInt(sessionStorage.getItem("imp_last_activity") || "0");
  var now = Date.now();
  if(!sessionId || (now - lastActivity) > 1800000){
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("imp_session_id", sessionId);
  }
  sessionStorage.setItem("imp_last_activity", String(now));
  
  // Capture UTM params
  var params = new URLSearchParams(window.location.search);
  var utms = {};
  ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){
    var v = params.get(k);
    if(v){ utms[k] = v; localStorage.setItem("imp_"+k, v); }
    else { var s = localStorage.getItem("imp_"+k); if(s) utms[k] = s; }
  });
  
  // Store landing page
  if(!localStorage.getItem("imp_landing")) localStorage.setItem("imp_landing", window.location.href);
  
  // Helper: generate event_id for deduplication
  function genEventId(){ return crypto.randomUUID(); }
  
  // Helper: post to Supabase
  function sbPost(table, data){
    return fetch(SB_URL + "/rest/v1/" + table, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(data)
    }).catch(function(){});
  }
  
  // Register click (if UTMs present)
  if(Object.keys(utms).length > 0){
    sbPost("imphq_clicks", {
      id: crypto.randomUUID(),
      utm_source: utms.utm_source || null,
      utm_medium: utms.utm_medium || null,
      utm_campaign: utms.utm_campaign || null,
      utm_content: utms.utm_content || null,
      utm_term: utms.utm_term || null,
      referrer: document.referrer || null,
      page_url: window.location.href,
      user_agent: navigator.userAgent
    });
  }
  
  // Track event function
  function trackEvent(eventName, eventData, eventId){
    var eid = eventId || genEventId();
    // Fire fbq if available
    if(window.fbq){
      try { window.fbq("trackCustom", eventName, eventData || {}, { eventID: eid }); } catch(e){}
    }
    return sbPost("imphq_events", {
      id: eid,
      visitor_id: visitorId,
      session_id: sessionId,
      event_name: eventName,
      event_data: eventData || {},
      page_url: window.location.href,
      referrer: document.referrer || null,
      utm_source: utms.utm_source || null,
      utm_medium: utms.utm_medium || null,
      utm_campaign: utms.utm_campaign || null,
      utm_content: utms.utm_content || null,
      utm_term: utms.utm_term || null,
      user_agent: navigator.userAgent
    });
  }
  
  // Load Facebook Pixel dynamically
  var pixelId = document.querySelector('meta[name="imp-pixel-id"]');
  if(pixelId){ pixelId = pixelId.getAttribute("content"); }
  if(pixelId){
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,"script","https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", pixelId);
    fbq("track", "PageView", {}, { eventID: genEventId() });
  }
  
  // Auto-track PageView
  trackEvent("PageView", { title: document.title });
  
  // Expose helpers
  window.imptrack = {
    getUtms: function(){ return utms; },
    getVisitorId: function(){ return visitorId; },
    getSessionId: function(){ return sessionId; },
    trackEvent: trackEvent,
    trackViewContent: function(data){
      var eid = genEventId();
      if(window.fbq) fbq("track", "ViewContent", data || {}, { eventID: eid });
      return trackEvent("ViewContent", data, eid);
    },
    trackAddToCart: function(data){
      var eid = genEventId();
      if(window.fbq) fbq("track", "AddToCart", data || {}, { eventID: eid });
      return trackEvent("AddToCart", data, eid);
    },
    trackLead: function(data){
      var eid = genEventId();
      if(window.fbq) fbq("track", "Lead", { email: data.email }, { eventID: eid });
      trackEvent("LeadCapture", { email: data.email, nome: data.nome }, eid);
      return sbPost("imphq_leads", Object.assign({
        id: crypto.randomUUID(),
        plataforma: utms.utm_source || null,
        data: { utms: utms, landing: localStorage.getItem("imp_landing"), visitor_id: visitorId }
      }, data));
    }
  };
})();
</script>`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">⚡ Tracker / Meta <SectionInfo {...sectionHelpTexts.tracker} /></h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowScript(true)}><Code className="h-4 w-4 mr-1" /> Script</Button>
          <Button size="sm" variant="outline" onClick={() => setShowTargets(true)}><Target className="h-4 w-4 mr-1" /> Metas</Button>
          <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Link</Button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          {[
            { value: "today", label: "Hoje" },
            { value: "yesterday", label: "Ontem" },
            { value: "7d", label: "7D" },
            { value: "14d", label: "14D" },
            { value: "30d", label: "30D" },
            { value: "90d", label: "90D" },
            { value: "month", label: "Mês" },
          ].map(p => (
            <Button key={p.value} size="sm" variant={datePeriod === p.value ? "default" : "ghost"} className="h-7 text-xs px-2.5" onClick={() => setDatePeriod(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>
        <Select value={filterPlataforma} onValueChange={setFilterPlataforma}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Plataformas</SelectItem>
            {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {allProducts.length > 0 && (
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Produtos</SelectItem>
              {allProducts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {(filterPlataforma !== "all" || filterProject !== "all" || filterProduct !== "all") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFilterPlataforma("all"); setFilterProject("all"); setFilterProduct("all"); }}>Limpar filtros</Button>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto"><Calendar className="h-3 w-3 inline mr-1" />{dateRange.from} → {dateRange.to}</span>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard"><BarChart3 className="h-3.5 w-3.5 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="links"><MousePointerClick className="h-3.5 w-3.5 mr-1" /> Links UTM</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Top-level metrics */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="Total Gasto" value={`R$ ${totalGasto.toFixed(2)}`} />
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="Receita" value={`R$ ${totalReceita.toFixed(2)}`} />
            <Card className={`bg-card border-border ${totalReceita - totalGasto > 0 ? "border-emerald-400/20" : "border-destructive/20"}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="h-3 w-3" /> Lucro</div>
                <p className={`text-xl font-bold font-mono ${totalReceita - totalGasto > 0 ? "text-emerald-400" : "text-destructive"}`}>
                  R$ {(totalReceita - totalGasto).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <KPICard icon={<MousePointerClick className="h-3 w-3" />} label="Cliques (Ads)" value={totalClicks.toLocaleString("pt-BR")} />
            <KPICard icon={<Eye className="h-3 w-3" />} label="Impressões" value={totalImpressoes.toLocaleString("pt-BR")} />
            <KPICard icon={<TrendingUp className="h-3 w-3" />} label="Vendas" value={String(totalVendasCount)} />
          </div>

          {totalGasto === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-300">Sem dados de gasto no período. Importe dados em <strong>Finanças → Ads</strong> ou configure a sincronização automática do Facebook Ads.</p>
            </div>
          )}

          {/* KPI targets row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICardTarget label="ROAS" value={roas.toFixed(2)} suffix="x" target={targets.roas_target} targetLabel={`Meta: ${targets.roas_target}x`} status={roasStatus} />
            <KPICardTarget label="CPA" value={`R$ ${cpa.toFixed(2)}`} target={targets.cpa_target} targetLabel={`Meta: R$ ${targets.cpa_target}`} status={cpaStatus} />
            <KPICardTarget label="CTR" value={`${ctr.toFixed(2)}%`} target={targets.ctr_target} targetLabel={`Meta: ${targets.ctr_target}%`} status={ctrStatus} />
            <KPICardTarget label="CPM" value={`R$ ${cpm.toFixed(2)}`} target={targets.cpm_target} targetLabel={`Meta: R$ ${targets.cpm_target}`} status={cpmStatus} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<Target className="h-3 w-3" />} label="CPC" value={`R$ ${cpl.toFixed(2)}`} />
            <KPICard icon={<TrendingUp className="h-3 w-3" />} label="CVR" value={`${cvr.toFixed(2)}%`} />
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="LTV" value={`R$ ${ltv.toFixed(2)}`} />
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="CAC" value={`R$ ${cac.toFixed(2)}`} />
          </div>

          {/* UTM Source Attribution */}
          {filteredVendas.length > 0 && (() => {
            const sourceMap = new Map<string, { cnt: number; receita: number }>();
            filteredVendas.forEach((v: any) => {
              const src = v.utm_source || "Direto / Desconhecido";
              const prev = sourceMap.get(src) || { cnt: 0, receita: 0 };
              prev.cnt += 1;
              prev.receita += parseFloat(v.valor) || 0;
              sourceMap.set(src, prev);
            });
            const sources = Array.from(sourceMap.entries()).map(([source, d]) => ({ source, ...d })).sort((a, b) => b.receita - a.receita);
            return (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">🔗 Atribuição por UTM Source</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fonte (utm_source)</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead className="text-right">% Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-xs">
                          <Badge variant="outline" className={`text-[10px] ${
                            s.source.startsWith("FB") ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                            s.source.startsWith("ig") ? "bg-pink-500/15 text-pink-400 border-pink-500/30" :
                            s.source === "organic" ? "bg-violet-500/15 text-violet-400 border-violet-500/30" :
                            s.source === "google" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                            "bg-gray-500/15 text-gray-400 border-gray-500/30"
                          }`}>{s.source}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground">{s.cnt}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-400">R$ {s.receita.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">R$ {(s.receita / s.cnt).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{totalReceita > 0 ? ((s.receita / totalReceita) * 100).toFixed(1) : "0"}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })()}

          {/* Product Breakdown */}
          {filteredVendas.length > 0 && (() => {
            const prodMap = new Map<string, { cnt: number; receita: number }>();
            filteredVendas.forEach((v: any) => {
              const prod = v.produto_nome || "Sem produto";
              const prev = prodMap.get(prod) || { cnt: 0, receita: 0 };
              prev.cnt += 1;
              prev.receita += parseFloat(v.valor) || 0;
              prodMap.set(prod, prev);
            });
            const prods = Array.from(prodMap.entries()).map(([produto, d]) => ({ produto, ...d })).sort((a, b) => b.receita - a.receita);
            return (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">📦 Breakdown por Produto</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead className="text-right">Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prods.map((p, i) => {
                      const tipoMap = new Map<string, number>();
                      filteredVendas.filter((v: any) => (v.produto_nome || "Sem produto") === p.produto).forEach((v: any) => {
                        const t = v.tipo_venda || "principal";
                        tipoMap.set(t, (tipoMap.get(t) || 0) + 1);
                      });
                      const tipos = Array.from(tipoMap.entries()).map(([t, c]) => `${t} (${c})`).join(", ");
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-xs max-w-[200px] truncate">{p.produto}</TableCell>
                          <TableCell className="text-right font-mono text-foreground">{p.cnt}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-400">R$ {p.receita.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">R$ {(p.receita / p.cnt).toFixed(2)}</TableCell>
                          <TableCell className="text-right text-[10px] text-muted-foreground">{tipos}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}

          {/* Campaign Attribution (UTM Campaign → Receita) */}
          {filteredVendas.length > 0 && (() => {
            const campMap = new Map<string, { cnt: number; receita: number }>();
            filteredVendas.forEach((v: any) => {
              const raw = v.utm_campaign;
              if (!raw) return;
              const name = raw.split("|")[0].trim() || raw;
              const prev = campMap.get(name) || { cnt: 0, receita: 0 };
              prev.cnt += 1;
              prev.receita += parseFloat(v.valor) || 0;
              campMap.set(name, prev);
            });
            const camps = Array.from(campMap.entries()).map(([campanha, d]) => ({ campanha, ...d })).sort((a, b) => b.receita - a.receita).slice(0, 10);
            if (camps.length === 0) return null;
            return (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">🎯 Atribuição Campanha → Receita (Top 10)</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha (utm_campaign)</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {camps.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-xs max-w-[250px] truncate">{c.campanha}</TableCell>
                        <TableCell className="text-right font-mono text-foreground">{c.cnt}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-400">R$ {c.receita.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">R$ {(c.receita / c.cnt).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })()}

          {/* Daily chart */}
          {dailyChart.length > 1 && (
            <Card className="border-border">
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">📈 Gasto vs Receita (Timeline)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={dailyChart} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    <Legend />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.2)" />
                    <Area type="monotone" dataKey="gasto" name="Gasto Ads" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.15)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Campaign breakdown */}
          {campaignBreakdown.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">📊 Breakdown por Campanha</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="text-right">CTR Médio</TableHead>
                    <TableHead className="text-right">Freq. Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignBreakdown.map((c, i) => {
                    const avgCtr = c.ctr.length > 0 ? c.ctr.reduce((a, b) => a + b, 0) / c.ctr.length : 0;
                    const avgFreq = c.frequencia.length > 0 ? c.frequencia.reduce((a, b) => a + b, 0) / c.frequencia.length : 0;
                    const campCpa = c.compras > 0 ? c.gasto / c.compras : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-xs max-w-[200px] truncate">{c.campanha}</TableCell>
                        <TableCell className="text-right font-mono text-red-400">R$ {c.gasto.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-blue-400">{c.cliques.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{c.impressoes.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-400">{c.compras}</TableCell>
                        <TableCell className={`text-right font-mono ${campCpa > 0 && campCpa <= targets.cpa_target ? "text-emerald-400" : campCpa > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {campCpa > 0 ? `R$ ${campCpa.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${avgCtr >= targets.ctr_target ? "text-emerald-400" : "text-amber-400"}`}>{avgCtr.toFixed(2)}%</TableCell>
                        <TableCell className={`text-right font-mono ${avgFreq > 3 ? "text-red-400" : "text-muted-foreground"}`}>{avgFreq.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
            <span className="text-[10px] text-muted-foreground">📊 <strong>Origem dos dados:</strong> Receita = <code>imphq_vendas</code> (webhooks) · Gasto/Cliques/Impressões = <code>imphq_ads_spend</code> (sync Facebook Ads)</span>
          </div>

          {/* Performance alerts */}
          {avgFrequencia > 3 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-400">Alerta de Saturação</p>
                  <p className="text-xs text-muted-foreground">Frequência média ({avgFrequencia.toFixed(2)}) acima de 3.0 — considere renovar criativos.</p>
                </div>
              </CardContent>
            </Card>
          )}
          {(roasStatus === "bad" || cpaStatus === "bad") && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Alerta de Performance</p>
                  {roasStatus === "bad" && <p className="text-xs text-muted-foreground">ROAS ({roas.toFixed(2)}x) abaixo da meta ({targets.roas_target}x)</p>}
                  {cpaStatus === "bad" && <p className="text-xs text-muted-foreground">CPA (R$ {cpa.toFixed(2)}) acima da meta (R$ {targets.cpa_target})</p>}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((l) => {
                  const now = new Date();
                  const start = l.data_inicio ? new Date(l.data_inicio) : null;
                  const end = l.data_fim ? new Date(l.data_fim) : null;
                  let campaignStatus = "—";
                  let statusClass = "text-muted-foreground";
                  if (start && end) {
                    if (now < start) { campaignStatus = "Agendado"; statusClass = "text-blue-400"; }
                    else if (now > end) { campaignStatus = "Encerrado"; statusClass = "text-muted-foreground"; }
                    else { campaignStatus = "Ativo"; statusClass = "text-emerald-400"; }
                  }
                  let duration = "—";
                  if (start && end) {
                    const diffMs = end.getTime() - start.getTime();
                    const days = Math.floor(diffMs / 86400000);
                    const hours = Math.floor((diffMs % 86400000) / 3600000);
                    duration = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                  }
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${PLATAFORMA_COLORS[l.plataforma || "Outro"] || PLATAFORMA_COLORS["Outro"]}`}>
                          {l.plataforma || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{projectName(l.project_id)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.utm_source || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.utm_campaign || "—"}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{duration}</TableCell>
                      <TableCell><span className={`text-xs font-medium ${statusClass}`}>{campaignStatus}</span></TableCell>
                      <TableCell className="font-mono text-primary">{l.clickCount ?? 0}</TableCell>
                      <TableCell><Switch checked={l.ativo} onCheckedChange={() => toggleAtivo(l)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => copyLink(l)}><Copy className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteLink(l.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Link Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Link UTM</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Meta - Campanha X" /></div>
            <div><Label>URL Destino</Label><Input value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} placeholder="https://seusite.com/pagina" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plataforma</Label>
                <Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* UTM Template Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Templates:</span>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20" onClick={() => applyTemplate("Meta Ads")}>
                <Zap className="h-3 w-3 mr-1" /> Meta Ads
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" onClick={() => applyTemplate("Google Ads")}>
                <Zap className="h-3 w-3 mr-1" /> Google Ads
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs bg-pink-500/10 text-pink-400 border-pink-500/30 hover:bg-pink-500/20" onClick={() => applyTemplate("TikTok Ads")}>
                <Zap className="h-3 w-3 mr-1" /> TikTok Ads
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>utm_source</Label><Input value={form.utm_source} onChange={e => setForm({ ...form, utm_source: e.target.value })} placeholder="meta" /></div>
              <div><Label>utm_medium</Label><Input value={form.utm_medium} onChange={e => setForm({ ...form, utm_medium: e.target.value })} placeholder="cpc" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>utm_campaign</Label><Input value={form.utm_campaign} onChange={e => setForm({ ...form, utm_campaign: e.target.value })} /></div>
              <div><Label>utm_content</Label><Input value={form.utm_content} onChange={e => setForm({ ...form, utm_content: e.target.value })} /></div>
              <div><Label>utm_term</Label><Input value={form.utm_term} onChange={e => setForm({ ...form, utm_term: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Início</Label><Input type="datetime-local" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Data Fim</Label><Input type="datetime-local" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            {form.destino && (
              <div className="p-2 bg-secondary rounded text-xs text-muted-foreground break-all">
                <span className="text-primary font-medium">Preview: </span>{buildUrl(form as any)}
              </div>
            )}

            {/* Copiar parâmetros para Facebook Ads */}
            {form.plataforma === "Meta Ads" && (
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-blue-400">📋 Parâmetros para Facebook Ads Manager</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                    onClick={() => {
                      const fbParams = [
                        `utm_source=FB`,
                        `utm_medium={{adset.name}}%7C{{adset.id}}`,
                        `utm_campaign={{campaign.name}}%7C{{campaign.id}}`,
                        `utm_content={{ad.name}}%7C{{ad.id}}`,
                        `utm_term={{placement}}`,
                        `xcod={{campaign.id}}%7C{{adset.id}}%7C{{ad.id}}%7C{{placement}}`,
                      ].join("&");
                      navigator.clipboard.writeText(fbParams);
                      toast.success("Parâmetros FB Ads copiados!");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copiar para FB Ads
                  </Button>
                </div>
                <div className="p-2 bg-secondary rounded text-[10px] font-mono text-muted-foreground break-all select-all">
                  utm_source=FB&utm_medium={"{{adset.name}}%7C{{adset.id}}"}&utm_campaign={"{{campaign.name}}%7C{{campaign.id}}"}&utm_content={"{{ad.name}}%7C{{ad.id}}"}&utm_term={"{{placement}}"}&xcod={"{{campaign.id}}%7C{{adset.id}}%7C{{ad.id}}%7C{{placement}}"}
                </div>
                <p className="text-[10px] text-muted-foreground">Cole no campo <strong>URL Parameters</strong> do Facebook Ads Manager.</p>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={createLink}>Criar Link</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Targets Dialog */}
      <Dialog open={showTargets} onOpenChange={setShowTargets}>
        <DialogContent>
          <DialogHeader><DialogTitle>Metas de KPI (V5)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ROAS Target</Label><Input type="number" step="0.1" value={targets.roas_target} onChange={e => setTargets({ ...targets, roas_target: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>CPA Target (R$)</Label><Input type="number" value={targets.cpa_target} onChange={e => setTargets({ ...targets, cpa_target: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CTR Target (%)</Label><Input type="number" step="0.1" value={targets.ctr_target} onChange={e => setTargets({ ...targets, ctr_target: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>CPM Target (R$)</Label><Input type="number" value={targets.cpm_target} onChange={e => setTargets({ ...targets, cpm_target: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Thumbstop Target (%)</Label><Input type="number" step="0.1" value={targets.thumbstop_target} onChange={e => setTargets({ ...targets, thumbstop_target: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter><Button onClick={saveTargets}>Salvar Metas</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Dialog */}
      <Dialog open={showScript} onOpenChange={setShowScript}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>📦 Script de Tracking (imptrack)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole este script no <code className="text-primary">&lt;head&gt;</code> da sua landing page para capturar UTMs e registrar clicks automaticamente.
            </p>
            <div className="relative">
              <Textarea
                readOnly
                value={trackingScript}
                className="font-mono text-xs bg-secondary h-64 resize-none"
              />
              <Button
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => { navigator.clipboard.writeText(trackingScript); toast.success("Script copiado!"); }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-primary">Funções disponíveis:</p>
              <div className="bg-secondary rounded p-3 space-y-2 text-xs font-mono text-muted-foreground">
                <p><span className="text-primary">imptrack.getUtms()</span> → retorna objeto com UTMs capturados</p>
                <p><span className="text-primary">imptrack.getVisitorId()</span> → retorna ID persistente do visitante</p>
                <p><span className="text-primary">imptrack.getSessionId()</span> → retorna ID da sessão atual</p>
                <p><span className="text-primary">imptrack.trackLead({"{"} nome, email, phone {"}"})</span> → registra lead + CAPI Lead</p>
                <p><span className="text-primary">imptrack.trackEvent("NomeEvento", {"{"} dados {"}"})</span> → registra evento customizado</p>
                <p><span className="text-primary">imptrack.trackViewContent({"{"} content_name {"}"})</span> → ViewContent + fbq</p>
                <p><span className="text-primary">imptrack.trackAddToCart({"{"} value, currency {"}"})</span> → AddToCart + fbq</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">⚡ PageView é registrado automaticamente. Pixel do Facebook carrega se <code>&lt;meta name="imp-pixel-id" content="SEU_PIXEL_ID"&gt;</code> estiver na página.</p>
              
              {/* Facebook Integration Explanation */}
              <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                <p className="text-xs font-medium text-blue-400">📘 Integração com Facebook (Pixel + CAPI)</p>
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <p>• <strong className="text-foreground">Pixel (cliente)</strong>: Ativado automaticamente quando a meta tag <code className="text-primary">&lt;meta name="imp-pixel-id" content="SEU_PIXEL_ID"&gt;</code> está na página. Dispara PageView e todos os eventos padrão (Lead, ViewContent, AddToCart).</p>
                  <p>• <strong className="text-foreground">CAPI (servidor)</strong>: Enviado automaticamente pelo webhook de pagamento (<code className="text-primary">webhook-pagamento</code>). Não precisa de nada extra no front-end. Envia Purchase, Lead e InitiateCheckout com dados hashados (SHA-256).</p>
                  <p>• <strong className="text-foreground">Deduplicação</strong>: Ambos usam o mesmo <code className="text-primary">event_id</code> (UUID). O Facebook identifica eventos duplicados e conta apenas uma vez.</p>
                  <p>• <strong className="text-foreground">Configuração</strong>: Vá em <span className="text-primary">Projeto → Analytics → Facebook Pixel & CAPI</span> e preencha o Pixel ID e o Access Token. Cada projeto tem sua configuração isolada.</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">Exemplo de uso no formulário:</span>
              </p>
              <div className="bg-secondary rounded p-3 text-xs font-mono text-muted-foreground">
                {`document.querySelector("form").addEventListener("submit", function(e) {\n  e.preventDefault();\n  imptrack.trackLead({\n    nome: document.getElementById("nome").value,\n    email: document.getElementById("email").value\n  }).then(function() { window.location = "/obrigado"; });\n});`}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">Exemplo de evento customizado:</span>
              </p>
              <div className="bg-secondary rounded p-3 text-xs font-mono text-muted-foreground">
                {`imptrack.trackEvent("ButtonClick", { button: "comprar", page: "/oferta" });\nimptrack.trackEvent("VideoPlay", { video_id: "vsl-principal", percent: 50 });`}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon} {label}</div>
        <p className="text-xl font-bold text-foreground font-mono">{value}</p>
      </CardContent>
    </Card>
  );
}

function KPICardTarget({ label, value, suffix, target, targetLabel, status }: {
  label: string; value: string; suffix?: string; target: number; targetLabel: string; status: string;
}) {
  const color = status === "good" ? "text-emerald-400" : status === "bad" ? "text-destructive" : "text-muted-foreground";
  const borderColor = status === "good" ? "border-emerald-400/30" : status === "bad" ? "border-destructive/30" : "border-border";
  return (
    <Card className={`bg-card ${borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={`text-[10px] ${color} flex items-center gap-0.5`}>
            {status === "good" ? <ArrowUpRight className="h-3 w-3" /> : status === "bad" ? <ArrowDownRight className="h-3 w-3" /> : null}
            {status === "good" ? "On target" : status === "bad" ? "Off target" : "—"}
          </span>
        </div>
        <p className={`text-xl font-bold font-mono ${color}`}>{value}{suffix}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{targetLabel}</p>
      </CardContent>
    </Card>
  );
}
