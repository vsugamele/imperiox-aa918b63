import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DollarSign, TrendingUp, TrendingDown, Percent, Plus, Trash2, Receipt, Wallet, Megaphone, ShoppingCart, Upload, Target, Pencil, Paperclip, ExternalLink, Package, CalendarIcon, Globe, Eye, Users, Sparkles, Brain, BarChart3, Image, Copy, Loader2, AlertTriangle, CheckCircle, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { AdsImportDialog } from "@/components/financas/AdsImportDialog";
import { FileUpload } from "@/components/FileUpload";
import { FinancasProdutos } from "@/components/financas/FinancasProdutos";
import { format, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface Cost {
  id: string; nome: string; categoria: string; valor: number; moeda: string; recorrente: boolean;
  documento_url?: string | null; produto_nome?: string | null;
  pix_info?: string | null; data_pagamento?: string | null;
  beneficiario?: string | null; tipo_recorrencia?: string | null;
}
interface Revenue {
  id: string; descricao: string; valor: number; fonte: string; data_ref: string;
  produto_nome?: string | null; documento_url?: string | null;
  pix_info?: string | null; data_pagamento?: string | null; plataforma?: string | null;
}
interface AdsSpend {
  id: string; plataforma: string; campanha: string | null; conjunto_anuncios?: string | null;
  anuncio?: string | null; data_ref: string; valor: number; impressoes: number; alcance?: number;
  cliques: number; leads: number; compras?: number; custo_por_compra?: number;
  hook_rate?: number; ctr?: number; frequencia?: number;
}
interface Venda {
  id: string; produto_nome: string; valor: number; plataforma: string; status: string; data_venda: string;
}

const COST_CATS = ["Ferramentas", "Ads", "Freelancer", "Infra", "Outro"];
const REV_SOURCES = ["Manual", "Hotmart", "Stripe", "Kiwify", "Outro"];
const PLATAFORMAS = ["Hotmart", "Kiwify", "Ticto", "Stripe", "PIX", "Manual", "Outro"];

const PERIOD_OPTIONS = [
  { key: "all", label: "Todo período" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "this_month", label: "Este mês" },
  { key: "last_month", label: "Mês passado" },
  { key: "custom", label: "Personalizado" },
];

export function ProjetoFinancas({ projectId, project }: { projectId: string; project?: any }) {
  const { user } = useAuth();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [ads, setAds] = useState<AdsSpend[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showRevForm, setShowRevForm] = useState(false);
  const [showAdsImport, setShowAdsImport] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [costForm, setCostForm] = useState({ nome: "", categoria: "Outro", valor: "", moeda: "BRL", recorrente: true, documento_url: "", produto_nome: "", pix_info: "", data_pagamento: "", beneficiario: "", tipo_recorrencia: "mensal" });
  const [revForm, setRevForm] = useState({ descricao: "", valor: "", fonte: "Manual", data_ref: new Date().toISOString().split("T")[0], produto_nome: "", documento_url: "", pix_info: "", data_pagamento: "", plataforma: "", quantidade: "1", custo_produto: "0", imposto_pct: "" });
  const [showFbGuide, setShowFbGuide] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [events, setEvents] = useState<any[]>([]);
  // AI Campaign & Analysis states
  const [showCampaignGen, setShowCampaignGen] = useState(false);
  const [campaignPrompt, setCampaignPrompt] = useState("");
  const [campaignModel, setCampaignModel] = useState("google/gemini-3-flash-preview");
  const [generatingCampaigns, setGeneratingCampaigns] = useState(false);
  const [campaignDrafts, setCampaignDrafts] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analyzingAds, setAnalyzingAds] = useState(false);
  const [adsAnalysis, setAdsAnalysis] = useState<any>(null);
  const [adsSubTab, setAdsSubTab] = useState("dados");
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [viewingReport, setViewingReport] = useState<any>(null);
  const [creativeSearch, setCreativeSearch] = useState("");
  const [creativeFilter, setCreativeFilter] = useState("all");
  const [adsSearchCampanha, setAdsSearchCampanha] = useState("");
  const [adsFilterConjunto, setAdsFilterConjunto] = useState("all");
  const [adsFilterAnuncio, setAdsFilterAnuncio] = useState("all");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [creativeFilterConjunto, setCreativeFilterConjunto] = useState("all");

  // Get products from briefing
  const briefingProdutos: any[] = project?.data?.produtos || [];

  useEffect(() => { loadData(); loadReports(); }, [projectId]);

  const loadReports = async () => {
    const { data } = await supabase.from("imphq_ads_reports").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setSavedReports((data || []) as any[]);
  };

  const saveReport = async () => {
    if (!adsAnalysis) return;
    const { error } = await supabase.from("imphq_ads_reports").insert({
      project_id: projectId,
      user_id: user?.id,
      titulo: `Análise ${new Date().toLocaleDateString("pt-BR")}`,
      report_data: adsAnalysis,
      model_used: campaignModel,
      period_start: dateRange?.start ? format(dateRange.start, "yyyy-MM-dd") : null,
      period_end: dateRange?.end ? format(dateRange.end, "yyyy-MM-dd") : null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Relatório salvo!");
    loadReports();
  };

  const loadData = async () => {
    const [c, r, a, v, p, ev] = await Promise.all([
      supabase.from("imphq_project_costs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("imphq_project_revenue").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("imphq_ads_spend").select("*").eq("project_id", projectId).order("data_ref", { ascending: false }),
      supabase.from("imphq_vendas").select("*").eq("project_id", projectId).eq("status", "aprovado").order("data_venda", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
      supabase.from("imphq_events").select("id, event_name, created_at, page_url").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1000),
    ]);
    setCosts((c.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
    setRevenues((r.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
    setAds((a.data || []).map((x: any) => ({
      ...x, valor: parseFloat(x.valor) || 0, impressoes: x.impressoes || 0,
      cliques: x.cliques || 0, leads: x.leads || 0, alcance: x.alcance || 0,
      compras: x.compras || 0, custo_por_compra: parseFloat(x.custo_por_compra) || 0,
      hook_rate: parseFloat(x.hook_rate) || 0, ctr: parseFloat(x.ctr) || 0,
      frequencia: parseFloat(x.frequencia) || 0,
    })));
    setVendas((v.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
    setProjects((p.data || []) as { id: string; name: string }[]);
    setEvents(ev.data || []);
  };

  // Period filter
  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (period) {
      case "7d": return { start: subDays(now, 7), end: now };
      case "30d": return { start: subDays(now, 30), end: now };
      case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month": { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
      case "custom": return customFrom && customTo ? { start: startOfDay(customFrom), end: endOfDay(customTo) } : null;
      default: return null;
    }
  };

  const dateRange = getDateRange();
  const inRange = (dateStr: string | undefined | null) => {
    if (!dateRange || !dateStr) return !dateRange;
    try { return isWithinInterval(new Date(dateStr), { start: dateRange.start, end: dateRange.end }); } catch { return true; }
  };

  const fCosts = useMemo(() => costs.filter(c => inRange(c.data_pagamento || null)), [costs, period, customFrom, customTo]);
  const fRevenues = useMemo(() => revenues.filter(r => inRange(r.data_ref)), [revenues, period, customFrom, customTo]);
  const fAds = useMemo(() => ads.filter(a => inRange(a.data_ref)), [ads, period, customFrom, customTo]);
  const fVendas = useMemo(() => vendas.filter(v => inRange(v.data_venda)), [vendas, period, customFrom, customTo]);
  const fEvents = useMemo(() => events.filter(e => inRange(e.created_at)), [events, period, customFrom, customTo]);

  // Event KPIs
  const eventKPIs = useMemo(() => {
    const counts: Record<string, number> = {};
    fEvents.forEach(e => { counts[e.event_name] = (counts[e.event_name] || 0) + 1; });
    return {
      pageViews: counts["PageView"] || 0,
      viewContent: counts["ViewContent"] || 0,
      addToCart: counts["AddToCart"] || 0,
      leadCapture: counts["LeadCapture"] || 0,
      total: fEvents.length,
    };
  }, [fEvents]);

  // KPIs (filtered)
  const totalCost = fCosts.reduce((s, c) => s + (c.moeda === "USD" ? c.valor * 5.2 : c.valor), 0);
  const totalRev = fRevenues.reduce((s, r) => s + r.valor, 0);
  const totalAds = fAds.reduce((s, a) => s + a.valor, 0);
  const totalVendas = fVendas.reduce((s, v) => s + v.valor, 0);
  const totalReceita = totalRev + totalVendas;
  const totalCusto = totalCost + totalAds;
  const profit = totalReceita - totalCusto;
  const roi = totalCusto > 0 ? ((profit / totalCusto) * 100) : 0;
  const roas = totalAds > 0 ? totalReceita / totalAds : 0;

  // Ads KPIs (filtered)
  const totalCliques = fAds.reduce((s, a) => s + a.cliques, 0);
  const totalCompras = fAds.reduce((s, a) => s + (a.compras || 0), 0);
  const cpc = totalCliques > 0 ? totalAds / totalCliques : 0;
  const cpl = fAds.reduce((s, a) => s + a.leads, 0) > 0 ? totalAds / fAds.reduce((s, a) => s + a.leads, 0) : 0;

  const openCostFormForNew = () => {
    setEditingCost(null);
    setCostForm({ nome: "", categoria: "Outro", valor: "", moeda: "BRL", recorrente: true, documento_url: "", produto_nome: "", pix_info: "", data_pagamento: "", beneficiario: "", tipo_recorrencia: "mensal" });
    setShowCostForm(true);
  };

  const openCostFormForEdit = (cost: Cost) => {
    setEditingCost(cost);
    setCostForm({
      nome: cost.nome,
      categoria: cost.categoria,
      valor: String(cost.valor),
      moeda: cost.moeda,
      recorrente: cost.recorrente,
      documento_url: cost.documento_url || "",
      produto_nome: cost.produto_nome || "",
      pix_info: cost.pix_info || "",
      data_pagamento: cost.data_pagamento || "",
      beneficiario: cost.beneficiario || "",
      tipo_recorrencia: cost.tipo_recorrencia || "mensal",
    });
    setShowCostForm(true);
  };

  const saveCost = async () => {
    if (!costForm.nome.trim() || !costForm.valor) { toast.error("Preencha nome e valor"); return; }
    const payload = {
      nome: costForm.nome,
      categoria: costForm.categoria,
      valor: parseFloat(costForm.valor),
      moeda: costForm.moeda,
      recorrente: costForm.recorrente,
      documento_url: costForm.documento_url || null,
      pix_info: costForm.pix_info || null,
      data_pagamento: costForm.data_pagamento || null,
      produto_nome: costForm.produto_nome || null,
      beneficiario: costForm.beneficiario || null,
      tipo_recorrencia: costForm.tipo_recorrencia || "mensal",
    };

    if (editingCost) {
      const { error } = await supabase.from("imphq_project_costs").update(payload).eq("id", editingCost.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Custo atualizado!");
    } else {
      const { error } = await supabase.from("imphq_project_costs").insert([{
        ...payload, project_id: projectId, user_id: user?.id,
      }]);
      if (error) { toast.error(error.message); return; }
      toast.success("Custo adicionado!");
    }
    setShowCostForm(false);
    setEditingCost(null);
    loadData();
  };

  const openRevFormForNew = () => {
    setEditingRevenue(null);
    setRevForm({ descricao: "", valor: "", fonte: "Manual", data_ref: new Date().toISOString().split("T")[0], produto_nome: "", documento_url: "", pix_info: "", data_pagamento: "", plataforma: "", quantidade: "1", custo_produto: "0", imposto_pct: "" });
    setShowRevForm(true);
  };

  const openRevFormForEdit = (rev: Revenue) => {
    setEditingRevenue(rev);
    setRevForm({
      descricao: rev.descricao,
      valor: String(rev.valor),
      fonte: rev.fonte,
      data_ref: rev.data_ref,
      produto_nome: rev.produto_nome || "",
      documento_url: rev.documento_url || "",
      pix_info: rev.pix_info || "",
      data_pagamento: rev.data_pagamento || "",
      plataforma: rev.plataforma || "",
      quantidade: String((rev as any).quantidade || 1),
      custo_produto: String((rev as any).custo_produto || 0),
      imposto_pct: String((rev as any).imposto_pct || ""),
    });
    setShowRevForm(true);
  };

  const saveRevenue = async () => {
    if (!revForm.descricao.trim() || !revForm.valor) { toast.error("Preencha descrição e valor"); return; }
    const payload = {
      descricao: revForm.descricao,
      valor: parseFloat(revForm.valor),
      fonte: revForm.fonte,
      data_ref: revForm.data_ref,
      produto_nome: revForm.produto_nome || null,
      documento_url: revForm.documento_url || null,
      pix_info: revForm.pix_info || null,
      data_pagamento: revForm.data_pagamento || null,
      plataforma: revForm.plataforma || null,
      quantidade: parseInt(revForm.quantidade) || 1,
      custo_produto: parseFloat(revForm.custo_produto) || 0,
    } as any;

    if (editingRevenue) {
      const { error } = await supabase.from("imphq_project_revenue").update(payload).eq("id", editingRevenue.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Receita atualizada!");
    } else {
      const { error } = await supabase.from("imphq_project_revenue").insert([{
        ...payload, project_id: projectId, user_id: user?.id,
      }]);
      if (error) { toast.error(error.message); return; }
      toast.success("Receita adicionada!");
    }
    setShowRevForm(false);
    setEditingRevenue(null);
    loadData();
  };

  const deleteCost = async (id: string) => {
    await supabase.from("imphq_project_costs").delete().eq("id", id);
    setCosts(prev => prev.filter(c => c.id !== id));
    toast.success("Removido");
  };

  const deleteRevenue = async (id: string) => {
    await supabase.from("imphq_project_revenue").delete().eq("id", id);
    setRevenues(prev => prev.filter(r => r.id !== id));
    toast.success("Removido");
  };

  const deleteAd = async (id: string) => {
    await supabase.from("imphq_ads_spend").delete().eq("id", id);
    setAds(prev => prev.filter(a => a.id !== id));
    toast.success("Removido");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const AI_MODELS = [
    { id: "google/gemini-3-flash-preview", label: "Gemini Flash" },
    { id: "google/gemini-2.5-pro", label: "Gemini Pro" },
    { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
    { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
    { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  ];

  const handleGenerateCampaigns = async () => {
    setGeneratingCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: projectId, action: "generate_campaign_drafts", model: campaignModel, user_prompt: campaignPrompt || undefined },
      });
      if (error) throw error;
      setCampaignDrafts(data.campaigns);
      setShowCampaignGen(false);
      toast.success("Campanhas geradas com sucesso!");
    } catch (err: any) {
      if (err?.message?.includes("429")) toast.error("Rate limit excedido. Tente novamente.");
      else if (err?.message?.includes("402")) toast.error("Créditos insuficientes.");
      else toast.error(err.message || "Erro ao gerar campanhas");
    } finally { setGeneratingCampaigns(false); }
  };

  const handleAnalyzePerformance = async () => {
    setAnalyzingAds(true);
    setShowAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: projectId, action: "analyze_ads_performance", model: campaignModel },
      });
      if (error) throw error;
      setAdsAnalysis(data.analysis);
      toast.success("Análise concluída!");
    } catch (err: any) {
      if (err?.message?.includes("429")) toast.error("Rate limit excedido.");
      else if (err?.message?.includes("402")) toast.error("Créditos insuficientes.");
      else toast.error(err.message || "Erro ao analisar");
      setShowAnalysis(false);
    } finally { setAnalyzingAds(false); }
  };

  // Creatives from project data
  const creatives: any[] = (project?.data?.facebook_creatives || []);

  const kpis = [
    { label: "Receita Total", value: fmt(totalReceita), icon: TrendingUp, color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
    { label: "Custo Total", value: fmt(totalCusto), icon: TrendingDown, color: "text-red-400", bg: "from-red-500/15 to-red-500/5" },
    { label: "Lucro", value: fmt(profit), icon: profit >= 0 ? TrendingUp : TrendingDown, color: profit >= 0 ? "text-emerald-400" : "text-red-400", bg: profit >= 0 ? "from-emerald-500/15 to-emerald-500/5" : "from-red-500/15 to-red-500/5" },
    { label: "ROI", value: `${roi.toFixed(1)}%`, icon: Percent, color: roi >= 0 ? "text-primary" : "text-red-400", bg: "from-primary/15 to-primary/5" },
    { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: Target, color: "text-amber-400", bg: "from-amber-500/15 to-amber-500/5" },
  ];

  const maxBar = Math.max(totalCusto, totalReceita, 1);

  // Product select component
  const ProductSelect = ({ value, onChange, label = "Produto (opcional)" }: { value: string; onChange: (v: string) => void; label?: string }) => (
    <div>
      <Label>{label}</Label>
      {briefingProdutos.length > 0 ? (
        <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
          <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {briefingProdutos.map((p: any, i: number) => (
              <SelectItem key={i} value={p.nome || `Produto ${i + 1}`}>{p.nome || `Produto ${i + 1}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Nome do produto..." className="bg-secondary" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        {PERIOD_OPTIONS.map(p => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 text-xs", !customFrom && "text-muted-foreground")}>
                  {customFrom ? format(customFrom, "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 text-xs", !customTo && "text-muted-foreground")}>
                  {customTo ? format(customTo, "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Pixel/Events KPIs */}
      {eventKPIs.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "PageViews", value: eventKPIs.pageViews, icon: Globe, color: "text-blue-400" },
            { label: "ViewContent", value: eventKPIs.viewContent, icon: Eye, color: "text-violet-400" },
            { label: "AddToCart", value: eventKPIs.addToCart, icon: ShoppingCart, color: "text-amber-400" },
            { label: "Lead Capture", value: eventKPIs.leadCapture, icon: Users, color: "text-emerald-400" },
          ].map(k => (
            <Card key={k.label} className="bg-card border-border">
              <CardContent className="flex items-center gap-3 p-3">
                <div className={`p-1.5 rounded-lg bg-secondary/50 ${k.color}`}><k.icon className="h-3.5 w-3.5" /></div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p><p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const totalAdsAll = ads.reduce((s, a) => s + a.valor, 0);
          const showTotalContext = k.label === "ROAS" && dateRange && ads.length !== fAds.length;
          return (
            <Card key={k.label} className={`bg-gradient-to-br ${k.bg} border-border`}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`p-2 rounded-xl bg-background/50 ${k.color}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
                  <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
                  {showTotalContext && (
                    <p className="text-[9px] text-muted-foreground font-mono">total ads: {fmt(totalAdsAll)}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ads total context when filtered */}
      {dateRange && fAds.length !== ads.length && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Investido no período: <strong className="text-foreground">{fmt(totalAds)}</strong> — Total histórico: <strong className="text-foreground">{fmt(ads.reduce((s, a) => s + a.valor, 0))}</strong></span>
          {ads.length > 0 && (
            <span className="text-muted-foreground/70">({ads[ads.length - 1]?.data_ref?.substring(5)} → {ads[0]?.data_ref?.substring(5)})</span>
          )}
          <Button size="sm" variant="ghost" className="h-5 text-[10px] ml-auto" onClick={() => setPeriod("all")}>Ver tudo</Button>
        </div>
      )}

      {/* Visual comparison bar */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custo vs Receita</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Custo</span>
              <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                <div className="h-full bg-red-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalCusto / maxBar) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-red-400 w-28 text-right">{fmt(totalCusto)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Receita</span>
              <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                <div className="h-full bg-emerald-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalReceita / maxBar) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-emerald-400 w-28 text-right">{fmt(totalReceita)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="custos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="custos" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Custos</TabsTrigger>
          <TabsTrigger value="receitas" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Receitas</TabsTrigger>
          <TabsTrigger value="ads" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Ads</TabsTrigger>
          <TabsTrigger value="vendas" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Vendas</TabsTrigger>
          <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Produtos</TabsTrigger>
        </TabsList>

        {/* Custos Tab */}
        <TabsContent value="custos">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-red-400 font-sans flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Custos do Projeto
              </CardTitle>
              <Button size="sm" variant="outline" onClick={openCostFormForNew}><Plus className="h-3.5 w-3.5 mr-1" /> Custo</Button>
            </CardHeader>
            <CardContent>
              {costs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum custo registrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Cat.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">
                          {c.nome}
                          {c.beneficiario && <span className="text-[10px] text-muted-foreground ml-1">({c.beneficiario})</span>}
                          <Badge variant="outline" className="ml-2 text-[9px] py-0">{c.tipo_recorrencia || (c.recorrente ? "mensal" : "pontual")}</Badge>
                        </TableCell>
                        <TableCell>{c.produto_nome && <Badge variant="outline" className="text-[10px]">{c.produto_nome}</Badge>}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{c.categoria}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-400">
                          {c.moeda === "USD" ? `$${c.valor.toFixed(2)}` : fmt(c.valor)}
                        </TableCell>
                        <TableCell>
                          {c.documento_url && (
                            <a href={c.documento_url} target="_blank" rel="noopener noreferrer" title="Ver documento">
                              <Paperclip className="h-3.5 w-3.5 text-primary hover:text-primary/80" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-primary" onClick={() => openCostFormForEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => deleteCost(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receitas Tab */}
        <TabsContent value="receitas">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-emerald-400 font-sans flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Receitas Manuais
              </CardTitle>
              <Button size="sm" variant="outline" onClick={openRevFormForNew}><Plus className="h-3.5 w-3.5 mr-1" /> Receita</Button>
            </CardHeader>
            <CardContent>
              {revenues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma receita registrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Data Pgto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenues.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.descricao}</TableCell>
                        <TableCell>{r.produto_nome && <Badge variant="outline" className="text-[10px]">{r.produto_nome}</Badge>}</TableCell>
                        <TableCell>{r.plataforma && <Badge variant="secondary" className="text-[10px]">{r.plataforma}</Badge>}</TableCell>
                        <TableCell className="text-xs font-mono">{r.data_pagamento ? new Date(r.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{(r as any).quantidade || 1}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-400">{fmt(r.valor)}</TableCell>
                        <TableCell className={`text-right font-mono text-xs ${(r.valor * ((r as any).quantidade || 1) - ((r as any).custo_produto || 0)) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmt(r.valor * ((r as any).quantidade || 1) - ((r as any).custo_produto || 0))}
                        </TableCell>
                        <TableCell>
                          {r.documento_url && (
                            <a href={r.documento_url} target="_blank" rel="noopener noreferrer" title="Ver documento">
                              <Paperclip className="h-3.5 w-3.5 text-primary hover:text-primary/80" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-primary" onClick={() => openRevFormForEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => deleteRevenue(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ads Tab */}
        <TabsContent value="ads">
          {/* Info banner */}
          <Card className={`mb-4 ${project?.data?.facebook_ad_account_id && (project?.data?.facebook_marketing_token || project?.data?.facebook_access_token) ? "border-emerald-500/30 bg-emerald-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
            <CardContent className="p-3 flex items-start gap-3">
              <Megaphone className={`h-4 w-4 mt-0.5 shrink-0 ${project?.data?.facebook_ad_account_id && (project?.data?.facebook_marketing_token || project?.data?.facebook_access_token) ? "text-emerald-400" : "text-blue-400"}`} />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">
                  {project?.data?.facebook_ad_account_id && (project?.data?.facebook_marketing_token || project?.data?.facebook_access_token) ? (
                    <><strong className="text-emerald-400">✅ Facebook conectado.</strong> Sincronize ou importe CSV. Use IA para gerar campanhas e analisar performance.{!project?.data?.facebook_marketing_token && <span className="text-amber-400 ml-1">⚠ Usando token CAPI — recomendado usar token Marketing API (Graph Explorer).</span>}</>
                  ) : (
                    <><strong className="text-foreground">Como importar?</strong> Configure o Token Marketing API (Graph Explorer) e Ad Account ID nas integrações, ou importe CSV manualmente.</>
                  )}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="text-xs text-primary" onClick={() => setShowFbGuide(true)}>Como configurar?</Button>
              </div>
            </CardContent>
          </Card>

          {/* Empty ads warning */}
          {fAds.length === 0 && ads.length > 0 && period !== "all" && (
            <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-300">Nenhum dado de Ads neste período</p>
                  <p className="text-xs text-muted-foreground">
                    Dados existem entre {ads[ads.length - 1]?.data_ref?.slice(0, 10)} e {ads[0]?.data_ref?.slice(0, 10)}. Selecione "Todo período" para ver tudo.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setPeriod("all")}>
                  Todo período
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Last sync info */}
          {ads.length > 0 && (
            <p className="text-[10px] text-muted-foreground mb-2">
              Último dado: {ads[0]?.data_ref} · {ads.length} registros no banco
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {project?.data?.facebook_ad_account_id && (project?.data?.facebook_marketing_token || project?.data?.facebook_access_token) && (
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="border-green-500/40 text-green-400 text-[10px] gap-1 py-0.5">
                  <Sparkles className="h-3 w-3" /> Auto ⚡
                  {project?.data?.facebook_last_sync && (
                    <span className="text-muted-foreground ml-1">
                      {(() => { try { const d = new Date(project.data.facebook_last_sync); const now = new Date(); const diff = Math.floor((now.getTime() - d.getTime()) / 60000); return diff < 60 ? `${diff}min` : diff < 1440 ? `${Math.floor(diff/60)}h` : format(d, "dd/MM HH:mm"); } catch { return ""; } })()}
                    </span>
                  )}
                </Badge>
                <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={async () => {
                  toast.info("Sincronizando com Facebook...");
                  try {
                    const now = new Date();
                    const syncBody: any = { project_id: projectId };
                    if (dateRange) {
                      syncBody.date_from = format(dateRange.start, "yyyy-MM-dd");
                      syncBody.date_to = format(dateRange.end, "yyyy-MM-dd");
                    } else {
                      syncBody.date_from = format(startOfMonth(now), "yyyy-MM-dd");
                      syncBody.date_to = format(now, "yyyy-MM-dd");
                    }
                    const { data, error } = await supabase.functions.invoke("facebook-ads-sync", { body: syncBody });
                    if (error) throw error;
                    if (data?.error) { toast.error(data.error); return; }
                    toast.success(`✅ ${data.imported} registros importados, ${data.creatives} criativos sincronizados`);
                    loadData();
                  } catch (e: any) { toast.error("Erro ao sincronizar: " + (e.message || e)); }
                }}>
                  <Globe className="h-3.5 w-3.5 mr-1" /> Sync Manual
                </Button>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowAdsImport(true)}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Importar CSV
            </Button>
            <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" onClick={() => setShowCampaignGen(true)} disabled={generatingCampaigns}>
              {generatingCampaigns ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Gerar Campanha IA
            </Button>
            <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={handleAnalyzePerformance} disabled={analyzingAds || ads.length === 0}>
              {analyzingAds ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
              Analisar Performance
            </Button>
          </div>

          {/* Ads Sub-tabs */}
          <Tabs value={adsSubTab} onValueChange={setAdsSubTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="dados" className="gap-1 text-xs"><Megaphone className="h-3 w-3" /> Dados</TabsTrigger>
              <TabsTrigger value="criativos" className="gap-1 text-xs"><Image className="h-3 w-3" /> Criativos ({creatives.length})</TabsTrigger>
              <TabsTrigger value="relatorios" className="gap-1 text-xs"><BarChart3 className="h-3 w-3" /> Relatórios ({savedReports.length})</TabsTrigger>
              {campaignDrafts && <TabsTrigger value="drafts" className="gap-1 text-xs"><Sparkles className="h-3 w-3" /> Drafts IA</TabsTrigger>}
            </TabsList>

            {/* Dados sub-tab */}
            <TabsContent value="dados">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-wider text-blue-400 font-sans flex items-center gap-2">
                    <Megaphone className="h-4 w-4" /> Investimento em Ads
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ads.length > 0 && (() => {
                    const totalImpr = fAds.reduce((s, a) => s + a.impressoes, 0);
                    const totalAlcance = fAds.reduce((s, a) => s + (a.alcance || 0), 0);
                    const avgFreq = fAds.length > 0 ? fAds.reduce((s, a) => s + (a.frequencia || 0), 0) / fAds.length : 0;
                    const cpm = totalImpr > 0 ? (totalAds / totalImpr) * 1000 : 0;
                    const cpa = totalCompras > 0 ? totalAds / totalCompras : 0;
                    const adsKpis = [
                      { label: "Investido", value: fmt(totalAds), color: "text-blue-400" },
                      { label: "CPC", value: fmt(cpc), color: "text-amber-400" },
                      { label: "CPL", value: fmt(cpl), color: "text-violet-400" },
                      { label: "Compras", value: String(totalCompras), color: "text-emerald-400" },
                      { label: "CPM", value: fmt(cpm), color: "text-cyan-400" },
                      { label: "Freq. Média", value: avgFreq.toFixed(2), color: "text-orange-400" },
                      { label: "Alcance Total", value: totalAlcance.toLocaleString(), color: "text-pink-400" },
                      { label: "CPA", value: totalCompras > 0 ? fmt(cpa) : "—", color: "text-red-400" },
                    ];
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {adsKpis.map(k => (
                          <div key={k.label} className="rounded-lg border border-border p-3 bg-secondary/20">
                            <p className="text-[10px] text-muted-foreground uppercase">{k.label}</p>
                            <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {ads.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <Megaphone className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">Nenhum dado de Ads importado</p>
                    </div>
                  ) : (() => {
                    // Group by conjunto_anuncios
                    const groups = new Map<string, AdsSpend[]>();
                    fAds.forEach(a => {
                      const key = a.conjunto_anuncios || "Sem conjunto";
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(a);
                    });
                    const groupEntries = Array.from(groups.entries());
                    
                    if (groupEntries.length > 1) {
                      return (
                        <Accordion type="multiple" className="space-y-2">
                          {groupEntries.map(([groupName, items]) => {
                            const gTotal = items.reduce((s, a) => s + a.valor, 0);
                            const gImpr = items.reduce((s, a) => s + a.impressoes, 0);
                            const gClicks = items.reduce((s, a) => s + a.cliques, 0);
                            const gCompras = items.reduce((s, a) => s + (a.compras || 0), 0);
                            return (
                              <AccordionItem key={groupName} value={groupName} className="border border-border rounded-lg px-3">
                                <AccordionTrigger className="text-xs hover:no-underline py-3">
                                  <div className="flex items-center gap-3 flex-1">
                                    <span className="font-medium truncate max-w-[200px]">{groupName}</span>
                                    <div className="flex gap-3 ml-auto text-[10px] font-mono text-muted-foreground">
                                      <span className="text-blue-400">{fmt(gTotal)}</span>
                                      <span>{gImpr.toLocaleString()} impr</span>
                                      <span>{gClicks} cliques</span>
                                      <span className="text-emerald-400">{gCompras} compras</span>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Campanha</TableHead><TableHead>Data</TableHead><TableHead>Valor</TableHead>
                                        <TableHead>Impr.</TableHead><TableHead>Cliques</TableHead><TableHead>CTR</TableHead>
                                        <TableHead>Compras</TableHead><TableHead className="w-8"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {items.slice(0, 30).map(a => (
                                        <TableRow key={a.id}>
                                          <TableCell className="text-xs max-w-[180px] truncate">{a.campanha || "—"}</TableCell>
                                          <TableCell className="text-xs font-mono">{a.data_ref}</TableCell>
                                          <TableCell className="text-xs font-mono text-blue-400">{fmt(a.valor)}</TableCell>
                                          <TableCell className="text-xs font-mono">{a.impressoes.toLocaleString()}</TableCell>
                                          <TableCell className="text-xs font-mono">{a.cliques}</TableCell>
                                          <TableCell className="text-xs font-mono">{(a.ctr || 0).toFixed(2)}%</TableCell>
                                          <TableCell className="text-xs font-mono">{a.compras || 0}</TableCell>
                                          <TableCell>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => deleteAd(a.id)}><Trash2 className="h-3 w-3" /></Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      );
                    }
                    
                    return (
                      <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Campanha</TableHead><TableHead>Data</TableHead><TableHead>Valor</TableHead>
                              <TableHead>Impr.</TableHead><TableHead>Cliques</TableHead><TableHead>CTR</TableHead>
                              <TableHead>Compras</TableHead><TableHead className="w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fAds.slice(0, 50).map(a => (
                              <TableRow key={a.id}>
                                <TableCell className="text-xs max-w-[180px] truncate">{a.campanha || "—"}</TableCell>
                                <TableCell className="text-xs font-mono">{a.data_ref}</TableCell>
                                <TableCell className="text-xs font-mono text-blue-400">{fmt(a.valor)}</TableCell>
                                <TableCell className="text-xs font-mono">{a.impressoes.toLocaleString()}</TableCell>
                                <TableCell className="text-xs font-mono">{a.cliques}</TableCell>
                                <TableCell className="text-xs font-mono">{(a.ctr || 0).toFixed(2)}%</TableCell>
                                <TableCell className="text-xs font-mono">{a.compras || 0}</TableCell>
                                <TableCell>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => deleteAd(a.id)}><Trash2 className="h-3 w-3" /></Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {fAds.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">...e mais {fAds.length - 50} registros</p>}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Criativos sub-tab */}
            <TabsContent value="criativos">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm uppercase tracking-wider text-violet-400 font-sans flex items-center gap-2">
                      <Image className="h-4 w-4" /> Galeria de Criativos
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Buscar criativo..."
                        className="h-7 text-xs w-40 bg-secondary"
                        value={creativeSearch}
                        onChange={e => setCreativeSearch(e.target.value)}
                      />
                      <Select value={creativeFilter} onValueChange={setCreativeFilter}>
                        <SelectTrigger className="h-7 text-xs w-28 bg-secondary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="active">Ativos</SelectItem>
                          <SelectItem value="inactive">Inativos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {creatives.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <Image className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">Nenhum criativo sincronizado</p>
                      <p className="text-xs text-muted-foreground/70">Sincronize com o Facebook para ver os criativos aqui</p>
                    </div>
                  ) : (() => {
                    const searchLower = creativeSearch.toLowerCase();
                    const filtered = creatives.filter((c: any) => {
                      const nameMatch = !creativeSearch || (c.name || c.ad_name || "").toLowerCase().includes(searchLower) || (c.body || "").toLowerCase().includes(searchLower);
                      const statusMatch = creativeFilter === "all" || (creativeFilter === "active" ? c.status === "ACTIVE" : c.status !== "ACTIVE");
                      return nameMatch && statusMatch;
                    });
                    const activeCreatives = filtered.filter((c: any) => c.status === "ACTIVE");
                    const inactiveCreatives = filtered.filter((c: any) => c.status !== "ACTIVE");
                    const totalActive = creatives.filter((c: any) => c.status === "ACTIVE").length;
                    const totalInactive = creatives.length - totalActive;
                    
                    const renderCreativeCard = (c: any, i: number, isActive: boolean) => {
                      const adMatch = fAds.filter(a => a.anuncio && (c.name || c.ad_name) && (a.anuncio.includes(c.name) || a.anuncio.includes(c.ad_name)));
                      const cImpr = adMatch.reduce((s, a) => s + a.impressoes, 0);
                      const cClicks = adMatch.reduce((s, a) => s + a.cliques, 0);
                      const cSpend = adMatch.reduce((s, a) => s + a.valor, 0);
                      const cCTR = cImpr > 0 ? (cClicks / cImpr) * 100 : 0;
                      const perfBadge = cCTR > 2 ? { label: "Top", color: "bg-emerald-500/20 text-emerald-400" } : cCTR >= 1 ? { label: "Médio", color: "bg-amber-500/20 text-amber-400" } : cImpr > 0 ? { label: "Baixo", color: "bg-red-500/20 text-red-400" } : null;
                      const imgSrc = c.image_url || c.thumbnail_url;
                      
                      return (
                        <Card key={`${c.name}-${i}`} className={cn("bg-secondary/20 border-border overflow-hidden transition-all", !isActive && "opacity-50 grayscale-[30%]", isActive && "ring-1 ring-emerald-500/30")}>
                          {imgSrc && (
                            <div className="aspect-video bg-secondary/50 overflow-hidden relative">
                              <img src={imgSrc} alt={c.name || "Criativo"} className="w-full h-full object-cover" loading="lazy" />
                              <div className="absolute top-2 left-2">
                                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-muted/80 text-muted-foreground")}>
                                  {isActive ? "🟢 Ativo" : "⏸ Inativo"}
                                </span>
                              </div>
                              {perfBadge && (
                                <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${perfBadge.color}`}>{perfBadge.label}</span>
                              )}
                            </div>
                          )}
                          <CardContent className="p-3 space-y-2">
                            <p className="text-xs font-medium truncate">{c.name || c.ad_name || `Criativo ${i + 1}`}</p>
                            {c.body && <p className="text-[10px] text-muted-foreground line-clamp-3">{c.body}</p>}
                            {cImpr > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                                <div className="rounded bg-secondary/50 p-1.5">
                                  <span className="text-muted-foreground">Impr.</span>
                                  <span className="ml-1 text-foreground">{cImpr.toLocaleString()}</span>
                                </div>
                                <div className="rounded bg-secondary/50 p-1.5">
                                  <span className="text-muted-foreground">Cliques</span>
                                  <span className="ml-1 text-foreground">{cClicks}</span>
                                </div>
                                <div className="rounded bg-secondary/50 p-1.5">
                                  <span className="text-muted-foreground">Gasto</span>
                                  <span className="ml-1 text-blue-400">{fmt(cSpend)}</span>
                                </div>
                                <div className="rounded bg-secondary/50 p-1.5">
                                  <span className="text-muted-foreground">CTR</span>
                                  <span className="ml-1 text-primary">{cCTR.toFixed(2)}%</span>
                                </div>
                              </div>
                            )}
                            <div className="flex gap-1 flex-wrap">
                              {c.title && <Badge variant="outline" className="text-[9px]">{c.title}</Badge>}
                              {(c.body || c.title) && (
                                <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => {
                                  navigator.clipboard.writeText([c.title, c.body].filter(Boolean).join("\n\n"));
                                  toast.success("Texto copiado!");
                                }}>
                                  <Copy className="h-2.5 w-2.5 mr-0.5" /> Copiar
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    };

                    return (
                      <div className="space-y-4">
                        <p className="text-[10px] text-muted-foreground">{totalActive} ativos · {totalInactive} inativos · {filtered.length} exibidos</p>
                        {activeCreatives.length > 0 && creativeFilter !== "inactive" && (
                          <div>
                            <p className="text-xs font-semibold text-emerald-400 mb-2">🟢 Ativos ({activeCreatives.length})</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {activeCreatives.map((c: any, i: number) => renderCreativeCard(c, i, true))}
                            </div>
                          </div>
                        )}
                        {inactiveCreatives.length > 0 && creativeFilter !== "active" && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">⏸ Inativos ({inactiveCreatives.length})</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {inactiveCreatives.map((c: any, i: number) => renderCreativeCard(c, i, false))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Relatórios sub-tab */}
            <TabsContent value="relatorios">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  {savedReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum relatório salvo</p>
                      <p className="text-xs">Use "Analisar Performance" e salve o resultado</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedReports.map((r: any) => (
                        <div key={r.id} className="rounded-lg border border-border p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div>
                            <p className="text-sm font-medium">{r.titulo}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.model_used || "IA"}
                              {r.period_start && ` · ${r.period_start} → ${r.period_end}`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => setViewingReport(r)}>Ver</Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => {
                              await supabase.from("imphq_ads_reports").delete().eq("id", r.id);
                              toast.success("Removido");
                              loadReports();
                            }}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* Drafts IA sub-tab */}
            {campaignDrafts && (
              <TabsContent value="drafts">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Campanhas Geradas por IA
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(campaignDrafts, null, 2));
                      toast.success("Drafts copiados!");
                    }}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar JSON
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {campaignDrafts.resumo_estrategico && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-4">
                        <p className="text-xs font-semibold text-primary mb-1">📋 Resumo Estratégico</p>
                        <p className="text-xs text-muted-foreground">{campaignDrafts.resumo_estrategico}</p>
                      </div>
                    )}
                    <Accordion type="multiple" className="space-y-2">
                      {(campaignDrafts.campaigns || []).map((camp: any, i: number) => (
                        <AccordionItem key={i} value={`camp-${i}`} className="border border-border rounded-lg px-4">
                          <AccordionTrigger className="text-sm hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                              <Badge variant="outline" className="text-[9px] shrink-0">{camp.objetivo}</Badge>
                              <span className="font-medium">{camp.nome}</span>
                              <Badge variant="secondary" className="text-[9px] ml-auto shrink-0">{fmt(camp.budget_diario)}/dia</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pt-2">
                            {/* Público */}
                            {camp.publico && (
                              <div className="rounded-lg bg-secondary/30 p-3 space-y-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Público-alvo</p>
                                <p className="text-xs">📍 {camp.publico.genero} | {camp.publico.idade_min}-{camp.publico.idade_max} anos</p>
                                {camp.publico.interesses?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {camp.publico.interesses.map((int: string, j: number) => (
                                      <Badge key={j} variant="outline" className="text-[9px]">{int}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Copies */}
                            {camp.copies?.map((copy: any, j: number) => (
                              <div key={j} className="rounded-lg border border-border p-3 space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Variação {j + 1}</p>
                                  <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => {
                                    navigator.clipboard.writeText(`${copy.headline}\n\n${copy.texto_primario}\n\nCTA: ${copy.cta}`);
                                    toast.success("Copy copiada!");
                                  }}>
                                    <Copy className="h-2.5 w-2.5 mr-0.5" /> Copiar
                                  </Button>
                                </div>
                                <p className="text-xs font-bold text-foreground">{copy.headline}</p>
                                <p className="text-xs text-muted-foreground">{copy.texto_primario}</p>
                                <Badge className="text-[9px]">{copy.cta}</Badge>
                              </div>
                            ))}
                            {camp.sugestao_criativo && (
                              <p className="text-xs text-muted-foreground"><strong>Criativo sugerido:</strong> {camp.sugestao_criativo}</p>
                            )}
                            {camp.justificativa && (
                              <p className="text-xs text-muted-foreground italic">💡 {camp.justificativa}</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        {/* Vendas Tab */}
        <TabsContent value="vendas">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wider text-emerald-400 font-sans flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Vendas Reais ({vendas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vendas.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
                  <p className="text-xs text-muted-foreground/70">Vendas aparecem automaticamente via webhook ou importação</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg border border-border p-3 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground uppercase">Total Vendas</p>
                      <p className="text-lg font-mono font-bold text-emerald-400">{fmt(totalVendas)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground uppercase">Quantidade</p>
                      <p className="text-lg font-mono font-bold text-foreground">{vendas.length}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground uppercase">Ticket Médio</p>
                      <p className="text-lg font-mono font-bold text-amber-400">{fmt(vendas.length > 0 ? totalVendas / vendas.length : 0)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendas.slice(0, 50).map(v => (
                          <TableRow key={v.id}>
                            <TableCell className="text-sm font-medium">{v.produto_nome}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">{v.plataforma}</Badge></TableCell>
                            <TableCell className="font-mono text-sm text-emerald-400">{fmt(v.valor)}</TableCell>
                            <TableCell className="text-xs font-mono">{new Date(v.data_venda).toLocaleDateString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {vendas.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">...e mais {vendas.length - 50} vendas</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Produtos Tab */}
        <TabsContent value="produtos">
          <FinancasProdutos vendas={vendas} briefingProdutos={briefingProdutos} revenues={revenues} costs={costs} ads={ads} />
        </TabsContent>
      </Tabs>

      {/* Cost Form Dialog (Add / Edit) */}
      <Dialog open={showCostForm} onOpenChange={(open) => { setShowCostForm(open); if (!open) setEditingCost(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCost ? "Editar Custo" : "Adicionar Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={costForm.nome} onChange={e => setCostForm({ ...costForm, nome: e.target.value })} placeholder="Ex: ClickFunnels" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={costForm.categoria} onValueChange={v => setCostForm({ ...costForm, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COST_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Moeda</Label>
                <Select value={costForm.moeda} onValueChange={v => setCostForm({ ...costForm, moeda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Valor</Label><Input type="number" step="0.01" value={costForm.valor} onChange={e => setCostForm({ ...costForm, valor: e.target.value })} placeholder="0.00" /></div>
            <ProductSelect value={costForm.produto_nome} onChange={v => setCostForm({ ...costForm, produto_nome: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Beneficiário</Label><Input value={costForm.beneficiario} onChange={e => setCostForm({ ...costForm, beneficiario: e.target.value })} placeholder="Ex: João (sócio), Freelancer X..." className="bg-secondary" /></div>
              <div>
                <Label>Recorrência</Label>
                <Select value={costForm.tipo_recorrencia} onValueChange={v => setCostForm({ ...costForm, tipo_recorrencia: v, recorrente: v !== "pontual" })}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="pontual">Pontual (único)</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Chave PIX / Info</Label><Input value={costForm.pix_info} onChange={e => setCostForm({ ...costForm, pix_info: e.target.value })} placeholder="Chave PIX, comprovante..." className="bg-secondary" /></div>
              <div><Label>Data Pagamento</Label><Input type="date" value={costForm.data_pagamento} onChange={e => setCostForm({ ...costForm, data_pagamento: e.target.value })} className="bg-secondary" /></div>
            </div>

            {/* Document upload */}
            <div className="space-y-2">
              <Label>Documento (NF, comprovante)</Label>
              <div className="flex items-center gap-2">
                <FileUpload
                  bucket="project-docs"
                  path={`costs/${projectId}`}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  label="Anexar"
                  onUpload={(url) => setCostForm({ ...costForm, documento_url: url })}
                />
                {costForm.documento_url && (
                  <a href={costForm.documento_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Ver anexo
                  </a>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveCost}>{editingCost ? "Salvar" : "Adicionar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revenue Form Dialog (Add / Edit) */}
      <Dialog open={showRevForm} onOpenChange={(open) => { setShowRevForm(open); if (!open) setEditingRevenue(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRevenue ? "Editar Receita" : "Adicionar Receita"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={revForm.descricao} onChange={e => setRevForm({ ...revForm, descricao: e.target.value })} placeholder="Ex: Venda curso X" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fonte</Label>
                <Select value={revForm.fonte} onValueChange={v => setRevForm({ ...revForm, fonte: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REV_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data Ref.</Label><Input type="date" value={revForm.data_ref} onChange={e => setRevForm({ ...revForm, data_ref: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={revForm.valor} onChange={e => setRevForm({ ...revForm, valor: e.target.value })} placeholder="0.00" /></div>
              <div>
                <Label>Plataforma</Label>
                <Select value={revForm.plataforma || "__none__"} onValueChange={v => setRevForm({ ...revForm, plataforma: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ProductSelect value={revForm.produto_nome} onChange={v => {
              const prod = briefingProdutos.find((p: any) => p.nome === v);
              setRevForm({ ...revForm, produto_nome: v, imposto_pct: prod?.imposto_pct ? String(prod.imposto_pct) : revForm.imposto_pct });
            }} />
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Quantidade de Vendas</Label><Input type="number" min="1" value={revForm.quantidade} onChange={e => setRevForm({ ...revForm, quantidade: e.target.value })} placeholder="1" /></div>
              <div><Label>Custo do Produto (R$)</Label><Input type="number" step="0.01" value={revForm.custo_produto} onChange={e => setRevForm({ ...revForm, custo_produto: e.target.value })} placeholder="0.00" /></div>
              <div><Label>% Imposto</Label><Input type="number" step="0.01" value={revForm.imposto_pct} onChange={e => setRevForm({ ...revForm, imposto_pct: e.target.value })} placeholder="Ex: 6.49" /></div>
            </div>
            {/* Calculated summary */}
            {(parseFloat(revForm.valor) > 0) && (() => {
              const recTotal = parseFloat(revForm.valor) * (parseInt(revForm.quantidade) || 1);
              const custo = parseFloat(revForm.custo_produto) || 0;
              const impPct = parseFloat(revForm.imposto_pct) || 0;
              const imposto = recTotal * (impPct / 100);
              const lucroBruto = recTotal - custo;
              const lucroLiquido = lucroBruto - imposto;
              return (
                <div className="rounded-lg border border-border p-3 bg-secondary/20 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Receita Total</span>
                    <span className="font-mono text-emerald-400">{fmt(recTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Lucro Bruto</span>
                    <span className={`font-mono ${lucroBruto >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(lucroBruto)}</span>
                  </div>
                  {impPct > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Imposto ({impPct}%)</span>
                      <span className="font-mono text-orange-400">-{fmt(imposto)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-border pt-1">
                    <span className="text-muted-foreground font-semibold">Lucro Líquido</span>
                    <span className={`font-mono font-semibold ${lucroLiquido >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(lucroLiquido)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Ticket Médio</span>
                    <span className="font-mono text-amber-400">{fmt(parseFloat(revForm.valor))}</span>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Pagamento</Label><Input type="date" value={revForm.data_pagamento} onChange={e => setRevForm({ ...revForm, data_pagamento: e.target.value })} /></div>
              <div><Label>PIX Info (chave/comprovante)</Label><Input value={revForm.pix_info} onChange={e => setRevForm({ ...revForm, pix_info: e.target.value })} placeholder="Chave PIX, nº comprovante..." /></div>
            </div>
            {/* Document upload */}
            <div className="space-y-2">
              <Label>Documento (NF, comprovante)</Label>
              <div className="flex items-center gap-2">
                <FileUpload
                  bucket="project-docs"
                  path={`revenue/${projectId}`}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  label="Anexar"
                  onUpload={(url) => setRevForm({ ...revForm, documento_url: url })}
                />
                {revForm.documento_url && (
                  <a href={revForm.documento_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Ver anexo
                  </a>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveRevenue}>{editingRevenue ? "Salvar" : "Adicionar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ads Import Dialog */}
      <AdsImportDialog
        open={showAdsImport}
        onOpenChange={setShowAdsImport}
        projects={projects}
        onImported={loadData}
      />

      {/* Facebook Setup Guide Dialog */}
      <Dialog open={showFbGuide} onOpenChange={setShowFbGuide}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🔧 Como configurar o Facebook Ads</DialogTitle></DialogHeader>
          <div className="space-y-6 text-sm">
            {/* Step 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <h3 className="font-semibold text-foreground">Criar App no Meta for Developers</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-8">
                <li>Acesse <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">developers.facebook.com/apps</a></li>
                <li>Clique em <strong>"Criar App"</strong> → tipo <strong>"Negócios"</strong></li>
                <li>Vincule ao seu <strong>Business Manager</strong></li>
                <li>Na seção "Adicionar Produtos", ative <strong>"Marketing API"</strong></li>
              </ol>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <h3 className="font-semibold text-foreground">Obter o Ad Account ID</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-8">
                <li>Acesse <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Business Settings → Ad Accounts</a></li>
                <li>Copie o número da conta (ex: <code className="bg-secondary px-1 rounded text-xs">123456789</code>)</li>
                <li>Cole no campo <strong>"Ad Account ID"</strong> com prefixo <code className="bg-secondary px-1 rounded text-xs">act_</code></li>
                <li>Resultado: <code className="bg-secondary px-1 rounded text-xs">act_123456789</code></li>
              </ol>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <h3 className="font-semibold text-foreground">Gerar Access Token de longa duração</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-8">
                <li>No Meta for Developers → seu App → <strong>Tools → Graph API Explorer</strong></li>
                <li>Selecione permissões: <code className="bg-secondary px-1 rounded text-xs">ads_read</code>, <code className="bg-secondary px-1 rounded text-xs">ads_management</code>, <code className="bg-secondary px-1 rounded text-xs">read_insights</code></li>
                <li>Clique em <strong>"Generate Access Token"</strong> (token de curta duração)</li>
                <li>Para trocar por token de <strong>longa duração</strong> (60 dias), acesse no navegador:</li>
              </ol>
              <div className="bg-secondary/50 rounded-lg p-3 ml-8 text-xs font-mono text-muted-foreground break-all">
                https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<span className="text-primary">SEU_APP_ID</span>&client_secret=<span className="text-primary">SEU_APP_SECRET</span>&fb_exchange_token=<span className="text-primary">TOKEN_CURTO</span>
              </div>
              <p className="text-xs text-muted-foreground ml-8">O <strong>App ID</strong> e <strong>App Secret</strong> estão em Settings → Basic no painel do app.</p>
              <p className="text-xs text-muted-foreground ml-8">Cole o token retornado no campo <strong>"Access Token CAPI"</strong> na aba de integrações do projeto.</p>
            </div>

            {/* Step 4 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                <h3 className="font-semibold text-foreground">Testar a sincronização</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-8">
                <li>Volte para a aba <strong>Ads</strong> neste projeto</li>
                <li>Clique em <strong>"Sincronizar Facebook"</strong></li>
                <li>Verifique se os dados de campanhas aparecem na tabela</li>
              </ol>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-400"><strong>⚠️ Importante:</strong> O token de longa duração dura ~60 dias. Após expirar, será necessário gerar um novo. O token <strong>nunca</strong> é exposto publicamente — é armazenado apenas no JSONB do projeto.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Generation Dialog */}
      <Dialog open={showCampaignGen} onOpenChange={setShowCampaignGen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Gerar Campanhas com IA</DialogTitle>
            <DialogDescription>Descreva o que você quer ou deixe a IA decidir com base no contexto do projeto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo de IA</Label>
              <Select value={campaignModel} onValueChange={setCampaignModel}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Descrição (opcional)</Label>
              <Textarea value={campaignPrompt} onChange={e => setCampaignPrompt(e.target.value)} placeholder="Ex: 3 campanhas de conversão para mulheres 25-45 interessadas em skincare..." className="bg-secondary min-h-[80px]" />
            </div>
            <p className="text-[10px] text-muted-foreground">A IA usará avatar, produtos, copy arsenal e dados de ads como contexto.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowCampaignGen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleGenerateCampaigns} disabled={generatingCampaigns} className="gap-1.5">
              {generatingCampaigns ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generatingCampaigns ? "Gerando..." : "Gerar Campanhas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-amber-400" /> Análise de Performance</DialogTitle>
            <DialogDescription>Relatório gerado por IA com base nos dados reais de ads e vendas.</DialogDescription>
          </DialogHeader>
          {analyzingAds ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando dados...</p>
            </div>
          ) : adsAnalysis ? (
            <div className="space-y-4">
              {adsAnalysis.resumo_geral && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary mb-1">📊 Resumo Geral</p>
                  <p className="text-xs text-muted-foreground">{adsAnalysis.resumo_geral}</p>
                </div>
              )}
              {adsAnalysis.melhor_campanha && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Melhor: {adsAnalysis.melhor_campanha.nome}</p>
                  <p className="text-xs text-muted-foreground">{adsAnalysis.melhor_campanha.motivo}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">{adsAnalysis.melhor_campanha.metricas}</p>
                </div>
              )}
              {adsAnalysis.pior_campanha && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Pior: {adsAnalysis.pior_campanha.nome}</p>
                  <p className="text-xs text-muted-foreground">{adsAnalysis.pior_campanha.motivo}</p>
                  <p className="text-[10px] text-primary mt-1">💡 {adsAnalysis.pior_campanha.sugestao}</p>
                </div>
              )}
              {adsAnalysis.alertas?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Alertas</p>
                  <div className="space-y-2">
                    {adsAnalysis.alertas.map((a: any, i: number) => (
                      <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                        <Badge variant="outline" className="text-[9px] mb-1">{a.tipo}</Badge>
                        <p className="text-xs text-muted-foreground">{a.mensagem}</p>
                        <p className="text-[10px] text-primary mt-1">→ {a.acao_sugerida}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {adsAnalysis.otimizacoes?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Otimizações</p>
                  <div className="space-y-2">
                    {adsAnalysis.otimizacoes.map((o: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border p-2">
                        <p className="text-xs font-medium">{o.area}</p>
                        <p className="text-xs text-muted-foreground">{o.recomendacao}</p>
                        <p className="text-[10px] text-emerald-400 mt-1">Impacto: {o.impacto_esperado}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {adsAnalysis.redistribuicao_budget && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">💰 Redistribuição de Budget</p>
                  <p className="text-xs text-muted-foreground">{adsAnalysis.redistribuicao_budget}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(adsAnalysis, null, 2));
                  toast.success("Análise copiada!");
                }}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar Relatório
                </Button>
                <Button size="sm" className="flex-1" onClick={() => { saveReport(); setShowAnalysis(false); }}>
                  💾 Salvar Relatório
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* View Saved Report Dialog */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => { if (!open) setViewingReport(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-amber-400" /> {viewingReport?.titulo}</DialogTitle>
            <DialogDescription>
              {viewingReport?.created_at && new Date(viewingReport.created_at).toLocaleDateString("pt-BR")} · {viewingReport?.model_used || "IA"}
              {viewingReport?.period_start && ` · ${viewingReport.period_start} → ${viewingReport.period_end}`}
            </DialogDescription>
          </DialogHeader>
          {viewingReport?.report_data && (() => {
            const rd = viewingReport.report_data;
            return (
              <div className="space-y-4">
                {rd.resumo_geral && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary mb-1">📊 Resumo Geral</p>
                    <p className="text-xs text-muted-foreground">{rd.resumo_geral}</p>
                  </div>
                )}
                {rd.melhor_campanha && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Melhor: {rd.melhor_campanha.nome}</p>
                    <p className="text-xs text-muted-foreground">{rd.melhor_campanha.motivo}</p>
                  </div>
                )}
                {rd.pior_campanha && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Pior: {rd.pior_campanha.nome}</p>
                    <p className="text-xs text-muted-foreground">{rd.pior_campanha.motivo}</p>
                  </div>
                )}
                {rd.alertas?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-400 mb-2">⚠ Alertas</p>
                    {rd.alertas.map((a: any, i: number) => (
                      <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 mb-2">
                        <Badge variant="outline" className="text-[9px] mb-1">{a.tipo}</Badge>
                        <p className="text-xs text-muted-foreground">{a.mensagem}</p>
                        <p className="text-[10px] text-primary mt-1">→ {a.acao_sugerida}</p>
                      </div>
                    ))}
                  </div>
                )}
                {rd.otimizacoes?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-primary mb-2">💡 Otimizações</p>
                    {rd.otimizacoes.map((o: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border p-2 mb-2">
                        <p className="text-xs font-medium">{o.area}</p>
                        <p className="text-xs text-muted-foreground">{o.recomendacao}</p>
                        <p className="text-[10px] text-emerald-400 mt-1">Impacto: {o.impacto_esperado}</p>
                      </div>
                    ))}
                  </div>
                )}
                {rd.redistribuicao_budget && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">💰 Redistribuição de Budget</p>
                    <p className="text-xs text-muted-foreground">{rd.redistribuicao_budget}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
