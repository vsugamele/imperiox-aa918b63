import { useEffect, useState } from "react";
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
import { Plus, Copy, Trash2, TrendingUp, DollarSign, MousePointerClick, Target, AlertTriangle, ArrowUpRight, ArrowDownRight, BarChart3, Filter, Zap, Code } from "lucide-react";
import { toast } from "sonner";

interface TrackingLink {
  id: string; nome: string; destino: string; project_id?: string;
  plataforma?: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; utm_term?: string; ativo: boolean;
  created_at: string; clickCount?: number;
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

export default function Tracker() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [clicks, setClicks] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [targets, setTargets] = useState<KPITargets>(DEFAULT_TARGETS);
  const [filterPlataforma, setFilterPlataforma] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [form, setForm] = useState({ nome: "", destino: "", plataforma: "Meta Ads", project_id: "none", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "" });

  const load = async () => {
    const [lRes, cRes, vRes, pRes] = await Promise.all([
      supabase.from("imphq_tracking_links").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_clicks").select("*"),
      supabase.from("imphq_vendas").select("*"),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    const clicksData = cRes.data || [];
    const enriched = (lRes.data || []).map((l: any) => ({
      ...l, clickCount: clicksData.filter((c: any) => c.link_id === l.id).length,
    }));
    setLinks(enriched);
    setClicks(clicksData);
    setVendas(vRes.data || []);
    setProjects(pRes.data || []);
    const saved = localStorage.getItem("imphq_kpi_targets");
    if (saved) setTargets(JSON.parse(saved));
  };

  useEffect(() => { load(); }, []);

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
      project_id: form.project_id || null,
      utm_source: form.utm_source || null, utm_medium: form.utm_medium || null,
      utm_campaign: form.utm_campaign || null, utm_content: form.utm_content || null,
      utm_term: form.utm_term || null, ativo: true,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Link criado!"); setShowNew(false);
    setForm({ nome: "", destino: "", plataforma: "Meta Ads", project_id: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "" });
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
  const filteredClicks = filterPlataforma === "all" && filterProject === "all"
    ? clicks
    : clicks.filter(c => filteredLinks.some(l => l.id === c.link_id));
  const filteredVendas = filterPlataforma === "all" && filterProject === "all"
    ? vendas
    : vendas.filter(v => {
        if (filterProject !== "all" && v.project_id !== filterProject) return false;
        if (filterPlataforma !== "all" && v.plataforma !== filterPlataforma) return false;
        return true;
      });

  // KPIs
  const totalClicks = filteredClicks.length;
  const totalVendas = filteredVendas.length;
  const totalReceita = filteredVendas.reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);
  const totalGasto = filteredClicks.reduce((s: number, c: any) => s + (parseFloat(c.custo) || 0), 0);
  const cpl = totalClicks > 0 ? totalGasto / totalClicks : 0;
  const cpa = totalVendas > 0 ? totalGasto / totalVendas : 0;
  const roas = totalGasto > 0 ? totalReceita / totalGasto : 0;
  const ctr = totalClicks > 0 ? (totalVendas / totalClicks) * 100 : 0;
  const cvr = ctr;
  const cpm = totalClicks > 0 ? (totalGasto / totalClicks) * 1000 : 0;
  const ltv = totalVendas > 0 ? totalReceita / totalVendas : 0;
  const cac = cpa;

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
  
  // Register click
  if(Object.keys(utms).length > 0){
    fetch(SB_URL + "/rest/v1/imphq_clicks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        utm_source: utms.utm_source || null,
        utm_medium: utms.utm_medium || null,
        utm_campaign: utms.utm_campaign || null,
        utm_content: utms.utm_content || null,
        utm_term: utms.utm_term || null,
        referrer: document.referrer || null,
        page_url: window.location.href,
        user_agent: navigator.userAgent
      })
    }).catch(function(){});
  }
  
  // Expose helper for form submissions
  window.imptrack = {
    getUtms: function(){ return utms; },
    trackLead: function(data){
      return fetch(SB_URL + "/rest/v1/imphq_leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SB_KEY,
          "Authorization": "Bearer " + SB_KEY,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(Object.assign({
          id: crypto.randomUUID(),
          plataforma: utms.utm_source || null,
          data: { utms: utms, landing: localStorage.getItem("imp_landing") }
        }, data))
      });
    }
  };
})();
</script>`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">⚡ Tracker / Meta</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowScript(true)}><Code className="h-4 w-4 mr-1" /> Script</Button>
          <Button size="sm" variant="outline" onClick={() => setShowTargets(true)}><Target className="h-4 w-4 mr-1" /> Metas</Button>
          <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Link</Button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
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
        {(filterPlataforma !== "all" || filterProject !== "all") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFilterPlataforma("all"); setFilterProject("all"); }}>Limpar filtros</Button>
        )}
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard"><BarChart3 className="h-3.5 w-3.5 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="links"><MousePointerClick className="h-3.5 w-3.5 mr-1" /> Links UTM</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="Total Gasto" value={`R$ ${totalGasto.toFixed(2)}`} />
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="Receita" value={`R$ ${totalReceita.toFixed(2)}`} />
            <KPICard icon={<MousePointerClick className="h-3 w-3" />} label="Total Clicks" value={String(totalClicks)} />
            <KPICard icon={<TrendingUp className="h-3 w-3" />} label="Vendas" value={String(totalVendas)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICardTarget label="ROAS" value={roas.toFixed(2)} suffix="x" target={targets.roas_target} targetLabel={`Meta: ${targets.roas_target}x`} status={roasStatus} />
            <KPICardTarget label="CPA" value={`R$ ${cpa.toFixed(2)}`} target={targets.cpa_target} targetLabel={`Meta: R$ ${targets.cpa_target}`} status={cpaStatus} />
            <KPICardTarget label="CTR" value={`${ctr.toFixed(1)}%`} target={targets.ctr_target} targetLabel={`Meta: ${targets.ctr_target}%`} status={ctrStatus} />
            <KPICardTarget label="CPM" value={`R$ ${cpm.toFixed(2)}`} target={targets.cpm_target} targetLabel={`Meta: R$ ${targets.cpm_target}`} status={cpmStatus} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<Target className="h-3 w-3" />} label="CPL" value={`R$ ${cpl.toFixed(2)}`} />
            <KPICard icon={<TrendingUp className="h-3 w-3" />} label="CVR" value={`${cvr.toFixed(1)}%`} />
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="LTV" value={`R$ ${ltv.toFixed(2)}`} />
            <KPICard icon={<DollarSign className="h-3 w-3" />} label="CAC" value={`R$ ${cac.toFixed(2)}`} />
          </div>
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
                  <TableHead>Medium</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${PLATAFORMA_COLORS[l.plataforma || "Outro"] || PLATAFORMA_COLORS["Outro"]}`}>
                        {l.plataforma || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{projectName(l.project_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.utm_source || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.utm_medium || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.utm_campaign || "—"}</TableCell>
                    <TableCell className="font-mono text-primary">{l.clickCount ?? 0}</TableCell>
                    <TableCell><Switch checked={l.ativo} onCheckedChange={() => toggleAtivo(l)} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => copyLink(l)}><Copy className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteLink(l.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
            {form.destino && (
              <div className="p-2 bg-secondary rounded text-xs text-muted-foreground break-all">
                <span className="text-primary font-medium">Preview: </span>{buildUrl(form as any)}
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
                <p><span className="text-primary">imptrack.trackLead({"{"} nome, email, phone {"}"})</span> → registra lead no CRM</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">Exemplo de uso no formulário:</span>
              </p>
              <div className="bg-secondary rounded p-3 text-xs font-mono text-muted-foreground">
                {`document.querySelector("form").addEventListener("submit", function(e) {\n  e.preventDefault();\n  imptrack.trackLead({\n    nome: document.getElementById("nome").value,\n    email: document.getElementById("email").value\n  }).then(function() { window.location = "/obrigado"; });\n});`}
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
