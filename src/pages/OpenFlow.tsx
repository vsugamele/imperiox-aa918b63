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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, Mail, MessageCircle, Send, Save, Copy, BookOpen, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { FlowEditor, type Acao } from "@/components/openflow/FlowEditor";

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
  { value: "aguardar", label: "Aguardar", icon: Clock },
];

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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

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

  const generateWithAI = async () => {
    if (!editing) return;
    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: editing.project_id || null,
          trigger_tipo: editing.trigger_tipo,
          num_etapas: 5,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.acoes?.length) {
        setEditing({ ...editing, acoes: data.acoes });
        toast.success(`${data.acoes.length} ações geradas pela IA!`);
      } else {
        toast.error("IA não retornou ações");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar: " + (e?.message || "erro desconhecido"));
    } finally {
      setIsGeneratingAI(false);
    }
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
        <h1 className="font-display text-3xl font-bold text-primary">⚡ OpenFlow</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova Automação</Button>
      </div>

      <Tabs defaultValue="automacoes">
        <TabsList>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="guia"><BookOpen className="h-3 w-3 mr-1" /> Guia do Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="automacoes" className="space-y-6 mt-4">
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
        </TabsContent>

        {/* Webhook Guide Tab */}
        <TabsContent value="guia" className="space-y-6 mt-4">
          <WebhookGuide projects={projects} />
        </TabsContent>
      </Tabs>

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

      {/* Edit Dialog — Flow Editor */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Automação</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={editing.ativo} onCheckedChange={v => setEditing({ ...editing, ativo: v })} />
              </div>

              {/* Visual Flow Editor */}
              <FlowEditor
                triggerTipo={editing.trigger_tipo}
                acoes={editing.acoes}
                onChange={acoes => setEditing({ ...editing, acoes })}
                onGenerateAI={generateWithAI}
                isGenerating={isGeneratingAI}
              />
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

// ── Webhook Guide Component ──────────────────────────────────────
function WebhookGuide({ projects }: { projects: any[] }) {
  const baseUrl = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento";

  const platforms = [
    {
      name: "Hotmart",
      icon: "🟧",
      steps: [
        "Acesse Ferramentas → Webhooks no painel da Hotmart",
        "Clique em 'Configurar Webhook'",
        "Cole a URL do webhook (com ?project=ID se quiser vincular a um projeto)",
        "Selecione os eventos: PURCHASE_APPROVED, PURCHASE_REFUNDED, PURCHASE_CANCELED",
        "Salve e teste com o botão 'Enviar Teste'",
      ],
      fields: ["transaction", "product.name", "buyer.name", "buyer.email", "buyer.phone", "purchase.price.value"],
    },
    {
      name: "Kiwify",
      icon: "🟩",
      steps: [
        "Acesse Configurações → Webhooks no painel Kiwify",
        "Clique em 'Adicionar Webhook'",
        "Cole a URL do webhook",
        "Selecione eventos: order_paid, order_refunded",
        "Salve a configuração",
      ],
      fields: ["order_id", "Customer.full_name", "Customer.email", "Customer.mobile", "Product.product_name", "order_status"],
    },
    {
      name: "Ticto",
      icon: "🟦",
      steps: [
        "Acesse Integrações → Webhooks no painel Ticto",
        "Adicione a URL do webhook",
        "Configure os eventos desejados (venda aprovada, reembolso)",
        "Salve e teste",
      ],
      fields: ["transaction_id", "customer_name", "customer_email", "customer_phone", "product_name", "amount"],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Flow Diagram */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📐 Fluxo de Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 flex-wrap py-4">
            {[
              { label: "Plataforma", sub: "Hotmart / Kiwify / Ticto", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
              null,
              { label: "POST Webhook", sub: "Edge Function", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
              null,
              { label: "Processamento", sub: "Lead + Venda + CAPI", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
              null,
              { label: "Automações", sub: "Email / WA / Telegram", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
            ].map((item, i) => item === null ? (
              <ArrowRight key={i} className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <div key={i} className={`px-4 py-3 rounded-lg border text-center min-w-[140px] ${item.color}`}>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] opacity-80">{item.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* URL Generator */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔗 Gerar URL por Projeto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Cada projeto pode ter sua URL única. Isso permite que o sistema vincule a venda ao projeto correto automaticamente.</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-secondary px-3 py-2 rounded flex-1 font-mono truncate">{baseUrl}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(baseUrl); toast.success("Copiado!"); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0">{p.name}</Badge>
                <code className="text-[10px] bg-secondary px-2 py-1.5 rounded flex-1 font-mono truncate">
                  {baseUrl}?project={p.id}
                </code>
                <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                  navigator.clipboard.writeText(`${baseUrl}?project=${p.id}`);
                  toast.success(`URL de ${p.name} copiada!`);
                }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Platform Instructions */}
      {platforms.map(platform => (
        <Card key={platform.name} className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span>{platform.icon}</span> {platform.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Passo a passo:</p>
              <ol className="space-y-1.5">
                {platform.steps.map((step, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">{i + 1}</Badge>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Campos extraídos automaticamente:</p>
              <div className="flex flex-wrap gap-1">
                {platform.fields.map(f => (
                  <Badge key={f} variant="secondary" className="text-[9px] font-mono">{f}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* What Happens */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">⚙️ O que acontece quando o webhook chega?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { step: "1", text: "O payload é recebido e salvo na tabela imphq_webhooks para auditoria", icon: "📥" },
            { step: "2", text: "O sistema identifica a plataforma (Hotmart, Kiwify, etc.) pelo formato do payload", icon: "🔍" },
            { step: "3", text: "Se for uma compra aprovada: cria/atualiza lead + registra venda em imphq_vendas", icon: "💰" },
            { step: "4", text: "Se o projeto tiver Facebook CAPI configurado: envia evento Purchase para o Meta", icon: "📊" },
            { step: "5", text: "Automações vinculadas ao trigger são disparadas (email, WhatsApp, Telegram)", icon: "⚡" },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3 p-2 rounded bg-secondary/50 border border-border">
              <span className="text-lg shrink-0">{item.icon}</span>
              <div>
                <Badge variant="outline" className="text-[9px] mb-1">Etapa {item.step}</Badge>
                <p className="text-xs">{item.text}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
