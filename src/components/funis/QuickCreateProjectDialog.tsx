import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FolderPlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (projectId: string) => void | Promise<void>;
}

export function QuickCreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setIcon("📁"); setCategory(""); setDescription(""); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Informe o nome do projeto"); return; }
    setSaving(true);
    try {
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const id = `${slug || "projeto"}-${Date.now().toString(36)}`;
      const { error } = await supabase.from("imphq_projects").insert({
        id, name: name.trim(), icon, category: category.trim() || null, description: description.trim() || null,
      });
      if (error) throw error;
      toast.success("Projeto criado");
      reset();
      onOpenChange(false);
      await onCreated?.(id);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar projeto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[440px] bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-primary" /> Criar projeto
          </DialogTitle>
          <DialogDescription className="leading-7">
            Crie um novo projeto sem sair do Hub. Depois é só adicionar produtos e funis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <Label className="text-xs">Ícone</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className="text-center text-lg" />
            </div>
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Laise" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="iGaming, Infoproduto…" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Breve descrição (opcional)" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Criando…" : "Criar projeto"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
