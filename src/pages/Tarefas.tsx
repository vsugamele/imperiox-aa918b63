import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/FileUpload";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays, AlertTriangle, Clock, Plus, CheckCircle2,
  Flame, ListTodo, Trash2, User, FileDown, FileSpreadsheet,
  RotateCcw, Users, UserCircle, MoreVertical, Pencil, ArrowRightLeft, CalendarIcon,
  BookOpen, GripVertical, MessageSquare, Kanban, ChevronDown, ChevronUp
} from "lucide-react";
import { EditorialHeader } from "@/components/dashboard/cockpit/EditorialHeader";
import { ProjectSellingGrid } from "@/components/dashboard/cockpit/ProjectSellingGrid";
import { DecisionQueue } from "@/components/dashboard/cockpit/DecisionQueue";
import { BlendedFunnelStrip } from "@/components/dashboard/cockpit/BlendedFunnelStrip";
import { OperationsFooter } from "@/components/dashboard/cockpit/OperationsFooter";
import Chat from "./Chat";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CardDetailPanel from "@/components/kanban/CardDetailPanel";
import { motion, AnimatePresence } from "framer-motion";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toLocalDateStr } from "@/lib/periodUtils";

const KanbanPage = lazy(() => import("./KanbanPage"));
const KanbanLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const safeFmt = (v?: string | null, mask = "dd/MM/yyyy") => {
  if (!v) return "—";
  const d = parseISO(v);
  return isValid(d) ? format(d, mask) : "—";
};
const toDateOnly = (v?: string | null) => (v ? v.slice(0, 10) : "");



interface KanbanCard {
  id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  tags: string[];
  board: string;
  project_id?: string;
  member_id?: string;
}

interface Column {
  id: string;
  title: string;
  board: string;
  position?: number;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string | null;
  role?: string | null;
}

interface Routine {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  category: string;
  member_id?: string | null;
  project_id?: string | null;
  icon: string;
  position: number;
  is_active: boolean;
  created_at: string;
  start_date?: string | null;
  recurrence?: string | null; // 'daily' | 'weekdays'
  weekdays?: number[] | null;
  time_of_day?: string | null;
}

interface RoutineCheck {
  id: string;
  routine_id: string;
  check_date: string;
  checked_by?: string;
  checked_at: string;
}

const DONE_TITLES = ["feito", "done", "concluído", "concluido"];
const FIRST_COL_TITLES = ["backlog", "a fazer", "to do", "todo"];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-destructive border-destructive",
  high: "text-warning border-warning",
  medium: "text-success border-success",
  low: "text-muted-foreground border-muted-foreground/40",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-destructive",
  high: "bg-warning",
  medium: "bg-success",
  low: "bg-muted-foreground/40",
};

const EMOJI_OPTIONS = ["✅", "📋", "📊", "📱", "💬", "📢", "🎯", "🚀", "💡", "📝", "🔍", "📦", "🎨", "💰", "📣", "🤝", "⚡", "🔔", "📌", "🏷️"];

const isDoneColumn = (col: Column) => DONE_TITLES.includes(col.title.toLowerCase().trim());
const isFirstColumn = (col: Column) => FIRST_COL_TITLES.includes(col.title.toLowerCase().trim());

export default function Tarefas() {
  const [params, setParams] = useSearchParams();
  const viewParam = params.get("view");
  const { user } = useAuth();
  const [cockpitOpen, setCockpitOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("cockpit.open");
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try { localStorage.setItem("cockpit.open", cockpitOpen ? "1" : "0"); } catch {}
  }, [cockpitOpen]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newProjectId, setNewProjectId] = useState("none");
  const [newMemberId, setNewMemberId] = useState("none");
  const [filterProject, setFilterProject] = useState("all");
  const [filterMember, setFilterMember] = useState("all");
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", description: "", priority: "medium", project_id: "none", member_id: "none", board: "agentes", due_date: "" });

  // Next step state
  const [showNextStepDialog, setShowNextStepDialog] = useState(false);
  const [nextStepCard, setNextStepCard] = useState<KanbanCard | null>(null);
  const [nextStepForm, setNextStepForm] = useState({ title: "", member_id: "none", observation: "" });

  // Routines state
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [checks, setChecks] = useState<RoutineCheck[]>([]);
  const [showRoutineDialog, setShowRoutineDialog] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [routineForm, setRoutineForm] = useState({ title: "", description: "", icon: "✅", category: "team", member_id: "none", project_id: "none", start_date: "", recurrence: "daily", weekdays: [] as number[], time_of_day: "" });

  // Calendar state
  const [calEvents, setCalEvents] = useState<any[]>([]);
  const [calDate, setCalDate] = useState<Date | undefined>(new Date());
  const [calFilterProject, setCalFilterProject] = useState("all");
  const [calFilterType, setCalFilterType] = useState("all");
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", event_date: "", event_type: "general", color: "#6366f1", description: "", project_id: "none" });

  // Process state
  interface Process { id: string; title: string; description?: string; steps: any[]; member_id?: string; project_id?: string; category: string; is_active: boolean; created_at: string; }
  const [processes, setProcesses] = useState<Process[]>([]);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [processForm, setProcessForm] = useState({ title: "", description: "", steps: [] as { text: string; done: boolean }[], category: "geral", member_id: "none", project_id: "none", horario: "", referencias: [] as { tipo: "imagem" | "link"; url: string; label?: string }[] });
  const [processFilterMember, setProcessFilterMember] = useState("all");
  const [processFilterCategory, setProcessFilterCategory] = useState("all");
  const PROCESS_CATEGORIES = ["geral", "tráfego", "conteúdo", "atendimento", "financeiro", "vendas", "operações"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);

  const fetchData = useCallback(async () => {
    // Check if admin
    let userIsAdmin = false;
    if (user) {
      const { data: memberData } = await supabase.from("imphq_team_members").select("role").eq("user_id", user.id).maybeSingle();
      const r = (memberData?.role || "").toLowerCase();
      userIsAdmin = r === "admin" || r === "owner";
    }

    const cardQuery = userIsAdmin
      ? supabase.from("imphq_kanban_cards").select("*").order("due_date", { ascending: true })
      : supabase.from("imphq_kanban_cards").select("*").order("due_date", { ascending: true });

    const [colRes, cardRes, projRes, memberRes, routineRes, checksRes] = await Promise.all([
      supabase.from("imphq_kanban_columns").select("id, title, board, position").order("position", { ascending: true }),
      cardQuery,
      supabase.from("imphq_projects").select("id, name"),
      supabase.from("imphq_team_members").select("id, name, avatar_url, role").eq("is_active", true),
      supabase.from("imphq_daily_routines").select("*").eq("is_active", true).order("position", { ascending: true }),
      supabase.from("imphq_routine_checks").select("*").eq("check_date", todayStr),
    ]);
    setColumns((colRes.data as any[]) || []);
    setCards((cardRes.data as any[]) || []);
    setProjects((projRes.data as any[]) || []);
    setMembers((memberRes.data as any[]) || []);
    setRoutines((routineRes.data as any[]) || []);
    setChecks((checksRes.data as any[]) || []);
    // Fetch processes
    const { data: procData } = await supabase.from("imphq_processes").select("*").eq("is_active", true).order("position", { ascending: true });
    setProcesses((procData as any[]) || []);
    setLoading(false);
  }, [todayStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calendar data
  const fetchCalEvents = useCallback(async () => {
    const { data } = await supabase.from("imphq_calendar_events").select("*, imphq_projects(name, icon)").order("event_date", { ascending: true });
    setCalEvents((data as any[]) || []);
  }, []);
  useEffect(() => { fetchCalEvents(); }, [fetchCalEvents]);

  const EVENT_TYPES = ["general", "launch", "live", "deadline", "meeting", "content"];
  const EVENT_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
    general: { label: "Geral", emoji: "📌" },
    launch: { label: "Lançamento", emoji: "🚀" },
    live: { label: "Live", emoji: "🎥" },
    deadline: { label: "Deadline", emoji: "⏰" },
    meeting: { label: "Reunião", emoji: "🤝" },
    content: { label: "Conteúdo", emoji: "📝" },
  };

  const selectedDateStr = calDate ? format(calDate, "yyyy-MM-dd") : "";
  const filteredCalEvents = calEvents.filter(e => {
    if (calFilterProject !== "all" && e.project_id !== calFilterProject) return false;
    if (calFilterType !== "all" && e.event_type !== calFilterType) return false;
    return true;
  });
  const eventsOnDate = filteredCalEvents.filter(e => toDateOnly(e.event_date) === selectedDateStr);
  const eventDates = new Set(filteredCalEvents.map(e => toDateOnly(e.event_date)));

  const createCalEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.event_date) { toast.error("Título e data são obrigatórios"); return; }
    if (!user) return;
    const { error } = await supabase.from("imphq_calendar_events").insert({
      title: eventForm.title.trim(),
      event_date: eventForm.event_date,
      event_type: eventForm.event_type,
      color: eventForm.color,
      description: eventForm.description,
      project_id: eventForm.project_id !== "none" ? eventForm.project_id : null,
      user_id: user.id,
    } as any);
    if (error) { toast.error("Erro ao criar evento"); return; }
    toast.success("Evento criado!");
    setShowEventDialog(false);
    setEventForm({ title: "", event_date: "", event_type: "general", color: "#6366f1", description: "", project_id: "none" });
    fetchCalEvents();
  };

  // === ROUTINES LOGIC ===
  const teamRoutines = routines.filter(r => r.category === "team");
  const personalRoutines = routines.filter(r => r.category === "personal");
  const totalRoutines = routines.length;
  const checkedRoutineIds = new Set(checks.map(c => c.routine_id));
  const completedCount = routines.filter(r => checkedRoutineIds.has(r.id)).length;
  const progressPercent = totalRoutines > 0 ? Math.round((completedCount / totalRoutines) * 100) : 0;

  const toggleRoutineCheck = async (routineId: string) => {
    if (!user) return;
    const isChecked = checkedRoutineIds.has(routineId);
    if (isChecked) {
      const check = checks.find(c => c.routine_id === routineId);
      if (check) {
        await supabase.from("imphq_routine_checks").delete().eq("id", check.id);
        setChecks(prev => prev.filter(c => c.id !== check.id));
      }
    } else {
      const { data, error } = await supabase.from("imphq_routine_checks").insert({
        routine_id: routineId,
        check_date: todayStr,
        checked_by: user.id,
      } as any).select().single();
      if (!error && data) {
        setChecks(prev => [...prev, data as any]);
      }
    }
  };

  const saveRoutine = async () => {
    if (!user || !routineForm.title.trim()) return;
    const desc = routineForm.description.trim() || null;
    const scheduleFields = {
      start_date: routineForm.start_date || null,
      recurrence: routineForm.recurrence || "daily",
      weekdays: routineForm.recurrence === "weekdays" ? routineForm.weekdays : [],
      time_of_day: routineForm.time_of_day || null,
    };
    if (editingRoutine) {
      const { error } = await supabase.from("imphq_daily_routines").update({
        title: routineForm.title.trim(),
        description: desc,
        icon: routineForm.icon,
        category: routineForm.category,
        member_id: routineForm.member_id !== "none" ? routineForm.member_id : null,
        project_id: routineForm.project_id !== "none" ? routineForm.project_id : null,
        ...scheduleFields,
      } as any).eq("id", editingRoutine.id);
      if (!error) {
        setRoutines(prev => prev.map(r => r.id === editingRoutine.id ? {
          ...r, title: routineForm.title.trim(), description: desc, icon: routineForm.icon, category: routineForm.category,
          member_id: routineForm.member_id !== "none" ? routineForm.member_id : null,
          project_id: routineForm.project_id !== "none" ? routineForm.project_id : null,
          ...scheduleFields,
        } : r));
        toast.success("Rotina atualizada");
      }
    } else {
      const { data, error } = await supabase.from("imphq_daily_routines").insert({
        user_id: user.id,
        title: routineForm.title.trim(),
        description: desc,
        icon: routineForm.icon,
        category: routineForm.category,
        member_id: routineForm.member_id !== "none" ? routineForm.member_id : null,
        project_id: routineForm.project_id !== "none" ? routineForm.project_id : null,
        position: routines.length,
        ...scheduleFields,
      } as any).select().single();
      if (!error && data) {
        setRoutines(prev => [...prev, data as any]);
        toast.success("Rotina criada! ✅");
      }
    }
    setShowRoutineDialog(false);
    setEditingRoutine(null);
    setRoutineForm({ title: "", description: "", icon: "✅", category: "team", member_id: "none", project_id: "none", start_date: "", recurrence: "daily", weekdays: [], time_of_day: "" });
  };

  const deleteRoutine = async (id: string) => {
    await supabase.from("imphq_daily_routines").delete().eq("id", id);
    setRoutines(prev => prev.filter(r => r.id !== id));
    toast.success("Rotina excluída");
  };

  const toggleCategory = async (routine: Routine) => {
    const newCat = routine.category === "team" ? "personal" : "team";
    await supabase.from("imphq_daily_routines").update({ category: newCat } as any).eq("id", routine.id);
    setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, category: newCat } : r));
    toast.success(`Movida para ${newCat === "team" ? "Time" : "Pessoal"}`);
  };

  const openEditRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setRoutineForm({
      title: routine.title,
      description: routine.description || "",
      icon: routine.icon,
      category: routine.category,
      member_id: routine.member_id || "none",
      project_id: routine.project_id || "none",
      start_date: routine.start_date || "",
      recurrence: routine.recurrence || "daily",
      weekdays: routine.weekdays || [],
      time_of_day: routine.time_of_day || "",
    });
    setShowRoutineDialog(true);
  };

  const openNewRoutine = (category: string = "team", projectId?: string) => {
    setEditingRoutine(null);
    setRoutineForm({ title: "", description: "", icon: "✅", category, member_id: "none", project_id: projectId || "none", start_date: "", recurrence: "daily", weekdays: [], time_of_day: "" });
    setShowRoutineDialog(true);
  };

  // Projeta rotinas no calendário: só rotinas com start_date aparecem
  const routineOccursOn = (r: Routine, date: Date): boolean => {
    if (!r.is_active || !r.start_date) return false;
    const start = parseISO(r.start_date);
    const d0 = new Date(date); d0.setHours(0, 0, 0, 0);
    const s0 = new Date(start); s0.setHours(0, 0, 0, 0);
    if (d0 < s0) return false;
    if (r.recurrence === "weekdays") {
      const wds = r.weekdays || [];
      return wds.length > 0 && wds.includes(d0.getDay());
    }
    return true; // daily (default)
  };


  // === PROCESSES LOGIC ===
  const filteredProcesses = processes.filter(p => {
    if (processFilterMember !== "all" && p.member_id !== processFilterMember) return false;
    if (processFilterCategory !== "all" && p.category !== processFilterCategory) return false;
    return true;
  });

  const saveProcess = async () => {
    if (!user || !processForm.title.trim()) { toast.error("Título obrigatório"); return; }
    const payload = {
      title: processForm.title.trim(),
      description: processForm.description || null,
      steps: processForm.steps,
      category: processForm.category,
      member_id: processForm.member_id !== "none" ? processForm.member_id : null,
      project_id: processForm.project_id !== "none" ? processForm.project_id : null,
      horario: processForm.horario || null,
      referencias: processForm.referencias.length > 0 ? processForm.referencias : null,
    } as any;

    if (editingProcess) {
      const { error } = await supabase.from("imphq_processes").update(payload).eq("id", editingProcess.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      setProcesses(prev => prev.map(p => p.id === editingProcess.id ? { ...p, ...payload } : p));
      toast.success("Processo atualizado!");
    } else {
      payload.user_id = user.id;
      payload.position = processes.length;
      const { data, error } = await supabase.from("imphq_processes").insert(payload).select().single();
      if (error) { toast.error("Erro: " + error.message); return; }
      setProcesses(prev => [...prev, data as any]);
      toast.success("Processo criado!");
    }
    setShowProcessDialog(false);
    setEditingProcess(null);
    setProcessForm({ title: "", description: "", steps: [], category: "geral", member_id: "none", project_id: "none", horario: "", referencias: [] });
  };

  const deleteProcess = async (id: string) => {
    await supabase.from("imphq_processes").delete().eq("id", id);
    setProcesses(prev => prev.filter(p => p.id !== id));
    toast.success("Processo excluído");
  };

  const openEditProcess = (proc: Process) => {
    setEditingProcess(proc);
    const procData = proc as any;
    setProcessForm({
      title: proc.title, description: proc.description || "",
      steps: Array.isArray(proc.steps) ? proc.steps : [],
      category: proc.category, member_id: proc.member_id || "none", project_id: proc.project_id || "none",
      horario: procData.horario || "", referencias: Array.isArray(procData.referencias) ? procData.referencias : [],
    });
    setShowProcessDialog(true);
  };

  const addProcessStep = () => setProcessForm(f => ({ ...f, steps: [...f.steps, { text: "", done: false }] }));
  const removeProcessStep = (i: number) => setProcessForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  const updateProcessStep = (i: number, text: string) => setProcessForm(f => ({ ...f, steps: f.steps.map((s, idx) => idx === i ? { ...s, text } : s) }));

  const toggleProcessStepDone = async (proc: Process, stepIndex: number) => {
    const steps = Array.isArray(proc.steps) ? [...proc.steps] : [];
    steps[stepIndex] = { ...steps[stepIndex], done: !steps[stepIndex].done };
    await supabase.from("imphq_processes").update({ steps } as any).eq("id", proc.id);
    setProcesses(prev => prev.map(p => p.id === proc.id ? { ...p, steps } : p));
  };

  // === TASKS LOGIC (existing) ===
  const doneColumnIds = columns.filter(isDoneColumn).map(c => c.id);
  const isDone = (card: KanbanCard) => doneColumnIds.includes(card.column_id);

  const filtered = cards.filter(c => {
    if (filterProject !== "all" && c.project_id !== filterProject) return false;
    if (filterMember !== "all" && c.member_id !== filterMember) return false;
    return true;
  });

  const overdue = filtered.filter(c => !isDone(c) && c.due_date && c.due_date < todayStr);
  const todayCards = filtered.filter(c => !isDone(c) && c.due_date === todayStr);
  const upcoming = filtered.filter(c => {
    if (isDone(c) || !c.due_date) return false;
    const d = new Date(c.due_date);
    const diff = d.getTime() - today.getTime();
    return diff > 0 && diff <= 3 * 86400000;
  });
  const noDueDate = filtered.filter(c => !isDone(c) && !c.due_date);
  const doneRecent = filtered.filter(c => isDone(c)).slice(0, 10);

  const findFirstColumn = (board: string) => {
    return columns.find(c => c.board === board && isFirstColumn(c))
      || columns.filter(c => c.board === board && !isDoneColumn(c)).sort((a, b) => (a.position || 0) - (b.position || 0))[0];
  };

  const findDoneColumn = (board: string) => {
    return columns.find(c => c.board === board && isDoneColumn(c));
  };

  const toggleDone = async (card: KanbanCard) => {
    const done = isDone(card);
    if (done) {
      const firstCol = findFirstColumn(card.board);
      if (!firstCol) { toast.error("Coluna inicial não encontrada"); return; }
      const { error } = await supabase.from("imphq_kanban_cards").update({ column_id: firstCol.id } as any).eq("id", card.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, column_id: firstCol.id } : c));
    } else {
      const doneCol = findDoneColumn(card.board);
      if (!doneCol) { toast.error("Coluna 'Concluído' não encontrada neste board"); return; }
      const { error } = await supabase.from("imphq_kanban_cards").update({ column_id: doneCol.id } as any).eq("id", card.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, column_id: doneCol.id } : c));
      toast.success("Tarefa concluída! ✅");
      // Open next step dialog
      setNextStepCard(card);
      setShowNextStepDialog(true);
    }
  };

  const deleteTask = async (cardId: string) => {
    const { error } = await supabase.from("imphq_kanban_cards").delete().eq("id", cardId);
    if (error) { toast.error("Erro ao excluir"); return; }
    setCards(prev => prev.filter(c => c.id !== cardId));
    toast.success("Tarefa excluída");
  };

  const addQuickTask = async () => {
    if (!newTask.trim()) return;
    // Use filtered board or fallback to "agentes"
    const targetBoard = newProjectId !== "none" ? "agentes" : "agentes";
    const targetCol = findFirstColumn(targetBoard) || columns.find(c => !isDoneColumn(c));
    if (!targetCol) { toast.error("Nenhuma coluna disponível"); return; }
    const { data, error } = await supabase
      .from("imphq_kanban_cards")
      .insert({
        title: newTask.trim(),
        column_id: targetCol.id,
        board: targetCol.board,
        priority: newPriority,
        due_date: todayStr,
        tags: [],
        project_id: newProjectId !== "none" ? newProjectId : null,
        member_id: newMemberId !== "none" ? newMemberId : null,
      } as any)
      .select()
      .single();
    if (error) { toast.error("Erro ao criar tarefa"); return; }
    setCards(prev => [...prev, data as any]);
    // Notificação instantânea
    if (data && user) {
      const otherUsers = (await supabase.from("imphq_team_members").select("user_id").not("user_id", "is", null)).data || [];
      for (const m of otherUsers) {
        if (m.user_id && m.user_id !== user.id) {
          await supabase.from("imphq_notifications").insert({
            user_id: m.user_id, title: `📝 Nova tarefa: ${newTask.trim()}`,
            type: "tarefa", entity_type: "card", entity_id: (data as any).id,
          });
        }
      }
    }
    setNewTask("");
    toast.success("Tarefa adicionada ✅");
  };

  const createFullTask = async () => {
    if (!createForm.title.trim()) { toast.error("Título obrigatório"); return; }
    const targetCol = findFirstColumn(createForm.board) || columns.find(c => c.board === createForm.board && !isDoneColumn(c));
    if (!targetCol) { toast.error("Nenhuma coluna disponível para este board"); return; }
    const { data, error } = await supabase
      .from("imphq_kanban_cards")
      .insert({
        title: createForm.title.trim(),
        description: createForm.description || null,
        column_id: targetCol.id,
        board: createForm.board,
        priority: createForm.priority,
        due_date: createForm.due_date || null,
        tags: [],
        project_id: createForm.project_id !== "none" ? createForm.project_id : null,
        member_id: createForm.member_id !== "none" ? createForm.member_id : null,
      } as any)
      .select()
      .single();
    if (error) { toast.error("Erro ao criar tarefa"); return; }
    setCards(prev => [...prev, data as any]);
    // Notificação instantânea
    if (data && user) {
      const otherUsers = (await supabase.from("imphq_team_members").select("user_id").not("user_id", "is", null)).data || [];
      for (const m of otherUsers) {
        if (m.user_id && m.user_id !== user.id) {
          await supabase.from("imphq_notifications").insert({
            user_id: m.user_id, title: `📝 Nova tarefa: ${createForm.title.trim()}`,
            message: createForm.description || null,
            type: "tarefa", entity_type: "card", entity_id: (data as any).id,
          });
        }
      }
    }
    setShowCreateDialog(false);
    setCreateForm({ title: "", description: "", priority: "medium", project_id: "none", member_id: "none", board: "agentes", due_date: "" });
    toast.success("Tarefa criada! ✅");
  };

  const getProjectName = (id?: string | null) => {
    if (!id) return null;
    return projects.find(p => p.id === id)?.name;
  };

  const getMember = (id?: string | null) => {
    if (!id) return null;
    return members.find(m => m.id === id);
  };

  const getColumnName = (colId: string) => {
    return columns.find(c => c.id === colId)?.title || "—";
  };

  const totalDone = filtered.filter(c => isDone(c)).length;

  // === ROUTINE CARD COMPONENT ===
  const RoutineCard = ({ routine }: { routine: Routine }) => {
    const isChecked = checkedRoutineIds.has(routine.id);
    const member = getMember(routine.member_id);
    const projName = getProjectName(routine.project_id);
    const isTeam = routine.category === "team";

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all group cursor-pointer ${
          isChecked
            ? "border-success/30 bg-success/5 opacity-70"
            : isTeam
              ? "border-primary/20 bg-primary/5 hover:border-primary/40"
              : "border-accent/30 bg-accent/5 hover:border-accent/50"
        }`}
      >
        <span className="text-2xl shrink-0">{routine.icon}</span>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium block ${isChecked ? "line-through text-muted-foreground" : ""}`}>
            {routine.title}
          </span>
          {routine.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug" title={routine.description}>
              {routine.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {projName && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{projName}</Badge>}
            {member && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <User className="h-2.5 w-2.5" /> {member.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {member && (
            <Avatar className="h-6 w-6 shrink-0" title={member.name}>
              <AvatarImage src={member.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-secondary">{member.name[0]}</AvatarFallback>
            </Avatar>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary">
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditRoutine(routine)}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleCategory(routine)}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Mover para {isTeam ? "Pessoal" : "Time"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteRoutine(routine.id)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => toggleRoutineCheck(routine.id)}
            className="h-5 w-5"
          />
        </div>
      </motion.div>
    );
  };

  // === TASK ITEM COMPONENT ===
  const TaskItem = ({ card }: { card: KanbanCard }) => {
    const done = isDone(card);
    const projName = getProjectName(card.project_id);
    const member = getMember(card.member_id);
    const colName = getColumnName(card.column_id);
    return (
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-accent/5 group cursor-pointer ${done ? "opacity-60" : ""}`}
        onClick={() => setSelectedCard(card)}
      >
        <div onClick={e => e.stopPropagation()}>
          <Checkbox checked={done} onCheckedChange={() => toggleDone(card)} className="mt-0.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[card.priority || "low"]}`} />
            <span className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{card.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {projName && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{projName}</Badge>}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[card.priority || "low"]}`}>
              {card.priority || "normal"}
            </Badge>
            {!done && <span className="text-[10px] text-muted-foreground">📋 {colName}</span>}
            {card.due_date && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date(card.due_date).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
        {member && (
          <Avatar className="h-6 w-6 shrink-0" title={member.name}>
            <AvatarImage src={member.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-secondary">{member.name[0]}</AvatarFallback>
          </Avatar>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); deleteTask(card.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const Section = ({ title, icon, cards: sectionCards, color, emptyMsg }: {
    title: string; icon: React.ReactNode; cards: KanbanCard[]; color: string; emptyMsg: string;
  }) => (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          <span className={color}>{title}</span>
          <Badge variant="secondary" className="ml-auto text-xs">{sectionCards.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {sectionCards.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyMsg}</p>
        ) : (
          sectionCards.map(c => <TaskItem key={c.id} card={c} />)
        )}
      </CardContent>
    </Card>
  );

  if (loading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* ═══ COCKPIT DA EMPRESA ═══ */}
      <section className="border border-border/60 rounded-lg bg-background/40 backdrop-blur-sm">
        <button
          onClick={() => setCockpitOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.32em] uppercase text-gold/80 font-medium">
              Cockpit da Empresa
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {cockpitOpen ? "recolher" : "expandir"}
            </span>
          </div>
          {cockpitOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {cockpitOpen && (
          <div className="px-4 pb-4 pt-2 space-y-6 animate-fade-in">
            <EditorialHeader />
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
              <div className="space-y-6 min-w-0">
                <ProjectSellingGrid />
                <BlendedFunnelStrip />
              </div>
              <div className="xl:sticky xl:top-16 xl:self-start xl:max-h-[calc(100vh-5rem)]">
                <DecisionQueue />
              </div>
            </div>
            <OperationsFooter />
          </div>
        )}
      </section>

      {/* ═══ FOCO DO DIA — Tarefas ═══ */}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <CalendarDays className="h-7 w-7" /> Meu Dia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar Tarefa
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <FileDown className="h-3 w-3 mr-1" /> Exportar
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
              const doc = new jsPDF();
              const dateStr = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
              doc.setFontSize(18);
              doc.text("Tarefas — Imperio HQ", 14, 18);
              doc.setFontSize(10);
              doc.setTextColor(100);
              doc.text(dateStr, 14, 25);
              doc.setTextColor(0);
              const buildRows = (list: KanbanCard[]) =>
                list.map(c => [c.title, getProjectName(c.project_id) || "—", getMember(c.member_id)?.name || "—", c.priority || "—", c.due_date ? new Date(c.due_date).toLocaleDateString("pt-BR") : "—", getColumnName(c.column_id)]);
              const head = [["Tarefa", "Projeto", "Responsável", "Prioridade", "Prazo", "Status"]];
              let startY = 32;
              const addSection = (title: string, rows: string[][]) => {
                if (rows.length === 0) return;
                doc.setFontSize(12); doc.setTextColor(60); doc.text(title, 14, startY); startY += 2;
                autoTable(doc, { head, body: rows, startY, theme: "grid", headStyles: { fillColor: [30, 30, 30], fontSize: 8 }, bodyStyles: { fontSize: 8 }, margin: { left: 14, right: 14 } });
                startY = (doc as any).lastAutoTable.finalY + 8;
              };
              addSection(`⚠️ Atrasadas (${overdue.length})`, buildRows(overdue));
              addSection(`🔥 Hoje (${todayCards.length})`, buildRows(todayCards));
              addSection(`⏳ Próximos 3 dias (${upcoming.length})`, buildRows(upcoming));
              addSection(`📋 Sem prazo (${noDueDate.length})`, buildRows(noDueDate));
              doc.save(`tarefas_${todayStr}.pdf`);
              toast.success("PDF exportado!");
            }}>
              <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const rows = filtered.filter(c => !isDone(c)).map(c =>
                [c.title, getProjectName(c.project_id) || "", getMember(c.member_id)?.name || "", c.priority || "", c.due_date || "", getColumnName(c.column_id), c.board].join(";")
              );
              const csv = ["Tarefa;Projeto;Responsável;Prioridade;Prazo;Status;Board", ...rows].join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `tarefas_${todayStr}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success("CSV exportado!");
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue={viewParam === "kanban" ? "kanban" : "calendar"}
        onValueChange={(v) => setParams(v === "kanban" ? { view: "kanban" } : {}, { replace: true })}
        className="w-full"
      >
        <TabsList className="w-full justify-start bg-secondary/50">
          <TabsTrigger value="routines" className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Rotinas do Dia
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{completedCount}/{totalRoutines}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ListTodo className="h-3.5 w-3.5" /> Lista
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{filtered.filter(c => !isDone(c)).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1.5">
            <Kanban className="h-3.5 w-3.5" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" /> Calendário
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{calEvents.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="processes" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Processos
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{processes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </TabsTrigger>
        </TabsList>

        {/* ====== KANBAN TAB ====== */}
        <TabsContent value="kanban" className="mt-4">
          <Suspense fallback={<KanbanLoader />}>
            <KanbanPage />
          </Suspense>
        </TabsContent>

        {/* ====== CHAT TAB ====== */}
        <TabsContent value="chat" className="mt-4">
          <div className="h-[calc(100vh-14rem)] min-h-[500px] overflow-hidden rounded-lg border border-border [&>div]:!h-full">
            <Chat />
          </div>
        </TabsContent>

        {/* ====== ROUTINES TAB ====== */}
        <TabsContent value="routines" className="space-y-6 mt-4">
          {/* Progress header */}
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">Progresso do Dia</span>
                </div>
                <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1.5">
                {completedCount} de {totalRoutines} rotinas concluídas hoje
              </p>
            </CardContent>
          </Card>

          {/* Kanban por projeto */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Kanban className="h-4 w-4" /> Rotinas por Projeto
                <Badge variant="outline" className="text-[10px]">{projects.length}</Badge>
              </h3>
              <Button size="sm" variant="outline" onClick={() => openNewRoutine("team")} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Nova Rotina
              </Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
              {[...projects.map(p => ({ id: p.id, name: p.name })), { id: "__none__", name: "Sem projeto" }].map(proj => {
                const projRoutines = routines.filter(r =>
                  proj.id === "__none__" ? !r.project_id : r.project_id === proj.id
                );
                if (projRoutines.length === 0 && proj.id === "__none__") return null;
                const doneInCol = projRoutines.filter(r => checkedRoutineIds.has(r.id)).length;
                return (
                  <div key={proj.id} className="shrink-0 w-72 bg-secondary/30 border border-border/40 rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold truncate flex-1">{proj.name}</div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{doneInCol}/{projRoutines.length}</Badge>
                      {proj.id !== "__none__" && (
                        <button
                          onClick={() => openNewRoutine("team", proj.id)}
                          title={`Nova rotina para ${proj.name}`}
                          className="shrink-0 h-6 w-6 rounded-md bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <AnimatePresence>
                        {projRoutines.map(r => <RoutineCard key={r.id} routine={r} />)}
                      </AnimatePresence>
                      {projRoutines.length === 0 && (
                        <button
                          onClick={() => openNewRoutine("team", proj.id)}
                          className="text-[11px] text-muted-foreground border border-dashed border-border/40 rounded p-3 hover:bg-secondary/40 transition"
                        >
                          + Adicionar rotina para {proj.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team routines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" /> Rotinas do Time
                <Badge variant="outline" className="text-[10px]">{teamRoutines.length}</Badge>
              </h3>
              <Button size="sm" variant="outline" onClick={() => openNewRoutine("team")} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Nova Rotina
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <AnimatePresence>
                {teamRoutines.map(r => <RoutineCard key={r.id} routine={r} />)}
              </AnimatePresence>
            </div>
            {teamRoutines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma rotina de time criada. Clique em "Nova Rotina" para começar!
              </p>
            )}
          </div>

          {/* Personal routines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-accent-foreground">
                <UserCircle className="h-4 w-4" /> Minhas Rotinas
                <Badge variant="outline" className="text-[10px]">{personalRoutines.length}</Badge>
              </h3>
              <Button size="sm" variant="outline" onClick={() => openNewRoutine("personal")} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Nova Rotina
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <AnimatePresence>
                {personalRoutines.map(r => <RoutineCard key={r.id} routine={r} />)}
              </AnimatePresence>
            </div>
            {personalRoutines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma rotina pessoal. Adicione atividades que só você precisa fazer!
              </p>
            )}
          </div>
        </TabsContent>

        {/* ====== TASKS TAB ====== */}
        <TabsContent value="tasks" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-40 bg-secondary h-9"><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Projetos</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMember} onValueChange={setFilterMember}>
              <SelectTrigger className="w-40 bg-secondary h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-destructive/30">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <div><div className="text-lg font-bold text-destructive">{overdue.length}</div><div className="text-[10px] text-muted-foreground">Atrasadas</div></div>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="p-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                <div><div className="text-lg font-bold text-primary">{todayCards.length}</div><div className="text-[10px] text-muted-foreground">Hoje</div></div>
              </CardContent>
            </Card>
            <Card className="border-warning/30">
              <CardContent className="p-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <div><div className="text-lg font-bold text-warning">{upcoming.length}</div><div className="text-[10px] text-muted-foreground">Próximos 3 dias</div></div>
              </CardContent>
            </Card>
            <Card className="border-success/30">
              <CardContent className="p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <div><div className="text-lg font-bold text-success">{totalDone}</div><div className="text-[10px] text-muted-foreground">Concluídas</div></div>
              </CardContent>
            </Card>
          </div>

          {/* Quick add */}
          <div className="flex gap-2 flex-wrap">
            <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Adicionar tarefa rápida..." className="bg-secondary flex-1 min-w-[200px]" onKeyDown={e => e.key === "Enter" && addQuickTask()} />
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="w-28 bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">🔴 Urgente</SelectItem>
                <SelectItem value="high">🟡 Alta</SelectItem>
                <SelectItem value="medium">🟢 Média</SelectItem>
                <SelectItem value="low">⚪ Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newProjectId} onValueChange={setNewProjectId}>
              <SelectTrigger className="w-36 bg-secondary"><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem projeto</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newMemberId} onValueChange={setNewMemberId}>
              <SelectTrigger className="w-36 bg-secondary"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={addQuickTask} size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Task sections */}
          <div className="space-y-4">
            {overdue.length > 0 && <Section title="Atrasadas" icon={<AlertTriangle className="h-4 w-4 text-destructive" />} cards={overdue} color="text-destructive" emptyMsg="" />}
            <Section title="Hoje" icon={<Flame className="h-4 w-4 text-primary" />} cards={todayCards} color="text-primary" emptyMsg="Nenhuma tarefa para hoje 🎉" />
            <Section title="Próximos 3 dias" icon={<Clock className="h-4 w-4 text-warning" />} cards={upcoming} color="text-warning" emptyMsg="Sem tarefas nos próximos dias" />
            {noDueDate.length > 0 && <Section title="Sem prazo definido" icon={<ListTodo className="h-4 w-4 text-muted-foreground" />} cards={noDueDate} color="text-muted-foreground" emptyMsg="" />}
            {doneRecent.length > 0 && <Section title="Concluídas recentes" icon={<CheckCircle2 className="h-4 w-4 text-success" />} cards={doneRecent} color="text-success" emptyMsg="" />}
          </div>
        </TabsContent>

        {/* ====== CALENDAR TAB ====== */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={calFilterProject} onValueChange={setCalFilterProject}>
              <SelectTrigger className="w-40 bg-secondary h-9"><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Projetos</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={calFilterType} onValueChange={setCalFilterType}>
              <SelectTrigger className="w-36 bg-secondary h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]?.emoji} {EVENT_TYPE_LABELS[t]?.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => { setEventForm({ title: "", event_date: selectedDateStr || todayStr, event_type: "general", color: "#6366f1", description: "", project_id: "none" }); setShowEventDialog(true); }}>
              <Plus className="h-3 w-3 mr-1" /> Evento
            </Button>
          </div>

          {/* Full-width calendar */}
          <Card className="border-border">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={calDate}
                onSelect={setCalDate}
                locale={ptBR}
                className="w-full"
                classNames={{
                  months: "flex flex-col w-full",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-base font-semibold",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md flex-1 font-medium text-xs text-center py-2",
                  row: "flex w-full mt-1",
                  cell: "flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                  day: "w-full h-16 md:h-20 p-1 font-normal flex flex-col items-center justify-start rounded-md hover:bg-secondary/50 transition-colors aria-selected:opacity-100",
                  day_selected: "bg-primary/15 text-primary font-semibold ring-1 ring-primary",
                  day_today: "bg-accent text-accent-foreground font-bold",
                  day_outside: "text-muted-foreground opacity-40",
                  day_disabled: "text-muted-foreground opacity-30",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const dayEvents = filteredCalEvents.filter(e => toDateOnly(e.event_date) === dateStr);
                    const dayTasks = cards.filter(c => toDateOnly(c.due_date) === dateStr && !doneColumnIds.includes(c.column_id));
                    const dayRoutines = routines.filter(r => routineOccursOn(r, date));
                    return (
                      <div className="flex flex-col items-center gap-0.5 w-full">
                        <span className="text-sm">{date.getDate()}</span>
                        <div className="flex gap-0.5 flex-wrap justify-center max-w-full">
                          {dayEvents.slice(0, 3).map((ev: any, i: number) => {
                            const typeColors: Record<string, string> = {
                              launch: "bg-orange-500", live: "bg-red-500", deadline: "bg-amber-500",
                              meeting: "bg-blue-500", content: "bg-emerald-500", general: "bg-primary",
                            };
                            return <div key={i} className={`h-1.5 w-1.5 rounded-full ${typeColors[ev.event_type] || "bg-primary"}`} title={ev.title} />;
                          })}
                          {dayTasks.slice(0, 2).map((_, i) => (
                            <div key={`t${i}`} className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          ))}
                          {dayRoutines.slice(0, 2).map((r, i) => (
                            <div key={`r${i}`} className="h-1.5 w-1.5 rounded-full bg-violet-400" title={r.title} />
                          ))}
                        </div>
                        {(dayEvents.length + dayTasks.length + dayRoutines.length) > 0 && (
                          <span className="text-[9px] text-muted-foreground leading-none">
                            {dayEvents.length > 0 && `${dayEvents.length}ev`}
                            {dayTasks.length > 0 && ` ${dayTasks.length}t`}
                            {dayRoutines.length > 0 && ` ${dayRoutines.length}r`}
                          </span>
                        )}
                      </div>
                    );
                  },
                }}
              />
            </CardContent>
          </Card>

          {/* Day detail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Events on selected date */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  {calDate ? format(calDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : "Selecione uma data"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const dayCards = calDate ? cards.filter(c => toDateOnly(c.due_date) === selectedDateStr) : [];
                  const dayRoutines = calDate ? routines.filter(r => routineOccursOn(r, calDate)) : [];
                  if (eventsOnDate.length === 0 && dayCards.length === 0 && dayRoutines.length === 0) {
                    return <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento, tarefa ou rotina nesta data</p>;
                  }
                  return (
                    <>
                      {eventsOnDate.map((ev: any) => {
                        const typeInfo = EVENT_TYPE_LABELS[ev.event_type] || EVENT_TYPE_LABELS.general;
                        const proj = ev.imphq_projects;
                        return (
                          <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30">
                            <span className="text-lg">{typeInfo.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{ev.title}</p>
                              {ev.description && <p className="text-[10px] text-muted-foreground">{ev.description}</p>}
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="outline" className="text-[10px]">{typeInfo.label}</Badge>
                                {proj && <Badge variant="secondary" className="text-[10px]">{proj.icon || "📁"} {proj.name}</Badge>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {dayRoutines.map(r => {
                        const proj = projects.find(p => p.id === r.project_id);
                        return (
                          <div key={`r-${r.id}`} className="flex items-start gap-2 p-2 rounded-lg bg-violet-500/5 border border-violet-500/20 cursor-pointer hover:bg-violet-500/10" onClick={() => openEditRoutine(r)}>
                            <span className="text-lg">{r.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{r.title}</p>
                              {r.description && <p className="text-[10px] text-muted-foreground line-clamp-2">{r.description}</p>}
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-[10px] text-violet-400 border-violet-400/30">Rotina</Badge>
                                {r.time_of_day && <Badge variant="outline" className="text-[10px] font-mono">{r.time_of_day.slice(0,5)}</Badge>}
                                {r.recurrence === "weekdays" && <Badge variant="outline" className="text-[10px]">Dias úteis</Badge>}
                                {proj && <Badge variant="secondary" className="text-[10px]">{(proj as any).icon || "📁"} {proj.name}</Badge>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {dayCards.map(card => (
                        <div key={card.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 cursor-pointer hover:bg-amber-500/10" onClick={() => setSelectedCard(card)}>
                          <ListTodo className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{card.title}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[10px]">{card.priority}</Badge>
                              {doneColumnIds.includes(card.column_id) && <Badge className="text-[10px] bg-success/20 text-success">Concluída</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Upcoming events */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" /> Próximos Eventos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {filteredCalEvents.filter(e => toDateOnly(e.event_date) >= todayStr).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento futuro</p>
                ) : (
                  filteredCalEvents.filter(e => toDateOnly(e.event_date) >= todayStr).slice(0, 12).map((ev: any) => {
                    const typeInfo = EVENT_TYPE_LABELS[ev.event_type] || EVENT_TYPE_LABELS.general;
                    const proj = ev.imphq_projects;
                    return (
                      <div key={ev.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/30 rounded px-1" onClick={() => { setCalDate(parseISO(ev.event_date)); }}>
                        <span className="text-sm">{typeInfo.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{ev.title}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground">{safeFmt(ev.event_date, "dd/MM")}</span>
                            {proj && <span className="text-[10px] text-muted-foreground">{proj.icon || "📁"} {proj.name}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====== PROCESSES TAB ====== */}
        <TabsContent value="processes" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={processFilterMember} onValueChange={setProcessFilterMember}>
              <SelectTrigger className="w-[180px] bg-secondary/60 h-9 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={processFilterCategory} onValueChange={setProcessFilterCategory}>
              <SelectTrigger className="w-[160px] bg-secondary/60 h-9 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {PROCESS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button size="sm" onClick={() => { setEditingProcess(null); setProcessForm({ title: "", description: "", steps: [], category: "geral", member_id: "none", project_id: "none", horario: "", referencias: [] }); setShowProcessDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Processo
            </Button>
          </div>

          {/* Process List */}
          {filteredProcesses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum processo encontrado.</p>
              <p className="text-xs mt-1">Crie SOPs e rotinas para sua equipe.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProcesses.map(proc => {
                const steps = Array.isArray(proc.steps) ? proc.steps : [];
                const doneSteps = steps.filter((s: any) => s.done).length;
                const member = members.find(m => m.id === proc.member_id);
                const project = projects.find(p => p.id === proc.project_id);
                return (
                  <Card key={proc.id} className="border-border hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-semibold truncate">{proc.title}</CardTitle>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{proc.category}</Badge>
                            {(proc as any).horario && <Badge variant="secondary" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />{(proc as any).horario}</Badge>}
                            {member && <Badge variant="secondary" className="text-[10px]"><User className="h-2.5 w-2.5 mr-0.5" />{member.name}</Badge>}
                            {project && <Badge variant="secondary" className="text-[10px]">📁 {project.name}</Badge>}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditProcess(proc)}><Pencil className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteProcess(proc.id)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {proc.description && <p className="text-xs text-muted-foreground">{proc.description}</p>}
                      {steps.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Progress value={steps.length > 0 ? (doneSteps / steps.length) * 100 : 0} className="h-1.5 flex-1" />
                            <span>{doneSteps}/{steps.length}</span>
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {steps.map((step: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 py-0.5">
                                <Checkbox checked={step.done} onCheckedChange={() => toggleProcessStepDone(proc, idx)} className="h-3.5 w-3.5" />
                                <span className={`text-xs ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.text || `Etapa ${idx + 1}`}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {/* Referências thumbnails */}
                      {Array.isArray((proc as any).referencias) && (proc as any).referencias.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {(proc as any).referencias.map((ref: any, idx: number) => (
                            ref.tipo === "imagem" ? (
                              <img key={idx} src={ref.url} alt={ref.label || "ref"} className="h-10 w-10 rounded object-cover border border-border" />
                            ) : (
                              <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline truncate max-w-[120px]">{ref.label || ref.url}</a>
                            )
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Process Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProcess ? "Editar Processo" : "Novo Processo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={processForm.title} onChange={e => setProcessForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Rotina de Tráfego Diário" className="bg-secondary" /></div>
            <div><Label>Descrição</Label><Textarea value={processForm.description} onChange={e => setProcessForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o objetivo deste processo..." className="bg-secondary min-h-[60px]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={processForm.category} onValueChange={v => setProcessForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROCESS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Horário</Label>
                <Input type="time" value={processForm.horario} onChange={e => setProcessForm(f => ({ ...f, horario: e.target.value }))} className="bg-secondary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select value={processForm.member_id} onValueChange={v => setProcessForm(f => ({ ...f, member_id: v }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={processForm.project_id} onValueChange={v => setProcessForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Referências */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Referências (fotos / links)</Label>
              </div>
              <div className="space-y-2">
                {processForm.referencias.map((ref, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-secondary/30 rounded-md p-2">
                    {ref.tipo === "imagem" ? (
                      <img src={ref.url} alt="" className="h-10 w-10 rounded object-cover border border-border shrink-0" />
                    ) : (
                      <span className="text-primary text-xs truncate flex-1">🔗 {ref.label || ref.url}</span>
                    )}
                    {ref.tipo === "imagem" && <span className="text-xs text-muted-foreground truncate flex-1">{ref.label || "Imagem"}</span>}
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setProcessForm(f => ({ ...f, referencias: f.referencias.filter((_, i) => i !== idx) }))}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input placeholder="Cole URL de link ou referência..." className="bg-secondary h-8 text-xs flex-1"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const url = (e.target as HTMLInputElement).value.trim();
                      if (!url) return;
                      const isImg = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
                      setProcessForm(f => ({ ...f, referencias: [...f.referencias, { tipo: isImg ? "imagem" : "link", url, label: "" }] }));
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <FileUpload bucket="project-media" path="processos" accept="image/*" label="📷" multiple
                  onUpload={(url) => setProcessForm(f => ({ ...f, referencias: [...f.referencias, { tipo: "imagem", url }] }))}
                />
              </div>
            </div>
            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Etapas do Processo</Label>
                <Button size="sm" variant="outline" onClick={addProcessStep} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Etapa</Button>
              </div>
              <div className="space-y-2">
                {processForm.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                    <Input value={step.text} onChange={e => updateProcessStep(idx, e.target.value)} placeholder={`Etapa ${idx + 1}...`} className="bg-secondary h-8 text-xs" />
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeProcessStep(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
                {processForm.steps.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Adicione etapas para criar um checklist</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>Cancelar</Button>
            <Button onClick={saveProcess} disabled={!processForm.title.trim()}>{editingProcess ? "Salvar" : "Criar Processo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Live de lançamento" className="bg-secondary" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} className="bg-secondary" /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={eventForm.event_type} onValueChange={v => setEventForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]?.emoji} {EVENT_TYPE_LABELS[t]?.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={eventForm.project_id} onValueChange={v => setEventForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Input value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes..." className="bg-secondary" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDialog(false)}>Cancelar</Button>
            <Button onClick={createCalEvent}>Criar Evento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Routine Dialog */}
      <Dialog open={showRoutineDialog} onOpenChange={setShowRoutineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoutine ? "Editar Rotina" : "Nova Rotina"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Título</label>
              <Input value={routineForm.title} onChange={e => setRoutineForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Verificar Comunidade do Clube" onKeyDown={e => e.key === "Enter" && saveRoutine()} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <Textarea
                value={routineForm.description}
                onChange={e => setRoutineForm(f => ({ ...f, description: e.target.value }))}
                placeholder="O que precisa ser feito, critério de conclusão, links úteis..."
                className="bg-secondary min-h-[70px] text-sm leading-6"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Ícone</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map(emoji => (
                  <button key={emoji} onClick={() => setRoutineForm(f => ({ ...f, icon: emoji }))} className={`text-xl p-1.5 rounded-md transition-all ${routineForm.icon === emoji ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-secondary"}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <Select value={routineForm.category} onValueChange={v => setRoutineForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">👥 Time</SelectItem>
                  <SelectItem value="personal">👤 Pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Responsável</label>
                <Select value={routineForm.member_id} onValueChange={v => setRoutineForm(f => ({ ...f, member_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Projeto</label>
                <Select value={routineForm.project_id} onValueChange={v => setRoutineForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Agendamento / Recorrência */}
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">📅 Agendamento (opcional)</p>
              <p className="text-[11px] text-muted-foreground -mt-2">Defina uma data para projetar essa rotina no calendário. Sem data, ela só aparece na lista diária.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Data inicial</label>
                  <Input type="date" value={routineForm.start_date} onChange={e => setRoutineForm(f => ({ ...f, start_date: e.target.value }))} className="bg-secondary text-xs" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Horário</label>
                  <Input type="time" value={routineForm.time_of_day} onChange={e => setRoutineForm(f => ({ ...f, time_of_day: e.target.value }))} className="bg-secondary text-xs" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Recorrência</label>
                <Select value={routineForm.recurrence} onValueChange={v => setRoutineForm(f => ({ ...f, recurrence: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Todo dia</SelectItem>
                    <SelectItem value="weekdays">Dias da semana específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {routineForm.recurrence === "weekdays" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Dias</label>
                  <div className="flex gap-1 flex-wrap">
                    {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label, idx) => {
                      const active = routineForm.weekdays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRoutineForm(f => ({
                            ...f,
                            weekdays: active ? f.weekdays.filter(w => w !== idx) : [...f.weekdays, idx].sort(),
                          }))}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80 text-muted-foreground"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoutineDialog(false)}>Cancelar</Button>
            <Button onClick={saveRoutine} disabled={!routineForm.title.trim()}>
              {editingRoutine ? "Salvar" : "Criar Rotina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Criar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Título da tarefa" className="bg-secondary" /></div>
            <div><Label>Descrição</Label><Input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição (opcional)" className="bg-secondary" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={createForm.priority} onValueChange={v => setCreateForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">🔴 Urgente</SelectItem>
                    <SelectItem value="high">🟡 Alta</SelectItem>
                    <SelectItem value="medium">🟢 Média</SelectItem>
                    <SelectItem value="low">⚪ Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data Limite</Label><Input type="date" value={createForm.due_date} onChange={e => setCreateForm(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projeto</Label>
                <Select value={createForm.project_id} onValueChange={v => setCreateForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={createForm.member_id} onValueChange={v => setCreateForm(f => ({ ...f, member_id: v }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Board</Label>
              <Select value={createForm.board} onValueChange={v => setCreateForm(f => ({ ...f, board: v }))}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agentes">Agentes</SelectItem>
                  <SelectItem value="humanas">Humanas</SelectItem>
                  <SelectItem value="criativos">Criativos</SelectItem>
                  <SelectItem value="campanhas">Campanhas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={createFullTask}>Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Next Step Dialog */}
      <Dialog open={showNextStepDialog} onOpenChange={v => { if (!v) { setShowNextStepDialog(false); setNextStepCard(null); setNextStepForm({ title: "", member_id: "none", observation: "" }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Próximo Passo (opcional)</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Tarefa concluída! Deseja criar um próximo passo para outra pessoa?</p>
          <div className="space-y-3">
            <div><Label>Título do próximo passo</Label><Input value={nextStepForm.title} onChange={e => setNextStepForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Revisar e aprovar" className="bg-secondary" /></div>
            <div>
              <Label>Responsável</Label>
              <Select value={nextStepForm.member_id} onValueChange={v => setNextStepForm(f => ({ ...f, member_id: v }))}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observação</Label><Textarea value={nextStepForm.observation} onChange={e => setNextStepForm(f => ({ ...f, observation: e.target.value }))} placeholder="Contexto ou instruções..." className="bg-secondary min-h-[60px]" /></div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setShowNextStepDialog(false); setNextStepCard(null); setNextStepForm({ title: "", member_id: "none", observation: "" }); }}>Apenas concluir</Button>
            <Button disabled={!nextStepForm.title.trim()} onClick={async () => {
              if (!nextStepCard || !nextStepForm.title.trim()) return;
              const targetCol = findFirstColumn(nextStepCard.board) || columns.find(c => c.board === nextStepCard.board && !isDoneColumn(c));
              if (!targetCol) { toast.error("Coluna não encontrada"); return; }
              const { data: newCard, error } = await supabase.from("imphq_kanban_cards").insert({
                title: nextStepForm.title.trim(),
                description: nextStepForm.observation || null,
                column_id: targetCol.id,
                board: nextStepCard.board,
                priority: nextStepCard.priority,
                tags: [],
                project_id: nextStepCard.project_id || null,
                member_id: nextStepForm.member_id !== "none" ? nextStepForm.member_id : null,
              } as any).select().single();
              if (error) { toast.error("Erro ao criar próximo passo"); return; }
              // Create relation
              await supabase.from("imphq_card_relations").insert({
                card_id: nextStepCard.id,
                related_card_id: (newCard as any).id,
                relation_type: "sequencia",
              } as any);
              // Notify assigned member
              if (nextStepForm.member_id !== "none" && user) {
                const assignedMember = members.find(m => m.id === nextStepForm.member_id);
                const memberRecord = await supabase.from("imphq_team_members").select("user_id").eq("id", nextStepForm.member_id).maybeSingle();
                if (memberRecord.data?.user_id) {
                  await supabase.from("imphq_notifications").insert({
                    user_id: memberRecord.data.user_id,
                    title: `➡️ Próximo passo: ${nextStepForm.title.trim()}`,
                    message: `${nextStepCard.title} foi concluída. Agora é com você!`,
                    type: "tarefa", entity_type: "card", entity_id: (newCard as any).id,
                  });
                }
              }
              setCards(prev => [...prev, newCard as any]);
              setShowNextStepDialog(false); setNextStepCard(null);
              setNextStepForm({ title: "", member_id: "none", observation: "" });
              toast.success("Próximo passo criado! ➡️");
              fetchData();
            }}>
              Criar Próximo Passo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardDetailPanel
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        onUpdate={fetchData}
        columns={columns}
        members={members}
        projects={projects}
      />
    </div>
  );
}
