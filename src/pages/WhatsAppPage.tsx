import { record } from "@/lib/funis-data";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/error-message";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Trash2, MessageSquare, Settings2, Megaphone, FileText, Radio, RefreshCw, Wifi, WifiOff, Loader2, Copy, Info, X as XIcon, Rocket, Bell, BellOff, MoreVertical, FolderOpen, QrCode, Power, AlertTriangle, History, MailOpen, PanelRightOpen, PanelRightClose, Sparkles } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ChatView from "@/components/whatsapp/ChatView";
import QrCodePanel from "@/components/whatsapp/QrCodePanel";
import ProviderConfigDialog from "@/components/whatsapp/ProviderConfigDialog";
import ConnectWhatsAppModal from "@/components/whatsapp/ConnectWhatsAppModal";
import BulkSendDialog from "@/components/whatsapp/BulkSendDialog";
import HubLocalManager from "@/components/whatsapp/HubLocalManager";
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

const TAB_LABELS: Record<string, string> = {
  sessoes: "Atendimento",
  templates: "Templates",
  campanhas: "Campanhas",
  comandos: "Comandos",
  ai: "IA Autônoma",
  triagem: "Triagem IA",
  objecoes: "Objeções",
  conversao: "Conversão",
  hub: "Hub Local",
};

type WaSession = Pick<Tables<"imphq_wa_conversations">, "id" | "contact_name" | "phone" | "session" | "project_id" | "status" | "message_count" | "metadata" | "created_at" | "provider_id" | "last_message" | "updated_at" | "last_message_at" | "last_read_at" | "avatar_url" | "unread_count" | "last_message_direction" | "jid_suffix" | "ai_last_reply_at" | "ai_lock_until" | "ai_paused_until" | "assigned_to" | "snoozed_until" | "handoff_at" | "color_override">;
type WaProvider = Pick<Tables<"imphq_wa_providers">, "id" | "display_name" | "instance_name" | "provider" | "api_url" | "is_active" | "project_id" | "webhook_verify_token" | "waba_id" | "phone_number_id" | "health_alerts_enabled" | "health_alerts_muted_until" | "twilio_from" | "created_at" | "ai_enabled" | "status">;

let waRefCache: {
  ts: number;
  projects: { id: string; name: string }[];
  providers: WaProvider[];
  templates: WaTemplate[];
} = { ts: 0, projects: [], providers: [], templates: [] };

const AVATAR_GRADIENTS = [
  "from-emerald-600 to-teal-800",
  "from-blue-600 to-indigo-800",
  "from-violet-600 to-purple-800",
  "from-amber-600 to-orange-800",
  "from-rose-600 to-pink-800",
  "from-cyan-600 to-blue-800",
  "from-fuchsia-600 to-rose-800",
  "from-teal-600 to-emerald-800",
];

function getAvatarGradient(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function getInitials(name: string | null | undefined, phone: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(-2) : "WA";
}

export default function WhatsApp() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [providers, setProviders] = useState<WaProvider[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState(() => localStorage.getItem("wa.filterProject") || "all");
  const [filterProvider, setFilterProvider] = useState(() => localStorage.getItem("wa.filterProvider") || "all");

  useEffect(() => { localStorage.setItem("wa.filterProject", filterProject); }, [filterProject]);
  useEffect(() => { localStorage.setItem("wa.filterProvider", filterProvider); }, [filterProvider]);
  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<WaProvider | null>(null);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [editingProvider, setEditingProvider] = useState<WaProvider | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [activeTab, setActiveTab] = useState<"sessoes" | "templates" | "campanhas" | "comandos" | "ai" | "triagem" | "objecoes" | "conversao" | "hub">("sessoes");
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
      .select("id, contact_name, phone, session, project_id, status, message_count, metadata, created_at, provider_id, last_message, updated_at, last_message_at, last_read_at, avatar_url, unread_count, last_message_direction, jid_suffix, ai_last_reply_at, ai_lock_until, ai_paused_until, assigned_to, snoozed_until, handoff_at, color_override")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    const list = sRes.data || [];
    setSessions(list);
    setLoading(false);
  }, []);

  // Auto-selecionar primeira conversa ativa se nenhuma selecionada (elimina tela preta vazia)
  useEffect(() => {
    if (!selectedSession && sessions.length > 0) {
      const firstUnread = sessions.find(s => (s.unread_count || 0) > 0);
      const target = firstUnread || sessions[0];
      if (target) {
        setSelectedSession(target);
        setChatTab("chat");
      }
    }
  }, [sessions, selectedSession]);

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
      supabase.from("imphq_wa_providers").select("id, display_name, instance_name, provider, api_url, is_active, project_id, webhook_verify_token, waba_id, phone_number_id, health_alerts_enabled, health_alerts_muted_until, twilio_from, created_at, ai_enabled, status").order("created_at"),
      supabase.from("imphq_wa_templates").select("id, name, content, category, project_id, created_at").order("created_at", { ascending: false }),
    ]);
    const projectsData = pRes.data || [];
    const providersData = provRes.data || [];
    const templatesData = tRes.data || [];
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
      .on<Tables<"imphq_wa_messages">>("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_wa_messages" }, (payload) => {
        const m = payload.new;
        setSessions(prev => {
          const idx = prev.findIndex(s => s.id === m.conversation_id);
          if (idx === -1) {
            // Conversa ainda não está na lista → buscar e prepend
            supabase.from("imphq_wa_conversations").select("*").eq("id", m.conversation_id).maybeSingle().then(({ data }) => {
              if (data) setSessions(curr => curr.some(s => s.id === data.id) ? curr : [data, ...curr]);
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
      .on<Tables<"imphq_wa_conversations">>("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_wa_conversations" }, (payload) => {
        const c = payload.new;
        setSessions(prev => prev.some(s => s.id === c.id) ? prev : [c, ...prev]);
      })
      .on<Tables<"imphq_wa_conversations">>("postgres_changes", { event: "UPDATE", schema: "public", table: "imphq_wa_conversations" }, (payload) => {
        const c = payload.new;
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
    const { error } = await supabase.from("imphq_wa_conversations")
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Não foi possível marcar como lida."); return; }
    setSessions(prev => prev.map(s => s.id === id ? { ...s, unread_count: 0 } : s));
  }, []);

  // Marca como não lida novamente
  const markUnread = useCallback(async (id: string) => {
    const session = sessions.find(s => s.id === id);
    const lastMsgTime = session?.last_message_at ? new Date(session.last_message_at).getTime() : Date.now();
    const olderReadTime = new Date(lastMsgTime - 10000).toISOString();

    const { error } = await supabase.from("imphq_wa_conversations")
      .update({ unread_count: 1, last_read_at: olderReadTime })
      .eq("id", id);

    if (error) { toast.error("Não foi possível marcar como não lida."); return; }
    setSessions(prev => prev.map(s => s.id === id ? { ...s, unread_count: 1 } : s));
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
    const missing = sessions.filter(s => !s.avatar_url && s.provider_id).slice(0, 30);
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
          const u = data.find(d => d.id === s.id);
          return u?.avatar_url ? { ...s, avatar_url: u.avatar_url } : s;
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

    let err: PostgrestError | Error | null = null;
    if (existing) {
      // 2. Se já existe, atualiza os dados
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({
          contact_name: form.contact_name || null,
          session: form.session || `session-${Date.now()}`,
          status: "active",
          provider_id: provider?.id || null,
          metadata: { default_message: form.default_message },
        })
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
          metadata: { default_message: form.default_message },
        });
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

  const activeProvider = selectedProvider || (filterProvider !== "all" ? providers.find(p => p.id === filterProvider) : null) || providers[0] || null;

  const syncContacts = async (providerId?: string) => {
    const id = providerId || activeProvider?.id;
    if (!id) return;
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-api?action=sync_contacts`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ provider_id: id }) }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.imported || 0} contato(s) sincronizado(s)`);
        load();
      } else {
        toast.error(data.error || "Erro ao sincronizar");
      }
    } catch (err: unknown) {
      toast.error("Falha ao sincronizar: " + errorMessage(err));
    }
  };

  const importMessages = async (providerId?: string) => {
    const id = providerId || activeProvider?.id;
    if (!id) return;
    toast.info("Importando histórico (pode levar 1-2 min)…");
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-api?action=sync_messages`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ provider_id: id, days: 30 }) }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.imported || 0} mensagens · ${data.conversations_created || 0} conversas importadas`);
        load();
      } else {
        toast.error(data.error || "Erro ao importar histórico");
      }
    } catch (err: unknown) {
      toast.error("Falha ao importar: " + errorMessage(err));
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Unified Atendimento Top Bar */}
      {activeTab === "sessoes" ? (
        <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-border shrink-0 bg-card/90 backdrop-blur-sm min-h-[40px]">
          {/* Left: Chip status & active project */}
          <div className="flex items-center gap-2.5 min-w-0">
            {activeProvider ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                </span>
                <span className="font-semibold text-xs text-foreground truncate">
                  {activeProvider.display_name || activeProvider.instance_name || "WhatsApp"}
                </span>
                {projectName(activeProvider.project_id) && (
                  <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-normal bg-primary/10 text-primary border-primary/20 shrink-0">
                    {projectName(activeProvider.project_id)}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] h-4.5 px-1.5 font-medium shrink-0 ${
                    activeProvider.ai_enabled !== false
                      ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  🤖 {activeProvider.ai_enabled !== false ? "IA Ativa" : "IA Pausada"}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <span className="text-xs text-muted-foreground">Nenhum chip conectado</span>
              </div>
            )}
          </div>

          {/* Right: Quick actions + Unified Config Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* If no provider is connected, prominent connect button */}
            {providers.length === 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setConnectingProvider(null);
                  setShowConnectModal(true);
                }}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors"
              >
                <QrCode className="h-3 w-3 mr-1" /> Conectar WhatsApp
              </Button>
            )}

            {/* Quick bulk send */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulk(true)}
              className="h-7 px-2.5 text-xs gap-1.5 hover:text-primary transition-colors"
              title="Disparo de Mensagens em Massa"
            >
              <Megaphone className="h-3 w-3 text-primary" />
              <span className="hidden sm:inline">Disparo</span>
            </Button>

            {/* Quick sync contacts */}
            {activeProvider && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => syncContacts(activeProvider.id)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Sincronizar contatos do WhatsApp"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* ⚙️ Configurar Bot & Infraestrutura Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5 font-medium">
                  <Settings2 className="h-3.5 w-3.5 text-primary" />
                  <span>⚙️ Configurar Bot</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-card border-border">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Infraestrutura & Chip
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setConnectingProvider(activeProvider || null);
                    setShowConnectModal(true);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <QrCode className="h-3.5 w-3.5 mr-2 text-emerald-400" /> Conectar / QR Code
                </DropdownMenuItem>
                {activeProvider && (
                  <DropdownMenuItem
                    onClick={() => importMessages(activeProvider.id)}
                    className="text-xs cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 mr-2 text-primary" /> Importar histórico (30 dias)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    setEditingProvider(activeProvider || null);
                    setShowProviderConfig(true);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Settings2 className="h-3.5 w-3.5 mr-2" /> Gerenciar Provedores
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Módulos de IA & Vendas
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setActiveTab("ai")} className="text-xs cursor-pointer">
                  <span className="mr-2">🤖</span> IA Autônoma (Prompt & Regras)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("triagem")} className="text-xs cursor-pointer">
                  <span className="mr-2">🎯</span> Triagem Inteligente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("objecoes")} className="text-xs cursor-pointer">
                  <span className="mr-2">📚</span> Matriz de Objeções
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("templates")} className="text-xs cursor-pointer">
                  <FileText className="h-3.5 w-3.5 mr-2" /> Templates de Resposta ({templates.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("campanhas")} className="text-xs cursor-pointer">
                  <Rocket className="h-3.5 w-3.5 mr-2" /> Campanhas & Disparos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("comandos")} className="text-xs cursor-pointer">
                  <span className="mr-2">⚡</span> Comandos Rápidos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("conversao")} className="text-xs cursor-pointer">
                  <span className="mr-2">📊</span> Funil de Conversão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("hub")} className="text-xs cursor-pointer">
                  <Radio className="h-3.5 w-3.5 mr-2" /> Hub Local (Baileys)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        /* Top bar when inside a technical tool: simple back banner */
        <div className="px-4 py-2 bg-secondary/50 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Button size="sm" variant="outline" onClick={() => setActiveTab("sessoes")} className="h-7 text-xs gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/10">
              ← Voltar ao Atendimento (Conversas)
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-foreground">{TAB_LABELS[activeTab]}</span>
          </div>
        </div>
      )}

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
                onSelect={(s) => { const session = sessions.find(row => row.id === s.id); if (!session) return; setSelectedSession(session); setChatTab("chat"); markRead(session.id); }}
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
                    <Avatar className="h-9 w-9 shrink-0">
                      {selectedSession.avatar_url && (
                        <AvatarImage
                          src={selectedSession.avatar_url}
                          alt={selectedSession.contact_name || selectedSession.phone}
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className={`text-xs font-bold text-white bg-gradient-to-br ${getAvatarGradient(selectedSession.id)}`}>
                        {getInitials(selectedSession.contact_name, selectedSession.phone)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-semibold truncate">{selectedSession.contact_name || selectedSession.phone}</h2>
                      <p className="text-[11px] text-muted-foreground">
                        📞 {selectedSession.phone} · {projectName(selectedSession.project_id)}
                        {selectedProvider && (
                          <span className="ml-1.5 text-[10px] opacity-70">
                            · via {selectedProvider.display_name || (selectedProvider.provider === "evolution" ? selectedProvider.instance_name : selectedProvider.twilio_from)}
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
                            .update({ ai_paused_until: newPausedUntil })
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
                          {selectedProvider.display_name || (selectedProvider.provider === "evolution" ? selectedProvider.instance_name : "Twilio")}
                        </Badge>
                      )}
                      <Tabs value={chatTab} onValueChange={(v) => { if (v === "chat" || v === "qrcode" || v === "info") setChatTab(v); }}>
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
                            intelPanelOpen={showIntelPanel}
                            onToggleIntelPanel={toggleIntelPanel}
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
                <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12 select-none bg-background/95 border-l border-border/40">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-primary/10 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                      <MessageSquare className="h-10 w-10 text-emerald-400" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center text-white text-[10px] font-bold">
                      ✓
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-foreground mb-1.5 tracking-tight">Imperium WhatsApp Hub</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
                    Selecione uma conversa ao lado para responder leads, analisar histórico e gerenciar o atendimento.
                  </p>

                  <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
                    <div className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm text-left">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Conversas</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{sessions.length}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm text-left">
                      <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Não Lidas</p>
                      <p className="text-lg font-bold text-emerald-400 mt-0.5">
                        {sessions.filter(s => (s.unread_count || 0) > 0).length}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm text-left">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Instâncias</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        {providers.filter(p => p.is_active).length}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5 shadow-sm">
                      <Plus className="h-4 w-4" /> Nova Sessão
                    </Button>
                    {sessions.some(s => (s.unread_count || 0) > 0) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const firstUnread = sessions.find(s => (s.unread_count || 0) > 0);
                          if (firstUnread) setSelectedSession(firstUnread);
                        }}
                        className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Abrir 1ª Não Lida
                      </Button>
                    )}
                  </div>
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

        {activeTab === "hub" && (
          <ScrollArea className="h-full">
            <HubLocalManager
              projects={projects}
              providers={providers}
              onOpenConversation={(convId) => {
                const target = sessions.find(s => s.id === convId);
                if (target) {
                  setSelectedSession(target);
                  setActiveTab("sessoes");
                }
              }}
            />
          </ScrollArea>
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
      <ConnectWhatsAppModal
        open={showConnectModal}
        onOpenChange={(open) => {
          setShowConnectModal(open);
          if (!open) setConnectingProvider(null);
        }}
        projects={projects}
        provider={connectingProvider}
        onSuccess={() => {
          load();
          loadReference();
        }}
      />
      <BulkSendDialog open={showBulk} onOpenChange={setShowBulk} providers={providers} templates={templates} />
    </div>
  );
}

// ── Evolution Status Card ──
function EvolutionStatusCard({ provider, projectName, projects, onSynced, onEdit, onConnect }: { provider: WaProvider; projectName: string; projects: { id: string; name: string }[]; onSynced: () => void; onEdit: (provider: WaProvider) => void; onConnect?: (provider: WaProvider) => void }) {
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
    } catch (err: unknown) { toast.error("Falha: " + errorMessage(err)); }
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
    } catch (err: unknown) { toast.error("Falha: " + errorMessage(err)); }
    setImportingMsgs(false);
  };

  const restartInstance = async () => {
    setRestarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=restart_instance", { body: { provider_id: provider.id } });
      if (error) throw error;
      if (record(data).success) { toast.success("Reconectando — abra o QR Code para escanear"); setTimeout(fetchStatus, 1500); }
      else toast.error("Falha ao reconectar");
    } catch (err: unknown) { toast.error("Erro: " + errorMessage(err)); }
    setRestarting(false);
  };

  const deleteProvider = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=delete_instance", { body: { provider_id: provider.id } });
      if (error) throw error;
      if (record(data).success) { toast.success("Provider removido"); onSynced(); }
      else toast.error("Falha ao remover");
    } catch (err: unknown) { toast.error("Erro: " + errorMessage(err)); }
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
              <span className="font-medium text-xs truncate">{provider.display_name || provider.instance_name}</span>
              {provider.display_name && <span className="text-[10px] text-muted-foreground/70 truncate">({provider.instance_name})</span>}
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
            <Button
              size="sm"
              onClick={() => onConnect?.(provider)}
              className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors"
            >
              <QrCode className="h-3 w-3 mr-1" />
              Conectar WhatsApp
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
              <DropdownMenuItem className="text-xs text-emerald-400 font-medium" onClick={() => onConnect?.(provider)}>
                <QrCode className="h-3 w-3 mr-2 text-emerald-400" /> Conectar via QR Code
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={restartInstance} disabled={restarting}>
                <Power className="h-3 w-3 mr-2" /> Reiniciar Instância
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
function AlertControls({ provider, onChanged }: { provider: WaProvider; onChanged: () => void }) {
  const enabled = provider.health_alerts_enabled !== false;
  const mutedUntil = provider.health_alerts_muted_until ? new Date(provider.health_alerts_muted_until) : null;
  const isMuted = mutedUntil && mutedUntil.getTime() > Date.now();
  const active = enabled && !isMuted;

  const update = async (patch: TablesUpdate<"imphq_wa_providers">, msg: string) => {
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
function MetaCloudStatusCard({ provider, projectName, projects, onSynced, onEdit }: { provider: WaProvider; projectName: string; projects: { id: string; name: string }[]; onSynced: () => void; onEdit: (provider: WaProvider) => void }) {
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
      if (record(data).success) {
        toast.success("Provider Oficial Meta removido");
        onSynced();
      } else {
        toast.error("Falha ao remover");
      }
    } catch (err: unknown) {
      toast.error("Erro ao remover: " + errorMessage(err));
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
