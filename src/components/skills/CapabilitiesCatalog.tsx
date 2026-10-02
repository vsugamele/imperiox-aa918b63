// Catálogo de ferramentas de produção (imphq_capabilities) — ver, editar e ligar cada ferramenta às skills que a usam.
// O project-mcp lê o mesmo catálogo: uma etapa com skill X sugere primeiro as ferramentas ligadas a X.
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CAPABILITY_TASKS, type CapabilityPriority } from "@shared/capabilities";

type CapabilityRow = Tables<"imphq_capabilities">;
type SkillOption = { slug: string; nome: string };

const PRIORITIES: CapabilityPriority[] = ["alta", "media", "baixa"];
const PRIORITY_LABEL: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
const PRIORITY_STYLE: Record<string, string> = {
  alta: "bg-primary/15 text-primary border-primary/30",
  media: "bg-secondary text-foreground border-border",
  baixa: "bg-muted text-muted-foreground border-border",
};
const TASK_LABEL = Object.fromEntries(CAPABILITY_TASKS.map((t) => [t.key, t.label.split(" (")[0]]));

interface CapabilityForm {
  nome: string;
  url: string;
  categoria: string;
  descricao: string;
  quando_usar: string;
  serve_para: string[];
  prioridade: CapabilityPriority;
  licenca_nota: string;
  skills: string[];
  ativo: boolean;
}

const EMPTY_FORM: CapabilityForm = {
  nome: "", url: "", categoria: "", descricao: "", quando_usar: "", serve_para: [], prioridade: "media", licenca_nota: "", skills: [], ativo: true,
};

function toForm(c: CapabilityRow): CapabilityForm {
  return {
    nome: c.nome, url: c.url || "", categoria: c.categoria, descricao: c.descricao || "", quando_usar: c.quando_usar || "",
    serve_para: c.serve_para || [], prioridade: (PRIORITIES as string[]).includes(c.prioridade) ? c.prioridade as CapabilityPriority : "media",
    licenca_nota: c.licenca_nota || "", skills: c.skills || [], ativo: c.ativo,
  };
}

/** id estável a partir do nome: "Motion Canvas" → "motion-canvas". */
function capabilityIdFromName(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const toggle = (list: string[], value: string) => list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
const orNull = (v: string) => v.trim() || null;

export function CapabilitiesCatalog() {
  const [caps, setCaps] = useState<CapabilityRow[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tarefa, setTarefa] = useState("all");
  const [prioridade, setPrioridade] = useState("all");
  const [skillFiltro, setSkillFiltro] = useState("all");
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [editing, setEditing] = useState<CapabilityRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CapabilityForm>(EMPTY_FORM);
  const [skillBusca, setSkillBusca] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("imphq_capabilities").select("*").order("nome"),
      supabase.from("imphq_skills").select("slug, nome").not("slug", "is", null).order("nome"),
    ]).then(([capsRes, skillsRes]) => {
      if (capsRes.error) toast.error(`Catálogo: ${capsRes.error.message}`);
      else setCaps(capsRes.data || []);
      if (!skillsRes.error) setSkills((skillsRes.data || []).flatMap((s) => s.slug ? [{ slug: s.slug, nome: s.nome }] : []));
      setLoading(false);
    });
  }, []);

  const skillName = useMemo(() => new Map(skills.map((s) => [s.slug, s.nome])), [skills]);
  const linkedSkills = useMemo(() => [...new Set(caps.flatMap((c) => c.skills || []))].sort(), [caps]);

  const filtered = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return caps
      .filter((c) => mostrarInativas || c.ativo)
      .filter((c) => tarefa === "all" || (c.serve_para || []).includes(tarefa))
      .filter((c) => prioridade === "all" || c.prioridade === prioridade)
      .filter((c) => skillFiltro === "all" || (skillFiltro === "none" ? !(c.skills || []).length : (c.skills || []).includes(skillFiltro)))
      .filter((c) => !b || [c.nome, c.categoria, c.quando_usar, c.descricao].some((v) => (v || "").toLowerCase().includes(b)))
      .sort((a, b2) => (PRIORITY_RANK[a.prioridade] ?? 9) - (PRIORITY_RANK[b2.prioridade] ?? 9) || a.nome.localeCompare(b2.nome));
  }, [caps, busca, tarefa, prioridade, skillFiltro, mostrarInativas]);

  const skillChoices = useMemo(() => {
    const b = skillBusca.trim().toLowerCase();
    return skills.filter((s) => !b || s.nome.toLowerCase().includes(b) || s.slug.includes(b)).slice(0, 60);
  }, [skills, skillBusca]);

  const openEdit = (c: CapabilityRow) => { setEditing(c); setCreating(false); setForm(toForm(c)); setSkillBusca(""); };
  const openNew = () => { setEditing(null); setCreating(true); setForm(EMPTY_FORM); setSkillBusca(""); };
  const close = () => { setEditing(null); setCreating(false); };

  const save = async () => {
    if (!form.nome.trim() || !form.categoria.trim()) { toast.error("Nome e categoria são obrigatórios."); return; }
    const payload = {
      nome: form.nome.trim(), url: orNull(form.url), categoria: form.categoria.trim(), descricao: orNull(form.descricao),
      quando_usar: orNull(form.quando_usar), serve_para: form.serve_para, prioridade: form.prioridade,
      licenca_nota: orNull(form.licenca_nota), skills: form.skills, ativo: form.ativo, updated_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      if (editing) {
        const { data, error } = await supabase.from("imphq_capabilities").update(payload).eq("id", editing.id).select().single();
        if (error) throw error;
        setCaps((prev) => prev.map((c) => c.id === editing.id ? data : c));
        toast.success("Ferramenta atualizada.");
      } else {
        const id = capabilityIdFromName(form.nome);
        if (!id) throw new Error("Nome sem letras ou números.");
        if (caps.some((c) => c.id === id)) throw new Error(`Já existe uma ferramenta com o id "${id}".`);
        const { data, error } = await supabase.from("imphq_capabilities").insert({ id, ...payload, fonte: "Império" }).select().single();
        if (error) throw error;
        setCaps((prev) => [...prev, data]);
        toast.success("Ferramenta criada.");
      }
      close();
    } catch (e) {
      toast.error(`Não foi possível salvar: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const ativas = caps.filter((c) => c.ativo).length;
  const comSkill = caps.filter((c) => c.ativo && (c.skills || []).length).length;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
          Libs, bancos de assets e ferramentas de render que as IAs consultam antes de produzir criativo, página ou automação.
          Ao ligar uma ferramenta a uma skill, as etapas do mapa com essa skill passam a sugeri-la primeiro.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
            {ativas} ativas · {comSkill} com skill
          </span>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova ferramenta</Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center flex-wrap">
        <div className="relative lg:max-w-xs w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar ferramenta..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 bg-secondary/20" />
        </div>
        <Select value={tarefa} onValueChange={setTarefa}>
          <SelectTrigger className="lg:w-56 bg-secondary/20"><SelectValue placeholder="Tarefa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tarefas</SelectItem>
            {CAPABILITY_TASKS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger className="lg:w-36 bg-secondary/20"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridade</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={skillFiltro} onValueChange={setSkillFiltro}>
          <SelectTrigger className="lg:w-52 bg-secondary/20"><SelectValue placeholder="Skill" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer skill</SelectItem>
            <SelectItem value="none">Sem skill ligada</SelectItem>
            {linkedSkills.map((s) => <SelectItem key={s} value={s}>{skillName.get(s) || s}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Switch checked={mostrarInativas} onCheckedChange={setMostrarInativas} /> Mostrar inativas
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma ferramenta encontrada.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className={`h-full flex flex-col transition-colors hover:border-primary/50 ${c.ativo ? "" : "opacity-60"}`}>
              <CardContent className="p-4 flex flex-col flex-1 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[15px] text-foreground truncate">{c.nome}</span>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary shrink-0" aria-label={`Abrir site de ${c.nome}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{c.categoria}{c.ativo ? "" : " · inativa"}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[11px] ${PRIORITY_STYLE[c.prioridade] || ""}`}>{PRIORITY_LABEL[c.prioridade] || c.prioridade}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)} aria-label={`Editar ${c.nome}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {c.quando_usar && <p className="text-sm text-foreground/90 leading-relaxed">{c.quando_usar}</p>}

                {(c.serve_para || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.serve_para.map((t) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{TASK_LABEL[t] || t}</span>
                    ))}
                  </div>
                )}

                <div className="mt-auto space-y-2">
                  {(c.skills || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] text-muted-foreground mr-0.5">Skills:</span>
                      {c.skills.map((s) => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/5">{skillName.get(s) || s}</span>
                      ))}
                    </div>
                  )}
                  {c.licenca_nota && <p className="text-[11px] text-amber-400 leading-snug">Licença: {c.licenca_nota}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing || creating} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${editing.nome}` : "Nova ferramenta"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                {creating && form.nome && <p className="text-[11px] text-muted-foreground font-mono">id: {capabilityIdFromName(form.nome)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex.: Motion, Ícones, Gráficos" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Site</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" />
            </div>

            <div className="space-y-1.5">
              <Label>Quando usar</Label>
              <Textarea rows={2} value={form.quando_usar} onChange={(e) => setForm({ ...form, quando_usar: e.target.value })} placeholder="Em que operação a IA deve escolher esta ferramenta" />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Serve para</Label>
              <div className="flex flex-wrap gap-1.5">
                {CAPABILITY_TASKS.map((t) => {
                  const on = form.serve_para.includes(t.key);
                  return (
                    <button key={t.key} type="button" onClick={() => setForm({ ...form, serve_para: toggle(form.serve_para, t.key) })}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as CapabilityPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <label className="flex items-center gap-2 h-10 text-sm cursor-pointer">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  {form.ativo ? "Ativa (as IAs veem)" : "Inativa (fora das sugestões)"}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nota de licença</Label>
              <Input value={form.licenca_nota} onChange={(e) => setForm({ ...form, licenca_nota: e.target.value })} placeholder="Ex.: conferir licença antes de usar em anúncio" />
            </div>

            <div className="space-y-2">
              <Label>Skills que usam esta ferramenta</Label>
              {form.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.skills.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary">
                      {skillName.get(s) || s}
                      <button type="button" onClick={() => setForm({ ...form, skills: form.skills.filter((v) => v !== s) })} aria-label={`Tirar ${s}`}
                        className="rounded-full p-0.5 hover:bg-primary/20">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input value={skillBusca} onChange={(e) => setSkillBusca(e.target.value)} placeholder={`Buscar entre ${skills.length} skills...`} />
              <ScrollArea className="h-40 rounded-md border border-border">
                <div className="p-1">
                  {skillChoices.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhuma skill encontrada.</p>}
                  {skillChoices.map((s) => {
                    const on = form.skills.includes(s.slug);
                    return (
                      <button key={s.slug} type="button" onClick={() => setForm({ ...form, skills: toggle(form.skills, s.slug) })}
                        className={`w-full flex items-center justify-between gap-2 text-left text-sm px-2 py-1.5 rounded ${on ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}>
                        <span className="truncate">{s.nome}</span>
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">{s.slug}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
