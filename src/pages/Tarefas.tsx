import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, AlertTriangle, Clock, Plus, CheckCircle2,
  Flame, ListTodo, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

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
}

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

export default function Tarefas() {
  const { user } = useAuth();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [filterProject, setFilterProject] = useState("all");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    const [colRes, cardRes, projRes] = await Promise.all([
      supabase.from("imphq_kanban_columns").select("id, title, board"),
      supabase.from("imphq_kanban_cards").select("*").order("due_date", { ascending: true }),
      supabase.from("imphq_projects").select("id, name"),
    ]);
    setColumns((colRes.data as any[]) || []);
    setCards((cardRes.data as any[]) || []);
    setProjects((projRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doneColumnIds = columns.filter(c => c.title.toLowerCase() === "feito").map(c => c.id);

  const isDone = (card: KanbanCard) => doneColumnIds.includes(card.column_id);

  const filtered = cards.filter(c => {
    if (filterProject !== "all" && c.project_id !== filterProject) return false;
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

  const toggleDone = async (card: KanbanCard) => {
    const done = isDone(card);
    if (done) {
      // Move back to backlog
      const backlogCol = columns.find(c => c.title.toLowerCase() === "backlog" && c.board === card.board);
      if (!backlogCol) return;
      const { error } = await supabase.from("imphq_kanban_cards").update({ column_id: backlogCol.id } as any).eq("id", card.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, column_id: backlogCol.id } : c));
    } else {
      const doneCol = columns.find(c => c.title.toLowerCase() === "feito" && c.board === card.board);
      if (!doneCol) { toast.error("Coluna 'feito' não encontrada"); return; }
      const { error } = await supabase.from("imphq_kanban_cards").update({ column_id: doneCol.id } as any).eq("id", card.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, column_id: doneCol.id } : c));
      toast.success("Tarefa concluída! ✅");
    }
  };

  const addQuickTask = async () => {
    if (!newTask.trim()) return;
    const backlogCol = columns.find(c => c.title.toLowerCase() === "backlog" && c.board === "geral");
    if (!backlogCol) { toast.error("Coluna 'backlog' não encontrada"); return; }
    const { data, error } = await supabase
      .from("imphq_kanban_cards")
      .insert({
        title: newTask.trim(),
        column_id: backlogCol.id,
        board: "geral",
        priority: "medium",
        due_date: todayStr,
        tags: [],
      } as any)
      .select()
      .single();
    if (error) { toast.error("Erro ao criar tarefa"); return; }
    setCards(prev => [...prev, data as any]);
    setNewTask("");
    toast.success("Tarefa adicionada ao Kanban ✅");
  };

  const getProjectName = (id?: string) => {
    if (!id) return null;
    return projects.find(p => p.id === id)?.name;
  };

  const getColumnName = (colId: string) => {
    return columns.find(c => c.id === colId)?.title || "—";
  };

  const TaskItem = ({ card }: { card: KanbanCard }) => {
    const done = isDone(card);
    const projName = getProjectName(card.project_id);
    const colName = getColumnName(card.column_id);
    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-accent/5 ${done ? "opacity-60" : ""}`}>
        <Checkbox
          checked={done}
          onCheckedChange={() => toggleDone(card)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[card.priority || "low"]}`} />
            <span className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{card.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {projName && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{projName}</Badge>
            )}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[card.priority || "low"]}`}>
              {card.priority || "normal"}
            </Badge>
            {!done && (
              <span className="text-[10px] text-muted-foreground">📋 {colName}</span>
            )}
            {card.due_date && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date(card.due_date).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, icon, cards, color, emptyMsg }: {
    title: string; icon: React.ReactNode; cards: KanbanCard[]; color: string; emptyMsg: string;
  }) => (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          <span className={color}>{title}</span>
          <Badge variant="secondary" className="ml-auto text-xs">{cards.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyMsg}</p>
        ) : (
          cards.map(c => <TaskItem key={c.id} card={c} />)
        )}
      </CardContent>
    </Card>
  );

  // Stats
  const totalActive = filtered.filter(c => !isDone(c)).length;
  const totalDone = filtered.filter(c => isDone(c)).length;

  if (loading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <CalendarDays className="h-7 w-7" /> Meu Dia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-44 bg-secondary">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-destructive/30">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div>
              <div className="text-lg font-bold text-destructive">{overdue.length}</div>
              <div className="text-[10px] text-muted-foreground">Atrasadas</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="p-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            <div>
              <div className="text-lg font-bold text-primary">{todayCards.length}</div>
              <div className="text-[10px] text-muted-foreground">Hoje</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <div>
              <div className="text-lg font-bold text-warning">{upcoming.length}</div>
              <div className="text-[10px] text-muted-foreground">Próximos 3 dias</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/30">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <div>
              <div className="text-lg font-bold text-success">{totalDone}</div>
              <div className="text-[10px] text-muted-foreground">Concluídas</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <Input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder="Adicionar tarefa rápida..."
          className="bg-secondary"
          onKeyDown={e => e.key === "Enter" && addQuickTask()}
        />
        <Button onClick={addQuickTask} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {overdue.length > 0 && (
          <Section
            title="Atrasadas"
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            cards={overdue}
            color="text-destructive"
            emptyMsg=""
          />
        )}

        <Section
          title="Hoje"
          icon={<Flame className="h-4 w-4 text-primary" />}
          cards={todayCards}
          color="text-primary"
          emptyMsg="Nenhuma tarefa para hoje 🎉"
        />

        <Section
          title="Próximos 3 dias"
          icon={<Clock className="h-4 w-4 text-warning" />}
          cards={upcoming}
          color="text-warning"
          emptyMsg="Sem tarefas nos próximos dias"
        />

        {noDueDate.length > 0 && (
          <Section
            title="Sem prazo definido"
            icon={<ListTodo className="h-4 w-4 text-muted-foreground" />}
            cards={noDueDate}
            color="text-muted-foreground"
            emptyMsg=""
          />
        )}

        {doneRecent.length > 0 && (
          <Section
            title="Concluídas recentes"
            icon={<CheckCircle2 className="h-4 w-4 text-success" />}
            cards={doneRecent}
            color="text-success"
            emptyMsg=""
          />
        )}
      </div>
    </div>
  );
}
