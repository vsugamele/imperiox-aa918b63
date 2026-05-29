import { useEffect, useState, useCallback } from "react";
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
}: CampaignStepCardProps) {
  const [content, setContent] = useState(step.content || "");
  const [contentB, setContentB] = useState(step.content_b || "");

  useEffect(() => {
    setContent(step.content || "");
  }, [step.content]);

  useEffect(() => {
    setContentB(step.content_b || "");
  }, [step.content_b]);

  const insertVariable = (varKey: string) => {
    const newText = (content || "") + ` {${varKey}}`;
    setContent(newText.trim());
    onUpdate(step.id, "content", newText.trim());
  };

  const Icon = MEDIA_ICONS[step.media_type] || Type;

  return (
    <Card className={`border ${step.is_active ? "border-border" : "border-muted opacity-60"}`}>
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
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
            <Badge variant="outline" className="text-[10px]">#{step.step_order + 1}</Badge>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Preview" onClick={() => onPreview(step)}>
              <Eye className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Testar agora" onClick={() => onTest(step)}>
              <Send className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplicar step" onClick={() => onDuplicate(step)}>
              <Plus className="h-3 w-3" />
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
            className="text-xs min-h-[160px] font-mono leading-6 whitespace-pre-wrap"
            rows={8}
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={() => {
              if (content !== step.content) {
                onUpdate(step.id, "content", content);
              }
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
            className="text-xs min-h-[50px] mt-1.5"
            value={contentB}
            onChange={e => setContentB(e.target.value)}
            onBlur={() => {
              if (contentB !== step.content_b) {
                onUpdate(step.id, "content_b", contentB || null);
              }
            }}
            placeholder="Texto alternativo. Se preenchido, 50% dos grupos recebem esta versão."
          />
        </details>

        {step.media_type !== "text" && (
          <div>
            <Label className="text-[10px]">Mídia</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-xs flex-1"
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
}

export default function CampaignStepEditor({ campaignId, projectId = "", produto = "" }: CampaignStepEditorProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewStep, setPreviewStep] = useState<Step | null>(null);
  const [testStep, setTestStep] = useState<Step | null>(null);
  const [testGroupJid, setTestGroupJid] = useState("");
  const [testing, setTesting] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_campaign_steps")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });
    setSteps((data as any[]) || []);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

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

  const updateStep = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("imphq_wa_campaign_steps").update({ [field]: value } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const deleteStep = async (id: string) => {
    await supabase.from("imphq_wa_campaign_steps").delete().eq("id", id);
    toast.success("Step removido");
    load();
  };

  const moveStep = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[idx];
    const b = steps[target];
    // swap step_order
    setSteps(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, step_order: i }));
    });
    await Promise.all([
      supabase.from("imphq_wa_campaign_steps").update({ step_order: b.step_order } as any).eq("id", a.id),
      supabase.from("imphq_wa_campaign_steps").update({ step_order: a.step_order } as any).eq("id", b.id),
    ]);
    load();
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
      toast.error("Informe o JID do grupo (ex: 1203...@g.us)");
      return;
    }
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("wa-campaign-scheduler", {
        body: { action: "test_send", step_id: testStep.id, group_jid: testGroupJid.trim() },
      });
      if (error) throw error;
      toast.success("Mensagem de teste enviada!");
      setTestStep(null);
      setTestGroupJid("");
    } catch (err: any) {
      toast.error("Falha no teste: " + (err.message || "desconhecido"));
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  const sampleVars = { nome: "João", produto: produto || "Produto", campanha: "Campanha", grupo_nome: "Grupo VIP" };

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-2 border-b border-border/40">
        <p className="text-[11px] text-muted-foreground">{steps.length} mensagem{steps.length === 1 ? "" : "s"} nesta sequência</p>
        <div className="flex items-center gap-1.5">
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
      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-3 p-1">
          {steps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">Nenhuma mensagem na sequência.</p>
              <Button size="sm" variant="outline" className="border-gold/40 text-gold hover:bg-gold/10" onClick={() => setShowAI(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar sequência com IA
              </Button>
            </div>
          ) : (
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
                onTest={(s) => { setTestStep(s); setTestGroupJid(""); }}
                onDuplicate={duplicateStep}
                onDelete={deleteStep}
                onUpdate={updateStep}
                onMediaUpload={handleMediaUpload}
                steps={steps}
              />
            ))
          )}

          <Button variant="outline" className="w-full" onClick={addStep}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar mensagem
          </Button>
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
              Envia esta mensagem agora para 1 grupo (ignorando janela e agendamento). Use o JID do grupo de teste.
            </p>
            <div>
              <Label className="text-xs">JID do grupo</Label>
              <Input
                value={testGroupJid}
                onChange={e => setTestGroupJid(e.target.value)}
                placeholder="ex: 1203630..@g.us"
                className="text-xs"
              />
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

      <CampaignSequenceDiagram
        open={showDiagram}
        onClose={() => setShowDiagram(false)}
        steps={steps as any}
      />
    </>
  );
}
