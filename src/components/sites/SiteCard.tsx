import { ExternalLink, Link2, Sparkles, Archive, Trash2, RefreshCw, MoreVertical, Globe, Github } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Site = {
  id: string;
  user_id: string;
  titulo: string;
  url: string;
  tipo: string;
  status: string;
  tags: string[];
  thumbnail_url: string | null;
  branding_json: any;
  content_md: string | null;
  summary: string | null;
  last_scraped_at: string | null;
  created_at: string;
  github_url?: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  lp: "LP", vsl: "VSL", checkout: "Checkout", obrigado: "Obrigado", captura: "Captura", outro: "Outro",
};

export function SiteCard({
  site, onAttach, onUseAsBase, onArchive, onDelete, onRescrape, onCreateEcosystem,
}: {
  site: Site;
  onAttach: () => void;
  onUseAsBase: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRescrape: () => void;
  onCreateEcosystem?: () => void;
}) {
  const colors: string[] = site.branding_json?.colors
    ? Object.values(site.branding_json.colors).filter((v): v is string => typeof v === "string").slice(0, 5)
    : [];

  const thumb = site.thumbnail_url;
  const isData = thumb?.startsWith("data:") || thumb?.startsWith("http");

  const openSite = () => window.open(site.url, "_blank", "noopener,noreferrer");
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); };

  return (
    <Card
      onClick={openSite}
      className="overflow-hidden hover:border-primary/40 transition-colors flex flex-col cursor-pointer group"
    >
      <div className="relative aspect-video bg-secondary/30 overflow-hidden">
        {isData ? (
          <img src={thumb!} alt={site.titulo} className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Globe className="h-10 w-10 opacity-40" />
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-background/80 backdrop-blur">{TIPO_LABEL[site.tipo] || site.tipo}</Badge>
        {site.status === "arquivado" && (
          <Badge variant="outline" className="absolute top-2 right-2 bg-background/80">Arquivado</Badge>
        )}
      </div>

      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold truncate" title={site.titulo}>{site.titulo}</h3>
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              onClick={stop}
              className="text-xs text-muted-foreground truncate hover:text-primary flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{site.url.replace(/^https?:\/\//, "")}</span>
            </a>
          </div>
          <div onClick={stop}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onRescrape}><RefreshCw className="h-4 w-4 mr-2" />Atualizar dados</DropdownMenuItem>
                <DropdownMenuItem onClick={onArchive}><Archive className="h-4 w-4 mr-2" />{site.status === "arquivado" ? "Reativar" : "Arquivar"}</DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {site.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2">{site.summary}</p>
        )}

        {site.github_url && (
          <a
            href={site.github_url}
            target="_blank"
            rel="noreferrer"
            onClick={stop}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 truncate"
            title={site.github_url}
          >
            <Github className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{site.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}</span>
          </a>
        )}

        {colors.length > 0 && (
          <div className="flex gap-1">
            {colors.map((c, i) => (
              <div key={i} className="h-4 w-4 rounded border border-border/50" style={{ background: c }} title={c} />
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2 mt-auto" onClick={stop}>
          <Button size="sm" variant="outline" className="flex-1" onClick={onAttach}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />Anexar
          </Button>
          <Button size="sm" className="flex-1" onClick={onUseAsBase}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Usar de base
          </Button>
        </div>
      </div>
    </Card>
  );
}
