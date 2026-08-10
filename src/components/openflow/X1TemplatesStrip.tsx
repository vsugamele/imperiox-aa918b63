import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FLOW_TEMPLATES, type FlowTemplate } from "./flow-editor/templates";

function canalSugerido(t: FlowTemplate): string {
  if (t.id.includes("webchat") || t.id.includes("whatsapp")) {
    return t.id.includes("messenger") ? "messenger" : t.id.includes("webchat") ? "webchat" : "webchat";
  }
  if (t.id.includes("messenger")) return "messenger";
  return "whatsapp";
}

function canalLabel(c: string) {
  return c === "messenger" ? "Messenger" : c === "webchat" ? "Chat do site" : "WhatsApp";
}

interface Props {
  /** Nomes dos fluxos já existentes, para marcar o que já foi criado. */
  existingNames: string[];
  onCreated: () => void;
}

/**
 * Mostra os funis X1 prontos direto no dashboard (não escondidos atrás de um botão),
 * com 1 clique para criar. Quem já existe aparece marcado como "já criado".
 */
export function X1TemplatesStrip({ existingNames, onCreated }: Props) {
  const templates = useMemo(() => FLOW_TEMPLATES.filter((t) => t.categoria === "x1-conversao"), []);
  const [creating, setCreating] = useState<string | null>(null);

  const existe = (nome: string) => existingNames.some((n) => (n || "").trim() === nome.trim());

  const criar = async (t: FlowTemplate) => {
    setCreating(t.id);
    const { error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(),
      nome: t.nome,
      trigger_tipo: t.trigger_tipo,
      acoes: JSON.parse(JSON.stringify(t.acoes)),
      ativo: false,
      canal: canalSugerido(t),
    } as any);
    setCreating(null);
    if (error) return toast.error(error.message);
    toast.success("Fluxo criado (desativado). Revise as mídias e os links antes de ligar.");
    onCreated();
  };

  if (templates.length === 0) return null;

  return (
    <Card className="bg-secondary/20 border-white/10">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg">Funis X1 prontos</h3>
          <Badge variant="outline" className="text-[10px]">{templates.length} templates</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-6">
          Script fixo nas partes que sempre convertem + IA nos pontos de decisão. Um clique cria o fluxo já
          montado e desativado, para você revisar mídias e links.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const criado = existe(t.nome);
            return (
              <div key={t.id} className="rounded-xl border border-white/10 bg-background/40 p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-6">
                    <span className="mr-1">{t.emoji}</span>{t.nome}
                  </p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{t.acoes.length} passos</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-6 flex-1">{t.descricao}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] uppercase text-primary/80">{canalLabel(canalSugerido(t))}</span>
                  {criado ? (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                      já criado
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={creating === t.id} onClick={() => criar(t)}>
                      {creating === t.id
                        ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        : <Plus className="h-3.5 w-3.5 mr-1" />}
                      Criar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
