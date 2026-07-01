import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Package, Loader2, RotateCw } from "lucide-react";

interface Rule {
  id: string;
  produto_nome: string;
  project_id: string;
  override_existing: boolean;
}

export function ProductRoutingRulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; icon?: string | null }>>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [produto, setProduto] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [overrideExisting, setOverrideExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backfilling, setBackfilling] = useState<string | null>(null);

  const load = async () => {
    const [{ data: r }, { data: p }, { data: v }] = await Promise.all([
      supabase.from("imphq_product_project_rules" as any).select("*").order("produto_nome"),
      supabase.from("imphq_projects").select("id,name,icon").eq("is_archived", false).order("name"),
      supabase.from("imphq_vendas").select("produto_nome").not("produto_nome", "is", null).limit(2000),
    ] as PromiseLike<any>[]);
    setRules((r || []) as any);
    setProjects((p || []) as any);
    const set = new Set<string>();
    (v || []).forEach((row: any) => row.produto_nome && set.add(row.produto_nome));
    setProducts(Array.from(set).sort());
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!produto || !projectId) { toast.error("Selecione produto e projeto"); return; }
    setBusy(true);
    const { error } = await supabase.from("imphq_product_project_rules" as any).upsert({
      produto_nome: produto, project_id: projectId, override_existing: overrideExisting,
    } as any, { onConflict: "produto_nome" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setProduto(""); setProjectId(""); setOverrideExisting(false);
    toast.success("Regra salva");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta regra?")) return;
    await supabase.from("imphq_product_project_rules" as any).delete().eq("id", id);
    toast.success("Removida");
    load();
  };

  const backfill = async (r: Rule) => {
    setBackfilling(r.id);
    const { data, error } = await supabase.rpc("backfill_product_project_rule" as any, {
      p_produto: r.produto_nome, p_project: r.project_id, p_override: r.override_existing,
    });
    setBackfilling(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data || 0} leads atualizados`);
  };

  const projectLabel = (id: string) => {
    const p = projects.find(x => x.id === id);
    return p ? `${p.icon || "📁"} ${p.name}` : id;
  };

  return (
    <Card className="bg-secondary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-primary" /> Produto → Projeto
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-7">
          Quando uma venda de um produto for registrada, o lead será automaticamente vinculado ao projeto definido.
          Use "Aplicar agora" para reatribuir leads que já existem.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-5">
            <label className="text-xs text-muted-foreground">Produto</label>
            <Select value={produto || undefined} onValueChange={(v) => setProduto(v)}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {products.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum produto encontrado em vendas.</div>}
                {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4">
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId || undefined} onValueChange={setProjectId}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-center gap-2 pb-2">
            <Checkbox id="override" checked={overrideExisting} onCheckedChange={(v) => setOverrideExisting(!!v)} />
            <label htmlFor="override" className="text-[10px] cursor-pointer leading-tight">Sobrescrever projeto já atribuído</label>
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
                <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs truncate max-w-[40%]">{r.produto_nome}</span>
                <span className="text-muted-foreground">→</span>
                <span className="flex-1 truncate">{projectLabel(r.project_id)}</span>
                {r.override_existing && <Badge variant="outline" className="text-[9px]">sobrescreve</Badge>}
                <Button variant="ghost" size="sm" onClick={() => backfill(r)} disabled={backfilling === r.id} className="h-7 gap-1 text-xs">
                  {backfilling === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                  Aplicar agora
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(r.id)} className="h-7 w-7 p-0 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
