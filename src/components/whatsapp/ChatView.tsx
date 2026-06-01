import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, FileText, ChevronUp, Check, CheckCheck, Image, Paperclip, Smile, Download, Pencil, X, Brain, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import ContactTagsPanel from "./ContactTagsPanel";

const PAGE_SIZE = 50;
const EDIT_WINDOW_MIN = 15;

interface Message {
  id: string;
  direction: string;
  content: string;
  phone: string;
  created_at: string;
  status: string;
  message_type?: string;
  media_url?: string;
  metadata?: any;
  provider_message_id?: string | null;
  _optimistic?: boolean;
}

interface WaTemplate {
  id: string; name: string; content: string; category: string; project_id: string | null;
}

interface WaCommand {
  id: string; trigger_word: string; response_text: string | null;
  sequence?: Array<{ content: string; delay_seconds?: number; media_url?: string; media_type?: string }>;
}

interface Props {
  conversationId: string;
  phone: string;
  projectId: string;
  providerId: string | null;
}

const EMOJI_LIST = ["😀", "😂", "❤️", "👍", "🙏", "🔥", "✅", "⭐", "💪", "🎉", "😍", "🤝", "💰", "📦", "🚀", "💡"];

// Status indicators
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "sending":
      return <Loader2 className="h-2.5 w-2.5 animate-spin" />;
    case "sent":
    case "pending":
      return <Check className="h-2.5 w-2.5" />;
    case "delivered":
      return <CheckCheck className="h-2.5 w-2.5" />;
    case "read":
    case "played":
      return <CheckCheck className="h-2.5 w-2.5 text-sky-400" />;
    case "error":
      return <span className="text-destructive text-[9px]">!</span>;
    default:
      return <Check className="h-2.5 w-2.5" />;
  }
}

// Extract filename from message content (e.g. "📎 file.pdf") or URL
function extractFilename(content: string | undefined, url: string | undefined): string {
  if (content) {
    const cleaned = content.replace(/^[📎🎵🎬🖼️]\s*/u, "").trim();
    if (cleaned && !/^(mídia|midia|imagem|áudio|audio|vídeo|video|arquivo|document)$/i.test(cleaned)) {
      return cleaned;
    }
  }
  if (url) {
    try {
      const u = new URL(url);
      const last = u.pathname.split("/").pop();
      if (last) return decodeURIComponent(last);
    } catch {}
  }
  return "arquivo";
}

// Force-download a remote file as a blob (bypasses inline PDF rendering / cross-origin issues)
async function forceDownload(url: string, filename: string) {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err: any) {
    toast.error("Falha ao baixar: " + err.message);
    window.open(url, "_blank");
  }
}

// Small overlay download button reused across media types
function DownloadBtn({ url, filename, className }: { url: string; filename: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); forceDownload(url, filename); }}
      title="Baixar"
      className={
        "inline-flex items-center justify-center rounded-full bg-background/80 hover:bg-background text-foreground p-1.5 shadow transition-colors " +
        (className || "")
      }
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  );
}

// Media renderers
function MediaContent({ message }: { message: Message }) {
  const { message_type, media_url, content } = message;

  if (!media_url && message_type === "text") return null;
  if (!media_url) return null;

  const filename = extractFilename(content, media_url);

  if (message_type === "image") {
    return (
      <div className="mb-1 relative group">
        <img
          src={media_url}
          alt={filename}
          className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(media_url, "_blank")}
          loading="lazy"
        />
        <DownloadBtn url={media_url} filename={filename} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100" />
      </div>
    );
  }

  if (message_type === "audio") {
    return (
      <div className="mb-1 flex items-center gap-2">
        <audio controls className="max-w-full h-8 flex-1" preload="none">
          <source src={media_url} />
        </audio>
        <DownloadBtn url={media_url} filename={filename} />
      </div>
    );
  }

  if (message_type === "video") {
    return (
      <div className="mb-1 relative group">
        <video controls className="rounded-lg max-w-full max-h-56" preload="none">
          <source src={media_url} />
        </video>
        <DownloadBtn url={media_url} filename={filename} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100" />
      </div>
    );
  }

  if (message_type === "document") {
    return (
      <div className="flex items-center gap-2 bg-background/30 rounded-lg px-3 py-2 mb-1">
        <FileText className="h-5 w-5 shrink-0" />
        <a
          href={media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs truncate flex-1 hover:underline"
          title={filename}
        >
          {filename}
        </a>
        <DownloadBtn url={media_url} filename={filename} />
      </div>
    );
  }

  return null;
}

const ChatView = React.forwardRef<HTMLDivElement, Props>(
  ({ conversationId, phone, projectId, providerId }, ref) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [commands, setCommands] = useState<WaCommand[]>([]);
    const [commandSuggestions, setCommandSuggestions] = useState<WaCommand[]>([]);
    const [showCommands, setShowCommands] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isComposingRef = useRef(false);
    const initialLoadDone = useRef(false);
    const newestTimestampRef = useRef<string | null>(null);
    const [draft, setDraft] = useState<{ id: string; suggested_text: string; model?: string } | null>(null);
    const [loadingCopilot, setLoadingCopilot] = useState(false);

    const generateCopilotSuggestion = async () => {
      if (messages.length === 0) {
        toast.error("Nenhuma mensagem na conversa para analisar.");
        return;
      }
      setLoadingCopilot(true);
      try {
        const savedKeys = localStorage.getItem("imphq_api_keys");
        const apiKeys = savedKeys ? JSON.parse(savedKeys) : {};
        const orKey = apiKeys.openrouter;

        const [configRes, projectRes] = await Promise.all([
          supabase
            .from("imphq_wa_ai_config")
            .select("*")
            .eq("project_id", projectId)
            .eq("is_active", true)
            .maybeSingle(),
          supabase
            .from("imphq_projects")
            .select("name, data")
            .eq("id", projectId)
            .maybeSingle()
        ]);

        const aiConfig = configRes.data;
        const project = projectRes.data;

        let projectContext = "";
        let expertPersona = "";
        let customInstr = "";
        let productFocus = "";
        let personality = "assistente";
        let tone = "profissional";

        if (aiConfig) {
          expertPersona = aiConfig.expert_persona || "";
          customInstr = aiConfig.custom_instructions || "";
          productFocus = aiConfig.product_focus || "";
          personality = aiConfig.personality || "assistente";
          tone = aiConfig.tone || "profissional";
        }

        if (project) {
          const d: any = project.data || {};
          projectContext = `PROJETO: ${project.name}\n`;
          if (d.avatar) projectContext += `AVATAR (resumo): ${JSON.stringify(d.avatar).slice(0, 1000)}\n`;
          if (d.produtos) projectContext += `PRODUTOS: ${JSON.stringify(d.produtos).slice(0, 600)}\n`;
        }

        const personalityPrompts: Record<string, string> = {
          assistente: "Você é um assistente virtual cordial e prestativo.",
          vendedor: "Você é um closer de vendas persuasivo mas não agressivo. Foque em entender a dor e apresentar a solução.",
          suporte: "Você é um agente de suporte técnico eficiente e empático.",
          consultor: "Você é um consultor especialista. Fale com autoridade e dê recomendações valiosas.",
        };

        const toneInstructions: Record<string, string> = {
          profissional: "Tom profissional e direto.",
          casual: "Tom casual e descontraído, use emojis moderadamente.",
          amigavel: "Tom amigável e acolhedor, use emojis.",
          formal: "Tom formal e respeitoso.",
          urgente: "Tom de urgência e escassez.",
        };

        const systemPrompt = `${expertPersona ? `PERSONA DO EXPERT (incorpore essa voz de forma natural):\n${expertPersona}\n\n` : ""}${personalityPrompts[personality] || personalityPrompts.assistente}
${toneInstructions[tone] || toneInstructions.profissional}
Você está respondendo via WhatsApp para a empresa "${project?.name || ""}".
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}
${productFocus ? `\nOFERTA ATIVA (mencione quando fizer sentido):\n${productFocus}\n` : ""}
${customInstr ? `\nREGRAS DO EXPERT (obrigatórias, nunca quebre):\n${customInstr}\n` : ""}

REGRAS GERAIS DE CONVERSAÇÃO HUMANA:
- Responda em português brasileiro com fluidez e empatia natural, evite ser robótico, excessivamente polido ou formal (a menos que a instrução do tom seja formal).
- Seja EXTREMAMENTE CONCISO (máximo 1-2 parágrafos curtos). Mensagens longas são ignoradas no WhatsApp.
- Não envie listas de tópicos longas ou blocos densos de texto. Fale como uma pessoa real conversando.
- NUNCA repita apresentações ou diga "Olá, eu sou o assistente..." se a conversa já começou.
- Use WhatsApp formatting de forma leve: *negrito*, _itálico_.
- NUNCA invente informações sobre produtos, links de checkout ou preços que não estejam explicitamente detalhados no contexto.
- Se não souber a resposta exata para a pergunta, diga amigavelmente que vai verificar com a equipe e em seguida transfira para um humano.
- Se o lead pedir explicitamente para falar com um humano, diga que está chamando um atendente e pare imediatamente.`;

        const recentHistory = messages.slice(-10);
        const chatMessages: any[] = [{ role: "system", content: systemPrompt }];

        recentHistory.forEach((m) => {
          chatMessages.push({
            role: m.direction === "incoming" ? "user" : "assistant",
            content: m.content || ""
          });
        });

        let aiReply = "";

        if (orKey) {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${orKey}`,
              "HTTP-Referer": window.location.origin,
              "X-Title": "ImperioHQ Chat Copilot",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: chatMessages,
              temperature: 0.6,
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Erro OpenRouter: ${response.status} - ${errText}`);
          }

          const data = await response.json();
          aiReply = data.choices?.[0]?.message?.content || "";
        } else {
          toast.info("Chave OpenRouter não configurada. Usando gateway padrão...");
          const incomingMsgs = messages.filter(m => m.direction === "incoming");
          const lastIncomingText = incomingMsgs.length > 0 ? incomingMsgs[incomingMsgs.length - 1].content : "";

          const { data, error } = await supabase.functions.invoke("wa-ai-refine", {
            body: {
              prompt: lastIncomingText,
              project_id: projectId,
              history: messages.slice(-8).map(m => `${m.direction === "incoming" ? "Lead" : "Você"}: ${m.content}`).join("\n"),
            }
          });

          if (error) throw error;
          aiReply = data?.suggested_text || data?.reply || "";
        }

        if (aiReply.trim()) {
          setDraft({
            id: `copilot-${Date.now()}`,
            suggested_text: aiReply.trim(),
            model: orKey ? "Gemini-2.5" : "Imperius standard"
          });
          toast.success("Sugestão da IA gerada!");
        } else {
          toast.error("Não foi possível obter uma sugestão válida.");
        }

      } catch (err: any) {
        console.error("Copilot Error:", err);
        toast.error(`Falha no Copilot: ${err.message || "Erro desconhecido"}`);
      } finally {
        setLoadingCopilot(false);
      }
    };

    // Poll AI drafts (modo rascunho)
    useEffect(() => {
      if (!conversationId) return;
      setDraft(null); // Clear previous draft when changing conversations
      let stop = false;
      const fetchDraft = async () => {
        const { data } = await supabase
          .from("imphq_wa_ai_drafts")
          .select("id, suggested_text, model")
          .eq("conversation_id", conversationId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        if (!stop) {
          if (data) {
            setDraft(data as any);
          } else {
            // Only clear if the current draft is NOT a locally generated Copilot suggestion
            setDraft(prev => {
              if (prev && prev.id && prev.id.startsWith("copilot-")) {
                return prev; // Preserve local copilot drafts!
              }
              return null;
            });
          }
        }
      };
      fetchDraft();
      const t = setInterval(fetchDraft, 8000);
      return () => { stop = true; clearInterval(t); };
    }, [conversationId]);

    const resolveDraft = async (status: "used" | "edited" | "discarded", finalText?: string) => {
      if (!draft) return;
      const updates: any = { status, resolved_at: new Date().toISOString() };
      if (finalText) {
        updates.final_text = finalText;
        const a = draft.suggested_text || ""; const b = finalText || "";
        const dist = Math.abs(a.length - b.length);
        updates.diff_ratio = Math.min(1, dist / Math.max(a.length, 1));
      }
      await supabase.from("imphq_wa_ai_drafts").update(updates).eq("id", draft.id);
      setDraft(null);
    };

    useEffect(() => {
      supabase.from("imphq_wa_templates").select("*").order("name").then(({ data }) => setTemplates((data as any[]) || []));
    }, []);

    // Load commands for slash autocomplete
    useEffect(() => {
      supabase.from("imphq_wa_commands").select("id, trigger_word, response_text, sequence")
        .or(`project_id.eq.${projectId},project_id.is.null`)
        .eq("is_active", true)
        .order("trigger_word")
        .then(({ data }) => setCommands((data as any[]) || []));
    }, [projectId]);

    // Keep newestTimestampRef in sync
    useEffect(() => {
      if (messages.length > 0) {
        const real = messages.filter(m => !m._optimistic);
        if (real.length > 0) newestTimestampRef.current = real[real.length - 1].created_at;
      }
    }, [messages]);

    const loadInitial = useCallback(async () => {
      const { data } = await supabase
        .from("imphq_wa_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const sorted = ((data as any[]) || []).reverse();
      setMessages(sorted);
      setHasMore((data?.length || 0) >= PAGE_SIZE);
      initialLoadDone.current = true;
    }, [conversationId]);

    const loadMore = async () => {
      if (!hasMore || loadingMore || messages.length === 0) return;
      setLoadingMore(true);
      const oldest = messages[0]?.created_at;
      const { data } = await supabase
        .from("imphq_wa_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const older = ((data as any[]) || []).reverse();
      setMessages(prev => [...older, ...prev]);
      setHasMore((data?.length || 0) >= PAGE_SIZE);
      setLoadingMore(false);
    };

    const pollNew = useCallback(async () => {
      if (!initialLoadDone.current || !newestTimestampRef.current) return;
      const { data } = await supabase
        .from("imphq_wa_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .gt("created_at", newestTimestampRef.current)
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setMessages(prev => {
          const withoutOptimistic = prev.filter(m => !m._optimistic);
          return [...withoutOptimistic, ...(data as any[])];
        });
      }
    }, [conversationId]);

    useEffect(() => {
      initialLoadDone.current = false;
      newestTimestampRef.current = null;
      loadInitial();
      // Mark conversation as read
      supabase.rpc("mark_wa_conversation_read", { _conversation_id: conversationId }).then(() => {}, () => {});
    }, [conversationId, loadInitial]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    const startEdit = (m: Message) => {
      setEditingId(m.id);
      setEditText(m.content || "");
    };

    const saveEdit = async () => {
      if (!editingId || !editText.trim()) return;
      setEditSaving(true);
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-api?action=edit_message", {
          body: { message_id: editingId, new_text: editText.trim() },
        });
        if (error) throw error;
        if (data?.success === false) { toast.error(data.error || "Falha ao editar"); return; }
        toast.success("Mensagem editada");
        setMessages(prev => prev.map(m => m.id === editingId
          ? { ...m, content: editText.trim(), metadata: { ...(m.metadata || {}), edited_at: new Date().toISOString() } }
          : m));
        setEditingId(null);
        setEditText("");
      } catch (err: any) {
        toast.error("Erro ao editar: " + err.message);
      } finally {
        setEditSaving(false);
      }
    };


    useEffect(() => {
      const interval = setInterval(pollNew, 8000);
      return () => clearInterval(interval);
    }, [pollNew]);

    useEffect(() => {
      if (isComposingRef.current) return;
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    // Auto-resize textarea + slash command detection
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";

      // Slash command detection
      if (val.startsWith("/") && val.length > 0) {
        const query = val.substring(1).toLowerCase();
        const matched = commands.filter(c => c.trigger_word.toLowerCase().includes(query));
        setCommandSuggestions(matched);
        setShowCommands(matched.length > 0);
      } else {
        setShowCommands(false);
        setCommandSuggestions([]);
      }
    };

    const selectCommand = async (cmd: WaCommand) => {
      setShowCommands(false);
      setCommandSuggestions([]);
      const seq = Array.isArray(cmd.sequence) ? cmd.sequence : [];
      // If has sequence, send it as multi-step; otherwise fill input with response_text
      if (seq.length > 0) {
        setText("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        toast.info(`Enviando sequência (${seq.length} mensagens)…`);
        for (let i = 0; i < seq.length; i++) {
          const step = seq[i];
          if (i > 0 && step.delay_seconds) await new Promise(r => setTimeout(r, step.delay_seconds * 1000));
          await sendRaw(step.content, step.media_url, step.media_type);
        }
        setTimeout(() => pollNew(), 600);
      } else {
        setText(cmd.response_text || "");
        textareaRef.current?.focus();
      }
    };

    const sendRaw = async (content: string, mediaUrl?: string, mediaType?: string) => {
      if (!providerId) return;
      try {
        await supabase.functions.invoke("whatsapp-api?action=send_message", {
          body: {
            provider_id: providerId, phone, content,
            conversation_id: conversationId, project_id: projectId,
            ...(mediaUrl ? { media_url: mediaUrl, media_type: mediaType || "image" } : {}),
          },
        });
      } catch (e: any) {
        toast.error("Falha em passo da sequência: " + e.message);
      }
    };

    // Core upload+send used by both file picker and paste
    const uploadAndSendFile = async (file: File, captionOverride?: string) => {
      if (!providerId) { toast.error("Nenhum provider configurado"); return; }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) { toast.error("Arquivo muito grande (máx 10MB)"); return; }

      setUploading(true);
      try {
        const ext = (file.name.split(".").pop() || (file.type.split("/")[1] || "bin")).toLowerCase();
        const path = `chat/${projectId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("whatsapp-media").upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
        const mediaUrl = urlData.publicUrl;

        const mediaType = file.type.startsWith("image/") ? "image"
          : file.type.startsWith("video/") ? "video"
          : file.type.startsWith("audio/") ? "audio"
          : "document";

        const caption = captionOverride ?? (text || file.name);

        const optimisticMsg: Message = {
          id: `opt-${Date.now()}`,
          direction: "outgoing",
          content: caption,
          phone,
          created_at: new Date().toISOString(),
          status: "sending",
          message_type: mediaType,
          media_url: mediaUrl,
          _optimistic: true,
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
          body: {
            provider_id: providerId, phone, content: caption,
            conversation_id: conversationId, project_id: projectId,
            media_url: mediaUrl, media_type: mediaType, sent_by: "human",
          },
        });
        if (error) throw error;
        if (data?.success === false) {
          toast.error(data.error || "Erro ao enviar mídia");
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        } else {
          if (captionOverride === undefined) setText("");
          setTimeout(() => pollNew(), 500);
        }
      } catch (err: any) {
        toast.error("Erro ao enviar mídia: " + err.message);
      } finally {
        setUploading(false);
      }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await uploadAndSendFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              const ext = (blob.type.split("/")[1] || "png");
              const named = blob.name && blob.name !== "image.png"
                ? blob
                : new File([blob], `paste-${Date.now()}.${ext}`, { type: blob.type });
              toast.info("Enviando imagem colada…");
              uploadAndSendFile(named, "");
              return;
            }
          }
        }
      }
      requestAnimationFrame(() => textareaRef.current?.focus());
    };


    const send = async () => {
      if (!text.trim()) return;
      if (!providerId) { toast.error("Nenhum provider configurado para este projeto"); return; }

      const msgText = text;
      setText("");
      setShowCommands(false);
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const optimisticMsg: Message = {
        id: `opt-${Date.now()}`,
        direction: "outgoing",
        content: msgText,
        phone,
        created_at: new Date().toISOString(),
        status: "sending",
        message_type: "text",
        _optimistic: true,
      };
      setMessages(prev => [...prev, optimisticMsg]);

      setSending(true);
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
          body: { provider_id: providerId, phone, content: msgText, conversation_id: conversationId, project_id: projectId, sent_by: "human" },
        });
        if (error) throw error;
        if (data && data.success === false) {
          toast.error(data.error || "Erro ao enviar mensagem");
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
          setText(msgText);
          setSending(false);
          return;
        }
        if (data?.failover) {
          toast.warning(`Chip "${data.original_provider}" caiu — enviado via "${data.sent_via}".`);
        }
        setTimeout(() => pollNew(), 500);
      } catch (err: any) {
        toast.error("Erro ao enviar: " + err.message);
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        setText(msgText);
      } finally {
        setSending(false);
      }
    };

    // Group messages by date
    const getDateLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      
      if (d.toDateString() === today.toDateString()) return "Hoje";
      if (d.toDateString() === yesterday.toDateString()) return "Ontem";
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    let lastDateLabel = "";

    return (
      <div ref={ref} className="flex flex-col h-full">
        <ContactTagsPanel projectId={projectId} phone={phone} />
        {/* Chat area with WhatsApp-like pattern background */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}>
          <div className="p-4 space-y-1 max-w-3xl mx-auto">
            {hasMore && (
              <div className="flex justify-center mb-2">
                <Button size="sm" variant="ghost" className="text-xs gap-1 bg-background/80 backdrop-blur-sm rounded-full shadow-sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
                  Carregar anteriores
                </Button>
              </div>
            )}
            {messages.map((m) => {
              const dateLabel = getDateLabel(m.created_at);
              const showDate = dateLabel !== lastDateLabel;
              lastDateLabel = dateLabel;
              const isOutgoing = m.direction === "outgoing";
              const ageMin = (Date.now() - new Date(m.created_at).getTime()) / 60000;
              const canEdit = isOutgoing && !m._optimistic && (!m.message_type || m.message_type === "text")
                && !!m.provider_message_id && ageMin < EDIT_WINDOW_MIN;
              const isEditing = editingId === m.id;
              const editedAt = (m.metadata as any)?.edited_at;

              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <div className="flex justify-center py-2">
                      <span className="text-[10px] bg-background/90 backdrop-blur-sm text-muted-foreground px-3 py-1 rounded-full shadow-sm font-medium">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"} group`}>
                    <div className={`relative max-w-[75%] rounded-xl px-3 py-1.5 text-sm shadow-sm
                      ${isOutgoing
                        ? "bg-emerald-600/90 text-white rounded-br-sm"
                        : "bg-card text-card-foreground rounded-bl-sm border border-border/50"
                      }
                      ${m._optimistic ? "opacity-60" : ""}
                    `}>
                      <MediaContent message={m} />
                      {isEditing ? (
                        <div className="space-y-1.5 min-w-[220px]">
                          <Textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            className="min-h-[60px] text-sm bg-background text-foreground"
                            autoFocus
                          />
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] hover:bg-white/10" onClick={() => { setEditingId(null); setEditText(""); }}>
                              <X className="h-3 w-3 mr-0.5" /> Cancelar
                            </Button>
                            <Button size="sm" className="h-6 px-2 text-[11px]" onClick={saveEdit} disabled={editSaving || !editText.trim()}>
                              {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        !(m.media_url && m.message_type === "image" && !m.content?.includes(" ")) && (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                        )
                      )}
                      <div className={`flex items-center gap-1 justify-end mt-0.5 -mb-0.5
                        ${isOutgoing ? "text-white/60" : "text-muted-foreground"}
                      `}>
                        {editedAt && !isEditing && (
                          <span className="text-[9px] italic opacity-80">editada</span>
                        )}
                        <span className="text-[10px]">
                          {m._optimistic
                            ? "Enviando..."
                            : new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                          }
                        </span>
                        {isOutgoing && <StatusIcon status={m._optimistic ? "sending" : m.status} />}
                      </div>
                      {canEdit && !isEditing && (
                        <button
                          onClick={() => startEdit(m)}
                          className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border rounded-full p-1 shadow hover:bg-muted"
                          title="Editar mensagem"
                        >
                          <Pencil className="h-3 w-3 text-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Send className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Nenhuma mensagem ainda</p>
                <p className="text-xs text-muted-foreground">Envie a primeira mensagem abaixo 👇</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-card p-3 shrink-0">
          {/* Slash command suggestions */}
          {showCommands && commandSuggestions.length > 0 && (
            <div className="mb-2 max-w-3xl mx-auto bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[200px] overflow-y-auto">
              <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border font-semibold">⚡ Comandos</p>
              {commandSuggestions.map(cmd => (
                <button
                  key={cmd.id}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 border-b border-border/30 last:border-0"
                  onClick={() => selectCommand(cmd)}
                >
                  <span className="font-mono text-primary">/{cmd.trigger_word}</span>
                  {Array.isArray(cmd.sequence) && cmd.sequence.length > 0 && (
                    <span className="text-[9px] bg-primary/15 text-primary px-1.5 rounded">seq {cmd.sequence.length}</span>
                  )}
                  <span className="text-muted-foreground truncate flex-1">{(cmd.response_text || (cmd.sequence?.[0]?.content) || "").substring(0, 60)}{cmd.response_text && cmd.response_text.length > 60 ? "..." : ""}</span>
                </button>
              ))}
            </div>
          )}

          {draft && (
            <div className="max-w-3xl mx-auto mb-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-primary font-semibold shrink-0">💡 Sugestão IA{draft.model ? ` · ${draft.model}` : ""}</span>
                <p className="flex-1 text-foreground/80 whitespace-pre-wrap leading-relaxed">{draft.suggested_text}</p>
              </div>
              <div className="flex gap-2 mt-2 justify-end">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => resolveDraft("discarded")}>Descartar</Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setText(draft.suggested_text); textareaRef.current?.focus(); resolveDraft("edited", draft.suggested_text); }}>Editar</Button>
                <Button size="sm" className="h-7 px-2 text-xs" onClick={async () => { const t = draft.suggested_text; await resolveDraft("used", t); setText(t); setTimeout(() => send(), 50); }}>Usar e enviar</Button>
              </div>
            </div>
          )}
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            {/* Emoji picker */}
            <Popover open={showEmoji} onOpenChange={setShowEmoji}>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 rounded-full" title="Emojis">
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start" side="top">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJI_LIST.map(e => (
                    <button key={e} className="text-lg hover:bg-muted rounded p-0.5 transition-colors"
                      onClick={() => { setText(prev => prev + e); setShowEmoji(false); textareaRef.current?.focus(); }}>
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Attach media */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 h-9 w-9 rounded-full"
              title="Enviar mídia"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4 text-muted-foreground" />}
            </Button>

            {/* Templates */}
            {templates.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 rounded-full" title="Templates">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start" side="top">
                  <p className="text-[10px] text-muted-foreground px-2 py-1 font-semibold">Templates</p>
                  {templates.map(t => (
                    <button key={t.id} className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded transition-colors truncate"
                      onClick={() => { setText(t.content); textareaRef.current?.focus(); }}>
                      {t.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {/* AI Copilot Suggestion */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 h-9 w-9 rounded-full text-primary hover:text-primary/80 hover:bg-primary/5"
              title="Pedir sugestão da IA (Copilot)"
              onClick={generateCopilotSuggestion}
              disabled={loadingCopilot || messages.length === 0}
            >
              {loadingCopilot ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Brain className="h-4 w-4 text-primary" />
              )}
            </Button>

            {/* Message input */}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder="Digite sua mensagem... (/ para comandos)"
              onFocus={() => { isComposingRef.current = true; }}
              onBlur={() => { isComposingRef.current = false; }}
              onPaste={handlePaste}

              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              disabled={sending}
              className="min-h-[36px] max-h-[120px] resize-none py-2 rounded-2xl bg-background border-border/50 text-sm"
              rows={1}
            />

            {/* Send button */}
            <Button
              size="icon"
              onClick={send}
              disabled={sending || !text.trim()}
              className="shrink-0 h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ChatView.displayName = "ChatView";

export default ChatView;
