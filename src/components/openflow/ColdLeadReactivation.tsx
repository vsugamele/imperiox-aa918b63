import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Zap, Clock, Users, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ReactivationRule {
  id: string;
  project_id: string | null;
  nome: string;
  dias_sem_resposta: number;
  tag_filtro: string | null;
  status_filtro: string | null;
  score_max: number | null;
  automacao_id: string;
  ativo: boolean;
  created_at: string;
  last_run_at: string | null;
  leads_reactivated: number;
}

interface Props {
  projects: { id: string; name: string }[];
  automacoes: { id: string; nome: string; trigger_tipo: string }[];
}

const STATUS_OPTIONS = [
  { value: "__any__", label: "Qualquer status" },
  { value: "frio", label: "Frio" },
  { value: "morno", label: "Morno" },
  { value: "quente", label: "Quente" },
  { value: "lead", label: "Lead" },
];

export function ColdLeadReactivation({ projects, automacoes }: Props) {
  const [rules, setRules] = useState<ReactivationRule[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    project_id: "__all__",
    dias_sem_resposta: 3,
    tag_filtro: "__any__",
    status_filtro: "__any__",
    score_max: 70,
    automacao_id: "",
    ativo: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("imphq_cold_reactivation_rules" as any)
        .select("*")
        .order("created_at", { ascending: false });
      setRules(((data as unknown) as ReactivationRule[]) || []);
    } catch {
      // table may not exist yet — handled gracefully
    }

    try {
      const { data: tagData } = await supabase.rpc("get_lead_tag_counts", { p_project_id: null, p_limit: 100 });
      setAllTags((tagData || []).map((t: any) => t.tag).filter(Boolean));
    } catch {
      // rpc may not exist
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.nome.trim()) { toast.error("Dê um nome para a regra"); return; }
    if (!form.automacao_id) { toast.error("Selecione um fluxo de reativação"); return; }

    const payload = {
      nome: form.nome.trim(),
      project_id: form.project_id === "__all__" ? null : form.project_id,
      dias_sem_resposta: form.dias_sem_resposta,
      tag_filtro: form.tag_filtro === "__any__" ? null : form.tag_filtro,
      status_filtro: form.status_filtro === "__any__" ? null : form.status_filtro,
      score_max: form.score_max,
      automacao_id: form.automacao_id,
      ativo: form.ativo,
    };

    const { error } = await supabase.from("imphq_cold_reactivation_rules" as any).insert(payload);
    if (error) {
      toast.error("Erro ao salvar regra: " + error.message);
      return;
    }
    toast.success("Regra salva!");
    setShowForm(false);
    setForm({ nome: "", project_id: "__all__", dias_sem_resposta: 3, tag_filtro: "__any__", status_filtro: "__any__", score_max: 70, automacao_id: "", ativo: true });
    load();
  };

  const toggleActive = async (rule: ReactivationRule) => {
    await supabase.from("imphq_cold_reactivation_rules" as any).update({ ativo: !rule.ativo }).eq("id", rule.id);
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, ativo: !r.ativo } : r));
  };

  const deleteRule = async (id: string) => {
    await supabase.from("imphq_cold_reactivation_rules" as any).delete().eq("id", id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success("Regra removida");
  };

  const runNow = async (rule: ReactivationRule) => {
    setRunningId(rule.id);
    try {
      const cutoff = new Date(Date.now() - rule.dias_sem_resposta * 24 * 3600 * 1000).toISOString();

      let q = supabase
        .from("imphq_leads")
        .select("id, nome, phone, email, tags, status, score, project_id, updated_at")
        .lt("updated_at", cutoff)
        .not("status", "eq", "cliente");

      if (rule.project_id) q = (q as any).eq("project_id", rule.project_id);
      if (rule.status_filtro) q = (q as any).eq("status", rule.status_filtro);
      if (rule.score_max) q = (q as any).lte("score", rule.score_max);

      const { data: leads } = await q.limit(200);
      const eligible = (leads || []).filter((l: any) => {
        if (!rule.tag_filtro) return true;
        return Array.isArray(l.tags) && l.tags.includes(rule.tag_filtro);
      });

      if (eligible.length === 0) {
        toast.info("Nenhum lead elegível encontrado para esta regra");
        setRunningId(null);
        return;
      }

      const { data: auto } = await supabase
        .from("imphq_automacoes")
        .select("*")
        .eq("id", rule.automacao_id)
        .maybeSingle();

      if (!auto) { toast.error("Fluxo não encontrado"); setRunningId(null); return; }

      let dispatched = 0;
      for (const lead of eligible.slice(0, 50)) {
        try {
          await supabase.functions.invoke("openflow-executor", {
            body: {
              trigger_tipo: auto.trigger_tipo,
              project_id: lead.project_id || rule.project_id,
              automacao_id: rule.automacao_id,
              lead_data: {
                lead_id: lead.id,
                nome: lead.nome,
                phone: lead.phone,
                email: lead.email,
                tags: lead.tags,
              },
            },
          });
          dispatched++;
        } catch { /* continue */ }
      }

      await supabase.from("imphq_cold_reactivation_rules" as any).update({
        last_run_at: new Date().toISOString(),
        leads_reactivated: (rule.leads_reactivated || 0) + dispatched,
      }).eq("id", rule.id);

      toast.success(`${dispatched} leads enviados para reativação`);
      load();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setRunningId(null);
  };

  const autoOptions = automacoes.filter(a =>
    ["lead_novo", "tag_adicionada", "carrinho_abandonado"].includes(a.trigger_tipo)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Reativação de Leads Frios</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dispara um fluxo automaticamente para leads que não respondem há X dias
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Regra
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="bg-card border-border border-dashed">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm">Nova Regra de Reativação</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome da regra</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="Ex: Leads frios 3 dias"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs">Projeto</Label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os projetos</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Dias sem resposta</Label>
                <Input
                  type="number" min={1} max={90}
                  className="mt-1 h-8 text-sm"
                  value={form.dias_sem_resposta}
                  onChange={e => setForm(f => ({ ...f, dias_sem_resposta: Number(e.target.value) }))}
                />
              </div>

              <div>
                <Label className="text-xs">Filtro de tag (opcional)</Label>
                <Select value={form.tag_filtro} onValueChange={v => setForm(f => ({ ...f, tag_filtro: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Qualquer tag</SelectItem>
                    {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Status do lead</Label>
                <Select value={form.status_filtro} onValueChange={v => setForm(f => ({ ...f, status_filtro: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Score máximo</Label>
                <Input
                  type="number" min={0} max={100}
                  className="mt-1 h-8 text-sm"
                  value={form.score_max ?? ""}
                  onChange={e => setForm(f => ({ ...f, score_max: Number(e.target.value) || null }))}
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Fluxo a disparar</Label>
                <Select value={form.automacao_id} onValueChange={v => setForm(f => ({ ...f, automacao_id: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Selecione um fluxo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {automacoes.map(a => (
                      <SelectItem key={a.id} value={a.id}>⚡ {a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {autoOptions.length === 0 && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Crie um fluxo com trigger "Novo Lead" ou "Tag Adicionada" para usar aqui.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save}>Salvar Regra</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-8">Carregando regras...</div>
      ) : rules.length === 0 && !showForm ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma regra de reativação configurada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Crie uma regra para disparar mensagens automáticas para leads frios
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const auto = automacoes.find(a => a.id === rule.automacao_id);
            const proj = projects.find(p => p.id === rule.project_id);
            return (
              <Card key={rule.id} className={`bg-card border-border border-l-4 ${rule.ativo ? "border-l-primary" : "border-l-muted"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{rule.nome}</span>
                        {!rule.ativo && <Badge variant="outline" className="text-[10px] text-muted-foreground">pausado</Badge>}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Clock className="h-3 w-3" /> {rule.dias_sem_resposta}d sem resposta
                        </Badge>
                        {rule.tag_filtro && (
                          <Badge variant="secondary" className="text-[10px]">🏷️ {rule.tag_filtro}</Badge>
                        )}
                        {rule.status_filtro && (
                          <Badge variant="secondary" className="text-[10px]">status: {rule.status_filtro}</Badge>
                        )}
                        {rule.score_max && (
                          <Badge variant="secondary" className="text-[10px]">score ≤ {rule.score_max}</Badge>
                        )}
                        {proj && (
                          <Badge variant="outline" className="text-[10px]">{proj.name}</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Zap className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                          {auto ? auto.nome : <span className="text-red-400">Fluxo não encontrado</span>}
                        </span>
                      </div>

                      {(rule.last_run_at || rule.leads_reactivated > 0) && (
                        <div className="flex items-center gap-3 mt-2">
                          {rule.leads_reactivated > 0 && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <Users className="h-3 w-3" /> {rule.leads_reactivated} reativados
                            </span>
                          )}
                          {rule.last_run_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Último: {new Date(rule.last_run_at).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.ativo}
                        onCheckedChange={() => toggleActive(rule)}
                        className="scale-90"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        title="Executar agora"
                        disabled={runningId === rule.id}
                        onClick={() => runNow(rule)}
                      >
                        <Play className={`h-3.5 w-3.5 ${runningId === rule.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Como funciona:</strong> Clique em ▶ para disparar manualmente para todos os leads elegíveis.
            Em breve: execução automática via cron diário.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
