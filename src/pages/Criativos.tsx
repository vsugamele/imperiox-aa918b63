import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DashboardCreativeHub } from "@/components/dashboard/DashboardCreativeHub";

interface Batch {
  id: string;
  nome: string;
  project_id: string;
  status: string;
  total_gerado: number;
  total_planejado: number;
  created_at: string;
}

export default function Criativos() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_creative_batches")
      .select("id, nome, project_id, status, total_gerado, total_planejado, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setBatches((data as Batch[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl text-primary flex items-center gap-3">
            <Sparkles className="h-8 w-8" /> Creative Factory
          </h1>
          <p className="text-muted-foreground mt-1">
            Gere imagens de anúncios em múltiplos ângulos com IA
          </p>
        </div>
        <Button asChild>
          <Link to="/criativos/novo">
            <Plus className="mr-2 h-4 w-4" /> Novo batch
          </Link>
        </Button>
      </div>

      {loading && batches.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : batches.length === 0 ? (
        <Card className="p-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
          <h3 className="font-serif text-2xl mb-2">Nenhum batch ainda</h3>
          <p className="text-muted-foreground mb-4">
            Crie seu primeiro batch para gerar criativos de anúncios automaticamente
          </p>
          <Button asChild>
            <Link to="/criativos/novo">Começar</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {batches.map((b) => (
            <Link to={`/criativos/${b.id}`} key={b.id}>
              <Card className="p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{b.nome}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Projeto: {b.project_id} • {new Date(b.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-sm text-muted-foreground">
                      {b.total_gerado}/{b.total_planejado || "?"}
                    </div>
                    <Badge
                      variant={
                        b.status === "completed"
                          ? "default"
                          : b.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {b.status === "processing" && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {b.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Creative Factory & Fábrica de Ângulos */}
      <div className="pt-6 mt-2 border-t border-border/40 space-y-3">
        <div>
          <h2 className="font-serif text-2xl text-primary">Fábrica de Ângulos</h2>
          <p className="text-xs text-muted-foreground mt-1">Hub completo de criativos por projeto.</p>
        </div>
        <DashboardCreativeHub projectId="all" />
      </div>
    </div>
  );
}
