import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Mic, Video, FileText, Type, Download, GitBranch, CalendarDays, LayoutGrid, GripVertical, Pencil, CalendarIcon } from "lucide-react";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toPng } from "html-to-image";
import { toast } from "sonner";

interface Step {
  id: string;
  step_order: number;
  content: string | null;
  media_type: string;
  send_time: string;
  days_offset: number;
  send_date: string | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  steps: Step[];
  baseDate?: Date;
  onUpdateStep?: (id: string, field: string, value: any) => void | Promise<void>;
  onReorder?: (fromId: string, toIdx: number, newOffset?: number) => void | Promise<void>;
}

const ICONS: Record<string, any> = { text: Type, image: ImageIcon, audio: Mic, video: Video, document: FileText };

function timeToMinutes(t: string) {
  const [h, m] = (t || "09:00").split(":").map(Number);
  return h * 60 + m;
}

function preview(s: string | null, n = 60) {
  const txt = (s || "").replace(/\s+/g, " ").trim();
  return txt.length > n ? txt.slice(0, n) + "…" : txt || "(sem texto)";
}

// ─────────── EDIT POPOVER ───────────
function StepEditPopover({ step, baseDate, children, onUpdateStep }: { step: Step; baseDate: Date; children: React.ReactNode; onUpdateStep?: Props["onUpdateStep"] }) {
  const [local, setLocal] = useState({
    send_time: step.send_time?.slice(0, 5) || "09:00",
    days_offset: step.days_offset,
    content: step.content || "",
    is_active: step.is_active,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  if (!onUpdateStep) return <>{children}</>;

  const commit = (field: string, value: any) => onUpdateStep(step.id, field, value);
  const baseDay = startOfDay(baseDate);
  const currentDate = addDays(baseDay, local.days_offset);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96 bg-secondary/95 backdrop-blur p-3 space-y-2.5" side="right" align="start">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-[10px]">#{step.step_order + 1}</Badge>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">Ativo</Label>
            <Switch
              checked={local.is_active}
              onCheckedChange={(v) => { setLocal(p => ({ ...p, is_active: v })); commit("is_active", v); }}
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Data do envio</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("h-8 w-full justify-start text-left font-normal text-xs bg-background/60 px-2")}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-gold" />
                  {format(currentDate, "dd/MM/yyyy (EEE)", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 bg-secondary/95 backdrop-blur pointer-events-auto z-[100]"
                align="start"
                onInteractOutside={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("[data-radix-popper-content-wrapper]")) e.preventDefault();
                }}
              >
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(d) => {
                    if (!d) return;
                    const newOffset = differenceInCalendarDays(startOfDay(d), baseDay);
                    if (newOffset < 0) {
                      toast.error("Data anterior à data base da campanha.");
                      return;
                    }
                    setLocal(p => ({ ...p, days_offset: newOffset }));
                    commit("days_offset", newOffset);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-[9px] text-muted-foreground/70 font-mono">D+{local.days_offset} · base {format(baseDay, "dd/MM", { locale: ptBR })}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Horário</Label>
            <Input
              type="time"
              value={local.send_time}
              onChange={(e) => setLocal(p => ({ ...p, send_time: e.target.value }))}
              onBlur={() => commit("send_time", local.send_time)}
              className="h-8 text-xs bg-background/60"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Mensagem</Label>
          <Textarea
            value={local.content}
            onChange={(e) => { setLocal(p => ({ ...p, content: e.target.value })); commit("content", e.target.value); }}
            className="min-h-[120px] text-xs bg-background/60 leading-6"
            placeholder="Texto da mensagem..."
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Edições salvam automaticamente.</p>
      </PopoverContent>
    </Popover>
  );
}

export default function CampaignSequenceDiagram({ open, onClose, steps, baseDate, onUpdateStep, onReorder }: Props) {
  const [mode, setMode] = useState<"timeline" | "flow" | "calendar">("timeline");
  const exportRef = useRef<HTMLDivElement>(null);
  const base = baseDate || new Date();

  // Sort + compute signals
  const sorted = useMemo(() => {
    return [...steps].sort((a, b) => {
      if (a.days_offset !== b.days_offset) return a.days_offset - b.days_offset;
      return timeToMinutes(a.send_time) - timeToMinutes(b.send_time);
    });
  }, [steps]);

  const signals = useMemo(() => {
    const map = new Map<string, "ok" | "conflict" | "gap" | "media">();
    const byKey = new Map<string, string[]>();
    sorted.forEach(s => {
      const k = `${s.days_offset}-${s.send_time?.slice(0, 5)}`;
      const arr = byKey.get(k) || [];
      arr.push(s.id);
      byKey.set(k, arr);
    });
    sorted.forEach(s => map.set(s.id, s.media_type !== "text" ? "media" : "ok"));
    byKey.forEach(ids => { if (ids.length > 1) ids.forEach(id => map.set(id, "conflict")); });
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const diffH = (cur.days_offset - prev.days_offset) * 24 + (timeToMinutes(cur.send_time) - timeToMinutes(prev.send_time)) / 60;
      if (diffH > 48) map.set(cur.id, "gap");
    }
    return map;
  }, [sorted]);

  const grouped = useMemo(() => {
    const m = new Map<number, Step[]>();
    sorted.forEach(s => {
      const arr = m.get(s.days_offset) || [];
      arr.push(s);
      m.set(s.days_offset, arr);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a - b);
  }, [sorted]);

  const handleExport = async () => {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, { backgroundColor: "#080607", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `sequencia-${mode}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("PNG exportado!");
    } catch (e: any) {
      toast.error("Falha ao exportar: " + e.message);
    }
  };

  const signalColor = (sig: string | undefined) => {
    if (sig === "conflict") return "border-yellow-500/60 bg-yellow-500/5";
    if (sig === "gap") return "border-red-500/60 bg-red-500/5";
    if (sig === "media") return "border-emerald-500/40 bg-emerald-500/5";
    return "border-border";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 max-w-7xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="font-serif text-xl">Diagrama da Sequência · {sorted.length} mensagens</DialogTitle>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as any)} className="bg-background/40 rounded-md p-0.5">
                <ToggleGroupItem value="timeline" className="h-8 px-3 text-xs gap-1.5 data-[state=on]:bg-gold/20 data-[state=on]:text-gold">
                  <CalendarDays className="h-3.5 w-3.5" /> Timeline
                </ToggleGroupItem>
                <ToggleGroupItem value="flow" className="h-8 px-3 text-xs gap-1.5 data-[state=on]:bg-gold/20 data-[state=on]:text-gold">
                  <GitBranch className="h-3.5 w-3.5" /> Fluxo
                </ToggleGroupItem>
                <ToggleGroupItem value="calendar" className="h-8 px-3 text-xs gap-1.5 data-[state=on]:bg-gold/20 data-[state=on]:text-gold">
                  <LayoutGrid className="h-3.5 w-3.5" /> Calendário
                </ToggleGroupItem>
              </ToggleGroup>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1" /> PNG
              </Button>
            </div>
          </div>
          {(onUpdateStep || onReorder) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Clique numa box para editar · arraste pela alça <GripVertical className="inline h-3 w-3 -mt-0.5" /> para reordenar (Timeline e Fluxo).
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div ref={exportRef} className="p-6">
            {mode === "timeline" && <TimelineView grouped={grouped} sorted={sorted} base={base} signals={signals} signalColor={signalColor} onUpdateStep={onUpdateStep} onReorder={onReorder} />}
            {mode === "flow" && <FlowView sorted={sorted} base={base} signals={signals} signalColor={signalColor} onUpdateStep={onUpdateStep} onReorder={onReorder} />}
            {mode === "calendar" && <CalendarView sorted={sorted} base={base} signals={signals} />}
          </div>
        </ScrollArea>

        <div className="px-6 py-2 border-t border-border/40 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/60" /> Mídia / marco</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500/60" /> Mesmo horário (conflito)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/60" /> Gap &gt;48h</span>
          <span className="ml-auto">Data base: {format(base, "dd/MM/yyyy (EEE)", { locale: ptBR })}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── TIMELINE ───────────
function TimelineView({ grouped, sorted, base, signals, signalColor, onUpdateStep, onReorder }: any) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropOffset, setDropOffset] = useState<number | null>(null);
  const canEdit = !!onUpdateStep;
  const canDrag = !!onReorder;

  const handleDropOnColumn = (offset: number) => {
    if (!draggingId || !onReorder) return;
    const moving = sorted.find((s: Step) => s.id === draggingId);
    if (!moving) return;
    // Insert at end of target column (preserves chronological order within column)
    const targetCol = sorted.filter((s: Step) => s.days_offset === offset && s.id !== draggingId);
    let toIdx: number;
    if (targetCol.length === 0) {
      // empty column: put after the last step of previous offsets
      const beforeCount = sorted.filter((s: Step) => s.days_offset < offset && s.id !== draggingId).length;
      toIdx = beforeCount;
    } else {
      const lastInCol = targetCol[targetCol.length - 1];
      toIdx = sorted.findIndex((s: Step) => s.id === lastInCol.id);
    }
    onReorder(draggingId, toIdx, offset);
    setDraggingId(null);
    setDropOffset(null);
  };

  return (
    <div className="flex gap-3 min-w-max">
      {grouped.map(([offset, daySteps]: any) => {
        const date = addDays(base, offset);
        const isDropTarget = canDrag && draggingId && dropOffset === offset;
        return (
          <div
            key={offset}
            className={`w-[220px] shrink-0 rounded-lg transition-colors ${isDropTarget ? "ring-2 ring-gold/60 bg-gold/5" : ""}`}
            onDragOver={(e) => { if (canDrag && draggingId) { e.preventDefault(); setDropOffset(offset); } }}
            onDragLeave={() => setDropOffset(prev => prev === offset ? null : prev)}
            onDrop={(e) => { e.preventDefault(); handleDropOnColumn(offset); }}
          >
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b-2 border-gold/30 pb-2 mb-3 px-1">
              <p className="text-[10px] uppercase tracking-editorial text-muted-foreground">D+{offset}</p>
              <p className="font-serif text-base text-gold">{format(date, "EEE dd/MM", { locale: ptBR })}</p>
            </div>
            <div className="flex flex-col gap-2 px-1 pb-2 min-h-[80px]">
              {daySteps.map((s: Step) => {
                const Icon = ICONS[s.media_type] || Type;
                const sig = signals.get(s.id);
                const card = (
                  <div
                    className={`rounded-lg border p-2.5 ${signalColor(sig)} ${!s.is_active ? "opacity-40" : ""} ${canEdit ? "cursor-pointer hover:border-gold/40 transition-colors" : ""} ${draggingId === s.id ? "opacity-50" : ""}`}
                    draggable={canDrag}
                    onDragStart={(e) => { setDraggingId(s.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDraggingId(null); setDropOffset(null); }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        {canDrag && <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />}
                        <span className="font-mono text-[11px] text-gold">{s.send_time?.slice(0, 5)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">#{s.step_order + 1}</Badge>
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        {canEdit && <Pencil className="h-2.5 w-2.5 text-muted-foreground/60" />}
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-foreground/80">{preview(s.content, 80)}</p>
                  </div>
                );
                return (
                  <div key={s.id}>
                    {canEdit ? <StepEditPopover step={s} baseDate={base} onUpdateStep={onUpdateStep}>{card}</StepEditPopover> : card}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────── FLOW ───────────
function FlowView({ sorted, base, signals, signalColor, onUpdateStep, onReorder }: any) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const canEdit = !!onUpdateStep;
  const canDrag = !!onReorder;

  const handleDrop = (toIdx: number) => {
    if (!draggingId || !onReorder) return;
    onReorder(draggingId, toIdx);
    setDraggingId(null);
    setDropIdx(null);
  };

  return (
    <div className="flex flex-col items-center gap-0 max-w-2xl mx-auto">
      {sorted.map((s: Step, i: number) => {
        const Icon = ICONS[s.media_type] || Type;
        const sig = signals.get(s.id);
        const date = addDays(base, s.days_offset);
        const prev = i > 0 ? sorted[i - 1] : null;
        let connectorLabel = "";
        if (prev) {
          const diffMin = (s.days_offset - prev.days_offset) * 1440 + (timeToMinutes(s.send_time) - timeToMinutes(prev.send_time));
          if (s.days_offset === prev.days_offset) {
            const h = Math.round(diffMin / 60);
            connectorLabel = h >= 1 ? `${h}h depois` : `${diffMin}min depois`;
          } else {
            const days = s.days_offset - prev.days_offset;
            connectorLabel = `${days === 1 ? "próx dia" : `+${days} dias`} às ${s.send_time?.slice(0, 5)}`;
          }
        }
        const card = (
          <div
            className={`w-full max-w-md rounded-lg border p-3 ${signalColor(sig)} ${!s.is_active ? "opacity-40" : ""} ${canEdit ? "cursor-pointer hover:border-gold/40 transition-colors" : ""} ${draggingId === s.id ? "opacity-50" : ""}`}
            draggable={canDrag}
            onDragStart={(e) => { setDraggingId(s.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDraggingId(null); setDropIdx(null); }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {canDrag && <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />}
                <Badge variant="outline" className="text-[10px]">#{s.step_order + 1}</Badge>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-[11px] text-gold">{format(date, "EEE dd/MM", { locale: ptBR })} · {s.send_time?.slice(0, 5)}</span>
              </div>
              {canEdit && <Pencil className="h-3 w-3 text-muted-foreground/60" />}
            </div>
            <p className="text-xs leading-relaxed text-foreground/80">{preview(s.content, 140)}</p>
          </div>
        );
        return (
          <div key={s.id} className="w-full flex flex-col items-center">
            {prev && (
              <div className="flex flex-col items-center py-1">
                <div className="w-px h-4 bg-border" />
                <Badge variant="outline" className="text-[9px] h-5 px-2 bg-background">{connectorLabel}</Badge>
                <div className="w-px h-4 bg-border" />
                <div className="w-2 h-2 rotate-45 border-r border-b border-border -mt-1" />
              </div>
            )}
            {canDrag && (
              <div
                className={`w-full max-w-md h-2 my-0.5 rounded transition-colors ${dropIdx === i && draggingId ? "bg-gold/40" : ""}`}
                onDragOver={(e) => { if (draggingId) { e.preventDefault(); setDropIdx(i); } }}
                onDragLeave={() => setDropIdx(prev => prev === i ? null : prev)}
                onDrop={(e) => { e.preventDefault(); handleDrop(i); }}
              />
            )}
            {canEdit ? <StepEditPopover step={s} baseDate={base} onUpdateStep={onUpdateStep}>{card}</StepEditPopover> : card}
          </div>
        );
      })}
    </div>
  );
}

// ─────────── CALENDAR ───────────
function CalendarView({ sorted, base, signals }: any) {
  const HOURS_START = 6;
  const HOURS_END = 23;
  const totalHours = HOURS_END - HOURS_START + 1;
  const ROW_H = 40;

  const maxOffset = sorted.length ? Math.max(...sorted.map((s: Step) => s.days_offset)) : 0;
  const numWeeks = Math.ceil((maxOffset + 1) / 7);
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  const sigColor = (sig: string | undefined) => {
    if (sig === "conflict") return "bg-yellow-500";
    if (sig === "gap") return "bg-red-500";
    if (sig === "media") return "bg-emerald-500";
    return "bg-gold";
  };

  return (
    <div className="space-y-6">
      {Array.from({ length: numWeeks }, (_, w) => (
        <div key={w}>
          <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mb-2">Semana {w + 1}</p>
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border border-border rounded-lg overflow-hidden">
            <div className="bg-secondary/40 border-b border-border" />
            {dayNames.map((d, i) => {
              const offset = w * 7 + i;
              const date = addDays(base, offset);
              return (
                <div key={i} className="bg-secondary/40 border-b border-l border-border p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{d}</p>
                  <p className="text-xs font-mono text-gold">{format(date, "dd/MM")}</p>
                </div>
              );
            })}
            {Array.from({ length: totalHours }, (_, hIdx) => {
              const hour = HOURS_START + hIdx;
              return (
                <div key={hour} className="contents">
                  <div className="border-b border-border/40 p-1 text-[10px] text-muted-foreground font-mono text-right pr-2" style={{ height: ROW_H }}>
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {Array.from({ length: 7 }, (_, dIdx) => {
                    const offset = w * 7 + dIdx;
                    const cellSteps = sorted.filter((s: Step) => {
                      const sh = timeToMinutes(s.send_time) / 60;
                      return s.days_offset === offset && Math.floor(sh) === hour;
                    });
                    return (
                      <div key={dIdx} className="border-l border-b border-border/40 relative" style={{ height: ROW_H }}>
                        {cellSteps.map((s: Step) => {
                          const min = timeToMinutes(s.send_time) % 60;
                          const top = (min / 60) * ROW_H;
                          const sig = signals.get(s.id);
                          return (
                            <Popover key={s.id}>
                              <PopoverTrigger asChild>
                                <button
                                  className={`absolute left-1 right-1 h-2 rounded-full ${sigColor(sig)} hover:h-3 transition-all`}
                                  style={{ top: top + 4 }}
                                  title={`#${s.step_order + 1} · ${s.send_time?.slice(0, 5)}`}
                                />
                              </PopoverTrigger>
                              <PopoverContent className="w-72 bg-secondary/95 backdrop-blur" side="top">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px]">#{s.step_order + 1}</Badge>
                                    <span className="font-mono text-[11px] text-gold">{s.send_time?.slice(0, 5)}</span>
                                  </div>
                                  <p className="text-xs leading-6 text-foreground/80">{preview(s.content, 200)}</p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
