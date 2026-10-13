import { useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { jsonFields } from "@/lib/json-fields";
import {
  ExternalLink,
  Link2,
  Sparkles,
  Archive,
  Trash2,
  RefreshCw,
  MoreVertical,
  Github,
  Eye,
  Camera,
  Copy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { SiteThumbnail, getCleanDomain } from "./SiteThumbnail";
import { SiteDetailModal } from "./SiteDetailModal";

export type Site = {
  id: string;
  user_id: string;
  titulo: string;
  url: string;
  tipo: string;
  status: string;
  tags: string[];
  thumbnail_url: string | null;
  branding_json: Json;
  content_md: string | null;
  summary: string | null;
  last_scraped_at: string | null;
  created_at: string;
  github_url?: string | null;
};

export const TIPO_LABEL: Record<string, string> = {
  lp: "Landing Page",
  vsl: "VSL",
  advertorial: "Advertorial",
  pdp: "PDP / Loja",
  checkout: "Checkout",
  obrigado: "Obrigado",
  captura: "Captura",
  outro: "Outro",
};

export const TIPO_BADGE_STYLE: Record<string, string> = {
  vsl: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  advertorial: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  pdp: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  lp: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  checkout: "bg-lime-500/20 text-lime-300 border-lime-500/40",
  obrigado: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  captura: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  outro: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

export function SiteCard({
  site,
  onAttach,
  onUseAsBase,
  onArchive,
  onDelete,
  onRescrape,
  onCreateEcosystem,
}: {
  site: Site;
  onAttach: () => void;
  onUseAsBase: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRescrape: () => void;
  onCreateEcosystem?: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const colors: string[] = jsonFields(site.branding_json).colors
    ? Object.values(jsonFields(jsonFields(site.branding_json).colors))
        .filter((v): v is string => typeof v === "string" && (v.startsWith("#") || v.startsWith("rgb")))
        .slice(0, 5)
    : [];

  const domain = getCleanDomain(site.url);

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCopyColor = (e: React.MouseEvent, colorHex: string) => {
    stop(e);
    navigator.clipboard.writeText(colorHex);
    toast.success(`Cor ${colorHex} copiada!`);
  };

  const handleCopyUrl = (e: React.MouseEvent) => {
    stop(e);
    navigator.clipboard.writeText(site.url);
    toast.success("URL copiada!");
  };

  const handleQuickRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRescrape();
    } finally {
      setIsRefreshing(false);
    }
  };

  const tipoBadgeStyle = TIPO_BADGE_STYLE[site.tipo] || TIPO_BADGE_STYLE.outro;

  return (
    <>
      <Card
        onClick={() => setDetailOpen(true)}
        className="overflow-hidden border-white/10 hover:border-primary/50 transition-all duration-200 flex flex-col cursor-pointer group bg-slate-900/40 hover:bg-slate-900/60 shadow-lg hover:shadow-primary/5"
      >
        {/* Visual Header do Site */}
        <div className="relative aspect-video overflow-hidden bg-slate-950">
          <SiteThumbnail
            site={site}
            showBrowserBar={true}
            onRefreshScreenshot={handleQuickRefresh}
            isRefreshing={isRefreshing}
          />

          {/* Badges Flutuantes */}
          <div className="absolute top-8 left-2 z-10 flex items-center gap-1.5 pointer-events-none">
            <Badge className={`text-[10px] font-semibold tracking-wide backdrop-blur-md shadow-md ${tipoBadgeStyle}`}>
              {TIPO_LABEL[site.tipo] || site.tipo.toUpperCase()}
            </Badge>
          </div>

          {site.status === "arquivado" && (
            <Badge variant="outline" className="absolute top-8 right-2 z-10 bg-slate-950/80 backdrop-blur text-[10px] border-amber-500/40 text-amber-400">
              Arquivado
            </Badge>
          )}

          {/* Overlay sutil ao passar o mouse para abrir Raio-X */}
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none z-10">
            <span className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/20 text-xs font-medium text-slate-200 shadow-xl flex items-center gap-1.5 backdrop-blur-md">
              <Eye className="w-3.5 h-3.5 text-primary" /> Ver Raio-X & Detalhes
            </span>
          </div>
        </div>

        {/* Informações do Site */}
        <div className="p-3.5 space-y-2.5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm text-slate-100 truncate group-hover:text-primary transition-colors" title={site.titulo}>
                {site.titulo}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={stop}
                  className="truncate hover:text-primary flex items-center gap-1 font-mono text-[11px] transition-colors"
                  title={site.url}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{domain}</span>
                </a>
              </div>
            </div>

            <div onClick={stop} className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-slate-200">
                  <DropdownMenuItem onClick={() => setDetailOpen(true)}>
                    <Eye className="h-4 w-4 mr-2 text-primary" /> Ver Raio-X Completo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(site.url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Abrir site original
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyUrl}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar URL
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={onRescrape}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Recapturar Print & Scrape
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onArchive}>
                    <Archive className="h-4 w-4 mr-2" />
                    {site.status === "arquivado" ? "Reativar site" : "Arquivar site"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir site
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Resumo da IA se existir */}
          {site.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {site.summary}
            </p>
          )}

          {/* Link para GitHub se houver */}
          {site.github_url && (
            <a
              href={site.github_url}
              target="_blank"
              rel="noreferrer"
              onClick={stop}
              className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1.5 truncate font-mono"
              title={site.github_url}
            >
              <Github className="h-3 w-3 shrink-0" />
              <span className="truncate">{site.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}</span>
            </a>
          )}

          {/* Paleta de Cores em Mini-amostras */}
          {colors.length > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5" onClick={stop}>
              <span className="text-[10px] text-slate-500 font-mono">Cores:</span>
              <div className="flex gap-1">
                {colors.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => handleCopyColor(e, c)}
                    className="h-3.5 w-3.5 rounded-full border border-white/20 hover:scale-125 transition-transform"
                    style={{ background: c }}
                    title={`Copiar ${c}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ações Inferiores */}
          <div className="flex gap-2 pt-2 mt-auto" onClick={stop}>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => setDetailOpen(true)}
            >
              <Eye className="h-3.5 w-3.5 mr-1 text-primary" /> Raio-X
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10"
              onClick={onAttach}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" /> Anexar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10"
              onClick={onUseAsBase}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>

          {onCreateEcosystem && (
            <div onClick={stop}>
              <Button
                size="sm"
                className="w-full h-8 text-xs gap-1.5 bg-gradient-to-r from-amber-500/90 to-primary/90 text-slate-950 font-medium hover:brightness-110"
                onClick={onCreateEcosystem}
              >
                <Sparkles className="h-3.5 w-3.5" /> ⚡ Criar Ecossistema
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Modal de Detalhes & Raio-X */}
      <SiteDetailModal
        site={site}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAttach={onAttach}
        onUseAsBase={onUseAsBase}
        onCreateEcosystem={onCreateEcosystem}
        onRescrape={onRescrape}
      />
    </>
  );
}
