import { useEffect, useState, useMemo, useCallback } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Plus, Trash2, MessageSquare, Settings2, Megaphone, FileText, Radio, RefreshCw, Wifi, WifiOff, Loader2, Copy, Info, X as XIcon, Rocket, Bell, BellOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ChatView from "@/components/whatsapp/ChatView";
import QrCodePanel from "@/components/whatsapp/QrCodePanel";
import ProviderConfigDialog from "@/components/whatsapp/ProviderConfigDialog";
import BulkSendDialog from "@/components/whatsapp/BulkSendDialog";
import WaHubQrPanel from "@/components/whatsapp/WaHubQrPanel";
import HubGuide from "@/components/whatsapp/HubGuide";
import ConversationList from "@/components/whatsapp/ConversationList";
import TemplateManager from "@/components/whatsapp/TemplateManager";
import SessionDetailView from "@/components/whatsapp/SessionDetailView";
import CampaignManager from "@/components/whatsapp/CampaignManager";
import GroupDistributor from "@/components/whatsapp/GroupDistributor";
import CommandManager from "@/components/whatsapp/CommandManager";
import WhatsAppAIConfig from "@/components/whatsapp/WhatsAppAIConfig";

interface WaTemplate {
  id: string; name: string; content: string; category: string; project_id: string | null;
}

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: any; created_at: string;
  provider_id: string | null;
  last_message?: string | null;
  updated_at?: string;
}

export default function WhatsApp() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState("all");
  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [activeTab, setActiveTab] = useState<"sessoes" | "templates" | "campanhas" | "comandos" | "hub" | "ai">("sessoes");
  const [form, setForm] = useState({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" });
  const [chatTab, setChatTab] = useState<"chat" | "qrcode" | "info">("chat");

  const load = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";
  const getProvider = (projectId: string) => providers.find(p => p.project_id === projectId) || null;

  const createSession = async () => {
    if (!form.phone || !form.project_id) { toast.error("Telefone e projeto obrigatórios"); return; }
    const provider = getProvider(form.project_id);
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
    toast.success("Sessão removida");
    if (selectedSession?.id === id) setSelectedSession(null);
    load();
  };

  const selectedProvider = selectedSession ? getProvider(selectedSession.project_id) : null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 bg-card">
        <h1 className="font-display text-xl font-bold text-primary flex items-center gap-2">💬 WhatsApp <SectionInfo {...sectionHelpTexts.whatsapp} /></h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowProviderConfig(true)} className="h-8 text-xs">
            <Settings2 className="h-3.5 w-3.5 mr-1" /> Provider
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)} className="h-8 text-xs">
            <Megaphone className="h-3.5 w-3.5 mr-1" /> Disparo
          </Button>
        </div>
      </div>

      {/* Provider status strip */}
      {providers.filter(p => p.provider === "evolution").map(p => (
        <EvolutionStatusCard key={p.id} provider={p} projectName={projectName(p.project_id)} onSynced={load} />
      ))}
      {providers.length === 0 && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border text-center shrink-0">
          <p className="text-xs text-muted-foreground inline">Nenhum provider configurado.</p>
          <Button size="sm" variant="link" className="text-xs h-auto p-0 ml-1" onClick={() => setShowProviderConfig(true)}>
            Configurar agora →
          </Button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex items-center gap-0 border-b border-border shrink-0 bg-card px-2">
        <button onClick={() => setActiveTab("sessoes")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "sessoes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <MessageSquare className="h-3 w-3 inline mr-1" />Sessões
        </button>
        <button onClick={() => setActiveTab("templates")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "templates" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <FileText className="h-3 w-3 inline mr-1" />Templates ({templates.length})
        </button>
        <button onClick={() => setActiveTab("campanhas")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "campanhas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Rocket className="h-3 w-3 inline mr-1" />Campanhas
        </button>
        <button onClick={() => setActiveTab("comandos")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "comandos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          ⚡ Comandos
        </button>
        <button onClick={() => setActiveTab("ai")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "ai" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          🤖 IA Autônoma
        </button>
        <button onClick={() => setActiveTab("hub")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "hub" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Radio className="h-3 w-3 inline mr-1" />Hub Local (Beta)
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {activeTab === "sessoes" && (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left: conversation list */}
            <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
              <ConversationList
                sessions={sessions}
                projects={projects}
                providers={providers}
                selectedId={selectedSession?.id || null}
                loading={loading}
                onSelect={(s) => { setSelectedSession(s); setChatTab("chat"); }}
                onNewSession={() => setShowNew(true)}
                filterProject={filterProject}
                onFilterProject={setFilterProject}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right: chat or empty */}
            <ResizablePanel defaultSize={70}>
              {selectedSession ? (
                <div className="flex flex-col h-full">
                  {/* Chat header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {(selectedSession as any).avatar_url ? (
                        <img src={(selectedSession as any).avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-semibold truncate">{selectedSession.contact_name || selectedSession.phone}</h2>
                      <p className="text-[11px] text-muted-foreground">
                        📞 {selectedSession.phone} · {projectName(selectedSession.project_id)}
                        {selectedProvider && (
                          <span className="ml-1.5 text-[10px] opacity-70">
                            · via {selectedProvider.provider === "evolution" ? selectedProvider.instance_name : selectedProvider.twilio_from}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedProvider && (
                        <Badge variant="outline" className="text-[9px]">
                          {selectedProvider.provider === "evolution" ? "🟢 Evolution" : "🔵 Twilio"}
                        </Badge>
                      )}
                      <Tabs value={chatTab} onValueChange={(v) => setChatTab(v as any)}>
                        <TabsList className="h-7">
                          <TabsTrigger value="chat" className="text-[10px] h-6 px-2">Chat</TabsTrigger>
                          {selectedProvider?.provider === "evolution" && (
                            <TabsTrigger value="qrcode" className="text-[10px] h-6 px-2">📱 QR</TabsTrigger>
                          )}
                          <TabsTrigger value="info" className="text-[10px] h-6 px-2"><Info className="h-3 w-3" /></TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>

                  {/* Chat content */}
                  <div className="flex-1 min-h-0">
                    {chatTab === "chat" && (
                      <ChatView
                        conversationId={selectedSession.id}
                        phone={selectedSession.phone}
                        projectId={selectedSession.project_id}
                        providerId={selectedProvider?.id || null}
                      />
                    )}
                    {chatTab === "qrcode" && selectedProvider?.provider === "evolution" && (
                      <div className="p-4 overflow-auto h-full">
                        <QrCodePanel provider={selectedProvider} />
                      </div>
                    )}
                    {chatTab === "info" && (
                      <div className="p-4 overflow-auto h-full">
                        <SessionDetailView
                          session={selectedSession}
                          projectName={projectName(selectedSession.project_id)}
                          providerLabel={selectedProvider ? `${selectedProvider.provider} (${selectedProvider.instance_name || selectedProvider.twilio_from})` : "Nenhum"}
                          onDelete={deleteSession}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Selecione uma conversa</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                    Escolha uma conversa à esquerda ou crie uma nova sessão para começar a conversar.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nova Sessão
                  </Button>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {activeTab === "templates" && (
          <ScrollArea className="h-full">
            <TemplateManager templates={templates} projects={projects} onReload={load} />
          </ScrollArea>
        )}

        {activeTab === "campanhas" && (
          <ScrollArea className="h-full">
            <CampaignManager projects={projects} providers={providers} />
            <GroupDistributor />
          </ScrollArea>
        )}

        {activeTab === "comandos" && (
          <ScrollArea className="h-full">
            <CommandManager projects={projects} />
          </ScrollArea>
        )}

        {activeTab === "ai" && (
          <ScrollArea className="h-full">
            <div className="p-4 max-w-2xl">
              {filterProject && filterProject !== "all" ? (
                <WhatsAppAIConfig projectId={filterProject} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Selecione um projeto no filtro acima para configurar a IA Autônoma.</p>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === "hub" && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <HubConversations projects={projects} providers={providers} />
            </div>
          </ScrollArea>
        )}
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

      <ProviderConfigDialog open={showProviderConfig} onOpenChange={setShowProviderConfig} projects={projects} onCreated={load} />
      <BulkSendDialog open={showBulk} onOpenChange={setShowBulk} providers={providers} templates={templates} />
    </div>
  );
}

// ── Hub Conversations (kept inline, simplified) ──
function HubConversations({ projects, providers }: { projects: any[]; providers: any[] }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [hubSessions, setHubSessions] = useState<any[]>([]);
  const [hubFilterProject, setHubFilterProject] = useState("all");
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  useEffect(() => {
    Promise.all([
      supabase.from("imphq_wa_messages").select("*").order("created_at", { ascending: false }).limit(100),
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
    const provider = providers[0] || null;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedPhone(null)}>← Voltar</Button>
        <h2 className="text-lg font-semibold text-primary">Chat: {selectedPhone}</h2>
        <Card className="bg-card border-border h-[500px]">
          <ChatView conversationId={selectedPhone} phone={selectedPhone} projectId={grouped.find(g => g.phone === selectedPhone)?.projectId || ""} providerId={provider?.id || null} />
        </Card>
      </div>
    );
  }

  const deleteHubSession = async (session: any) => {
    await Promise.all([
      supabase.from("wa_hub_iso_events").delete().eq("tenant_id", session.tenant_id).eq("session_key", session.session_key),
      supabase.from("wa_hub_iso_commands").delete().eq("tenant_id", session.tenant_id).eq("session_key", session.session_key),
    ]);
    await supabase.from("wa_hub_iso_sessions").delete().eq("id", session.id);
    setHubSessions(prev => prev.filter(s => s.id !== session.id));
    toast.success(`Sessão ${session.session_key} removida`);
  };

  const cleanOfflineSessions = async () => {
    const offline = hubSessions.filter(s => s.status !== "connected");
    if (offline.length === 0) { toast.info("Nenhuma sessão offline"); return; }
    for (const s of offline) {
      await Promise.all([
        supabase.from("wa_hub_iso_events").delete().eq("tenant_id", s.tenant_id).eq("session_key", s.session_key),
        supabase.from("wa_hub_iso_commands").delete().eq("tenant_id", s.tenant_id).eq("session_key", s.session_key),
      ]);
      await supabase.from("wa_hub_iso_sessions").delete().eq("id", s.id);
    }
    setHubSessions(prev => prev.filter(s => s.status === "connected"));
    toast.success(`${offline.length} sessão(ões) offline removida(s)`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-3 border border-border">
        <p className="text-xs text-muted-foreground">
          <strong>Hub Local (Beta)</strong> — Conecta diretamente ao WhatsApp Web via QR Code no navegador. Diferente da Evolution API, funciona apenas enquanto o navegador estiver aberto.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className={`text-xs gap-1 ${connectedCount > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
          {connectedCount > 0 ? "🟢" : "🔴"} Hub: {connectedCount} sessão(ões)
        </Badge>
        {hubSessions.filter(s => s.status !== "connected").map(s => (
          <Badge key={s.id} variant="outline" className="text-[10px] bg-muted text-muted-foreground gap-1">
            🔴 {s.session_key}
            <button onClick={() => deleteHubSession(s)} className="ml-1 hover:text-destructive transition-colors"><XIcon className="h-3 w-3" /></button>
          </Badge>
        ))}
        {hubSessions.filter(s => s.status !== "connected").length > 0 && (
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={cleanOfflineSessions}>
            <Trash2 className="h-3 w-3 mr-1" /> Limpar Offline
          </Button>
        )}
      </div>

      <div className="max-w-lg mx-auto"><WaHubQrPanel /></div>
      <HubGuide />

      <Select value={hubFilterProject} onValueChange={setHubFilterProject}>
        <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Projetos</SelectItem>
          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {grouped.length > 0 ? (
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
                    <Badge variant="outline" className="text-[9px] mt-1">{g.count} msgs</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Nenhuma conversa do Hub. Conecte via QR Code para começar.</p>
        </div>
      )}
    </div>
  );
}

// ── Evolution Status Card ──
function EvolutionStatusCard({ provider, projectName, onSynced }: { provider: any; projectName: string; onSynced: () => void }) {
  const [status, setStatus] = useState<string>("loading");
  const [number, setNumber] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-api?action=webhook&provider=evolution`;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-api?action=instance_info&provider_id=${provider.id}`,
        { headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await res.json();
      setStatus(data.status || "unknown");
      setNumber(data.number || null);
    } catch { setStatus("error"); }
    setLoading(false);
  }, [provider.id]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const syncContacts = async () => {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-api?action=sync_contacts`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ provider_id: provider.id }) }
      );
      const data = await res.json();
      if (data.success) { toast.success(`${data.imported} contato(s) importado(s), ${data.skipped} já existente(s)`); onSynced(); }
      else toast.error(data.error || "Erro ao sincronizar");
    } catch (err: any) { toast.error("Falha: " + err.message); }
    setSyncing(false);
  };

  const copyWebhook = () => { navigator.clipboard.writeText(webhookUrl); setCopied(true); toast.success("URL copiada!"); setTimeout(() => setCopied(false), 2000); };

  const isConnected = status === "open" || status === "connected";
  const formatNumber = (n: string | null) => {
    if (!n) return null;
    const clean = n.replace(/\D/g, "");
    if (clean.length >= 12) return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4)}`;
    return `+${clean}`;
  };

  return (
    <div className="px-4 py-2 border-b border-border bg-card shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : isConnected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs">{provider.instance_name}</span>
              <Badge variant="outline" className={`text-[9px] ${isConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                {loading ? "..." : isConnected ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">{number ? formatNumber(number) : projectName} · Evolution</p>
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <Button size="sm" variant="ghost" onClick={fetchStatus} disabled={loading} className="h-7 w-7 p-0">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {isConnected && (
            <Button size="sm" variant="outline" onClick={syncContacts} disabled={syncing} className="h-7 text-[10px]">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sync
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={copyWebhook} className="h-7 w-7 p-0" title="Copiar webhook URL">
            <Copy className={`h-3 w-3 ${copied ? "text-emerald-400" : ""}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
