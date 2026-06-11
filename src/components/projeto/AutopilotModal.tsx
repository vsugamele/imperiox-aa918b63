import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

export function AutopilotModal({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    nicho: "",
    url_concorrente: "",
    icon: "✨",
    preset: "essencial" as "essencial" | "completo",
  });

  const handleStart = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome do produto obrigatório", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const projectId =
        form.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") +
        "-" +
        Date.now().toString(36);

      // 1. Cria projeto
      const { error: projErr } = await supabase.from("imphq_projects").insert({
        id: projectId,
        name: form.nome,
        icon: form.icon,
        category: "autopilot",
        description: form.nicho ? `Nicho: ${form.nicho}` : "",
        data: {
          briefing: { nicho: form.nicho, produto_principal: form.nome },
          autopilot: { pending: true },
        } as any,
      });
      if (projErr) throw projErr;

      // 2. Dispara o autopilot
      const { data, error } = await supabase.functions.invoke("project-autopilot", {
        body: {
          action: "start",
          project_id: projectId,
          user_id: user?.id ?? null,
          input: {
            nome: form.nome,
            nicho: form.nicho || null,
            url_concorrente: form.url_concorrente.trim() || null,
            preset: form.preset,
          },
        },
      });
      if (error) throw error;

      const runId = (data as any)?.run_id;
      toast({ title: "Autopilot iniciado", description: "Acompanhe o progresso ao vivo." });
      onOpenChange(false);
      onCreated?.();
      navigate(`/projetos/${projectId}/autopilot/${runId}`);
    } catch (err: any) {
      toast({ title: "Erro ao iniciar Autopilot", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 border-border backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Criar com Autopilot
          </DialogTitle>
          <DialogDescription className="leading-7">
            Informe o produto e o nicho. O Imperius roda as skills selecionadas em sequência,
            injetando o resultado de uma na próxima, e consolida tudo no projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <div className="w-16">
              <Label>Emoji</Label>
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="bg-secondary text-center text-xl"
              />
            </div>
            <div className="flex-1">
              <Label>Nome do produto *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="bg-secondary"
                placeholder="Ex: Mapa Astral Premium"
              />
            </div>
          </div>

          <div>
            <Label>Nicho</Label>
            <Input
              value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value })}
              className="bg-secondary"
              placeholder="Ex: Astrologia / espiritualidade feminina"
            />
          </div>

          <div>
            <Label>URL de concorrente (opcional)</Label>
            <Input
              value={form.url_concorrente}
              onChange={(e) => setForm({ ...form, url_concorrente: e.target.value })}
              className="bg-secondary"
              placeholder="https://astrolink.com.br/..."
            />
            <p className="text-xs text-muted-foreground mt-1 leading-7">
              Se informar, o Imperius raspa a página com Firecrawl e injeta como insumo.
            </p>
          </div>

          <div>
            <Label>Profundidade</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                { id: "essencial", title: "Essencial", desc: "5 skills · ~2 min" },
                { id: "completo", title: "Completo", desc: "15 skills · ~6 min" },
              ] as const).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm({ ...form, preset: p.id })}
                  className={`text-left rounded-md border p-3 transition ${
                    form.preset === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/40 hover:bg-secondary/60"
                  }`}
                >
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleStart} disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Iniciar Autopilot</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
