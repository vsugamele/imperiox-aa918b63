import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, Layers, Search } from "lucide-react";
import { FLOW_TEMPLATES, getTemplatesByTrigger, type FlowTemplate } from "./templates";
import type { Acao } from "../FlowEditor";

interface Props {
  triggerTipo?: string;
  onApply: (acoes: Acao[], triggerTipo: string, nome: string) => void;
  /**
   * Quando true, renderiza um botão grande com CTA. Quando false, botão pequeno na toolbar.
   */
  variant?: "hero" | "compact";
  disabled?: boolean;
}

export function TemplatePicker({ triggerTipo, onApply, variant = "compact", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const recommended = useMemo(() => getTemplatesByTrigger(triggerTipo), [triggerTipo]);
  const otros = useMemo(
    () => FLOW_TEMPLATES.filter((t) => !recommended.find((r) => r.id === t.id)),
    [recommended]
  );

  const filter = (list: FlowTemplate[]) => {
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter(
      (t) =>
        t.nome.toLowerCase().includes(needle) ||
        t.descricao.toLowerCase().includes(needle) ||
        t.categoria.toLowerCase().includes(needle)
    );
  };

  const apply = (t: FlowTemplate) => {
    onApply(JSON.parse(JSON.stringify(t.acoes)), t.trigger_tipo, t.nome);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "hero" ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20"
          >
            <Sparkles className="h-4 w-4" /> Começar de um template
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-7 gap-1.5 px-2 text-xs"
            title="Templates de fluxo"
          >
            <Layers className="h-3.5 w-3.5" />
            Templates
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-secondary/40 backdrop-blur leading-7">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Templates de Fluxo</DialogTitle>
          <DialogDescription>
            Comece de um ponto sólido. Você pode editar tudo depois.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar template…"
            className="pl-9"
          />
        </div>

        {recommended.length > 0 && triggerTipo && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-primary/80">
              Recomendados pro seu gatilho
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filter(recommended).map((t) => (
                <TemplateCard key={t.id} t={t} onClick={() => apply(t)} highlight />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {triggerTipo ? "Outros templates" : "Todos"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-1">
            {filter(triggerTipo ? otros : FLOW_TEMPLATES).map((t) => (
              <TemplateCard key={t.id} t={t} onClick={() => apply(t)} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ t, onClick, highlight }: { t: FlowTemplate; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-start gap-1.5 rounded-lg border px-3 py-3 text-left transition hover:scale-[1.01] hover:border-primary/60 hover:bg-primary/5 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-white/10 bg-white/2"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{t.emoji}</span>
          <span>{t.nome}</span>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {t.acoes.length} etapas
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t.descricao}</p>
    </button>
  );
}
