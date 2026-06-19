import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Trash2, Image as ImageIcon, Mic, Video, FileText, Type, CalendarIcon,
  ArrowUp, ArrowDown, Send, Eye, Variable, Sparkles, Share2, Network,
  GripVertical, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AIGenerateButton } from "@/components/projeto/AIGenerateButton";
import CampaignAIGenerateDialog from "./CampaignAIGenerateDialog";
import CampaignImportDialog from "./CampaignImportDialog";
import CampaignShareDialog from "./CampaignShareDialog";
import CampaignSequenceDiagram from "./CampaignSequenceDiagram";

interface Step {
  id: string;
  campaign_id: string;
  step_order: number;
  content: string | null;
  content_b: string | null;
  media_url: string | null;
  media_type: string;
  send_time: string;
  days_offset: number;
  send_date: string | null;
  is_active: boolean;
}

const MEDIA_ICONS: Record<string, any> = {
  text: Type,
  image: ImageIcon,
  audio: Mic,
  video: Video,
  document: FileText,
};

const VARIABLES = [
  { key: "nome", desc: "Nome do contato" },
  { key: "produto", desc: "Produto da campanha" },
  { key: "campanha", desc: "Nome da campanha" },
  { key: "grupo_nome", desc: "Nome do grupo de destino" },
];

// --- Time picker ---
function TimePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = (value || "09:00").split(":").map(Number);
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  return (
    <div className="flex items-center gap-0.5">
      <Select value={String(h).padStart(2, "0")} onValueChange={v => onChange(`${v}:${String(m).padStart(2, "0")}`)}>
        <SelectTrigger className="h-8 text-xs w-[52px] px-1.5"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-48">
          {hours.map(hh => <SelectItem key={hh} value={hh} className="text-xs">{hh}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground font-bold">:</span>
      <Select value={String(m - (m % 5)).padStart(2, "0")} onValueChange={v => onChange(`${String(h).padStart(2, "0")}:${v}`)}>
        <SelectTrigger className="h-8 text-xs w-[52px] px-1.5"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-48">
          {minutes.map(mm => <SelectItem key={mm} value={mm} className="text-xs">{mm}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// --- Date picker ---
function DatePickerInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-8 text-xs w-full justify-start font-normal px-2", !value && "text-muted-foreground")}>
          <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
          {date ? format(date, "dd/MM/yyyy") : "Selecionar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={d => onChange(d ? format(d, "yyyy-MM-dd") : null)}
          locale={ptBR}
          className="p-3 pointer-events-auto"
          initialFocus
        />
        {value && (
          <div className="p-2 pt-0 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => onChange(null)}>
              Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// --- WhatsApp Preview Bubble ---
function WhatsAppPreview({ step, sampleVars }: { step: Step; sampleVars: Record<string, string> }) {
  const rendered = (step.content || "").replace(/\{(\w+)\}/g, (_m, k) => sampleVars[k] ?? `{${k}}`);
  const Icon = MEDIA_ICONS[step.media_type] || Type;
  return (
    <div className="rounded-lg p-4" style={{ background: "#0b1410" }}>
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-lg px-3 py-2 text-sm relative"
          style={{ background: "#005c4b", color: "#e9edef" }}
        >
          {step.media_url && step.media_type === "image" && (
            <img src={step.media_url} alt="" className="rounded mb-2 max-h-48 object-cover" />
          )}
          {step.media_url && step.media_type === "video" && (
            <div className="rounded mb-2 bg-black/40 h-32 flex items-center justify-center">
              <Video className="h-8 w-8 opacity-60" />
            </div>
          )}
          {step.media_url && step.media_type === "audio" && (
            <div className="rounded mb-2 bg-black/30 px-3 py-2 flex items-center gap-2">
              <Mic className="h-4 w-4" /> <span className="text-xs opacity-80">Áudio</span>
            </div>
          )}
          {step.media_url && step.media_type === "document" && (
            <div className="rounded mb-2 bg-black/30 px-3 py-2 flex items-center gap-2">
              <FileText className="h-4 w-4" /> <span className="text-xs opacity-80">Documento</span>
            </div>
          )}
          {rendered ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{rendered}</p>
          ) : (
            <p className="italic opacity-60">(sem texto)</p>
          )}
          <span className="block text-[10px] opacity-60 text-right mt-1">
            {step.send_time?.slice(0, 5) || "09:00"} ✓✓
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" /> <span>Tipo: {step.media_type}</span>
      </div>
    </div>
  );
}

interface CampaignStepCardProps {
  step: Step;
  idx: number;
  stepsCount: number;
  projectId: string;
  produto: string;
  onMove: (idx: number, dir: -1 | 1) => Promise<void>;
  onPreview: (step: Step) => void;
  onTest: (step: Step) => void;
  onDuplicate: (step: Step) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, field: string, value: any) => Promise<void>;
  onMediaUpload: (stepId: string, file: File) => Promise<void>;
  steps: Step[];
  onReorder: (fromIdx: number, toIdx: number) => Promise<void>;
  onAddStepBelow: (idx: number) => Promise<void>;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}

function CampaignStepCard({
  step,
  idx,
  stepsCount,
  projectId,
  produto,
  onMove,
  onPreview,
  onTest,
  onDuplicate,
  onDelete,
  onUpdate,
  onMediaUpload,
  steps,
  onReorder,
  onAddStepBelow,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}: CampaignStepCardProps) {
  const [content, setContent] = useState(step.content || "");
  const [contentB, setContentB] = useState(step.content_b || "");
  const [orderVal, setOrderVal] = useState(String(step.step_order + 1));

  useEffect(() => {
    setContent(step.content || "");
  }, [step.content]);

  useEffect(() => {
    setContentB(step.content_b || "");
  }, [step.content_b]);

  useEffect(() => {
    setOrderVal(String(step.step_order + 1));
  }, [step.step_order]);

  const insertVariable = (varKey: string) => {
    const newText = (content || "") + ` {${varKey}}`;
    setContent(newText.trim());
    onUpdate(step.id, "content", newText.trim());
  };

  const handleOrderInputSubmit = () => {
    const val = parseInt(orderVal);
    if (!isNaN(val) && val >= 1 && val <= stepsCount) {
      onReorder(idx, val - 1);
    } else {
      setOrderVal(String(step.step_order + 1));
    }
  };

  const Icon = MEDIA_ICONS[step.media_type] || Type;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, idx)}
      onDragOver={(e) => onDragOver(e, idx)}
      onDrop={(e) => onDrop(e, idx)}
      onDragEnd={onDragEnd}
      className={cn(
        "border transition-all duration-200 select-none",
        step.is_active ? "border-border" : "border-muted opacity-60",
        isDragging && "opacity-40 border-dashed border-gold/60 scale-[0.99]",
        isDragOver && "border-gold bg-gold/5 border-t-4"
      )}
    >
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary/60 rounded"
              title="Arraste para reordenar"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-gold transition-colors" />
            </div>
            <div className="flex flex-col">
              <Button
                size="icon" variant="ghost" className="h-4 w-4"
                onClick={() => onMove(idx, -1)} disabled={idx === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-4 w-4"
                onClick={() => onMove(idx, 1)} disabled={idx === stepsCount - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-1 bg-secondary/80 px-2 py-0.5 rounded border border-border/40">
              <span className="text-[9px] text-muted-foreground font-mono font-bold">ORDEM:</span>
              <input
                type="number"
                className="w-8 h-4 bg-transparent border-0 text-gold font-bold font-mono text-xs focus:ring-0 focus:outline-none text-center p-0"
                value={orderVal}
                min={1}
                max={stepsCount}
                onChange={e => setOrderVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleOrderInputSubmit()}
                onBlur={handleOrderInputSubmit}
              />
            </div>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Preview" onClick={() => onPreview(step)}>
              <Eye className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Testar agora" onClick={() => onTest(step)}>
              <Send className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplicar no final" onClick={() => onDuplicate(step)}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-gold hover:text-gold hover:bg-gold/10" title="Adicionar em branco abaixo" onClick={() => onAddStepBelow(idx)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-center gap-1 ml-1">
              <Label className="text-[10px]">Ativo</Label>
              <Switch checked={step.is_active} onCheckedChange={v => onUpdate(step.id, "is_active", v)} />
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(step.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <Label className="text-[10px]">Tipo</Label>
            <Select value={step.media_type} onValueChange={v => onUpdate(step.id, "media_type", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">📝 Texto</SelectItem>
                <SelectItem value="image">🖼️ Imagem</SelectItem>
                <SelectItem value="audio">🎵 Áudio</SelectItem>
                <SelectItem value="video">🎬 Vídeo</SelectItem>
                <SelectItem value="document">📄 Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Horário</Label>
            <TimePickerInput
              value={step.send_time?.slice(0, 5) || "09:00"}
              onChange={v => onUpdate(step.id, "send_time", v)}
            />
          </div>
          <div>
            <Label className="text-[10px]">Data específica</Label>
            <DatePickerInput
              value={step.send_date || null}
              onChange={v => onUpdate(step.id, "send_date", v)}
            />
          </div>
          <div>
            <Label className="text-[10px]">{step.send_date ? "Offset (ignorado)" : "Dia (offset)"}</Label>
            <Input type="number" className={`h-8 text-xs ${step.send_date ? "opacity-50" : ""}`} value={step.days_offset} onChange={e => onUpdate(step.id, "days_offset", parseInt(e.target.value) || 0)} min={0} disabled={!!step.send_date} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px]">Mensagem</Label>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]">
                    <Variable className="h-3 w-3 mr-0.5" /> Variáveis
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <p className="text-[10px] text-muted-foreground mb-2">Clique para inserir:</p>
                  <div className="space-y-1">
                    {VARIABLES.map(v => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-secondary/40 text-xs"
                      >
                        <code className="text-primary">{`{${v.key}}`}</code>
                        <span className="block text-[10px] text-muted-foreground">{v.desc}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {projectId && (
                <AIGenerateButton
                  projectId={projectId}
                  action="generate_campaign_message"
                  label="Gerar"
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5 text-[10px]"
                  showMenteSelector
                  extraBody={{
                    campaign_id: step.campaign_id,
                    produto,
                    step_order: step.step_order,
                    total_steps: stepsCount,
                    media_type: step.media_type,
                  }}
                  onResult={(data: any) => {
                    const text = data?.text || data?.content || "";
                    if (text) {
                      onUpdate(step.id, "content", text);
                      setContent(text);
                    }
                  }}
                />
              )}
            </div>
          </div>
          <Textarea
            className="text-xs min-h-[160px] font-mono leading-6 whitespace-pre-wrap select-text"
            rows={8}
            value={content}
            onChange={e => {
              const val = e.target.value;
              setContent(val);
              onUpdate(step.id, "content", val);
            }}
            placeholder={"Texto da mensagem...\n\nUse linhas em branco entre parágrafos para criar espaçamento (como no WhatsApp real).\n\nVariáveis: {nome}, {produto}, {grupo_nome}"}
          />
          <p className="text-[9px] text-muted-foreground mt-1 font-mono">
            {(content || "").split("\n").length} linhas · {(content || "").length} caracteres
          </p>
        </div>

        {/* A/B Variant B */}
        <details className="rounded border border-dashed border-border/60 px-2 py-1.5">
          <summary className="text-[10px] text-muted-foreground cursor-pointer flex items-center justify-between">
            <span>🧪 Variante B (teste A/B) {contentB ? "— ativa" : "— opcional"}</span>
          </summary>
          <Textarea
            className="text-xs min-h-[50px] mt-1.5 select-text"
            value={contentB}
            onChange={e => {
              const val = e.target.value;
              setContentB(val);
              onUpdate(step.id, "content_b", val || null);
            }}
            placeholder="Texto alternativo. Se preenchido, 50% dos grupos recebem esta versão."
          />
        </details>

        {step.media_type !== "text" && (
          <div>
            <Label className="text-[10px]">Mídia</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-xs flex-1 select-text"
                value={step.media_url || ""}
                onChange={e => onUpdate(step.id, "media_url", e.target.value)}
                placeholder="URL da mídia ou faça upload →"
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept={step.media_type === "image" ? "image/*" : step.media_type === "audio" ? "audio/*" : step.media_type === "video" ? "video/*" : "*"}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onMediaUpload(step.id, f);
                  }}
                />
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <span>Upload</span>
                </Button>
              </label>
            </div>
            {step.media_url && step.media_type === "image" && (
              <img src={step.media_url} alt="" className="mt-2 rounded max-h-24 object-cover" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CampaignStepEditorProps {
  campaignId: string;
  projectId?: string;
  produto?: string;
  groups?: string[];
}

export default function CampaignStepEditor({ campaignId, projectId = "", produto = "", groups = [] }: CampaignStepEditorProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [campaign, setCampaign] = useState<any | null>(null);
  const pendingUpdates = useRef<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [previewStep, setPreviewStep] = useState<Step | null>(null);
  const [testStep, setTestStep] = useState<Step | null>(null);
  const [testGroupJid, setTestGroupJid] = useState("");
  const [testing, setTesting] = useState(false);
  const [showAI, setShowAI] = useState(false);
  
  // Custom states for view modes and drag/drop
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: stepsData } = await supabase
      .from("imphq_wa_campaign_steps")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });
    setSteps((stepsData as any[]) || []);

    const { data: campaignData } = await supabase
      .from("imphq_wa_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    setCampaign(campaignData);

    setLoading(false);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for campaign steps
  useEffect(() => {
    const channel = supabase
      .channel(`campaign-steps-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "imphq_wa_campaign_steps",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "DELETE") {
            load();
          } else if (payload.eventType === "UPDATE") {
            const updatedStep = payload.new as Step;
            setSteps((prev) => {
              return prev.map((s) => {
                if (s.id === updatedStep.id) {
                  const hasPendingContent = pendingUpdates.current[`${s.id}-content`];
                  const hasPendingContentB = pendingUpdates.current[`${s.id}-content_b`];
                  
                  return {
                    ...s,
                    ...updatedStep,
                    content: hasPendingContent ? s.content : updatedStep.content,
                    content_b: hasPendingContentB ? s.content_b : updatedStep.content_b,
                  };
                }
                return s;
              });
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, load]);

  // Realtime subscription for campaign metadata
  useEffect(() => {
    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "imphq_wa_campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          setCampaign(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const addStep = async () => {
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) + 1 : 0;
    const { error } = await supabase.from("imphq_wa_campaign_steps").insert({
      campaign_id: campaignId,
      step_order: maxOrder,
      content: "",
      media_type: "text",
      send_time: "09:00",
      days_offset: 0,
      is_active: true,
    } as any);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const addStepBelow = async (idx: number) => {
    const targetOrder = steps[idx].step_order + 1;

    // Shift steps order
    const shiftUpdates = steps
      .filter(s => s.step_order >= targetOrder)
      .map(s => 
        supabase.from("imphq_wa_campaign_steps").update({ step_order: s.step_order + 1 } as any).eq("id", s.id)
      );
    await Promise.all(shiftUpdates);

    // Insert the blank new step
    const { error } = await supabase.from("imphq_wa_campaign_steps").insert({
      campaign_id: campaignId,
      step_order: targetOrder,
      content: "",
      media_type: "text",
      send_time: "09:00",
      days_offset: 0,
      is_active: true,
    } as any);

    if (error) { toast.error(error.message); return; }
    toast.success("Passo em branco criado abaixo");
    load();
  };

  const updateStep = async (id: string, field: string, value: any) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

    if (field === "content" || field === "content_b") {
      const key = `${id}-${field}`;
      if (pendingUpdates.current[key]) {
        clearTimeout(pendingUpdates.current[key]);
      }
      pendingUpdates.current[key] = setTimeout(async () => {
        delete pendingUpdates.current[key];
        const { error } = await supabase.from("imphq_wa_campaign_steps").update({ [field]: value } as any).eq("id", id);
        if (error) {
          console.error("Erro no auto-save do passo:", error);
        }
      }, 800);
    } else {
      const { error } = await supabase.from("imphq_wa_campaign_steps").update({ [field]: value } as any).eq("id", id);
      if (error) { toast.error(error.message); return; }
    }
  };

  const deleteStep = async (id: string) => {
    await supabase.from("imphq_wa_campaign_steps").delete().eq("id", id);
    toast.success("Step removido");
    load();
  };

  const reorderSteps = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= steps.length || fromIdx === toIdx) return;
    const updatedSteps = [...steps];
    const [removed] = updatedSteps.splice(fromIdx, 1);
    updatedSteps.splice(toIdx, 0, removed);

    // Map new orders optimistically
    const nextSteps = updatedSteps.map((s, i) => ({ ...s, step_order: i }));
    setSteps(nextSteps);

    // Update in database in parallel
    const updates = nextSteps.map((s) => 
      supabase.from("imphq_wa_campaign_steps").update({ step_order: s.step_order } as any).eq("id", s.id)
    );
    await Promise.all(updates);
    load();
  };

  // Reorder by step id, optionally changing days_offset (used by the diagram)
  const reorderById = async (fromId: string, toIdx: number, newOffset?: number) => {
    const fromIdx = steps.findIndex(s => s.id === fromId);
    if (fromIdx === -1) return;
    const clampedTo = Math.max(0, Math.min(steps.length - 1, toIdx));
    const updatedSteps = [...steps];
    const [removed] = updatedSteps.splice(fromIdx, 1);
    const movedItem = typeof newOffset === "number" ? { ...removed, days_offset: newOffset } : removed;
    updatedSteps.splice(clampedTo, 0, movedItem);
    const nextSteps = updatedSteps.map((s, i) => ({ ...s, step_order: i }));
    setSteps(nextSteps);
    const updates = nextSteps.map((s) =>
      supabase.from("imphq_wa_campaign_steps")
        .update({ step_order: s.step_order, ...(s.id === fromId && typeof newOffset === "number" ? { days_offset: newOffset } : {}) } as any)
        .eq("id", s.id)
    );
    await Promise.all(updates);
    load();
  };

  const moveStep = async (idx: number, dir: -1 | 1) => {
    await reorderSteps(idx, idx + dir);
  };

  const duplicateStep = async (step: Step) => {
    const maxOrder = Math.max(...steps.map(s => s.step_order)) + 1;
    const { error } = await supabase.from("imphq_wa_campaign_steps").insert({
      campaign_id: campaignId,
      step_order: maxOrder,
      content: step.content,
      media_url: step.media_url,
      media_type: step.media_type,
      send_time: step.send_time,
      days_offset: step.days_offset,
      send_date: step.send_date,
      is_active: step.is_active,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Step duplicado");
    load();
  };

  const handleMediaUpload = async (stepId: string, file: File) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `campaigns/${campaignId}/${stepId}.${ext}`;
    const { error } = await supabase.storage.from("whatsapp-media").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return; }
    const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    await updateStep(stepId, "media_url", data.publicUrl);
    toast.success("Mídia enviada!");
  };

  const runTestSend = async () => {
    if (!testStep || !testGroupJid.trim()) {
      toast.error("Informe o grupo de destino");
      return;
    }
    setTesting(true);
    try {
      const targetJid = testGroupJid === "all_campaign_groups"
        ? groups.join(",")
        : testGroupJid.trim();

      const { error } = await supabase.functions.invoke("wa-campaign-scheduler", {
        body: { action: "test_send", step_id: testStep.id, group_jid: targetJid },
      });
      if (error) throw error;
      
      if (testGroupJid === "all_campaign_groups") {
        toast.success(`Mensagem enviada com sucesso para ${groups.length} grupos!`);
      } else {
        toast.success("Mensagem de teste enviada com sucesso!");
      }
      setTestStep(null);
      setTestGroupJid("");
    } catch (err: any) {
      toast.error("Falha no teste: " + (err.message || "desconhecido"));
    } finally {
      setTesting(false);
    }
  };

  // --- Drag and Drop handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    await reorderSteps(draggedIdx, index);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  const sampleVars = { nome: "João", produto: produto || "Produto", campanha: "Campanha", grupo_nome: "Grupo VIP" };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pb-2 mb-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            {steps.length} mensagem{steps.length === 1 ? "" : "s"} na sequência
          </p>
          <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border/40">
            <Button
              size="sm"
              variant={viewMode === "edit" ? "secondary" : "ghost"}
              className="h-6 text-[10px] px-2.5 rounded-md font-medium"
              onClick={() => setViewMode("edit")}
            >
              Editor
            </Button>
            <Button
              size="sm"
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              className="h-6 text-[10px] px-2.5 rounded-md font-medium"
              onClick={() => setViewMode("preview")}
            >
              Visualizar Fluxo
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="h-7 text-[11px] border-gold/40 text-gold hover:bg-gold/10" onClick={() => setShowAI(true)}>
            <Sparkles className="h-3 w-3 mr-1" /> Gerar com IA
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setShowImport(true)}>
            <FileText className="h-3 w-3 mr-1" /> Importar texto
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setShowDiagram(true)} disabled={steps.length === 0}>
            <Network className="h-3 w-3 mr-1" /> Diagrama
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setShowShare(true)} disabled={steps.length === 0}>
            <Share2 className="h-3 w-3 mr-1" /> Compartilhar
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[62vh]">
        <div className="space-y-3 p-1">
          {steps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">Nenhuma mensagem na sequência.</p>
              <Button size="sm" variant="outline" className="border-gold/40 text-gold hover:bg-gold/10" onClick={() => setShowAI(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar sequência com IA
              </Button>
            </div>
          ) : viewMode === "edit" ? (
            steps.map((step, idx) => (
              <CampaignStepCard
                key={step.id}
                step={step}
                idx={idx}
                stepsCount={steps.length}
                projectId={projectId}
                produto={produto}
                onMove={moveStep}
                onPreview={setPreviewStep}
                onTest={(s) => { 
                  setTestStep(s); 
                  setTestGroupJid(groups && groups.length > 0 ? "all_campaign_groups" : ""); 
                }}
                onDuplicate={duplicateStep}
                onDelete={deleteStep}
                onUpdate={updateStep}
                onMediaUpload={handleMediaUpload}
                steps={steps}
                onReorder={reorderSteps}
                onAddStepBelow={addStepBelow}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                isDragging={draggedIdx === idx}
                isDragOver={dragOverIdx === idx}
              />
            ))
          ) : (
            // WhatsApp sequence flow preview simulator
            <div className="space-y-4 px-1 py-2">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "p-3 rounded-xl border bg-card/45 backdrop-blur-sm transition-all duration-200 cursor-grab active:cursor-grabbing relative",
                    draggedIdx === idx && "opacity-40 border-dashed border-gold scale-[0.99]",
                    dragOverIdx === idx && "border-gold bg-gold/5 border-t-4"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-gold" />
                      <Badge variant="outline" className="text-[10px] font-bold text-gold border-gold/30 bg-gold/5">
                        #{step.step_order + 1}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {step.send_date ? `Data: ${format(parse(step.send_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}` : `Dia ${step.days_offset}`}
                        {` às ${step.send_time?.slice(0, 5) || "09:00"}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 uppercase font-semibold">
                        {step.media_type}
                      </Badge>
                      {!step.is_active && (
                        <Badge className="text-[9px] px-1 py-0 h-4 bg-red-950/80 text-red-400 border border-red-900/60">
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <WhatsAppPreview step={step} sampleVars={sampleVars} />
                </div>
              ))}
            </div>
          )}

          {viewMode === "edit" && (
            <Button variant="outline" className="w-full border-dashed" onClick={addStep}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar mensagem no final
            </Button>
          )}
        </div>
      </ScrollArea>

      {/* Preview modal */}
      <Dialog open={!!previewStep} onOpenChange={(o) => !o && setPreviewStep(null)}>
        <DialogContent className="bg-secondary/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Preview WhatsApp — Step #{(previewStep?.step_order ?? 0) + 1}</DialogTitle>
          </DialogHeader>
          {previewStep && <WhatsAppPreview step={previewStep} sampleVars={sampleVars} />}
          <p className="text-[10px] text-muted-foreground leading-5">
            Variáveis preenchidas com valores de exemplo (nome=João). Em envio real, são substituídas por dados do contato/grupo.
          </p>
        </DialogContent>
      </Dialog>

      {/* Test send modal */}
      <Dialog open={!!testStep} onOpenChange={(o) => !o && setTestStep(null)}>
        <DialogContent className="bg-secondary/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Testar envio — Step #{(testStep?.step_order ?? 0) + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-6">
              Dispare esta mensagem de teste agora (ignorando janela e agendamento). Selecione todos os grupos da campanha, um específico ou digite um JID personalizado.
            </p>
            <div>
              <Label className="text-xs mb-1.5 block">Grupo de destino</Label>
              {groups && groups.length > 0 ? (
                <Select 
                  value={testGroupJid}
                  onValueChange={v => {
                    if (v === "__custom__") {
                      setTestGroupJid("");
                    } else {
                      setTestGroupJid(v);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Selecione um grupo da campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_campaign_groups" className="text-xs font-semibold text-emerald-400">
                      👥 Enviar para todos os grupos ({groups.length})
                    </SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g} value={g} className="text-xs">
                        👉 Grupo: {g.split("@")[0]}... ({g.slice(0, 10)})
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="text-xs font-semibold text-primary">
                      ✏️ Digitar ID (JID) personalizado...
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : null}

              {(!groups || groups.length === 0 || (!groups.includes(testGroupJid) && testGroupJid !== "all_campaign_groups")) && (
                <Input
                  value={testGroupJid}
                  onChange={e => setTestGroupJid(e.target.value)}
                  placeholder="ex: 1203630..@g.us"
                  className="text-xs mt-2 select-text"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestStep(null)} disabled={testing}>Cancelar</Button>
            <Button onClick={runTestSend} disabled={testing || !testGroupJid.trim()}>
              {testing ? "Enviando..." : "Enviar teste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignAIGenerateDialog
        open={showAI}
        onClose={() => setShowAI(false)}
        campaignId={campaignId}
        projectId={projectId}
        produto={produto}
        onDone={load}
      />

      <CampaignImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        campaignId={campaignId}
        onDone={load}
      />

      <CampaignShareDialog
        open={showShare}
        onClose={() => setShowShare(false)}
        campaignId={campaignId}
        campaignName={produto || "Sequência"}
        produto={produto}
      />

      {showDiagram && (
        <CampaignSequenceDiagram
          open={showDiagram}
          onClose={() => setShowDiagram(false)}
          steps={steps as any}
          baseDate={campaign?.start_date ? new Date(campaign.start_date + "T00:00:00") : campaign?.created_at ? new Date(campaign.created_at) : new Date()}
          onUpdateStep={updateStep}
          onReorder={reorderById}
        />
      )}
    </>
  );
}

