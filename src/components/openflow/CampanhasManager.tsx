import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Megaphone, FileText, Users, Zap, Sparkles, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface Campanha {
  id: string;
  user_id: string;
  project_id: string;
  nome: string;
  slug?: string | null;
  status: string;
  produto?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  utm_campaign?: string | null;
  created_at?: string;
}

interface Props {
  projects: { id: string; name: string }[];
  onChange?: () => void;
}

export function CampanhasManager({ projects, onChange }: Props) {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, { leads: number; automacoes: number; forms: number }>>({});
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editForms, setEditForms] = useState<any[]>([]);
  const [newForm, setNewForm] = useState<Partial<Campanha>>({ nome: "", project_id: "", status: "ativa" });
  const [filterProject, setFilterProject] = useState<string>("__all__");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [linkingLeads, setLinkingLeads] = useState(false);

  const loadSuggestions = async () => {
    setLoadingSug(true);
    const { data, error } = await supabase.rpc("get_unmatched_utm_campaigns" as any, { p_days: 30, p_project_id: null });
    if (error) console.error(error);
    setSuggestions(((data || []) as any[]).filter(s => !s.already_linked));
    setLoadingSug(false);
  };

  const applySuggestion = (s: any) => {
    const cleanName = s.utm_campaign.length > 40
      ? s.utm_campaign.replace(/\|.*$/, "").replace(/\[.*?\]\s*/g, "").trim().slice(0, 60) || s.utm_campaign.slice(0, 40)
      : s.utm_campaign;
    setNewForm({
      nome: cleanName,
      project_id: s.project_id || "",
      status: "ativa",
      utm_campaign: s.utm_campaign,
      produto: s.top_produto || "",
      data_inicio: s.first_seen,
    });
    toast.success("Pré-preenchido — revise e clique Criar");
  };

  const linkExistingLeads = async () => {
    if (!editing) return;
    if (!editing.utm_campaign) { toast.error("Defina o UTM campaign primeiro"); return; }
    setLinkingLeads(true);
    const { data, error } = await supabase.rpc("link_leads_by_utm" as any, { p_campanha_id: editing.id });
    setLinkingLeads(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data || 0} lead(s) vinculado(s) à campanha`);
    load();
  };

  const load = async () => {
    const [cRes, fRes] = await Promise.all([
      supabase.from("imphq_campanhas" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_capture_forms").select("id, nome, project_id, is_active"),
    ]);
    const list = ((cRes.data || []) as any) as Campanha[];
    setCampanhas(list);
    setForms(fRes.data || []);

    // Count leads, automacoes, forms per campanha
    if (list.length) {
      const ids = list.map(c => c.id);
      const [lRes, aRes, fvRes] = await Promise.all([
        supabase.from("imphq_leads").select("campanha_id", { count: "exact", head: false }).in("campanha_id", ids),
        supabase.from("imphq_automacoes").select("campanha_id").in("campanha_id", ids),
        supabase.from("imphq_campanha_forms" as any).select("campanha_id").in("campanha_id", ids),
      ]);
      const m: Record<string, { leads: number; automacoes: number; forms: number }> = {};
      ids.forEach(id => (m[id] = { leads: 0, automacoes: 0, forms: 0 }));
      (lRes.data || []).forEach((r: any) => r.campanha_id && m[r.campanha_id] && m[r.campanha_id].leads++);
      (aRes.data || []).forEach((r: any) => r.campanha_id && m[r.campanha_id] && m[r.campanha_id].automacoes++);
      ((fvRes.data || []) as any[]).forEach((r: any) => r.campanha_id && m[r.campanha_id] && m[r.campanha_id].forms++);
      setCounts(m);
    }
  };

  useEffect(() => { load(); }, []);

  const loadEditForms = async (campId: string) => {
    const { data } = await supabase.from("imphq_campanha_forms" as any).select("*").eq("campanha_id", campId).order("vigente_de", { ascending: false });
    setEditForms((data || []) as any[]);
  };

  useEffect(() => {
    if (editing) loadEditForms(editing.id);
    else setEditForms([]);
  }, [editing?.id]);

  const create = async () => {
    if (!newForm.nome?.trim() || !newForm.project_id) { toast.error("Nome e projeto obrigatórios"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login"); return; }
    const { error } = await supabase.from("imphq_campanhas" as any).insert({
      ...newForm,
      user_id: user.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Campanha criada");
    setShowNew(false);
    setNewForm({ nome: "", project_id: "", status: "ativa" });
    load(); onChange?.();
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase.from("imphq_campanhas" as any).update({
      nome: editing.nome, status: editing.status, produto: editing.produto || null,
      descricao: editing.descricao || null, data_inicio: editing.data_inicio || null,
      data_fim: editing.data_fim || null, utm_campaign: editing.utm_campaign || null,
    } as any).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo"); setEditing(null); load(); onChange?.();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm(`Excluir "${editing.nome}"? Automações e leads vinculados perdem a marcação (não são excluídos).`)) return;
    const { error } = await supabase.from("imphq_campanhas" as any).delete().eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removida"); setEditing(null); load(); onChange?.();
  };

  const linkForm = async (formId: string) => {
    if (!editing) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Encerra forms vigentes atuais
    await supabase.from("imphq_campanha_forms" as any)
      .update({ vigente_ate: new Date().toISOString() } as any)
      .eq("campanha_id", editing.id)
      .is("vigente_ate", null);
    const versao = editForms.length + 1;
    const { error } = await supabase.from("imphq_campanha_forms" as any).insert({
      campanha_id: editing.id, form_id: formId, user_id: user.id, versao,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Formulário vinculado (v${versao})`);
    loadEditForms(editing.id); load();
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id;
  const filtered = filterProject === "__all__" ? campanhas : campanhas.filter(c => c.project_id === filterProject);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Agrupe formulários e automações por iniciativa (webinar, lançamento, época do ano).</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os projetos</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova Campanha</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(c => {
          const ct = counts[c.id] || { leads: 0, automacoes: 0, forms: 0 };
          const statusColor = c.status === "ativa" ? "bg-emerald-500/10 text-emerald-500" : c.status === "pausada" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground";
          return (
            <Card key={c.id} className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all" onClick={() => setEditing({ ...c })}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm">{c.nome}</h3>
                  <Badge className={`text-[9px] border-0 ${statusColor}`}>{c.status}</Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[9px]">{projectName(c.project_id)}</Badge>
                  {c.produto && <Badge variant="outline" className="text-[9px]">🏷️ {c.produto}</Badge>}
                  {c.utm_campaign && <Badge variant="outline" className="text-[9px]">utm:{c.utm_campaign}</Badge>}
                </div>
                {c.descricao && <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{c.descricao}</p>}
                <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground border-t border-border/40">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {ct.forms} form</span>
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {ct.automacoes} fluxos</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ct.leads} leads</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhuma campanha. Crie uma para agrupar formulários e automações.</p>}
      </div>

      {/* New */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (o) loadSuggestions(); }}>
        <DialogContent className="bg-secondary/40 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>

          {/* Sugestões automáticas */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5 text-primary">
                <Sparkles className="h-3 w-3" /> Detectadas nos últimos 30 dias
              </Label>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={loadSuggestions} disabled={loadingSug}>
                <RefreshCw className={`h-3 w-3 ${loadingSug ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {loadingSug && <p className="text-[11px] text-muted-foreground">Buscando UTMs reais…</p>}
            {!loadingSug && suggestions.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">Nenhuma UTM nova detectada. Preencha manualmente abaixo.</p>
            )}
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="w-full text-left p-2 rounded bg-secondary/60 hover:bg-secondary/90 transition-colors text-[11px] flex items-center justify-between gap-2"
                >
                  <span className="truncate flex-1 font-mono">{s.utm_campaign}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {s.eventos > 0 && <>📊 {s.eventos}</>}
                    {s.vendas > 0 && <> · 💰 {s.vendas}</>}
                    {s.project_id && <> · {projectName(s.project_id).slice(0, 12)}</>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={newForm.nome || ""} onChange={e => setNewForm({ ...newForm, nome: e.target.value })} placeholder="Ex: Webinar Produto X - Maio" /></div>
            <div>
              <Label>Projeto</Label>
              <Select value={newForm.project_id || ""} onValueChange={v => setNewForm({ ...newForm, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Produto (opcional)</Label><Input value={newForm.produto || ""} onChange={e => setNewForm({ ...newForm, produto: e.target.value })} /></div>
              <div>
                <Label>UTM campaign</Label>
                <Input
                  value={newForm.utm_campaign || ""}
                  onChange={e => setNewForm({ ...newForm, utm_campaign: e.target.value })}
                  placeholder="webinar-maio-x"
                  list="utm-suggestions"
                />
                <datalist id="utm-suggestions">
                  {suggestions.map((s, i) => <option key={i} value={s.utm_campaign} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Início</Label><Input type="date" value={newForm.data_inicio?.slice(0, 10) || ""} onChange={e => setNewForm({ ...newForm, data_inicio: e.target.value || null })} /></div>
              <div><Label>Fim</Label><Input type="date" value={newForm.data_fim?.slice(0, 10) || ""} onChange={e => setNewForm({ ...newForm, data_fim: e.target.value || null })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={newForm.descricao || ""} onChange={e => setNewForm({ ...newForm, descricao: e.target.value })} className="leading-7 min-h-[60px]" /></div>
          </div>
          <DialogFooter><Button onClick={create}><Save className="h-3 w-3 mr-1" /> Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-secondary/40 max-w-2xl">
          <DialogHeader><DialogTitle>Editar Campanha</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Nome</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="encerrada">Encerrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Produto</Label><Input value={editing.produto || ""} onChange={e => setEditing({ ...editing, produto: e.target.value })} /></div>
                <div><Label>UTM campaign</Label><Input value={editing.utm_campaign || ""} onChange={e => setEditing({ ...editing, utm_campaign: e.target.value })} /></div>
              </div>
              {editing.utm_campaign && (
                <Button variant="outline" size="sm" onClick={linkExistingLeads} disabled={linkingLeads} className="w-full">
                  <Link2 className="h-3 w-3 mr-1" />
                  {linkingLeads ? "Vinculando…" : "Vincular leads existentes por este UTM"}
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="date" value={editing.data_inicio?.slice(0, 10) || ""} onChange={e => setEditing({ ...editing, data_inicio: e.target.value || null })} /></div>
                <div><Label>Fim</Label><Input type="date" value={editing.data_fim?.slice(0, 10) || ""} onChange={e => setEditing({ ...editing, data_fim: e.target.value || null })} /></div>
              </div>
              <div><Label>Descrição</Label><Textarea value={editing.descricao || ""} onChange={e => setEditing({ ...editing, descricao: e.target.value })} className="leading-7" /></div>

              {/* Formulários */}
              <div className="border-t border-border/40 pt-3 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Formulários vinculados</Label>
                <div className="space-y-1 max-h-[180px] overflow-y-auto">
                  {editForms.map(f => {
                    const form = forms.find(x => x.id === f.form_id);
                    const isVigente = !f.vigente_ate;
                    return (
                      <div key={f.id} className="flex items-center justify-between p-2 rounded bg-secondary/60 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px]">v{f.versao}</Badge>
                          <span>{form?.nome || f.form_id.slice(0, 8)}</span>
                          {isVigente && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-500 border-0">vigente</Badge>}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(f.vigente_de).toLocaleDateString("pt-BR")}
                          {f.vigente_ate && ` → ${new Date(f.vigente_ate).toLocaleDateString("pt-BR")}`}
                        </span>
                      </div>
                    );
                  })}
                  {editForms.length === 0 && <p className="text-[11px] text-muted-foreground italic">Nenhum formulário vinculado ainda.</p>}
                </div>
                <Select value="" onValueChange={linkForm}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Vincular novo formulário (encerra o atual)" /></SelectTrigger>
                  <SelectContent>
                    {forms.filter(f => f.project_id === editing.project_id).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}{!f.is_active && " (inativo)"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-7">
                  Ao vincular um novo formulário, o anterior é arquivado mas seus leads históricos continuam ligados à campanha.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
            <Button onClick={save}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
