import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StudioPrompt } from "./StudioPrompts";

const NIVEIS = ["Padrão", "Hot", "Ultra Hot"];

interface Props {
  open: boolean;
  prompt: StudioPrompt | null;
  onClose: () => void;
  onSaved: () => void;
  nichosExistentes: string[];
}

const empty = {
  nicho: "cartomantes",
  codigo: "",
  titulo: "",
  idade: "",
  genero: "♀",
  nivel: "Padrão",
  prompt_especifico: "",
  prompt_negativo: "",
  dicas: "",
};

export function PromptEditorDialog({ open, prompt, onClose, onSaved, nichosExistentes }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prompt) {
      setForm({
        nicho: prompt.nicho,
        codigo: prompt.codigo || "",
        titulo: prompt.titulo,
        idade: prompt.idade || "",
        genero: prompt.genero || "♀",
        nivel: prompt.nivel,
        prompt_especifico: prompt.prompt_especifico,
        prompt_negativo: prompt.prompt_negativo || "",
        dicas: prompt.dicas || "",
      });
    } else {
      setForm(empty);
    }
  }, [prompt, open]);

  async function save() {
    if (!form.titulo || !form.prompt_especifico) {
      toast.error("Título e prompt são obrigatórios.");
      return;
    }
    setSaving(true);
    const payload = {
      nicho: form.nicho.trim().toLowerCase() || "geral",
      codigo: form.codigo || null,
      titulo: form.titulo,
      idade: form.idade || null,
      genero: form.genero || null,
      nivel: form.nivel,
      prompt_especifico: form.prompt_especifico,
      prompt_negativo: form.prompt_negativo || null,
      dicas: form.dicas || null,
    };
    const { error } = prompt
      ? await supabase.from("imphq_studio_prompts").update(payload).eq("id", prompt.id)
      : await supabase.from("imphq_studio_prompts").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(prompt ? "Prompt atualizado" : "Prompt criado");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-secondary/40 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {prompt ? "Editar prompt" : "Novo prompt"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="col-span-2">
            <Label>Título</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="ex: VOVÓ NA COZINHA"
            />
          </div>

          <div>
            <Label>Nicho</Label>
            <Input
              value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value })}
              placeholder="cartomantes, fitness..."
              list="nichos-list"
            />
            <datalist id="nichos-list">
              {nichosExistentes.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div>
            <Label>Código</Label>
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="ex: 1F"
            />
          </div>

          <div>
            <Label>Idade</Label>
            <Input
              value={form.idade}
              onChange={(e) => setForm({ ...form, idade: e.target.value })}
              placeholder="ex: 70 anos"
            />
          </div>

          <div>
            <Label>Gênero</Label>
            <Select value={form.genero} onValueChange={(v) => setForm({ ...form, genero: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="♀ Feminino">♀ Feminino</SelectItem>
                <SelectItem value="♂ Masculino">♂ Masculino</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Nível</Label>
            <Select value={form.nivel} onValueChange={(v) => setForm({ ...form, nivel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVEIS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Prompt principal</Label>
            <Textarea
              value={form.prompt_especifico}
              onChange={(e) => setForm({ ...form, prompt_especifico: e.target.value })}
              rows={10}
              className="font-mono text-xs leading-6"
            />
          </div>

          <div className="col-span-2">
            <Label>Prompt negativo (opcional)</Label>
            <Textarea
              value={form.prompt_negativo}
              onChange={(e) => setForm({ ...form, prompt_negativo: e.target.value })}
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          <div className="col-span-2">
            <Label>Dicas (opcional)</Label>
            <Textarea
              value={form.dicas}
              onChange={(e) => setForm({ ...form, dicas: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
