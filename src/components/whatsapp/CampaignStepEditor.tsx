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
import { Plus, Trash2, GripVertical, Image, Mic, Video, FileText, Type, CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AIGenerateButton } from "@/components/projeto/AIGenerateButton";

interface Step {
  id: string;
  campaign_id: string;
  step_order: number;
  content: string | null;
  media_url: string | null;
  media_type: string;
  send_time: string;
  days_offset: number;
  send_date: string | null;
  is_active: boolean;
}

const MEDIA_ICONS: Record<string, any> = {
  text: Type,
  image: Image,
  audio: Mic,
  video: Video,
  document: FileText,
};

// --- Time picker with hour/minute selectors ---
function TimePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = (value || "09:00").split(":").map(Number);
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  return (
    <div className="flex items-center gap-0.5">
      <Select value={String(h).padStart(2, "0")} onValueChange={v => onChange(`${v}:${String(m).padStart(2, "0")}`)}>
        <SelectTrigger className="h-8 text-xs w-[52px] px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {hours.map(hh => <SelectItem key={hh} value={hh} className="text-xs">{hh}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground font-bold">:</span>
      <Select value={String(m - (m % 5)).padStart(2, "0")} onValueChange={v => onChange(`${String(h).padStart(2, "0")}:${v}`)}>
        <SelectTrigger className="h-8 text-xs w-[52px] px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {minutes.map(mm => <SelectItem key={mm} value={mm} className="text-xs">{mm}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// --- Date picker with calendar popover ---
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

interface CampaignStepEditorProps {
  campaignId: string;
  projectId?: string;
  produto?: string;
}

export default function CampaignStepEditor({ campaignId, projectId = "", produto = "" }: CampaignStepEditorProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_campaign_steps")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("days_offset", { ascending: true })
      .order("send_time", { ascending: true })
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

  const handleMediaUpload = async (stepId: string, file: File) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `campaigns/${campaignId}/${stepId}.${ext}`;
    const { error } = await supabase.storage.from("whatsapp-media").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return; }
    const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    await updateStep(stepId, "media_url", data.publicUrl);
    toast.success("Mídia enviada!");
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <ScrollArea className="max-h-[65vh]">
      <div className="space-y-3 p-1">
        {steps.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">Nenhuma mensagem na sequência.</p>
          </div>
        ) : (
          steps.map((step, idx) => {
            const Icon = MEDIA_ICONS[step.media_type] || Type;
            return (
              <Card key={step.id} className={`border ${step.is_active ? "border-border" : "border-muted opacity-60"}`}>
                <CardContent className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-[10px]">#{step.step_order + 1}</Badge>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px]">Ativo</Label>
                        <Switch checked={step.is_active} onCheckedChange={v => updateStep(step.id, "is_active", v)} />
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteStep(step.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px]">Tipo</Label>
                      <Select value={step.media_type} onValueChange={v => updateStep(step.id, "media_type", v)}>
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
                        onChange={v => updateStep(step.id, "send_time", v)}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Data específica</Label>
                      <DatePickerInput
                        value={step.send_date || null}
                        onChange={v => updateStep(step.id, "send_date", v)}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">{step.send_date ? "Offset (ignorado)" : "Dia (offset)"}</Label>
                      <Input type="number" className={`h-8 text-xs ${step.send_date ? "opacity-50" : ""}`} value={step.days_offset} onChange={e => updateStep(step.id, "days_offset", parseInt(e.target.value) || 0)} min={0} disabled={!!step.send_date} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[10px]">Mensagem</Label>
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
                            campaign_id: campaignId,
                            produto,
                            step_order: step.step_order,
                            total_steps: steps.length,
                            media_type: step.media_type,
                          }}
                          onResult={(data: any) => {
                            const text = data?.text || data?.content || "";
                            if (text) updateStep(step.id, "content", text);
                          }}
                        />
                      )}
                    </div>
                    <Textarea
                      className="text-xs min-h-[60px]"
                      value={step.content || ""}
                      onChange={e => updateStep(step.id, "content", e.target.value)}
                      placeholder="Texto da mensagem..."
                    />
                  </div>

                  {step.media_type !== "text" && (
                    <div>
                      <Label className="text-[10px]">Mídia</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 text-xs flex-1"
                          value={step.media_url || ""}
                          onChange={e => updateStep(step.id, "media_url", e.target.value)}
                          placeholder="URL da mídia ou faça upload →"
                        />
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept={step.media_type === "image" ? "image/*" : step.media_type === "audio" ? "audio/*" : step.media_type === "video" ? "video/*" : "*"}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleMediaUpload(step.id, f);
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
          })
        )}

        <Button variant="outline" className="w-full" onClick={addStep}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar mensagem
        </Button>
      </div>
    </ScrollArea>
  );
}
