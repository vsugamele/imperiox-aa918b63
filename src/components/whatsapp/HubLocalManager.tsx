import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useWaSession, UiStatus } from "@/hooks/useWaSession";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Radio,
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Copy,
  ChevronDown,
  MessageSquare,
  Search,
  Sparkles,
  Phone,
  Clock,
  Terminal,
  Cpu,
  Layers,
  HelpCircle,
  RotateCcw,
  Bug,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import ChatView from "@/components/whatsapp/ChatView";
import { groupHubMessages, HubMessage } from "@/components/whatsapp/hub-conversations";

interface HubLocalSession {
  id: string;
  session_key: string;
  tenant_id: string;
  status: string;
  last_seen_at: string | null;
  updated_at: string;
}

interface HubLocalCommand {
  id: string;
  action: string;
  session_key: string;
  status: string;
  error: string | null;
  created_at: string;
}

interface HubLocalManagerProps {
  projects: { id: string; name: string }[];
  providers?: any[];
  onOpenConversation?: (conversationId: string) => void;
}

const statusConfig: Record<UiStatus, { label: string; color: string; icon: typeof Wifi }> = {
  idle: { label: "Inativo", color: "bg-muted text-muted-foreground border-border", icon: WifiOff },
  pending: { label: "Enviando comando...", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Loader2 },
  awaiting_qr: { label: "Gerando QR Code...", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Loader2 },
  qr_ready: { label: "QR Pronto para Escanear", color: "bg-[#D6FF4B]/15 text-[#D6FF4B] border-[#D6FF4B]/30", icon: QrCode },
  connected: { label: "Conectado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Wifi },
  stale: { label: "Sessão Travada", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: AlertCircle },
  error: { label: "Falha de Conexão", color: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertCircle },
  resetting: { label: "Limpando Sessão...", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Loader2 },
};

export default function HubLocalManager({ projects, onOpenConversation }: HubLocalManagerProps) {
  // Navigation tabs inside Hub
  const [hubTab, setHubTab] = useState<"qr" | "sessoes" | "mensagens" | "worker">("qr");

  // Sessions state from Supabase
  const [sessions, setSessions] = useState<HubLocalSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Commands & Messages
  const [recentCommands, setRecentCommands] = useState<HubLocalCommand[]>([]);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Pick<Tables<"imphq_wa_conversations">, "id" | "phone" | "project_id" | "provider_id"> | null>(null);

  // Pairing terminal state
  const [pairingTenantId, setPairingTenantId] = useState("default");
  const [pairingProjectId, setPairingProjectId] = useState<string>(projects[0]?.id || "global");
  const [pairingSessionKey, setPairingSessionKey] = useState<string>(() => `baileys-${Math.floor(1000 + Math.random() * 9000)}`);
  const [showAdvancedPairing, setShowAdvancedPairing] = useState(false);
  const [showDiag, setShowDiag] = useState(false);

  // Filtering & Search
  const [searchSession, setSearchSession] = useState("");
  const [filterSessionStatus, setFilterSessionStatus] = useState<"all" | "connected" | "offline">("all");
  const [hubFilterProject, setHubFilterProject] = useState("all");

  // Deletion modals
  const [sessionToDelete, setSessionToDelete] = useState<HubLocalSession | null>(null);
  const [cleaningOffline, setCleaningOffline] = useState(false);
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);

  // Active hook for the session currently selected in pairing terminal
  const {
    uiStatus,
    qrImageUrl,
    qrText,
    errorMessage,
    canGenerateQr,
    startGetQr,
    resetSession,
    sessionRawStatus,
    diagnostics,
  } = useWaSession({
    tenantId: pairingTenantId,
    sessionKey: pairingSessionKey || "default-session",
    project: pairingProjectId,
  });

  const cfg = statusConfig[uiStatus];
  const StatusIcon = cfg.icon;

  // Load all sessions & recent activity
  const loadData = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const [sessRes, cmdRes, msgRes] = await Promise.all([
        supabase.from("wa_hub_iso_sessions").select("id, session_key, tenant_id, status, last_seen_at, updated_at").order("updated_at", { ascending: false }),
        supabase.from("wa_hub_iso_commands").select("id, action, session_key, status, error, created_at").order("created_at", { ascending: false }).limit(12),
        supabase.from("imphq_wa_messages").select("id, phone, content, created_at, project_id, conversation_id").order("created_at", { ascending: false }).limit(100),
      ]);

      if (sessRes.data) setSessions(sessRes.data);
      if (cmdRes.data) setRecentCommands(cmdRes.data as HubLocalCommand[]);
      if (msgRes.data) setMessages(msgRes.data as HubMessage[]);
    } catch (err) {
      console.error("Erro ao carregar dados do Hub Local:", err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // When UI transitions to connected, refresh sessions
  useEffect(() => {
    if (uiStatus === "connected") {
      loadData();
      toast.success(`WhatsApp conectado com sucesso na sessão ${pairingSessionKey}!`);
    }
  }, [uiStatus, pairingSessionKey, loadData]);

  // Auto-generate a clean session key based on project
  const handleSuggestKey = (projId: string) => {
    const proj = projects.find(p => p.id === projId);
    const slug = proj ? proj.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 12) : "instancia";
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setPairingSessionKey(`${slug}-${randomSuffix}`);
  };

  // Helper to resolve project name
  const getProjectName = (projId?: string | null) => {
    if (!projId || projId === "global" || projId === "all") return "Geral / Não Vinculado";
    return projects.find(p => p.id === projId)?.name || projId;
  };

  // Delete a single session and its events/commands
  const executeDeleteSession = async (session: HubLocalSession) => {
    try {
      await Promise.all([
        supabase.from("wa_hub_iso_events").delete().eq("tenant_id", session.tenant_id).eq("session_key", session.session_key),
        supabase.from("wa_hub_iso_commands").delete().eq("tenant_id", session.tenant_id).eq("session_key", session.session_key),
      ]);
      const { error } = await supabase.from("wa_hub_iso_sessions").delete().eq("id", session.id);
      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== session.id));
      toast.success(`Instância ${session.session_key} removida.`);

      if (pairingSessionKey === session.session_key) {
        handleSuggestKey(pairingProjectId);
      }
    } catch (err: any) {
      toast.error("Falha ao remover sessão: " + (err.message || "Erro desconhecido"));
    } finally {
      setSessionToDelete(null);
    }
  };

  // Batch clean all offline/stale sessions
  const cleanOfflineSessions = async () => {
    const offline = sessions.filter(s => s.status !== "connected");
    if (offline.length === 0) {
      toast.info("Nenhuma instância offline para limpar.");
      return;
    }
    setCleaningOffline(true);
    let removed = 0;
    try {
      for (const s of offline) {
        await Promise.all([
          supabase.from("wa_hub_iso_events").delete().eq("tenant_id", s.tenant_id).eq("session_key", s.session_key),
          supabase.from("wa_hub_iso_commands").delete().eq("tenant_id", s.tenant_id).eq("session_key", s.session_key),
          supabase.from("wa_hub_iso_sessions").delete().eq("id", s.id),
        ]);
        removed++;
      }
      toast.success(`${removed} instâncias offline foram limpas.`);
      await loadData();
    } catch (err: any) {
      toast.error("Erro durante a limpeza: " + (err.message || ""));
    } finally {
      setCleaningOffline(false);
      setConfirmCleanOpen(false);
    }
  };

  // Select an existing session to reconnect/view QR
  const handleSelectToPair = (session: HubLocalSession) => {
    setPairingSessionKey(session.session_key);
    setPairingTenantId(session.tenant_id);
    setHubTab("qr");
    toast.info(`Instância "${session.session_key}" carregada no terminal. Clique em Gerar QR Code.`);
  };

  // Metrics
  const connectedCount = useMemo(() => sessions.filter(s => s.status === "connected").length, [sessions]);
  const offlineCount = useMemo(() => sessions.filter(s => s.status !== "connected").length, [sessions]);
  const pendingCommandsCount = useMemo(() => recentCommands.filter(c => c.status === "pending").length, [recentCommands]);

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchSearch = s.session_key.toLowerCase().includes(searchSession.toLowerCase()) || s.tenant_id.toLowerCase().includes(searchSession.toLowerCase());
      if (!matchSearch) return false;
      if (filterSessionStatus === "connected") return s.status === "connected";
      if (filterSessionStatus === "offline") return s.status !== "connected";
      return true;
    });
  }, [sessions, searchSession, filterSessionStatus]);

  // Grouped Hub Messages
  const groupedMessages = useMemo(() => {
    let result = groupHubMessages(messages);
    if (hubFilterProject !== "all") {
      result = result.filter(g => g.projectId === hubFilterProject);
    }
    return result;
  }, [messages, hubFilterProject]);

  const showResetButton =
    ["stale", "error", "connected", "qr_ready"].includes(uiStatus) ||
    diagnostics.hasSession === true ||
    diagnostics.reason === "qr_timeout" ||
    (uiStatus === "idle" && sessionRawStatus === "connected");

  // Render conversation full chat if selected
  if (selectedConversation) {
    return (
      <div className="h-full flex flex-col p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1B1E23] pb-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedConversation(null)} className="text-xs text-muted-foreground hover:text-foreground">
            ← Voltar para o Hub Local
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs border-[#1B1E23] text-[#D6FF4B]">
              📱 {selectedConversation.phone}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {getProjectName(selectedConversation.project_id)}
            </Badge>
          </div>
        </div>
        <div className="flex-1 bg-[#0E1013] border border-[#1B1E23] rounded-xl overflow-hidden shadow-xl">
          <ChatView
            conversationId={selectedConversation.id}
            phone={selectedConversation.phone}
            projectId={selectedConversation.project_id || ""}
            providerId={selectedConversation.provider_id}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* ── TOP EXECUTIVE BANNER & KPIS ── */}
      <div className="bg-[#0E1013] border border-[#1B1E23] rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D6FF4B]/10 border border-[#D6FF4B]/20 flex items-center justify-center">
                <Radio className="h-4 w-4 text-[#D6FF4B]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white tracking-tight">Hub Local (Baileys)</h2>
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    Command Bus ISO
                  </Badge>
                </div>
                <p className="text-xs text-[#8A8F98]">
                  Gateway de conexão direta via Baileys. Opera com instâncias locais isoladas com controle de QR Code, automação e mensageria.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              disabled={loadingSessions}
              className="h-8 text-xs border-[#1B1E23] bg-background hover:bg-secondary/40 text-muted-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingSessions ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            {offlineCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmCleanOpen(true)}
                disabled={cleaningOffline}
                className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Limpar Offline ({offlineCount})
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                handleSuggestKey(pairingProjectId);
                setHubTab("qr");
              }}
              className="h-8 text-xs bg-[#D6FF4B] text-black font-semibold hover:bg-[#c2eb3d] shadow-sm"
            >
              <QrCode className="h-3.5 w-3.5 mr-1.5" />
              + Nova Conexão QR
            </Button>
          </div>
        </div>

        {/* 4 Metric Pill Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-[#0A0B0D] border border-[#1B1E23] rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-[#8A8F98] tracking-wider">Conectadas</p>
              <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{connectedCount}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="relative flex h-2.5 w-2.5">
                {connectedCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connectedCount > 0 ? "bg-emerald-400" : "bg-muted-foreground"}`}></span>
              </span>
            </div>
          </div>

          <div className="bg-[#0A0B0D] border border-[#1B1E23] rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-[#8A8F98] tracking-wider">Total Instâncias</p>
              <p className="text-lg font-bold font-mono text-foreground mt-0.5">{sessions.length}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Cpu className="h-4 w-4 text-blue-400" />
            </div>
          </div>

          <div className="bg-[#0A0B0D] border border-[#1B1E23] rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-[#8A8F98] tracking-wider">Desconectadas</p>
              <p className="text-lg font-bold font-mono text-amber-400 mt-0.5">{offlineCount}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <WifiOff className="h-4 w-4 text-amber-400" />
            </div>
          </div>

          <div className="bg-[#0A0B0D] border border-[#1B1E23] rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-[#8A8F98] tracking-wider">Fila de Comandos</p>
              <p className="text-lg font-bold font-mono text-muted-foreground mt-0.5">
                {pendingCommandsCount > 0 ? (
                  <span className="text-amber-400">{pendingCommandsCount} pendente(s)</span>
                ) : (
                  <span className="text-emerald-400 text-sm">Pronto · 0 pend.</span>
                )}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE TABS ── */}
      <div className="flex border-b border-[#1B1E23] bg-[#0E1013] rounded-t-xl px-2">
        <button
          onClick={() => setHubTab("qr")}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            hubTab === "qr" ? "border-[#D6FF4B] text-[#D6FF4B]" : "border-transparent text-[#8A8F98] hover:text-foreground"
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          Terminal QR & Pareamento
        </button>

        <button
          onClick={() => setHubTab("sessoes")}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            hubTab === "sessoes" ? "border-[#D6FF4B] text-[#D6FF4B]" : "border-transparent text-[#8A8F98] hover:text-foreground"
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Instâncias & Chips ({sessions.length})
        </button>

        <button
          onClick={() => setHubTab("mensagens")}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            hubTab === "mensagens" ? "border-[#D6FF4B] text-[#D6FF4B]" : "border-transparent text-[#8A8F98] hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Mensagens do Hub ({groupedMessages.length})
        </button>

        <button
          onClick={() => setHubTab("worker")}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            hubTab === "worker" ? "border-[#D6FF4B] text-[#D6FF4B]" : "border-transparent text-[#8A8F98] hover:text-foreground"
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Worker Local & Diagnóstico
        </button>
      </div>

      {/* ── TAB 1: TERMINAL QR & PAREAMENTO ── */}
      {hubTab === "qr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Configuration Form */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="bg-[#0E1013] border-[#1B1E23]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-[#D6FF4B]" />
                  1. Configurar Instância Baileys
                </CardTitle>
                <CardDescription className="text-xs text-[#8A8F98]">
                  Selecione o projeto e identifique o chip para iniciar o pareamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Projeto */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Projeto do Ecossistema</Label>
                  <Select
                    value={pairingProjectId}
                    onValueChange={(val) => {
                      setPairingProjectId(val);
                      handleSuggestKey(val);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-[#0A0B0D] border-[#1B1E23]">
                      <SelectValue placeholder="Selecione o Projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">🌐 Geral / Sem Projeto Específico</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Session Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Nome da Instância (Session Key)</Label>
                    <button
                      onClick={() => handleSuggestKey(pairingProjectId)}
                      className="text-[11px] text-[#D6FF4B] hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Gerar Novo
                    </button>
                  </div>
                  <Input
                    value={pairingSessionKey}
                    onChange={(e) => setPairingSessionKey(e.target.value.toLowerCase().replace(/[^a-z0-9-_.]/g, ""))}
                    placeholder="ex: chip-slimsoda-01"
                    className="h-9 text-xs font-mono bg-[#0A0B0D] border-[#1B1E23]"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Identificador único gravado no isolamento do Baileys e no banco de dados.
                  </p>
                </div>

                {/* Status da Sessão no Form */}
                <div className="bg-[#0A0B0D] border border-[#1B1E23] rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">Status Atual</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{cfg.label}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                    <StatusIcon className={`h-3.5 w-3.5 mr-1 ${["pending", "awaiting_qr", "resetting"].includes(uiStatus) ? "animate-spin" : ""}`} />
                    {uiStatus}
                  </Badge>
                </div>

                {/* Advanced Settings (Tenant) */}
                <Collapsible open={showAdvancedPairing} onOpenChange={setShowAdvancedPairing}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] w-full justify-between text-muted-foreground p-0 hover:bg-transparent">
                      <span>Configurações Avançadas (Tenant)</span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedPairing ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-2">
                    <div className="p-3 bg-[#0A0B0D] border border-[#1B1E23] rounded-lg space-y-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Tenant ID</Label>
                        <Input
                          value={pairingTenantId}
                          onChange={(e) => setPairingTenantId(e.target.value)}
                          placeholder="default"
                          className="h-8 text-xs font-mono bg-[#0E1013] border-[#1B1E23] mt-1"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Utilizado para isolar múltiplos ambientes ou clientes no mesmo banco. Padrão: <code>default</code>.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    onClick={startGetQr}
                    disabled={!canGenerateQr || !pairingSessionKey.trim()}
                    className="w-full h-9 text-xs bg-[#D6FF4B] text-black font-semibold hover:bg-[#c2eb3d] transition-all"
                  >
                    {uiStatus === "pending" || uiStatus === "awaiting_qr" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Comunicando com Worker Local...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 mr-2" />
                        Gerar QR Code Agora
                      </>
                    )}
                  </Button>

                  {showResetButton && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await resetSession();
                        toast.success("Sessão limpa com sucesso. Pronto para novo QR.");
                      }}
                      className="w-full h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Forçar Limpeza / Reset da Instância
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Guia Rápido Mobile */}
            <div className="bg-[#0E1013] border border-[#1B1E23] rounded-xl p-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <ShieldCheck className="h-4 w-4 text-[#D6FF4B]" />
                Instruções de Conexão no Celular:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                <li>Abra o aplicativo <strong>WhatsApp</strong> no celular do chip.</li>
                <li>Acesse <strong>Configurações</strong> &gt; <strong>Aparelhos Conectados</strong>.</li>
                <li>Toque no botão <strong>Conectar um Aparelho</strong>.</li>
                <li>Aponte a câmera para o QR Code exibido ao lado.</li>
              </ol>
            </div>
          </div>

          {/* Right: The High-Tech QR Terminal */}
          <div className="lg:col-span-7 flex flex-col">
            <Card className="bg-[#0E1013] border-[#1B1E23] flex-1 flex flex-col">
              <CardHeader className="pb-3 border-b border-[#1B1E23]">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-[#D6FF4B]" />
                    2. Terminal de Leitura do QR Code
                  </CardTitle>
                  <Badge variant="outline" className={`font-mono text-[10px] ${cfg.color}`}>
                    {cfg.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
                {/* 1. RESETTING */}
                {uiStatus === "resetting" && (
                  <div className="w-[300px] h-[300px] flex flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-3">
                    <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
                    <div>
                      <p className="text-sm font-semibold text-amber-400">Limpando Sessão no Banco</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expurgando eventos e comandos obsoletos de <code>{pairingSessionKey}</code>...
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. PENDING / AWAITING WORKER */}
                {(uiStatus === "pending" || uiStatus === "awaiting_qr") && (
                  <div className="w-[300px] h-[300px] flex flex-col items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6 text-center space-y-3">
                    <div className="relative">
                      <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                      <Cpu className="h-5 w-5 text-blue-300 absolute inset-0 m-auto" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-400">
                        {uiStatus === "pending" ? "Aguardando Worker Local..." : "Gerando Imagem do QR..."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        Comando <code>get_qr</code> enviado para <code>wa_hub_iso_commands</code>. O processo Node local está gerando o par de chaves.
                      </p>
                      {diagnostics.pollCount && diagnostics.pollCount > 10 && (
                        <p className="text-[10px] text-amber-400 mt-2 font-mono">
                          {diagnostics.pollCount} tentativas · Verifique se o worker local está rodando no terminal.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. QR READY (IMAGE) */}
                {uiStatus === "qr_ready" && qrImageUrl && (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative p-3 bg-white rounded-2xl border-2 border-[#D6FF4B] shadow-[0_0_25px_rgba(214,255,75,0.25)]">
                      <img
                        src={
                          qrImageUrl.startsWith("data:")
                            ? qrImageUrl
                            : qrImageUrl.startsWith("http")
                            ? qrImageUrl
                            : `data:image/png;base64,${qrImageUrl}`
                        }
                        alt="QR Code WhatsApp"
                        className="w-[280px] h-[280px] object-contain rounded-lg"
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-semibold text-[#D6FF4B] flex items-center justify-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D6FF4B] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D6FF4B]"></span>
                        </span>
                        Aguardando leitura pelo WhatsApp no celular...
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Instância: <code className="text-foreground">{pairingSessionKey}</code> · Atualiza automaticamente após o scan.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. QR READY (TEXT ONLY FALLBACK) */}
                {uiStatus === "qr_ready" && !qrImageUrl && qrText && (
                  <div className="w-[300px] p-5 bg-[#0A0B0D] rounded-2xl border border-[#1B1E23] space-y-3 text-center">
                    <p className="text-xs font-semibold text-foreground">Código de Pareamento Textual:</p>
                    <div className="p-3 bg-[#0E1013] rounded border border-[#1B1E23] font-mono text-[11px] break-all select-all text-[#D6FF4B]">
                      {qrText}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-[#1B1E23]"
                      onClick={() => {
                        navigator.clipboard.writeText(qrText);
                        toast.success("Código copiado!");
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1.5" /> Copiar Código
                    </Button>
                  </div>
                )}

                {/* 5. CONNECTED */}
                {uiStatus === "connected" && (
                  <div className="w-[320px] p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-center space-y-4 shadow-lg">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                      <CheckCircle2 className="h-9 w-9" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-emerald-400">WhatsApp Conectado!</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sessão <strong className="text-foreground">{pairingSessionKey}</strong> ativa e autenticada no Baileys.
                      </p>
                    </div>
                    <div className="p-2.5 bg-[#0A0B0D] rounded-lg border border-[#1B1E23] text-left text-[11px] space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Projeto:</span>
                        <span className="text-foreground">{getProjectName(pairingProjectId)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tenant:</span>
                        <span className="text-foreground">{pairingTenantId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Protocolo:</span>
                        <span className="text-emerald-400">Baileys Direct</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setHubTab("mensagens")}
                        className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Ver Mensagens
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await resetSession();
                          handleSuggestKey(pairingProjectId);
                        }}
                        className="h-8 text-xs border-emerald-500/30 text-muted-foreground hover:text-foreground"
                      >
                        Nova Conexão
                      </Button>
                    </div>
                  </div>
                )}

                {/* 6. STALE */}
                {uiStatus === "stale" && (
                  <div className="w-[320px] p-6 bg-orange-500/5 rounded-2xl border border-orange-500/20 text-center space-y-3">
                    <AlertTriangle className="h-10 w-10 text-orange-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-400">Sessão Travada ou Expirada</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        O worker não retornou QR Code a tempo ou o pairing anterior foi interrompido.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          await resetSession();
                          startGetQr();
                        }}
                        className="h-8 text-xs bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border border-orange-500/40"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Tentar Novamente
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSuggestKey(pairingProjectId)}
                        className="h-8 text-xs border-[#1B1E23]"
                      >
                        Nova Session Key
                      </Button>
                    </div>
                  </div>
                )}

                {/* 7. ERROR */}
                {uiStatus === "error" && (
                  <div className="w-[320px] p-6 bg-destructive/5 rounded-2xl border border-destructive/20 text-center space-y-3">
                    <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                    <div>
                      <h4 className="text-sm font-semibold text-destructive">Falha na Comunicação</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {errorMessage || "Não foi possível obter resposta do worker Baileys."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await resetSession();
                      }}
                      className="h-8 text-xs border-destructive/30 text-destructive"
                    >
                      Limpar e Reiniciar
                    </Button>
                  </div>
                )}

                {/* 8. IDLE */}
                {uiStatus === "idle" && (
                  <div className="w-[300px] h-[300px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1B1E23] p-6 text-center space-y-3 bg-[#0A0B0D]/50">
                    <div className="w-12 h-12 rounded-full bg-secondary/30 flex items-center justify-center text-muted-foreground">
                      <QrCode className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Terminal Pronto</p>
                      <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                        Defina o nome da instância à esquerda e clique no botão <strong>"Gerar QR Code Agora"</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Diagnostics Toggle */}
                {(sessionRawStatus || diagnostics.commandStatus || uiStatus === "stale" || uiStatus === "error") && (
                  <Collapsible open={showDiag} onOpenChange={setShowDiag} className="w-full max-w-sm pt-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full text-muted-foreground gap-1 justify-center">
                        <Bug className="h-3 w-3" />
                        {showDiag ? "Ocultar Diagnóstico" : "Ver Diagnóstico do Command Bus"}
                        <ChevronDown className={`h-3 w-3 transition-transform ${showDiag ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-3 bg-[#0A0B0D] rounded-lg border border-[#1B1E23] text-[10px] font-mono space-y-1">
                        {sessionRawStatus && <div>session.status: <span className="text-[#D6FF4B]">{sessionRawStatus}</span></div>}
                        {diagnostics.commandStatus && <div>command.status: <span className="text-blue-400">{diagnostics.commandStatus}</span></div>}
                        {diagnostics.hasSession !== undefined && <div>hasSession: <span className={diagnostics.hasSession ? "text-emerald-400" : "text-destructive"}>{String(diagnostics.hasSession)}</span></div>}
                        {diagnostics.qrAvailable !== undefined && <div>qrAvailable: <span className="text-primary">{String(diagnostics.qrAvailable)}</span></div>}
                        {diagnostics.reason && <div className="text-destructive">reason: {diagnostics.reason}</div>}
                        {diagnostics.pollCount !== undefined && <div>polls: {diagnostics.pollCount}</div>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 2: INSTÂNCIAS & CHIPS ── */}
      {hubTab === "sessoes" && (
        <Card className="bg-[#0E1013] border-[#1B1E23]">
          <CardHeader className="pb-3 border-b border-[#1B1E23]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-[#D6FF4B]" />
                  Instâncias Cadastradas no Hub
                </CardTitle>
                <CardDescription className="text-xs text-[#8A8F98]">
                  Todas as instâncias locais Baileys persistidas no Supabase.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-48">
                  <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={searchSession}
                    onChange={(e) => setSearchSession(e.target.value)}
                    placeholder="Buscar sessão..."
                    className="h-8 pl-8 text-xs bg-[#0A0B0D] border-[#1B1E23]"
                  />
                </div>

                <Select value={filterSessionStatus} onValueChange={(v: any) => setFilterSessionStatus(v)}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-[#0A0B0D] border-[#1B1E23]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas ({sessions.length})</SelectItem>
                    <SelectItem value="connected">Conectadas ({connectedCount})</SelectItem>
                    <SelectItem value="offline">Offline ({offlineCount})</SelectItem>
                  </SelectContent>
                </Select>

                {offlineCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmCleanOpen(true)}
                    className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Limpar Offline
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredSessions.length > 0 ? (
              <div className="divide-y divide-[#1B1E23]">
                {filteredSessions.map((s) => {
                  const isConnected = s.status === "connected";
                  return (
                    <div
                      key={s.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#0A0B0D]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                            isConnected
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-muted/30 border-[#1B1E23] text-muted-foreground"
                          }`}
                        >
                          {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold font-mono text-foreground">{s.session_key}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono ${
                                isConnected
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-[#1B1E23]"
                              }`}
                            >
                              {isConnected ? "● Conectada" : "○ Offline"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Tenant: <code className="text-foreground">{s.tenant_id}</code> · Atualizado:{" "}
                            {s.updated_at ? new Date(s.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Session Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectToPair(s)}
                          className="h-7 text-xs border-[#1B1E23] hover:border-[#D6FF4B]/40 hover:text-[#D6FF4B]"
                        >
                          <QrCode className="h-3 w-3 mr-1" />
                          {isConnected ? "Gerenciar / QR" : "Parear Novamente"}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSessionToDelete(s)}
                          className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 px-4 space-y-3">
                <Cpu className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma instância encontrada com os filtros atuais.</p>
                <Button
                  size="sm"
                  onClick={() => {
                    handleSuggestKey(pairingProjectId);
                    setHubTab("qr");
                  }}
                  className="h-8 text-xs bg-[#D6FF4B] text-black font-semibold hover:bg-[#c2eb3d]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar Primeira Instância
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 3: MENSAGENS & CONVERSAS DO HUB ── */}
      {hubTab === "mensagens" && (
        <Card className="bg-[#0E1013] border-[#1B1E23]">
          <CardHeader className="pb-3 border-b border-[#1B1E23]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#D6FF4B]" />
                  Mensagens Roteadas pelo Hub
                </CardTitle>
                <CardDescription className="text-xs text-[#8A8F98]">
                  Histórico de mensagens sincronizadas via instâncias locais Baileys.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Select value={hubFilterProject} onValueChange={setHubFilterProject}>
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-[#0A0B0D] border-[#1B1E23]">
                    <SelectValue placeholder="Filtrar por projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Projetos</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {groupedMessages.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedMessages.map((g) => (
                  <Card
                    key={g.conversationId || g.phone}
                    className="bg-[#0A0B0D] border-[#1B1E23] hover:border-[#D6FF4B]/30 cursor-pointer transition-all hover:scale-[1.01]"
                    onClick={async () => {
                      if (!g.conversationId) {
                        toast.error("Esta mensagem não possui conversa vinculada.");
                        return;
                      }
                      const { data, error } = await supabase
                        .from("imphq_wa_conversations")
                        .select("id, phone, project_id, provider_id")
                        .eq("id", g.conversationId)
                        .maybeSingle();

                      if (error || !data) {
                        toast.error("Não foi possível abrir a conversa vinculada.");
                        return;
                      }
                      setSelectedConversation(data);
                    }}
                  >
                    <CardContent className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#D6FF4B]/10 border border-[#D6FF4B]/20 flex items-center justify-center text-[#D6FF4B]">
                            <Phone className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-semibold font-mono text-foreground">{g.phone}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono border-[#1B1E23]">
                          {g.count} msgs
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-2 bg-[#0E1013] p-2 rounded border border-[#1B1E23]/60">
                        {g.lastMsg || "Sem texto..."}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span>{getProjectName(g.projectId)}</span>
                        <span>{new Date(g.lastAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 space-y-2">
                <MessageSquare className="h-9 w-9 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa registrada pelo Hub ainda.</p>
                <p className="text-xs text-muted-foreground/70">
                  Conecte uma instância via QR Code e envie ou receba uma mensagem para vê-la aqui.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 4: WORKER LOCAL & DIAGNÓSTICO ── */}
      {hubTab === "worker" && (
        <div className="space-y-4">
          {/* Quickstart Box */}
          <Card className="bg-[#0E1013] border-[#1B1E23]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#D6FF4B]" />
                Como Executar o Worker Local Baileys
              </CardTitle>
              <CardDescription className="text-xs text-[#8A8F98]">
                O worker é o processo Node.js que escuta a fila de comandos e mantém os WebSockets do WhatsApp ativos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-foreground font-medium">1. Comando para iniciar o Worker:</p>
                <div className="p-3 bg-[#0A0B0D] rounded-lg border border-[#1B1E23] flex items-center justify-between font-mono text-xs text-[#D6FF4B]">
                  <code>node scripts/wa-worker.js</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-muted-foreground hover:text-white"
                    onClick={() => {
                      navigator.clipboard.writeText("node scripts/wa-worker.js");
                      toast.success("Comando copiado!");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3 bg-[#0A0B0D] rounded-lg border border-[#1B1E23] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-[10px]">1</span>
                    Fila de Comandos
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <code>wa_hub_iso_commands</code> recebe ações da UI (<code>get_qr</code>, <code>send_message</code>, <code>reset</code>).
                  </p>
                </div>

                <div className="p-3 bg-[#0A0B0D] rounded-lg border border-[#1B1E23] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                    Execução Baileys
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O worker consome a fila a cada 2-3s e conecta diretamente ao protocolo socket do WhatsApp.
                  </p>
                </div>

                <div className="p-3 bg-[#0A0B0D] rounded-lg border border-[#1B1E23] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center text-[10px]">3</span>
                    Eventos & Status
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Resultados e QR codes são gravados em <code>wa_hub_iso_events</code> para renderização imediata na UI.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Command Feed */}
          <Card className="bg-[#0E1013] border-[#1B1E23]">
            <CardHeader className="pb-3 border-b border-[#1B1E23]">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#D6FF4B]" />
                Fila de Comandos Recentes (wa_hub_iso_commands)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentCommands.length > 0 ? (
                <div className="divide-y divide-[#1B1E23] text-xs font-mono">
                  {recentCommands.map((c) => (
                    <div key={c.id} className="p-3 flex items-center justify-between hover:bg-[#0A0B0D]/50">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            c.status === "done" || c.status === "success"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.status === "pending"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}
                        >
                          {c.status}
                        </Badge>
                        <span className="text-foreground font-semibold">{c.action}</span>
                        <span className="text-muted-foreground">({c.session_key})</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-6 text-center text-xs text-muted-foreground">Fila de comandos limpa.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MODAL: CONFIRMAR EXCLUSÃO INDIVIDUAL ── */}
      <AlertDialog open={Boolean(sessionToDelete)} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent className="bg-[#0E1013] border-[#1B1E23]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold text-white">
              Remover Instância {sessionToDelete?.session_key}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta ação irá apagar a sessão, todos os comandos pendentes e os eventos do QR Code gravados no banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs border-[#1B1E23]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToDelete && executeDeleteSession(sessionToDelete)}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── MODAL: CONFIRMAR LIMPEZA DE TODAS AS OFFLINE ── */}
      <AlertDialog open={confirmCleanOpen} onOpenChange={setConfirmCleanOpen}>
        <AlertDialogContent className="bg-[#0E1013] border-[#1B1E23]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold text-white">
              Limpar todas as {offlineCount} instâncias offline?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Todas as sessões que não estão atualmente conectadas serão removidas do Supabase junto com seus logs de eventos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs border-[#1B1E23]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={cleanOfflineSessions}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Limpar Offline Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
