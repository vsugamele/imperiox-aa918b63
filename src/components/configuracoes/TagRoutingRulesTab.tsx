import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Loader2 } from "lucide-react";

interface Rule {
  id: string;
  tag: string;
  project_id: string;
  priority: number;
}

export function TagRoutingRulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; nome: string }>>([]);
  const [tag, setTag] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState(100);
  const [busy, setBusy] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const load = async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("imphq_tag_project_rules").select("*").order("priority", { ascending: true }),
      supabase.from("imphq_projects").select("id,nome").order("nome"),
    ] as PromiseLike<any>[]);
    setRules((r || []) as any);
    setProjects((p || []) as any);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!tag.trim() || !projectId) { toast.error("Tag e projeto são obrigatórios"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("imphq_tag_project_rules").insert({
      user_id: user.id, tag: tag.trim(), project_id: projectId, priority,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setTag(""); setProjectId(""); setPriority(100);
    toast.success("Regra criada");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta regra?")) return;
    await supabase.from("imphq_tag_project_rules").delete().eq("id", id);
    toast.success("Removida");
    load();
  };

  const backfill = async () => {
    if (!confirm("Aplicar todas as regras nos leads existentes sem projeto?")) return;
    setBackfilling(true);
    let total = 0;
    try {
      for (const rule of rules) {
        const { data: leads } = await supabase
          .from("imphq_leads")
          .select("id")
          .is("project_id", null)
          .contains("tags", [rule.tag])
          .limit(2000);
        if (leads && leads.length) {
          const ids = leads.map((l: any) => l.id);
          await supabase.from("imphq_leads").update({ project_id: rule.project_id }).in("id", ids);
          total += ids.length;
        }
      }
      toast.success(`${total} leads atualizados`);
    } catch (e: any) { toast.error(e.message); }
    setBackfilling(false);
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.nome || id;

  return (
    <Card className="bg-secondary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4 text-primary" /> Roteamento por Tag</CardTitle>
        <p className="text-xs text-muted-foreground leading-7">
          Quando um lead chegar (formulário, área de membros, import) com a tag X, ele será automaticamente vinculado ao projeto Y.
          Regras com menor prioridade vencem em caso de empate.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="text-xs text-muted-foreground">Tag</label>
            <Input value={tag} onChange={e => setTag(e.target.value)} placeholder="ex: cortes" className="bg-background" />
          </div>
          <div className="col-span-5">
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Prioridade</label>
            <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value) || 100)} className="bg-background" />
          </div>
          <div className="col-span-1">
            <Button onClick={add} disabled={busy} size="sm" className="w-full">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma regra ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {rules.map(r => (
              <div key={r.id} className="flex items-center gap-2 bg-background/50 rounded p-2 text-sm">
                <span className="font-mono text-primary">#{r.priority}</span>
                <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">{r.tag}</span>
                <span className="text-muted-foreground">→</span>
                <span className="flex-1">{projectName(r.project_id)}</span>
                <Button variant="ghost" size="sm" onClick={() => remove(r.id)} className="h-7 w-7 p-0 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {rules.length > 0 && (
          <div className="pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={backfill} disabled={backfilling}>
              {backfilling ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
              Aplicar regras nos leads existentes sem projeto
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
