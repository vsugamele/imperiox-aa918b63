import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2, Rocket } from "lucide-react";

interface Template {
  id: string;
  slug: string;
  nome: string;
  nicho?: string;
  objetivo: string;
  descricao?: string;
  canvas: any;
  uses_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: Array<{ id: string; name: string }>;
  onCreated: () => void;
}

export function FunnelTemplatesDialog({ open, onOpenChange, projects, onCreated }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [projectId, setProjectId] = useState<string>("none");
  const [customName, setCustomName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("imphq_funnel_templates" as any)
      .select("*")
      .order("uses_count", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Erro carregando templates: " + error.message);
        else setTemplates((data as any) || []);
        setLoading(false);
      });
  }, [open]);

  const handleUse = async () => {
    if (!selected) return;
    const nome = customName.trim() || selected.nome;
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from("imphq_funis").insert([{
        id,
        nome,
        tipo: selected.objetivo,
        status: "Rascunho",
        project_id: projectId === "none" ? null : projectId,
        data: selected.canvas as any,
      }]);
      if (error) throw error;
      await supabase
        .from("imphq_funnel_templates" as any)
        .update({ uses_count: selected.uses_count + 1 })
        .eq("id", selected.id);
      toast.success(`Funil "${nome}" criado a partir de ${selected.nome}`);
      onOpenChange(false);
      setSelected(null);
      setCustomName("");
      setProjectId("none");
      onCreated();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Biblioteca de Templates de Funil
          </DialogTitle>
          <DialogDescription>
            Escolha um modelo pronto e clone em segundos com canvas pré-configurado.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : !selected ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((t) => {
              const etapas = (t.canvas?.etapas || []) as any[];
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelected(t); setCustomName(t.nome); }}
                  className="text-left rounded-lg border border-border/60 hover:border-primary/60 bg-background/40 p-4 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-base">{t.nome}</h3>
                    <Badge variant="outline" className="text-xs">{t.uses_count} usos</Badge>
                  </div>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {t.nicho && <Badge variant="secondary" className="text-xs">{t.nicho}</Badge>}
                    <Badge className="text-xs bg-primary/15 text-primary border-primary/30">{t.objetivo}</Badge>
                    <Badge variant="outline" className="text-xs">{etapas.length} etapas</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-6">{t.descricao}</p>
                  <div className="mt-3 flex gap-1 flex-wrap">
                    {etapas.slice(0, 6).map((e: any, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                        {e.nome}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{selected.nome}</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Voltar</Button>
              </div>
              <p className="text-sm text-muted-foreground leading-7">{selected.descricao}</p>
            </div>
            <div>
              <Label>Nome do novo funil</Label>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ex: VSL Corte Express 2025" />
            </div>
            <div>
              <Label>Vincular a projeto (opcional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUse} disabled={creating} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              Criar funil com este template
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
