import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Row = {
  id: string;
  papel: string;
  site: {
    id: string; titulo: string; url: string; tipo: string;
    thumbnail_url: string | null; summary: string | null;
  };
};

const PAPEL_LABEL: Record<string, string> = {
  lp: "LP Principal", upsell: "Upsell", downsell: "Downsell",
  obrigado: "Obrigado", captura: "Captura", checkout: "Checkout", outro: "Outro",
};

export function ProjetoSitesTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_project_sites")
      .select("id, papel, site:imphq_sites(id, titulo, url, tipo, thumbnail_url, summary)")
      .eq("projeto_id", projectId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data || []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleRemove(id: string) {
    if (!confirm("Desvincular este site do projeto?")) return;
    const { error } = await supabase.from("imphq_project_sites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  }

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-serif">Sites do projeto</h3>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/sites"><Plus className="h-4 w-4 mr-1.5" />Gerenciar biblioteca</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg text-muted-foreground">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Nenhum site anexado a este projeto.</p>
          <Button asChild variant="link"><Link to="/sites">Ir para biblioteca de sites</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <div className="aspect-video bg-secondary/30">
                {r.site?.thumbnail_url ? (
                  <img src={r.site.thumbnail_url} alt={r.site.titulo} className="w-full h-full object-cover object-top" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Globe className="h-8 w-8 opacity-40 text-muted-foreground" /></div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.site?.titulo}</p>
                    <a href={r.site?.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> {r.site?.url?.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemove(r.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <Badge variant="outline" className="text-xs">{PAPEL_LABEL[r.papel] || r.papel}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
