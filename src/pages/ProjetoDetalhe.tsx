import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ProjetoIdentidade } from "@/components/projeto/ProjetoIdentidade";
import { ProjetoExpert } from "@/components/projeto/ProjetoExpert";
import { ProjetoAvatar } from "@/components/projeto/ProjetoAvatar";
import { ProjetoKPIs } from "@/components/projeto/ProjetoKPIs";
// ProjetoPesquisa removed — unified into ProjetoPesquisaInteligente
import { ProjetoMidia } from "@/components/projeto/ProjetoMidia";
import { ProjetoDocs } from "@/components/projeto/ProjetoDocs";
import { ProjetoSitesTab } from "@/components/projeto/ProjetoSitesTab";
import { ConcorrentesTab } from "@/components/projeto/concorrentes/ConcorrentesTab";

import { ProjetoCalendario } from "@/components/projeto/ProjetoCalendario";
import { ProjetoEmails } from "@/components/projeto/ProjetoEmails";
import { ProjetoFinancas } from "@/components/projeto/ProjetoFinancas";
import { ProjetoComando } from "@/components/projeto/ProjetoComando";
import { ProjectKPIStrip } from "@/components/projeto/ProjectKPIStrip";
import { SalesPathButton } from "@/components/projeto/SalesPathButton";
import { ProjetoCentralConteudo } from "@/components/projeto/ProjetoCentralConteudo";
import { ProjetoPesquisaInteligente } from "@/components/projeto/ProjetoPesquisaInteligente";
import { ProjetoFlowcharts } from "@/components/projeto/ProjetoFlowcharts";
import { ProjetoExpertPanel } from "@/components/projeto/ProjetoExpertPanel";
import { ProjetoInsights } from "@/components/projeto/ProjetoInsights";
import { ProjetoInstagram } from "@/components/projeto/ProjetoInstagram";
import { useAutoSave } from "@/components/projeto/useAutoSave";
import { Pencil, Copy, Check, ChevronDown, ExternalLink, TestTube2, CheckCircle2, XCircle, Download, Eye, EyeOff } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PIPELINE_KEYS = ["avatar", "funil", "copy", "prompts", "design", "trafego"];

type TabDef = { value: string; label: string; emoji: string };
const PILLARS: { id: string; label: string; emoji: string; tabs: TabDef[] }[] = [
  {
    id: "comando", label: "Comando", emoji: "🎯",
    tabs: [
      { value: "comando", label: "Comando", emoji: "🎯" },
      { value: "identidade", label: "Identidade", emoji: "🎨" },
      { value: "expert_panel", label: "Painel", emoji: "🧭" },
    ],
  },
  {
    id: "inteligencia", label: "Inteligência", emoji: "🧠",
    tabs: [
      { value: "avatar", label: "Avatar", emoji: "🎭" },
      { value: "expert", label: "Expert", emoji: "👤" },
      { value: "pesquisa", label: "Pesquisa", emoji: "🔍" },
      { value: "concorrentes", label: "Concorrentes", emoji: "🏆" },
      { value: "insights", label: "Insights", emoji: "✨" },
    ],
  },
  {
    id: "performance", label: "Performance", emoji: "📊",
    tabs: [
      { value: "kpis", label: "KPIs", emoji: "📊" },
      { value: "financas", label: "Finanças", emoji: "💰" },
      { value: "analytics", label: "Analytics", emoji: "📈" },
      { value: "instagram", label: "Instagram", emoji: "📸" },
    ],
  },
  {
    id: "producao", label: "Produção", emoji: "✍️",
    tabs: [
      { value: "central", label: "Conteúdo", emoji: "✍️" },
      { value: "emails", label: "Emails", emoji: "✉️" },
      { value: "midia", label: "Mídia", emoji: "🖼️" },
      { value: "calendario", label: "Calendário", emoji: "📅" },
      { value: "flowcharts", label: "Fluxogramas", emoji: "🗺️" },
    ],
  },
  {
    id: "infra", label: "Infra", emoji: "⚙️",
    tabs: [
      { value: "docs", label: "Docs", emoji: "📄" },
      { value: "sites", label: "Sites", emoji: "🌐" },
    ],
  },
];

const findPillarOf = (tabValue: string) =>
  PILLARS.find(p => p.tabs.some(t => t.value === tabValue))?.id || "comando";

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const save = useAutoSave(id);

  const storageKey = id ? `projeto:${id}:tab` : null;
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (!storageKey) return "comando";
    return localStorage.getItem(storageKey) || "comando";
  });
  const [activePillar, setActivePillar] = useState<string>(() => findPillarOf(
    storageKey ? (localStorage.getItem(storageKey) || "comando") : "comando"
  ));
  const [paletteOpen, setPaletteOpen] = useState(false);

  const allTabs = useMemo(() => PILLARS.flatMap(p => p.tabs.map(t => ({ ...t, pillar: p.label }))), []);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, activeTab);
  }, [activeTab, storageKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goToTab = useCallback((value: string) => {
    setActiveTab(value);
    setActivePillar(findPillarOf(value));
    setPaletteOpen(false);
  }, []);

  const refreshProject = useCallback(async () => {
    const { data } = await supabase.from("imphq_projects").select("*").eq("id", id).single();
    if (data) setProject(data);
  }, [id]);

  useEffect(() => { refreshProject(); }, [refreshProject]);

  const updateField = useCallback((field: string, value: any) => {
    setProject((prev: any) => ({ ...prev, [field]: value }));
    save(field, value);
  }, [save]);

  const onUpdateData = useCallback((data: any) => updateField("data", data), [updateField]);
  const onUpdatePipeline = useCallback((pipeline: any) => updateField("pipeline", pipeline), [updateField]);
  const onUpdateAvatar = useCallback((avatar: any) => updateField("avatar", avatar), [updateField]);
  const onUpdateBrandKit = useCallback((bk: any) => updateField("brand_kit", bk), [updateField]);

  if (!project) return <div className="text-muted-foreground p-8">Carregando...</div>;

  const pipeline = project.pipeline || {};
  const pipelineAvg = Math.round(
    PIPELINE_KEYS.reduce((sum, k) => sum + (pipeline[k] ?? 0), 0) / PIPELINE_KEYS.length
  );

  return (
    <div className="space-y-8">
      {/* ───────── Editorial Hero Header ───────── */}
      <header className="relative">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-5 min-w-0">
            {editingIcon ? (
              <Input
                value={project.icon || ""}
                onChange={(e) => setProject((p: any) => ({ ...p, icon: e.target.value }))}
                onBlur={() => { setEditingIcon(false); updateField("icon", project.icon); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setEditingIcon(false); updateField("icon", project.icon); } }}
                className="w-16 h-14 text-4xl text-center bg-secondary"
                autoFocus
              />
            ) : (
              <span
                className="text-5xl leading-none cursor-pointer hover:opacity-70 transition-opacity select-none"
                onClick={() => setEditingIcon(true)}
              >
                {project.icon || "📁"}
              </span>
            )}
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(project.id);
                  toast.success(`Project ID copiado: ${project.id}`);
                }}
                title="Clique para copiar o Project ID (use em webhooks e integrações)"
                className="group/pid mb-1 inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-2 py-1 text-[10px] uppercase tracking-editorial text-muted-foreground/80 hover:text-primary hover:border-primary/40 transition"
              >
                <span>Project ID</span>
                <code className="font-mono text-foreground/90 normal-case tracking-normal">{project.id}</code>
                <Copy className="h-3 w-3 opacity-60 group-hover/pid:opacity-100" />
              </button>
              {editingName ? (
                <Input
                  value={project.name || ""}
                  onChange={(e) => setProject((p: any) => ({ ...p, name: e.target.value }))}
                  onBlur={() => { setEditingName(false); updateField("name", project.name); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setEditingName(false); updateField("name", project.name); } }}
                  className="text-3xl font-bold bg-secondary h-12 max-w-md"
                  autoFocus
                />
              ) : (
                <h1
                  className="font-display text-4xl md:text-5xl font-semibold cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-3 group leading-tight"
                  onClick={() => setEditingName(true)}
                >
                  <span className="bg-gradient-to-r from-foreground via-foreground to-gold/80 bg-clip-text text-transparent">
                    {project.name}
                  </span>
                  <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </h1>
              )}
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xl">
                {project.description || "Sem descrição"}
              </p>
              <div className="flex gap-2 mt-3 items-center flex-wrap">
                {editingCategory ? (
                  <Input
                    value={project.category || ""}
                    onChange={(e) => setProject((p: any) => ({ ...p, category: e.target.value }))}
                    onBlur={() => { setEditingCategory(false); updateField("category", project.category); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { setEditingCategory(false); updateField("category", project.category); } }}
                    className="bg-secondary h-7 text-xs max-w-[160px]"
                    placeholder="Categoria..."
                    autoFocus
                  />
                ) : (
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:border-gold/50 hover:text-gold transition-colors text-[10px] uppercase tracking-editorial border-border/60"
                    onClick={() => setEditingCategory(true)}
                  >
                    {project.category || "Sem categoria"}
                  </Badge>
                )}
                {project.data?.status && (
                  <Badge
                    variant="outline"
                    className={`capitalize text-[10px] uppercase tracking-editorial ${
                      String(project.data.status).toLowerCase() === "vendendo"
                        ? "border-gold/40 text-gold gold-glow bg-gold/5"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {project.data.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <SalesPathButton projectId={id!} projectName={project.name} />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-border/60 hover:border-gold/40"
                onClick={() => {
                  const ctx = {
                    projeto: { name: project.name, category: project.category, description: project.description },
                    expert: project.data?.expert || {},
                    briefing: { produtos: project.data?.produtos, status: project.data?.status, links: project.data?.links },
                    avatar: project.avatar || {},
                    brand_kit: project.brand_kit || {},
                    kpis: project.data?.kpis || {},
                    pipeline: project.pipeline || {},
                  };
                  navigator.clipboard.writeText(JSON.stringify(ctx, null, 2));
                  toast.success("Contexto copiado para a área de transferência!");
                }}
              >
                <Copy className="h-3 w-3" /> Copiar Contexto
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-border/60 hover:border-gold/40"
                onClick={() => {
                  const ctx = {
                    projeto: { name: project.name, category: project.category, description: project.description },
                    expert: project.data?.expert || {},
                    briefing: { produtos: project.data?.produtos, status: project.data?.status, links: project.data?.links },
                    avatar: project.avatar || {},
                    brand_kit: project.brand_kit || {},
                    kpis: project.data?.kpis || {},
                    pipeline: project.pipeline || {},
                  };
                  const blob = new Blob([JSON.stringify(ctx, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${project.id}_contexto.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Contexto exportado!");
                }}
              >
                <Download className="h-3 w-3" /> Exportar JSON
              </Button>
            </div>
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-2">
                <span className="font-display text-4xl font-semibold text-gold leading-none">
                  {pipelineAvg}
                </span>
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Progress value={pipelineAvg} className="h-1 w-40 mt-2" />
              <p className="text-[10px] uppercase tracking-editorial text-muted-foreground/70 mt-1.5">
                Pipeline Geral
              </p>
            </div>
          </div>
        </div>

        <div className="editorial-divider mt-6" />
      </header>

      {/* ───────── Live KPI Strip ───────── */}
      <ProjectKPIStrip projectId={id!} onNavigate={goToTab} />

      {/* ───────── Pillar Navigation (2-tier) ───────── */}
      <Tabs value={activeTab} onValueChange={goToTab}>
        <div className="space-y-3">
          {/* Pillars */}
          <div className="flex flex-wrap items-center gap-2">
            {PILLARS.map((p) => {
              const isActive = activePillar === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePillar(p.id);
                    const firstTab = p.tabs[0]?.value;
                    if (firstTab && !p.tabs.some(t => t.value === activeTab)) goToTab(firstTab);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-sans tracking-wide transition-all border ${
                    isActive
                      ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                      : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span className="mr-1.5">{p.emoji}</span>{p.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-auto flex items-center gap-2 px-3 py-2 rounded-md text-xs font-sans text-muted-foreground bg-secondary/30 border border-border/40 hover:text-foreground hover:border-border transition-colors"
              title="Buscar seção (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Buscar</span>
              <kbd className="hidden md:inline text-[10px] bg-background/60 border border-border/40 rounded px-1.5 py-0.5">⌘K</kbd>
            </button>
          </div>

          {/* Sub-tabs of active pillar */}
          <div className="flex flex-wrap gap-1 border-b border-border/40 pb-1">
            {PILLARS.find(p => p.id === activePillar)?.tabs.map((t) => {
              const isActive = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => goToTab(t.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-sans transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <span className="mr-1">{t.emoji}</span>{t.label}
                </button>
              );
            })}
          </div>
        </div>

        <TabsContent value="comando" className="mt-4">
          <ProjetoComando projectId={id!} project={project} />
        </TabsContent>
        <TabsContent value="identidade" className="mt-4">
          <ProjetoIdentidade
            project={project}
            onUpdateData={onUpdateData}
            onUpdatePipeline={onUpdatePipeline}
            onUpdateBrandKit={onUpdateBrandKit}
          />
        </TabsContent>
        <TabsContent value="expert" className="mt-4">
          <ProjetoExpert project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="avatar" className="mt-4">
          <ProjetoAvatar project={project} onUpdateData={onUpdateData} onUpdateAvatar={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="kpis" className="mt-4">
          <ProjetoKPIs project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="pesquisa" className="mt-4">
          <ProjetoPesquisaInteligente projectId={id!} project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="midia" className="mt-4">
          <ProjetoMidia project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <ProjetoDocs projectId={id!} />
        </TabsContent>
        <TabsContent value="sites" className="mt-4">
          <ProjetoSitesTab projectId={id!} />
        </TabsContent>
        <TabsContent value="concorrentes" className="mt-4">
          <ConcorrentesTab projectId={id!} />
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          <ProjetoCalendario projectId={id!} />
        </TabsContent>
        <TabsContent value="financas" className="mt-4">
          <ProjetoFinancas projectId={id!} project={project} onRefresh={refreshProject} />
        </TabsContent>
        <TabsContent value="emails" className="mt-4">
          <ProjetoEmails projectId={id!} project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="central" className="mt-4">
          <ProjetoCentralConteudo projectId={id!} project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="flowcharts" className="mt-4">
          <ProjetoFlowcharts project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="expert_panel" className="mt-4">
          <ProjetoExpertPanel projectId={id!} project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <ProjetoInsights projectId={id!} />
        </TabsContent>
        <TabsContent value="instagram" className="mt-4">
          <ProjetoInstagram projectId={id!} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📈 Analytics & Tracking</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Microsoft Clarity ID</Label>
                <Input
                  value={project.clarity_id || ""}
                  onChange={e => setProject((p: any) => ({ ...p, clarity_id: e.target.value }))}
                  onBlur={() => updateField("clarity_id", project.clarity_id)}
                  className="bg-secondary"
                  placeholder="Ex: abc123xyz"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Cole o ID do projeto Clarity para heatmaps e session replay</p>
                {project.clarity_id && (
                  <a href={`https://clarity.microsoft.com/projects/view/${project.clarity_id}/dashboard`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">↗ Abrir Clarity Dashboard</a>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Google Analytics ID</Label>
                <Input
                  value={project.ga_id || ""}
                  onChange={e => setProject((p: any) => ({ ...p, ga_id: e.target.value }))}
                  onBlur={() => updateField("ga_id", project.ga_id)}
                  className="bg-secondary"
                  placeholder="Ex: G-XXXXXXXXXX"
                />
                <p className="text-[10px] text-muted-foreground mt-1">ID de medição do Google Analytics 4</p>
                {project.ga_id && (
                  <a href={`https://analytics.google.com/analytics/web/`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">↗ Abrir Google Analytics</a>
                )}
              </div>
            </CardContent>
          </Card>
          <FacebookCAPICard project={project} setProject={setProject} updateField={updateField} />

          {/* Webhooks de Pagamento — por projeto */}
          <WebhooksPagamentoCard project={project} setProject={setProject} updateField={updateField} />

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔗 Integrações Ativas</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { label: "Facebook CAPI", ok: !!project.data?.facebook_access_token, icon: "📘" },
                  { label: "Marketing API", ok: !!project.data?.facebook_marketing_token, icon: "📊" },
                  { label: "Pixel", ok: !!project.data?.facebook_pixel_id, icon: "🎯" },
                  { label: "Clarity", ok: !!project.clarity_id, icon: "🔍" },
                  { label: "Hotmart", ok: !!project.data?.hotmart_token, icon: "🟧" },
                  { label: "Kiwify", ok: !!project.data?.kiwify_token, icon: "🟪" },
                  { label: "Ticto", ok: !!project.data?.ticto_token, icon: "🟩" },
                  { label: "Perfect Pay", ok: !!project.data?.perfectpay_token, icon: "🟨" },
                ].map(i => (
                  <div key={i.label} className="p-3 rounded bg-secondary/50 border border-border text-center">
                    <span className="text-lg">{i.icon}</span>
                    <p className="text-[10px] font-medium mt-1">{i.label}</p>
                    <p className={`text-[10px] mt-0.5 ${i.ok ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {i.ok ? "✓ Ativo" : "○ Inativo"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Buscar seção do projeto..." />
        <CommandList>
          <CommandEmpty>Nenhuma seção encontrada.</CommandEmpty>
          {PILLARS.map((p) => (
            <CommandGroup key={p.id} heading={`${p.emoji}  ${p.label}`}>
              {p.tabs.map((t) => (
                <CommandItem key={t.value} value={`${p.label} ${t.label}`} onSelect={() => goToTab(t.value)}>
                  <span className="mr-2">{t.emoji}</span>{t.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

// ── Facebook CAPI Card ──────────────────────────────────────────
function FacebookCAPICard({ project, setProject, updateField }: { project: any; setProject: any; updateField: (f: string, v: any) => void }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const toggleSecret = (key: string) => setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }));

  const updateDataField = (key: string, value: string) => {
    const newData = { ...(project.data || {}), [key]: value };
    setProject((p: any) => ({ ...p, data: newData }));
    updateField("data", newData);
  };

  const testCAPI = async () => {
    if (!project.data?.facebook_pixel_id || !project.data?.facebook_access_token) {
      toast.error("Preencha Pixel ID e Access Token antes de testar");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project=${project.id}&event=Lead`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true, email: "test@imperiohq.com", name: "Teste CAPI" }),
        }
      );
      setTestResult(res.ok ? "success" : "error");
      toast[res.ok ? "success" : "error"](res.ok ? "Evento de teste enviado! Verifique no Events Manager." : "Erro ao enviar evento de teste");
    } catch {
      setTestResult("error");
      toast.error("Erro de conexão ao enviar teste");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📘 Facebook Pixel & CAPI</CardTitle>
          <div className="flex items-center gap-2">
            {testResult === "success" && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> CAPI OK</Badge>}
            {testResult === "error" && <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>}
            <Button size="sm" variant="outline" onClick={testCAPI} disabled={testing} className="h-7 text-xs">
              <TestTube2 className="h-3 w-3 mr-1" /> {testing ? "Enviando..." : "Testar CAPI"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Pixel ID</Label>
            <Input
              value={project.data?.facebook_pixel_id || ""}
              onChange={e => {
                const newData = { ...(project.data || {}), facebook_pixel_id: e.target.value };
                setProject((p: any) => ({ ...p, data: newData }));
              }}
              onBlur={() => updateDataField("facebook_pixel_id", project.data?.facebook_pixel_id || "")}
              className="bg-secondary"
              placeholder="Ex: 123456789012345"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Encontre em Events Manager → Fontes de Dados → Pixel → ID do Pixel</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ad Account ID</Label>
            <Input
              value={project.data?.facebook_ad_account_id || ""}
              onChange={e => {
                const newData = { ...(project.data || {}), facebook_ad_account_id: e.target.value };
                setProject((p: any) => ({ ...p, data: newData }));
              }}
              onBlur={() => updateDataField("facebook_ad_account_id", project.data?.facebook_ad_account_id || "")}
              className="bg-secondary"
              placeholder="act_123456789"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Encontre em Gerenciador de Negócios → Configurações → Contas de Anúncios → ID</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Access Token (CAPI)</Label>
            <div className="relative">
              <Input
                type={visibleSecrets["fb_token"] ? "text" : "password"}
                value={project.data?.facebook_access_token || ""}
                onChange={e => {
                  const newData = { ...(project.data || {}), facebook_access_token: e.target.value };
                  setProject((p: any) => ({ ...p, data: newData }));
                }}
                onBlur={() => updateDataField("facebook_access_token", project.data?.facebook_access_token || "")}
                className="bg-secondary pr-10"
                placeholder="EAAxxxxxxx..."
              />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => toggleSecret("fb_token")}>
                {visibleSecrets["fb_token"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Gere em Events Manager → Configurações → Conversions API → Gerar Token</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Test Event Code</Label>
            <Input
              value={project.data?.facebook_test_event_code || ""}
              onChange={e => {
                const newData = { ...(project.data || {}), facebook_test_event_code: e.target.value };
                setProject((p: any) => ({ ...p, data: newData }));
              }}
              onBlur={() => updateDataField("facebook_test_event_code", project.data?.facebook_test_event_code || "")}
              className="bg-secondary"
              placeholder="TEST12345"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Opcional. Aba "Test Events" no Events Manager. Remove antes de ir para produção.</p>
          </div>
        </div>

        {/* Marketing API Token - separado do CAPI */}
        <div className="border-t border-border pt-4 mt-2">
          <Label className="text-xs text-muted-foreground font-semibold">🔑 Access Token (Marketing API)</Label>
          <p className="text-[10px] text-muted-foreground mb-2">Usado para puxar gastos, criativos e métricas dos anúncios. Gere no Graph API Explorer com permissão <code className="bg-secondary px-1 rounded">ads_read</code>.</p>
          <div className="relative">
            <Input
              type={visibleSecrets["fb_marketing"] ? "text" : "password"}
              value={project.data?.facebook_marketing_token || ""}
              onChange={e => {
                const newData = { ...(project.data || {}), facebook_marketing_token: e.target.value };
                setProject((p: any) => ({ ...p, data: newData }));
              }}
              onBlur={() => updateDataField("facebook_marketing_token", project.data?.facebook_marketing_token || "")}
              className="bg-secondary pr-10"
              placeholder="EAAxxxxxxx... (Graph API Explorer)"
            />
            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => toggleSecret("fb_marketing")}>
              {visibleSecrets["fb_marketing"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1">
            <ExternalLink className="h-3 w-3" /> Abrir Graph API Explorer
          </a>
        </div>

        {/* Offline Conversions - alternativa ao CAPI quando não há token */}
        <div className="border-t border-border pt-4 mt-2">
          <Label className="text-xs text-muted-foreground font-semibold">📤 Offline Event Set ID (Offline Conversions)</Label>
          <p className="text-[10px] text-muted-foreground mb-2">
            Alternativa ao CAPI: envia vendas confirmadas direto ao Events Manager por <code className="bg-secondary px-1 rounded">email/telefone hasheado</code>, sem precisar de token CAPI no Pixel. Usa o Access Token de Marketing API acima. Cron a cada 30min.
          </p>
          <Input
            value={project.meta_offline_event_set_id || ""}
            onChange={e => setProject((p: any) => ({ ...p, meta_offline_event_set_id: e.target.value }))}
            onBlur={() => updateField("meta_offline_event_set_id", project.meta_offline_event_set_id || "")}
            className="bg-secondary"
            placeholder="123456789012345 (ID do Offline Event Set)"
          />
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={async () => {
                try {
                  const { data, error } = await supabase.functions.invoke("meta-offline-upload", { body: { project_id: project.id } });
                  if (error) throw error;
                  const r = data?.results?.[0];
                  if (r?.error) toast.error("Erro: " + r.error);
                  else if (r?.skipped) toast.warning("Configure Event Set ID e Access Token (Marketing API)");
                  else toast.success(`Enviado: ${r?.uploaded ?? 0} de ${r?.total_candidates ?? 0} vendas`);
                } catch (e: any) { toast.error(e.message); }
              }}
            >
              <TestTube2 className="h-3 w-3 mr-1" /> Enviar agora
            </Button>
            <a href="https://business.facebook.com/events_manager2/list/offline_event_set" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline self-center">
              <ExternalLink className="h-3 w-3" /> Criar/abrir Offline Event Set
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Como criar: Events Manager → "Adicionar Eventos" → "Offline" → Criar conjunto → copie o ID e cole acima. Atribua às campanhas ativas.
          </p>
        </div>

        <div className="flex gap-2">
          <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> Abrir Facebook Events Manager
          </a>
        </div>

        <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-primary hover:underline w-full">
            <ChevronDown className={`h-3 w-3 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
            📖 Passo-a-passo: Como gerar o Token CAPI
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {[
              { step: 1, text: "Acesse o Facebook Events Manager e selecione seu Pixel" },
              { step: 2, text: "Clique em 'Configurações' (ícone de engrenagem)" },
              { step: 3, text: "Role até 'Conversions API' e clique em 'Gerar Token de Acesso'" },
              { step: 4, text: "Copie o token (começa com EAA...) e cole no campo 'Access Token' acima" },
              { step: 5, text: "Para testar, copie o 'Test Event Code' da aba 'Test Events' e cole acima. Depois clique em 'Testar CAPI'" },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-2 p-2 rounded bg-secondary/50 border border-border">
                <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30 shrink-0">{s.step}</Badge>
                <p className="text-[11px] text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ── Webhooks de Pagamento Card ──────────────────────────────────
function WebhooksPagamentoCard({ project, setProject, updateField }: { project: any; setProject: any; updateField: (f: string, v: any) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const toggleSecret = (key: string) => setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  const baseUrl = `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project=${project.id}`;

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(null), 2000);
  };

  const updateDataField = (key: string, value: string) => {
    const newData = { ...(project.data || {}), [key]: value };
    setProject((p: any) => ({ ...p, data: newData }));
    updateField("data", newData);
  };

  const WEBHOOK_URLS = [
    { label: "Principal (compras)", url: baseUrl, desc: "Recebe todos os eventos" },
    { label: "Lead", url: `${baseUrl}&event=Lead`, desc: "Captura de leads" },
    { label: "Checkout", url: `${baseUrl}&event=InitiateCheckout`, desc: "Início de checkout" },
    { label: "ViewContent", url: `${baseUrl}&event=ViewContent`, desc: "Visualização de conteúdo" },
  ];

  const PLATFORMS = [
    { key: "hotmart_token", label: "Hotmart", icon: "🟧", placeholder: "Hottok de validação", help: "Cole em Ferramentas > Webhooks na Hotmart. Use o header x-hotmart-hottok." },
    { key: "kiwify_token", label: "Kiwify", icon: "🟪", placeholder: "Secret de validação", help: "Configurações > Webhooks > Secret na Kiwify." },
    { key: "ticto_token", label: "Ticto (v2)", icon: "🟩", placeholder: "Token de validação", help: "Na Ticto, vá em Integrações > Webhooks > Adicione a URL acima. O token enviado no body será validado automaticamente. Valores (paid_amount) são convertidos de centavos." },
    { key: "perfectpay_token", label: "Perfect Pay", icon: "🟨", placeholder: "Token de validação", help: "Ferramentas > Notificações (Postback) no Perfect Pay. Defina um Token e cole aqui — será validado contra o campo 'token' do postback." },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔔 Webhooks de Pagamento</CardTitle>
        <p className="text-[10px] text-muted-foreground">URLs exclusivas deste projeto para receber eventos de Hotmart, Kiwify, Ticto e Perfect Pay</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URLs */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">URLs de Webhook</Label>
          {WEBHOOK_URLS.map(w => (
            <div key={w.label} className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium">{w.label} <span className="text-muted-foreground">— {w.desc}</span></p>
                <code className="text-[9px] text-muted-foreground break-all block mt-0.5">{w.url}</code>
              </div>
              <button
                onClick={() => copyUrl(w.url, w.label)}
                className="shrink-0 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === w.label ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>

        {/* Platform Tokens */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Tokens de Validação por Plataforma</Label>
          {PLATFORMS.map(p => (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{p.icon}</span>
                <Label className="text-xs text-muted-foreground">{p.label}</Label>
              </div>
              <div className="relative">
                <Input
                  type={visibleSecrets[p.key] ? "text" : "password"}
                  value={project.data?.[p.key] || ""}
                  onChange={e => {
                    const newData = { ...(project.data || {}), [p.key]: e.target.value };
                    setProject((prev: any) => ({ ...prev, data: newData }));
                  }}
                  onBlur={() => updateDataField(p.key, project.data?.[p.key] || "")}
                  className="bg-secondary pr-10"
                  placeholder={p.placeholder}
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => toggleSecret(p.key)}>
                  {visibleSecrets[p.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground">{p.help}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
