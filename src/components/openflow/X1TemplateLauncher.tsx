import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FLOW_TEMPLATES, type FlowTemplate } from "./flow-editor/templates";

const CANAIS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger (Zernio)" },
  { value: "webchat", label: "Chat do site" },
];

function canalSugerido(t: FlowTemplate): string {
  if (t.id.includes("webchat")) return "webchat";
  if (t.id.includes("messenger")) return "messenger";
  return "whatsapp";
}

function resumoBlocos(t: FlowTemplate): string {
  const label: Record<string, string> = {
    whatsapp: "mensagem",
    audio: "áudio",
    ia_message: "IA",
    wait_reply: "aguarda resposta",
    aguardar: "espera",
    qualify_lead: "qualifica",
    adicionar_tag: "tag",
    notify_operator: "notifica",
    stop_on_event: "para no evento",
  };
  return t.acoes
    .slice(0, 4)
    .map((a) => label[a.tipo] || a.tipo)
    .join(" → ");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: { id: string; name: string }[];
  onCreated: () => void;
}

export function X1TemplateLauncher({ open, onOpenChange, projects, onCreated }: Props) {
  const templates = useMemo(() => FLOW_TEMPLATES.filter((t) => t.categoria === "x1-conversao"), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("__none__");
  const [canal, setCanal] = useState<string>("whatsapp");
  const [saving, setSaving] = useState(false);

  const pick = (t: FlowTemplate) => {
    setSelected(t.id);
    setCanal(canalSugerido(t));
  };

  const criar = async () => {
    const tpl = templates.find((t) => t.id === selected);
    if (!tpl) { toast.error("Escolha um template"); return; }
    setSaving(true);
    const { error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(),
      nome: tpl.nome,
      trigger_tipo: tpl.trigger_tipo,
      project_id: projectId === "__none__" ? null : projectId,
      acoes: JSON.parse(JSON.stringify(tpl.acoes)),
      ativo: false,
      canal,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo criado a partir do template — revise e ative.");
    setSelected(null);
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-secondary/40 backdrop-blur leading-7">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Templates X1 de conversão
          </DialogTitle>
          <DialogDescription>
            Funis 1:1 prontos com script fixo + IA nos pontos de decisão. O fluxo é criado desativado para você
            revisar as mídias e os links antes de ligar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 max-h-[45vh] overflow-y-auto pr-1">
          {templates.map((t) => {
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-white/10 bg-background/40 hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm leading-6">
                    <span className="mr-1">{t.emoji}</span>
                    {t.nome}
                  </p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{t.acoes.length} passos</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-6">{t.descricao}</p>
                <p className="mt-2 text-[11px] text-primary/80">{resumoBlocos(t)} …</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem projeto</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Canal</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={criar} disabled={!selected || saving} className="bg-amber-500 text-black hover:bg-amber-400 font-bold">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Criar fluxo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
