import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  funil: { id: string; nome: string; project_id?: string | null } | null;
  projects: { id: string; name: string }[];
  onDone?: () => void;
};

export function CloneFunnelDialog({ open, onOpenChange, funil, projects, onDone }: Props) {
  const [targetProject, setTargetProject] = useState<string>("");
  const [newNome, setNewNome] = useState("");
  const [includeFlows, setIncludeFlows] = useState(true);
  const [includeAutomacoes, setIncludeAutomacoes] = useState(true);
  const [includeChecklists, setIncludeChecklists] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleClone() {
    if (!funil || !targetProject) {
      toast.error("Selecione o projeto destino");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("funnel-clone", {
      body: {
        funil_id: funil.id,
        target_project_id: targetProject,
        new_nome: newNome || undefined,
        include_flows: includeFlows,
        include_automacoes: includeAutomacoes,
        include_checklists: includeChecklists,
      },
    });
    setLoading(false);
    if (error || !data?.ok) {
      toast.error(error?.message || data?.error || "Falha ao clonar");
      return;
    }
    toast.success(`Funil clonado! ${data.automacoes || 0} automações, ${data.flows || 0} templates, ${data.checklists || 0} checklists.`);
    onOpenChange(false);
    onDone?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Clonar funil "{funil?.nome}"</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Projeto destino</Label>
            <Select value={targetProject} onValueChange={setTargetProject}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {projects.filter((p) => p.id !== funil?.project_id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Novo nome (opcional)</Label>
            <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder={`${funil?.nome} (cópia)`} />
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={includeAutomacoes} onCheckedChange={(v) => setIncludeAutomacoes(!!v)} /> Automações do projeto origem</label>
            <label className="flex items-center gap-2"><Checkbox checked={includeFlows} onCheckedChange={(v) => setIncludeFlows(!!v)} /> Templates de WhatsApp</label>
            <label className="flex items-center gap-2"><Checkbox checked={includeChecklists} onCheckedChange={(v) => setIncludeChecklists(!!v)} /> Checklists do funil</label>
          </div>
          <p className="text-[10px] text-muted-foreground">Leads, vendas, credenciais e providers de WhatsApp NÃO são copiados.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleClone} disabled={loading || !targetProject}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Clonar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
