import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, Trash2, Plus, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { SiteThumbnail, getCleanDomain } from "@/components/sites/SiteThumbnail";
import { SiteDetailModal } from "@/components/sites/SiteDetailModal";
import type { Site } from "@/components/sites/SiteCard";

type Row = {
  id: string;
  papel: string;
  site: Site;
};

const PAPEL_LABEL: Record<string, string> = {
  lp: "LP Principal",
  upsell: "Upsell",
  downsell: "Downsell",
  obrigado: "Obrigado",
  captura: "Captura",
  checkout: "Checkout",
  outro: "Outro",
};

export function ProjetoSitesTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_project_sites")
      .select("id, papel, site:imphq_sites(*)")
      .eq("projeto_id", projectId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data || []) as unknown as Row[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove(id: string) {
    if (!confirm("Desvincular este site do projeto?")) return;
    const { error } = await supabase.from("imphq_project_sites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Site desvinculado");
    load();
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-xs font-mono flex items-center justify-center gap-2">
        <Globe className="w-4 h-4 animate-spin text-primary" /> Carregando sites do projeto…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-serif">Sites do projeto</h3>
          <Badge variant="outline" className="text-xs bg-white/5 font-mono">
            {rows.length} {rows.length === 1 ? "site" : "sites"}
          </Badge>
        </div>
        <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-xs">
          <Link to="/sites">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Gerenciar biblioteca
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl text-muted-foreground bg-slate-950/40 space-y-2">
          <Globe className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
          <p className="text-sm text-slate-300">Nenhum site anexado a este projeto ainda.</p>
          <p className="text-xs text-slate-500">Vincule páginas da sua biblioteca de sites para conectar o funil.</p>
          <Button asChild variant="link" size="sm" className="text-primary mt-2">
            <Link to="/sites">Ir para biblioteca de sites →</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => {
            if (!r.site) return null;
            const domain = getCleanDomain(r.site.url);
            return (
              <Card
                key={r.id}
                className="overflow-hidden border-white/10 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col group"
              >
                {/* Visual Thumbnail */}
                <div
                  className="relative aspect-video bg-slate-950 cursor-pointer overflow-hidden"
                  onClick={() => setSelectedSite(r.site)}
                >
                  <SiteThumbnail site={r.site} showBrowserBar={true} />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-white/20 text-[11px] text-slate-200 flex items-center gap-1 shadow-lg">
                      <Eye className="w-3 h-3 text-primary" /> Ver Raio-X
                    </span>
                  </div>
                </div>

                <div className="p-3.5 space-y-2 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-slate-100 truncate" title={r.site.titulo}>
                        {r.site.titulo}
                      </p>
                      <a
                        href={r.site.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1 font-mono transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{domain}</span>
                      </a>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(r.id)}
                      title="Desvincular site"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-1 mt-auto">
                    <Badge variant="outline" className="text-xs bg-white/5 border-white/10 font-mono">
                      {PAPEL_LABEL[r.papel] || r.papel}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-slate-400 hover:text-white gap-1"
                      onClick={() => setSelectedSite(r.site)}
                    >
                      <Eye className="w-3 h-3 text-primary" /> Detalhes
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes / Raio-X do site selecionado */}
      <SiteDetailModal
        site={selectedSite}
        open={!!selectedSite}
        onOpenChange={(o) => !o && setSelectedSite(null)}
      />
    </div>
  );
}
