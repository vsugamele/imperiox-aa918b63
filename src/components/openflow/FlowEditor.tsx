import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Trash2, Clock, Mail, MessageCircle, Send, Sparkles,
  ChevronUp, ChevronDown, GitBranch, SaveAll, Variable, Eye, EyeOff,
  ZoomIn, ZoomOut, Maximize2, Settings2, CheckCircle2, ArrowRight,
  Mic, Volume2, VolumeX, Pause, Play, Sliders, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  { value: "telegram", label: "Telegram", icon: Send, emoji: "📨", color: "border-sky-500/40 bg-sky-500/5 hover:border-sky-400" },
  { value: "aguardar", label: "Aguardar", icon: Clock, emoji: "⏱", color: "border-amber-500/40 bg-amber-500/5 hover:border-amber-400" },
  { value: "condicao", label: "Condição (Se…)", icon: GitBranch, emoji: "🔀", color: "border-violet-500/40 bg-violet-500/5 hover:border-violet-400" },
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
  tipo: string;
  template: string;
  delay_min: number;
  condicao_tipo?: string;
  condicao_tempo_min?: number;
  provider_id?: string;
  voice_provider?: string;
  voice_id?: string;
  voice_stability?: number;
  voice_clarity?: number;
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
}

export function FlowEditor({
  triggerTipo, acoes, onChange, onGenerateAI, isGenerating,
  templates = [], providers = [], projectId, onTemplateSaved
}: FlowEditorProps) {
  
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

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
    const newAcao: Acao = { tipo: "email", template: "", delay_min: 0 };
    if (insertAt !== undefined) {
      const updated = [...acoes];
      updated.splice(insertAt + 1, 0, newAcao);
      onChange(updated);
      setSelectedIdx(insertAt + 1);
    } else {
      onChange([...acoes, newAcao]);
      setSelectedIdx(acoes.length);
    }
    toast.success("Novo nó adicionado ao fluxo!");
  };

  const removeAcao = (idx: number) => {
    onChange(acoes.filter((_, i) => i !== idx));
    setSelectedIdx(null);
    toast.info("Nó removido do fluxo.");
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
    <div className="relative border border-border bg-slate-950 rounded-2xl h-[650px] overflow-hidden flex flex-col shadow-inner">
      
      {/* ── CANVAS TOOLBAR ── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-border/80 px-2.5 py-1.5 rounded-xl shadow-lg shrink-0 select-none">
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
      </div>

      {/* ── CANVAS WORKSPACE ── */}
      <div 
        ref={canvasRef}
        className="flex-1 overflow-auto p-12 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950/40 relative"
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
              <div className="min-w-0">
                <span className="text-[8px] font-bold tracking-widest text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">Gatilho Principal</span>
                <p className="text-xs font-bold text-foreground mt-1 truncate">{trigger.label}</p>
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
            <div className="flex flex-col items-center">
              <SVGBezierConnector delay="0s" />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => addAcao()} 
                className="text-xs bg-slate-900 border-dashed border-border/80 text-muted-foreground hover:text-primary rounded-xl"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Primeira Ação
              </Button>
            </div>
          )}

          {/* ACTION NODES (Floating Serpentine Seriado Layout) */}
          {acoes.map((acao, idx) => {
            const meta = acaoMeta(acao.tipo);
            const isSelected = selectedIdx === idx;
            const isAguardar = acao.tipo === "aguardar";
            const isCondicao = acao.tipo === "condicao";

            // serpentine x stagger offset to look highly visual node-based
            const staggerClass = idx % 2 === 0 ? "translate-x-3" : "-translate-x-3";

            return (
              <div key={idx} className="flex flex-col items-center shrink-0">
                
                {/* Visual Stagger node wrapper */}
                <div className={`relative transition-all duration-300 ${staggerClass} group`}>
                  
                  {/* Glowing halo indicator */}
                  <div className={`absolute -inset-0.5 rounded-xl blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                    isSelected ? "bg-primary/25 opacity-100" : "bg-muted-foreground/10"
                  }`} />

                  {/* Node Card */}
                  <div
                    onClick={() => setSelectedIdx(isSelected ? null : idx)}
                    className={`w-64 border rounded-xl p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer relative shadow-md transition-all duration-200 hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-primary bg-slate-900 shadow-inner"
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
                          {isAguardar && acao.delay_min > 0 && (
                            <Badge variant="secondary" className="text-[8px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                              Aguardar {acao.delay_min} min
                            </Badge>
                          )}
                          {!isAguardar && !isCondicao && acao.template && (
                            <p className="text-[9px] text-muted-foreground truncate leading-snug">
                              {acao.template}
                            </p>
                          )}
                          {!isAguardar && !isCondicao && acao.delay_min > 0 && (
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

      {/* ── RIGHT PROPERTIES DRAWER ── */}
      {selectedIdx !== null && selectedIdx < acoes.length && (
        (() => {
          const acao = acoes[selectedIdx];
          const isAguardar = acao.tipo === "aguardar";
          const isCondicao = acao.tipo === "condicao";
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
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedIdx(null)} 
                  className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </Button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
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

                {/* Condition specific fields */}
                {isCondicao && (
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

                {/* Message template editor */}
                {!isAguardar && !isCondicao && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Copy / Template</Label>
                      
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
                      className="text-xs min-h-[140px] bg-background/50 border-border/80 resize-none font-sans focus:ring-1 focus:ring-primary shadow-inner"
                      placeholder={acao.tipo === "audio" ? "Digite o roteiro para gerar a mensagem de voz. Use {{nome}} para falar o nome do lead..." : "Oi {{nome}}, vimos que você se interessou pelo..."}
                    />

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
