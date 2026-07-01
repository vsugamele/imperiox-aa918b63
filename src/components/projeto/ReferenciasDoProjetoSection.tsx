import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Image as ImageIcon, FileText, Video, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";

interface Ref {
  id: string;
  titulo: string;
  tipo: string | null;
  plataforma: string | null;
  url: string | null;
  image_url: string | null;
  created_at: string;
}

const TIPO_LABEL: Record<string, { label: string; icon: any }> = {
  criativo: { label: "Criativos", icon: ImageIcon },
  landing: { label: "Landing Pages", icon: FileText },
  lp: { label: "Landing Pages", icon: FileText },
  video: { label: "Vídeos", icon: Video },
  email: { label: "Emails", icon: FileText },
};

function tipoMeta(tipo: string | null) {
  const k = (tipo || "outros").toLowerCase();
  return TIPO_LABEL[k] || { label: tipo || "Outros", icon: Bookmark };
}

export function ReferenciasDoProjetoSection({ projectId }: { projectId: string }) {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_referencias")
        .select("id, titulo, tipo, plataforma, url, image_url, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      setRefs((data as Ref[]) || []);
      setLoading(false);
    })();
  }, [projectId]);

  const grouped = refs.reduce<Record<string, Ref[]>>((acc, r) => {
    const key = tipoMeta(r.tipo).label;
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
          <Bookmark className="h-4 w-4" />
          Referências do Projeto
          <Badge variant="secondary" className="text-[10px]">{refs.length}</Badge>
        </CardTitle>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`/referencias?project=${projectId}`}>Ver tudo</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
        {!loading && refs.length === 0 && (
          <div className="text-xs text-muted-foreground">
            Nenhuma referência vinculada a este projeto.{" "}
            <Link to={`/referencias?project=${projectId}`} className="text-primary underline">
              Adicionar em Referências
            </Link>
            .
          </div>
        )}
        {!loading &&
          Object.entries(grouped).map(([label, list]) => {
            const Icon = tipoMeta(list[0].tipo).icon;
            return (
              <div key={label} className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3 w-3" /> {label}
                  <span className="text-[10px]">({list.length})</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {list.map((r) => (
                    <a
                      key={r.id}
                      href={r.url || r.image_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-square rounded-md overflow-hidden border border-border bg-secondary block"
                      title={r.titulo}
                    >
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt={r.titulo}
                          className="w-full h-full object-cover"
                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur px-2 py-1 text-[10px] truncate flex items-center gap-1">
                        <span className="truncate flex-1">{r.titulo}</span>
                        {r.url && <ExternalLink className="h-3 w-3 shrink-0" />}
                      </div>
                      {r.plataforma && (
                        <Badge variant="secondary" className="absolute top-1 left-1 text-[9px] h-4 px-1">
                          {r.plataforma}
                        </Badge>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
