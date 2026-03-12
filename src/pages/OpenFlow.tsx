import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, Mail, MessageCircle, Send, Save, Copy } from "lucide-react";
import { toast } from "sonner";

const TRIGGERS = [
  { value: "carrinho_abandonado", label: "Carrinho Abandonado", icon: "🛒", color: "border-l-amber-500" },
  { value: "compra_aprovada", label: "Compra Aprovada", icon: "✅", color: "border-l-emerald-500" },
  { value: "lead_novo", label: "Novo Lead", icon: "👤", color: "border-l-blue-500" },
  { value: "reembolso", label: "Reembolso", icon: "↩️", color: "border-l-red-500" },
];

const ACAO_TIPOS = [
  { value: "email", label: "Email (Resend)", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "telegram", label: "Telegram", icon: Send },
];

interface Acao { tipo: string; template: string; delay_min: number; }
interface Automacao {
  id: string; project_id?: string; nome: string;
  trigger_tipo: string; acoes: Acao[]; ativo: boolean;
  created_at?: string;
}

export default function OpenFlow() {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Automacao | null>(null);
  const [form, setForm] = useState({ nome: "", trigger_tipo: "carrinho_abandonado", project_id: "" });
  const [webhookProject, setWebhookProject] = useState("none");

  const load = async () => {
    const [aRes, wRes, pRes] = await Promise.all([
      supabase.from("imphq_automacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_webhooks").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setAutomacoes((aRes.data || []).map((a: any) => ({ ...a, acoes: a.acoes || [] })));
    setWebhooks(wRes.data || []);
    setProjects(pRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const createAutomacao = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_automacoes").insert({
      id, nome: form.nome, trigger_tipo: form.trigger_tipo,
      project_id: form.project_id || null, acoes: [] as any, ativo: true,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Automação criada!"); setShowNew(false);
    setForm({ nome: "", trigger_tipo: "carrinho_abandonado", project_id: "" }); load();
  };

  const saveAutomacao = async () => {
    if (!editing) return;
    const { error } = await supabase.from("imphq_automacoes").update({
      nome: editing.nome, trigger_tipo: editing.trigger_tipo,
      acoes: editing.acoes as any, ativo: editing.ativo, project_id: editing.project_id,
    }).eq("id", editing.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo!"); setEditing(null); load();
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("imphq_automacoes").update({ ativo }).eq("id", id);
    load();
  };

  const deleteAutomacao = async (id: string) => {
    await supabase.from("imphq_automacoes").delete().eq("id", id);
    toast.success("Removida"); setEditing(null); load();
  };

  const addAcao = () => {
    if (!editing) return;
    setEditing({ ...editing, acoes: [...editing.acoes, { tipo: "email", template: "", delay_min: 0 }] });
  };
  const removeAcao = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, acoes: editing.acoes.filter((_, i) => i !== idx) });
  };
  const updateAcao = (idx: number, field: string, value: any) => {
    if (!editing) return;
    const acoes = [...editing.acoes];
    acoes[idx] = { ...acoes[idx], [field]: value };
    setEditing({ ...editing, acoes });
  };

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";
  const triggerLabel = (t: string) => TRIGGERS.find(tr => tr.value === t)?.label || t;
  const triggerIcon = (t: string) => TRIGGERS.find(tr => tr.value === t)?.icon || "⚡";
  const triggerColor = (t: string) => TRIGGERS.find(tr => tr.value === t)?.color || "border-l-primary";

  const baseWebhookUrl = `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento`;
  const webhookUrl = webhookProject !== "none"
    ? `${baseWebhookUrl}?project=${webhookProject}`
    : baseWebhookUrl;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">⚡ Automações</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova Automação</Button>
      </div>

      {/* Webhook URL info */}
      <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground mb-1">🔗 URL do Webhook (cole nas plataformas de pagamento):</p>
          <div className="flex items-center gap-2">
            <Select value={webhookProject} onValueChange={setWebhookProject}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">URL genérica</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-secondary px-3 py-1.5 rounded flex-1 truncate font-mono">{webhookUrl}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado!"); }}>
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Compatível com: Hotmart, Kiwify, Ticto, Eduzz e outros</p>
        </CardContent>
      </Card>

      {/* Automações list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {automacoes.map((a, i) => (
          <Card
            key={a.id}
            className={`bg-card border-border border-l-4 ${triggerColor(a.trigger_tipo)} hover:border-primary/20 cursor-pointer transition-all hover:scale-[1.01] animate-fade-in`}
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            onClick={() => setEditing({ ...a })}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{triggerIcon(a.trigger_tipo)}</span>
                  <h3 className="font-medium text-sm">{a.nome}</h3>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Switch checked={a.ativo} onCheckedChange={v => toggleAtivo(a.id, v)} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{triggerLabel(a.trigger_tipo)}</Badge>
                <Badge variant={a.ativo ? "default" : "secondary"} className="text-[10px]">{a.ativo ? "Ativo" : "Inativo"}</Badge>
                {a.project_id && <Badge className="text-[9px] bg-primary/20 text-primary">{projectName(a.project_id)}</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {a.acoes.map((ac, i) => {
                  const AcIcon = ACAO_TIPOS.find(t => t.value === ac.tipo)?.icon || Zap;
                  return (
                    <div key={i} className="flex items-center gap-1">
                      <div className="p-1 bg-secondary rounded"><AcIcon className="h-3 w-3 text-primary" /></div>
                      {ac.delay_min > 0 && <span className="text-[9px] text-muted-foreground">{ac.delay_min}min</span>}
                      {i < a.acoes.length - 1 && <span className="text-muted-foreground/50">→</span>}
                    </div>
                  );
                })}
                {a.acoes.length === 0 && <span className="text-[10px] text-muted-foreground">Sem ações configuradas</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {automacoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma automação criada</p>}
      </div>

      {/* Recent Webhooks */}
      {webhooks.length > 0 && (
        <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📡 Webhooks Recentes</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
            {webhooks.slice(0, 20).map(w => (
              <div key={w.id} className="flex items-center justify-between p-2 rounded bg-secondary/50 border border-border text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{w.plataforma}</Badge>
                  <span className="text-muted-foreground">{w.evento}</span>
                </div>
                <div className="flex items-center gap-2">
                  {w.processado && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400">Processado</Badge>}
                  <span className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* New Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Automação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Recuperação de Carrinho" /></div>
            <div>
              <Label>Trigger</Label>
              <Select value={form.trigger_tipo} onValueChange={v => setForm({ ...form, trigger_tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos os projetos</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={createAutomacao}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Automação</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div>
                <Label>Trigger</Label>
                <Select value={editing.trigger_tipo} onValueChange={v => setEditing({ ...editing, trigger_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={editing.ativo} onCheckedChange={v => setEditing({ ...editing, ativo: v })} />
              </div>

              {/* Ações */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Ações</Label>
                  <Button size="sm" variant="outline" onClick={addAcao}><Plus className="h-3 w-3 mr-1" /> Ação</Button>
                </div>
                {editing.acoes.map((ac, i) => (
                  <div key={i} className="p-3 rounded-md bg-secondary/50 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">Ação {i + 1}</Badge>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeAcao(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Canal</Label>
                        <Select value={ac.tipo} onValueChange={v => updateAcao(i, "tipo", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACAO_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Delay (min)</Label>
                        <Input type="number" value={ac.delay_min} onChange={e => updateAcao(i, "delay_min", parseInt(e.target.value) || 0)} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Template / Mensagem</Label>
                      <Textarea value={ac.template} onChange={e => updateAcao(i, "template", e.target.value)} className="text-xs min-h-[60px]" placeholder="Olá {{nome}}, notamos que você..." />
                    </div>
                  </div>
                ))}
                {editing.acoes.length === 0 && <p className="text-xs text-muted-foreground">Adicione ações para esta automação</p>}
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => editing && deleteAutomacao(editing.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
            <Button onClick={saveAutomacao}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
