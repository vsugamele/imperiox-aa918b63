import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Loader2, Eye, X } from "lucide-react";
import { useLeadTags } from "@/hooks/useLeadTags";

interface OrphanTag { tag: string; count: number; }
interface Rule {
  id: string;
  tag: string | null;
  tags_all: string[] | null;
  origem: string | null;
  plataforma: string | null;
  project_id: string;
  priority: number;
}

const PLATFORMS = ["Meta", "Google", "TikTok", "Hotmart", "Kiwify", "Ticto", "Orgânico", "Indicação"];

export function TagRoutingRulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [orphanTags, setOrphanTags] = useState<OrphanTag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagsAll, setTagsAll] = useState<string[]>([]);
  const [origem, setOrigem] = useState("");
  const [plataforma, setPlataforma] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState(100);
  const [busy, setBusy] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState<{ ruleLabel: string; count: number }[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const { tags: leadTags } = useLeadTags();

  const load = async () => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: r }, { data: p }, { data: leads }] = await Promise.all([
      supabase.from("imphq_tag_project_rules").select("*").order("priority", { ascending: true }),
      supabase.from("imphq_projects").select("id,name").eq("is_archived", false).order("name"),
      supabase.from("imphq_leads").select("tags").is("project_id", null).not("tags", "is", null).gte("created_at", since).limit(1000),
    ] as PromiseLike<any>[]);
    setRules((r || []) as any);
    setProjects((p || []) as any);
    const counts = new Map<string, number>();
    (leads || []).forEach((l: any) => {
      (l.tags || []).forEach((t: string) => {
        if (!t) return;
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    setOrphanTags(Array.from(counts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 20));
  };
  useEffect(() => { load(); }, []);

  const addTagChip = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (tagsAll.includes(t)) { setTagInput(""); return; }
    setTagsAll([...tagsAll, t]);
    setTagInput("");
  };

  const add = async () => {
    if (tagsAll.length === 0 || !projectId) { toast.error("Adicione ao menos 1 tag e selecione o projeto"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const payload: any = {
      user_id: user.id,
      tag: tagsAll[0], // retrocompat
      tags_all: tagsAll,
      origem: origem.trim() || null,
      plataforma: plataforma || null,
      project_id: projectId,
      priority,
    };
    const { error } = await supabase.from("imphq_tag_project_rules").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setTagsAll([]); setTagInput(""); setOrigem(""); setPlataforma(undefined); setProjectId(""); setPriority(100);
    toast.success("Regra criada");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta regra?")) return;
    await supabase.from("imphq_tag_project_rules").delete().eq("id", id);
    toast.success("Removida");
    load();
  };

  const ruleLabel = (r: Rule) => {
    const tags = r.tags_all && r.tags_all.length > 0 ? r.tags_all : (r.tag ? [r.tag] : []);
    let s = tags.join(" + ");
    if (r.origem) s += ` · origem:${r.origem}`;
    if (r.plataforma) s += ` · ${r.plataforma}`;
    return s;
  };

  // Query base — leads que casam com a regra
  const buildQueryForRule = (r: Rule, headMode: boolean) => {
    const tags = r.tags_all && r.tags_all.length > 0 ? r.tags_all : (r.tag ? [r.tag] : []);
    let q = supabase
      .from("imphq_leads")
      .select("id", headMode ? { count: "exact", head: true } : { count: "exact" });
    if (!overwrite) q = q.is("project_id", null);
    if (tags.length > 0) q = q.contains("tags", tags);
    if (r.plataforma) q = q.eq("plataforma", r.plataforma);
    // origem fica em data->>origem
    if (r.origem) q = q.eq("data->>origem", r.origem);
    return q;
  };

  const runPreview = async () => {
    if (rules.length === 0) return;
    setPreviewing(true);
    try {
      const results: { ruleLabel: string; count: number }[] = [];
      for (const r of rules) {
        const { count } = await buildQueryForRule(r, true);
        results.push({ ruleLabel: `${ruleLabel(r)} → ${projectName(r.project_id)}`, count: count || 0 });
      }
      setPreview(results);
    } catch (e: any) { toast.error(e.message); }
    setPreviewing(false);
  };

  const backfill = async () => {
    const msg = overwrite
      ? "Isso vai REATRIBUIR leads que já estão em outro projeto. Confirma?"
      : "Aplicar todas as regras nos leads existentes sem projeto?";
    if (!confirm(msg)) return;
    setBackfilling(true);
    let total = 0;
    try {
      for (const rule of rules) {
        const tags = rule.tags_all && rule.tags_all.length > 0 ? rule.tags_all : (rule.tag ? [rule.tag] : []);
        if (tags.length === 0) continue;
        let q = supabase.from("imphq_leads").select("id").contains("tags", tags).limit(5000);
        if (!overwrite) q = q.is("project_id", null);
        if (rule.plataforma) q = q.eq("plataforma", rule.plataforma);
        if (rule.origem) q = q.eq("data->>origem", rule.origem);
        const { data: leads } = await q;
        if (leads && leads.length) {
          const ids = leads.map((l: any) => l.id);
          for (let i = 0; i < ids.length; i += 500) {
            const chunk = ids.slice(i, i + 500);
            await supabase.from("imphq_leads").update({ project_id: rule.project_id }).in("id", chunk);
          }
          total += ids.length;
        }
      }
      toast.success(`${total} leads atualizados`);
      setPreview(null);
    } catch (e: any) { toast.error(e.message); }
    setBackfilling(false);
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id;

  const useOrphanTag = (t: string) => {
    if (!tagsAll.includes(t)) setTagsAll([...tagsAll, t]);
    setTimeout(() => document.getElementById("tag-rule-project-trigger")?.focus(), 50);
  };

  return (
    <Card className="bg-secondary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4 text-primary" /> Roteamento por Tag</CardTitle>
        <p className="text-xs text-muted-foreground leading-7">
          Quando um lead chegar com as tags (todas devem casar) e os filtros opcionais, ele será vinculado ao projeto.
          Menor prioridade vence em empate.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="text-xs text-muted-foreground">Tags (todas devem casar)</label>
            <div className="flex flex-wrap gap-1 mb-1 min-h-[22px]">
              {tagsAll.map(t => (
                <Badge key={t} variant="outline" className="gap-1 text-[10px]">
                  {t}
                  <button onClick={() => setTagsAll(tagsAll.filter(x => x !== t))}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTagChip(); } }}
              onBlur={addTagChip}
              placeholder="ex: cortes (Enter)" className="bg-background" list="lead-tags-datalist" />
            <datalist id="lead-tags-datalist">
              {leadTags.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Origem (opcional)</label>
            <Input value={origem} onChange={e => setOrigem(e.target.value)} placeholder="ex: form_x" className="bg-background" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Plataforma (opcional)</label>
            <Select value={plataforma} onValueChange={(v) => setPlataforma(v === "__all__" ? undefined : v)}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Qualquer</SelectItem>
                {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="tag-rule-project-trigger" className="bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {projects.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum projeto ativo.</div>}
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <label className="text-xs text-muted-foreground">Prio</label>
            <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value) || 100)} className="bg-background" />
          </div>
          <div className="col-span-1">
            <Button onClick={add} disabled={busy} size="sm" className="w-full">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {orphanTags.length > 0 && (
          <div className="rounded border border-border bg-background/40 p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              Tags de leads sem projeto (últimos 90 dias) — clique para preencher e crie a regra:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {orphanTags.map(o => (
                <button key={o.tag} onClick={() => useOrphanTag(o.tag)}>
                  <Badge variant="outline" className="text-[10px] hover:bg-primary/10 cursor-pointer">
                    {o.tag} <span className="text-muted-foreground ml-1">({o.count})</span>
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma regra ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {rules.map(r => (
              <div key={r.id} className="flex items-center gap-2 bg-background/50 rounded p-2 text-sm">
                <span className="font-mono text-primary">#{r.priority}</span>
                <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">{ruleLabel(r)}</span>
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
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="overwrite" checked={overwrite} onCheckedChange={(v) => setOverwrite(!!v)} />
              <label htmlFor="overwrite" className="text-xs cursor-pointer">Sobrescrever projeto já atribuído (reatribuir leads que já estão em outro projeto)</label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={runPreview} disabled={previewing || backfilling}>
                {previewing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Eye className="h-3 w-3 mr-2" />}
                Pré-visualizar impacto
              </Button>
              <Button variant="outline" size="sm" onClick={backfill} disabled={backfilling}>
                {backfilling ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
                Aplicar regras nos leads existentes
              </Button>
            </div>
          </div>
        )}

        <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
          <DialogContent className="bg-secondary/95">
            <DialogHeader><DialogTitle>Impacto das regras</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm leading-7">
              {preview?.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-background/50 rounded p-2">
                  <span className="truncate">{r.ruleLabel}</span>
                  <Badge variant="outline" className="text-primary">{r.count} leads</Badge>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border font-semibold">
                <span>Total {overwrite ? "(incluindo reatribuídos)" : "(sem projeto)"}</span>
                <Badge className="bg-primary text-primary-foreground">{preview?.reduce((s, r) => s + r.count, 0) || 0}</Badge>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>Fechar</Button>
              <Button onClick={() => { setPreview(null); backfill(); }}>Aplicar agora</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
