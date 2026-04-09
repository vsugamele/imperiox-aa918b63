import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Clock, RefreshCw, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: string;
  color: string | null;
  all_day: boolean;
  reminder: boolean;
  created_at: string;
  google_event_id?: string | null;
}

const EVENT_TYPES = [
  { value: "general", label: "Geral", icon: "📌", color: "bg-muted text-muted-foreground" },
  { value: "launch", label: "Lançamento", icon: "🚀", color: "bg-primary/20 text-primary" },
  { value: "live", label: "Live", icon: "🎥", color: "bg-red-500/20 text-red-400" },
  { value: "deadline", label: "Deadline", icon: "⏰", color: "bg-amber-500/20 text-amber-400" },
  { value: "meeting", label: "Reunião", icon: "🤝", color: "bg-blue-500/20 text-blue-400" },
  { value: "content", label: "Conteúdo", icon: "📝", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "task", label: "Tarefa", icon: "✅", color: "bg-violet-500/20 text-violet-400" },
];

const getEventType = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0];

interface Props {
  projectId: string;
}

export function ProjetoCalendario({ projectId }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [autoSync, setAutoSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({ title: "", description: "", event_type: "general", event_date: "", end_date: "", all_day: false, reminder: false, color: "" });

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("imphq_calendar_events")
      .select("*")
      .eq("project_id", projectId)
      .order("event_date", { ascending: true });
    setEvents((data as CalendarEvent[]) || []);
  }, [projectId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const openNew = (date?: Date) => {
    const d = date || selectedDate;
    setEditingEvent(null);
    setForm({ title: "", description: "", event_type: "general", event_date: format(d, "yyyy-MM-dd'T'HH:mm"), end_date: "", all_day: false, reminder: false, color: "" });
    setDialogOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description || "",
      event_type: ev.event_type,
      event_date: ev.event_date.slice(0, 16),
      end_date: ev.end_date?.slice(0, 16) || "",
      all_day: ev.all_day,
      reminder: ev.reminder,
      color: ev.color || "",
    });
    setDialogOpen(true);
  };

  const syncToGoogle = async (eventData: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "sync_to_google", event: eventData },
      });
      if (error) throw error;
      return data?.google_event_id;
    } catch (err: any) {
      console.warn("Google sync failed:", err.message);
      return null;
    }
  };

  const saveEvent = async () => {
    if (!form.title || !form.event_date) { toast.error("Título e data são obrigatórios"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      project_id: projectId,
      user_id: user.id,
      title: form.title,
      description: form.description || null,
      event_type: form.event_type,
      event_date: new Date(form.event_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      all_day: form.all_day,
      reminder: form.reminder,
      color: form.color || null,
    };

    if (editingEvent) {
      const { error } = await supabase.from("imphq_calendar_events").update(payload).eq("id", editingEvent.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      if (autoSync) await syncToGoogle({ ...payload, id: editingEvent.id, google_event_id: editingEvent.google_event_id });
      toast.success("Evento atualizado");
    } else {
      const { data: inserted, error } = await supabase.from("imphq_calendar_events").insert(payload).select().single();
      if (error) { toast.error("Erro ao criar"); return; }
      if (autoSync && inserted) await syncToGoogle({ ...payload, id: inserted.id });
      toast.success("Evento criado");
    }
    setDialogOpen(false);
    loadEvents();
  };

  const deleteEvent = async (id: string, googleEventId?: string | null) => {
    if (googleEventId) {
      try {
        await supabase.functions.invoke("google-calendar-sync", {
          body: { action: "delete_from_google", event: { google_event_id: googleEventId } },
        });
      } catch {}
    }
    await supabase.from("imphq_calendar_events").delete().eq("id", id);
    toast.success("Evento removido");
    loadEvents();
  };

  const syncAllToGoogle = async () => {
    setSyncing(true);
    let synced = 0;
    for (const ev of events) {
      const gid = await syncToGoogle(ev);
      if (gid) synced++;
    }
    toast.success(`${synced} eventos sincronizados com Google Calendar`);
    setSyncing(false);
    loadEvents();
  };

  const importFromGoogle = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "sync_from_google", project_id: projectId },
      });
      if (error) throw error;
      toast.success(`${data?.imported || 0} eventos importados do Google Calendar`);
      loadEvents();
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "Verifique as credenciais Google"));
    }
    setSyncing(false);
  };

  const eventDates = events.map(e => new Date(e.event_date));
  const filteredEvents = events.filter(e => filterType === "all" || e.event_type === filterType);
  const dayEvents = filteredEvents.filter(e => isSameDay(new Date(e.event_date), selectedDate));
  const monthEvents = filteredEvents.filter(e => isSameMonth(new Date(e.event_date), month));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="bg-card border-border lg:col-span-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📅 Calendário</CardTitle>
            <Button size="sm" onClick={() => openNew()} className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Evento
            </Button>
          </div>
          {/* Google Calendar Controls */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={syncAllToGoogle} disabled={syncing}>
              <RefreshCw className={cn("h-2.5 w-2.5", syncing && "animate-spin")} /> Sync Google
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={importFromGoogle} disabled={syncing}>
              <Download className="h-2.5 w-2.5" /> Importar
            </Button>
            <div className="flex items-center gap-1 ml-auto">
              <Switch checked={autoSync} onCheckedChange={setAutoSync} className="scale-[0.6]" />
              <span className="text-[9px] text-muted-foreground">Auto-sync</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            month={month}
            onMonthChange={setMonth}
            locale={ptBR}
            className="p-0 pointer-events-auto"
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold text-primary rounded-full" }}
          />
          <div className="mt-3 flex flex-wrap gap-1">
            <Badge variant={filterType === "all" ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setFilterType("all")}>Todos</Badge>
            {EVENT_TYPES.map(t => (
              <Badge key={t.value} variant={filterType === t.value ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setFilterType(t.value)}>
                {t.icon} {t.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card className="bg-card border-border lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">
            {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            <span className="text-muted-foreground ml-2 lowercase font-normal">
              ({dayEvents.length} evento{dayEvents.length !== 1 ? "s" : ""})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dayEvents.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
              <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => openNew()}>
                <Plus className="h-3 w-3 mr-1" /> Criar evento
              </Button>
            </div>
          )}
          {dayEvents.map(ev => {
            const type = getEventType(ev.event_type);
            return (
              <div key={ev.id} className="flex items-start justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{type.icon}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{ev.title}</p>
                      {ev.google_event_id && (
                        <Badge variant="outline" className="text-[8px] gap-0.5 px-1 py-0 border-blue-400/30 text-blue-400">
                          <Link2 className="h-2 w-2" /> Google
                        </Badge>
                      )}
                    </div>
                    {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn("text-[10px]", type.color)}>{type.label}</Badge>
                      {!ev.all_day && (
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(ev.event_date), "HH:mm")}
                          {ev.end_date && ` — ${format(new Date(ev.end_date), "HH:mm")}`}
                        </span>
                      )}
                      {ev.all_day && <span className="text-[10px] text-muted-foreground">Dia inteiro</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(ev)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteEvent(ev.id, ev.google_event_id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}

          {monthEvents.length > 0 && dayEvents.length === 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Outros eventos em {format(month, "MMMM", { locale: ptBR })}</p>
              {monthEvents.slice(0, 8).map(ev => {
                const type = getEventType(ev.event_type);
                return (
                  <div key={ev.id} className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-secondary/30 rounded px-2 -mx-2" onClick={() => setSelectedDate(new Date(ev.event_date))}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{type.icon}</span>
                      <span className="text-xs">{ev.title}</span>
                      {ev.google_event_id && <Link2 className="h-2 w-2 text-blue-400" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(ev.event_date), "dd/MM")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-secondary" placeholder="Nome do evento..." />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="datetime-local" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} className="bg-secondary text-xs" />
              </div>
              <div>
                <Label className="text-xs">Fim (opcional)</Label>
                <Input type="datetime-local" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="bg-secondary text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary min-h-[60px]" placeholder="Detalhes..." />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.all_day} onCheckedChange={v => setForm(f => ({ ...f, all_day: v }))} />
                <Label className="text-xs">Dia inteiro</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.reminder} onCheckedChange={v => setForm(f => ({ ...f, reminder: v }))} />
                <Label className="text-xs">Lembrete</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEvent}>{editingEvent ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
