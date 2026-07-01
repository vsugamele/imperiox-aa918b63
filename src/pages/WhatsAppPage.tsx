import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Plus, Trash2, MessageSquare, Settings2, Megaphone, FileText, Radio, RefreshCw, Wifi, WifiOff, Loader2, Copy, Info, X as XIcon, Rocket, Bell, BellOff, MoreVertical, FolderOpen, QrCode, Power, AlertTriangle, History, MailOpen, PanelRightOpen, PanelRightClose } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
import { TriagemPanel } from "@/components/whatsapp/TriagemPanel";
import { ObjectionsLibrary } from "@/components/whatsapp/ObjectionsLibrary";
import { FunnelConversionDashboard } from "@/components/whatsapp/FunnelConversionDashboard";
import CommandManager from "@/components/whatsapp/CommandManager";
import WhatsAppAIConfig from "@/components/whatsapp/WhatsAppAIConfig";
import { useViewportWidth } from "@/hooks/useViewportWidth";

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
  last_message_at?: string | null;
  unread_count?: number;
  last_message_direction?: string | null;
  ai_paused_until?: string | null;
  assigned_to?: string | null;
}

let waRefCache: {
  ts: number;
  projects: { id: string; name: string }[];
  providers: any[];
  templates: WaTemplate[];
} = { ts: 0, projects: [], providers: [], templates: [] };

export default function WhatsApp() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState(() => localStorage.getItem("wa.filterProject") || "all");
  const [filterProvider, setFilterProvider] = useState(() => localStorage.getItem("wa.filterProvider") || "all");

  useEffect(() => { localStorage.setItem("wa.filterProject", filterProject); }, [filterProject]);
  useEffect(() => { localStorage.setItem("wa.filterProvider", filterProvider); }, [filterProvider]);
  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [activeTab, setActiveTab] = useState<"sessoes" | "templates" | "campanhas" | "comandos" | "hub" | "ai" | "triagem" | "objecoes" | "conversao">("sessoes");
  const [form, setForm] = useState({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" });
  const [chatTab, setChatTab] = useState<"chat" | "qrcode" | "info">("chat");
  const [selectedAiProviderId, setSelectedAiProviderId] = useState<string>("");
  const viewportWidth = useViewportWidth();
  const [showIntelPanel, setShowIntelPanel] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("wa.intelPanelOpen") : null;
    if (saved !== null) return saved === "true";
    return typeof window !== "undefined" ? window.innerWidth >= 1400 : true;
  });
  const listDefaultSize = viewportWidth >= 1440 ? 30 : viewportWidth >= 1280 ? 24 : 22;

  useEffect(() => {
    const saved = localStorage.getItem("wa.intelPanelOpen");
    if (saved !== null) return;
    setShowIntelPanel(viewportWidth >= 1400);
  }, [viewportWidth]);

  const toggleIntelPanel = () => {
    const next = !showIntelPanel;
    setShowIntelPanel(next);
    localStorage.setItem("wa.intelPanelOpen", String(next));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const sRes = await supabase
      .from("imphq_wa_conversations")
      .select("id, contact_name, phone, session, project_id, status, message_count, metadata, created_at, provider_id, last_message, updated_at, last_message_at, last_read_at, avatar_url, unread_count, last_message_direction, jid_suffix, ai_last_reply_at, ai_lock_until, ai_paused_until, assigned_to, snoozed_until")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    setSessions(sRes.data as any[] || []);
    setLoading(false);
  }, []);

  const loadReference = useCallback(async () => {
    const now = Date.now();
    if (waRefCache.ts && now - waRefCache.ts < 5 * 60_000) {
      setProjects(waRefCache.projects);
      setProviders(waRefCache.providers);
      setTemplates(waRefCache.templates);
      return;
    }
    const [pRes, provRes, tRes] = await Promise.all([
      supabase.from("imphq_projects").select("id, name").order("name"),
      supabase.from("imphq_wa_providers").select("id, display_name, instance_name, provider, api_url, is_active, project_id, webhook_verify_token, waba_id, phone_number_id, health_alerts_enabled, health_alerts_muted_until, twilio_from, created_at, ai_enabled").eq("is_active", true).order("created_at"),
      supabase.from("imphq_wa_templates").select("id, name, content, category, project_id, created_at").order("created_at", { ascending: false }),
    ]);
    const projectsData = pRes.data || [];
    const providersData = (provRes.data as any[]) || [];
    const templatesData = (tRes.data as any[]) || [];
    waRefCache = { ts: now, projects: projectsData, providers: providersData, templates: templatesData };
    setProjects(projectsData);
    setProviders(providersData);
    setTemplates(templatesData);
  }, []);

  useEffect(() => { load(); loadReference(); }, [load, loadReference]);

  // Deep-link: ?phone=XXX auto-seleciona a conversa correspondente
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (!phoneParam || sessions.length === 0) return;
    const digits = phoneParam.replace(/\D/g, "");
    const normalized = digits.startsWith("55") || digits.length < 10 ? digits : "55" + digits;
    const match = sessions.find(s => {
      const sd = (s.phone || "").replace(/\D/g, "");
      return sd === digits || sd === normalized || sd.endsWith(digits.slice(-10));
    });
    if (match) {
      setSelectedSession(match);
      setActiveTab("sessoes");
      // limpa o param pra não re-disparar
      const next = new URLSearchParams(searchParams);
      next.delete("phone");
      next.delete("project");
      setSearchParams(next, { replace: true });
    } else {
      toast.info(`Sem conversa aberta para ${phoneParam}. Use "Nova conversa" para iniciar.`);
      const next = new URLSearchParams(searchParams);
      next.delete("phone");
      setSearchParams(next, { replace: true });
    }
  }, [sessions, searchParams, setSearchParams]);

  // Realtime: nova mensagem → atualiza preview + incrementa unread localmente e move pro topo
  useEffect(() => {
    const ch = supabase
      .channel("wa-msgs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_wa_messages" }, (payload) => {
        const m: any = payload.new;
        setSessions(prev => {
          const idx = prev.findIndex(s => s.id === m.conversation_id);
          if (idx === -1) {
            // Conversa ainda não está na lista → buscar e prepend
            supabase.from("imphq_wa_conversations").select("*").eq("id", m.conversation_id).maybeSingle().then(({ data }) => {
              if (data) setSessions(curr => curr.some(s => s.id === data.id) ? curr : [data as any, ...curr]);
            });
            return prev;
          }
          const isInbound = m.direction === "in" || m.direction === "incoming";
          const isOpen = selectedSession?.id === m.conversation_id;
          const updated = {
            ...prev[idx],
            last_message: (m.content || "").slice(0, 200),
            last_message_at: m.created_at || new Date().toISOString(),
            last_message_direction: m.direction,
            unread_count: isInbound && !isOpen ? (prev[idx].unread_count || 0) + 1 : prev[idx].unread_count || 0,
          };
          const rest = prev.filter((_, i) => i !== idx);
          return [updated, ...rest];
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_wa_conversations" }, (payload) => {
        const c: any = payload.new;
        setSessions(prev => prev.some(s => s.id === c.id) ? prev : [c, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "imphq_wa_conversations" }, (payload) => {
        const c: any = payload.new;
        setSessions(prev => {
          const merged = prev.map(s => s.id === c.id ? { ...s, ...c } : s);
          return merged.sort((a, b) => {
            const ta = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
            const tb = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
            return tb - ta;
          });
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedSession?.id]);

  // Marca como lida ao selecionar
  const markRead = useCallback(async (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, unread_count: 0 } : s));
    await supabase.from("imphq_wa_conversations")
      .update({ unread_count: 0, last_read_at: new Date().toISOString() } as any)
      .eq("id", id);
  }, []);

  // Marca como não lida novamente
  const markUnread = useCallback(async (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, unread_count: 1 } : s));
    const session = sessions.find(s => s.id === id);
    const lastMsgTime = session?.last_message_at ? new Date(session.last_message_at).getTime() : Date.now();
    const olderReadTime = new Date(lastMsgTime - 10000).toISOString();

    await supabase.from("imphq_wa_conversations")
      .update({ unread_count: 1, last_read_at: olderReadTime } as any)
      .eq("id", id);

    setSelectedSession(null);
    toast.success("Conversa marcada como não lida");
  }, [sessions]);

  // ── Atalhos de teclado (J/K navegar, R focar resposta, U marcar não lida, Esc fechar) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable;
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const list = sessions.filter(s => filterProject === "all" || s.project_id === filterProject);
      const idx = selectedSession ? list.findIndex(s => s.id === selectedSession.id) : -1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = list[Math.min(idx + 1, list.length - 1)];
        if (next) { setSelectedSession(next); setChatTab("chat"); markRead(next.id); }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = list[Math.max(idx - 1, 0)];
        if (prev) { setSelectedSession(prev); setChatTab("chat"); markRead(prev.id); }
      } else if (e.key === "r") {
        e.preventDefault();
        const ta = document.querySelector<HTMLTextAreaElement>("textarea[data-wa-composer]") ||
                   document.querySelector<HTMLTextAreaElement>(".chat-view textarea") ||
                   document.querySelector<HTMLTextAreaElement>("textarea");
        ta?.focus();
      } else if (e.key === "u" && selectedSession) {
        e.preventDefault();
        markUnread(selectedSession.id);
      } else if (e.key === "Escape" && selectedSession) {
        setSelectedSession(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessions, selectedSession, filterProject, markRead, markUnread]);

  // Auto-sync avatars for visible conversations missing avatar_url (batch, by provider)
  useEffect(() => {
    if (loading || sessions.length === 0 || providers.length === 0) return;
    const missing = sessions.filter(s => !(s as any).avatar_url && s.provider_id).slice(0, 30);
    if (missing.length === 0) return;
    // Group by provider_id
    const byProvider = new Map<string, string[]>();
    missing.forEach(s => {
      const arr = byProvider.get(s.provider_id!) || [];
      arr.push(s.phone);
      byProvider.set(s.provider_id!, arr);
    });
    (async () => {
      for (const [providerId, phones] of byProvider.entries()) {
        try {
          await supabase.functions.invoke("whatsapp-api?action=fetch_avatars_batch", {
            body: { provider_id: providerId, phones: phones.slice(0, 15) },
          });
        } catch {/* silent */}
      }
      // Refresh once after batch
      const { data } = await supabase.from("imphq_wa_conversations")
        .select("id, avatar_url").in("id", missing.map(s => s.id));
      if (data) {
        setSessions(prev => prev.map(s => {
          const u = (data as any[]).find(d => d.id === s.id);
          return u?.avatar_url ? { ...s, avatar_url: u.avatar_url } as any : s;
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, providers.length, sessions.length]);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";
  const getProvider = (projectId: string) => providers.find(p => p.project_id === projectId) || null;

  const createSession = async () => {
    if (!form.phone || !form.project_id) { toast.error("Telefone e projeto obrigatórios"); return; }
    const provider = getProvider(form.project_id);
    const cleanedPhone = form.phone.replace(/\D/g, "");

    // 1. Verificar se a conversa já existe para este projeto e telefone
    const { data: existing } = await supabase
      .from("imphq_wa_conversations")
      .select("id")
      .eq("project_id", form.project_id)
      .eq("phone", cleanedPhone)
      .maybeSingle();

    let err: any = null;
    if (existing) {
      // 2. Se já existe, atualiza os dados
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({
          contact_name: form.contact_name || null,
          session: form.session || `session-${Date.now()}`,
          status: "active",
          provider_id: provider?.id || null,
          metadata: { default_message: form.default_message } as any,
        } as any)
        .eq("id", existing.id);
      err = error;
    } else {
      // 3. Se não existe, cria um novo
      const id = crypto.randomUUID();
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .insert({
          id, phone: cleanedPhone,
          contact_name: form.contact_name || null,
          session: form.session || `session-${Date.now()}`,
          project_id: form.project_id, status: "active",
          provider_id: provider?.id || null,
          metadata: { default_message: form.default_message } as any,
        } as any);
      err = error;
    }

    if (err) { toast.error("Erro: " + err.message); return; }
    toast.success("Sessão criada!"); setShowNew(false);
    setForm({ phone: "", contact_name: "", session: "", project_id: "", default_message: "" }); load();
  };

  const deleteSession = async (id: string) => {
    await supabase.from("imphq_wa_conversations").delete().eq("id", id);
    toast.success("Sessão removida");
    if (selectedSession?.id === id) setSelectedSession(null);
    load();
  };

  const selectedProvider = selectedSession
    ? (selectedSession.provider_id ? providers.find(p => p.id === selectedSession.provider_id) : null) || getProvider(selectedSession.project_id)
    : null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 bg-card">
        <h1 className="font-display text-xl font-bold text-primary flex items-center gap-2">💬 WhatsApp <SectionInfo {...sectionHelpTexts.whatsapp} /></h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setEditingProvider(null); setShowProviderConfig(true); }} className="h-8 text-xs">
            <Settings2 className="h-3.5 w-3.5 mr-1" /> Provider
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)} className="h-8 text-xs">
            <Megaphone className="h-3.5 w-3.5 mr-1" /> Disparo
          </Button>
        </div>
      </div>

      {/* Provider status strip */}
      {providers.map(p => {
        if (p.provider === "evolution") {
          return <EvolutionStatusCard key={p.id} provider={p} projectName={projectName(p.project_id)} projects={projects} onSynced={load} onEdit={(prov) => { setEditingProvider(prov); setShowProviderConfig(true); }} />;
        }
        if (p.provider === "meta_cloud") {
          return <MetaCloudStatusCard key={p.id} provider={p} projectName={projectName(p.project_id)} projects={projects} onSynced={load} onEdit={(prov) => { setEditingProvider(prov); setShowProviderConfig(true); }} />;
        }
        return null;
      })}
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
        <button onClick={() => setActiveTab("triagem")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "triagem" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          🎯 Triagem IA
        </button>
        <button onClick={() => setActiveTab("objecoes")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "objecoes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          📚 Objeções
        </button>
        <button onClick={() => setActiveTab("hub")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "hub" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Radio className="h-3 w-3 inline mr-1" />Hub Local (Beta)
        </button>
        <button onClick={() => setActiveTab("conversao")} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "conversao" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          📊 Conversão
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {activeTab === "sessoes" && (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left: conversation list */}
            <ResizablePanel defaultSize={listDefaultSize} minSize={20} maxSize={45}>
              <ConversationList
                sessions={sessions}
                projects={projects}
                providers={providers}
                selectedId={selectedSession?.id || null}
                loading={loading}
                onSelect={(s) => { setSelectedSession(s); setChatTab("chat"); markRead(s.id); }}
                onNewSession={() => setShowNew(true)}
                filterProject={filterProject}
                onFilterProject={setFilterProject}
                filterProvider={filterProvider}
                onFilterProvider={setFilterProvider}
                onMarkUnread={markUnread}
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
                            · via {(selectedProvider as any).display_name || (selectedProvider.provider === "evolution" ? selectedProvider.instance_name : selectedProvider.twilio_from)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* AI Pause/Resume controls */}
                      {(() => {
                        const isAiPaused = selectedSession.ai_paused_until && new Date(selectedSession.ai_paused_until) > new Date();
                        const remainingMinutes = selectedSession.ai_paused_until
                          ? Math.max(0, Math.ceil((new Date(selectedSession.ai_paused_until).getTime() - Date.now()) / 60000))
                          : 0;

                        const toggleAiPause = async () => {
                          const newPausedUntil = isAiPaused ? null : new Date(Date.now() + 30 * 60 * 1000).toISOString();
                          const { error } = await supabase
                            .from("imphq_wa_conversations")
                            .update({ ai_paused_until: newPausedUntil } as any)
                            .eq("id", selectedSession.id);
                          
                          if (error) {
                            toast.error("Erro ao alterar status da IA: " + error.message);
                            return;
                          }

                          setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, ai_paused_until: newPausedUntil } : s));
                          setSelectedSession(prev => prev ? { ...prev, ai_paused_until: newPausedUntil } : null);
                          toast.success(isAiPaused ? "IA retomada com sucesso!" : "IA pausada por 30 minutos.");
                        };

                        return (
                          <Button
                            size="sm"
                            variant={isAiPaused ? "secondary" : "ghost"}
                            className={`h-7 text-[10px] gap-1 transition-all ${
                              isAiPaused 
                                ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400" 
                                : "text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                            }`}
                            onClick={toggleAiPause}
                            title={isAiPaused ? "Retomar a resposta automática da IA" : "Pausar a IA nesta conversa por 30 minutos"}
                          >
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAiPaused ? "bg-amber-400" : "bg-emerald-400"}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${isAiPaused ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                            </span>
                            <span>{isAiPaused ? `IA Pausada (${remainingMinutes}m)` : "IA Ativa"}</span>
                          </Button>
                        );
                      })()}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-muted-foreground hover:text-emerald-400 hover:bg-secondary/40 gap-1"
                        onClick={() => markUnread(selectedSession.id)}
                        title="Marcar como não lida"
                      >
                        <MailOpen className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Não lida</span>
                      </Button>

                      {selectedProvider && (
                        <Badge variant="outline" className="text-[9px] flex items-center gap-1.5" title={selectedProvider.instance_name || ""}>
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: `hsl(${[...selectedProvider.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360}, 65%, 55%)` }} />
                          {(selectedProvider as any).display_name || (selectedProvider.provider === "evolution" ? selectedProvider.instance_name : "Twilio")}
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
                      <Button
                        size="icon"
                        variant={showIntelPanel ? "secondary" : "ghost"}
                        className={`h-7 w-7 shrink-0 transition-colors ${showIntelPanel ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        onClick={toggleIntelPanel}
                        title={showIntelPanel ? "Ocultar Intel do Lead" : "Mostrar Intel do Lead"}
                      >
                        {showIntelPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Chat content */}
                  <div className="flex-1 min-h-0">
                    {chatTab === "chat" && (
                      <div className="flex flex-col h-full">
                        {filterProvider !== "all" && selectedSession.provider_id && selectedSession.provider_id !== filterProvider && (
                          <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 text-[11px] text-amber-200">
                            ⚠️ Esta conversa pertence ao chip <strong>{providers.find(p => p.id === selectedSession.provider_id)?.instance_name || "outro"}</strong>. A resposta sairá por esse chip, não pelo filtro atual.
                          </div>
                        )}
                        <div className="flex-1 min-h-0">
                          <ChatView
                            conversationId={selectedSession.id}
                            phone={selectedSession.phone}
                            projectId={selectedSession.project_id}
                            providerId={selectedProvider?.id || null}
                          />
                        </div>
                      </div>
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

        {activeTab === "triagem" && (
          <ScrollArea className="h-full"><div className="p-4 max-w-5xl mx-auto"><TriagemPanel /></div></ScrollArea>
        )}

        {activeTab === "objecoes" && (
          <ScrollArea className="h-full"><div className="p-4 max-w-4xl mx-auto"><ObjectionsLibrary /></div></ScrollArea>
        )}

        {activeTab === "comandos" && (
          <ScrollArea className="h-full">
            <CommandManager projects={projects} />
          </ScrollArea>
        )}

        {activeTab === "ai" && (
          <ScrollArea className="h-full">
            <div className="p-4 max-w-2xl space-y-4">
              <div className="flex flex-col gap-1.5 p-4 bg-card rounded-lg border border-border/40">
                <Label className="text-xs font-semibold text-muted-foreground">Selecione o Chip / Sessão do WhatsApp:</Label>
                <Select
                  value={selectedAiProviderId || (providers[0]?.id || "none")}
                  onValueChange={(v) => setSelectedAiProviderId(v)}
                >
                  <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5">
                    <SelectValue placeholder="Selecione um número" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.display_name || p.instance_name} ({p.provider === "evolution" ? "Evolution" : "Meta Oficial"})
                      </SelectItem>
                    ))}
                    {providers.length === 0 && (
                      <SelectItem value="none" disabled>Nenhum chip conectado</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedAiProviderId && selectedAiProviderId !== "none" ? (
                (() => {
                  const prov = providers.find(p => p.id === selectedAiProviderId);
                  return prov ? (
                    <WhatsAppAIConfig key={prov.id} projectId={prov.project_id} providerId={prov.id} />
                  ) : null;
                })()
              ) : providers[0] ? (
                <WhatsAppAIConfig key={providers[0].id} projectId={providers[0].project_id} providerId={providers[0].id} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum WhatsApp conectado. Conecte um provider para configurar a IA.
                </p>
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

        {activeTab === "conversao" && (
          <div className="h-full overflow-hidden">
            {(filterProject !== "all" ? filterProject : projects[0]?.id) ? (
              <FunnelConversionDashboard projectId={filterProject !== "all" ? filterProject : projects[0].id} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Nenhum projeto encontrado.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Session Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Sessão WhatsApp</DialogTitle>
            <DialogDescription className="hidden">Criação de uma nova sessão de WhatsApp no ImperioHQ.</DialogDescription>
          </DialogHeader>
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

      <ProviderConfigDialog
        open={showProviderConfig}
        onOpenChange={(open) => {
          setShowProviderConfig(open);
          if (!open) setEditingProvider(null);
        }}
        projects={projects}
        existingProviders={providers}
        editingProvider={editingProvider}
        onCreated={() => { load(); setEditingProvider(null); }}
      />
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
      supabase.from("imphq_wa_messages").select("id, phone, content, created_at, project_id").order("created_at", { ascending: false }).limit(100),
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
function EvolutionStatusCard({ provider, projectName, projects, onSynced, onEdit }: { provider: any; projectName: string; projects: { id: string; name: string }[]; onSynced: () => void; onEdit: (provider: any) => void }) {
  const [status, setStatus] = useState<string>("loading");
  const [number, setNumber] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const [importingMsgs, setImportingMsgs] = useState(false);
  const importMessages = async () => {
    setImportingMsgs(true);
    toast.info("Importando histórico (pode levar 1-2 min)…");
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-api?action=sync_messages`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ provider_id: provider.id, days: 30 }) }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.imported} mensagens · ${data.conversations_created} conversas novas`);
        onSynced();
      } else toast.error(data.error || "Erro ao importar histórico");
    } catch (err: any) { toast.error("Falha: " + err.message); }
    setImportingMsgs(false);
  };

  const restartInstance = async () => {
    setRestarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=restart_instance", { body: { provider_id: provider.id } });
      if (error) throw error;
      if ((data as any)?.success) { toast.success("Reconectando — abra o QR Code para escanear"); setTimeout(fetchStatus, 1500); }
      else toast.error("Falha ao reconectar");
    } catch (err: any) { toast.error("Erro: " + err.message); }
    setRestarting(false);
  };

  const deleteProvider = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=delete_instance", { body: { provider_id: provider.id } });
      if (error) throw error;
      if ((data as any)?.success) { toast.success("Provider removido"); onSynced(); }
      else toast.error("Falha ao remover");
    } catch (err: any) { toast.error("Erro: " + err.message); }
    setConfirmDelete(false);
  };

  const changeProject = async (newProjectId: string) => {
    const { error } = await supabase.from("imphq_wa_providers").update({ project_id: newProjectId }).eq("id", provider.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Projeto atualizado");
    onSynced();
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : isConnected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-xs truncate">{(provider as any).display_name || provider.instance_name}</span>
              {(provider as any).display_name && <span className="text-[10px] text-muted-foreground/70 truncate">({provider.instance_name})</span>}
              <Badge variant="outline" className="text-[9px] gap-1 bg-primary/10 text-primary border-primary/30">
                <FolderOpen className="h-2.5 w-2.5" /> {projectName}
              </Badge>
              <Badge variant="outline" className={`text-[9px] ${isConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                {loading ? "..." : isConnected ? "Conectado" : "Desconectado"}
              </Badge>
              <Badge variant="outline" className={`text-[9px] ${provider.ai_enabled !== false ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" : "bg-muted text-muted-foreground border-border"}`}>
                🤖 {provider.ai_enabled !== false ? "IA Ativa" : "IA Inativa"}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">{number ? formatNumber(number) : "—"} · Evolution</p>
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          {!isConnected && !loading && (
            <Button size="sm" variant="outline" onClick={restartInstance} disabled={restarting} className="h-7 text-[10px] border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
              {restarting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Power className="h-3 w-3 mr-1" />}
              Reconectar
            </Button>
          )}
          <AlertControls provider={provider} onChanged={onSynced} />
          <Button size="sm" variant="ghost" onClick={fetchStatus} disabled={loading} className="h-7 w-7 p-0" title="Atualizar status">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {isConnected && (
            <Button size="sm" variant="outline" onClick={syncContacts} disabled={syncing} className="h-7 text-[10px]">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sync
            </Button>
          )}
          {isConnected && (
            <Button size="sm" variant="outline" onClick={importMessages} disabled={importingMsgs} className="h-7 text-[10px] border-primary/40 text-primary hover:bg-primary/10" title="Importa últimos 30 dias de conversas do chip">
              {importingMsgs ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <History className="h-3 w-3 mr-1" />}
              Importar histórico
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Mais ações">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Trocar projeto</DropdownMenuLabel>
              {projects.map(p => (
                <DropdownMenuItem key={p.id} className="text-xs" onClick={() => changeProject(p.id)} disabled={p.id === provider.project_id}>
                  <FolderOpen className="h-3 w-3 mr-2" />
                  {p.name} {p.id === provider.project_id && "✓"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={restartInstance} disabled={restarting}>
                <Power className="h-3 w-3 mr-2" /> Reconectar / Novo QR
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={copyWebhook}>
                <Copy className={`h-3 w-3 mr-2 ${copied ? "text-emerald-400" : ""}`} /> Copiar webhook URL
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={() => onEdit(provider)}>
                <Settings2 className="h-3 w-3 mr-2" /> Editar configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3 w-3 mr-2" /> Excluir provider
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Excluir provider?</AlertDialogTitle>
            <AlertDialogDescription className="leading-7">
              Isso vai remover a instância <strong>{provider.instance_name}</strong> do projeto <strong>{projectName}</strong>, encerrar a sessão WhatsApp na Evolution e apagar o provider local. As conversas continuam, mas você perde o envio até reconfigurar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProvider} className="bg-destructive hover:bg-destructive/90">Excluir definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Controle de alertas de queda por instância ──
function AlertControls({ provider, onChanged }: { provider: any; onChanged: () => void }) {
  const enabled = provider.health_alerts_enabled !== false;
  const mutedUntil = provider.health_alerts_muted_until ? new Date(provider.health_alerts_muted_until) : null;
  const isMuted = mutedUntil && mutedUntil.getTime() > Date.now();
  const active = enabled && !isMuted;

  const update = async (patch: any, msg: string) => {
    const { error } = await supabase.from("imphq_wa_providers").update(patch).eq("id", provider.id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    onChanged();
  };

  const muteFor = (hours: number) => {
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    update({ health_alerts_muted_until: until }, `Alertas silenciados por ${hours}h`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={active ? "Alertas ativos" : "Alertas silenciados"}>
          {active ? <Bell className="h-3 w-3 text-emerald-400" /> : <BellOff className="h-3 w-3 text-amber-400" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Alertas de queda</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isMuted && (
          <DropdownMenuItem className="text-xs text-amber-400" onClick={() => update({ health_alerts_muted_until: null }, "Alertas reativados")}>
            Reativar agora (silenciado até {mutedUntil!.toLocaleTimeString().slice(0, 5)})
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-xs" onClick={() => muteFor(1)}>Silenciar por 1h</DropdownMenuItem>
        <DropdownMenuItem className="text-xs" onClick={() => muteFor(6)}>Silenciar por 6h</DropdownMenuItem>
        <DropdownMenuItem className="text-xs" onClick={() => muteFor(24)}>Silenciar por 24h</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onClick={() => update({ health_alerts_enabled: !enabled, health_alerts_muted_until: null }, enabled ? "Alertas desativados" : "Alertas ativados")}>
          {enabled ? "Desativar alertas" : "Ativar alertas"}
        </DropdownMenuItem>
        <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-t border-border mt-1">
          Throttle: 1 e-mail / instância a cada 6h
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Meta Cloud Status Card (Oficial API) ──
function MetaCloudStatusCard({ provider, projectName, projects, onSynced, onEdit }: { provider: any; projectName: string; projects: { id: string; name: string }[]; onSynced: () => void; onEdit: (provider: any) => void }) {
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const webhookUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-api?action=webhook&provider=meta_cloud&provider_id=${provider.id}`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("Webhook URL copiado!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(provider.webhook_verify_token || "");
    setCopiedToken(true);
    toast.success("Verify Token copiado!");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const deleteProvider = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=delete_instance", { body: { provider_id: provider.id } });
      if (error) throw error;
      if ((data as any)?.success) {
        toast.success("Provider Oficial Meta removido");
        onSynced();
      } else {
        toast.error("Falha ao remover");
      }
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
    setConfirmDelete(false);
  };

  const changeProject = async (newProjectId: string) => {
    const { error } = await supabase.from("imphq_wa_providers").update({ project_id: newProjectId }).eq("id", provider.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Projeto atualizado");
    onSynced();
  };

  return (
    <div className="px-4 py-2 border-b border-border bg-card shrink-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Wifi className="h-4 w-4 text-emerald-400" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-xs text-foreground truncate">{provider.display_name || "API Oficial Meta"}</span>
              <Badge variant="outline" className="text-[9px] gap-1 bg-violet-500/10 text-violet-400 border-violet-500/30 font-semibold">
                👑 API Oficial
              </Badge>
              <Badge variant="outline" className="text-[9px] gap-1 bg-primary/10 text-primary border-primary/30">
                <FolderOpen className="h-2.5 w-2.5" /> {projectName}
              </Badge>
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                Ativo
              </Badge>
              <Badge variant="outline" className={`text-[9px] ${provider.ai_enabled !== false ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" : "bg-muted text-muted-foreground border-border"}`}>
                🤖 {provider.ai_enabled !== false ? "IA Ativa" : "IA Inativa"}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              WABA ID: {provider.waba_id || "—"} · Phone ID: {provider.phone_number_id || "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <Button size="sm" variant="outline" onClick={copyWebhook} className="h-7 text-[10px] gap-1">
            <Copy className="h-3 w-3" />
            {copiedWebhook ? "Copiado!" : "Copiar Webhook"}
          </Button>
          <Button size="sm" variant="outline" onClick={copyToken} className="h-7 text-[10px] gap-1">
            <Copy className="h-3 w-3" />
            {copiedToken ? "Copiado!" : "Verify Token"}
          </Button>

          <AlertControls provider={provider} onChanged={onSynced} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Mais ações">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Trocar projeto</DropdownMenuLabel>
              {projects.map(p => (
                <DropdownMenuItem key={p.id} className="text-xs" onClick={() => changeProject(p.id)} disabled={p.id === provider.project_id}>
                  <FolderOpen className="h-3 w-3 mr-2" />
                  {p.name} {p.id === provider.project_id && "✓"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={() => onEdit(provider)}>
                <Settings2 className="h-3 w-3 mr-2" /> Editar configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3 w-3 mr-2" /> Excluir provider
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Excluir provider oficial?</AlertDialogTitle>
            <AlertDialogDescription className="leading-7">
              Isso vai remover a configuração da API Oficial Meta (<strong>{provider.display_name || "API Oficial"}</strong>) do projeto <strong>{projectName}</strong>. As conversas continuam salvas, mas o envio e recebimento oficial serão suspensos até que você configure o provider novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProvider} className="bg-destructive hover:bg-destructive/90">Excluir definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
