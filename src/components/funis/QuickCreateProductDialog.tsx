import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string | null;
  onCreated?: () => void | Promise<void>;
}

const TIPOS = ["Curso", "Mentoria", "Consultoria", "Serviço", "SaaS", "Infoproduto", "Ebook", "Comunidade"];

export function QuickCreateProductDialog({ open, onOpenChange, projectId, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [tipo, setTipo] = useState("Curso");
  const [saving, setSaving] = useState(false);

  const reset = () => { setNome(""); setPreco(""); setTipo("Curso"); };

  const handleSave = async () => {
    if (!projectId || !nome.trim()) { toast.error("Informe o nome do produto"); return; }
    setSaving(true);
    try {
      const { data: row } = await supabase.from("imphq_projects").select("data").eq("id", projectId).maybeSingle();
      const d: any = (row?.data && typeof row.data === "object") ? row.data : {};
      const briefing = (d.briefing && typeof d.briefing === "object") ? d.briefing : null;
      const target = briefing || d;
      const list = Array.isArray(target.produtos) ? target.produtos : [];
      const novo = { nome: nome.trim(), preco: preco.trim(), tipo, status: "ativo", links: [], ofertas: [] };
      target.produtos = [...list, novo];
      const newData = briefing ? { ...d, briefing: target } : { ...d, produtos: target.produtos };
      const { error } = await supabase.from("imphq_projects").update({ data: newData }).eq("id", projectId);
      if (error) throw error;
      toast.success("Produto criado");
      reset();
      onOpenChange(false);
      await onCreated?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar produto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[420px] bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Criar produto rápido
          </DialogTitle>
          <DialogDescription>
            Base para o Hub, funis e checklist. Você pode completar o restante no Briefing depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Nome do produto *</Label>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mentoria Aviator" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Preço (R$)</Label>
              <Input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="1997" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nome.trim()}>{saving ? "Criando…" : "Criar produto"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
