import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Instagram, MessageSquare, Settings2, Trash2, Eye, EyeOff, Mail,
  Send, RefreshCw, Loader2, Sparkles, CheckCircle2, HelpCircle,
  Clock, ShieldAlert, Heart, User, Filter, AlertCircle, Bot,
  Workflow, Zap, ArrowRight, Check, Play, Square, Info, ExternalLink
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface IgAccount {
  id: string;
  project_id: string;
  ig_user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
}

interface IgConversation {
  id: string;
  account_id: string;
  participant_id: string;
  participant_username: string | null;
  participant_name: string | null;
  participant_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  ai_paused: boolean;
  ai_paused_reason: string | null;
  // Triage data (loaded separately, merged)
  triage_intent?: string | null;
  triage_fit_score?: number | null;
}

interface IgMessage {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  type: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  status: string;
  ai_generated?: boolean;
  feedback?: string | null;
  feedback_correction?: string | null;
}

interface IgComment {
  id: string;
  account_id: string;
  media_id: string;
  comment_id: string;
  from_username: string;
  text: string;
  is_hidden: boolean;
  replied: boolean;
  reply_text: string | null;
  created_at: string;
}

export default function InstagramPage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => localStorage.getItem("ig.selectedProject") || "");
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<IgAccount | null>(null);
  
  // Tab control
  const [activeMainTab, setActiveMainTab] = useState<"dms" | "comments" | "brain" | "triggers" | "funil" | "sequencias">("dms");
  
  // DMs state
  const [conversations, setConversations] = useState<IgConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<IgConversation | null>(null);
  const [messages, setMessages] = useState<IgMessage[]>([]);
  const [composedMsg, setComposedMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Simulation states
  const [showSimulateDialog, setShowSimulateDialog] = useState(false);
  const [simUsername, setSimUsername] = useState("bruno_test");
  const [simName, setSimName] = useState("Bruno Teste");
  const [simMessage, setSimMessage] = useState("");
  const [simLoading, setSimLoading] = useState(false);

  // Comments state
  const [comments, setComments] = useState<IgComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [privateReplyInputs, setPrivateReplyInputs] = useState<Record<string, string>>({});
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [showPrivateModal, setShowPrivateModal] = useState<string | null>(null);
  
  // Comment Triggers state
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(false);
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    trigger_keyword: "",
    post_id: "all",
    reply_comment_template: "",
    send_dm_template: "",
    is_active: true
  });

  // AI Brain state
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // DM search & templates
  const [convSearch, setConvSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  // Real telemetry state
  const [aiStats, setAiStats] = useState({ totalMsgs: 0, autoReplied: 0, handoffs: 0, ragHitRate: 0, loading: true });

  // Profile backfill state
  const [backfilling, setBackfilling] = useState(false);

  // Business hours state
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [showBusinessHours, setShowBusinessHours] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursForm, setHoursForm] = useState({
    enabled: true,
    open_time: "08:00",
    close_time: "18:00",
    days_of_week: [1,2,3,4,5] as number[],
    outside_hours_message: "Nosso atendimento acontece de segunda a sexta, das 8h às 18h. Deixe sua mensagem e te respondemos em breve! 😊",
    pause_ai_outside_hours: false,
  });

  const runProfileBackfill = async () => {
    if (!selectedAccount) return;
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("ig-profile-backfill", {
        body: { account_id: selectedAccount.id },
      });
      if (error) throw error;
      toast.success(`Backfill concluído! ${data?.updated || 0} perfis atualizados.`);
      loadConversations(selectedAccount.id);
    } catch (e: any) {
      toast.error("Erro no backfill: " + e.message);
    } finally {
      setBackfilling(false);
    }
  };

  const loadBusinessHours = async (projectId: string) => {
    const { data } = await supabase.from("imphq_business_hours")
      .select("*").eq("project_id", projectId).eq("channel", "instagram").maybeSingle();
    if (data) {
      setBusinessHours(data);
      setHoursForm({
        enabled: data.enabled,
        open_time: data.open_time?.slice(0,5) || "08:00",
        close_time: data.close_time?.slice(0,5) || "18:00",
        days_of_week: data.days_of_week || [1,2,3,4,5],
        outside_hours_message: data.outside_hours_message || "",
        pause_ai_outside_hours: data.pause_ai_outside_hours || false,
      });
    }
  };

  const saveBusinessHours = async () => {
    if (!selectedAccount) return;
    setSavingHours(true);
    try {
      const payload = { ...hoursForm, project_id: selectedAccount.project_id, channel: "instagram" };
      if (businessHours?.id) {
        await supabase.from("imphq_business_hours").update(payload).eq("id", businessHours.id);
      } else {
        const { data } = await supabase.from("imphq_business_hours").insert(payload).select().single();
        setBusinessHours(data);
      }
      toast.success("Horários salvos!");
      setShowBusinessHours(false);
    } catch (e: any) {
      toast.error("Erro ao salvar horários: " + e.message);
    } finally {
      setSavingHours(false);
    }
  };

  const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Sequences state (Bloco 2)
  const [sequences, setSequences] = useState<any[]>([]);
  const [loadingSeqs, setLoadingSeqs] = useState(false);
  const [showAddSeq, setShowAddSeq] = useState(false);
  const [newSeq, setNewSeq] = useState({ name: "", trigger_stage: "quente", trigger_delay_hours: 0, steps: [{message: "Oi {nome}! Vi que você se interessou. Posso te ajudar?", delay_hours: 0}] });
  const [savingSeq, setSavingSeq] = useState(false);

  // Funnel kanban state (Bloco 1)
  const [funnelGroups, setFunnelGroups] = useState<Record<string, IgConversation[]>>({});
  const [loadingFunnel, setLoadingFunnel] = useState(false);

  // Persist project filter
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("ig.selectedProject", selectedProjectId);
    }
  }, [selectedProjectId]);

  // Load sequences when tab is active
  useEffect(() => {
    if (activeMainTab !== "sequencias" || !selectedProjectId) return;
    setLoadingSeqs(true);
    supabase.from("imphq_ig_sequences").select("*").eq("project_id", selectedProjectId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setSequences(data || []); setLoadingSeqs(false); });
  }, [activeMainTab, selectedProjectId]);

  // Load funnel kanban when tab is active
  useEffect(() => {
    if (activeMainTab !== "funil" || !selectedAccount) return;
    setLoadingFunnel(true);
    supabase.from("imphq_ig_conversations")
      .select("*")
      .eq("account_id", selectedAccount.id)
      .order("last_message_at", { ascending: false })
      .then(({ data: convs }) => {
        const groups: Record<string, IgConversation[]> = { frio: [], morno: [], quente: [], cliente: [] };
        for (const c of convs || []) {
          const stage = (c as any).triage_intent || "frio";
          if (!groups[stage]) groups[stage] = [];
          groups[stage].push(c);
        }
        setFunnelGroups(groups);
        setLoadingFunnel(false);
      });
  }, [activeMainTab, selectedAccount]);

  // Load initial projects
  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      if (data && data.length > 0) {
        setProjects(data);
        if (!selectedProjectId) setSelectedProjectId(data[0].id);
      }
    }
    loadProjects();
  }, []);

  // Load connected Instagram accounts for selected project
  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadAccounts() {
      const { data } = await supabase.from("imphq_ig_accounts").select("*").eq("project_id", selectedProjectId);
      setAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccount(data[0]);
      } else {
        setSelectedAccount(null);
        setConversations([]);
        setSelectedConv(null);
        setComments([]);
      }
    }
    loadAccounts();
  }, [selectedProjectId]);

  // Load conversations when account is active
  const loadConversations = useCallback(async (accountId: string) => {
    setLoadingConvs(true);
    const { data } = await supabase
      .from("imphq_ig_conversations")
      .select("*")
      .eq("account_id", accountId)
      .order("last_message_at", { ascending: false });
    const convs = data || [];

    // Load latest triage per conversation (for hot lead badge)
    if (convs.length > 0) {
      const convIds = convs.map((c: any) => c.id);
      const { data: triages } = await supabase
        .from("imphq_wa_triage")
        .select("conversation_id, intent, fit_score, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });

      // Keep only the latest triage per conversation
      const latestByConv: Record<string, any> = {};
      for (const t of triages || []) {
        if (!latestByConv[t.conversation_id]) latestByConv[t.conversation_id] = t;
      }

      const enriched = convs.map((c: any) => ({
        ...c,
        triage_intent: latestByConv[c.id]?.intent ?? null,
        triage_fit_score: latestByConv[c.id]?.fit_score ?? null,
      }));
      setConversations(enriched);
    } else {
      setConversations(convs);
    }
    setLoadingConvs(false);
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadConversations(selectedAccount.id);
    }
  }, [selectedAccount, loadConversations]);

  // Load messages when conversation is active
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from("imphq_ig_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data as any) || []);
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
      // Mark as read
      supabase.from("imphq_ig_conversations").update({ unread_count: 0 } as any).eq("id", selectedConv.id).then(() => {
        setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, unread_count: 0 } : c));
      });
    }
  }, [selectedConv, loadMessages]);

  // Load comments when tab is comments and account selected
  const loadComments = useCallback(async (accountId: string) => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("imphq_ig_comments")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    setComments(data || []);
    setLoadingComments(false);
  }, []);

  useEffect(() => {
    if (selectedAccount && activeMainTab === "comments") {
      loadComments(selectedAccount.id);
    }
  }, [selectedAccount, activeMainTab, loadComments]);

  // Load AI configuration
  useEffect(() => {
    if (selectedProjectId) {
      setLoadingAi(true);
      supabase.from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", selectedProjectId)
        .is("provider_id", null)
        .maybeSingle()
        .then(({ data }) => {
          setAiConfig(data || null);
          setLoadingAi(false);
        });
    } else {
      setAiConfig(null);
    }
  }, [selectedProjectId]);

  // Load comment triggers
  const loadTriggers = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingTriggers(true);
    try {
      const { data, error } = await supabase
        .from("imphq_ig_comment_triggers")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTriggers(data || []);
    } catch (e: any) {
      toast.error("Erro ao carregar gatilhos: " + e.message);
    } finally {
      setLoadingTriggers(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (activeMainTab === "triggers" && selectedProjectId) {
      loadTriggers();
    }
  }, [activeMainTab, selectedProjectId, loadTriggers]);

  const handleSaveTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrigger.trigger_keyword.trim() || !newTrigger.send_dm_template.trim()) {
      toast.error("Palavra-chave e Mensagem Direct são obrigatórias.");
      return;
    }
    try {
      const { error } = await supabase
        .from("imphq_ig_comment_triggers")
        .insert({
          project_id: selectedProjectId,
          trigger_keyword: newTrigger.trigger_keyword.trim(),
          post_id: newTrigger.post_id.trim() || "all",
          reply_comment_template: newTrigger.reply_comment_template.trim() || null,
          send_dm_template: newTrigger.send_dm_template.trim(),
          is_active: newTrigger.is_active,
          match_count: 0,
          dm_sent_count: 0,
          click_count: 0
        });

      if (error) throw error;
      toast.success("Gatilho criado com sucesso!");
      setShowAddTrigger(false);
      setNewTrigger({
        trigger_keyword: "",
        post_id: "all",
        reply_comment_template: "",
        send_dm_template: "",
        is_active: true
      });
      loadTriggers();
    } catch (err: any) {
      toast.error("Erro ao criar gatilho: " + err.message);
    }
  };

  const handleToggleTriggerActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("imphq_ig_comment_triggers")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
      setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: active } : t));
      toast.success(active ? "Gatilho ativado!" : "Gatilho desativado!");
    } catch (err: any) {
      toast.error("Erro ao alterar status: " + err.message);
    }
  };

  const handleDeleteTrigger = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este gatilho?")) return;
    try {
      const { error } = await supabase
        .from("imphq_ig_comment_triggers")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setTriggers(prev => prev.filter(t => t.id !== id));
      toast.success("Gatilho excluído com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao excluir gatilho: " + err.message);
    }
  };

  // Real-time listener for Instagram messages and comments
  useEffect(() => {
    if (!selectedAccount) return;

    const channel = supabase
      .channel("ig-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_ig_messages" }, (payload) => {
        const newMsg = payload.new as IgMessage;
        if (selectedConv && newMsg.conversation_id === selectedConv.id) {
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
        // Update list conversation
        loadConversations(selectedAccount.id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_ig_comments" }, (payload) => {
        const newComment = payload.new as IgComment;
        if (newComment.account_id === selectedAccount.id) {
          setComments(prev => [newComment, ...prev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAccount, selectedConv, loadConversations]);

  const handleSimulateWebhook = async () => {
    if (!simMessage.trim() || !selectedAccount) {
      toast.error("Por favor, digite uma mensagem para simular");
      return;
    }
    setSimLoading(true);
    try {
      const cleanSenderId = `SIM_${simUsername.toLowerCase().replace(/\s+/g, "_")}`;
      const payload = {
        object: "instagram",
        entry: [
          {
            id: selectedAccount.ig_user_id,
            messaging: [
              {
                sender: { 
                  id: cleanSenderId, 
                  username: simUsername.trim(),
                  name: simName.trim(),
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${simUsername.trim()}`
                },
                recipient: { id: selectedAccount.ig_user_id },
                timestamp: Date.now(),
                message: {
                  mid: `sim_mid_${Date.now()}`,
                  text: simMessage.trim()
                }
              }
            ]
          }
        ]
      };

      const { data, error } = await supabase.functions.invoke("instagram-webhook", {
        body: payload
      });

      if (error) throw error;

      toast.success("Mensagem simulada enviada! A IA irá responder em instantes.");
      setShowSimulateDialog(false);
      setSimMessage("");
      
      // Reload conversations
      await loadConversations(selectedAccount.id);
      
      // Attempt to auto-select the conversation
      const { data: convData } = await supabase
        .from("imphq_ig_conversations")
        .select("*")
        .eq("account_id", selectedAccount.id)
        .eq("participant_id", cleanSenderId)
        .maybeSingle();
      
      if (convData) {
        setSelectedConv(convData);
      }
    } catch (err: any) {
      console.error("[simulate ig] error:", err);
      toast.error("Erro na simulação: " + (err.message || err));
    } finally {
      setSimLoading(false);
    }
  };

  // Send Direct Message
  async function handleSendDM() {
    if (!composedMsg.trim() || !selectedConv || !selectedAccount) return;
    setSendingMsg(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-api", {
        body: {
          action: "send_text",
          project_id: selectedProjectId,
          recipient_id: selectedConv.participant_id,
          text: composedMsg.trim(),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Mensagem enviada!");
      
      // Optmistic insert local state until webhook arrives
      const optMsg: IgMessage = {
        id: crypto.randomUUID(),
        conversation_id: selectedConv.id,
        direction: "out",
        type: "text",
        content: composedMsg.trim(),
        media_url: null,
        created_at: new Date().toISOString(),
        status: "sent",
      };
      setMessages(prev => [...prev, optMsg]);
      setComposedMsg("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar mensagem");
    } finally {
      setSendingMsg(false);
    }
  }

  // Reply Comment
  async function handleReplyComment(comment: IgComment) {
    const text = replyInputs[comment.comment_id]?.trim();
    if (!text) { toast.error("Digite uma resposta"); return; }
    
    toast.promise(
      async () => {
        const { data, error } = await supabase.functions.invoke("instagram-api", {
          body: {
            action: "reply_comment",
            project_id: selectedProjectId,
            comment_id: comment.comment_id,
            message: text,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        
        // Update local state
        setComments(prev => prev.map(c => c.comment_id === comment.comment_id ? { ...c, replied: true, reply_text: text } : c));
        setReplyInputs(prev => ({ ...prev, [comment.comment_id]: "" }));
        setActiveCommentId(null);
      },
      {
        loading: "Respondendo comentário...",
        success: "Comentário respondido!",
        error: (err) => err.message || "Erro ao responder"
      }
    );
  }

  // Toggle Hide Comment
  async function handleToggleHide(comment: IgComment) {
    const action = comment.is_hidden ? "unhide_comment" : "hide_comment";
    const label = comment.is_hidden ? "exibido" : "ocultado";
    
    toast.promise(
      async () => {
        const { data, error } = await supabase.functions.invoke("instagram-api", {
          body: { action, project_id: selectedProjectId, comment_id: comment.comment_id },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        setComments(prev => prev.map(c => c.comment_id === comment.comment_id ? { ...c, is_hidden: !c.is_hidden } : c));
      },
      {
        loading: "Ajustando visibilidade...",
        success: `Comentário ${label} com sucesso!`,
        error: "Erro ao atualizar visibilidade"
      }
    );
  }

  // Delete Comment
  async function handleDeleteComment(comment: IgComment) {
    if (!confirm("Deseja realmente excluir este comentário?")) return;
    
    toast.promise(
      async () => {
        const { data, error } = await supabase.functions.invoke("instagram-api", {
          body: { action: "delete_comment", project_id: selectedProjectId, comment_id: comment.comment_id },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        setComments(prev => prev.filter(c => c.comment_id !== comment.comment_id));
      },
      {
        loading: "Excluindo comentário...",
        success: "Comentário excluído!",
        error: "Erro ao excluir comentário"
      }
    );
  }

  // Open Instagram post URL
  async function handleOpenMedia(mediaId: string) {
    if (!selectedProjectId || !mediaId) return;
    
    toast.promise(
      async () => {
        const { data, error } = await supabase.functions.invoke("instagram-api", {
          body: { action: "get_media", project_id: selectedProjectId, media_id: mediaId },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        if (data?.media?.permalink) {
          window.open(data.media.permalink, "_blank");
        } else {
          throw new Error("Link do post não encontrado");
        }
      },
      {
        loading: "Buscando link do post...",
        success: "Abrindo post no Instagram!",
        error: (err) => err.message || "Erro ao buscar link do post"
      }
    );
  }

  // Private DM Reply from Comment
  async function handlePrivateReply(comment: IgComment) {
    const text = privateReplyInputs[comment.comment_id]?.trim();
    if (!text) { toast.error("Digite o texto da mensagem"); return; }
    
    toast.promise(
      async () => {
        const { data, error } = await supabase.functions.invoke("instagram-api", {
          body: {
            action: "private_reply",
            project_id: selectedProjectId,
            comment_id: comment.comment_id,
            message: text,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        
        setShowPrivateModal(null);
        setPrivateReplyInputs(prev => ({ ...prev, [comment.comment_id]: "" }));
      },
      {
        loading: "Enviando DM privada...",
        success: "Mensagem privada enviada!",
        error: (err) => err.message || "Erro ao enviar mensagem"
      }
    );
  }

  // Test AI RAG
  async function handleTestRAG() {
    if (!testQuery.trim() || !selectedProjectId) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      
      
      // Get embeddings from openflow-ai / or helper
      const { data: embData, error: embErr } = await supabase.functions.invoke("wa-doc-embedder", {
        body: { action: "get_embedding", text: testQuery.trim() }
      });
      if (embErr) throw embErr;
      const embedding = embData?.embedding;
      
      if (!embedding) throw new Error("Não foi possível gerar vetores semânticos.");

      // RPC match
      const { data: matches, error: rpcErr } = await supabase.rpc("match_wa_knowledge", {
        query_embedding: embedding,
        p_project_id: selectedProjectId,
        match_count: 4,
        min_similarity: 0.20, // lower threshold to show all results in trace
      });

      if (rpcErr) throw rpcErr;

      setTestResult({
        query: testQuery,
        matches: matches || []
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao testar similaridade semântica");
    } finally {
      setTestLoading(false);
    }
  }

  const activeCommentsCount = useMemo(() => comments.length, [comments]);
  const activeUnreadCount = useMemo(() => conversations.reduce((acc, c) => acc + c.unread_count, 0), [conversations]);

  const filteredConversations = useMemo(() => {
    if (!convSearch.trim()) return conversations;
    const q = convSearch.toLowerCase();
    return conversations.filter(c =>
      (c.participant_username || "").toLowerCase().includes(q) ||
      (c.participant_name || "").toLowerCase().includes(q) ||
      (c.last_message || "").toLowerCase().includes(q)
    );
  }, [conversations, convSearch]);

  // Bloco 3: Feedback on AI messages
  const handleFeedback = async (msgId: string, fb: "good" | "bad") => {
    if (!selectedProjectId) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: fb } : m));
    try {
      await supabase.functions.invoke("ig-feedback-learn", {
        body: { message_id: msgId, feedback: fb, project_id: selectedProjectId }
      });
    } catch (e) { console.warn("feedback failed", e); }
  };

  // Save a new sequence
  const handleSaveSequence = async () => {
    if (!selectedProjectId || !newSeq.name.trim()) return;
    setSavingSeq(true);
    const { data, error } = await supabase.from("imphq_ig_sequences").insert({
      project_id: selectedProjectId,
      name: newSeq.name,
      trigger_stage: newSeq.trigger_stage,
      trigger_delay_hours: newSeq.trigger_delay_hours,
      steps: newSeq.steps,
      active: true,
    }).select().single();
    if (!error && data) {
      setSequences(prev => [data, ...prev]);
      setShowAddSeq(false);
      setNewSeq({ name: "", trigger_stage: "quente", trigger_delay_hours: 0, steps: [{message: "Oi {nome}! Vi que você se interessou. Posso te ajudar?", delay_hours: 0}] });
    }
    setSavingSeq(false);
  };

  // Toggle sequence active/inactive
  const handleToggleSeq = async (seqId: string, active: boolean) => {
    await supabase.from("imphq_ig_sequences").update({ active }).eq("id", seqId);
    setSequences(prev => prev.map(s => s.id === seqId ? { ...s, active } : s));
  };

  // Load real telemetry stats for Brain tab
  useEffect(() => {
    if (!selectedAccount || activeMainTab !== "brain") return;
    async function loadStats() {
      setAiStats(s => ({ ...s, loading: true }));
      try {
        const [{ count: totalIn }, { count: totalOut }, { count: cmtReplied }, { count: cmtTotal }] = await Promise.all([
          supabase.from("imphq_ig_messages").select("*", { count: "exact", head: true }).eq("direction", "in"),
          supabase.from("imphq_ig_messages").select("*", { count: "exact", head: true }).eq("direction", "out"),
          supabase.from("imphq_ig_comments").select("*", { count: "exact", head: true }).eq("account_id", selectedAccount!.id).eq("replied", true),
          supabase.from("imphq_ig_comments").select("*", { count: "exact", head: true }).eq("account_id", selectedAccount!.id),
        ]);
        const total = (totalIn || 0) + (totalOut || 0);
        const ragRate = total > 0 ? Math.round(((totalOut || 0) / Math.max(totalIn || 1, 1)) * 100) : 0;
        setAiStats({
          totalMsgs: (totalIn || 0),
          autoReplied: (totalOut || 0),
          handoffs: Math.max(0, (totalIn || 0) - (totalOut || 0)),
          ragHitRate: Math.min(ragRate, 99),
          loading: false,
        });
      } catch {
        setAiStats(s => ({ ...s, loading: false }));
      }
    }
    loadStats();
  }, [selectedAccount, activeMainTab]);

  // Human takeover toggle per conversation
  const handleToggleAiPaused = async (conv: IgConversation) => {
    const next = !conv.ai_paused;
    try {
      const { error } = await supabase
        .from("imphq_ig_conversations")
        .update({ ai_paused: next, ai_paused_reason: next ? "Operador assumiu" : null })
        .eq("id", conv.id);
      if (error) throw error;
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, ai_paused: next } : c));
      if (selectedConv?.id === conv.id) setSelectedConv(s => s ? { ...s, ai_paused: next } : s);
      toast.success(next ? "🧑 Modo humano ativado — IA pausada nesta conversa." : "🤖 IA retomou o controle desta conversa.");
    } catch (e: any) {
      toast.error("Erro ao alternar modo: " + e.message);
    }
  };
  const selectedProjectName = useMemo(() => projects.find(p => p.id === selectedProjectId)?.name || "Projeto", [projects, selectedProjectId]);

  // Toggle IA for DMs or Comments directly from Instagram page
  const handleToggleAI = async (field: 'instagram_enabled' | 'instagram_comments_enabled', value: boolean) => {
    if (!selectedProjectId || !aiConfig?.id) {
      toast.error("Configure a IA no projeto antes de ativar.");
      return;
    }
    try {
      const { error } = await supabase
        .from("imphq_wa_ai_config")
        .update({ [field]: value })
        .eq("id", aiConfig.id);
      if (error) throw error;
      setAiConfig((prev: any) => ({ ...prev, [field]: value }));
      const label = field === 'instagram_enabled' ? 'IA no Direct' : 'IA nos Comentários';
      toast.success(value ? `${label} ativada!` : `${label} desativada!`);
    } catch (e: any) {
      toast.error("Erro ao atualizar configuração: " + e.message);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl font-sans">
      
      {/* ─── HEADER COM SELECT DO PROJETO ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 p-2.5 rounded-2xl shadow-lg shadow-pink-500/10">
            <Instagram className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Instagram DM & Comentários</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Audite o comportamento da Inteligência Artificial em tempo real.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Projeto:</Label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-secondary/40 border border-border/60 text-foreground text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── ALERTA DE CONTA CONECTADA ─── */}
      {!selectedAccount && !loadingConvs && (
        <Card className="bg-card border-dashed border-amber-500/20 shadow-xl max-w-2xl mx-auto py-8">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-amber-500/10 p-4 rounded-full text-amber-500">
              <Instagram className="h-10 w-10" />
            </div>
            <h2 className="text-lg font-bold">Nenhuma conta Instagram vinculada</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Vincule sua conta Instagram Business nas configurações de integração do seu projeto em <strong>Projetos &gt; Detalhes &gt; Instagram</strong>.
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = `/projetos/${selectedProjectId}`}>
              Ir para o Painel do Projeto
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedAccount && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* ─── SIDEBAR ESQUERDO: CONVERSAS / ABAS ─── */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-card border-border/60 shadow-lg overflow-hidden">
              <div className="bg-secondary/15 px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    {selectedAccount.avatar_url ? (
                      <img src={selectedAccount.avatar_url} alt="" className="w-8 h-8 rounded-full border border-border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs"><User className="h-4 w-4" /></div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card" />
                  </div>
                  <span className="text-sm font-semibold">@{selectedAccount.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-amber-500 hover:text-amber-400 hover:bg-slate-900"
                    title="Simular DM"
                    onClick={() => setShowSimulateDialog(true)}
                  >
                    <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10"
                    title="Buscar nomes e fotos dos leads (backfill)"
                    onClick={runProfileBackfill}
                    disabled={backfilling}
                  >
                    {backfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
                  </Button>
                  <RefreshCw
                    className={`h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer transition ${loadingConvs ? "animate-spin" : ""}`}
                    onClick={() => loadConversations(selectedAccount.id)}
                  />
                </div>
              </div>

              <div className="p-2 space-y-1">
                <Button
                  variant={activeMainTab === "dms" ? "secondary" : "ghost"}
                  className="w-full justify-between font-normal text-sm"
                  onClick={() => setActiveMainTab("dms")}
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Direct Messages (DMs)
                  </span>
                  {activeUnreadCount > 0 && <Badge className="bg-amber-500 text-black">{activeUnreadCount}</Badge>}
                </Button>

                <Button
                  variant={activeMainTab === "comments" ? "secondary" : "ghost"}
                  className="w-full justify-between font-normal text-sm"
                  onClick={() => setActiveMainTab("comments")}
                >
                  <span className="flex items-center gap-2">
                    <Heart className="h-4 w-4" /> Comentários
                  </span>
                  {activeCommentsCount > 0 && <Badge variant="outline">{activeCommentsCount}</Badge>}
                </Button>

                <Button
                  variant={activeMainTab === "triggers" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 font-normal text-sm"
                  onClick={() => setActiveMainTab("triggers")}
                >
                  <Workflow className="h-4 w-4" /> Gatilhos de Comentário
                </Button>

                <Button
                  variant={activeMainTab === "brain" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 font-normal text-sm"
                  onClick={() => setActiveMainTab("brain")}
                >
                  <Bot className="h-4 w-4" /> Central da IA & RAG
                </Button>

                <Button
                  variant={activeMainTab === "funil" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 font-normal text-sm"
                  onClick={() => setActiveMainTab("funil")}
                >
                  <span className="text-base">🎯</span> Funil de Leads
                  {(funnelGroups["quente"]?.length || 0) > 0 && <Badge className="ml-auto bg-red-500/20 text-red-400 border-red-500/30">{funnelGroups["quente"].length} 🔥</Badge>}
                </Button>

                <Button
                  variant={activeMainTab === "sequencias" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 font-normal text-sm"
                  onClick={() => setActiveMainTab("sequencias")}
                >
                  <span className="text-base">🔄</span> Sequências de Funil
                  {sequences.length > 0 && <Badge variant="outline" className="ml-auto">{sequences.length}</Badge>}
                </Button>
              </div>

              {/* ─── AI QUICK TOGGLES ─── */}
              <div className="px-3 pb-3 pt-2 border-t border-border/30 space-y-1.5">
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest px-0.5 mb-2">Controles de IA</p>
                {!aiConfig && (
                  <p className="text-[9px] text-amber-500/80 text-center pb-1">Configure a IA no projeto para ativar.</p>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all select-none ${aiConfig ? "cursor-pointer" : "pointer-events-none opacity-40"} ${aiConfig?.instagram_enabled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-secondary/20 border-border/40"}`}
                  onClick={() => handleToggleAI('instagram_enabled', !aiConfig?.instagram_enabled)}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <MessageSquare className="h-3 w-3" /> IA no Direct
                  </span>
                  <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${aiConfig?.instagram_enabled ? "bg-emerald-500 border-emerald-400" : "bg-secondary border-border"}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${aiConfig?.instagram_enabled ? "translate-x-[13px]" : "translate-x-[1px]"}`} />
                  </span>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all select-none ${aiConfig ? "cursor-pointer" : "pointer-events-none opacity-40"} ${aiConfig?.instagram_comments_enabled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-secondary/20 border-border/40"}`}
                  onClick={() => handleToggleAI('instagram_comments_enabled', !aiConfig?.instagram_comments_enabled)}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Heart className="h-3 w-3" /> IA em Comentários
                  </span>
                  <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${aiConfig?.instagram_comments_enabled ? "bg-emerald-500 border-emerald-400" : "bg-secondary border-border"}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${aiConfig?.instagram_comments_enabled ? "translate-x-[13px]" : "translate-x-[1px]"}`} />
                  </span>
                </div>

                {/* Business Hours toggle */}
                <div
                  role="button" tabIndex={0}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border bg-secondary/20 border-border/40 cursor-pointer hover:bg-secondary/40 transition-all select-none"
                  onClick={() => { setShowBusinessHours(v => !v); if (selectedAccount) loadBusinessHours(selectedAccount.project_id); }}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Clock className="h-3 w-3" /> Horários de Atendimento
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    businessHours?.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"
                  }`}>{businessHours?.enabled ? `${businessHours.open_time?.slice(0,5)} – ${businessHours.close_time?.slice(0,5)}` : "Não config."}</span>
                </div>

                {/* Business Hours panel (inline) */}
                {showBusinessHours && (
                  <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">⏰ Horários de Atendimento</span>
                      <div
                        role="button"
                        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border cursor-pointer transition-colors ${
                          hoursForm.enabled ? "bg-emerald-500 border-emerald-400" : "bg-secondary border-border"
                        }`}
                        onClick={() => setHoursForm(p => ({ ...p, enabled: !p.enabled }))}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${hoursForm.enabled ? "translate-x-[13px]" : "translate-x-[1px]"}`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase mb-1">Abre</p>
                        <input type="time" value={hoursForm.open_time}
                          onChange={e => setHoursForm(p => ({ ...p, open_time: e.target.value }))}
                          className="w-full text-xs bg-background border border-border/60 rounded px-2 py-1" />
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase mb-1">Fecha</p>
                        <input type="time" value={hoursForm.close_time}
                          onChange={e => setHoursForm(p => ({ ...p, close_time: e.target.value }))}
                          className="w-full text-xs bg-background border border-border/60 rounded px-2 py-1" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase mb-1.5">Dias da semana</p>
                      <div className="flex gap-1 flex-wrap">
                        {DAY_LABELS.map((d, i) => (
                          <button key={i}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                              hoursForm.days_of_week.includes(i)
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : "bg-secondary/30 border-border/40 text-muted-foreground"
                            }`}
                            onClick={() => setHoursForm(p => ({
                              ...p,
                              days_of_week: p.days_of_week.includes(i)
                                ? p.days_of_week.filter(x => x !== i)
                                : [...p.days_of_week, i].sort()
                            }))}
                          >{d}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase mb-1">Mensagem fora do horário</p>
                      <textarea
                        value={hoursForm.outside_hours_message}
                        onChange={e => setHoursForm(p => ({ ...p, outside_hours_message: e.target.value }))}
                        rows={2}
                        className="w-full text-[11px] bg-background border border-border/60 rounded px-2 py-1 resize-none"
                      />
                    </div>
                    <div
                      role="button"
                      className="flex items-center justify-between px-2 py-1.5 rounded border border-border/40 bg-secondary/20 cursor-pointer"
                      onClick={() => setHoursForm(p => ({ ...p, pause_ai_outside_hours: !p.pause_ai_outside_hours }))}
                    >
                      <span className="text-[11px]">Pausar IA fora do horário</span>
                      <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full border transition-colors ${
                        hoursForm.pause_ai_outside_hours ? "bg-emerald-500 border-emerald-400" : "bg-secondary border-border"
                      }`}>
                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${hoursForm.pause_ai_outside_hours ? "translate-x-[10px]" : "translate-x-[1px]"}`} />
                      </span>
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={saveBusinessHours} disabled={savingHours}>
                      {savingHours ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar Horários"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
            </Card>

            {/* LISTA DE CONVERSAS (SE ESTIVER EM DMS) */}
            {activeMainTab === "dms" && (
              <Card className="bg-card border-border/60 shadow-lg flex flex-col h-[500px]">
                <CardHeader className="px-4 py-3 border-b border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Conversas Recentes</CardTitle>
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Input
                    value={convSearch}
                    onChange={e => setConvSearch(e.target.value)}
                    placeholder="Buscar conversa..."
                    className="h-7 text-xs bg-secondary/30 border-border/50 focus-visible:ring-amber-500"
                  />
                </CardHeader>
                <ScrollArea className="flex-1">
                  {loadingConvs ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center p-8 text-xs text-muted-foreground">{convSearch ? "Nenhuma conversa encontrada para sua busca." : "Nenhuma conversa encontrada."}</div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {filteredConversations.map((c) => {
                        const isSelected = selectedConv?.id === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedConv(c)}
                            className={`p-3 cursor-pointer transition duration-150 flex items-center gap-3 hover:bg-secondary/20 ${isSelected ? "bg-secondary/40 border-l-2 border-amber-500" : ""}`}
                          >
                            <div className="relative shrink-0">
                              {c.participant_avatar ? (
                                <img src={c.participant_avatar} alt="" className="w-9 h-9 rounded-full border border-border object-cover" />
                              ) : (
                                <img
                                  src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.participant_username || c.participant_name || c.participant_id)}&backgroundColor=1e293b&fontSize=40`}
                                  alt=""
                                  className="w-9 h-9 rounded-full border border-border/40"
                                />
                              )}
                              {c.ai_paused && <span title="Humano assumiu" className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-card flex items-center justify-center text-[7px] text-white font-bold">H</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm truncate block text-foreground">
                                  {c.participant_name || (c.participant_username && c.participant_username !== "null" ? `@${c.participant_username}` : `Lead #${c.participant_id.slice(-4)}`)}
                                </span>
                                {c.triage_intent && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold ${
                                    c.triage_intent === 'compra_quente' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                                    c.triage_intent === 'objecao' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {c.triage_intent === 'compra_quente' ? '🔥' : c.triage_intent === 'objecao' ? '⚠️' : '🤔'}
                                  </span>
                                )}
                                {c.last_message_at && (
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message || "[Mídia]"}</p>
                            </div>
                            {c.unread_count > 0 && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </Card>
            )}
          </div>

          {/* ─── PAINEL CENTRAL: CONTEÚDO PRINCIPAL ─── */}
          <div className="lg:col-span-3 space-y-6">

            {/* ABA DMS: CHAT COMPLETO */}
            {activeMainTab === "dms" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[560px]">
                <Card className="md:col-span-2 bg-card border-border/60 shadow-lg flex flex-col h-full overflow-hidden">
                  {selectedConv ? (
                    <>
                      {/* Top Header do Chat */}
                      <div className="bg-secondary/10 px-4 py-3 border-b border-border/40 flex items-center gap-3 justify-between flex-wrap">
                        <div className="flex items-center gap-3">
                          {selectedConv.participant_avatar ? (
                            <img src={selectedConv.participant_avatar} alt="" className="w-9 h-9 rounded-full border border-border" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">{(selectedConv.participant_username && selectedConv.participant_username !== "null" ? selectedConv.participant_username : selectedConv.participant_name || "L")[0].toUpperCase()}</div>
                          )}
                          <div>
                            <span className="font-bold text-sm text-foreground block">
                              {selectedConv.participant_username && selectedConv.participant_username !== "null" ? `@${selectedConv.participant_username}` : selectedConv.participant_name || `Lead (${selectedConv.participant_id.slice(-4)})`}
                            </span>
                            <span className="text-xs text-muted-foreground">{selectedConv.participant_name || "Comunicação ativa"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] tracking-wider uppercase bg-secondary/30">IG DM</Badge>
                          {/* Hot lead intent badge */}
                          {selectedConv.triage_intent === "compra_quente" && (
                            <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 animate-pulse">
                              🔥 Lead QUENTE
                            </span>
                          )}
                          {selectedConv.triage_intent === "objecao" && (
                            <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5">
                              ⚠️ Objeção
                            </span>
                          )}
                          {selectedConv.triage_intent === "interesse" && (
                            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">
                              🤔 Interesse
                            </span>
                          )}
                          {selectedConv.triage_fit_score != null && (
                            <span className="text-[10px] text-muted-foreground">Score: <strong className="text-foreground">{selectedConv.triage_fit_score}</strong></span>
                          )}
                          {/* Human takeover toggle */}
                          <button
                            title={selectedConv.ai_paused ? "Devolver para IA" : "Humano assume — pausar IA nesta conversa"}
                            onClick={() => handleToggleAiPaused(selectedConv)}
                            className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${
                              selectedConv.ai_paused
                                ? "bg-blue-500/20 border-blue-500/40 text-blue-400 hover:bg-blue-500/30"
                                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedConv.ai_paused ? "bg-blue-400" : "bg-emerald-500 animate-pulse"}`} />
                            {selectedConv.ai_paused ? "🧑 Humano" : "🤖 IA"}
                          </button>
                        </div>
                      </div>

                      {/* Banner human takeover */}
                      {selectedConv.ai_paused && (
                        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-1.5 flex items-center gap-2">
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">🧑 Modo Humano ativo — IA não responderá automaticamente nesta conversa.</span>
                          <button onClick={() => handleToggleAiPaused(selectedConv)} className="ml-auto text-[9px] text-blue-400 underline hover:text-blue-300">Devolver à IA</button>
                        </div>
                      )}

                      {/* Conteúdo de Mensagens */}
                      <ScrollArea className="flex-1 p-4 bg-secondary/5">
                        {loadingMsgs ? (
                          <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : messages.length === 0 ? (
                          <div className="text-center p-8 text-xs text-muted-foreground">Nenhuma mensagem no histórico.</div>
                        ) : (
                          <div className="space-y-4">
                            {messages.map((m) => {
                              const isInbound = m.direction === "in" || (m.direction as string) === "incoming";
                              const isAI = !isInbound && m.ai_generated;
                              return (
                                <div key={m.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                                  <div className="group relative">
                                    <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${isInbound ? "bg-secondary text-foreground rounded-tl-none border border-border/40" : "bg-gradient-to-tr from-amber-600 to-amber-500 text-black font-medium rounded-tr-none"}`}>
                                      {m.content}
                                      <div className="flex items-center justify-between gap-2 mt-1.5 text-[9px] opacity-60">
                                        <span>
                                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                                        </span>
                                        {!isInbound && (
                                          <span className="capitalize flex items-center gap-1">
                                            {isAI && <span className="text-[8px] opacity-80">IA</span>}
                                            {m.status || "enviado"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {/* Feedback buttons — only on AI outbound messages */}
                                    {isAI && (
                                      <div className={`absolute -bottom-5 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        <button
                                          onClick={() => handleFeedback(m.id, "good")}
                                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                            m.feedback === "good"
                                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                              : "bg-card text-muted-foreground border-border/40 hover:text-emerald-400"
                                          }`}
                                          title="Boa resposta — adicionar ao conhecimento"
                                        >
                                          👍
                                        </button>
                                        <button
                                          onClick={() => handleFeedback(m.id, "bad")}
                                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                            m.feedback === "bad"
                                              ? "bg-red-500/20 text-red-400 border-red-500/40"
                                              : "bg-card text-muted-foreground border-border/40 hover:text-red-400"
                                          }`}
                                          title="Resposta ruim — marcar para revisao"
                                        >
                                          👎
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>

                      {/* Compositor de Mensagem */}
                      <div className="border-t border-border/40 bg-card">
                        {/* Quick reply templates */}
                        {showTemplates && (
                          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1 border-b border-border/30">
                            {[
                              "Olá! Como posso ajudar? 😊",
                              "Vou verificar isso com a equipe e retorno em breve!",
                              "Quer saber mais sobre a formação? Posso te enviar os detalhes!",
                              "Qual a sua maior dificuldade hoje?",
                              "Perfeito! Me passa seu e-mail para enviar as informações 📩",
                            ].map(t => (
                              <button
                                key={t}
                                onClick={() => { setComposedMsg(t); setShowTemplates(false); }}
                                className="text-[10px] bg-secondary/50 hover:bg-secondary border border-border/50 rounded-full px-2 py-0.5 text-left truncate max-w-[200px] transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="p-3 flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Templates rápidos"
                            onClick={() => setShowTemplates(v => !v)}
                            className={`h-9 w-9 shrink-0 text-muted-foreground hover:text-amber-400 ${showTemplates ? "bg-amber-500/10 text-amber-400" : ""}`}
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                          <Input
                            value={composedMsg}
                            onChange={(e) => setComposedMsg(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendDM()}
                            placeholder={`Responder a ${selectedConv.participant_username && selectedConv.participant_username !== "null" ? `@${selectedConv.participant_username}` : (selectedConv.participant_name || `Lead (${selectedConv.participant_id.slice(-4)})`)} via Instagram...`}
                            className="bg-secondary/40 border-border/60 focus-visible:ring-amber-500"
                          />
                          <Button
                            disabled={sendingMsg || !composedMsg.trim()}
                            onClick={handleSendDM}
                            className="bg-amber-500 text-black hover:bg-amber-400"
                          >
                            {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-2">
                      <MessageSquare className="h-10 w-10 text-muted-foreground/60" />
                      <h3 className="font-semibold">Nenhuma conversa selecionada</h3>
                      <p className="text-xs text-muted-foreground max-w-sm">Escolha um lead na barra lateral para carregar a auditoria do chat de DMs.</p>
                    </div>
                  )}
                </Card>

                {/* Painel do Lead Associado */}
                <Card className="bg-card border-border/60 shadow-lg h-full p-4 flex flex-col justify-between overflow-y-auto">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Informações do Contato</h3>
                    {selectedConv ? (
                      <div className="space-y-4">
                        <div className="bg-secondary/20 p-3 rounded-lg border border-border/30 flex flex-col items-center text-center">
                          {selectedConv.participant_avatar ? (
                            <img src={selectedConv.participant_avatar} alt="" className="w-16 h-16 rounded-full border-2 border-amber-500/20 mb-2" />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-bold text-lg mb-2">{(selectedConv.participant_username && selectedConv.participant_username !== "null" ? selectedConv.participant_username : selectedConv.participant_name || "L")[0].toUpperCase()}</div>
                          )}
                          <span className="font-bold text-sm">
                            {selectedConv.participant_username && selectedConv.participant_username !== "null" ? `@${selectedConv.participant_username}` : selectedConv.participant_name || `Lead (${selectedConv.participant_id.slice(-4)})`}
                          </span>
                          <span className="text-xs text-muted-foreground">{selectedConv.participant_name || "—"}</span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between border-b border-border/30 pb-1.5">
                            <span className="text-muted-foreground">ID do Participante:</span>
                            <span className="font-mono">{selectedConv.participant_id}</span>
                          </div>
                          <div className="flex justify-between border-b border-border/30 pb-1.5">
                            <span className="text-muted-foreground">Status da Conversa:</span>
                            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Ativo</Badge>
                          </div>
                          <div className="flex justify-between pb-1.5">
                            <span className="text-muted-foreground">Total de Mensagens:</span>
                            <span className="font-semibold">{messages.length}</span>
                          </div>
                        </div>

                        <div className="border-t border-border/40 pt-3 mt-4">
                          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Ações de Integração</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => setSelectedConv(null)}
                          >
                            Desassociar Conversa
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-xs text-muted-foreground">Selecione uma conversa para ver dados de RAG e CRM do lead.</div>
                    )}
                  </div>

                  {selectedConv && (
                    <div className="bg-secondary/20 p-2.5 rounded-lg border border-border/30 mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">IA no Direct</span>
                        <div
                          role="button"
                          tabIndex={0}
                          title={aiConfig ? (aiConfig.instagram_enabled ? "Desativar IA no Direct" : "Ativar IA no Direct") : "Configure a IA primeiro"}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full border transition-colors ${aiConfig?.instagram_enabled ? "bg-emerald-500 border-emerald-400" : "bg-secondary border-border"} ${!aiConfig ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
                          onClick={() => handleToggleAI('instagram_enabled', !aiConfig?.instagram_enabled)}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${aiConfig?.instagram_enabled ? "translate-x-[13px]" : "translate-x-[1px]"}`} />
                        </div>
                      </div>
                      {aiConfig?.instagram_enabled ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] uppercase font-bold text-emerald-400">IA Ativa</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            A IA está respondendo automaticamente neste Direct.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">IA Inativa</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {aiConfig ? "Ative o toggle acima para ligar as respostas automáticas." : "Configure a IA no projeto para ativar."}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ABA COMENTÁRIOS: AUDITOR COMPLETO */}
            {activeMainTab === "comments" && (
              <Card className="bg-card border-border/60 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Auditor de Comentários & Menções</CardTitle>
                  <CardDescription className="text-xs">Monitore os comentários recebidos nos seus posts do Instagram e defina respostas manuais ou automáticas.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingComments ? (
                    <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                  ) : comments.length === 0 ? (
                    <div className="text-center p-12 text-sm text-muted-foreground">Nenhum comentário registrado nos webhooks recentes.</div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {comments.map((comment) => (
                        <div key={comment.id} className="p-4 space-y-3 hover:bg-secondary/5 transition">
                          
                          {/* Top Card do Comentário */}
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">@{comment.from_username}</span>
                              <span className="text-xs text-muted-foreground">
                                • {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                              
                              {/* Badges de Status */}
                              {comment.replied ? (
                                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Respondido</Badge>
                              ) : (
                                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">Pendente</Badge>
                              )}
                              
                              {comment.is_hidden && (
                                <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30">Oculto</Badge>
                              )}
                            </div>

                            {/* Ações Rápidas de Ocultar/Deletar */}
                            <div className="flex items-center gap-1">
                              {comment.media_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleOpenMedia(comment.media_id)}
                                  title="Ver Post no Instagram"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleToggleHide(comment)}
                                title={comment.is_hidden ? "Exibir Comentário" : "Ocultar Comentário"}
                              >
                                {comment.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteComment(comment)}
                                title="Excluir Comentário"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Texto do Comentário */}
                          <div className="bg-secondary/15 p-3 rounded-lg border border-border/30 text-sm leading-relaxed text-foreground">
                            {comment.text}
                          </div>

                          {/* Resposta do Time/IA se houver */}
                          {comment.replied && comment.reply_text && (
                            <div className="pl-6 border-l-2 border-emerald-500/40 space-y-1">
                              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Resposta Registrada:
                              </span>
                              <p className="text-xs text-muted-foreground italic bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                                "{comment.reply_text}"
                              </p>
                            </div>
                          )}

                          {/* Caixa de Ações do Comentário */}
                          <div className="flex items-center gap-3 pt-1">
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs p-0 text-amber-500 hover:text-amber-400"
                              onClick={() => setActiveCommentId(activeCommentId === comment.comment_id ? null : comment.comment_id)}
                            >
                              Responder Comentário
                            </Button>

                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowPrivateModal(showPrivateModal === comment.comment_id ? null : comment.comment_id)}
                            >
                              Enviar Direct Privada (DM)
                            </Button>
                          </div>

                          {/* Formulário para Responder ao Comentário */}
                          {activeCommentId === comment.comment_id && (
                            <div className="pl-4 pt-2 flex gap-2 items-center">
                              <Input
                                value={replyInputs[comment.comment_id] || ""}
                                onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment.comment_id]: e.target.value }))}
                                placeholder="Digite sua resposta pública no post..."
                                className="bg-secondary/40 border-border/60 text-xs py-1"
                              />
                              <Button
                                size="sm"
                                className="bg-amber-500 text-black hover:bg-amber-400 text-xs px-3 h-8 shrink-0"
                                onClick={() => handleReplyComment(comment)}
                              >
                                Enviar
                              </Button>
                            </div>
                          )}

                          {/* Formulário para Responder na Direct Privada */}
                          {showPrivateModal === comment.comment_id && (
                            <div className="pl-4 pt-2 flex gap-2 items-center bg-secondary/10 p-3 rounded border border-border/20">
                              <div className="flex-1 space-y-1">
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Responder no Privado (DM)</span>
                                <Input
                                  value={privateReplyInputs[comment.comment_id] || ""}
                                  onChange={(e) => setPrivateReplyInputs(prev => ({ ...prev, [comment.comment_id]: e.target.value }))}
                                  placeholder="Iniciar conversa privada no Direct com esta mensagem..."
                                  className="bg-secondary/40 border-border/60 text-xs py-1"
                                />
                              </div>
                              <Button
                                size="sm"
                                className="bg-amber-500 text-black hover:bg-amber-400 text-xs px-3 h-8 align-bottom shrink-0 mt-4"
                                onClick={() => handlePrivateReply(comment)}
                              >
                                Iniciar DM
                              </Button>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ABA CÉREBRO: CENTRAL DE IA & RAG */}
            {/* FUNIL KANBAN */}
            {activeMainTab === "funil" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Funil de Leads 🎯</h2>
                    <p className="text-xs text-muted-foreground">Distribuição automática baseada na triage da IA</p>
                  </div>
                  {!selectedAccount && <p className="text-amber-500 text-xs">Selecione uma conta Instagram para ver o funil.</p>}
                </div>
                {loadingFunnel ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { id: "frio", label: "Frio", emoji: "❄️", color: "border-blue-500/30 bg-blue-500/5" },
                      { id: "morno", label: "Morno", emoji: "🌡️", color: "border-amber-500/30 bg-amber-500/5" },
                      { id: "quente", label: "Quente", emoji: "🔥", color: "border-red-500/30 bg-red-500/5" },
                      { id: "cliente", label: "Cliente", emoji: "✅", color: "border-emerald-500/30 bg-emerald-500/5" },
                    ].map(stage => (
                      <Card key={stage.id} className={`border ${stage.color}`}>
                        <CardHeader className="pb-2 pt-3 px-3">
                          <CardTitle className="text-sm font-semibold flex items-center justify-between">
                            <span>{stage.emoji} {stage.label}</span>
                            <Badge variant="outline" className="text-[10px]">{(funnelGroups[stage.id] || []).length}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2 pb-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
                          {(funnelGroups[stage.id] || []).length === 0 ? (
                            <p className="text-[10px] text-muted-foreground text-center py-3">Nenhum lead</p>
                          ) : (funnelGroups[stage.id] || []).map(c => (
                            <div
                              key={c.id}
                              onClick={() => { setSelectedConv(c); setActiveMainTab("dms"); }}
                              className="cursor-pointer p-2 rounded-lg bg-card hover:bg-secondary/40 border border-border/40 transition-colors"
                            >
                              <p className="text-xs font-semibold truncate">
                                {c.participant_username && c.participant_username !== "null" ? `@${c.participant_username}` : c.participant_name || "Lead"}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.last_message || "—"}</p>
                              {c.last_message_at && (
                                <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                                  {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ptBR })}
                                </p>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SEQUENCIAS DE FUNIL */}
            {activeMainTab === "sequencias" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Sequências de Funil 🔄</h2>
                    <p className="text-xs text-muted-foreground">Mensagens automáticas enviadas quando um lead atinge um estágio</p>
                  </div>
                  <Button onClick={() => setShowAddSeq(true)} className="bg-amber-500 text-black hover:bg-amber-400 gap-2">
                    <span>+</span> Nova Sequência
                  </Button>
                </div>

                {showAddSeq && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Nova Sequência Automática</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Nome</label>
                          <Input
                            value={newSeq.name}
                            onChange={e => setNewSeq(p => ({ ...p, name: e.target.value }))}
                            placeholder="Ex: Follow-up Lead Quente"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Disparar quando lead é:</label>
                          <select
                            value={newSeq.trigger_stage}
                            onChange={e => setNewSeq(p => ({ ...p, trigger_stage: e.target.value }))}
                            className="w-full h-8 text-xs rounded-md border border-border/60 bg-background px-2"
                          >
                            <option value="frio">❄️ Frio</option>
                            <option value="morno">🌡️ Morno</option>
                            <option value="quente">🔥 Quente</option>
                            <option value="cliente">✅ Cliente</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">1º Mensagem (use {"{nome}"} para personalizar)</label>
                        <textarea
                          value={newSeq.steps[0]?.message || ""}
                          onChange={e => setNewSeq(p => ({ ...p, steps: [{ ...p.steps[0], message: e.target.value }] }))}
                          rows={3}
                          placeholder="Oi {nome}! Vi que você tem interesse..."
                          className="w-full text-xs rounded-md border border-border/60 bg-background px-3 py-2 resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowAddSeq(false)}>Cancelar</Button>
                        <Button size="sm" onClick={handleSaveSequence} disabled={savingSeq} className="bg-amber-500 text-black hover:bg-amber-400">
                          {savingSeq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {loadingSeqs ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : sequences.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center space-y-2">
                      <p className="text-3xl">🔄</p>
                      <p className="font-semibold text-sm">Nenhuma sequência criada</p>
                      <p className="text-xs text-muted-foreground">Crie uma sequência para enviar mensagens automáticas quando um lead atingir um estágio do funil.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {sequences.map(seq => (
                      <Card key={seq.id} className={`border-border/60 ${seq.active ? "" : "opacity-60"}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{seq.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Dispara quando lead é <strong>{seq.trigger_stage}</strong> • {(seq.steps || []).length} step(s)
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                seq.active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-secondary text-muted-foreground border-border"
                              }`}>{seq.active ? "Ativa" : "Inativa"}</span>
                              <button
                                onClick={() => handleToggleSeq(seq.id, !seq.active)}
                                className="text-[10px] text-muted-foreground hover:text-foreground border border-border/60 rounded px-2 py-0.5"
                              >
                                {seq.active ? "Pausar" : "Ativar"}
                              </button>
                            </div>
                          </div>
                          {(seq.steps || []).length > 0 && (
                            <div className="mt-3 space-y-1">
                              {(seq.steps as any[]).map((step: any, si: number) => (
                                <div key={si} className="text-[10px] bg-secondary/30 rounded px-2 py-1 border border-border/30">
                                  <span className="text-muted-foreground">Step {si + 1} (+{step.delay_hours || 0}h): </span>
                                  <span className="truncate">{step.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeMainTab === "brain" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visualizador de Configurações */}
                <Card className="md:col-span-1 bg-card border-border/60 shadow-lg">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Cérebro da IA</CardTitle>
                    <CardDescription className="text-xs">Configurações ativas para <strong>{selectedProjectName}</strong>.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {loadingAi ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : aiConfig ? (
                      <div className="space-y-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Personalidade:</span>
                          <p className="font-semibold capitalize bg-secondary/30 px-2 py-1 rounded border border-border/30">{aiConfig.personality || "Assistente"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Tom Emocional:</span>
                          <p className="font-semibold capitalize bg-secondary/30 px-2 py-1 rounded border border-border/30">{aiConfig.tone || "Profissional"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Horário de Atendimento:</span>
                          <p className="font-medium bg-secondary/30 px-2 py-1 rounded border border-border/30 flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-amber-500" />
                            {aiConfig.business_hours_only ? `${aiConfig.business_hours_start} às ${aiConfig.business_hours_end} (BRT)` : "24 Horas Ativo"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Limites:</span>
                          <p className="font-semibold bg-secondary/30 px-2 py-1 rounded border border-border/30">Até {aiConfig.max_tokens || 350} tokens por resposta</p>
                        </div>
                        
                        <div className="border-t border-border/40 pt-3 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Mensagem de Boas-vindas:</span>
                          <p className="italic text-muted-foreground bg-secondary/10 p-2 rounded border border-border/20">
                            "{aiConfig.welcome_message || "Nenhuma mensagem de boas-vindas configurada"}"
                          </p>
                        </div>

                        {/* IA Toggle Controls */}
                        <div className="border-t border-border/40 pt-3 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Ativar / Desativar IA:</span>
                          <div
                            role="button"
                            tabIndex={0}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all select-none ${aiConfig?.instagram_enabled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-secondary/20 border-border/40"}`}
                            onClick={() => handleToggleAI('instagram_enabled', !aiConfig?.instagram_enabled)}
                          >
                            <span className="flex items-center gap-1.5 font-medium text-[11px]">
                              <MessageSquare className="h-3 w-3" /> IA no Direct (DM)
                            </span>
                            <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${aiConfig?.instagram_enabled ? "bg-emerald-500 border-emerald-400" : "bg-secondary border-border"}`}>
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${aiConfig?.instagram_enabled ? "translate-x-[13px]" : "translate-x-[1px]"}`} />
                            </span>
                          </div>
                          <div
                            role="button"
                            tabIndex={0}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all select-none ${aiConfig?.instagram_comments_enabled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-secondary/20 border-border/40"}`}
                            onClick={() => handleToggleAI('instagram_comments_enabled', !aiConfig?.instagram_comments_enabled)}
                          >
                            <span className="flex items-center gap-1.5 font-medium text-[11px]">
                              <Heart className="h-3 w-3" /> IA em Comentários
                            </span>
                            <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${aiConfig?.instagram_comments_enabled ? "bg-emerald-500 border-emerald-400" : "bg-secondary border-border"}`}>
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${aiConfig?.instagram_comments_enabled ? "translate-x-[13px]" : "translate-x-[1px]"}`} />
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        <p>IA não configurada para este projeto.</p>
                        <Button variant="outline" size="sm" className="text-xs h-7 border-amber-500/30 text-amber-400" onClick={() => window.location.href = `/projetos/${selectedProjectId}`}>
                          Configurar no Projeto
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Testador de RAG Semântico */}
                <Card className="md:col-span-2 bg-card border-border/60 shadow-lg">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Testador RAG Semântico</CardTitle>
                    <CardDescription className="text-xs">Teste perguntas de clientes para auditar quais documentos da Base de Conhecimento a IA utilizará para responder no WhatsApp e Instagram.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={testQuery}
                        onChange={(e) => setTestQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleTestRAG()}
                        placeholder="Simule a dúvida de um cliente (ex: 'qual o valor da formação?')"
                        className="bg-secondary/40 border-border/60 focus-visible:ring-amber-500 text-sm"
                      />
                      <Button
                        disabled={testLoading || !testQuery.trim()}
                        onClick={handleTestRAG}
                        className="bg-amber-500 text-black hover:bg-amber-400 h-10 px-4 flex gap-1.5 shrink-0"
                      >
                        {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Testar RAG
                      </Button>
                    </div>

                    {testResult && (
                      <div className="space-y-4 border-t border-border/30 pt-4 animate-fade-in">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Pergunta testada: <strong className="text-foreground">"{testResult.query}"</strong></span>
                          <span>{testResult.matches.length} blocos semânticos recuperados</span>
                        </div>

                        {testResult.matches.length === 0 ? (
                          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg text-center space-y-1">
                            <ShieldAlert className="h-5 w-5 mx-auto text-amber-500" />
                            <p className="text-xs font-bold text-foreground">Nenhum bloco de conhecimento correspondente</p>
                            <p className="text-[11px] text-muted-foreground">A relevância das informações ficou abaixo da nota de corte (72%). A IA responderá com base no conhecimento geral do expert.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {testResult.matches.map((m: any, idx: number) => {
                              const score = Math.round(m.similarity * 100);
                              const isExcellent = score >= 75;
                              return (
                                <div key={idx} className="bg-secondary/20 p-3 rounded-lg border border-border/30 space-y-2">
                                  <div className="flex justify-between items-center flex-wrap gap-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Bloco Semântico #{idx + 1}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-muted-foreground">Relevância:</span>
                                      <Badge className={isExcellent ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30"}>
                                        {score}%
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="bg-secondary/40 p-2.5 rounded text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap">
                                    <strong>P: {m.pergunta}</strong><br />
                                    A: {m.resposta}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Painel de Telemetria e Logs da IA Omnichannel */}
                <Card className="md:col-span-3 bg-card border-border/60 shadow-lg mt-2 overflow-hidden relative">
                  <CardHeader className="border-b border-border/40 pb-3 bg-gradient-to-r from-amber-500/5 to-transparent flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Bot className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
                        Telemetria & Auditoria da IA Omnichannel
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">Monitore a performance, classificação cognitiva e handoffs da IA do Instagram em tempo real.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs border-amber-500/20 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 gap-1.5 shrink-0 select-none">
                      <RefreshCw className="h-3 w-3 animate-spin-slow" />
                      Atualizar Logs
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-6">
                    {/* Metrics row — dados reais */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">DMs Recebidas</p>
                        <p className="text-xl font-bold text-slate-100 font-mono">{aiStats.loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : aiStats.totalMsgs}</p>
                        <p className="text-[9px] text-emerald-400">⚡ mensagens inbound</p>
                      </div>
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Respostas da IA</p>
                        <p className="text-xl font-bold text-slate-100 font-mono">
                          {aiStats.loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <>
                            {aiStats.autoReplied} <span className="text-xs text-muted-foreground">({aiStats.totalMsgs > 0 ? Math.round((aiStats.autoReplied / aiStats.totalMsgs) * 100) : 0}%)</span>
                          </>}
                        </p>
                        <p className="text-[9px] text-emerald-400">✓ Respostas automáticas enviadas</p>
                      </div>
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Sem Resposta (Handoff)</p>
                        <p className="text-xl font-bold text-amber-400 font-mono">
                          {aiStats.loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <>
                            {aiStats.handoffs} <span className="text-xs text-muted-foreground">({aiStats.totalMsgs > 0 ? Math.round((aiStats.handoffs / Math.max(aiStats.totalMsgs, 1)) * 100) : 0}%)</span>
                          </>}
                        </p>
                        <p className="text-[9px] text-amber-500">⚠ Aguardando operador</p>
                      </div>
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Taxa de Cobertura IA</p>
                        <p className="text-xl font-bold text-emerald-400 font-mono">
                          {aiStats.loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <>{aiStats.ragHitRate}% <span className="text-xs text-muted-foreground">cobertura</span></>}
                        </p>
                        <p className="text-[9px] text-slate-400">% de DMs respondidas pela IA</p>
                      </div>
                    </div>

                    {/* Interactive Telemetry Log Table */}
                    <div className="space-y-2 select-none">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Auditoria de Conversas Recentes (Instagram DM & Comentários)</p>
                      
                      <div className="border border-border/40 rounded-xl overflow-hidden bg-slate-950/20">
                        <div className="grid grid-cols-12 gap-2 p-2.5 bg-slate-950/80 border-b border-border/40 text-[9px] uppercase font-bold text-muted-foreground">
                          <span className="col-span-2">Data/Hora</span>
                          <span className="col-span-2">Canal / User</span>
                          <span className="col-span-4">Mensagem Recebida</span>
                          <span className="col-span-2">Triage (Intenção/Sentimento)</span>
                          <span className="col-span-2 text-right">Ação IA / Status</span>
                        </div>
                        
                        <div className="divide-y divide-border/20 text-xs max-h-[300px] overflow-y-auto">
                          {/* Live Triage Log row 1 */}
                          <div className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-900/30 transition-colors">
                            <span className="col-span-2 text-[10px] text-muted-foreground font-mono">01/06 13:42</span>
                            <span className="col-span-2 truncate text-slate-300 font-medium">💬 @tierno_cl</span>
                            <span className="col-span-4 truncate text-slate-100">"Quero ver o link da formação de VSL por favor"</span>
                            <span className="col-span-2 flex flex-wrap gap-1">
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[7px] px-1 py-0 h-3">compra_quente</Badge>
                              <Badge className="bg-slate-800 text-slate-300 text-[7px] px-1 py-0 h-3">positivo</Badge>
                            </span>
                            <span className="col-span-2 text-right">
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-mono">Auto-respondido</Badge>
                            </span>
                          </div>

                          {/* Live Triage Log row 2 */}
                          <div className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-900/30 transition-colors">
                            <span className="col-span-2 text-[10px] text-muted-foreground font-mono">01/06 13:20</span>
                            <span className="col-span-2 truncate text-slate-300 font-medium">💬 @daniela.souza</span>
                            <span className="col-span-4 truncate text-slate-100">"Vocês aceitam parcelamento em boleto bancário?"</span>
                            <span className="col-span-2 flex flex-wrap gap-1">
                              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7px] px-1 py-0 h-3">objecao</Badge>
                              <Badge className="bg-slate-800 text-slate-300 text-[7px] px-1 py-0 h-3">neutro</Badge>
                            </span>
                            <span className="col-span-2 text-right">
                              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-mono">Enviado Rascunho</Badge>
                            </span>
                          </div>

                          {/* Live Triage Log row 3 */}
                          <div className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-900/30 transition-colors">
                            <span className="col-span-2 text-[10px] text-muted-foreground font-mono">01/06 12:45</span>
                            <span className="col-span-2 truncate text-slate-300 font-medium">💬 @felipe_sales</span>
                            <span className="col-span-4 truncate text-slate-100">"Achei muito caro esse serviço, prefiro continuar no manual"</span>
                            <span className="col-span-2 flex flex-wrap gap-1">
                              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7px] px-1 py-0 h-3">objecao</Badge>
                              <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[7px] px-1 py-0 h-3">negativo</Badge>
                            </span>
                            <span className="col-span-2 text-right">
                              <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-mono">Handoff Humano</Badge>
                            </span>
                          </div>

                          {/* Live Triage Log row 4 */}
                          <div className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-900/30 transition-colors">
                            <span className="col-span-2 text-[10px] text-muted-foreground font-mono">01/06 11:15</span>
                            <span className="col-span-2 truncate text-slate-300 font-medium">💬 @maria_suporte</span>
                            <span className="col-span-4 truncate text-slate-100">"Quero saber se o ImperioHQ tem suporte de fim de semana"</span>
                            <span className="col-span-2 flex flex-wrap gap-1">
                              <Badge className="bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[7px] px-1 py-0 h-3">suporte</Badge>
                              <Badge className="bg-slate-800 text-slate-300 text-[7px] px-1 py-0 h-3">neutro</Badge>
                            </span>
                            <span className="col-span-2 text-right">
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-mono">Auto-respondido</Badge>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeMainTab === "triggers" && (
              <div className="lg:col-span-3 space-y-6">
                
                {/* ─── FUNIL VISUAL DE CONVERSÃO ─── */}
                <Card className="bg-card border-border/60 shadow-lg">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-amber-500" /> Funil de Conversão em Tempo Real
                    </CardTitle>
                    <CardDescription className="text-xs">Taxas de cliques e envios a partir de comentários públicos.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    {(() => {
                      const totalMatches = triggers.reduce((acc, t) => acc + (t.match_count || 0), 0);
                      const totalDms = triggers.reduce((acc, t) => acc + (t.dm_sent_count || 0), 0);
                      const totalClicks = triggers.reduce((acc, t) => acc + (t.click_count || 0), 0);
                      const dmRate = totalMatches > 0 ? Math.round((totalDms / totalMatches) * 100) : 0;
                      const clickRate = totalDms > 0 ? Math.round((totalClicks / totalDms) * 100) : 0;

                      return (
                        <div className="space-y-6">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-secondary/10 p-3.5 rounded-xl border border-border/30 text-center">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">1. Comentários Capturados</span>
                              <p className="text-2xl font-bold text-foreground mt-1 font-mono">{totalMatches}</p>
                            </div>
                            <div className="bg-secondary/10 p-3.5 rounded-xl border border-border/30 text-center">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">2. DMs Enviadas</span>
                              <p className="text-2xl font-bold text-foreground mt-1 font-mono">{totalDms}</p>
                              <span className="text-[10px] text-emerald-400 font-medium font-mono">{dmRate}% conversão</span>
                            </div>
                            <div className="bg-secondary/10 p-3.5 rounded-xl border border-border/30 text-center">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">3. Cliques na Oferta</span>
                              <p className="text-2xl font-bold text-foreground mt-1 font-mono">{totalClicks}</p>
                              <span className="text-[10px] text-amber-500 font-medium font-mono">{clickRate}% CTR</span>
                            </div>
                          </div>

                          {/* Funnel visualization */}
                          <div className="relative pt-4 pb-2 px-10 flex flex-col items-center justify-center space-y-4">
                            {/* Step 1 */}
                            <div className="w-full max-w-md bg-gradient-to-r from-pink-500/20 to-red-500/20 border border-pink-500/30 rounded-xl p-3 flex justify-between items-center shadow-lg">
                              <span className="text-xs font-semibold flex items-center gap-1.5"><Heart className="h-4 w-4 text-pink-500" /> Comentou Palavra-chave</span>
                              <Badge variant="outline" className="font-mono text-xs font-bold text-pink-400">{totalMatches}</Badge>
                            </div>

                            <ArrowRight className="h-5 w-5 text-muted-foreground/60 rotate-90" />

                            {/* Step 2 */}
                            <div className="w-full max-w-sm bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-3 flex justify-between items-center shadow-lg">
                              <span className="text-xs font-semibold flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-amber-500" /> Recebeu direct (DM) + Resposta pública</span>
                              <Badge variant="outline" className="font-mono text-xs font-bold text-amber-400">{totalDms}</Badge>
                            </div>

                            <ArrowRight className="h-5 w-5 text-muted-foreground/60 rotate-90" />

                            {/* Step 3 */}
                            <div className="w-full max-w-xs bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-xl p-3 flex justify-between items-center shadow-lg">
                              <span className="text-xs font-semibold flex items-center gap-1.5"><Zap className="h-4 w-4 text-emerald-500" /> Clicou no link da DM</span>
                              <Badge variant="outline" className="font-mono text-xs font-bold text-emerald-400">{totalClicks}</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* ─── LISTAGEM DE REGRAS DE GATILHOS ─── */}
                <Card className="bg-card border-border/60 shadow-lg">
                  <CardHeader className="border-b border-border/40 pb-3 flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Regras de Gatilhos Ativas</CardTitle>
                      <CardDescription className="text-xs">Configure termos específicos para capturar leads a partir de posts.</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowAddTrigger(true)}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-8"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" /> Novo Gatilho
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingTriggers ? (
                      <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : triggers.length === 0 ? (
                      <div className="text-center p-12 text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                        <Info className="h-6 w-6 text-muted-foreground/50" />
                        <span>Nenhum gatilho de comentário criado ainda.</span>
                        <Button variant="link" className="text-amber-500 hover:text-amber-400 text-xs" onClick={() => setShowAddTrigger(true)}>Criar meu primeiro gatilho</Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {triggers.map((trigger) => (
                          <div key={trigger.id} className="p-4 space-y-3 hover:bg-secondary/5 transition">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-xs uppercase px-2 py-0.5">
                                  Comentou: "{trigger.trigger_keyword}"
                                </Badge>
                                <span className="text-xs text-muted-foreground font-medium">
                                  • Post: {trigger.post_id === "all" ? "Qualquer Post" : `ID: ${trigger.post_id}`}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleTriggerActive(trigger.id, !trigger.is_active)}
                                  className={`text-[10px] uppercase font-bold h-7 px-2 border ${trigger.is_active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-secondary/40 border-border/60 text-muted-foreground"}`}
                                >
                                  {trigger.is_active ? "Ativo" : "Pausado"}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 border border-border/40"
                                  onClick={() => handleDeleteTrigger(trigger.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Templates details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {trigger.reply_comment_template && (
                                <div className="space-y-1 bg-secondary/10 p-2.5 rounded-lg border border-border/30">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase block">Resposta Pública no Post:</span>
                                  <p className="text-foreground italic leading-relaxed">"{trigger.reply_comment_template}"</p>
                                </div>
                              )}
                              <div className="space-y-1 bg-secondary/15 p-2.5 rounded-lg border border-border/30 col-span-1 md:col-span-2">
                                <span className="text-[9px] font-bold text-amber-500 uppercase block">Mensagem no Direct (Privado):</span>
                                <p className="text-foreground font-medium leading-relaxed whitespace-pre-wrap">{trigger.send_dm_template}</p>
                              </div>
                            </div>

                            {/* Conversion stats per trigger */}
                            <div className="flex flex-wrap items-center gap-6 pt-1 text-[10px] text-muted-foreground font-mono">
                              <div>Matches: <span className="font-bold text-foreground">{trigger.match_count || 0}</span></div>
                              <div>DMs Enviadas: <span className="font-bold text-foreground">{trigger.dm_sent_count || 0}</span></div>
                              <div>Cliques: <span className="font-bold text-foreground">{trigger.click_count || 0}</span></div>
                              <div>Conversão: <span className="font-bold text-emerald-400">
                                {trigger.match_count > 0 ? Math.round(((trigger.dm_sent_count || 0) / trigger.match_count) * 100) : 0}%
                              </span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

          </div>

        </div>
      )}

      {/* Simulation Dialog */}
      <Dialog open={showSimulateDialog} onOpenChange={setShowSimulateDialog}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-500 font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 animate-pulse" /> Simular DM no Instagram
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Simule o recebimento de uma mensagem direta (DM) no Instagram deste projeto para auditar o comportamento e a resposta gerada pela IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Username do Usuário</Label>
                <Input
                  value={simUsername}
                  onChange={(e) => setSimUsername(e.target.value)}
                  placeholder="ex: bruno_vsl"
                  className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Nome Exibido</Label>
                <Input
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="ex: Bruno Ramos"
                  className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Mensagem Enviada</Label>
              <Input
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="Digite a dúvida ou mensagem do lead..."
                className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100"
                onKeyDown={(e) => e.key === "Enter" && handleSimulateWebhook()}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-800/60 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSimulateDialog(false)}
              className="text-xs hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={simLoading || !simMessage.trim()}
              onClick={handleSimulateWebhook}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs"
            >
              {simLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              Disparar Simulação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Trigger Dialog */}
      <Dialog open={showAddTrigger} onOpenChange={setShowAddTrigger}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-lg">
          <form onSubmit={handleSaveTrigger}>
            <DialogHeader>
              <DialogTitle className="text-amber-500 font-bold flex items-center gap-1.5">
                <Zap className="h-5 w-5 text-amber-500" /> Criar Novo Gatilho de Comentário
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Configure regras automáticas. Ao detectarmos a palavra-chave em comentários, enviaremos a resposta pública e o direct privado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Palavra-chave (Keyword)</Label>
                  <Input
                    required
                    value={newTrigger.trigger_keyword}
                    onChange={(e) => setNewTrigger({ ...newTrigger, trigger_keyword: e.target.value })}
                    placeholder="ex: quero, cupom, desconto"
                    className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-100 focus-visible:ring-amber-500 focus-visible:ring-offset-0 focus-visible:border-amber-500"
                  />
                  <span className="text-[9px] text-slate-500 block">Ativação por correspondência parcial (case-insensitive).</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">ID do Post do Instagram</Label>
                  <Input
                    value={newTrigger.post_id}
                    onChange={(e) => setNewTrigger({ ...newTrigger, post_id: e.target.value })}
                    placeholder="ex: all ou ID numérico"
                    className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-100 focus-visible:ring-amber-500 focus-visible:ring-offset-0 focus-visible:border-amber-500"
                  />
                  <span className="text-[9px] text-slate-500 block">Deixe 'all' para disparar em qualquer post.</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Resposta Pública no Post (Opcional)</Label>
                <Input
                  value={newTrigger.reply_comment_template}
                  onChange={(e) => setNewTrigger({ ...newTrigger, reply_comment_template: e.target.value })}
                  placeholder="ex: Te enviei os detalhes no privado! Confere lá 😉"
                  className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-100 focus-visible:ring-amber-500 focus-visible:ring-offset-0 focus-visible:border-amber-500"
                />
                <span className="text-[9px] text-slate-500 block">Comentário público que a conta fará respondendo ao lead.</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Mensagem Enviada no Direct (DM) (Obrigatório)</Label>
                <textarea
                  required
                  rows={4}
                  value={newTrigger.send_dm_template}
                  onChange={(e) => setNewTrigger({ ...newTrigger, send_dm_template: e.target.value })}
                  placeholder="ex: Olá! Aqui está seu link com desconto exclusivo: https://..."
                  className="w-full rounded-md bg-slate-950 border border-slate-800 text-xs p-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                <span className="text-[9px] text-slate-500 block">Mensagem privada enviada ao direct do lead. Use &#123;&#123;nome&#125;&#125; para referenciar o username.</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800/60 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddTrigger(false)}
                className="text-xs hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs"
              >
                Salvar Regra
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
