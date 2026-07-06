import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, FileText, ChevronUp, Check, CheckCheck, Image, Paperclip, Smile, Download, Pencil, X, Brain, Sparkles, Mic, Square, Trash2, Play, Pause, Volume2, Bot, BotOff, Layers, Activity, ThumbsUp, ThumbsDown, Zap, Star, Clock, MoreHorizontal, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import ContactTagsPanel from "./ContactTagsPanel";
import AssignAndNotesBar from "./AssignAndNotesBar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MENTES_DATA } from "@/data/mentesData";
import { LeadIntelPanel } from "./LeadIntelPanel";
import ConversationIntelCard from "./ConversationIntelCard";
import { useViewportWidth } from "@/hooks/useViewportWidth";

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
  transcript?: string | null;
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
  intelPanelOpen?: boolean;
  onToggleIntelPanel?: () => void;
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
      <div className="mb-1 flex flex-col gap-1.5 min-w-[200px]">
        <div className="flex items-center gap-2">
          <audio controls className="max-w-full h-8 flex-1" preload="none">
            <source src={media_url} />
          </audio>
          <DownloadBtn url={media_url} filename={filename} />
        </div>
        {message.transcript && (
          <div className="text-[11px] bg-secondary/40 border border-border/30 rounded-lg p-2 text-muted-foreground italic max-w-full whitespace-pre-wrap leading-relaxed">
            🎙️ <strong className="not-italic font-semibold text-foreground/80">Transcrição:</strong> {message.transcript}
          </div>
        )}
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
  ({ conversationId, phone, projectId, providerId, intelPanelOpen, onToggleIntelPanel }, ref) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [scheduleAt, setScheduleAt] = useState("");
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
    const [iaAtiva, setIaAtiva] = useState<boolean>(true);
    const [togglingIa, setTogglingIa] = useState(false);
    const [loadingCopilot, setLoadingCopilot] = useState(false);
    const [objections, setObjections] = useState<any[]>([]);
    const [aiConfigState, setAiConfigState] = useState<any | null>(null);
    const [dismissedObjectionId, setDismissedObjectionId] = useState<string | null>(null);
    const [sendingVoice, setSendingVoice] = useState(false);
    const [showIntelPanel, setShowIntelPanel] = useState(() => {
      if (intelPanelOpen !== undefined) return intelPanelOpen;
      const saved = typeof window !== "undefined" ? localStorage.getItem("wa.intelPanelOpen") : null;
      if (saved !== null) return saved === "true";
      return typeof window !== "undefined" ? window.innerWidth >= 1400 : true;
    });
    const [lastIntent, setLastIntent] = useState<string | null>(null);
    const viewportWidth = useViewportWidth();
    const isCompact = viewportWidth < 1280;
    const maxWidthClass = showIntelPanel ? "max-w-3xl" : "max-w-5xl";

    useEffect(() => {
      if (intelPanelOpen !== undefined) {
        setShowIntelPanel(intelPanelOpen);
        return;
      }
      const saved = localStorage.getItem("wa.intelPanelOpen");
      if (saved !== null) return;
      setShowIntelPanel(viewportWidth >= 1400);
    }, [viewportWidth, intelPanelOpen]);

    const toggleIntelPanel = () => {
      if (onToggleIntelPanel) {
        onToggleIntelPanel();
      } else {
        const next = !showIntelPanel;
        setShowIntelPanel(next);
        localStorage.setItem("wa.intelPanelOpen", String(next));
      }
    };
    
    // Interactive actions states
    const [interactiveText, setInteractiveText] = useState("");
    const [btn1, setBtn1] = useState("");
    const [btn2, setBtn2] = useState("");
    const [btn3, setBtn3] = useState("");
    const [listBtnText, setListBtnText] = useState("");
    const [listRows, setListRows] = useState([
      { title: "", description: "" },
      { title: "", description: "" },
      { title: "", description: "" },
      { title: "", description: "" },
      { title: "", description: "" },
    ]);

    // Recording voice states
    const [recordingState, setRecordingState] = useState<"idle" | "recording" | "preview">("idle");
    const [recordTime, setRecordTime] = useState(0);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const timerIntervalRef = useRef<any>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: "audio/ogg; codecs=opus" });
        
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
          const url = URL.createObjectURL(blob);
          setAudioBlob(blob);
          setAudioUrl(url);
          setRecordingState("preview");
          
          // Stop all audio tracks to release the microphone
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setRecordingState("recording");
        setRecordTime(0);

        timerIntervalRef.current = setInterval(() => {
          setRecordTime(prev => prev + 1);
        }, 1000);

      } catch (err: any) {
        toast.error("Erro ao acessar microfone: " + (err.message || err));
      }
    };

    const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };

    const cancelRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Cleanup preview audio player if active
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setIsPlayingPreview(false);
      
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      audioChunksRef.current = [];
      setRecordingState("idle");
    };

    const togglePlayPreview = () => {
      if (!audioUrl) return;
      if (isPlayingPreview) {
        audioPlayerRef.current?.pause();
        setIsPlayingPreview(false);
      } else {
        if (!audioPlayerRef.current) {
          const player = new Audio(audioUrl);
          player.onended = () => setIsPlayingPreview(false);
          audioPlayerRef.current = player;
        }
        audioPlayerRef.current.play();
        setIsPlayingPreview(true);
      }
    };

    const sendRecordedAudio = async () => {
      if (!audioBlob) return;
      const file = new File([audioBlob], `gravacao_${Date.now()}.ogg`, { type: "audio/ogg" });
      await uploadAndSendFile(file, "");
      cancelRecording(); // Resets and cleans up
    };

    useEffect(() => {
      return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
      };
    }, []);

    // 🔥 Live temperature — combina intent real (triage) + heurística de keywords
    const BUY_KEYWORDS = [
      "quanto custa", "qual o valor", "como pago", "aceita pix", "tem parcela",
      "quero comprar", "me manda o link", "tem garantia", "quero fechar", "vou entrar",
      "link", "preco", "valor", "pagar", "compro", "assinar", "inscricao",
    ];
    const temperature = (() => {
      // 1) Intent real do classificador (mais confiável)
      const intent = (lastIntent || "").toLowerCase();
      if (intent) {
        if (/(comprar|fechar|pagar|checkout|pix|boleto|cartao|cartão|finalizar)/.test(intent)) return "hot";
        if (/(duvida|dúvida|preco|preço|interesse|garantia|prazo|funciona|como)/.test(intent)) return "warm";
        if (/(spam|cancel|recusa|nao|não)/.test(intent)) return "cold";
      }
      // 2) Fallback: keywords nas últimas 5 mensagens
      const last5 = messages.filter(m => m.direction === "incoming").slice(-5);
      if (last5.length === 0) return "cold";
      const combined = last5.map(m => (m.content || "").toLowerCase()).join(" ");
      const buyHits = BUY_KEYWORDS.filter(kw => combined.includes(kw)).length;
      const hasActivity = last5.length >= 3 || (Date.now() - new Date(last5[last5.length - 1]?.created_at || 0).getTime()) < 15 * 60 * 1000;
      if (buyHits >= 2) return "hot";
      if (buyHits >= 1 || hasActivity) return "warm";
      return "cold";
    })();

    // Dynamic Objection Detection Banner
    const detectedObjection = (() => {
      const lastIncoming = [...messages].reverse().find(m => m.direction === "incoming");
      if (!lastIncoming || !lastIncoming.content) return null;
      const content = lastIncoming.content.toLowerCase();
      const match = objections.find(obj => {
        const keyword = (obj.objecao || "").toLowerCase().trim();
        if (!keyword || keyword.length < 3) return false;
        return content.includes(keyword);
      });
      if (match && match.id !== dismissedObjectionId) {
        return { objection: match, messageId: lastIncoming.id };
      }
      return null;
    })();

    const sendAsVoice = async () => {
      if (!text.trim()) return;
      if (!providerId) { toast.error("Nenhum provider configurado"); return; }
      
      const textToSynthesize = text;
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      
      setSendingVoice(true);
      setSending(true);

      const optimisticMsg: Message = {
        id: `opt-${Date.now()}`,
        direction: "outgoing",
        content: `🔊 [Áudio Sintetizado]: ${textToSynthesize}`,
        phone,
        created_at: new Date().toISOString(),
        status: "sending",
        message_type: "audio",
        _optimistic: true,
      };
      setMessages(prev => [...prev, optimisticMsg]);

      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_voice_synthesis", {
          body: {
            provider_id: providerId,
            phone,
            text: textToSynthesize,
            project_id: projectId,
            voice_provider: aiConfigState?.voice_provider || "elevenlabs",
            voice_id: aiConfigState?.voice_name || "fernanda_hq",
            voice_stability: aiConfigState?.voice_stability || 75,
            voice_clarity: aiConfigState?.voice_clarity || 85,
          },
        });
        if (error) throw error;
        if (data && data.success === false) {
          toast.error(data.error || "Erro ao sintetizar áudio");
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
          setText(textToSynthesize);
        } else {
          toast.success("Áudio sintetizado e enviado!");
          setTimeout(() => pollNew(), 500);
        }
      } catch (err: any) {
        toast.error("Erro ao sintetizar áudio: " + err.message);
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        setText(textToSynthesize);
      } finally {
        setSendingVoice(false);
        setSending(false);
      }
    };

    const sendInteractiveButtons = async () => {
      if (!providerId) { toast.error("Nenhum provider configurado"); return; }
      const btns = [btn1, btn2, btn3].filter(b => b.trim() !== "").map((b, i) => ({ id: `btn_${i}`, text: b.trim() }));
      if (btns.length === 0) { toast.error("Insira pelo menos um botão."); return; }
      
      const bodyText = interactiveText || "Escolha uma das opções abaixo:";
      
      setSending(true);
      const optimisticMsg: Message = {
        id: `opt-${Date.now()}`,
        direction: "outgoing",
        content: `🔘 [Botões]: ${bodyText}\n${btns.map(b => `[${b.text}]`).join("  ")}`,
        phone,
        created_at: new Date().toISOString(),
        status: "sending",
        message_type: "text",
        _optimistic: true,
      };
      setMessages(prev => [...prev, optimisticMsg]);
      
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
          body: {
            provider_id: providerId,
            phone,
            content: bodyText,
            conversation_id: conversationId,
            project_id: projectId,
            sent_by: "human",
            buttons: btns,
          },
        });
        if (error) throw error;
        if (data && data.success === false) {
          toast.error(data.error || "Erro ao enviar botões");
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        } else {
          toast.success("Mensagem com botões enviada!");
          setInteractiveText("");
          setBtn1("");
          setBtn2("");
          setBtn3("");
          setTimeout(() => pollNew(), 500);
        }
      } catch (err: any) {
        toast.error("Erro ao enviar botões: " + err.message);
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      } finally {
        setSending(false);
      }
    };

    const sendInteractiveList = async () => {
      if (!providerId) { toast.error("Nenhum provider configurado"); return; }
      const rows = listRows.filter(r => r.title.trim() !== "").map((r, i) => ({ id: `row_${i}`, title: r.title.trim(), description: r.description.trim() }));
      if (rows.length === 0) { toast.error("Insira pelo menos um item na lista."); return; }
      
      const bodyText = interactiveText || "Selecione uma das opções no menu:";
      const btnTitle = listBtnText || "Ver Opções";
      
      setSending(true);
      const optimisticMsg: Message = {
        id: `opt-${Date.now()}`,
        direction: "outgoing",
        content: `📋 [Lista]: ${bodyText}\n🔘 Botão: ${btnTitle}\n${rows.map(r => `• ${r.title} ${r.description ? `(${r.description})` : ""}`).join("\n")}`,
        phone,
        created_at: new Date().toISOString(),
        status: "sending",
        message_type: "text",
        _optimistic: true,
      };
      setMessages(prev => [...prev, optimisticMsg]);
      
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
          body: {
            provider_id: providerId,
            phone,
            content: bodyText,
            conversation_id: conversationId,
            project_id: projectId,
            sent_by: "human",
            list_data: {
              title: btnTitle,
              buttonText: btnTitle,
              sectionTitle: "Opções",
              rows,
            },
          },
        });
        if (error) throw error;
        if (data && data.success === false) {
          toast.error(data.error || "Erro ao enviar lista");
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        } else {
          toast.success("Mensagem de lista enviada!");
          setInteractiveText("");
          setListBtnText("");
          setListRows([
            { title: "", description: "" },
            { title: "", description: "" },
            { title: "", description: "" },
            { title: "", description: "" },
            { title: "", description: "" },
          ]);
          setTimeout(() => pollNew(), 500);
        }
      } catch (err: any) {
        toast.error("Erro ao enviar lista: " + err.message);
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      } finally {
        setSending(false);
      }
    };

    // 3-option quick suggest state
    const [showQuickSuggest, setShowQuickSuggest] = useState(false);
    const [quickOptions, setQuickOptions] = useState<{type: string; label: string; emoji: string; text: string}[]>([]);
    const [loadingQuick, setLoadingQuick] = useState(false);

    const generateQuickOptions = async () => {
      if (messages.length === 0) return;
      setLoadingQuick(true);
      setShowQuickSuggest(true);
      try {
        const savedKeys = localStorage.getItem("imphq_api_keys");
        const apiKeys = savedKeys ? JSON.parse(savedKeys) : {};
        const orKey = apiKeys.openrouter;
        if (!orKey) { setQuickOptions([]); setLoadingQuick(false); return; }

        const last = messages.filter(m => m.direction === "incoming").slice(-3);
        const lastMsg = last[last.length - 1]?.content || "";
        const history = messages.slice(-6).map(m => `${m.direction === "incoming" ? "Lead" : "Você"}: ${m.content}`).join("\n");

        const prompt = `Gere 3 respostas curtas (max 2 frases cada) para esta mensagem do lead: "${lastMsg}"

Histórico recente:
${history}

Gere exatamente neste formato JSON (sem markdown):
[{"type":"empatica","text":"..."},{"type":"tecnica","text":"..."},{"type":"fechamento","text":"..."}]`;

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${orKey}` },
          body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.7 }),
        });
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        const labels: Record<string, {label: string; emoji: string}> = {
          empatica: { label: "Empática", emoji: "🤗" },
          tecnica: { label: "Técnica", emoji: "🎯" },
          fechamento: { label: "Fechamento", emoji: "🔥" },
        };
        setQuickOptions(parsed.map((o: any) => ({
          ...o, ...labels[o.type] || { label: o.type, emoji: "💬" },
        })));
      } catch (e) {
        setQuickOptions([]);
      } finally {
        setLoadingQuick(false);
      }
    };

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
            .eq("enabled", true),
          supabase
            .from("imphq_projects")
            .select("name, data")
            .eq("id", projectId)
            .maybeSingle()
        ]);

        const configs = configRes.data || [];
        const aiConfig = configs.find((c: any) => !c.provider_id) || configs[0] || null;
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

        let personalityText = personalityPrompts[personality] || personalityPrompts.assistente;
        if (personality && personality.startsWith("skill_")) {
          const skillId = personality.replace("skill_", "");
          const predefined = MENTES_DATA.find(m => m.id === skillId);
          if (predefined) {
            personalityText = predefined.prompt;
          } else {
            const { data: skill } = await supabase
              .from("imphq_skills")
              .select("system_prompt")
              .eq("id", skillId)
              .maybeSingle();
            if (skill?.system_prompt) {
              personalityText = skill.system_prompt;
            }
          }
        }

        const toneInstructions: Record<string, string> = {
          profissional: "Tom profissional e direto.",
          casual: "Tom casual e descontraído, use emojis moderadamente.",
          amigavel: "Tom amigável e acolhedor, use emojis.",
          formal: "Tom formal e respeitoso.",
          urgente: "Tom de urgência e escassez.",
        };

        const systemPrompt = `${expertPersona ? `PERSONA DO EXPERT (incorpore essa voz de forma natural):\n${expertPersona}\n\n` : ""}${personalityText}
${toneInstructions[tone] || toneInstructions.profissional}
Você está respondendo via WhatsApp para a empresa "${project?.name || ""}".
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}
${productFocus ? `\nOFERTA ATIVA (mencione quando fizer sentido):\n${productFocus}\n` : ""}
${customInstr ? `\nREGRAS DO EXPERT (obrigatórias, nunca quebre):\n${customInstr}\n` : ""}

REGRAS GERAIS DE CONVERSAÇÃO HUMANA:
- Responda em português brasileiro com fluidez e empatia natural, evite ser robótico, excessivamente polido ou formal (a menos que a instrução do tom seja formal).
- NUNCA diga que é uma inteligência artificial, robô ou assistente limitado. Não use frases como "como sou um assistente virtual, não tenho acesso".
- Se o lead perguntar sobre entrega de produtos, status de pedidos, envio, rastreamento ou qualquer suporte técnico/financeiro que você não saiba responder, diga amigavelmente que vai verificar os detalhes com a equipe administrativa interna imediatamente e que ele receberá uma notificação com a resposta em breve (por e-mail, WhatsApp ou notificação push no aplicativo/PWA).
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

    // Carrega ia_ativa e mantém sincronizado
    useEffect(() => {
      if (!conversationId) return;
      supabase.from("imphq_wa_conversations")
        .select("ia_ativa")
        .eq("id", conversationId)
        .maybeSingle()
        .then(({ data }) => { if (data != null) setIaAtiva((data as any).ia_ativa ?? true); });
    }, [conversationId]);

    // Carrega o último intent real desta conversa (classificador de triagem)
    useEffect(() => {
      if (!conversationId) { setLastIntent(null); return; }
      let stop = false;
      const load = async () => {
        const { data } = await supabase
          .from("imphq_wa_triage")
          .select("intent, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!stop) setLastIntent((data as any)?.intent ?? null);
      };
      load();
      const t = setInterval(() => {
        if (document.visibilityState === "visible") load();
      }, 45000);
      return () => { stop = true; clearInterval(t); };
    }, [conversationId]);

    const toggleIa = async () => {
      if (togglingIa) return;
      setTogglingIa(true);
      const next = !iaAtiva;
      const { error } = await supabase.from("imphq_wa_conversations")
        .update({ ia_ativa: next })
        .eq("id", conversationId);
      if (!error) {
        setIaAtiva(next);
        toast.success(next ? "IA ativada para esta conversa" : "IA pausada — atendimento manual");
      } else {
        toast.error("Erro ao alterar IA: " + error.message);
      }
      setTogglingIa(false);
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
      const t = setInterval(() => {
        if (document.visibilityState === "visible") fetchDraft();
      }, 30000);
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

    // Load objections matching current project ID
    useEffect(() => {
      if (!projectId) return;
      supabase
        .from("imphq_wa_objections")
        .select("id, objecao, resposta_padrao")
        .eq("projeto_id", projectId)
        .order("objecao")
        .then(({ data }) => setObjections(data || []));
    }, [projectId]);

    // Load active AI config
    useEffect(() => {
      if (!projectId) return;
      supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setAiConfigState(data[0]);
          }
        });
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
    const [feedbackSent, setFeedbackSent] = useState<Record<string, "good" | "bad">>({});
    const [feedbackCorrecting, setFeedbackCorrecting] = useState<string | null>(null);
    const [correctionText, setCorrectionText] = useState("");
    const [correctionType, setCorrectionType] = useState<"auto" | "answer" | "rule" | "unavailable" | "complement">("auto");

    const sendFeedback = async (msgId: string, feedback: "good" | "bad", correction?: string, ctype?: "auto" | "answer" | "rule" | "unavailable" | "complement") => {
      try {
        const { data } = await supabase.functions.invoke("wa-feedback-learn", {
          body: { message_id: msgId, feedback, correction: correction || undefined, project_id: projectId, correction_type: ctype || "auto" },
        });
        setFeedbackSent(prev => ({ ...prev, [msgId]: feedback }));
        setFeedbackCorrecting(null);
        setCorrectionText("");
        setCorrectionType("auto");
        const finalType = (data as any)?.correction_type;
        const typeLabel = finalType === "rule" ? "📜 regra do projeto"
          : finalType === "unavailable" ? "🚫 produto indisponível"
          : finalType === "complement" ? "➕ complemento (P/R + regra)"
          : "✏️ resposta corrigida";
        toast.success(feedback === "good" ? "✅ Resposta adicionada à base de conhecimento" : `${typeLabel} incorporada`);
      } catch (err: any) {
        toast.error("Erro ao salvar feedback: " + err.message);
      }
    };

    const markAsGold = async (m: Message) => {
      try {
        const { data, error } = await supabase.functions.invoke("wa-learn-from-human", {
          body: { conversation_id: conversationId, message_id: m.id, project_id: projectId, gold: true },
        });
        if (error) throw error;
        if ((data as any)?.skipped) { toast.info("Pulado: " + (data as any).skipped); return; }
        setFeedbackSent(prev => ({ ...prev, [m.id]: "good" }));
        toast.success("⭐ Marcada como exemplo de ouro — a IA vai replicar esse padrão");
      } catch (e: any) {
        toast.error("Erro: " + e.message);
      }
    };

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


    // Realtime: subscribe to new messages for this conversation.
    // Mantém polling como fallback (60s) caso o canal caia.
    useEffect(() => {
      const channel = supabase
        .channel(`wa-msg-${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "imphq_wa_messages", filter: `conversation_id=eq.${conversationId}` },
          () => { pollNew(); },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "imphq_wa_messages", filter: `conversation_id=eq.${conversationId}` },
          () => { pollNew(); },
        )
        .subscribe();

      const fallback = setInterval(() => {
        if (document.visibilityState === "visible") pollNew();
      }, 60000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(fallback);
      };
    }, [conversationId, pollNew]);

    useEffect(() => {
      if (isComposingRef.current) return;
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    // Auto-resize textarea + slash command/template detection
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";

      if (val.startsWith("/") && val.length > 0) {
        const query = val.substring(1).toLowerCase();
        const matchedCmds = commands.filter(c => c.trigger_word.toLowerCase().includes(query));
        // Also search templates by name/content
        const matchedTpls = templates
          .filter(t => t.name.toLowerCase().includes(query) || t.content.toLowerCase().includes(query))
          .slice(0, 5)
          .map(t => ({
            id: `tpl_${t.id}`,
            trigger_word: t.name,
            response_text: t.content,
            sequence: [],
            _isTemplate: true,
          } as any));
        const all = [...matchedCmds, ...matchedTpls].slice(0, 8);
        setCommandSuggestions(all);
        setShowCommands(all.length > 0);
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
        // Auto-pausa IA por 1h quando humano responde (handoff implícito)
        supabase.from("imphq_wa_conversations")
          .update({ ai_paused_until: new Date(Date.now() + 1 * 3600_000).toISOString() } as any)
          .eq("id", conversationId)
          .then(() => {});
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
      <div ref={ref} className="flex h-full w-full overflow-hidden bg-background">
        <div className="flex-1 flex flex-col h-full min-w-0 border-r border-border">
          <ContactTagsPanel projectId={projectId} phone={phone} />
          <AssignAndNotesBar conversationId={conversationId} />
          {conversationId && (
            <div className="px-3 pt-2">
              <ConversationIntelCard conversationId={conversationId} />
            </div>
          )}
          {(() => {
            const last = messages[messages.length - 1];
            if (!last || last.direction !== "incoming") return null;
            const min = Math.max(0, Math.floor((Date.now() - new Date(last.created_at).getTime()) / 60000));
            const label = min < 1 ? "agora" : min < 60 ? `${min}min` : min < 1440 ? `${Math.floor(min/60)}h${min % 60 ? ` ${min%60}min` : ""}` : `${Math.floor(min/1440)}d`;
            const cls = min < 5 ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              : min < 30 ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
              : min < 120 ? "bg-orange-500/10 text-orange-300 border-orange-500/30"
              : "bg-red-500/15 text-red-300 border-red-500/40 animate-pulse";
            return (
              <div className={`px-3 py-1.5 text-[11px] border-b ${cls} flex items-center gap-2 font-medium`}>
                <span>⏱</span>
                <span>Aguardando sua resposta há <strong>{label}</strong></span>
              </div>
            );
          })()}
          {/* Chat area with WhatsApp-like pattern background */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}>
            <div className={`p-4 space-y-1 ${maxWidthClass} mx-auto`}>
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
                        {isOutgoing && (m as any).sent_by === "ai" && (
                          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 text-[9px] font-bold uppercase tracking-wider text-white shadow-md border border-amber-300/40" title="Mensagem enviada pela IA">
                            <Sparkles className="h-2.5 w-2.5" />
                            IA
                          </div>
                        )}
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
                        {/* Badge de reengajamento automático */}
                        {isOutgoing && (m.metadata as any)?.source === "wa-reengagement" && (
                          <div className="flex items-center gap-1 mt-1 mb-0.5">
                            <Activity className="h-2.5 w-2.5 text-amber-300/80" />
                            <span className="text-[9px] text-amber-300/80 font-medium">
                              Reengajamento automático · {(m.metadata as any).days_silent}d silêncio
                            </span>
                          </div>
                        )}
                        {/* Badge de closer automático (hot lead) */}
                        {isOutgoing && (m.metadata as any)?.source === "wa-closer-trigger" && (
                          <div className="flex items-center gap-1 mt-1 mb-0.5">
                            <Zap className="h-2.5 w-2.5 text-orange-300/80" />
                            <span className="text-[9px] text-orange-300/80 font-medium">
                              Closer automático · score {(m.metadata as any).lead_score}/200
                            </span>
                          </div>
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
                        {/* Feedback buttons — visible on hover for outgoing non-optimistic messages */}
                        {isOutgoing && !m._optimistic && !isEditing && (
                          <div className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            {feedbackSent[m.id] ? (
                              <span className="text-[9px] text-muted-foreground bg-background/80 rounded px-1.5 py-0.5 border border-border/40">
                                {feedbackSent[m.id] === "good" ? "👍 Aprovado" : "✏️ Corrigido"}
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => sendFeedback(m.id, "good")}
                                  className="bg-background/90 border border-border/60 rounded-full p-1 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors"
                                  title="Boa resposta — adicionar à base de conhecimento"
                                >
                                  <ThumbsUp className="h-2.5 w-2.5 text-emerald-400" />
                                </button>
                                <button
                                  onClick={() => setFeedbackCorrecting(feedbackCorrecting === m.id ? null : m.id)}
                                  className="bg-background/90 border border-border/60 rounded-full p-1 hover:bg-amber-500/10 hover:border-amber-500/40 transition-colors"
                                  title="Corrigir resposta"
                                >
                                  <ThumbsDown className="h-2.5 w-2.5 text-amber-400" />
                                </button>
                                <button
                                  onClick={() => markAsGold(m)}
                                  className="bg-background/90 border border-border/60 rounded-full p-1 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                                  title="Ouro — ensinar a IA a replicar esta resposta"
                                >
                                  <Star className="h-2.5 w-2.5 text-primary" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {/* Correction input */}
                        {feedbackCorrecting === m.id && (
                          <div className="mt-2 space-y-1.5 min-w-[280px]">
                            <Textarea
                              value={correctionText}
                              onChange={e => setCorrectionText(e.target.value)}
                              placeholder={correctionType === "complement"
                                ? "O que faltou dizer? Ex: 'poderia acrescentar que só tem dentro da JP Hair Education'"
                                : "Como deveria ter sido respondido? Ou que regra a IA deve seguir?"}
                              className="min-h-[56px] text-xs bg-background text-foreground"
                              autoFocus
                            />
                            <div className="flex flex-wrap gap-1">
                              {([
                                ["auto", "🤖 Auto"],
                                ["answer", "✏️ Resposta melhor"],
                                ["rule", "📜 Regra do projeto"],
                                ["unavailable", "🚫 Produto indisponível"],
                                ["complement", "➕ Complementar"],
                              ] as const).map(([val, label]) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setCorrectionType(val)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                                    correctionType === val
                                      ? "bg-amber-600 border-amber-500 text-white"
                                      : "bg-background border-border text-muted-foreground hover:border-amber-500/50"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] hover:bg-white/10" onClick={() => { setFeedbackCorrecting(null); setCorrectionText(""); setCorrectionType("auto"); }}>
                                <X className="h-3 w-3 mr-0.5" /> Cancelar
                              </Button>
                              <Button size="sm" className="h-6 px-2 text-[11px] bg-amber-600 hover:bg-amber-700" onClick={() => sendFeedback(m.id, "bad", correctionText, correctionType)} disabled={!correctionText.trim()}>
                                Salvar Correção
                              </Button>
                            </div>
                          </div>
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
              <div className={`mb-2 ${maxWidthClass} mx-auto bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[220px] overflow-y-auto`}>
                <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border font-semibold">⚡ Comandos & Templates — Tab ou clique para inserir</p>
                {commandSuggestions.map(cmd => (
                  <button
                    key={cmd.id}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 border-b border-border/30 last:border-0"
                    onClick={() => selectCommand(cmd)}
                  >
                    {(cmd as any)._isTemplate ? (
                      <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded shrink-0">template</span>
                    ) : (
                      <span className="font-mono text-primary shrink-0">/{cmd.trigger_word}</span>
                    )}
                    {(cmd as any)._isTemplate && (
                      <span className="font-medium text-foreground/80 shrink-0">{cmd.trigger_word}</span>
                    )}
                    {Array.isArray(cmd.sequence) && cmd.sequence.length > 0 && (
                      <span className="text-[9px] bg-primary/15 text-primary px-1.5 rounded shrink-0">seq {cmd.sequence.length}</span>
                    )}
                    <span className="text-muted-foreground truncate flex-1">{(cmd.response_text || (cmd.sequence?.[0]?.content) || "").substring(0, 60)}{cmd.response_text && cmd.response_text.length > 60 ? "…" : ""}</span>
                  </button>
                ))}
              </div>
            )}

            {draft && (
              <div className={`${maxWidthClass} mx-auto mb-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs`}>
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

            {/* Quick 3-option suggestions panel */}
            {showQuickSuggest && (
              <div className={`${maxWidthClass} mx-auto mb-2`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted-foreground font-semibold">✨ Escolha a abordagem:</span>
                  <button onClick={() => { setShowQuickSuggest(false); setQuickOptions([]); }} className="text-[9px] text-muted-foreground hover:text-foreground">fechar</button>
                </div>
                {loadingQuick ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando 3 opções...
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {quickOptions.map(opt => (
                      <button
                        key={opt.type}
                        onClick={() => { setText(opt.text); textareaRef.current?.focus(); setShowQuickSuggest(false); }}
                        className="text-left px-2.5 py-2 rounded-lg border border-border/60 bg-card hover:bg-secondary/50 transition-colors text-xs"
                      >
                        <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">{opt.emoji} {opt.label}</p>
                        <p className="leading-snug line-clamp-3">{opt.text}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Objection Detection Banner */}
            {detectedObjection && (
              <div className={`${maxWidthClass} mx-auto mb-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-xs relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 text-sm font-bold shrink-0">🛡️ Copilot de Objeções</span>
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        Objeção detectada: <span className="text-amber-400 font-bold">"{detectedObjection.objection.objecao}"</span>
                      </p>
                      <p className="text-foreground/80 leading-relaxed max-h-16 overflow-y-auto">
                        {detectedObjection.objection.resposta_padrao}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedObjectionId(detectedObjection.objection.id)}
                    className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2 mt-2.5 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] border-amber-500/20 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                    onClick={() => {
                      setText(detectedObjection.objection.resposta_padrao);
                      textareaRef.current?.focus();
                      toast.success("Resposta colada no editor!");
                    }}
                  >
                    Inserir no Editor
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
                    onClick={async () => {
                      const txt = detectedObjection.objection.resposta_padrao;
                      setText(txt);
                      setTimeout(() => send(), 50);
                    }}
                  >
                    Enviar Agora
                  </Button>
                </div>
              </div>
            )}

            {/* Calibrated Objections Pill Bar */}
            {objections.length > 0 && (
              <div className={`${maxWidthClass} mx-auto mb-2 flex items-center gap-1.5 overflow-x-auto py-1.5 pb-2 select-none scrollbar-none`}>
                <span className="text-[10px] text-muted-foreground font-semibold shrink-0 bg-secondary/50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  🛡️ Objeções:
                </span>
                {objections.map((obj) => (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => {
                      setText(obj.resposta_padrao);
                      textareaRef.current?.focus();
                      toast.success("Resposta de objeção colada!");
                    }}
                    className="shrink-0 text-[11px] bg-secondary/40 border border-border/60 hover:bg-primary/10 hover:border-primary/30 transition-all rounded-full px-2.5 py-0.5 text-muted-foreground hover:text-primary active:scale-95"
                    title={obj.resposta_padrao}
                  >
                    {obj.objecao}
                  </button>
                ))}
              </div>
            )}

            {recordingState === "recording" ? (
              <div className={`flex items-center justify-between w-full bg-destructive/5 border border-destructive/25 rounded-2xl px-4 py-2 animate-pulse ${maxWidthClass} mx-auto`}>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs font-semibold text-red-400">Gravando áudio...</span>
                  <span className="text-xs font-mono text-muted-foreground ml-2 font-bold">
                    {Math.floor(recordTime / 60).toString().padStart(2, "0")}:{(recordTime % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={cancelRecording} className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full" title="Cancelar gravação">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={stopRecording} className="h-8 w-8 bg-red-600 hover:bg-red-700 text-white rounded-full shadow" title="Parar gravação">
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </Button>
                </div>
              </div>
            ) : recordingState === "preview" ? (
              <div className={`flex items-center justify-between w-full bg-primary/5 border border-primary/20 rounded-2xl px-4 py-2 ${maxWidthClass} mx-auto`}>
                <div className="flex items-center gap-3 flex-1">
                  <Button size="icon" variant="outline" onClick={togglePlayPreview} className="h-8 w-8 rounded-full border-primary/30 text-primary hover:bg-primary/5 shadow-sm">
                    {isPlayingPreview ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  </Button>
                  <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden relative border border-border/30">
                    <div className="absolute top-0 left-0 h-full bg-primary animate-pulse" style={{ width: "100%" }} />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mr-2 select-none">Pré-escutar áudio</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={cancelRecording} className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full" title="Deletar áudio">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={sendRecordedAudio} className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow" title="Enviar áudio">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`flex items-end gap-2 ${maxWidthClass} mx-auto w-full`}>
                {/* Temperature badge */}
                <div className={`shrink-0 h-9 flex items-center px-2 rounded-full text-[11px] font-bold transition-all ${
                  temperature === "hot" ? "bg-red-500/20 text-red-400 animate-pulse" :
                  temperature === "warm" ? "bg-amber-500/20 text-amber-400" :
                  "bg-blue-500/10 text-blue-400/70"
                }`} title={temperature === "hot" ? "Lead QUENTE — intenção de compra detectada!" : temperature === "warm" ? "Lead ativo" : "Lead frio"}>
                  {temperature === "hot" ? "🔥" : temperature === "warm" ? "🟡" : "🔵"}
                </div>
                {/* Toggle IA */}
                <Button
                  size="icon"
                  variant={iaAtiva ? "ghost" : "destructive"}
                  className={`shrink-0 h-9 w-9 rounded-full transition-colors ${iaAtiva ? "text-emerald-500 hover:text-emerald-600" : "opacity-80"}`}
                  title={iaAtiva ? "IA ativa — clique para pausar atendimento manual" : "IA pausada — clique para reativar"}
                  onClick={toggleIa}
                  disabled={togglingIa}
                >
                  {togglingIa ? <Loader2 className="h-4 w-4 animate-spin" /> : iaAtiva ? <Bot className="h-4 w-4" /> : <BotOff className="h-4 w-4" />}
                </Button>

                {/* Toggle Intel Panel (desktop only — header controls it on compact) */}
                <Button
                  size="icon"
                  variant={showIntelPanel ? "secondary" : "ghost"}
                  className={`hidden lg:flex shrink-0 h-9 w-9 rounded-full transition-colors ${showIntelPanel ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title={showIntelPanel ? "Ocultar Intel do Lead" : "Mostrar Intel do Lead"}
                  onClick={() => onToggleIntelPanel ? onToggleIntelPanel() : setShowIntelPanel(prev => !prev)}
                >
                  <Activity className="h-4 w-4" />
                </Button>

                <div className="hidden lg:flex items-end gap-2">
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

                {/* Interactive Actions (Buttons / Lists) */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 rounded-full" title="Mensagens Interativas">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3 bg-card border border-border/50 text-xs shadow-xl rounded-xl" align="start" side="top">
                    <p className="font-bold text-foreground mb-2 flex items-center gap-1">⚡ Mensagens Interativas</p>
                    <Tabs defaultValue="buttons" className="w-full">
                      <TabsList className="grid grid-cols-2 bg-secondary/35 border border-border/20 p-0.5 rounded-lg mb-3">
                        <TabsTrigger value="buttons" className="py-1 text-[10px]">Botões</TabsTrigger>
                        <TabsTrigger value="list" className="py-1 text-[10px]">Menu/Lista</TabsTrigger>
                      </TabsList>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Texto da Mensagem</label>
                          <Textarea
                            placeholder="Digite o texto explicativo..."
                            value={interactiveText}
                            onChange={e => setInteractiveText(e.target.value)}
                            className="min-h-[50px] text-[11px] bg-secondary/40 border border-border/30 resize-none leading-relaxed"
                          />
                        </div>
                        
                        <TabsContent value="buttons" className="mt-0 space-y-2.5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-muted-foreground font-semibold block">Texto dos Botões (até 3)</label>
                            <Input placeholder="Botão 1 (ex: Falar com Humano)" value={btn1} onChange={e => setBtn1(e.target.value)} className="h-8 text-[11px] bg-secondary/40 border border-border/30" />
                            <Input placeholder="Botão 2 (ex: Ver Depoimentos)" value={btn2} onChange={e => setBtn2(e.target.value)} className="h-8 text-[11px] bg-secondary/40 border border-border/30" />
                            <Input placeholder="Botão 3 (ex: Cancelar)" value={btn3} onChange={e => setBtn3(e.target.value)} className="h-8 text-[11px] bg-secondary/40 border-border/30" />
                          </div>
                          <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow" onClick={sendInteractiveButtons}>
                            Enviar Botões
                          </Button>
                        </TabsContent>
                        
                        <TabsContent value="list" className="mt-0 space-y-2.5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-muted-foreground font-semibold block">Título do Menu de Opções</label>
                            <Input placeholder="ex: Ver opções" value={listBtnText} onChange={e => setListBtnText(e.target.value)} className="h-8 text-[11px] bg-secondary/40 border-border/30" />
                            
                            <label className="text-[10px] text-muted-foreground font-semibold block mt-2">Linhas do Menu (até 5)</label>
                            {listRows.map((row, idx) => (
                              <div key={idx} className="flex gap-1">
                                <Input
                                  placeholder={`Opção ${idx + 1}`}
                                  value={row.title}
                                  onChange={e => setListRows(prev => prev.map((r, i) => i === idx ? { ...r, title: e.target.value } : r))}
                                  className="h-8 text-[11px] bg-secondary/40 border-border/30 flex-1"
                                />
                                <Input
                                  placeholder="Descrição"
                                  value={row.description}
                                  onChange={e => setListRows(prev => prev.map((r, i) => i === idx ? { ...r, description: e.target.value } : r))}
                                  className="h-8 text-[11px] bg-secondary/40 border-border/30 flex-1"
                                />
                              </div>
                            ))}
                          </div>
                          <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow" onClick={sendInteractiveList}>
                            Enviar Lista
                          </Button>
                        </TabsContent>
                      </div>
                    </Tabs>
                  </PopoverContent>
                </Popover>

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

                {/* 3 opções rápidas (empática, técnica, fechamento) */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={`shrink-0 h-9 w-9 rounded-full hover:bg-amber-500/10 ${
                    showQuickSuggest ? "bg-amber-500/15 text-amber-400" : "text-muted-foreground"
                  }`}
                  title="3 sugestões de resposta (empática, técnica, fechamento)"
                  onClick={() => showQuickSuggest ? setShowQuickSuggest(false) : generateQuickOptions()}
                  disabled={loadingQuick || messages.length === 0}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>

                {/* Agendar mensagem */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-sky-400 hover:bg-sky-500/10"
                      title="Agendar mensagem"
                      disabled={!text.trim()}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 bg-popover" align="end" side="top">
                    <p className="text-xs font-semibold mb-2">Agendar envio</p>
                    <Input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={e => setScheduleAt(e.target.value)}
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                      className="h-9 text-xs mb-2"
                    />
                    <div className="flex gap-1 mb-2">
                      {[
                        { label: "+15min", min: 15 },
                        { label: "+1h", min: 60 },
                        { label: "Amanhã 9h", min: -1 },
                      ].map(p => (
                        <Button key={p.label} size="sm" variant="outline" className="h-7 text-[10px] flex-1"
                          onClick={() => {
                            const d = new Date();
                            if (p.min === -1) { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
                            else d.setMinutes(d.getMinutes() + p.min);
                            setScheduleAt(d.toISOString().slice(0, 16));
                          }}>{p.label}</Button>
                      ))}
                    </div>
                    <Button size="sm" className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                      onClick={async () => {
                        if (!scheduleAt || !text.trim()) { toast.error("Defina data e texto"); return; }
                        const when = new Date(scheduleAt);
                        if (when.getTime() < Date.now() + 30000) { toast.error("Escolha um horário futuro"); return; }
                        const { error } = await supabase.from("imphq_wa_scheduled").insert({
                          conversation_id: conversationId, project_id: projectId, provider_id: providerId,
                          phone, content: text, scheduled_at: when.toISOString(),
                        } as any);
                        if (error) { toast.error("Falha ao agendar: " + error.message); return; }
                        toast.success(`Agendado para ${when.toLocaleString("pt-BR")}`);
                        setText(""); setScheduleAt("");
                      }}>Agendar</Button>
                  </PopoverContent>
                </Popover>
                </div>

                {/* Compact more actions menu */}
                <div className="flex lg:hidden items-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full shrink-0" title="Mais ações">
                        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="w-48">
                      <DropdownMenuItem onClick={() => setShowEmoji(true)} className="gap-2">
                        <Smile className="h-4 w-4" /> Emojis
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                        <Paperclip className="h-4 w-4" /> Enviar mídia
                      </DropdownMenuItem>
                      {templates.length > 0 && (
                        <DropdownMenuItem onClick={() => { setText(templates[0]?.content || ""); textareaRef.current?.focus(); }} className="gap-2">
                          <FileText className="h-4 w-4" /> Template {templates[0]?.name}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => { generateCopilotSuggestion(); }} className="gap-2" disabled={loadingCopilot || messages.length === 0}>
                        <Brain className="h-4 w-4 text-primary" /> Sugestão IA
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => showQuickSuggest ? setShowQuickSuggest(false) : generateQuickOptions()} className="gap-2" disabled={loadingQuick || messages.length === 0}>
                        <Sparkles className="h-4 w-4" /> 3 opções rápidas
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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

                {/* Send or Record button */}
                {!text.trim() ? (
                  <Button
                    size="icon"
                    onClick={startRecording}
                    type="button"
                    className="shrink-0 h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow"
                    title="Gravar áudio"
                  >
                    <Mic className="h-4.5 w-4.5" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={sendAsVoice}
                      disabled={sending || sendingVoice || !text.trim()}
                      className="shrink-0 h-9 w-9 rounded-full text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                      title="Sintetizar áudio e enviar"
                    >
                      {sendingVoice ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : <Volume2 className="h-4.5 w-4.5" />}
                    </Button>
                    <Button
                      size="icon"
                      onClick={send}
                      disabled={sending || !text.trim()}
                      className="shrink-0 h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow text-white"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {showIntelPanel && (
          <LeadIntelPanel phone={phone} projectId={projectId} />
        )}
      </div>
    );
  }
);

ChatView.displayName = "ChatView";

export default ChatView;
