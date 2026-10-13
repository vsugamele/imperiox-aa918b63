import { useEffect, useMemo, useState } from "react";
import {
  Globe,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  LayoutGrid,
  List,
  Sparkles,
  ExternalLink,
  Layers,
  CheckCircle2,
  Trash2,
  Archive,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SiteCard, type Site, TIPO_LABEL, TIPO_BADGE_STYLE } from "@/components/sites/SiteCard";
import { AddSiteModal } from "@/components/sites/AddSiteModal";
import { AttachToProjectModal } from "@/components/sites/AttachToProjectModal";
import { UseAsBaseModal } from "@/components/sites/UseAsBaseModal";
import { CreateEcosystemModal } from "@/components/sites/CreateEcosystemModal";
import { SiteThumbnail, getCleanDomain } from "@/components/sites/SiteThumbnail";

export const ALL_TIPOS = [
  { value: "lp", label: "Landing Page" },
  { value: "vsl", label: "VSL" },
  { value: "advertorial", label: "Advertorial" },
  { value: "pdp", label: "PDP / Loja" },
  { value: "checkout", label: "Checkout" },
  { value: "obrigado", label: "Obrigado" },
  { value: "captura", label: "Captura" },
  { value: "outro", label: "Outro" },
];

export default function Sites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("__all__");
  const [status, setStatus] = useState<string>("ativo");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isBulkRefreshing, setIsBulkRefreshing] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [attachSite, setAttachSite] = useState<Site | null>(null);
  const [baseSite, setBaseSite] = useState<Site | null>(null);
  const [ecoSite, setEcoSite] = useState<Site | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSites((data || []) as Site[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Contagem por tipo para os filtros
  const countsByTipo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sites) {
      if (status !== "__all__" && s.status !== status) continue;
      map[s.tipo] = (map[s.tipo] || 0) + 1;
    }
    return map;
  }, [sites, status]);

  const filtered = useMemo(() => {
    return sites.filter((s) => {
      if (tipo !== "__all__" && s.tipo !== tipo) return false;
      if (status !== "__all__" && s.status !== status) return false;
      if (q) {
        const needle = q.toLowerCase();
        const domain = getCleanDomain(s.url).toLowerCase();
        const matchesTitle = s.titulo.toLowerCase().includes(needle);
        const matchesUrl = s.url.toLowerCase().includes(needle) || domain.includes(needle);
        const matchesTags = s.tags?.some((t) => t.toLowerCase().includes(needle));
        if (!matchesTitle && !matchesUrl && !matchesTags) return false;
      }
      return true;
    });
  }, [sites, q, tipo, status]);

  async function handleArchive(s: Site) {
    const next = s.status === "arquivado" ? "ativo" : "arquivado";
    const { error } = await supabase.from("imphq_sites").update({ status: next }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(next === "arquivado" ? "Arquivado" : "Reativado");
    load();
  }

  async function handleDelete(s: Site) {
    if (!confirm(`Excluir o site "${s.titulo}"?`)) return;
    const { error } = await supabase.from("imphq_sites").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Site excluído");
    load();
  }

  async function handleRescrape(s: Site) {
    toast.info(`Atualizando visual de "${s.titulo}"…`);
    try {
      // 1. Gera screenshot atualizado via WordPress mshots
      const cleanUrl = s.url.startsWith("http") ? s.url : `https://${s.url}`;
      const mshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=800`;

      // 2. Chama site-scrape se disponível para metadata e branding
      const { data } = await supabase.functions.invoke("site-scrape", { body: { url: s.url } });

      const newThumb = data?.screenshot || mshotUrl;

      await supabase
        .from("imphq_sites")
        .update({
          titulo: data?.title || s.titulo,
          thumbnail_url: newThumb,
          branding_json: data?.branding || s.branding_json,
          content_md: data?.markdown || s.content_md,
          summary: data?.summary || s.summary,
          last_scraped_at: new Date().toISOString(),
        })
        .eq("id", s.id);

      toast.success("Visual e dados atualizados!");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar");
    }
  }

  // Recaptura em lote de todos os sites
  async function handleBulkRefreshPrints() {
    setIsBulkRefreshing(true);
    toast.info("Garantindo capturas visuais para todos os sites…");
    try {
      let updatedCount = 0;
      for (const s of sites) {
        const cleanUrl = s.url.startsWith("http") ? s.url : `https://${s.url}`;
        const mshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=800`;

        // Se o thumbnail estiver vazio ou quebrado
        if (!s.thumbnail_url || s.thumbnail_url.includes("firecrawl-scrape-media")) {
          await supabase
            .from("imphq_sites")
            .update({
              thumbnail_url: mshotUrl,
              last_scraped_at: new Date().toISOString(),
            })
            .eq("id", s.id);
          updatedCount++;
        }
      }
      toast.success(`Visuais verificados! ${updatedCount} capturas atualizadas.`);
      load();
    } catch (err: any) {
      toast.error("Erro na verificação em lote");
    } finally {
      setIsBulkRefreshing(false);
    }
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header com Título & Ações Principais */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/5">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-slate-100">Sites & Ecossistemas</h1>
              <Badge variant="outline" className="bg-white/5 border-white/10 text-xs font-mono">
                {sites.length} {sites.length === 1 ? "site" : "sites"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Catálogo visual de LPs, VSLs, advertorials e checkouts integrados ao Imperius HQ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkRefreshPrints}
            disabled={isBulkRefreshing}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-xs gap-1.5"
            title="Garante que todos os sites tenham captura de tela ativa"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBulkRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>Atualizar Prints</span>
          </Button>

          <Button onClick={() => setAddOpen(true)} className="gap-2 bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Adicionar site
          </Button>
        </div>
      </div>

      {/* Barra de Filtros, Busca e Alternância de Visualização */}
      <div className="space-y-3">
        {/* Pills de Tipos Rápidos */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setTipo("__all__")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              tipo === "__all__"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-white/20"
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] opacity-80 font-mono">
              ({status === "__all__" ? sites.length : sites.filter((s) => s.status === status).length})
            </span>
          </button>

          {ALL_TIPOS.map((t) => {
            const count = countsByTipo[t.value] || 0;
            if (count === 0 && tipo !== t.value) return null;
            const isSelected = tipo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                }`}
              >
                <span>{t.label}</span>
                <span className="text-[10px] opacity-80 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Linha com Busca, Status e Visualização */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, URL ou domínio…"
              className="pl-8 bg-slate-900/60 border-white/10 focus:border-primary/50"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px] bg-slate-900/60 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
              <SelectItem value="__all__">Todos os status</SelectItem>
              <SelectItem value="ativo">Apenas Ativos</SelectItem>
              <SelectItem value="arquivado">Arquivados</SelectItem>
            </SelectContent>
          </Select>

          {/* Toggle Grid vs Lista */}
          <div className="bg-slate-900/60 border border-white/10 rounded-lg p-0.5 flex">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-white"
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-white"
              }`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Carregando catálogo visual…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-slate-950/40 space-y-3">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
            <Globe className="h-6 w-6 opacity-40 text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-300">Nenhum site encontrado</h3>
            <p className="text-xs text-slate-500 mt-1">
              {q ? "Tente ajustar os filtros ou termo de busca." : "Adicione seu primeiro site para começar o acervo."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="border-white/10 bg-white/5 hover:bg-white/10">
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar site
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* VISUALIZAÇÃO EM GRADE DE CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <SiteCard
              key={s.id}
              site={s}
              onAttach={() => setAttachSite(s)}
              onUseAsBase={() => setBaseSite(s)}
              onArchive={() => handleArchive(s)}
              onDelete={() => handleDelete(s)}
              onRescrape={() => handleRescrape(s)}
              onCreateEcosystem={() => setEcoSite(s)}
            />
          ))}
        </div>
      ) : (
        /* VISUALIZAÇÃO EM LISTA DETALHADA */
        <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/40">
          <div className="divide-y divide-white/5">
            {filtered.map((s) => {
              const domain = getCleanDomain(s.url);
              const tipoBadgeStyle = TIPO_BADGE_STYLE[s.tipo] || TIPO_BADGE_STYLE.outro;
              return (
                <div
                  key={s.id}
                  className="p-3.5 sm:p-4 hover:bg-slate-900/80 transition-colors flex items-center gap-4 group"
                >
                  {/* Mini Thumbnail */}
                  <div className="w-28 sm:w-36 aspect-video shrink-0 rounded-lg overflow-hidden border border-white/10 bg-slate-950">
                    <SiteThumbnail site={s} showBrowserBar={false} />
                  </div>

                  {/* Detalhes */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] font-semibold tracking-wide ${tipoBadgeStyle}`}>
                        {TIPO_LABEL[s.tipo] || s.tipo.toUpperCase()}
                      </Badge>
                      <h3 className="font-semibold text-sm text-slate-100 truncate" title={s.titulo}>
                        {s.titulo}
                      </h3>
                      {s.status === "arquivado" && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                          Arquivado
                        </Badge>
                      )}
                    </div>

                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-mono transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{s.url}</span>
                    </a>

                    {s.summary && (
                      <p className="text-xs text-slate-400 line-clamp-1">{s.summary}</p>
                    )}
                  </div>

                  {/* Ações da Linha */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10 hidden sm:flex"
                      onClick={() => setAttachSite(s)}
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" /> Anexar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10 hidden sm:flex"
                      onClick={() => setBaseSite(s)}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-white"
                      onClick={() => handleRescrape(s)}
                      title="Recapturar Print"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modais de Operação */}
      <AddSiteModal open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
      <AttachToProjectModal site={attachSite} onOpenChange={(o) => !o && setAttachSite(null)} />
      <UseAsBaseModal site={baseSite} onOpenChange={(o) => !o && setBaseSite(null)} />
      <CreateEcosystemModal site={ecoSite} onOpenChange={(o) => !o && setEcoSite(null)} />
    </div>
  );
}
