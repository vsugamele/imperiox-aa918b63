import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Copy, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { HyperFields } from "@/lib/hyperPromptBuilder";

export interface SavedPrompt {
  id: string;
  nome: string;
  prompt_text: string;
  campos: HyperFields;
  tags: string[] | null;
  created_at: string;
}

export function HyperPromptVault({
  refreshKey,
  onLoad,
}: {
  refreshKey: number;
  onLoad: (fields: HyperFields) => void;
}) {
  const [items, setItems] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_prompts_salvos")
      .select("id, nome, prompt_text, campos, tags, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error("Erro ao carregar cofre");
    else setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("imphq_prompts_salvos").delete().eq("id", id);
    if (error) return toast.error("Falha ao excluir");
    setItems((p) => p.filter((i) => i.id !== id));
    toast.success("Removido");
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando cofre...
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className="bg-secondary/20 border-border p-12 text-center">
        <p className="text-muted-foreground leading-7">
          Cofre vazio. Salve um prompt na aba <strong className="text-primary">Hyper</strong> e ele aparecerá aqui.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((p) => (
        <Card key={p.id} className="bg-secondary/20 border-border p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-display text-base font-bold text-primary">{p.nome}</h4>
              <p className="text-[11px] uppercase tracking-[1.5px] text-muted-foreground">
                {new Date(p.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => onLoad(p.campos)} title="Carregar">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => copy(p.prompt_text)} title="Copiar">
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(p.id)} title="Excluir">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <pre className="font-mono text-[11px] leading-6 text-foreground/70 whitespace-pre-wrap break-words line-clamp-6">
            {p.prompt_text}
          </pre>
        </Card>
      ))}
    </div>
  );
}
