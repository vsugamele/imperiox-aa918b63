import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Wand2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ParsedStep {
  day_label: string;
  day_offset: number;
  send_time: string;
  content: string;
  _keep: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onDone: () => void;
}

export default function CampaignImportDialog({ open, onClose, campaignId, onDone }: Props) {
  const [text, setText] = useState("");
  const [baseDate, setBaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [steps, setSteps] = useState<ParsedStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const reset = () => {
    setText(""); setSteps([]); setBaseDate(new Date().toISOString().slice(0, 10));
    setExpandedSteps({});
  };

  const parse = async () => {
    if (!text.trim()) { toast.error("Cole o copy primeiro"); return; }
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-campaign-parse-text", {
        body: { text, base_date: baseDate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const arr: ParsedStep[] = (data?.steps || []).map((s: any) => ({ ...s, _keep: true }));
      if (arr.length === 0) { toast.error("IA não identificou mensagens. Verifique separadores."); return; }
      setSteps(arr);
      toast.success(`✨ ${arr.length} mensagens detectadas`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar");
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    const selected = steps.filter(s => s._keep);
    if (selected.length === 0) { toast.error("Nenhuma mensagem selecionada"); return; }
    setImporting(true);
    try {
      const { data: existing } = await supabase
        .from("imphq_wa_campaign_steps")
        .select("step_order")
        .eq("campaign_id", campaignId)
        .order("step_order", { ascending: false })
        .limit(1);
      let nextOrder = (existing?.[0]?.step_order ?? -1) + 1;

      const toInsert = selected.map((s) => ({
        campaign_id: campaignId,
        step_order: nextOrder++,
        content: s.content.slice(0, 4000),
        media_type: "text",
        send_time: s.send_time,
        days_offset: s.day_offset,
        is_active: true,
      }));
      const { error } = await supabase.from("imphq_wa_campaign_steps").insert(toInsert as any);
      if (error) throw error;
      toast.success(`✅ ${toInsert.length} mensagens importadas`);
      onDone();
      reset();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    } finally {
      setImporting(false);
    }
  };

  const toggle = (i: number) => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, _keep: !s._keep } : s));
  const toggleAll = (v: boolean) => setSteps(prev => prev.map(s => ({ ...s, _keep: v })));
  const toggleExpand = (i: number) => setExpandedSteps(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="bg-secondary/40 max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <FileText className="h-4 w-4 text-gold" /> Importar sequência (texto pronto)
          </DialogTitle>
        </DialogHeader>

        {steps.length === 0 ? (
          <div className="space-y-3 overflow-auto">
            <div className="grid grid-cols-[1fr_180px] gap-3">
              <div>
                <Label className="text-xs">Copy bruto (cole tudo, com cabeçalhos de data)</Label>
                <Textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={14}
                  placeholder={`Sexta - 22/05 - 9:00\nFala, tatuador! 👊\n...\n—-----\nSábado 23/05 - 9:00\n...`}
                  className="text-xs font-mono leading-6"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data base (day 0)</Label>
                <Input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} className="h-9 text-sm" />
                <p className="text-[10px] text-muted-foreground leading-5">
                  O day_offset de cada mensagem é calculado relativo a esta data. Use o dia da primeira mensagem.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {steps.filter(s => s._keep).length} de {steps.length} selecionadas
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => toggleAll(true)}>Marcar todas</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => toggleAll(false)}>Desmarcar</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setSteps([])}>← Voltar</Button>
              </div>
            </div>
            <ScrollArea className="flex-1 border border-border/40 rounded-md">
              <div className="divide-y divide-border/40">
                {steps.map((s, i) => (
                  <div key={i} className={`flex gap-3 p-2.5 ${s._keep ? "" : "opacity-40"}`}>
                    <Checkbox checked={s._keep} onCheckedChange={() => toggle(i)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                        <Badge className="text-[10px] bg-gold/20 text-gold border-gold/30">D+{s.day_offset} · {s.send_time}</Badge>
                        {s.day_label && <span className="text-[10px] text-muted-foreground truncate">{s.day_label}</span>}
                      </div>
                      <p className={`text-xs whitespace-pre-wrap leading-6 ${expandedSteps[i] ? "" : "line-clamp-4"}`}>
                        {s.content}
                      </p>
                      {s.content.length > 180 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(i)}
                          className="text-[10px] text-primary hover:underline mt-1.5 block font-medium"
                        >
                          {expandedSteps[i] ? "Recolher mensagem" : "Ver mensagem completa..."}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="border-t border-border/40 pt-3">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={parsing || importing}>Cancelar</Button>
          {steps.length === 0 ? (
            <Button onClick={parse} disabled={parsing || !text.trim()}>
              {parsing ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analisando...</> : <><Wand2 className="h-3.5 w-3.5 mr-1" /> Analisar com IA</>}
            </Button>
          ) : (
            <Button onClick={doImport} disabled={importing || steps.filter(s => s._keep).length === 0}>
              {importing ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Importando...</> : <><Upload className="h-3.5 w-3.5 mr-1" /> Importar {steps.filter(s => s._keep).length} mensagens</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
