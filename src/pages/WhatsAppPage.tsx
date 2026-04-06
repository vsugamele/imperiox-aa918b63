import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, MessageSquare, ExternalLink, Copy, Phone, Settings2, Send, Megaphone, FileText, Edit, X as XIcon, Radio } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ChatView from "@/components/whatsapp/ChatView";
import QrCodePanel from "@/components/whatsapp/QrCodePanel";
import ProviderConfigDialog from "@/components/whatsapp/ProviderConfigDialog";
import BulkSendDialog from "@/components/whatsapp/BulkSendDialog";
import WaHubQrPanel from "@/components/whatsapp/WaHubQrPanel";

interface WaTemplate {
  id: string; name: string; content: string; category: string; project_id: string | null;
}

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: any; created_at: string;
  provider_id: string | null;
}

export default function WhatsApp() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [form, setForm] = useState({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" });
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WaTemplate | null>(null);
  const [tplForm, setTplForm] = useState({ name: "", content: "", category: "geral", project_id: "" });
  const [activeTab, setActiveTab] = useState<"sessoes" | "templates" | "hub">("sessoes");

  const load = async () => {
    const [sRes, pRes, provRes, tRes] = await Promise.all([
      supabase.from("imphq_wa_conversations").select("*").order("updated_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
      supabase.from("imphq_wa_providers").select("*").eq("is_active", true).order("created_at"),
      supabase.from("imphq_wa_templates").select("*").order("created_at", { ascending: false }),
    ]);
    setSessions(sRes.data as any[] || []);
    setProjects(pRes.data || []);
    setProviders(provRes.data as any[] || []);
    setTemplates((tRes.data as any[]) || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = sessions.filter(s => filterProject === "all" || s.project_id === filterProject);
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  const getProviderForProject = (projectId: string) => {
    return providers.find(p => p.project_id === projectId) || null;
  };

  const createSession = async () => {
    if (!form.phone || !form.project_id) { toast.error("Telefone e projeto obrigatórios"); return; }
    const provider = getProviderForProject(form.project_id);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_wa_conversations").insert({
      id, phone: form.phone.replace(/\D/g, ""),
      contact_name: form.contact_name || null,
      session: form.session || `session-${Date.now()}`,
      project_id: form.project_id, status: "active",
      provider_id: provider?.id || null,
      metadata: { default_message: form.default_message } as any,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Sessão criada!"); setShowNew(false);
    setForm({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" }); load();
  };

  const deleteSession = async (id: string) => {
    await supabase.from("imphq_wa_conversations").delete().eq("id", id);
    toast.success("Sessão removida"); setSelectedSession(null); load();
  };

  const getWaLink = (phone: string, message?: string) => {
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/${clean}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  };

  // ── Detail View ──
  if (selectedSession) {
    const provider = getProviderForProject(selectedSession.project_id);
    const waLink = getWaLink(selectedSession.phone, (selectedSession.metadata as any)?.default_message);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>← Voltar</Button>
          <h1 className="font-display text-2xl font-bold text-primary">
            {selectedSession.contact_name || selectedSession.phone}
          </h1>
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            {selectedSession.status}
          </Badge>
          {provider && (
            <Badge variant="outline" className="text-[10px]">
              {provider.provider === "evolution" ? "🟢 Evolution" : "🔵 Twilio"}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="chat" className="w-full">
          <TabsList>
            <TabsTrigger value="chat"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat</TabsTrigger>
            {provider?.provider === "evolution" && (
              <TabsTrigger value="qrcode">📱 QR Code</TabsTrigger>
            )}
            <TabsTrigger value="info"><Phone className="h-3.5 w-3.5 mr-1" /> Info</TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <Card className="bg-card border-border">
              <ChatView
                conversationId={selectedSession.id}
                phone={selectedSession.phone}
                projectId={selectedSession.project_id}
                providerId={provider?.id || null}
              />
            </Card>
          </TabsContent>

          {provider?.provider === "evolution" && (
            <TabsContent value="qrcode">
              <QrCodePanel provider={provider} />
            </TabsContent>
          )}

          <TabsContent value="info">
            <Card className="bg-card border-border">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Telefone</span><span className="font-mono">{selectedSession.phone}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Projeto</span><span>{projectName(selectedSession.project_id)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sessão</span><span className="font-mono text-xs">{selectedSession.session}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mensagens</span><span className="font-mono">{selectedSession.message_count}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Provider</span><span>{provider ? `${provider.provider} (${provider.instance_name || provider.twilio_from})` : "Nenhum"}</span></div>
                  {(selectedSession.metadata as any)?.default_message && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Mensagem padrão:</p>
                      <p className="text-xs bg-secondary p-2 rounded">{(selectedSession.metadata as any).default_message}</p>
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">Link direto:</p>
                  <div className="p-2 bg-secondary rounded text-xs text-primary break-all font-mono">{waLink}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(waLink); toast.success("Link copiado!"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar Link
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={waLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Abrir WA</a>
                  </Button>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteSession(selectedSession.id)} className="w-full">
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir Sessão
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const saveTemplate = async () => {
    if (!tplForm.name.trim() || !tplForm.content.trim()) { toast.error("Nome e conteúdo obrigatórios"); return; }
    if (editingTemplate) {
      const { error } = await supabase.from("imphq_wa_templates").update({
        name: tplForm.name, content: tplForm.content, category: tplForm.category,
        project_id: tplForm.project_id || null,
      }).eq("id", editingTemplate.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Template atualizado!");
    } else {
      const { error } = await supabase.from("imphq_wa_templates").insert({
        name: tplForm.name, content: tplForm.content,
        category: tplForm.category, project_id: tplForm.project_id || null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Template criado!");
    }
    setShowTemplateForm(false); setEditingTemplate(null);
    setTplForm({ name: "", content: "", category: "geral", project_id: "" });
    load();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("imphq_wa_templates").delete().eq("id", id);
    toast.success("Template removido"); load();
  };

  // ── List View ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">💬 WhatsApp</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowProviderConfig(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Provider
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}>
            <Megaphone className="h-4 w-4 mr-1" /> Disparo
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Sessão
          </Button>
        </div>
      </div>

      {/* Provider status */}
      {providers.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {providers.map(p => (
            <Badge key={p.id} variant="outline" className="text-xs gap-1">
              {p.provider === "evolution" ? "🟢" : "🔵"} {p.instance_name || p.twilio_from} — {projectName(p.project_id)}
            </Badge>
          ))}
        </div>
      )}
      {providers.length === 0 && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Nenhum provider configurado. Configure um provider (Evolution API ou Twilio) para enviar mensagens.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowProviderConfig(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Configurar Provider
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tab switcher */}
      <div className="flex items-center gap-2 border-b border-border">
        <button onClick={() => setActiveTab("sessoes")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "sessoes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />Sessões
        </button>
        <button onClick={() => setActiveTab("templates")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "templates" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <FileText className="h-3.5 w-3.5 inline mr-1.5" />Templates ({templates.length})
        </button>
        <button onClick={() => setActiveTab("hub")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "hub" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Radio className="h-3.5 w-3.5 inline mr-1.5" />Hub Local
        </button>
      </div>

      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingTemplate(null); setTplForm({ name: "", content: "", category: "geral", project_id: "" }); setShowTemplateForm(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Template
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <Card key={t.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">{t.name}</h3>
                    <Badge variant="outline" className="text-[9px]">{t.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.content}</p>
                  {t.project_id && <p className="text-[10px] text-muted-foreground">{projectName(t.project_id)}</p>}
                  <div className="flex gap-1 pt-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => {
                      setEditingTemplate(t);
                      setTplForm({ name: t.name, content: t.content, category: t.category, project_id: t.project_id || "" });
                      setShowTemplateForm(true);
                    }}><Edit className="h-3 w-3 mr-1" /> Editar</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => deleteTemplate(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum template criado</p>}
          </div>

          {/* Template Form Dialog */}
          <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={tplForm.name} onChange={e => setTplForm({ ...tplForm, name: e.target.value })} placeholder="Ex: Boas-vindas" /></div>
                <div>
                  <Label>Conteúdo</Label>
                  <Textarea value={tplForm.content} onChange={e => setTplForm({ ...tplForm, content: e.target.value })} rows={4} placeholder="Olá {{nome}}, tudo bem?" />
                  <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {"{{nome}}"}, {"{{telefone}}"}, {"{{produto}}"}</p>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={tplForm.category} onValueChange={v => setTplForm({ ...tplForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="boas-vindas">Boas-vindas</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="vendas">Vendas</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Projeto (opcional)</Label>
                  <Select value={tplForm.project_id || "none"} onValueChange={v => setTplForm({ ...tplForm, project_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={saveTemplate}>{editingTemplate ? "Salvar" : "Criar"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeTab === "hub" && (
        <HubConversations projects={projects} providers={providers} />
      )}

      {activeTab === "sessoes" && (<>
      <div className="flex items-center gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} sessões</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(s => {
          const provider = getProviderForProject(s.project_id);
          return (
            <Card key={s.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors group" onClick={() => setSelectedSession(s)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{s.contact_name || s.phone}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{s.phone}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{projectName(s.project_id)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{s.status}</Badge>
                      {provider && (
                        <Badge variant="outline" className="text-[9px]">
                          {provider.provider === "evolution" ? "🟢" : "🔵"}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-2.5 w-2.5" /> {s.message_count}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão WhatsApp</p>}
      </div>

      {/* New Session Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Sessão WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Telefone (com DDI)</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" /></div>
            <div><Label>Nome do contato</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Opcional" /></div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Mensagem padrão</Label><Textarea value={form.default_message} onChange={e => setForm({ ...form, default_message: e.target.value })} placeholder="Olá! Vi seu anúncio..." rows={3} /></div>
            <div><Label>Nome da sessão</Label><Input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} placeholder="Auto se vazio" /></div>
          </div>
          <DialogFooter><Button onClick={createSession}>Criar Sessão</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Config Dialog */}
      <ProviderConfigDialog open={showProviderConfig} onOpenChange={setShowProviderConfig} projects={projects} onCreated={load} />

      {/* Bulk Send Dialog */}
      <BulkSendDialog open={showBulk} onOpenChange={setShowBulk} providers={providers} templates={templates} />
      </>)}
    </div>
  );
}

function HubConversations({ projects, providers }: { projects: any[]; providers: any[] }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [hubSessions, setHubSessions] = useState<any[]>([]);
  const [hubFilterProject, setHubFilterProject] = useState("all");
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  useEffect(() => {
    Promise.all([
      supabase.from("imphq_wa_messages").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("wa_hub_iso_sessions").select("id, session_key, tenant_id, status"),
    ]).then(([msgRes, hubRes]) => {
      setMessages(msgRes.data || []);
      setHubSessions(hubRes.data || []);
    });
  }, []);

  const connectedCount = hubSessions.filter(s => s.status === "connected").length;

  const grouped = useMemo(() => {
    const map = new Map<string, { phone: string; lastMsg: string; lastAt: string; count: number; projectId: string }>();
    messages.forEach(m => {
      const key = m.phone;
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { phone: key, lastMsg: m.content?.slice(0, 60) || "", lastAt: m.created_at, count: 1, projectId: m.project_id || "" });
      } else {
        existing.count++;
        if (m.created_at > existing.lastAt) { existing.lastAt = m.created_at; existing.lastMsg = m.content?.slice(0, 60) || ""; }
      }
    });
    let result = Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    if (hubFilterProject !== "all") result = result.filter(g => g.projectId === hubFilterProject);
    return result;
  }, [messages, hubFilterProject]);

  if (selectedPhone) {
    const phoneMessages = messages.filter(m => m.phone === selectedPhone).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const provider = providers[0] || null;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedPhone(null)}>← Voltar</Button>
        <h2 className="text-lg font-semibold text-primary">Chat: {selectedPhone}</h2>
        <Card className="bg-card border-border">
          <ChatView conversationId={selectedPhone} phone={selectedPhone} projectId={grouped.find(g => g.phone === selectedPhone)?.projectId || ""} providerId={provider?.id || null} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hub Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className={`text-xs gap-1 ${connectedCount > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
          {connectedCount > 0 ? "🟢" : "🔴"} Hub: {connectedCount} sessão(ões) conectada(s)
        </Badge>
        {hubSessions.filter(s => s.status !== "connected").map(s => (
          <Badge key={s.id} variant="outline" className="text-[10px] bg-muted text-muted-foreground">
            🔴 {s.session_key} — offline
          </Badge>
        ))}
      </div>

      <div className="max-w-lg mx-auto mb-6">
        <WaHubQrPanel />
      </div>

      {/* Project filter */}
      <div className="flex items-center gap-3">
        <Select value={hubFilterProject} onValueChange={setHubFilterProject}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {grouped.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary mb-3">📱 Conversas Recentes ({grouped.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped.map(g => (
              <Card key={g.phone} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors" onClick={() => setSelectedPhone(g.phone)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.phone}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{g.lastMsg}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[9px]">{g.count} msgs</Badge>
                        {g.projectId && <span className="text-[9px] text-muted-foreground">{projectName(g.projectId)}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {grouped.length === 0 && <p className="text-sm text-muted-foreground text-center">Nenhuma conversa do Hub ainda. Conecte e envie mensagens para ver aqui.</p>}
    </div>
  );
}
