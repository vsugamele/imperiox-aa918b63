import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tag: string;
  projects: Array<{ id: string; nome?: string; name?: string; icon?: string }>;
}

export default function QuickTagRuleDialog({ open, onOpenChange, tag, projects }: Props) {
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState(100);
  const [busy, setBusy] = useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [createdRuleProj, setCreatedRuleProj] = useState<string | null>(null);

  useEffect(() => { if (open) { setProjectId(""); setPriority(100); setCreatedRuleProj(null); } }, [open]);

  const create = async () => {
    if (!projectId) { toast.error("Selecione um projeto"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("imphq_tag_project_rules").insert({
      user_id: user.id, tag, tags_all: [tag], project_id: projectId, priority,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCreatedRuleProj(projectId);
    toast.success("Regra criada");
  };

  const backfill = async () => {
    if (!createdRuleProj) return;
    setBackfillBusy(true);
    try {
      const { data: leads } = await supabase
        .from("imphq_leads").select("id").is("project_id", null).contains("tags", [tag]).limit(5000);
      const ids = (leads || []).map((l: any) => l.id);
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        await supabase.from("imphq_leads").update({ project_id: createdRuleProj }).in("id", chunk);
      }
      toast.success(`${ids.length} leads movidos`);
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    setBackfillBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/95 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Criar regra de roteamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-7">
          <p className="text-muted-foreground">Leads novos com a tag <Badge variant="outline" className="mx-1">{tag}</Badge> serão direcionados ao projeto escolhido.</p>
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId} disabled={!!createdRuleProj}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name || p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prioridade</label>
            <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value) || 100)} className="bg-background" disabled={!!createdRuleProj} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!createdRuleProj ? (
            <Button onClick={create} disabled={busy}>{busy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}Criar regra</Button>
          ) : (
            <Button onClick={backfill} disabled={backfillBusy}>{backfillBusy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}Aplicar nos leads existentes</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
