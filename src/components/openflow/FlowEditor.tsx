import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus, Trash2, Clock, Mail, MessageCircle, Send, Sparkles,
  ChevronUp, ChevronDown, GitBranch, SaveAll, Variable, Eye, EyeOff,
  ZoomIn, ZoomOut, Maximize2, Settings2, CheckCircle2, ArrowRight,
  Mic, Volume2, VolumeX, Pause, Play, Sliders, Loader2, Tag, Split, Brain, BarChart3, Bell, Unlock, Globe, Repeat, Octagon, Copy, Timer, Minimize2, MessageSquare, User, MoveRight
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FlowEditorCanvas } from "./FlowEditorCanvas";
import { useFlowHistory } from "./flow-editor/useFlowHistory";
import { validateFlow } from "./flow-editor/validate";
import { ValidationPanel } from "./flow-editor/ValidationPanel";
import { TemplatePicker } from "./flow-editor/TemplatePicker";
import { MediaPicker } from "./MediaPicker";
import { ABVariantStats } from "./flow-editor/ABVariantStats";
import { Undo2, Redo2 } from "lucide-react";


const CONDICAO_TIPOS = [
  { value: "nao_abriu_email", label: "Não abriu email" },
  { value: "nao_respondeu_whatsapp", label: "Não respondeu WhatsApp" },
  { value: "nao_clicou_link", label: "Não clicou no link" },
  { value: "clicou_link", label: "Clicou no link" },
  { value: "abriu_email", label: "Abriu email" },
  { value: "respondeu_whatsapp", label: "Respondeu WhatsApp" },
];

const ACAO_TIPOS = [
  { value: "email", label: "Email (Resend)", icon: Mail, emoji: "✉️", color: "border-blue-500/40 bg-blue-500/5 hover:border-blue-400" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, emoji: "💬", color: "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400" },
  { value: "audio", label: "Áudio WhatsApp (IA)", icon: Mic, emoji: "🎙️", color: "border-rose-500/40 bg-rose-500/5 hover:border-rose-400" },
  { value: "ia_message", label: "IA Conversacional (Mente)", icon: Sparkles, emoji: "🤖", color: "border-purple-500/40 bg-purple-500/5 hover:border-purple-400" },
  { value: "adicionar_tag", label: "Atribuir Tag", icon: Tag, emoji: "🏷️", color: "border-indigo-500/40 bg-indigo-500/5 hover:border-indigo-400" },
  { value: "remover_tag", label: "Remover Tag", icon: Tag, emoji: "🏷️", color: "border-rose-500/40 bg-rose-500/5 hover:border-rose-400" },
  { value: "telegram", label: "Telegram", icon: Send, emoji: "📨", color: "border-sky-500/40 bg-sky-500/5 hover:border-sky-400" },
  { value: "aguardar", label: "Aguardar", icon: Clock, emoji: "⏱", color: "border-amber-500/40 bg-amber-500/5 hover:border-amber-400" },
  { value: "wait_event", label: "Aguardar Evento", icon: Clock, emoji: "⏱️", color: "border-cyan-500/40 bg-cyan-500/5 hover:border-cyan-400" },
  { value: "wait_reply", label: "Aguardar Resposta do Lead", icon: MessageSquare, emoji: "💬", color: "border-lime-500/40 bg-lime-500/5 hover:border-lime-400" },
  { value: "input_capture", label: "Capturar Resposta → Variável", icon: Variable, emoji: "📥", color: "border-orange-500/40 bg-orange-500/5 hover:border-orange-400" },
  { value: "generate_image", label: "Gerar Imagem (IA)", icon: Sparkles, emoji: "🎨", color: "border-pink-500/40 bg-pink-500/5 hover:border-pink-400" },
  { value: "ab_split", label: "Teste A/B de Caminho", icon: Split, emoji: "🔀", color: "border-fuchsia-500/40 bg-fuchsia-500/5 hover:border-fuchsia-400" },
  { value: "condicao", label: "Condição (Se…)", icon: GitBranch, emoji: "🔀", color: "border-violet-500/40 bg-violet-500/5 hover:border-violet-400" },
  { value: "condicao_lead", label: "Condição por Dado do Lead", icon: GitBranch, emoji: "🔀", color: "border-orange-500/40 bg-orange-500/5 hover:border-orange-400" },
  { value: "branch_by_awareness", label: "Ramificar por Consciência", icon: Brain, emoji: "🧠", color: "border-orange-500/40 bg-orange-500/5 hover:border-orange-400" },
  { value: "branch_by_intent", label: "Ramificar por Intenção", icon: GitBranch, emoji: "🎯", color: "border-pink-500/40 bg-pink-500/5 hover:border-pink-400" },
  { value: "update_memory", label: "Atualizar Memória", icon: Brain, emoji: "💾", color: "border-teal-500/40 bg-teal-500/5 hover:border-teal-400" },
  { value: "qualify_lead", label: "Qualificar Lead", icon: BarChart3, emoji: "⭐", color: "border-yellow-500/40 bg-yellow-500/5 hover:border-yellow-400" },
  { value: "notify_operator", label: "Notificar Atendente", icon: Bell, emoji: "🔔", color: "border-blue-500/40 bg-blue-500/5 hover:border-blue-400" },
  { value: "abrir_conversa", label: "Abrir Conversa", icon: Unlock, emoji: "🔓", color: "border-teal-500/40 bg-teal-500/5 hover:border-teal-400" },
  { value: "gpt_prompt", label: "Executar Prompt GPT", icon: Brain, emoji: "🤖", color: "border-green-500/40 bg-green-500/5 hover:border-green-400" },
  { value: "webhook_call", label: "Chamar Webhook / API", icon: Globe, emoji: "🌐", color: "border-cyan-500/40 bg-cyan-500/5 hover:border-cyan-400" },
  { value: "loop_steps", label: "Loop de Etapas", icon: Repeat, emoji: "🔁", color: "border-yellow-500/40 bg-yellow-500/5 hover:border-yellow-400" },
  { value: "stop_on_event", label: "Condição de Parada (Parar)", icon: Octagon, emoji: "🛑", color: "border-red-500/40 bg-red-500/5 hover:border-red-400" },
  { value: "ia_scheduling", label: "Agendamento por IA", icon: Clock, emoji: "📅", color: "border-blue-500/40 bg-blue-500/5 hover:border-blue-400" },
  { value: "semantic_router", label: "Roteador Semântico (IA)", icon: GitBranch, emoji: "🔀", color: "border-purple-500/40 bg-purple-500/5 hover:border-purple-400" },
  { value: "business_hours_split", label: "Horário Comercial (Se...)", icon: Timer, emoji: "⏰", color: "border-amber-500/40 bg-amber-500/5 hover:border-amber-400" },
  { value: "branch_by_score", label: "Ramificar por Score do Lead", icon: BarChart3, emoji: "📊", color: "border-yellow-500/40 bg-yellow-500/5 hover:border-yellow-400" },
  { value: "slack_notify", label: "Notificar Slack", icon: Bell, emoji: "💼", color: "border-violet-500/40 bg-violet-500/5 hover:border-violet-400" },
  { value: "update_lead", label: "Atualizar Lead (campo)", icon: User, emoji: "👤", color: "border-blue-500/40 bg-blue-500/5 hover:border-blue-400" },
  { value: "move_stage", label: "Mover Lead de Etapa (Funil)", icon: MoveRight, emoji: "➡️", color: "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400" },
];

const TRIGGERS_MAP: Record<string, { label: string; icon: string; group: string }> = {
  lead_novo: { label: "Novo Lead", icon: "👤", group: "Lead" },
  inicio_checkout: { label: "Início de Checkout", icon: "🛍️", group: "Lead" },
  carrinho_abandonado: { label: "Carrinho Abandonado", icon: "🛒", group: "Pagamento" },
  aguardando_pagamento: { label: "Aguardando Pagamento / Pix Gerado", icon: "💰", group: "Pagamento" },
  boleto_gerado: { label: "Boleto Gerado", icon: "📄", group: "Pagamento" },
  pagamento_recusado: { label: "Pagamento Recusado", icon: "❌", group: "Pagamento" },
  pagamento_expirado: { label: "Pagamento Expirado (Pix/Boleto)", icon: "⌛", group: "Pagamento" },
  compra_aprovada: { label: "Compra Aprovada", icon: "✅", group: "Pós-venda" },
  primeiro_acesso: { label: "Primeiro Acesso", icon: "🎉", group: "Pós-venda" },
  upsell_aprovado: { label: "Upsell Aprovado", icon: "⬆️", group: "Pós-venda" },
  orderbump_aprovado: { label: "Orderbump Aprovado", icon: "🎁", group: "Pós-venda" },
  reembolso: { label: "Reembolso", icon: "↩️", group: "Retenção" },
  chargeback: { label: "Chargeback", icon: "⚠️", group: "Retenção" },
  compra_cancelada: { label: "Compra Cancelada", icon: "🚫", group: "Retenção" },
  assinatura_cancelada: { label: "Assinatura Cancelada", icon: "💔", group: "Retenção" },
  assinatura_renovada: { label: "Assinatura Renovada", icon: "🔄", group: "Retenção" },
  trial_iniciado: { label: "Trial Iniciado", icon: "🆓", group: "Retenção" },
  tag_adicionada: { label: "Tag Adicionada", icon: "🏷️", group: "Lead" },
};

const DYNAMIC_VARS = [
  { var: "{{nome}}", label: "Nome" },
  { var: "{{email}}", label: "Email" },
  { var: "{{produto}}", label: "Produto" },
  { var: "{{valor}}", label: "Valor" },
  { var: "{{telefone}}", label: "Telefone" },
  { var: "{{link}}", label: "Link" },
];

export interface Acao {
  id?: string;
  tipo: string;
  template: string;
  delay_min: number;
  personality?: string;
  condicao_tipo?: string;
  condicao_tempo_min?: number;
  provider_id?: string;
  voice_provider?: string;
  voice_id?: string;
  voice_stability?: number;
  voice_clarity?: number;
  tag?: string;
  next_id?: string;
  true_next_id?: string;
  false_next_id?: string;
  else_action?: string;
  else_skip?: number;
  // branch_by_awareness
  awareness_min?: number;
  awareness_max?: number;
  // branch_by_intent
  intents?: string;
  // update_memory
  memory_key?: string;
  memory_value?: string;
  // qualify_lead
  lead_score?: number;
  lead_tags?: string;
  lead_stage?: string;
  // wait_event
  event_name?: string;
  event_names?: string;
  timeout_min?: number;
  // branch_by_score
  score_min?: number;
  score_max?: number;
  // slack_notify
  text?: string;
  // update_lead
  lead_field?: string;
  lead_op?: string;
  lead_value?: string;
  // move_stage
  target_stage?: string;
  // ab_split
  rota_a_porcentagem?: number;
  jump_steps?: number;
  ab_test_enabled?: boolean;
  template_b?: string;
  mensagem_b?: string;
  // notify_operator
  operator_name?: string;
  // gpt_prompt
  gpt_model?: string;
  gpt_temperature?: number;
  gpt_max_tokens?: number;
  gpt_save_variable?: string;
  gpt_send_message?: boolean;
  gpt_keep_context?: boolean;
  // ia_message custom settings
  ia_model?: string;
  ia_search_web?: boolean;
  ia_search_files?: boolean;
  ia_vision?: boolean;
  ia_voice_response?: boolean;
  ia_routes?: { name: string; jump_steps: number }[];
  personality_prompt?: string;
  questioning_strategy?: string;
  // condicao_lead
  condition_field?: string;
  condition_operator?: string;
  condition_value?: string;
  condition_jump_steps?: number;
  condition_else_jump_steps?: number;
  // webhook_call
  webhook_url?: string;
  webhook_method?: string;
  webhook_headers?: string;
  webhook_body?: string;
  webhook_save_variable?: string;
  // loop_steps
  loop_count?: number;
  loop_jump_back_steps?: number;
  loop_interval_hours?: number;
  loop_until_condition_field?: string;
  loop_until_condition_operator?: string;
  loop_until_condition_value?: string;
  // stop_on_event
  stop_event_type?: string;
  stop_event_value?: string;
  // ia_scheduling
  calendar_provider?: string;
  calendar_url?: string;
  scheduling_duration_min?: number;
  // semantic_router
  router_definition_a?: string;
  router_definition_b?: string;
  // business_hours_split
  work_hours_start?: string;
  work_hours_end?: string;
  work_days?: string;
  // generic fields used by validators / canvas
  mensagem?: string;
  corpo?: string;
  assunto?: string;
  conteudo?: string;
  position_x?: number;
  position_y?: number;
  // media attachment (WhatsApp node)
  media?: { id: string; url: string; label: string; kind: "image" | "audio" | "video" | "doc" } | null;
  // input_capture
  capture_variable?: string;
  ai_extract_prompt?: string;
  // generate_image
  image_prompt?: string;
  image_style?: string;
  image_ratio?: "1:1" | "9:16" | "16:9";
  send_after?: boolean;
}

export interface WaProvider {
  id: string;
  provider: string;
  instance_name?: string;
  twilio_from?: string;
  project_id?: string;
}

export interface ProjectTemplate {
  label: string;
  content: string;
  source: string;
}

interface FlowEditorProps {
  triggerTipo: string;
  acoes: Acao[];
  onChange: (acoes: Acao[]) => void;
  onGenerateAI?: () => void;
  isGenerating?: boolean;
  templates?: ProjectTemplate[];
  providers?: WaProvider[];
  projectId?: string;
  onTemplateSaved?: () => void;
  automacaoId?: string;
  flowObjective?: string;
  onUpdateObjective?: (objective: string) => void;
  onTriggerChange?: (trigger: string) => void;
}

export function FlowEditor({
  triggerTipo, acoes, onChange: onChangeProp, onGenerateAI, isGenerating,
  templates = [], providers = [], projectId, onTemplateSaved,
  automacaoId, flowObjective, onUpdateObjective, onTriggerChange,
}: FlowEditorProps) {

  const history = useFlowHistory<Acao[]>(acoes, onChangeProp, { limit: 50 });
  const onChange = history.push;
  const issues = useMemo(() => validateFlow(acoes), [acoes]);

  
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [resendConfig, setResendConfig] = useState<{ from_email?: string; from_name?: string } | null>(null);

  const [stepStats, setStepStats] = useState<Record<number, { reached: number; completed: number; waiting: number; failed: number }>>({});
  const [loadingStats, setLoadingStats] = useState(false);

  const [customSkills, setCustomSkills] = useState<{ id: string; nome: string; categoria?: string }[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  useEffect(() => {
    const fetchSkills = async () => {
      setLoadingSkills(true);
      try {
        const { data, error } = await supabase
          .from("imphq_skills")
          .select("id, nome, categoria")
          .order("nome");
        if (error) throw error;
        setCustomSkills(data || []);
      } catch (err) {
        console.error("Error loading custom skills for FlowEditor:", err);
      } finally {
        setLoadingSkills(false);
      }
    };
    fetchSkills();
  }, []);

  useEffect(() => {
    if (!automacaoId) {
      setStepStats({});
      return;
    }

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const { data, error } = await supabase
          .from("imphq_flow_executions")
          .select("step_results")
          .eq("automacao_id", automacaoId);

        if (error) throw error;

        const tempStats: Record<number, { reached: number; completed: number; waiting: number; failed: number }> = {};
        
        // Initialize stats for each action
        acoes.forEach((_, idx) => {
          tempStats[idx] = { reached: 0, completed: 0, waiting: 0, failed: 0 };
        });

        (data || []).forEach((exec: any) => {
          const results = exec.step_results || [];
          if (!Array.isArray(results)) return;

          results.forEach((stepRes: any) => {
            const stepIdx = typeof stepRes.step === "number" ? stepRes.step : parseInt(stepRes.step);
            if (isNaN(stepIdx) || stepIdx < 0 || stepIdx >= acoes.length) return;

            if (!tempStats[stepIdx]) {
              tempStats[stepIdx] = { reached: 0, completed: 0, waiting: 0, failed: 0 };
            }

            tempStats[stepIdx].reached++;

            const isCompleted = stepRes.status === "completed" || stepRes.status === "sent" || stepRes.status === "success" || stepRes.status === "guided_ai_completed";
            const isWaiting = stepRes.status === "waiting" || stepRes.status === "running" || stepRes.status === "waiting_for_lead_response" || stepRes.status === "delayed_for_condition";
            const isFailed = stepRes.status === "error" || stepRes.status === "failed";

            if (isCompleted) {
              tempStats[stepIdx].completed++;
            } else if (isWaiting) {
              tempStats[stepIdx].waiting++;
            } else if (isFailed) {
              tempStats[stepIdx].failed++;
            }
          });
        });

        setStepStats(tempStats);
      } catch (err) {
        console.error("Error fetching automation step stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [automacaoId, acoes.length]);

  useEffect(() => {
    // Ensure all actions have a unique ID for graph branching
    const needsIds = acoes.some(a => !a.id);
    if (needsIds) {
      const updated = acoes.map(a => ({
        ...a,
        id: a.id || crypto.randomUUID()
      }));
      onChange(updated);
    }
  }, [acoes, onChange]);

  useEffect(() => {
    if (!projectId) {
      setResendConfig(null);
      return;
    }
    
    const fetchResend = async () => {
      try {
        const { data, error } = await supabase
          .from("imphq_integration_credentials")
          .select("credentials")
          .eq("project_id", projectId)
          .eq("provider", "resend")
          .maybeSingle();
        
        if (data?.credentials) {
          const creds = data.credentials as any;
          setResendConfig({
            from_email: creds.from_email || "",
            from_name: creds.from_name || "",
          });
        } else {
          // Fallback to legacy project data
          const { data: proj } = await supabase
            .from("imphq_projects")
            .select("data")
            .eq("id", projectId)
            .single();
          const emailConfig = (proj?.data as any)?.email_config || {};
          const briefing = (proj?.data as any)?.checklist?.resend || {};
          setResendConfig({
            from_email: emailConfig.from_email || briefing.from_email || "sem_config@resend.com",
            from_name: emailConfig.from_name || briefing.from_name || "Sem Nome",
          });
        }
      } catch (e) {
        console.error("Erro ao carregar credenciais do Resend", e);
      }
    };
    
    fetchResend();
  }, [projectId]);

  // Flow View and Reorder States
  const [activeTab, setActiveTab] = useState<"editor" | "simulator">("editor");
  const [viewMode, setViewMode] = useState<"list" | "canvas">("canvas");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx.toString());
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    
    const updated = [...acoes];
    const [draggedItem] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, draggedItem);
    
    onChange(updated);
    setSelectedIdx(targetIdx);
    setDraggedIdx(null);
    setDragOverIdx(null);
    toast.success(`Fluxo reorganizado! Ação #${draggedIdx + 1} movida para a posição #${targetIdx + 1}.`);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Audio Voice States
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [hasGeneratedVoice, setHasGeneratedVoice] = useState<Record<number, boolean>>({});
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(12);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<any>(null);
  const speechIntervalRef = useRef<any>(null);

  useEffect(() => {
    // Cancel speech synthesis when changing active node or unmounting
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
    }
    setIsPlayingVoice(false);
    setVoiceProgress(0);
    setPlaybackTime(0);
  }, [selectedIdx]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
      }
    };
  }, []);

  const generateVoicePreview = (idx: number) => {
    setIsGeneratingVoice(true);
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Conectando ao ElevenLabs... Clonando avatar de voz...",
        success: () => {
          setIsGeneratingVoice(false);
          setHasGeneratedVoice(prev => ({ ...prev, [idx]: true }));
          return "Áudio sintetizado e pronto para reprodução!";
        },
        error: "Falha na comunicação de áudio."
      }
    );
  };

  const playSpeechTTS = (idx: number, templateText: string, voiceId?: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Síntese de voz não é suportada neste navegador.");
      return;
    }

    if (isPlayingVoice) {
      window.speechSynthesis.cancel();
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      setIsPlayingVoice(false);
      setVoiceProgress(0);
      setPlaybackTime(0);
      return;
    }

    const cleanText = renderPreview(templateText || "");
    if (!cleanText.trim()) {
      toast.error("Roteiro vazio. Digite alguma coisa para ouvir.");
      return;
    }

    // Cancel any ongoing speaking
    window.speechSynthesis.cancel();
    if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    // Pick correct voice
    const voices = window.speechSynthesis.getVoices();
    const isMale = voiceId === "felipe_sales";
    const ptBrVoices = voices.filter(v => v.lang.toLowerCase().includes("pt-br") || v.lang.toLowerCase().includes("pt"));
    let selectedVoice = ptBrVoices[0] || voices[0];

    if (ptBrVoices.length > 0) {
      if (isMale) {
        const male = ptBrVoices.find(v => v.name.toLowerCase().includes("daniel") || v.name.toLowerCase().includes("google português") || v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("felipe"));
        if (male) selectedVoice = male;
      } else {
        const female = ptBrVoices.find(v => v.name.toLowerCase().includes("maria") || v.name.toLowerCase().includes("francisca") || v.name.toLowerCase().includes("google português") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("fernanda") || v.name.toLowerCase().includes("tatiane"));
        if (female) selectedVoice = female;
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Voice configs affect speak metrics
    const stability = acoes[idx].voice_stability ?? 75;
    utterance.rate = 0.85 + (100 - stability) * 0.003; 
    utterance.pitch = isMale ? 0.8 : 1.1; 
    utterance.volume = isMuted ? 0 : volume;

    // Estimate duration
    const wordCount = cleanText.split(/\s+/).length;
    const estDuration = Math.max(3, Math.round(wordCount * 0.48)); 
    setDuration(estDuration);

    utterance.onstart = () => {
      setIsPlayingVoice(true);
      const startTime = Date.now();
      speechIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= estDuration) {
          clearInterval(speechIntervalRef.current);
        } else {
          setPlaybackTime(elapsed);
          setVoiceProgress((elapsed / estDuration) * 100);
        }
      }, 100);
    };

    utterance.onend = () => {
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      setIsPlayingVoice(false);
      setVoiceProgress(0);
      setPlaybackTime(0);
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      setIsPlayingVoice(false);
      setVoiceProgress(0);
      setPlaybackTime(0);
    };

    window.speechSynthesis.speak(utterance);
  };

  const saveAsTemplate = async (acao: Acao) => {
    if (!acao.template?.trim()) { toast.error("Escreva uma mensagem antes de salvar"); return; }
    setSavingTemplate(true);
    try {
      const name = acao.template.split(/\s+/).slice(0, 5).join(" ");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("imphq_wa_templates").insert({
        name,
        content: acao.template,
        category: acao.tipo || "whatsapp",
        project_id: projectId || null,
        user_id: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Template de automação salvo!");
      onTemplateSaved?.();
    } catch (e: any) {
      toast.error("Erro ao salvar template: " + (e?.message || ""));
    } finally {
      setSavingTemplate(false);
    }
  };

  const insertVariable = (idx: number, variable: string) => {
    const updated = [...acoes];
    updated[idx] = { ...updated[idx], template: (updated[idx].template || "") + variable };
    onChange(updated);
  };

  const renderPreview = (text: string) => {
    return text
      .replace(/\{\{nome\}\}/g, "João Silva")
      .replace(/\{\{email\}\}/g, "joao@email.com")
      .replace(/\{\{produto\}\}/g, "Curso Premium")
      .replace(/\{\{valor\}\}/g, "R$ 297,00")
      .replace(/\{\{telefone\}\}/g, "(11) 99999-9999");
  };

  const trigger = TRIGGERS_MAP[triggerTipo] || { label: triggerTipo, icon: "⚡" };

  const addAcao = (insertAt?: number) => {
    const newAcao: Acao = { 
      id: crypto.randomUUID(),
      tipo: "email", 
      template: "", 
      delay_min: 0 
    };
    if (insertAt !== undefined) {
      const updated = [...acoes];
      // When inserting between nodes, we should probably update connections too
      // but for now let's just insert into the array for compatibility
      updated.splice(insertAt + 1, 0, newAcao);
      
      // Update next_id if it's a linear flow
      if (updated[insertAt]) {
        updated[insertAt].next_id = newAcao.id;
      }
      if (updated[insertAt + 2]) {
        newAcao.next_id = updated[insertAt + 2].id;
      }

      onChange(updated);
      setSelectedIdx(insertAt + 1);
    } else {
      const lastAcao = acoes[acoes.length - 1];
      const updated = [...acoes, newAcao];
      if (lastAcao) {
        lastAcao.next_id = newAcao.id;
      }
      onChange(updated);
      setSelectedIdx(acoes.length);
    }
    toast.success("Novo nó adicionado ao fluxo!");
  };

  const removeAcao = (idx: number) => {
    onChange(acoes.filter((_, i) => i !== idx));
    setSelectedIdx(null);
    toast.info("Nó removido do fluxo.");
  };

  const duplicateAcao = (idx: number) => {
    const original = acoes[idx];
    const cloned: Acao = JSON.parse(JSON.stringify(original));
    if (cloned.position_x !== undefined) cloned.position_x += 40;
    if (cloned.position_y !== undefined) cloned.position_y += 40;
    
    const updated = [...acoes];
    updated.splice(idx + 1, 0, cloned);
    onChange(updated);
    setSelectedIdx(idx + 1);
    toast.success("Ação duplicada com sucesso!");
  };

  const updateAcao = (idx: number, field: string, value: any) => {
    const updated = [...acoes];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const moveAcao = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= acoes.length) return;
    const updated = [...acoes];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onChange(updated);
    setSelectedIdx(target);
  };

  const acaoMeta = (tipo: string) => ACAO_TIPOS.find(t => t.value === tipo) || ACAO_TIPOS[0];

  const handleZoom = (type: "in" | "out" | "reset") => {
    if (type === "in") setZoom(prev => Math.min(1.5, prev + 0.1));
    else if (type === "out") setZoom(prev => Math.max(0.6, prev - 0.1));
    else setZoom(1);
  };

  return (
    <div className={`relative border border-border bg-slate-950 transition-all duration-300 ${
      isFullscreen 
        ? "fixed inset-0 z-50 h-screen w-screen rounded-none" 
        : "rounded-2xl h-[780px]"
    } overflow-hidden flex flex-col shadow-inner`}>
      
      {/* ── CANVAS TOOLBAR ── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-border/80 px-2.5 py-1.5 rounded-xl shadow-lg shrink-0 select-none">
        {viewMode === "list" && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleZoom("in")}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleZoom("out")}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleZoom("reset")}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono text-muted-foreground/80 font-bold px-1">{Math.round(zoom * 100)}%</span>
          </>
        )}
        
        {onGenerateAI && (
          <>
            <div className="w-[1px] h-4 bg-border/60 mx-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerateAI}
              disabled={isGenerating}
              className="h-7 bg-primary/10 border-primary/25 hover:bg-primary/20 text-primary text-[10px] gap-1 px-2.5 rounded-lg font-bold"
            >
              <Sparkles className="h-3 w-3 animate-pulse" />
              {isGenerating ? "Gerando..." : "Gerar com IA"}
            </Button>
          </>
        )}

        <div className="w-[1px] h-4 bg-border/60 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-40"
          onClick={history.undo}
          disabled={!history.canUndo}
          title={`Desfazer (Ctrl+Z) — ${history.pastSize} passos`}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-40"
          onClick={history.redo}
          disabled={!history.canRedo}
          title="Refazer (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-[1px] h-4 bg-border/60 mx-1" />
        <ValidationPanel
          issues={issues}
          onJump={(i) => {
            setSelectedIdx(i);
            const el = document.querySelector(`[data-step-index="${i}"]`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
        <TemplatePicker
          triggerTipo={triggerTipo}
          onApply={(novasAcoes) => {
            onChange(novasAcoes);
            toast.success("Template aplicado");
          }}
        />
      </div>


      {/* ── VIEWPORT TABS (Top Centered Toolbar) ── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md border border-border/80 p-1 rounded-xl shadow-lg shrink-0 select-none">
        {activeTab === "editor" && (
          <div className="flex items-center gap-0.5 bg-slate-950/40 rounded-lg p-0.5 mr-2 border border-border/30">
            <button
              onClick={() => setViewMode("list")}
              className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${
                viewMode === "list"
                  ? "bg-amber-500 text-black font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ☰ Lista
            </button>
            <button
              onClick={() => setViewMode("canvas")}
              className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${
                viewMode === "canvas"
                  ? "bg-amber-500 text-black font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🔷 Canvas
            </button>
          </div>
        )}
        <Button
          variant={activeTab === "editor" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("editor")}
          className={`h-7 text-[10px] font-bold gap-1 rounded-lg ${activeTab === "editor" ? "bg-amber-500 text-black hover:bg-amber-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Editor de Fluxo
        </Button>
        <Button
          variant={activeTab === "simulator" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("simulator")}
          className={`h-7 text-[10px] font-bold gap-1 rounded-lg ${activeTab === "simulator" ? "bg-amber-500 text-black hover:bg-amber-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Simulador WhatsApp
        </Button>
        <div className="w-[1px] h-4 bg-border/60 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 rounded-lg"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4 text-amber-500" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* ── CANVAS WORKSPACE ── */}
      {activeTab === "editor" && (
        viewMode === "canvas" ? (
          <FlowEditorCanvas
            acoes={acoes}
            triggerTipo={triggerTipo}
            onChange={onChange}
            onActionSelect={setSelectedIdx}
            stepStats={stepStats}
            flowObjective={flowObjective}
            onUpdateObjective={onUpdateObjective}
          />
        ) : (
          <div 
            ref={canvasRef}
            className="flex-1 overflow-auto p-12 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] bg-slate-950/40 relative"
          >
          <div 
            className="flex flex-col items-center min-w-max mx-auto transition-transform duration-200 select-none"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
          
          {/* TRIGGER NODE */}
          <div className="relative group shrink-0">
            <div className="w-64 border border-primary/40 bg-gradient-to-b from-primary/10 to-primary/5 shadow-lg shadow-primary/5 rounded-xl p-4 flex items-center gap-3 relative transition-all duration-300 hover:border-primary">
              
              {/* LED Ring Glow */}
              <div className="absolute inset-0 rounded-xl border border-primary/20 bg-primary/5 blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-2xl shrink-0">
                {trigger.icon}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-bold tracking-widest text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">Gatilho Principal</span>
                {onTriggerChange ? (
                  <Select
                    value={triggerTipo}
                    onValueChange={(v) => {
                      onTriggerChange(v);
                      toast.success(`Gatilho alterado para "${TRIGGERS_MAP[v]?.label || v}"`);
                    }}
                  >
                    <SelectTrigger className="h-7 mt-1 bg-transparent border-0 px-0 py-0 text-xs font-bold text-foreground hover:text-primary focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[60vh]">
                      {Object.entries(
                        Object.entries(TRIGGERS_MAP).reduce<Record<string, [string, typeof TRIGGERS_MAP[string]][]>>((acc, [k, v]) => {
                          (acc[v.group] = acc[v.group] || []).push([k, v]);
                          return acc;
                        }, {})
                      ).map(([group, items]) => (
                        <div key={group}>
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{group}</div>
                          {items.map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs font-bold text-foreground mt-1 truncate">{trigger.label}</p>
                )}
              </div>
              
              {/* Output Connection Node */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-950 border border-primary flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
          </div>

          {/* SVG Connection Path */}
          {acoes.length > 0 && <SVGBezierConnector delay="0s" />}

          {acoes.length === 0 && (
            <div className="flex flex-col items-center gap-3">
              <SVGBezierConnector delay="0s" />
              <div className="flex flex-col items-center gap-2">
                <TemplatePicker
                  triggerTipo={triggerTipo}
                  variant="hero"
                  onApply={(novasAcoes) => {
                    onChange(novasAcoes);
                    toast.success("Template aplicado");
                  }}
                />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">ou</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addAcao()}
                  className="text-xs bg-slate-900 border-dashed border-border/80 text-muted-foreground hover:text-primary rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Primeira Ação
                </Button>
              </div>
            </div>
          )}


          {/* ACTION NODES (Floating Serpentine Seriado Layout) */}
          {acoes.map((acao, idx) => {
            const meta = acaoMeta(acao.tipo);
            const isSelected = selectedIdx === idx;
            const isAguardar = acao.tipo === "aguardar";
            const isCondicao = acao.tipo === "condicao";
            const isWaitEvent = acao.tipo === "wait_event" || acao.tipo === "wait_until_event";
            const isAbSplit = acao.tipo === "ab_split";
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx;

            // serpentine x stagger offset to look highly visual node-based
            const staggerClass = idx % 2 === 0 ? "translate-x-3" : "-translate-x-3";

            return (
              <div 
                key={idx} 
                data-step-index={idx}
                className="flex flex-col items-center shrink-0"
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
              >
                
                {/* Visual Stagger node wrapper */}
                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative transition-all duration-300 ${staggerClass} group ${
                    isDragging ? "opacity-30 scale-95" : ""
                  } ${isDragOver ? "pt-4 duration-150 border-t-2 border-dashed border-amber-500/50" : ""}`}
                >
                  
                  {/* Glowing halo indicator */}
                  <div className={`absolute -inset-0.5 rounded-xl blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                    isSelected ? "bg-primary/25 opacity-100" : "bg-muted-foreground/10"
                  }`} />

                  {/* Node Card */}
                  <div
                    onClick={() => setSelectedIdx(isSelected ? null : idx)}
                    className={`w-64 border rounded-xl p-4 bg-slate-900/80 backdrop-blur-md cursor-grab active:cursor-grabbing relative shadow-md transition-all duration-200 hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-primary bg-slate-900 shadow-inner"
                        : isDragOver
                        ? "border-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse scale-[1.02]"
                        : `border-border/60 ${meta.color}`
                    }`}
                  >
                    {/* Input port Point */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-950 border border-muted-foreground/40 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                    </div>

                    {/* Card Content */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary/80 border border-border/80 flex items-center justify-center text-xl shrink-0">
                        {meta.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground">{meta.label}</span>
                          <span className="text-[8px] text-muted-foreground/80 font-mono">#{idx + 1}</span>
                        </div>
                        
                        {/* Node details summary */}
                        <div className="mt-1">
                          {isCondicao && acao.condicao_tipo && (
                            <Badge variant="secondary" className="text-[8px] bg-violet-500/10 text-violet-400 border-violet-500/20 max-w-full truncate">
                              {CONDICAO_TIPOS.find(c => c.value === acao.condicao_tipo)?.label || acao.condicao_tipo}
                            </Badge>
                          )}
                          {isWaitEvent && (
                            <Badge variant="secondary" className="text-[8px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20 max-w-full truncate">
                              ⏱️ Aguardar: {acao.event_name || "Sem Evento"} ({acao.timeout_min || 60}m)
                            </Badge>
                          )}
                          {isAbSplit && (
                            <Badge variant="secondary" className="text-[8px] bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20">
                              🔀 A: {acao.rota_a_porcentagem ?? 50}% / B: {100 - (acao.rota_a_porcentagem ?? 50)}% (pular {acao.jump_steps ?? 1})
                            </Badge>
                          )}
                          {isAguardar && acao.delay_min > 0 && (
                            <Badge variant="secondary" className="text-[8px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                              Aguardar {acao.delay_min} min
                            </Badge>
                          )}
                          {(acao.tipo === "adicionar_tag" || acao.tipo === "remover_tag") && acao.tag && (
                            <Badge variant="secondary" className="text-[8px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20 max-w-full truncate">
                              Tag: {acao.tag}
                            </Badge>
                          )}
                          {acao.tipo === "ia_message" && acao.template && (
                            <p className="text-[9px] text-purple-400 truncate leading-snug font-medium">
                              Objetivo: {acao.template}
                            </p>
                          )}
                          {acao.tipo === "notify_operator" && (
                            <p className="text-[9px] text-blue-400 truncate leading-snug font-medium">
                              🔔 Atendente: {acao.operator_name || "Todos"}
                            </p>
                          )}
                          {acao.tipo === "abrir_conversa" && (
                            <Badge variant="secondary" className="text-[8px] bg-teal-500/10 text-teal-400 border-teal-500/20">
                              🔓 Abrir no Inbox
                            </Badge>
                          )}
                          {acao.tipo === "gpt_prompt" && (
                            <p className="text-[9px] text-green-400 truncate leading-snug font-medium">
                              🤖 GPT ({acao.gpt_model || "gpt-4o"}) {"-> {{" + (acao.gpt_save_variable || "resumo") + "}}"}
                            </p>
                          )}
                          {!isAguardar && !isCondicao && !isWaitEvent && !isAbSplit && acao.tipo !== "adicionar_tag" && acao.tipo !== "remover_tag" && acao.tipo !== "ia_message" && acao.tipo !== "notify_operator" && acao.tipo !== "abrir_conversa" && acao.tipo !== "gpt_prompt" && acao.template && (
                            <p className="text-[9px] text-muted-foreground truncate leading-snug">
                              {acao.template}
                            </p>
                          )}
                          {!isAguardar && !isCondicao && !isWaitEvent && !isAbSplit && acao.tipo !== "adicionar_tag" && acao.tipo !== "remover_tag" && acao.delay_min > 0 && (
                            <Badge variant="secondary" className="text-[8px] mt-0.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                              +{acao.delay_min}min delay
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Reorder and hover Quick controls */}
                      <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-0.5 absolute -right-8 bg-slate-900 border border-border/80 rounded-lg p-1 transition-opacity z-10 shadow-md">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-muted-foreground hover:text-foreground" 
                          onClick={e => { e.stopPropagation(); moveAcao(idx, -1); }} 
                          disabled={idx === 0}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-muted-foreground hover:text-foreground" 
                          onClick={e => { e.stopPropagation(); moveAcao(idx, 1); }} 
                          disabled={idx === acoes.length - 1}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-muted-foreground hover:text-foreground" 
                          onClick={e => { e.stopPropagation(); duplicateAcao(idx); }}
                          title="Duplicar ação"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-destructive hover:text-red-400" 
                          onClick={e => { e.stopPropagation(); removeAcao(idx); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Output port Point */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-950 border border-muted-foreground/40 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                    </div>
                  </div>
                </div>

                {/* Connections between nodes */}
                <SVGBezierConnector delay={`${(idx + 1) * 0.4}s`} />

                {/* Inline plus button helper */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => addAcao(idx)}
                  className="w-5 h-5 rounded-full border border-border/60 bg-slate-950 hover:bg-primary/10 hover:border-primary text-muted-foreground hover:text-primary z-10 -my-1.5 flex items-center justify-center shadow"
                >
                  <Plus className="h-3 w-3" />
                </Button>

                {idx < acoes.length - 1 && <SVGBezierConnector delay={`${(idx + 1) * 0.4 + 0.2}s`} />}
              </div>
            );
          })}

          {/* FINAL BOTTOM ADD BUTTON */}
          {acoes.length > 0 && (
            <div className="flex justify-center pt-4 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => addAcao()} 
                className="text-xs bg-slate-900/60 border border-border/80 rounded-xl hover:border-primary/40 hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Conectar Ação
              </Button>
            </div>
          )}

        </div>
      </div>
      )
      )}

      {/* ── SIMULATOR WORKSPACE ── */}
      {activeTab === "simulator" && (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex justify-center items-center relative select-text">
          {/* Subtle phone-like border frame with glassmorphic look */}
          <div className="w-[360px] h-[550px] rounded-[36px] border-4 border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden relative shadow-emerald-500/5">
            {/* Camera notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-b-xl z-20 flex justify-center items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mr-2" />
              <div className="w-8 h-1 rounded-full bg-slate-900" />
            </div>

            {/* WhatsApp Chat Header */}
            <div className="bg-slate-950/80 backdrop-blur border-b border-border/40 p-4 pt-6 flex items-center gap-2 shrink-0 select-none">
              <Avatar className="h-8 w-8 border border-emerald-500/20 bg-emerald-500/10">
                <AvatarFallback className="text-[10px] font-bold text-emerald-400">HQ</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-100 flex items-center gap-1 leading-none">
                  Atendente ImperioHQ
                  <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[7px] scale-90 px-1 py-0 h-3 font-semibold">BOT</Badge>
                </p>
                <p className="text-[9px] text-emerald-400 mt-0.5 flex items-center gap-1 leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online (Copy E3)
                </p>
              </div>
            </div>

            {/* WhatsApp Message Logs Container */}
            <div className="flex-1 overflow-y-auto p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-slate-950/80 bg-blend-multiply space-y-4">
              
              {/* Gatilho Node (First incoming message from Lead) */}
              <div className="flex justify-start select-none">
                <div className="max-w-[85%] bg-slate-900/90 backdrop-blur-sm border border-border/40 p-3 rounded-2xl rounded-tl-none shadow-md space-y-1">
                  <span className="text-[8px] font-bold text-primary tracking-widest uppercase block">⚡ Gatilho Ativado</span>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    Lead realiza a ação de: <strong>{trigger.label}</strong>
                  </p>
                </div>
              </div>

              {/* Seriado WhatsApp Actions Outbound */}
              {acoes.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground select-none">
                  <MessageCircle className="h-8 w-8 mx-auto opacity-20 mb-2" />
                  <p className="text-xs">Nenhum disparo configurado.</p>
                  <p className="text-[10px] opacity-60">Volte para o Editor de Fluxo para adicionar.</p>
                </div>
              ) : (
                (() => {
                  let accumDelay = 0;
                  return acoes.map((acao, idx) => {
                    const meta = acaoMeta(acao.tipo);
                    const isSelected = selectedIdx === idx;
                    const isAguardar = acao.tipo === "aguardar";
                    const isCondicao = acao.tipo === "condicao";
                    const isWaitEvent = acao.tipo === "wait_event" || acao.tipo === "wait_until_event";
                    const isAbSplit = acao.tipo === "ab_split";
                    accumDelay += acao.delay_min || (isCondicao ? (acao.condicao_tempo_min || 0) : 0) || (isWaitEvent ? (acao.timeout_min || 0) : 0);

                    const isDragging = draggedIdx === idx;
                    const isDragOver = dragOverIdx === idx;

                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedIdx(isSelected ? null : idx)}
                        className={`flex flex-col cursor-grab active:cursor-grabbing relative select-none rounded-xl transition-all duration-200 ${
                          isDragging ? "opacity-30 scale-95" : ""
                        } ${isDragOver ? "border-t-2 border-amber-500 pt-2" : ""} ${
                          isSelected ? "ring-1 ring-primary/40 bg-primary/5 p-1" : ""
                        }`}
                      >
                        {/* Time Offset Indicator tag */}
                        <div className="flex justify-center my-1">
                          <span className="text-[8px] bg-slate-900/90 text-amber-400 border border-amber-500/10 px-2 py-0.5 rounded-full font-mono font-bold tracking-wider shadow">
                            ⏱️ +{acao.delay_min || (isCondicao ? (acao.condicao_tempo_min || 0) : 0) || (isWaitEvent ? (acao.timeout_min || 0) : 0)}min (Acumulado: {accumDelay}min)
                          </span>
                        </div>

                        {/* WhatsApp Styled Outbound Bubble */}
                        {acao.tipo === "adicionar_tag" || acao.tipo === "remover_tag" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-indigo-950/40 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-lg text-center max-w-[85%] font-medium">
                              🏷️ {acao.tipo === "adicionar_tag" ? "Atribuir" : "Remover"} Tag: {acao.tag || "vazia"}
                            </span>
                          </div>
                        ) : isAguardar ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-slate-900/60 text-slate-400 border border-border px-3 py-1 rounded-lg">
                              ⏱️ Ação de Espera de {acao.delay_min} minutos
                            </span>
                          </div>
                        ) : isCondicao ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-violet-950/40 text-violet-300 border border-violet-500/20 px-3 py-1 rounded-lg text-center font-medium max-w-[85%]">
                              🔀 Se atender: "{CONDICAO_TIPOS.find(c => c.value === acao.condicao_tipo)?.label || acao.condicao_tipo}" (limite: {acao.condicao_tempo_min || 0}min)
                            </span>
                          </div>
                        ) : isWaitEvent ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-cyan-950/40 text-cyan-300 border border-cyan-500/20 px-3 py-1 rounded-lg text-center font-medium max-w-[85%]">
                              ⏱️ Aguardar Evento: "{acao.event_name || 'Sem Evento'}" (limite: {acao.timeout_min || 60}min)
                            </span>
                          </div>
                        ) : isAbSplit ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-500/20 px-3 py-1 rounded-lg text-center font-medium max-w-[85%]">
                              🔀 Divisão A/B: {acao.rota_a_porcentagem ?? 50}% Rota A / {100 - (acao.rota_a_porcentagem ?? 50)}% Rota B (pular {acao.jump_steps ?? 1} se Rota B)
                            </span>
                          </div>
                        ) : acao.tipo === "loop_steps" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-yellow-950/40 text-yellow-300 border border-yellow-500/20 px-3 py-1 rounded-lg text-center font-medium max-w-[85%]">
                              🔁 Loop: Repetir {acao.loop_count ?? 3} vezes (voltar {acao.loop_jump_back_steps ?? 1} etapas) | Intervalo: {acao.loop_interval_hours ?? 24}h
                              {acao.loop_until_condition_field && (
                                <span className="block text-[8px] opacity-75 mt-0.5">
                                  Parar se: {acao.loop_until_condition_field === "lead_memory" ? `memória[${acao.memory_key || ""}]` : acao.loop_until_condition_field} {acao.loop_until_condition_operator || "igual"} "{acao.loop_until_condition_value || ""}"
                                </span>
                              )}
                            </span>
                          </div>
                        ) : acao.tipo === "stop_on_event" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-red-950/40 text-red-300 border border-red-500/20 px-3 py-1 rounded-lg text-center font-medium max-w-[85%]">
                              🛑 Parar Fluxo: se ocorrer evento "{acao.stop_event_type || "Compra Aprovada"}"
                              {acao.stop_event_value && (
                                <span className="block text-[8px] opacity-75 mt-0.5">
                                  Valor/Tag: {acao.stop_event_value}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : acao.tipo === "condicao_lead" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-orange-950/40 text-orange-300 border border-orange-500/20 px-3 py-1 rounded-lg text-center font-medium max-w-[85%]">
                              🔀 Se {acao.condition_field === "lead_memory" ? `memória[${acao.memory_key || ""}]` : acao.condition_field || "dado"} {acao.condition_operator || "igual"} "{acao.condition_value || ""}"
                              <span className="block text-[8px] opacity-75 mt-0.5">
                                Se sim: pular {acao.condition_jump_steps ?? 1} | Se não: pular {acao.condition_else_jump_steps ?? 0}
                              </span>
                            </span>
                          </div>
                        ) : acao.tipo === "webhook_call" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-cyan-950/40 text-cyan-300 border border-cyan-500/20 px-3 py-1 rounded-lg text-center font-medium max-w-[85%]">
                              🌐 Webhook ({acao.webhook_method || "POST"}): {acao.webhook_url || "sem URL"}
                              {acao.webhook_save_variable && (
                                <span className="block text-[8px] opacity-75 mt-0.5">
                                  Salvar resposta em: {acao.webhook_save_variable}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : acao.tipo === "notify_operator" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-blue-950/50 text-blue-300 border border-blue-500/20 px-3 py-1 rounded-lg text-center max-w-[85%] font-medium">
                              🔔 Notificar Atendente {acao.operator_name ? `(${acao.operator_name})` : ""}: "{acao.template || "vazio"}"
                            </span>
                          </div>
                        ) : acao.tipo === "abrir_conversa" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-teal-950/50 text-teal-300 border border-teal-500/20 px-3 py-1 rounded-lg text-center max-w-[85%] font-medium">
                              🔓 Abrir conversa com o contato (Inbox)
                            </span>
                          </div>
                        ) : acao.tipo === "gpt_prompt" ? (
                          <div className="flex justify-center select-none my-1">
                            <span className="text-[9px] bg-green-950/50 text-green-300 border border-green-500/20 px-3 py-1 rounded-lg text-center max-w-[85%] font-medium">
                              🤖 Prompt GPT ({acao.gpt_model || "gpt-4o"}): "{acao.template?.substring(0, 50)}..." {"->"} Salvar em {acao.gpt_save_variable || "resumo"}
                            </span>
                          </div>
                        ) : acao.tipo === "ia_message" ? (
                          <div className="flex justify-end pr-1">
                            <div className={`max-w-[85%] p-3 rounded-2xl rounded-tr-none shadow-md space-y-1 relative border transition-all ${
                              isSelected 
                                ? "bg-purple-900/95 border-purple-400 text-slate-100 shadow-[0_0_10px_rgba(168,85,247,0.1)]" 
                                : "bg-purple-950/90 hover:bg-purple-900/95 border-purple-800/40 text-slate-200"
                            }`}>
                              <div className="flex items-center justify-between text-[8px] font-bold opacity-80 select-none pb-0.5 border-b border-white/10">
                                <span className="flex items-center gap-1">
                                  🤖 IA Conversacional (Mente)
                                </span>
                                <span>#{idx + 1}</span>
                              </div>
                              <p className="text-[10px] leading-relaxed font-sans">
                                <strong>Objetivo:</strong> {acao.template}
                              </p>
                              {acao.ia_routes && acao.ia_routes.length > 0 && (
                                <div className="mt-1.5 pt-1.5 border-t border-purple-800/40 space-y-1 select-none">
                                  <div className="text-[8px] uppercase font-bold tracking-wider text-purple-300 opacity-80">
                                    Rotas de Saída:
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {acao.ia_routes.map((route, rIdx) => (
                                      <span key={rIdx} className="text-[8px] bg-purple-950/80 text-purple-200 border border-purple-700/50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                        ↳ {route.name || "Sem nome"} <span className="text-purple-400 font-bold">({route.jump_steps > 0 ? `+${route.jump_steps}` : "sequencial"})</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <p className="text-[8px] text-purple-300 italic">
                                * A IA assumirá a conversa de forma personalizada para cumprir este objetivo.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end pr-1">
                            <div className={`max-w-[85%] p-3 rounded-2xl rounded-tr-none shadow-md space-y-1 relative border transition-all ${
                              isSelected 
                                ? "bg-emerald-800/95 border-primary text-slate-100 shadow-[0_0_10px_rgba(0,255,200,0.1)]" 
                                : "bg-emerald-950/90 hover:bg-emerald-900/95 border-emerald-800/40 text-slate-200"
                            }`}>
                              <div className="flex items-center justify-between text-[8px] font-bold opacity-80 select-none pb-0.5 border-b border-white/10">
                                <span className="flex items-center gap-1">
                                  {meta.emoji} {meta.label}
                                </span>
                                <span>#{idx + 1}</span>
                              </div>

                              {/* Audio Content mock */}
                              {acao.tipo === "audio" ? (
                                <div className="py-1.5 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        playSpeechTTS(idx, acao.template, acao.voice_id);
                                      }}
                                    >
                                      {isPlayingVoice && selectedIdx === idx ? (
                                        <Pause className="h-3 w-3 fill-slate-950 text-slate-950" />
                                      ) : (
                                        <Play className="h-3 w-3 fill-slate-950 text-slate-950 translate-x-0.5" />
                                      )}
                                    </Button>
                                    <div className="flex-1 min-w-0 space-y-1">
                                      {/* Audio Wave preview lines */}
                                      <div className="h-3 flex items-center gap-0.5">
                                        {[...Array(12)].map((_, i) => (
                                          <div
                                            key={i}
                                            className="w-0.5 h-1.5 bg-emerald-400/50 rounded-full"
                                            style={{
                                              height: isPlayingVoice && selectedIdx === idx ? `${Math.sin(i + playbackTime) * 8 + 12}px` : "6px"
                                            }}
                                          />
                                        ))}
                                      </div>
                                      <p className="text-[8px] opacity-75 leading-none">🎙️ Mensagem de Áudio ({acao.voice_id === "felipe_sales" ? "Felipe Sales" : "Fernanda HQ"})</p>
                                    </div>
                                  </div>
                                  {/* Small preview of script script */}
                                  <p className="text-[10px] italic opacity-85 leading-snug pl-1.5 border-l border-emerald-400 pt-0.5 truncate">
                                    "{renderPreview(acao.template || "")}"
                                  </p>
                                </div>
                              ) : (
                                <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans">
                                  {renderPreview(acao.template || "")}
                                </p>
                              )}

                              {/* WhatsApp Timestamp and Single check */}
                              <div className="text-[7px] text-emerald-300 flex justify-end items-center gap-0.5 select-none leading-none pt-0.5">
                                <span>{accumDelay} min</span>
                                <span>✔✔</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── RIGHT PROPERTIES DRAWER ── */}
      {selectedIdx !== null && selectedIdx < acoes.length && (
        (() => {
          const acao = acoes[selectedIdx];
          const isAguardar = acao.tipo === "aguardar";
          const isCondicao = acao.tipo === "condicao";
          const isWaitEvent = acao.tipo === "wait_event" || acao.tipo === "wait_until_event";
          const isAbSplit = acao.tipo === "ab_split";
          const showPreview = previewIdx === selectedIdx;

          return (
            <div className="absolute top-0 right-0 w-80 h-full border-l border-border bg-slate-900/95 backdrop-blur-md z-30 flex flex-col shadow-2xl animate-slide-in select-text">
              
              {/* Drawer Header */}
              <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Settings2 className="h-4 w-4" />
                    Propriedades do Nó
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Configure os parâmetros da ação #{selectedIdx + 1}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Duplicar etapa"
                    onClick={() => {
                      const updated = [...acoes];
                      const clone = JSON.parse(JSON.stringify(acoes[selectedIdx]));
                      delete clone.position_x;
                      delete clone.position_y;
                      updated.splice(selectedIdx + 1, 0, clone);
                      onChange(updated);
                      setSelectedIdx(selectedIdx + 1);
                      toast.success("Etapa duplicada!");
                    }}
                    className="h-6 w-6 text-muted-foreground hover:text-primary rounded-full"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir etapa"
                    onClick={() => {
                      const updated = acoes.filter((_, i) => i !== selectedIdx);
                      onChange(updated);
                      setSelectedIdx(null);
                      toast.success("Etapa removida!");
                    }}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-full"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedIdx(null)}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
                  >
                    <Plus className="h-4 w-4 rotate-45" />
                  </Button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Manual Sequence Position Selector */}
                 <div className="space-y-1">
                   <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Posição no Fluxo</Label>
                   <Select 
                     value={(selectedIdx + 1).toString()} 
                     onValueChange={v => {
                       const newPos = parseInt(v) - 1;
                       if (newPos === selectedIdx || newPos < 0 || newPos >= acoes.length) return;
                       
                       const updated = [...acoes];
                       const [movedItem] = updated.splice(selectedIdx, 1);
                       updated.splice(newPos, 0, movedItem);
                       
                       onChange(updated);
                       setSelectedIdx(newPos);
                       toast.success(`Ação reposicionada para #${newPos + 1}!`);
                     }}
                   >
                     <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                       {acoes.map((_, i) => (
                         <SelectItem key={i} value={(i + 1).toString()}>#{i + 1} - Ação {i + 1}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>

                 {/* Acao Type Selector */}
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Tipo de Ação</Label>
                  <Select value={acao.tipo} onValueChange={v => updateAcao(selectedIdx, "tipo", v)}>
                    <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACAO_TIPOS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Delay Selector */}
                {!isWaitEvent && !isAbSplit && acao.tipo !== "wait_reply" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      {isAguardar ? "Tempo de Espera (minutos)" : isCondicao ? "Verificar após (minutos)" : "Atraso no Envio (minutos)"}
                    </Label>
                    <Input
                      type="number"
                      value={isCondicao ? (acao.condicao_tempo_min || 0) : acao.delay_min}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        if (isCondicao) updateAcao(selectedIdx, "condicao_tempo_min", val);
                        else updateAcao(selectedIdx, "delay_min", val);
                      }}
                      className="h-9 text-xs bg-background/50 border-border/80"
                    />
                  </div>
                )}

                {/* Condition specific fields */}
                {isCondicao && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Condição para Continuar</Label>
                      <Select value={acao.condicao_tipo || ""} onValueChange={v => updateAcao(selectedIdx, "condicao_tipo", v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80">
                          <SelectValue placeholder="Selecionar condição..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDICAO_TIPOS.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-1">
                        ✓ Se a condição for atendida no tempo limite, o lead continuará para os próximos nós de ação sequenciais.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Se não atendida:</Label>
                      <Select 
                        value={acao.else_action || "skip"} 
                        onValueChange={v => updateAcao(selectedIdx, "else_action", v)}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Pular ações seguintes</SelectItem>
                          <SelectItem value="abortar">Parar / Abortar fluxo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {acao.else_action !== "abortar" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Ações a pular (N)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={acao.else_skip ?? 1}
                          onChange={e => updateAcao(selectedIdx, "else_skip", Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-9 text-xs bg-background/50 border-border/80"
                        />
                        <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                          Pula as próximas {acao.else_skip ?? 1} ações do fluxo se a condição falhar.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* wait_event Fields */}
                {isWaitEvent && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nome do Evento</Label>
                      <Select 
                        value={acao.event_name || ""} 
                        onValueChange={v => updateAcao(selectedIdx, "event_name", v)}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80">
                          <SelectValue placeholder="Selecionar ou digitar..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="checkout_clicked">checkout_clicked (Clique no link de pagamento)</SelectItem>
                          <SelectItem value="link_clicked">link_clicked (Clique em qualquer link)</SelectItem>
                          <SelectItem value="email_opened">email_opened (Email aberto)</SelectItem>
                          <SelectItem value="email_clicked">email_clicked (Link do email clicado)</SelectItem>
                          <SelectItem value="pix_gerado">pix_gerado (Pix gerado)</SelectItem>
                          <SelectItem value="boleto_gerado">boleto_gerado (Boleto gerado)</SelectItem>
                          <SelectItem value="compra_aprovada">compra_aprovada (Pagamento aprovado)</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="mt-1">
                        <Input
                          value={acao.event_name || ""}
                          onChange={e => updateAcao(selectedIdx, "event_name", e.target.value)}
                          placeholder="Ou digite o nome do evento personalizado..."
                          className="h-8 text-xs bg-background/30 border-border/50"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Limite de Tempo / Timeout (minutos)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={acao.timeout_min ?? 60}
                        onChange={e => updateAcao(selectedIdx, "timeout_min", Math.max(1, parseInt(e.target.value) || 60))}
                        className="h-9 text-xs bg-background/50 border-border/80"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                        Tempo limite para aguardar o evento. Se o evento não ocorrer nesse intervalo, a automação avança para a próxima etapa.
                      </p>
                    </div>
                  </div>
                )}

                {/* wait_reply Fields */}
                {acao.tipo === "wait_reply" && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-lime-500/30 bg-lime-500/5 p-3">
                      <p className="text-[10px] text-lime-300/90 leading-relaxed">
                        💬 <strong>Aguardar Resposta:</strong> o fluxo para aqui e só continua quando o lead enviar qualquer mensagem no WhatsApp. Se o lead não responder até o timeout, o fluxo avança mesmo assim.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Timeout (minutos)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={acao.timeout_min ?? 1440}
                        onChange={e => updateAcao(selectedIdx, "timeout_min", Math.max(1, parseInt(e.target.value) || 1440))}
                        className="h-9 text-xs bg-background/50 border-border/80"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                        Padrão: 1440 min (24h). Sugestões: 60 = 1h · 1440 = 1 dia · 4320 = 3 dias.
                      </p>
                    </div>
                  </div>
                )}

                {/* input_capture Fields */}
                {acao.tipo === "input_capture" && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                      <p className="text-[10px] text-orange-300/90 leading-relaxed">
                        📥 <strong>Capturar Resposta:</strong> pausa o fluxo, aguarda a próxima mensagem do lead e salva em uma variável (ex: <code>DOR_PRINCIPAL</code>). Depois use como <code>{"{{DOR_PRINCIPAL}}"}</code> em qualquer mensagem.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nome da variável</Label>
                      <Input
                        value={acao.capture_variable || ""}
                        onChange={e => updateAcao(selectedIdx, "capture_variable", e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                        placeholder="DOR_PRINCIPAL"
                        className="h-9 text-xs bg-background/50 border-border/80 font-mono uppercase"
                      />
                      <p className="text-[9px] text-muted-foreground/60">Só letras, números e _. Fica em MAIÚSCULO.</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Extração via IA (opcional)</Label>
                      <Textarea
                        value={acao.ai_extract_prompt || ""}
                        onChange={e => updateAcao(selectedIdx, "ai_extract_prompt", e.target.value)}
                        placeholder="Ex: Extraia a dor central do lead em 1 frase curta, sem enfeites."
                        className="min-h-[70px] text-xs bg-background/50 border-border/80"
                      />
                      <p className="text-[9px] text-muted-foreground/60">Se preenchido, a IA processa a resposta antes de salvar. Vazio = salva o texto exato.</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Timeout (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={acao.timeout_min ?? 1440}
                        onChange={e => updateAcao(selectedIdx, "timeout_min", Math.max(1, parseInt(e.target.value) || 1440))}
                        className="h-9 text-xs bg-background/50 border-border/80"
                      />
                    </div>
                  </div>
                )}

                {/* generate_image Fields */}
                {acao.tipo === "generate_image" && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-3">
                      <p className="text-[10px] text-pink-300/90 leading-relaxed">
                        🎨 <strong>Gerar Imagem:</strong> cria uma imagem via IA no meio do fluxo (autoridade, prova social, infográfico) e envia no WhatsApp. Pode usar variáveis capturadas, ex: <code>{"{{DOR_PRINCIPAL}}"}</code>.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Prompt da imagem</Label>
                      <Textarea
                        value={acao.image_prompt || ""}
                        onChange={e => updateAcao(selectedIdx, "image_prompt", e.target.value)}
                        placeholder='Ex: Infográfico "3 Etapas Simples" mostrando Limpar → Construir → Selar, estilo minimalista'
                        className="min-h-[80px] text-xs bg-background/50 border-border/80"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Estilo</Label>
                        <Select value={acao.image_style || "autoridade"} onValueChange={v => updateAcao(selectedIdx, "image_style", v)}>
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="autoridade">Autoridade</SelectItem>
                            <SelectItem value="prova_social">Prova Social</SelectItem>
                            <SelectItem value="infografico">Infográfico</SelectItem>
                            <SelectItem value="meme">Meme / Casual</SelectItem>
                            <SelectItem value="produto">Mockup Produto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Formato</Label>
                        <Select value={acao.image_ratio || "1:1"} onValueChange={v => updateAcao(selectedIdx, "image_ratio", v)}>
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1:1">Quadrado 1:1</SelectItem>
                            <SelectItem value="9:16">Vertical 9:16</SelectItem>
                            <SelectItem value="16:9">Horizontal 16:9</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Legenda (opcional)</Label>
                      <Textarea
                        value={acao.template || ""}
                        onChange={e => updateAcao(selectedIdx, "template", e.target.value)}
                        placeholder="Texto que acompanha a imagem no WhatsApp"
                        className="min-h-[50px] text-xs bg-background/50 border-border/80"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-border/30">
                      <Label className="text-xs text-foreground flex flex-col gap-0.5 cursor-pointer" htmlFor="img-send-after">
                        <span>Enviar automaticamente no WhatsApp?</span>
                        <span className="text-[9px] text-muted-foreground">Desligue para só gerar e salvar em {"{{IMG_<id>}}"}</span>
                      </Label>
                      <Switch
                        id="img-send-after"
                        checked={acao.send_after ?? true}
                        onCheckedChange={c => updateAcao(selectedIdx, "send_after", c)}
                        className="scale-90"
                      />
                    </div>
                  </div>
                )}



                {/* ab_split Fields */}
                {isAbSplit && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Porcentagem Rota A (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={acao.rota_a_porcentagem ?? 50}
                        onChange={e => updateAcao(selectedIdx, "rota_a_porcentagem", Math.min(100, Math.max(0, parseInt(e.target.value) || 50)))}
                        className="h-9 text-xs bg-background/50 border-border/80"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                        Fração de tráfego enviada para o próximo passo sequencial (Rota A). O restante {(100 - (acao.rota_a_porcentagem ?? 50))}% vai para a Rota B.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pular N etapas (se Rota B)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={acao.jump_steps ?? 1}
                        onChange={e => updateAcao(selectedIdx, "jump_steps", Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9 text-xs bg-background/50 border-border/80"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                        Número de ações consecutivas a serem puladas caso o lead caia na Rota B.
                      </p>
                    </div>

                    <ABVariantStats
                      automacaoId={automacaoId}
                      stepIndex={selectedIdx}
                      jumpSteps={acao.jump_steps ?? 1}
                      onPromoteWinner={(pct) => updateAcao(selectedIdx, "rota_a_porcentagem", pct)}
                    />
                  </div>
                )}


                {/* branch_by_awareness */}
                {acao.tipo === "branch_by_awareness" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Continua o fluxo apenas se o nível de consciência do lead estiver dentro do intervalo. Caso contrário, pula N nós.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nível mín.</Label>
                        <Select value={String(acao.awareness_min ?? 1)} onValueChange={v => updateAcao(selectedIdx, "awareness_min", Number(v))}>
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} — {["Inconsciente","Ciente do problema","Ciente da solução","Ciente do produto","Pronto p/ comprar"][n-1]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nível máx.</Label>
                        <Select value={String(acao.awareness_max ?? 5)} onValueChange={v => updateAcao(selectedIdx, "awareness_max", Number(v))}>
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pular N nós (se fora do range)</Label>
                      <Input type="number" min={1} value={acao.else_skip ?? 1} onChange={e => updateAcao(selectedIdx, "else_skip", parseInt(e.target.value) || 1)} className="h-9 text-xs bg-background/50 border-border/80" />
                    </div>
                  </div>
                )}

                {/* branch_by_intent */}
                {acao.tipo === "branch_by_intent" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Continua apenas se a última intenção detectada pelo triage bater com a lista. Caso contrário, pula N nós.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Intenções (separadas por vírgula)</Label>
                      <Input value={acao.intents || ""} onChange={e => updateAcao(selectedIdx, "intents", e.target.value)} className="h-9 text-xs bg-background/50 border-border/80" placeholder="compra_quente, duvida" />
                      <p className="text-[9px] text-muted-foreground/60">Valores: compra_quente · duvida · objecao · suporte · saudacao · off_topic</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pular N nós (se não bater)</Label>
                      <Input type="number" min={1} value={acao.else_skip ?? 1} onChange={e => updateAcao(selectedIdx, "else_skip", parseInt(e.target.value) || 1)} className="h-9 text-xs bg-background/50 border-border/80" />
                    </div>
                  </div>
                )}

                {/* branch_by_score */}
                {acao.tipo === "branch_by_score" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Continua o fluxo apenas se o score do lead estiver dentro do intervalo. Caso contrário, pula N nós.
                      <br />Sugestão: cold &lt;30, warm 30-70, hot &gt;70.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Score mín.</Label>
                        <Input type="number" min={0} max={100} value={acao.score_min ?? 0} onChange={e => updateAcao(selectedIdx, "score_min", parseInt(e.target.value) || 0)} className="h-9 text-xs bg-background/50 border-border/80" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Score máx.</Label>
                        <Input type="number" min={0} max={100} value={acao.score_max ?? 100} onChange={e => updateAcao(selectedIdx, "score_max", parseInt(e.target.value) || 100)} className="h-9 text-xs bg-background/50 border-border/80" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pular N nós (se fora do range)</Label>
                      <Input type="number" min={1} value={acao.else_skip ?? 1} onChange={e => updateAcao(selectedIdx, "else_skip", parseInt(e.target.value) || 1)} className="h-9 text-xs bg-background/50 border-border/80" />
                    </div>
                  </div>
                )}

                {/* slack_notify */}
                {acao.tipo === "slack_notify" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Envia uma mensagem para um canal do Slack via Incoming Webhook. Use <code className="bg-muted px-0.5 rounded">{"{{variavel}}"}</code> no texto.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Webhook URL</Label>
                      <Input value={acao.webhook_url || ""} onChange={e => updateAcao(selectedIdx, "webhook_url", e.target.value)} className="h-9 text-xs bg-background/50 border-border/80" placeholder="https://hooks.slack.com/services/..." />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Texto</Label>
                      <Textarea value={acao.text || ""} onChange={e => updateAcao(selectedIdx, "text", e.target.value)} className="text-xs bg-background/50 border-border/80 min-h-[80px]" placeholder="🔥 Novo hot lead: {{nome}} ({{phone}})" />
                    </div>
                  </div>
                )}
                {acao.tipo === "update_memory" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Escreve uma chave/valor no campo lead_memory do lead. Use <code className="bg-muted px-0.5 rounded">{"{{variavel}}"}</code> para valores dinâmicos.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Chave</Label>
                      <Input value={acao.memory_key || ""} onChange={e => updateAcao(selectedIdx, "memory_key", e.target.value)} className="h-9 text-xs bg-background/50 border-border/80" placeholder="interesse_principal" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Valor</Label>
                      <Input value={acao.memory_value || ""} onChange={e => updateAcao(selectedIdx, "memory_value", e.target.value)} className="h-9 text-xs bg-background/50 border-border/80" placeholder="{'{{produto}}'}" />
                    </div>
                  </div>
                )}

                {/* loop_steps fields */}
                {acao.tipo === "loop_steps" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Repete etapas anteriores do fluxo por um número de vezes ou até que uma condição (como tag adicionada) seja atendida.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Número de Loops</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          value={acao.loop_count ?? 3} 
                          onChange={e => updateAcao(selectedIdx, "loop_count", Math.max(1, parseInt(e.target.value) || 3))} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Voltar Etapas (Pular)</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          value={acao.loop_jump_back_steps ?? 1} 
                          onChange={e => updateAcao(selectedIdx, "loop_jump_back_steps", Math.max(1, parseInt(e.target.value) || 1))} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                          placeholder="Etapas para voltar"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Intervalo do Loop (Horas)</Label>
                      <Input 
                        type="number" 
                        min={0} 
                        value={acao.loop_interval_hours ?? 24} 
                        onChange={e => updateAcao(selectedIdx, "loop_interval_hours", Math.max(0, parseInt(e.target.value) || 0))} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Condição de Parada Antecipada (Opcional)</Label>
                      <Select value={acao.loop_until_condition_field || "none"} onValueChange={v => updateAcao(selectedIdx, "loop_until_condition_field", v === "none" ? undefined : v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                          <SelectValue placeholder="Sem parada antecipada" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="none">Sem parada antecipada (executa todos os loops)</SelectItem>
                          <SelectItem value="tags">Possui Tag</SelectItem>
                          <SelectItem value="score">Score do Lead</SelectItem>
                          <SelectItem value="lead_memory">Memória do Lead</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {acao.loop_until_condition_field === "lead_memory" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Chave de Memória</Label>
                        <Input 
                          value={acao.memory_key || ""} 
                          onChange={e => updateAcao(selectedIdx, "memory_key", e.target.value)} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                          placeholder="ex: comprou_ou_nao" 
                        />
                      </div>
                    )}

                    {acao.loop_until_condition_field && acao.loop_until_condition_field !== "none" && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Operador</Label>
                          <Select value={acao.loop_until_condition_operator || "equals"} onValueChange={v => updateAcao(selectedIdx, "loop_until_condition_operator", v)}>
                            <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                              <SelectItem value="equals">Igual a</SelectItem>
                              <SelectItem value="not_equals">Diferente de</SelectItem>
                              <SelectItem value="contains">Contém</SelectItem>
                              <SelectItem value="includes_tag">Possui a tag</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Valor Comparação</Label>
                          <Input 
                            value={acao.loop_until_condition_value || ""} 
                            onChange={e => updateAcao(selectedIdx, "loop_until_condition_value", e.target.value)} 
                            className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                            placeholder="Valor para parar o loop..." 
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* stop_on_event fields */}
                {acao.tipo === "stop_on_event" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Interrompe imediatamente a execução deste fluxo inteiro se o lead disparar a condição/evento configurado.
                    </p>
                    
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Parar se ocorrer Evento</Label>
                      <Select value={acao.stop_event_type || "compra_aprovada"} onValueChange={v => updateAcao(selectedIdx, "stop_event_type", v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="compra_aprovada">Compra Aprovada</SelectItem>
                          <SelectItem value="lead_respondeu">Lead Respondeu no Chat</SelectItem>
                          <SelectItem value="tag_adicionada">Tag Específica Adicionada</SelectItem>
                          <SelectItem value="carrinho_abandonado">Início / Abandono de Checkout</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {acao.stop_event_type === "tag_adicionada" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nome da Tag</Label>
                        <Input 
                          value={acao.stop_event_value || ""} 
                          onChange={e => updateAcao(selectedIdx, "stop_event_value", e.target.value)} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                          placeholder="ex: sdr_atendimento" 
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ia_scheduling fields */}
                {acao.tipo === "ia_scheduling" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Ativa um agente conversacional focado em agendamento, que interage com o lead para marcar horários.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Provedor do Calendário</Label>
                      <Select value={acao.calendar_provider || "google"} onValueChange={v => updateAcao(selectedIdx, "calendar_provider", v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="google">Google Calendar (Nativo)</SelectItem>
                          <SelectItem value="calendly">Calendly Integration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Link / URL do Agendamento</Label>
                      <Input 
                        value={acao.calendar_url || ""} 
                        onChange={e => updateAcao(selectedIdx, "calendar_url", e.target.value)} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                        placeholder="https://calendly.com/seu-perfil" 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Duração Média da Chamada (Minutos)</Label>
                      <Input 
                        type="number" 
                        min={5}
                        value={acao.scheduling_duration_min ?? 30} 
                        onChange={e => updateAcao(selectedIdx, "scheduling_duration_min", parseInt(e.target.value) || 30)} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                      />
                    </div>
                  </div>
                )}

                {/* semantic_router fields */}
                {acao.tipo === "semantic_router" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Utiliza IA para classificar a última resposta do lead semânticamente e dividir o fluxo visual.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Definição da Rota A (Seguir adiante)</Label>
                      <Textarea 
                        value={acao.router_definition_a || ""} 
                        onChange={e => updateAcao(selectedIdx, "router_definition_a", e.target.value)} 
                        className="min-h-[60px] text-xs bg-background/50 border-border/80 text-foreground" 
                        placeholder="ex: Lead quer comprar, tirando dúvidas sobre preço ou pedindo checkout" 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Definição da Rota B (Desviar/Pular)</Label>
                      <Textarea 
                        value={acao.router_definition_b || ""} 
                        onChange={e => updateAcao(selectedIdx, "router_definition_b", e.target.value)} 
                        className="min-h-[60px] text-xs bg-background/50 border-border/80 text-foreground" 
                        placeholder="ex: Lead quer cancelar, irritado ou pedindo suporte/humano" 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pular N nós (se Rota B escolhida)</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={acao.else_skip ?? 1} 
                        onChange={e => updateAcao(selectedIdx, "else_skip", parseInt(e.target.value) || 1)} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                      />
                    </div>
                  </div>
                )}

                {/* business_hours_split fields */}
                {acao.tipo === "business_hours_split" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Verifica se o horário atual está dentro do horário de atendimento. Se não estiver, pula N nós.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Início (HH:MM)</Label>
                        <Input 
                          value={acao.work_hours_start || "08:00"} 
                          onChange={e => updateAcao(selectedIdx, "work_hours_start", e.target.value)} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                          placeholder="08:00" 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Fim (HH:MM)</Label>
                        <Input 
                          value={acao.work_hours_end || "18:00"} 
                          onChange={e => updateAcao(selectedIdx, "work_hours_end", e.target.value)} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                          placeholder="18:00" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pular N nós (se Fora do Horário)</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={acao.else_skip ?? 1} 
                        onChange={e => updateAcao(selectedIdx, "else_skip", parseInt(e.target.value) || 1)} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                      />
                    </div>
                  </div>
                )}

                {/* condicao_lead fields */}
                {acao.tipo === "condicao_lead" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Avalia um dado do lead ou chave de memória e desvia o fluxo.
                    </p>
                    
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Campo do Lead</Label>
                      <Select value={acao.condition_field || ""} onValueChange={v => updateAcao(selectedIdx, "condition_field", v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                          <SelectValue placeholder="Escolher campo..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="nome">Nome</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Telefone</SelectItem>
                          <SelectItem value="score">Score</SelectItem>
                          <SelectItem value="tags">Tags</SelectItem>
                          <SelectItem value="lead_memory">Memória Customizada (lead_memory)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {acao.condition_field === "lead_memory" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Chave de Memória</Label>
                        <Input 
                          value={acao.memory_key || ""} 
                          onChange={e => updateAcao(selectedIdx, "memory_key", e.target.value)} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                          placeholder="ex: interesse_principal" 
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Operador</Label>
                      <Select value={acao.condition_operator || "equals"} onValueChange={v => updateAcao(selectedIdx, "condition_operator", v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="equals">Igual a</SelectItem>
                          <SelectItem value="not_equals">Diferente de</SelectItem>
                          <SelectItem value="contains">Contém</SelectItem>
                          <SelectItem value="greater_than">Maior que (&gt;)</SelectItem>
                          <SelectItem value="less_than">Menor que (&lt;)</SelectItem>
                          <SelectItem value="includes_tag">Possui a tag</SelectItem>
                          <SelectItem value="not_includes_tag">Não possui a tag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Valor de Comparação</Label>
                      <Input 
                        value={acao.condition_value || ""} 
                        onChange={e => updateAcao(selectedIdx, "condition_value", e.target.value)} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                        placeholder="Valor a testar..." 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Se SIM (pular N)</Label>
                        <Input 
                          type="number" 
                          min={0} 
                          value={acao.condition_jump_steps ?? 1} 
                          onChange={e => updateAcao(selectedIdx, "condition_jump_steps", Math.max(0, parseInt(e.target.value) || 0))} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Se NÃO (pular N)</Label>
                        <Input 
                          type="number" 
                          min={0} 
                          value={acao.condition_else_jump_steps ?? 0} 
                          onChange={e => updateAcao(selectedIdx, "condition_else_jump_steps", Math.max(0, parseInt(e.target.value) || 0))} 
                          className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                      0 significa continuar sequencialmente para a próxima etapa.
                    </p>
                  </div>
                )}

                {/* webhook_call fields */}
                {acao.tipo === "webhook_call" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Envia uma requisição HTTP (Webhook) para uma API externa e permite salvar a resposta em uma variável do lead.
                    </p>
                    
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Método HTTP</Label>
                      <Select value={acao.webhook_method || "POST"} onValueChange={v => updateAcao(selectedIdx, "webhook_method", v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80 text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">URL do Webhook</Label>
                      <Input 
                        value={acao.webhook_url || ""} 
                        onChange={e => updateAcao(selectedIdx, "webhook_url", e.target.value)} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                        placeholder="https://api.exemplo.com/webhook" 
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Headers (JSON)</Label>
                      <Textarea 
                        value={acao.webhook_headers || ""} 
                        onChange={e => updateAcao(selectedIdx, "webhook_headers", e.target.value)} 
                        className="text-xs bg-background/50 border-border/80 font-mono h-16 text-foreground" 
                        placeholder='{ "Authorization": "Bearer token", "Content-Type": "application/json" }' 
                      />
                    </div>

                    {acao.webhook_method !== "GET" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Corpo da Requisição / Body</Label>
                        <Textarea 
                          value={acao.webhook_body || ""} 
                          onChange={e => updateAcao(selectedIdx, "webhook_body", e.target.value)} 
                          className="text-xs bg-background/50 border-border/80 font-mono h-24 text-foreground" 
                          placeholder='{ "lead_nome": "{{nome}}", "score": "{{score}}" }' 
                        />
                        <p className="text-[8px] text-muted-foreground/60">
                          Aceita variáveis como <code className="bg-muted px-0.5 rounded">{"{{nome}}"}</code>, <code className="bg-muted px-0.5 rounded">{"{{email}}"}</code>, etc.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Salvar Resposta na Variável</Label>
                      <Input 
                        value={acao.webhook_save_variable || ""} 
                        onChange={e => updateAcao(selectedIdx, "webhook_save_variable", e.target.value)} 
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground" 
                        placeholder="ex: resultado_webhook" 
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                        Salva o JSON retornado para uso em mensagens futuras via <code className="bg-muted px-0.5 rounded">{"{{resultado_webhook}}"}</code> ou sub-chaves <code className="bg-muted px-0.5 rounded">{"{{resultado_webhook.campo}}"}</code>.
                      </p>
                    </div>
                  </div>
                )}

                {/* qualify_lead */}
                {acao.tipo === "qualify_lead" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Atualiza score, stage e/ou tags do lead diretamente no fluxo.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Score (0–100)</Label>
                        <Input type="number" min={0} max={100} value={acao.lead_score ?? ""} onChange={e => updateAcao(selectedIdx, "lead_score", parseInt(e.target.value) || 0)} className="h-9 text-xs bg-background/50 border-border/80" placeholder="75" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Stage</Label>
                        <Select value={acao.lead_stage || ""} onValueChange={v => updateAcao(selectedIdx, "lead_stage", v)}>
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                          <SelectContent>
                            {["lead","prospect","qualified","opportunity","customer","churned"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Tags (vírgula)</Label>
                      <Input value={acao.lead_tags || ""} onChange={e => updateAcao(selectedIdx, "lead_tags", e.target.value)} className="h-9 text-xs bg-background/50 border-border/80" placeholder="quente, interesse-produto-x" />
                    </div>
                  </div>
                )}

                 {/* Session for WhatsApp */}
                {acao.tipo === "whatsapp" && providers.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Número de Disparo</Label>
                    <Select value={acao.provider_id || ""} onValueChange={v => updateAcao(selectedIdx, "provider_id", v)}>
                      <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80">
                        <SelectValue placeholder="Disparador Padrão..." />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.provider === "hub_local" ? "📱" : p.provider === "evolution" ? "🟢" : "🔵"} {p.instance_name || p.twilio_from || p.id.slice(0, 12)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Media attachment for WhatsApp */}
                {acao.tipo === "whatsapp" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                      📎 Mídia anexada <span className="text-muted-foreground/50 normal-case font-normal">(opcional — o template vira legenda)</span>
                    </Label>
                    <MediaPicker
                      value={acao.media || null}
                      projects={projectId ? [{ id: projectId, name: "Projeto atual" }] : []}
                      onChange={(m) => updateAcao(selectedIdx, "media" as any, m)}
                    />
                  </div>
                )}

                {/* Audio Custom Voice Settings */}
                {acao.tipo === "audio" && (
                  <div className="space-y-3 border-t border-border/40 pt-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Motor de Voz (TTS)</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          variant={acao.voice_provider === "openai" ? "outline" : "default"}
                          size="sm"
                          onClick={() => updateAcao(selectedIdx, "voice_provider", "elevenlabs")}
                          className={`h-7 text-[10px] ${acao.voice_provider !== "openai" ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30" : "bg-transparent text-muted-foreground border-border"}`}
                        >
                          ElevenLabs HD
                        </Button>
                        <Button
                          variant={acao.voice_provider === "openai" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAcao(selectedIdx, "voice_provider", "openai")}
                          className={`h-7 text-[10px] ${acao.voice_provider === "openai" ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" : "bg-transparent text-muted-foreground border-border"}`}
                        >
                          OpenAI Audio
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Avatar de Voz Clonado</Label>
                      <Select 
                        value={acao.voice_id || "fernanda_hq"} 
                        onValueChange={v => updateAcao(selectedIdx, "voice_id", v)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/80">
                          <SelectValue placeholder="Escolher voz..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fernanda_hq">👩‍💼 Fernanda (Closer Principal - Suave)</SelectItem>
                          <SelectItem value="felipe_sales">👨‍💼 Felipe Sales (Diretor - Firme)</SelectItem>
                          <SelectItem value="tatiane_suporte">👩‍⚕️ Tatiana (Suporte CX - Acolhedora)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Stability slider */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground/85 font-semibold">
                        <span>Estabilidade Vocálica</span>
                        <span className="font-mono text-rose-400">{acao.voice_stability ?? 75}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={acao.voice_stability ?? 75}
                        onChange={e => updateAcao(selectedIdx, "voice_stability", parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-800 accent-rose-500 rounded-lg cursor-pointer focus:outline-none"
                      />
                      <div className="flex justify-between text-[8px] text-muted-foreground/60 select-none">
                        <span>Mais Expressivo</span>
                        <span>Mais Consistente</span>
                      </div>
                    </div>

                    {/* Clarity slider */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground/85 font-semibold">
                        <span>Clareza & Semelhança</span>
                        <span className="font-mono text-rose-400">{acao.voice_clarity ?? 85}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={acao.voice_clarity ?? 85}
                        onChange={e => updateAcao(selectedIdx, "voice_clarity", parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-800 accent-rose-500 rounded-lg cursor-pointer focus:outline-none"
                      />
                      <div className="flex justify-between text-[8px] text-muted-foreground/60 select-none">
                        <span>Natural</span>
                        <span>Hiper-Claro (HD)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tag Action Fields */}
                {(acao.tipo === "adicionar_tag" || acao.tipo === "remover_tag") && (
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nome da Tag</Label>
                    <Input
                      value={acao.tag || ""}
                      onChange={e => updateAcao(selectedIdx, "tag", e.target.value)}
                      className="h-9 text-xs bg-background/50 border-border/80 text-foreground"
                      placeholder="ex: lead_quente"
                    />
                    <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-1">
                      🏷️ Esta tag será {acao.tipo === "adicionar_tag" ? "atribuída ao" : "removida do"} lead quando o fluxo atingir esta etapa.
                    </p>
                  </div>
                )}

                {/* update_lead fields */}
                {acao.tipo === "update_lead" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Campo do Lead</Label>
                        <Select value={acao.lead_field || ""} onValueChange={v => updateAcao(selectedIdx, "lead_field", v)}>
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="status">status</SelectItem>
                            <SelectItem value="score">score (número)</SelectItem>
                            <SelectItem value="awareness_level">awareness_level</SelectItem>
                            <SelectItem value="nome">nome</SelectItem>
                            <SelectItem value="email">email</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Operação</Label>
                        <Select value={acao.lead_op || "set"} onValueChange={v => updateAcao(selectedIdx, "lead_op", v)}>
                          <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="set">Definir (set)</SelectItem>
                            <SelectItem value="inc">Incrementar (+) — apenas score</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Valor</Label>
                      <Input
                        value={acao.lead_value ?? ""}
                        onChange={e => updateAcao(selectedIdx, "lead_value", e.target.value)}
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground"
                        placeholder="Ex: qualificado, 25, sales_aware"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-1">
                        👤 Atualiza o campo no registro do lead. Para <code>score</code> use número; para <code>awareness_level</code> use unaware/problem_aware/solution_aware/product_aware/most_aware.
                      </p>
                    </div>
                  </div>
                )}

                {/* move_stage fields */}
                {acao.tipo === "move_stage" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Novo Funil/Etapa (funil_id)</Label>
                      <Input
                        value={acao.target_stage || ""}
                        onChange={e => updateAcao(selectedIdx, "target_stage", e.target.value)}
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground"
                        placeholder="Ex: aquisicao, conversao, retencao"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-1">
                        ➡️ Move o lead para outra etapa do funil atualizando <code>imphq_leads.funil_id</code>. Use o slug exato da etapa.
                      </p>
                    </div>
                  </div>
                )}

                
                {/* notify_operator fields */}
                {acao.tipo === "notify_operator" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nome do Atendente</Label>
                      <Input
                        value={acao.operator_name || ""}
                        onChange={e => updateAcao(selectedIdx, "operator_name", e.target.value)}
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground"
                        placeholder="Ex: CARINA, todos"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                        Atendente ou operador que receberá a notificação no painel de controle. Use "todos" para alertar toda a equipe.
                      </p>
                    </div>
                  </div>
                )}

                {/* abrir_conversa fields */}
                {acao.tipo === "abrir_conversa" && (
                  <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-xs leading-relaxed space-y-1">
                    <p className="font-bold text-teal-400 flex items-center gap-1">
                      <Unlock className="h-3.5 w-3.5" /> Abrir Conversa
                    </p>
                    <p className="text-[10px] text-muted-foreground/80">
                      Esta ação altera o status do chat no inbox para "Aberto", envia alertas visuais para os operadores humanos e pausa o autoresponder da IA por 24 horas.
                    </p>
                  </div>
                )}

                {/* gpt_prompt fields */}
                {acao.tipo === "gpt_prompt" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Modelo GPT</Label>
                      <Select value={acao.gpt_model || "gpt-4o"} onValueChange={v => updateAcao(selectedIdx, "gpt_model", v)}>
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">gpt-4o (Completo & Raciocínio)</SelectItem>
                          <SelectItem value="gpt-4o-mini">gpt-4o-mini (Rápido & Econômico)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground/85 font-semibold">
                        <span>Temperatura</span>
                        <span className="font-mono text-green-400">{acao.gpt_temperature ?? 0.2}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={acao.gpt_temperature ?? 0.2}
                        onChange={e => updateAcao(selectedIdx, "gpt_temperature", parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 accent-green-500 rounded-lg cursor-pointer focus:outline-none"
                      />
                      <div className="flex justify-between text-[8px] text-muted-foreground/60 select-none">
                        <span>Focado</span>
                        <span>Criativo</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Max Tokens</Label>
                      <Input
                        type="number"
                        value={acao.gpt_max_tokens ?? 256}
                        onChange={e => updateAcao(selectedIdx, "gpt_max_tokens", parseInt(e.target.value) || 256)}
                        className="h-9 text-xs bg-background/50 border-border/80"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Salvar na Variável</Label>
                      <Input
                        value={acao.gpt_save_variable || "resumo_cliente"}
                        onChange={e => updateAcao(selectedIdx, "gpt_save_variable", e.target.value)}
                        className="h-9 text-xs bg-background/50 border-border/80 text-foreground"
                        placeholder="ex: resumo_cliente"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                        Salva o resultado da execução do prompt em uma variável de memória do lead, permitindo usá-lo em mensagens futuras via <code className="bg-muted px-0.5 rounded">{"{{resumo_cliente}}"}</code>.
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-border/30 select-none">
                      <Label className="text-xs text-foreground flex flex-col gap-0.5 cursor-pointer" htmlFor="gpt-send-message">
                        <span>Enviar resultado como texto?</span>
                        <span className="text-[9px] text-muted-foreground">Enviar resposta gerada diretamente ao lead</span>
                      </Label>
                      <Switch
                        id="gpt-send-message"
                        checked={acao.gpt_send_message ?? true}
                        onCheckedChange={checked => updateAcao(selectedIdx, "gpt_send_message", checked)}
                        className="scale-90"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-border/30 select-none">
                      <Label className="text-xs text-foreground flex flex-col gap-0.5 cursor-pointer" htmlFor="gpt-keep-context">
                        <span>Manter contexto?</span>
                        <span className="text-[9px] text-muted-foreground">Enviar histórico da conversa recente no prompt</span>
                      </Label>
                      <Switch
                        id="gpt-keep-context"
                        checked={acao.gpt_keep_context ?? true}
                        onCheckedChange={checked => updateAcao(selectedIdx, "gpt_keep_context", checked)}
                        className="scale-90"
                      />
                    </div>
                  </div>
                )}

                {/* ia_message premium settings */}
                {acao.tipo === "ia_message" && (
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Mente de IA / Persona</Label>
                      <Select 
                        value={acao.personality || "default"} 
                        onValueChange={v => updateAcao(selectedIdx, "personality", v === "default" ? null : v)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/80">
                          <SelectValue placeholder="Mente Global do Projeto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">🧠 Mente Global do Projeto (Padrão)</SelectItem>
                          
                          <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold border-t border-border/30 mt-1">Personas Nativas</div>
                          <SelectItem value="assistente">💬 Assistente Virtual</SelectItem>
                          <SelectItem value="vendedor">💰 Closer de Vendas</SelectItem>
                          <SelectItem value="suporte">🛠️ Agente de Suporte</SelectItem>
                          <SelectItem value="consultor">💼 Consultor Especialista</SelectItem>
                          
                          <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold border-t border-border/30 mt-1">Mentes Predefinidas</div>
                          <SelectItem value="skill_dan_kennedy">🤵 Dan Kennedy</SelectItem>
                          <SelectItem value="skill_alex_hormozi">💪 Alex Hormozi</SelectItem>
                          <SelectItem value="skill_eugene_schwartz">🧠 Eugene Schwartz</SelectItem>
                          <SelectItem value="skill_gary_halbert">✍️ Gary Halbert</SelectItem>
                          <SelectItem value="skill_gary_bencivenga">📊 Gary Bencivenga</SelectItem>
                          <SelectItem value="skill_john_carlton">🎯 John Carlton</SelectItem>
                          <SelectItem value="skill_joe_sugarman">🎩 Joe Sugarman</SelectItem>
                          <SelectItem value="skill_thiago_finch">🦅 Thiago Finch</SelectItem>
                          
                          {customSkills.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold border-t border-border/30 mt-1">Suas Mentes Customizadas</div>
                              {customSkills.map(sk => (
                                <SelectItem key={sk.id} value={`skill_${sk.id}`}>
                                  🤖 {sk.nome}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-0.5">
                        Define a persona e o tom de voz que a IA usará especificamente nesta etapa do fluxo.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Instruções de Agir (Persona)</Label>
                      <Textarea 
                        value={acao.personality_prompt || ""} 
                        onChange={e => updateAcao(selectedIdx, "personality_prompt", e.target.value)}
                        placeholder="Ex: Aja como um vendedor amigável que nunca pressiona o cliente, mas usa gatilhos de prova social..."
                        className="text-xs bg-background/50 border-border/80 min-h-[80px] resize-none"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-0.5">
                        Como a IA deve se comportar nesta etapa? (Tom de voz, restrições, estilo).
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">O que perguntar? (Direcionamento)</Label>
                      <Textarea 
                        value={acao.questioning_strategy || ""} 
                        onChange={e => updateAcao(selectedIdx, "questioning_strategy", e.target.value)}
                        placeholder="Ex: Pergunte se o problema dele é o preço ou a falta de tempo para implementar..."
                        className="text-xs bg-background/50 border-border/80 min-h-[80px] resize-none"
                      />
                      <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-0.5">
                        Quais perguntas ou tópicos a IA deve abordar para direcionar o lead?
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Modelo GPT</Label>
                      <Select value={acao.ia_model || "gpt-4o-mini"} onValueChange={v => updateAcao(selectedIdx, "ia_model", v)}>
                        <SelectTrigger className="h-8 text-xs bg-background/50 border-border/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o-mini">gpt-4o-mini (Rápido & Econômico)</SelectItem>
                          <SelectItem value="gpt-4o">gpt-4o (Completo & Persuasivo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-border/30 select-none">
                      <Label className="text-xs text-foreground flex flex-col gap-0.5 cursor-pointer" htmlFor="ia-search-web">
                        <span>Pesquisar na internet</span>
                        <span className="text-[9px] text-muted-foreground">Acessar sites em tempo real</span>
                      </Label>
                      <Switch
                        id="ia-search-web"
                        checked={acao.ia_search_web || false}
                        onCheckedChange={checked => updateAcao(selectedIdx, "ia_search_web", checked)}
                        className="scale-90"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-border/30 select-none">
                      <Label className="text-xs text-foreground flex flex-col gap-0.5 cursor-pointer" htmlFor="ia-search-files">
                        <span>Pesquisar em arquivos</span>
                        <span className="text-[9px] text-muted-foreground">Consultar base de dados/FAQ (RAG)</span>
                      </Label>
                      <Switch
                        id="ia-search-files"
                        checked={acao.ia_search_files || false}
                        onCheckedChange={checked => updateAcao(selectedIdx, "ia_search_files", checked)}
                        className="scale-90"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-border/30 select-none">
                      <Label className="text-xs text-foreground flex flex-col gap-0.5 cursor-pointer" htmlFor="ia-vision">
                        <span>Leitura de imagem</span>
                        <span className="text-[9px] text-muted-foreground">Processar imagens/telas enviadas</span>
                      </Label>
                      <Switch
                        id="ia-vision"
                        checked={acao.ia_vision || false}
                        onCheckedChange={checked => updateAcao(selectedIdx, "ia_vision", checked)}
                        className="scale-90"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-border/30 select-none">
                      <Label className="text-xs text-foreground flex flex-col gap-0.5 cursor-pointer" htmlFor="ia-voice-response">
                        <span>Responder com áudio</span>
                        <span className="text-[9px] text-muted-foreground">Clonar voz via TTS ElevenLabs</span>
                      </Label>
                      <Switch
                        id="ia-voice-response"
                        checked={acao.ia_voice_response || false}
                        onCheckedChange={checked => updateAcao(selectedIdx, "ia_voice_response", checked)}
                        className="scale-90"
                      />
                    </div>

                    {acao.ia_voice_response && (
                      <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-border/20 mt-1.5 space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Provedor de Voz</Label>
                          <Select 
                            value={acao.voice_provider || "openai"} 
                            onValueChange={v => updateAcao(selectedIdx, "voice_provider", v)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background/50 border-border/80">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openai">OpenAI (Padrão)</SelectItem>
                              <SelectItem value="elevenlabs">ElevenLabs HD (Clonada)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Avatar de Voz / ID</Label>
                          <Input
                            value={acao.voice_id || ""}
                            onChange={e => updateAcao(selectedIdx, "voice_id", e.target.value)}
                            className="h-8 text-xs bg-background/50 border-border/80 text-foreground"
                            placeholder={acao.voice_provider === "openai" ? "ex: alloy, nova, shimmer" : "ex: ElevenLabs Voice ID"}
                          />
                        </div>

                        {/* Stability slider */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground/85 font-semibold">
                            <span>Estabilidade Vocálica</span>
                            <span className="font-mono text-rose-400">{acao.voice_stability ?? 75}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={acao.voice_stability ?? 75}
                            onChange={e => updateAcao(selectedIdx, "voice_stability", parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 accent-rose-500 rounded-lg cursor-pointer focus:outline-none"
                          />
                        </div>

                        {/* Clarity slider */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground/85 font-semibold">
                            <span>Clareza & Semelhança</span>
                            <span className="font-mono text-rose-400">{acao.voice_clarity ?? 85}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={acao.voice_clarity ?? 85}
                            onChange={e => updateAcao(selectedIdx, "voice_clarity", parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 accent-rose-500 rounded-lg cursor-pointer focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* ia_routes editor */}
                    <div className="space-y-3 pt-3 border-t border-border/20">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Rotas de Saída</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] border-primary/20 hover:bg-slate-800"
                          onClick={() => {
                            const routes = acao.ia_routes || [];
                            updateAcao(selectedIdx, "ia_routes", [...routes, { name: "", jump_steps: 1 }]);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1 text-primary" /> Adicionar Rota
                        </Button>
                      </div>

                      {(!acao.ia_routes || acao.ia_routes.length === 0) ? (
                        <p className="text-[10px] text-muted-foreground/60 italic leading-relaxed">
                          Nenhuma rota de saída cadastrada. O fluxo avançará sequencialmente quando o objetivo da IA for cumprido.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {acao.ia_routes.map((route, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/40 border border-border/30 animate-fade-in">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Nome da Tag/Rota</Label>
                                <Input
                                  value={route.name}
                                  onChange={e => {
                                    const routes = [...(acao.ia_routes || [])];
                                    routes[rIdx] = { ...routes[rIdx], name: e.target.value };
                                    updateAcao(selectedIdx, "ia_routes", routes);
                                  }}
                                  className="h-8 text-xs bg-background/50 border-border/60"
                                  placeholder="ex: AGENDAMENTO"
                                />
                              </div>
                              <div className="w-20 space-y-1">
                                <Label className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Pular passos</Label>
                                <Input
                                  type="number"
                                  value={route.jump_steps}
                                  onChange={e => {
                                    const routes = [...(acao.ia_routes || [])];
                                    routes[rIdx] = { ...routes[rIdx], jump_steps: parseInt(e.target.value) || 0 };
                                    updateAcao(selectedIdx, "ia_routes", routes);
                                  }}
                                  className="h-8 text-xs bg-background/50 border-border/60"
                                  min="0"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-rose-400 mt-4 rounded-lg"
                                onClick={() => {
                                  const routes = [...(acao.ia_routes || [])];
                                  routes.splice(rIdx, 1);
                                  updateAcao(selectedIdx, "ia_routes", routes);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Resend sender domain auditing */}
                {acao.tipo === "email" && (
                  <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-blue-400 font-bold block select-none">
                      ✉️ Remetente de Email (Resend)
                    </span>
                    {resendConfig ? (
                      <p className="text-[10px] text-muted-foreground">
                        Enviando via: <strong className="text-slate-200">{resendConfig.from_name || "Sem Nome"} &lt;{resendConfig.from_email || "sem_config@resend.com"}&gt;</strong>
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">
                        Carregando credenciais do Resend...
                      </p>
                    )}
                    <p className="text-[8px] text-muted-foreground/60 leading-tight">
                      Configurado nas credenciais de integração do projeto.
                    </p>
                  </div>
                )}

                {/* Conversational AI helper box */}
                {acao.tipo === "ia_message" && (
                  <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs leading-relaxed space-y-1.5">
                    <p className="font-bold text-purple-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> IA Conversacional (Mente)
                    </p>
                    <p className="text-[10px] text-muted-foreground/80">
                      Este bloco pausa a sequência automática. A IA irá assumir o chat e conversar de forma personalizada com o lead para cumprir o objetivo definido abaixo.
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 font-medium">
                      ✓ Quando o objetivo for cumprido, a IA avançará a automação gerando a tag secreta <code className="text-purple-300 font-mono">[PROXIMA_ETAPA]</code>.
                    </p>
                  </div>
                )}

                {/* Message template editor */}
                {!isAguardar && !isCondicao && acao.tipo !== "adicionar_tag" && acao.tipo !== "remover_tag" && (
                  <div className="space-y-2">
                    {(acao.tipo === "whatsapp" || acao.tipo === "ia_message") && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-border/20 mb-1 select-none animate-fade-in">
                        <div className="space-y-0.5">
                          <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                            <Split className="h-3.5 w-3.5 text-primary" /> Teste A/B de Copy
                          </Label>
                          <p className="text-[9px] text-muted-foreground leading-none">Dividir tráfego de leads 50/50 entre duas variações.</p>
                        </div>
                        <Switch
                          checked={acao.ab_test_enabled || false}
                          onCheckedChange={checked => updateAcao(selectedIdx, "ab_test_enabled", checked)}
                          className="scale-90"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        {acao.tipo === "gpt_prompt" ? "Prompt a ser executado" : acao.ab_test_enabled ? "Variante A (Controle)" : "Copy / Template"}
                      </Label>
                      
                      <div className="flex items-center gap-1">
                        {templates.length > 0 && (
                          <Select onValueChange={v => {
                            const tpl = templates.find(t => t.content === v);
                            if (tpl) updateAcao(selectedIdx, "template", tpl.content);
                          }}>
                            <SelectTrigger className="h-6 w-24 text-[9px] border-primary/20 bg-background/40">
                              <SelectValue placeholder="📋 Templates" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((t, ti) => (
                                <SelectItem key={ti} value={t.content}>
                                  <span className="text-[9px]">{t.source}: {t.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md hover:bg-slate-800"
                          onClick={() => setPreviewIdx(showPreview ? null : selectedIdx)}
                        >
                          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      value={acao.template || ""}
                      onChange={e => updateAcao(selectedIdx, "template", e.target.value)}
                      className="text-xs min-h-[120px] bg-background/50 border-border/80 resize-none font-sans focus:ring-1 focus:ring-primary shadow-inner"
                      placeholder={
                        acao.tipo === "audio" 
                          ? "Digite o roteiro para gerar a mensagem de voz. Use {{nome}} para falar o nome do lead..." 
                          : acao.tipo === "gpt_prompt"
                          ? "Digite o prompt a ser executado (ex: Analise a conversa anterior e retorne apenas os dados coletados...)"
                          : "Oi {{nome}}, vimos que você se interessou pelo..."
                      }
                    />

                    {acao.ab_test_enabled && (
                      <div className="space-y-1.5 pt-1.5 border-t border-border/10 animate-fade-in">
                        <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          Variante B (Desafiante)
                        </Label>
                        <Textarea
                          value={acao.template_b || ""}
                          onChange={e => updateAcao(selectedIdx, "template_b", e.target.value)}
                          className="text-xs min-h-[120px] bg-background/50 border-border/80 resize-none font-sans focus:ring-1 focus:ring-primary shadow-inner"
                          placeholder={acao.tipo === "ia_message" ? "Objetivo/Prompt da Variante B (ex: persuadir baseando-se em urgência)" : "Digite a copy da Variante B..."}
                        />
                      </div>
                    )}

                    {/* Char counts */}
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 select-none">
                      <span>{acao.template?.length || 0} caracteres</span>
                      {acao.tipo === "whatsapp" && (
                        <span>Aprox. {Math.ceil((acao.template?.length || 0) / 160)} SMS</span>
                      )}
                      {acao.tipo === "audio" && acao.template && (
                        <span className="text-rose-400">Aprox. {Math.max(3, Math.round((acao.template?.split(/\s+/).length || 0) * 0.48))}s de áudio</span>
                      )}
                    </div>

                    {/* Variable triggers */}
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold block select-none">Inserir Variável</span>
                      <div className="flex gap-1 flex-wrap">
                        {DYNAMIC_VARS.map(v => (
                          <Button
                            key={v.var}
                            variant="outline"
                            size="sm"
                            className="h-5 text-[9px] px-1.5 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30"
                            onClick={() => insertVariable(selectedIdx, v.var)}
                          >
                            {v.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {acao.template?.includes("{{link}}") && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-950/60 border border-border/40 text-[10px] text-muted-foreground space-y-1 select-none leading-normal">
                        <p className="text-amber-400 font-bold uppercase tracking-wider text-[8px] flex items-center gap-1">
                          ℹ️ Variável {"{{link}}"} ativa
                        </p>
                        <p>Esta variável resolve para:</p>
                        <ol className="list-decimal list-inside pl-1 space-y-0.5 text-[9px]">
                          <li>Link dinâmico do lead (<code className="text-slate-300">lead_data.link</code>)</li>
                          <li>Link de checkout padrão definido neste fluxo.</li>
                        </ol>
                      </div>
                    )}

                    {/* Preview box for standard text */}
                    {showPreview && acao.tipo !== "audio" && acao.template && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-border text-xs leading-relaxed whitespace-pre-wrap relative shadow-inner">
                        <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
                          <CheckCircle2 className="h-3 w-3" /> Preview Simulado:
                        </p>
                        {renderPreview(acao.template)}
                      </div>
                    )}

                    {/* Premium Audio Preview Panel */}
                    {acao.tipo === "audio" && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950/40 border border-rose-500/20 shadow-inner space-y-2 select-none">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase tracking-wider text-rose-400 font-bold block select-none">
                            🎛️ Painel de Sintonia & Playback
                          </span>
                          {hasGeneratedVoice[selectedIdx] && (
                            <span className="text-[8px] bg-rose-500/10 text-rose-300 px-1 rounded uppercase font-semibold select-none">Clonado HD</span>
                          )}
                        </div>

                        {!hasGeneratedVoice[selectedIdx] ? (
                          <Button
                            onClick={() => generateVoicePreview(selectedIdx)}
                            disabled={isGeneratingVoice || !acao.template?.trim()}
                            className="w-full h-8 text-[11px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/35 hover:border-rose-500/50 rounded-lg flex items-center justify-center gap-1.5 font-bold"
                          >
                            {isGeneratingVoice ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin text-rose-400 animate-spin" />
                                Sintetizando Roteiro...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 text-rose-400 animate-pulse" />
                                Sintetizar Áudio com IA
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            {/* Active Waveform equalizer */}
                            <div className="flex items-center justify-center gap-[3px] h-7 bg-slate-950/70 rounded-lg px-3 border border-border/40 overflow-hidden relative">
                              <div className="absolute top-1 left-1.5 text-[7px] text-muted-foreground/60 font-mono uppercase tracking-widest select-none">Spectral View</div>
                              {[...Array(24)].map((_, i) => {
                                const heights = [25, 45, 15, 60, 20, 40, 35, 70, 18, 55, 30, 10, 48, 65, 25, 38, 50, 15, 55, 35, 20, 42, 60, 25];
                                const delay = (i * 0.05).toFixed(2);
                                const height = heights[i % heights.length];
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      height: isPlayingVoice ? `${height}%` : "15%",
                                      animationDelay: `${delay}s`,
                                      animationDuration: "0.65s"
                                    }}
                                    className={`w-0.5 rounded-full bg-rose-500 transition-all duration-300 ${isPlayingVoice ? "animate-pulse" : "opacity-40"}`}
                                  />
                                );
                              })}
                            </div>

                            {/* Timeline & Progress Player */}
                            <div className="flex items-center gap-2 select-none bg-slate-950/30 p-1.5 rounded-lg border border-border/20">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 shrink-0"
                                onClick={() => playSpeechTTS(selectedIdx, acao.template, acao.voice_id)}
                              >
                                {isPlayingVoice ? (
                                  <Pause className="h-3 w-3 fill-rose-400 text-rose-400" />
                                ) : (
                                  <Play className="h-3 w-3 fill-rose-400 text-rose-400 translate-x-0.5" />
                                )}
                              </Button>
                              
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="h-1 w-full bg-slate-800 rounded-full overflow-hidden relative cursor-pointer" 
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const clickX = e.clientX - rect.left;
                                    const percent = clickX / rect.width;
                                    setVoiceProgress(percent * 100);
                                    setPlaybackTime(percent * duration);
                                  }}
                                >
                                  <div 
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-100" 
                                    style={{ width: `${voiceProgress}%` }} 
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[7px] text-muted-foreground/60 mt-1 font-mono leading-none">
                                  <span>
                                    {Math.floor(playbackTime / 60).toString().padStart(2, "0")}:
                                    {(Math.floor(playbackTime) % 60).toString().padStart(2, "0")}
                                  </span>
                                  <span>
                                    {Math.floor(duration / 60).toString().padStart(2, "0")}:
                                    {(Math.floor(duration) % 60).toString().padStart(2, "0")}
                                  </span>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 rounded-full hover:bg-slate-900"
                                onClick={() => setIsMuted(!isMuted)}
                              >
                                {isMuted ? <VolumeX className="h-3 w-3 text-red-400" /> : <Volume2 className="h-3 w-3 text-rose-400" />}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-border bg-card/30 flex items-center justify-between gap-2 shrink-0 select-none">
                {!isAguardar && !isCondicao && acao.template?.trim() && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs text-primary border-primary/20 hover:bg-primary/5" 
                    onClick={() => saveAsTemplate(acao)} 
                    disabled={savingTemplate}
                  >
                    <SaveAll className="h-3.5 w-3.5 mr-1" /> Salvar Modelo
                  </Button>
                )}
                <div className="flex-1" />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs hover:bg-slate-800 text-slate-300 border-border/80" 
                  onClick={() => duplicateAcao(selectedIdx)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar Nó
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:bg-red-500/10 hover:text-red-400 h-8 text-xs" 
                  onClick={() => removeAcao(selectedIdx)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Nó
                </Button>
              </div>

            </div>
          );
        })()
      )}

    </div>
  );
}

// ── BEZIER CONNECTOR GRAPHIC ──
function SVGBezierConnector({ delay }: { delay?: string }) {
  return (
    <div className="h-10 w-28 relative flex items-center justify-center -my-1.5 shrink-0 select-none">
      <svg width="60" height="40" viewBox="0 0 60 40" fill="none" className="overflow-visible">
        {/* Curving bezier glow path */}
        <path
          d="M 30 0 C 30 20, 30 20, 30 40"
          stroke="hsl(var(--primary))"
          strokeWidth="3.5"
          opacity="0.12"
          strokeLinecap="round"
          className="blur-[2.5px]"
        />
        {/* Curving Bezier line */}
        <path
          d="M 30 0 C 30 20, 30 20, 30 40"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          opacity="0.3"
          strokeLinecap="round"
        />
        {/* Glowing pulse motion circle */}
        <circle r="3.5" fill="#00ffc8" className="shadow-[0_0_8px_#00ffc8]">
          <animateMotion
            path="M 30 0 C 30 20, 30 20, 30 40"
            dur="2s"
            repeatCount="indefinite"
            begin={delay || "0s"}
          />
        </circle>
      </svg>
    </div>
  );
}
