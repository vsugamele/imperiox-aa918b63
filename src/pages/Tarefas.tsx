import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays, AlertTriangle, Clock, Plus, CheckCircle2,
  Flame, ListTodo, Trash2, User, FileDown, FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CardDetailPanel from "@/components/kanban/CardDetailPanel";

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

const isDoneColumn = (col: Column) => DONE_TITLES.includes(col.title.toLowerCase().trim());
const isFirstColumn = (col: Column) => FIRST_COL_TITLES.includes(col.title.toLowerCase().trim());

export default function Tarefas() {
  const { user } = useAuth();
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    const [colRes, cardRes, projRes, memberRes] = await Promise.all([
      supabase.from("imphq_kanban_columns").select("id, title, board, position").order("position", { ascending: true }),
      supabase.from("imphq_kanban_cards").select("*").order("due_date", { ascending: true }),
      supabase.from("imphq_projects").select("id, name"),
      supabase.from("imphq_team_members").select("id, name, avatar_url, role").eq("is_active", true),
    ]);
    setColumns((colRes.data as any[]) || []);
    setCards((cardRes.data as any[]) || []);
    setProjects((projRes.data as any[]) || []);
    setMembers((memberRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    const boards = [...new Set(columns.map(c => c.board))];
    let targetCol: Column | undefined;
    let targetBoard = "agentes";
    for (const board of boards) {
      const col = findFirstColumn(board);
      if (col) { targetCol = col; targetBoard = board; break; }
    }
    if (!targetCol) { toast.error("Nenhuma coluna disponível"); return; }
    const { data, error } = await supabase
      .from("imphq_kanban_cards")
      .insert({
        title: newTask.trim(),
        column_id: targetCol.id,
        board: targetBoard,
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
    setNewTask("");
    toast.success("Tarefa adicionada ✅");
  };

  const getProjectName = (id?: string) => {
    if (!id) return null;
    return projects.find(p => p.id === id)?.name;
  };

  const getMember = (id?: string) => {
    if (!id) return null;
    return members.find(m => m.id === id);
  };

  const getColumnName = (colId: string) => {
    return columns.find(c => c.id === colId)?.title || "—";
  };

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
          <Checkbox
            checked={done}
            onCheckedChange={() => toggleDone(card)}
            className="mt-0.5"
          />
        </div>
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
              if (filterProject !== "all") {
                const pName = projects.find(p => p.id === filterProject)?.name;
                if (pName) doc.text(`Projeto: ${pName}`, 14, 30);
              }
              doc.setTextColor(0);

              const buildRows = (list: KanbanCard[]) =>
                list.map(c => [
                  c.title,
                  getProjectName(c.project_id) || "—",
                  getMember(c.member_id)?.name || "—",
                  c.priority || "—",
                  c.due_date ? new Date(c.due_date).toLocaleDateString("pt-BR") : "—",
                  getColumnName(c.column_id),
                ]);

              const head = [["Tarefa", "Projeto", "Responsável", "Prioridade", "Prazo", "Status"]];
              let startY = 36;

              const addSection = (title: string, rows: string[][]) => {
                if (rows.length === 0) return;
                doc.setFontSize(12);
                doc.setTextColor(60);
                doc.text(title, 14, startY);
                startY += 2;
                autoTable(doc, {
                  head,
                  body: rows,
                  startY,
                  theme: "grid",
                  headStyles: { fillColor: [30, 30, 30], fontSize: 8 },
                  bodyStyles: { fontSize: 8 },
                  margin: { left: 14, right: 14 },
                });
                startY = (doc as any).lastAutoTable.finalY + 8;
              };

              addSection(`⚠️ Atrasadas (${overdue.length})`, buildRows(overdue));
              addSection(`🔥 Hoje (${todayCards.length})`, buildRows(todayCards));
              addSection(`⏳ Próximos 3 dias (${upcoming.length})`, buildRows(upcoming));
              addSection(`📋 Sem prazo (${noDueDate.length})`, buildRows(noDueDate));

              doc.setFontSize(8);
              doc.setTextColor(130);
              doc.text(`Total: ${filtered.filter(c => !isDone(c)).length} pendentes · ${totalDone} concluídas · Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, doc.internal.pageSize.height - 10);
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
              const a = document.createElement("a");
              a.href = url; a.download = `tarefas_${todayStr}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success("CSV exportado!");
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-40 bg-secondary h-9">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Projetos</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-40 bg-secondary h-9">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      <div className="flex gap-2 flex-wrap">
        <Input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder="Adicionar tarefa rápida..."
          className="bg-secondary flex-1 min-w-[200px]"
          onKeyDown={e => e.key === "Enter" && addQuickTask()}
        />
        <Select value={newPriority} onValueChange={setNewPriority}>
          <SelectTrigger className="w-28 bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">🔴 Urgente</SelectItem>
            <SelectItem value="high">🟡 Alta</SelectItem>
            <SelectItem value="medium">🟢 Média</SelectItem>
            <SelectItem value="low">⚪ Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={newProjectId} onValueChange={setNewProjectId}>
          <SelectTrigger className="w-36 bg-secondary">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem projeto</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={newMemberId} onValueChange={setNewMemberId}>
          <SelectTrigger className="w-36 bg-secondary">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem responsável</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
