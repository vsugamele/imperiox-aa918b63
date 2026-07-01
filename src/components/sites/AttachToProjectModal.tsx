import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Site } from "./SiteCard";

const PAPEIS = [
  { value: "lp", label: "LP Principal" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
  { value: "obrigado", label: "Obrigado" },
  { value: "captura", label: "Captura" },
  { value: "checkout", label: "Checkout" },
  { value: "outro", label: "Outro" },
];

export function AttachToProjectModal({
  site, onOpenChange,
}: { site: Site | null; onOpenChange: (v: boolean) => void }) {
  const [projects, setProjects] = useState<{ id: string; nome: string }[]>([]);
  const [projetoId, setProjetoId] = useState<string>("");
  const [papel, setPapel] = useState("lp");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!site) return;
    supabase.from("imphq_projects").select("id, nome").order("nome").then(({ data }) => {
      setProjects((data || []) as any);
    });
  }, [site]);

  async function handleSave() {
    if (!site || !projetoId) return toast.error("Selecione um projeto");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("imphq_project_sites").insert({
      user_id: userData.user!.id,
      site_id: site.id,
      projeto_id: projetoId,
      papel,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Site anexado ao projeto");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40">
        <DialogHeader>
          <DialogTitle>Anexar site a projeto</DialogTitle>
          <DialogDescription className="leading-7">
            Vincule "{site?.titulo}" a um projeto. Aparece na aba Sites do projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger><SelectValue placeholder="Escolha um projeto" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Papel no funil</Label>
            <Select value={papel} onValueChange={setPapel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAPEIS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>Anexar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
