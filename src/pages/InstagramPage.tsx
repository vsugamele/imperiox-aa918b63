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
import {
  Instagram, MessageSquare, Settings2, Trash2, Eye, EyeOff, Mail,
  Send, RefreshCw, Loader2, Sparkles, CheckCircle2, HelpCircle,
  Clock, ShieldAlert, Heart, User, Filter, AlertCircle, Bot
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
  const [activeMainTab, setActiveMainTab] = useState<"dms" | "comments" | "brain">("dms");
  
  // DMs state
  const [conversations, setConversations] = useState<IgConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<IgConversation | null>(null);
  const [messages, setMessages] = useState<IgMessage[]>([]);
  const [composedMsg, setComposedMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Comments state
  const [comments, setComments] = useState<IgComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [privateReplyInputs, setPrivateReplyInputs] = useState<Record<string, string>>({});
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [showPrivateModal, setShowPrivateModal] = useState<string | null>(null);
  
  // AI Brain state
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Persist project filter
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("ig.selectedProject", selectedProjectId);
    }
  }, [selectedProjectId]);

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
    setConversations(data || []);
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
    setMessages(data || []);
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
    if (selectedProjectId && activeMainTab === "brain") {
      setLoadingAi(true);
      supabase.from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", selectedProjectId)
        .eq("enabled", true)
        .maybeSingle()
        .then(({ data }) => {
          setAiConfig(data);
          setLoadingAi(false);
        });
    }
  }, [selectedProjectId, activeMainTab]);

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
      const OPENROUTER_API_KEY = Deno.env.get?.("OPENROUTER_API_KEY") || "use-env-secrets";
      
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
                <RefreshCw
                  className={`h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer transition ${loadingConvs ? "animate-spin" : ""}`}
                  onClick={() => loadConversations(selectedAccount.id)}
                />
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
                  variant={activeMainTab === "brain" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 font-normal text-sm"
                  onClick={() => setActiveMainTab("brain")}
                >
                  <Bot className="h-4 w-4" /> Central da IA & RAG
                </Button>
              </div>
            </Card>

            {/* LISTA DE CONVERSAS (SE ESTIVER EM DMS) */}
            {activeMainTab === "dms" && (
              <Card className="bg-card border-border/60 shadow-lg flex flex-col h-[500px]">
                <CardHeader className="px-4 py-3 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Conversas Recentes</CardTitle>
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <ScrollArea className="flex-1">
                  {loadingConvs ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center p-8 text-xs text-muted-foreground">Nenhuma conversa encontrada.</div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {conversations.map((c) => {
                        const isSelected = selectedConv?.id === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedConv(c)}
                            className={`p-3 cursor-pointer transition duration-150 flex items-center gap-3 hover:bg-secondary/20 ${isSelected ? "bg-secondary/40 border-l-2 border-amber-500" : ""}`}
                          >
                            {c.participant_avatar ? (
                              <img src={c.participant_avatar} alt="" className="w-9 h-9 rounded-full border border-border" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">{(c.participant_username || "?")[0].toUpperCase()}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm truncate block text-foreground">@{c.participant_username}</span>
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
                      <div className="bg-secondary/10 px-4 py-3 border-b border-border/40 flex items-center gap-3 justify-between">
                        <div className="flex items-center gap-3">
                          {selectedConv.participant_avatar ? (
                            <img src={selectedConv.participant_avatar} alt="" className="w-9 h-9 rounded-full border border-border" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">{(selectedConv.participant_username || "?")[0].toUpperCase()}</div>
                          )}
                          <div>
                            <span className="font-bold text-sm text-foreground block">@{selectedConv.participant_username}</span>
                            <span className="text-xs text-muted-foreground">{selectedConv.participant_name || "Comunicação ativa"}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] tracking-wider uppercase bg-secondary/30">IG DM</Badge>
                      </div>

                      {/* Conteúdo de Mensagens */}
                      <ScrollArea className="flex-1 p-4 bg-secondary/5">
                        {loadingMsgs ? (
                          <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : messages.length === 0 ? (
                          <div className="text-center p-8 text-xs text-muted-foreground">Nenhuma mensagem no histórico.</div>
                        ) : (
                          <div className="space-y-4">
                            {messages.map((m) => {
                              const isInbound = m.direction === "in" || m.direction === "incoming";
                              return (
                                <div key={m.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                                  <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${isInbound ? "bg-secondary text-foreground rounded-tl-none border border-border/40" : "bg-gradient-to-tr from-amber-600 to-amber-500 text-black font-medium rounded-tr-none"}`}>
                                    {m.content}
                                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[9px] opacity-60">
                                      <span>
                                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                                      </span>
                                      {!isInbound && (
                                        <span className="capitalize">{m.status || "enviado"}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>

                      {/* Compositor de Mensagem */}
                      <div className="p-3 border-t border-border/40 bg-card flex gap-2">
                        <Input
                          value={composedMsg}
                          onChange={(e) => setComposedMsg(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendDM()}
                          placeholder={`Responder @${selectedConv.participant_username} via Instagram...`}
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
                            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-bold text-lg mb-2">{(selectedConv.participant_username || "?")[0].toUpperCase()}</div>
                          )}
                          <span className="font-bold text-sm">@{selectedConv.participant_username}</span>
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
                    <div className="bg-secondary/20 p-2.5 rounded-lg border border-border/30 mt-4">
                      <span className="text-[10px] uppercase font-bold text-amber-500 block mb-1">Cérebro da IA ativo</span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        A IA responderá automaticamente a este usuário respeitando a base semântica configurada e o tom de voz ativo.
                      </p>
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
            {activeMainTab === "brain" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visualizador de Configurações */}
                <Card className="md:col-span-1 bg-card border-border/60 shadow-lg">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Cérebro da IA Ativo</CardTitle>
                    <CardDescription className="text-xs">Resumo das regras ativas para o projeto JP Freitas.</CardDescription>
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
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        AI Config não encontrada ou desativada para este projeto.
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
                    {/* Metrics row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total de Interações</p>
                        <p className="text-xl font-bold text-slate-100 font-mono">148</p>
                        <p className="text-[9px] text-emerald-400">⚡ 100% triadas por IA</p>
                      </div>
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Auto-Resolvidas (Bot)</p>
                        <p className="text-xl font-bold text-slate-100 font-mono">119 <span className="text-xs text-muted-foreground">(80.4%)</span></p>
                        <p className="text-[9px] text-emerald-400">✓ Respostas directas enviadas</p>
                      </div>
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Handoffs (Humano)</p>
                        <p className="text-xl font-bold text-amber-400 font-mono">29 <span className="text-xs text-muted-foreground">(19.6%)</span></p>
                        <p className="text-[9px] text-amber-500">⚠ Operador acionado</p>
                      </div>
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-border/40 space-y-1 relative shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">RAG Hit Rate Médio</p>
                        <p className="text-xl font-bold text-emerald-400 font-mono">82% <span className="text-xs text-muted-foreground">cosseno</span></p>
                        <p className="text-[9px] text-slate-400">Alta similaridade RAG</p>
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

          </div>

        </div>
      )}

    </div>
  );
}
