import { useEffect, useState, useCallback, DragEvent } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Trash2, Flame, AlertTriangle, Search, CheckCircle2, Inbox, Eye, Users,
  Paperclip, CheckSquare, FolderOpen, MoreHorizontal, Pencil, LayoutGrid, List,
  Filter, X, ChevronDown, ChevronRight, Check, FileText, Loader2, Copy, EyeOff,
  Palette, Table as TableIcon, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import CardDetailPanel from "@/components/kanban/CardDetailPanel";
import { createCalendarEventForCard } from "@/lib/calendarSync";
import { CardMetricsChips } from "@/components/kanban/CardMetricsChips";
import { ColumnColorMenu, hexToTint } from "@/components/kanban/ColumnColorMenu";
import { KanbanSheetView } from "@/components/kanban/KanbanSheetView";
import { TEMPLATES, type BoardTemplate } from "@/components/kanban/kanbanTemplates";
import { BoardTabsBar, type KanbanBoard } from "@/components/kanban/BoardTabsBar";

const FALLBACK_BOARDS: KanbanBoard[] = [
  { id: "geral",     label: "Geral",     emoji: "📋", color: "#71717a", position: 0, is_pinned: true },
  { id: "agentes",   label: "Agentes",   emoji: "🤖", color: "#8b5cf6", position: 1 },
  { id: "humanas",   label: "Humanas",   emoji: "👥", color: "#3b82f6", position: 2 },
  { id: "criativos", label: "Criativos", emoji: "🎨", color: "#ec4899", position: 3 },
  { id: "campanhas", label: "Campanhas", emoji: "🚀", color: "#f0b100", position: 4 },
  { id: "experts",   label: "Experts",   emoji: "⭐", color: "#22c55e", position: 5, is_pinned: true },
];
const DEFAULT_COLUMNS = ["backlog", "fazendo", "travado", "revisão", "feito"];

// Synonym map for smart merging in "geral" view
const SYNONYM_MAP: Record<string, string> = {
  "a fazer": "backlog", "to do": "backlog", "todo": "backlog", "pendente": "backlog",
  "em progresso": "fazendo", "doing": "fazendo", "em andamento": "fazendo", "working": "fazendo",
  "bloqueado": "travado", "blocked": "travado", "stuck": "travado",
  "review": "revisão", "revisao": "revisão", "em revisão": "revisão",
  "concluído": "feito", "concluido": "feito", "done": "feito", "finalizado": "feito", "completo": "feito",
};

const normalizeColTitle = (title: string): string => {
  const lower = title.toLowerCase().trim();
  return SYNONYM_MAP[lower] || lower;
};

const COL_CONFIG: Record<string, { icon: React.ReactNode; bg: string; border: string; headerBg: string }> = {
  backlog: { icon: <Inbox className="h-3.5 w-3.5" />, bg: "bg-muted/20", border: "border-l-muted-foreground/40", headerBg: "bg-muted/30" },
  fazendo: { icon: <Flame className="h-3.5 w-3.5 text-warning" />, bg: "bg-warning/5", border: "border-l-warning/50", headerBg: "bg-warning/10" },
  travado: { icon: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />, bg: "bg-destructive/5", border: "border-l-destructive/50", headerBg: "bg-destructive/10" },
  "revisão": { icon: <Eye className="h-3.5 w-3.5 text-primary" />, bg: "bg-primary/5", border: "border-l-primary/50", headerBg: "bg-primary/10" },
  feito: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, bg: "bg-success/5", border: "border-l-success/50", headerBg: "bg-success/10" },
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-destructive", high: "border-l-warning", medium: "border-l-success", low: "border-l-muted-foreground/40",
};
const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-destructive", high: "bg-warning", medium: "bg-success", low: "bg-muted-foreground/40",
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa",
};

interface TeamMember { id: string; name: string; avatar_url?: string; role?: string; }
interface KanbanColumn { id: string; title: string; color: string; position: number; board: string; }
interface KanbanCard {
  id: string; column_id: string; title: string; description?: string;
  priority: string; due_date?: string; tags: string[]; position: number; board: string;
  member_id?: string; project_id?: string;
  metrics?: Record<string, any> | null;
  status_color?: string | null;
}

interface Filters {
  priority: string;
  project: string;
  product: string;
  deadline: string; // all | overdue | today | none
}

export default function KanbanPage() {
  const [allColumns, setAllColumns] = useState<KanbanColumn[]>([]);
  const [allCards, setAllCards] = useState<KanbanCard[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; data?: any }[]>([]);
  const [cardAttachmentCounts, setCardAttachmentCounts] = useState<Record<string, number>>({});
  const [cardChecklistCounts, setCardChecklistCounts] = useState<Record<string, { done: number; total: number }>>({});
  const [activeBoard, setActiveBoard] = useState("geral");
  const [boards, setBoards] = useState<KanbanBoard[]>(FALLBACK_BOARDS);
  const [showNewCard, setShowNewCard] = useState<string | null>(null);
  const [editCard, setEditCard] = useState<KanbanCard | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newBoard, setNewBoard] = useState("agentes");
  const [newMemberId, setNewMemberId] = useState("none");
  const [newProjectId, setNewProjectId] = useState("none");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMember, setFilterMember] = useState("all");
  const [filters, setFilters] = useState<Filters>({ priority: "all", project: "all", product: "all", deadline: "all" });
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "list" | "sheet">("board");

  // Column management
  const [renameCol, setRenameCol] = useState<KanbanColumn | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteCol, setDeleteCol] = useState<KanbanColumn | null>(null);
  const [moveToColId, setMoveToColId] = useState("");
  const [newColTitle, setNewColTitle] = useState("");
  const [showNewCol, setShowNewCol] = useState(false);

  // List view collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Hide done toggle
  const [hideDone, setHideDone] = useState(() => localStorage.getItem("kanban_hideDone") === "true");

  // AI Doc generation
  const [aiDocLoading, setAiDocLoading] = useState(false);
  const [aiDocResult, setAiDocResult] = useState("");
  const [showAiDoc, setShowAiDoc] = useState(false);

  // Inline create in list view
  const [inlineCreateCol, setInlineCreateCol] = useState<string | null>(null);
  const [inlineCreateTitle, setInlineCreateTitle] = useState("");

  const loadAllData = useCallback(async () => {
    setLoading(true);
    const [colRes, cardRes, memberRes, projRes, attRes, checkRes] = await Promise.all([
      supabase.from("imphq_kanban_columns").select("*").order("position"),
      supabase.from("imphq_kanban_cards").select("*").order("position"),
      supabase.from("imphq_team_members").select("id, name, avatar_url, role"),
      supabase.from("imphq_projects").select("id, name, data, icon"),
      supabase.from("imphq_card_attachments").select("card_id"),
      supabase.from("imphq_card_checklists").select("card_id, is_done"),
    ]);

    let cols = (colRes.data || []) as KanbanColumn[];
    const existingBoards = new Set(cols.map(c => c.board));

    for (const board of ["agentes", "humanas", "criativos", "campanhas"]) {
      if (!existingBoards.has(board)) {
        const newCols = DEFAULT_COLUMNS.map((title, i) => ({ title, color: "#8b5cf6", position: i, board }));
        const { data } = await supabase.from("imphq_kanban_columns").insert(newCols).select();
        if (data) cols = [...cols, ...(data as KanbanColumn[])];
      }
    }

    const attCounts: Record<string, number> = {};
    ((attRes.data as any[]) || []).forEach(a => { attCounts[a.card_id] = (attCounts[a.card_id] || 0) + 1; });

    const checkCounts: Record<string, { done: number; total: number }> = {};
    ((checkRes.data as any[]) || []).forEach(c => {
      if (!checkCounts[c.card_id]) checkCounts[c.card_id] = { done: 0, total: 0 };
      checkCounts[c.card_id].total++;
      if (c.is_done) checkCounts[c.card_id].done++;
    });

    setAllColumns(cols);
    setAllCards((cardRes.data || []) as KanbanCard[]);
    setMembers((memberRes.data || []) as TeamMember[]);
    setProjects((projRes.data || []) as { id: string; name: string; data?: any }[]);
    setCardAttachmentCounts(attCounts);
    setCardChecklistCounts(checkCounts);
    setLoading(false);
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const getProjectExpert = (projectId?: string) => {
    if (!projectId) return undefined;
    const proj = projects.find(p => p.id === projectId);
    return proj?.data?.expert?.nome || undefined;
  };
  const getProjectProduct = (projectId?: string) => {
    if (!projectId) return undefined;
    const proj = projects.find(p => p.id === projectId);
    return proj?.data?.briefing?.produto || undefined;
  };

  // All unique products from projects
  const allProducts = (() => {
    const prods = new Set<string>();
    projects.forEach(p => {
      const d = p.data || {};
      if (Array.isArray(d.produtos)) {
        d.produtos.forEach((prod: any) => {
          const name = prod.nome || prod.name;
          if (name) prods.add(name);
        });
      }
    });
    return Array.from(prods).sort();
  })();

  // Project IDs that contain the selected product
  const projectIdsWithProduct = (productName: string): Set<string> => {
    const ids = new Set<string>();
    projects.forEach(p => {
      const d = p.data || {};
      if (Array.isArray(d.produtos)) {
        if (d.produtos.some((prod: any) => (prod.nome || prod.name) === productName)) {
          ids.add(p.id);
        }
      }
    });
    return ids;
  };

  // Compute display columns based on active board
  const displayColumns = (() => {
    if (activeBoard === "experts") {
      const expertMap = new Map<string, KanbanColumn>();
      // Only include cards that have a member_id (assigned to expert)
      for (const card of allCards) {
        if (!card.member_id && !card.project_id) continue; // skip unassigned cards without project
        const expertName = getProjectExpert(card.project_id) || "Sem Expert";
        if (!expertMap.has(expertName)) {
          expertMap.set(expertName, { id: `expert-${expertName}`, title: expertName, color: "#8b5cf6", position: expertMap.size, board: "experts" });
        }
      }
      return Array.from(expertMap.values());
    }
    if (activeBoard === "geral") {
      const mergedMap = new Map<string, KanbanColumn>();
      for (const col of allColumns) {
        const key = normalizeColTitle(col.title);
        if (!mergedMap.has(key)) mergedMap.set(key, { ...col, title: key });
      }
      const canonical = ["backlog", "fazendo", "travado", "revisão", "feito"];
      const sorted = Array.from(mergedMap.values()).sort((a, b) => {
        const ai = canonical.indexOf(a.title.toLowerCase());
        const bi = canonical.indexOf(b.title.toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      return sorted;
    }
    return allColumns.filter(c => c.board === activeBoard).sort((a, b) => a.position - b.position);
  })();

  // Get normalized column title for a card
  const getCardNormalizedCol = (card: KanbanCard): string => {
    const col = allColumns.find(c => c.id === card.column_id);
    return col ? normalizeColTitle(col.title) : "backlog";
  };

  // All cards for active board
  const boardCards = activeBoard === "geral" ? allCards : allCards.filter(c => c.board === activeBoard);

  const isOverdue = (d?: string) => d ? new Date(d) < new Date() : false;
  const isToday = (d?: string) => {
    if (!d) return false;
    const t = new Date(); const dd = new Date(d);
    return t.toDateString() === dd.toDateString();
  };

  // Apply all filters to a card list
  const applyFilters = (cards: KanbanCard[]): KanbanCard[] => {
    let result = cards;
    if (searchTerm) result = result.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterMember !== "all") result = result.filter(c => c.member_id === filterMember);
    if (filters.priority !== "all") result = result.filter(c => c.priority === filters.priority);
    if (filters.project !== "all") result = result.filter(c => c.project_id === filters.project);
    if (filters.product !== "all") {
      const ids = projectIdsWithProduct(filters.product);
      result = result.filter(c => c.project_id && ids.has(c.project_id));
    }
    if (filters.deadline === "overdue") result = result.filter(c => isOverdue(c.due_date));
    else if (filters.deadline === "today") result = result.filter(c => isToday(c.due_date));
    else if (filters.deadline === "none") result = result.filter(c => !c.due_date);
    if (hideDone) result = result.filter(c => getCardNormalizedCol(c) !== "feito");
    return result;
  };

  // Cards for a specific display column
  const cardsForCol = (col: KanbanColumn): KanbanCard[] => {
    let cards: KanbanCard[];
    if (activeBoard === "experts") {
      const expertName = col.title;
      // Only show cards assigned (member_id) or belonging to expert's project
      cards = allCards.filter(c => {
        const cardExpert = getProjectExpert(c.project_id) || "Sem Expert";
        if (cardExpert !== expertName) return false;
        // Must have member_id OR project_id to appear in expert view
        return !!(c.member_id || c.project_id);
      });
    } else if (activeBoard === "geral") {
      const normalizedTitle = col.title.toLowerCase();
      cards = allCards.filter(c => getCardNormalizedCol(c) === normalizedTitle);
      const seen = new Set<string>();
      cards = cards.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
    } else {
      cards = allCards.filter(c => c.column_id === col.id);
    }
    return applyFilters(cards);
  };

  const activeFiltersCount = [
    filters.priority !== "all", filters.project !== "all", filters.product !== "all", filters.deadline !== "all", filterMember !== "all"
  ].filter(Boolean).length;

  const getMember = (memberId?: string) => memberId ? members.find(m => m.id === memberId) : undefined;
  const getProjectName = (projectId?: string) => projectId ? projects.find(p => p.id === projectId)?.name : undefined;


  // Stats
  const stuckCount = allCards.filter(c => getCardNormalizedCol(c) === "travado").length;
  const doingCount = allCards.filter(c => getCardNormalizedCol(c) === "fazendo").length;
  const doneCount = allCards.filter(c => getCardNormalizedCol(c) === "feito").length;
  const noOwnerCount = allCards.filter(c => !c.member_id).length;
  const boardCardCounts: Record<string, number> = {};
  for (const b of boards) {
    boardCardCounts[b.id] = b.id === "geral" ? allCards.length : allCards.filter(c => c.board === b.id).length;
  }

  const toggleHideDone = (v: boolean) => {
    setHideDone(v);
    localStorage.setItem("kanban_hideDone", String(v));
  };

  const generateAiDoc = async () => {
    setAiDocLoading(true);
    try {
      const cardsData = (activeBoard === "geral" ? allCards : allCards.filter(c => c.board === activeBoard))
        .map(c => {
          const m = getMember(c.member_id);
          const col = allColumns.find(co => co.id === c.column_id);
          return `- [${col?.title || "?"}] ${c.title}${m ? ` (${m.name})` : ""}${c.due_date ? ` | Prazo: ${new Date(c.due_date).toLocaleDateString("pt-BR")}` : ""}${c.description ? ` — ${c.description.slice(0, 80)}` : ""}`;
        }).join("\n");
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          action: "generate",
          prompt: `Gere um documento resumido das atividades do time para compartilhar. Organize por status e responsável.\n\nCards do board "${activeBoard}":\n${cardsData}`,
          context: "",
        },
      });
      if (error) throw error;
      setAiDocResult(data?.result || data?.text || "Sem resultado");
      setShowAiDoc(true);
    } catch (e: any) {
      toast.error("Erro ao gerar doc: " + (e.message || ""));
    } finally {
      setAiDocLoading(false);
    }
  };

  const createCard = async () => {
    if (!newTitle.trim() || !showNewCard) return;
    const board = activeBoard === "geral" ? newBoard : activeBoard;
    let targetColId = showNewCard;
    if (activeBoard === "geral") {
      const selectedCol = allColumns.find(c => c.id === showNewCard);
      const colTitle = selectedCol ? normalizeColTitle(selectedCol.title) : "";
      const boardCol = allColumns.find(c => c.board === board && normalizeColTitle(c.title) === colTitle);
      if (boardCol) targetColId = boardCol.id;
    }
    const { data: newCard, error } = await supabase.from("imphq_kanban_cards").insert({
      column_id: targetColId, title: newTitle.trim(), priority: newPriority,
      due_date: newDueDate || null, description: newDesc || null,
      board, position: allCards.filter(c => c.column_id === targetColId).length, tags: [],
      member_id: newMemberId === "none" ? null : newMemberId,
      project_id: newProjectId === "none" ? null : newProjectId,
    }).select().single();
    if (error) { toast.error("Erro ao criar card"); return; }
    // Notificação instantânea + activity log
    if (newCard) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        // Activity log
        await supabase.from("imphq_activity_log").insert({
          user_id: currentUser.id,
          action: "card_created",
          entity_type: "card",
          entity_name: newTitle.trim(),
        });
        const otherUsers = (await supabase.from("imphq_team_members").select("user_id").not("user_id", "is", null)).data || [];
        for (const m of otherUsers) {
          if (m.user_id && m.user_id !== currentUser.id) {
            await supabase.from("imphq_notifications").insert({
              user_id: m.user_id,
              title: `📝 Nova tarefa: ${newTitle.trim()}`,
              message: newDesc || null,
              type: "tarefa",
              entity_type: "card",
              entity_id: (newCard as any).id,
            });
          }
        }
      }
    }
    // Sync with calendar if due_date exists
    if (newDueDate && newCard) {
      const { data: { user: calUser } } = await supabase.auth.getUser();
      if (calUser) createCalendarEventForCard({ title: newTitle.trim(), due_date: newDueDate, project_id: (newCard as any).project_id, user_id: calUser.id, card_id: (newCard as any).id });
    }
    toast.success("Card criado!");
    setShowNewCard(null); setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewDesc(""); setNewBoard("agentes"); setNewMemberId("none"); setNewProjectId("none");
    loadAllData();
  };

  // Drag and drop
  const handleDragStart = (e: DragEvent, cardId: string) => { setDragCardId(cardId); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = async (e: DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!dragCardId) return;
    const card = allCards.find(c => c.id === dragCardId);
    if (!card) return;

    if (activeBoard === "geral") {
      const targetCol = displayColumns.find(c => c.id === targetColId);
      const targetNormalized = targetCol?.title.toLowerCase() || "";
      const boardCol = allColumns.find(c => c.board === card.board && normalizeColTitle(c.title) === targetNormalized);
      if (boardCol && boardCol.id !== card.column_id) {
        await supabase.from("imphq_kanban_cards").update({ column_id: boardCol.id }).eq("id", card.id);
        // Log card_moved
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) await supabase.from("imphq_activity_log").insert({ user_id: u.id, action: "card_moved", entity_type: "card", entity_name: `${card.title} → ${targetCol?.title || ""}` });
        loadAllData();
      }
    } else {
      if (targetColId !== card.column_id) {
        await supabase.from("imphq_kanban_cards").update({ column_id: targetColId }).eq("id", card.id);
        const targetCol2 = allColumns.find(c => c.id === targetColId);
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) await supabase.from("imphq_activity_log").insert({ user_id: u.id, action: "card_moved", entity_type: "card", entity_name: `${card.title} → ${targetCol2?.title || ""}` });
        loadAllData();
      }
    }
    setDragCardId(null);
  };

  // Column management actions
  const handleRenameCol = async () => {
    if (!renameCol || !renameValue.trim()) return;
    await supabase.from("imphq_kanban_columns").update({ title: renameValue.trim() }).eq("id", renameCol.id);
    toast.success("Coluna renomeada");
    setRenameCol(null);
    loadAllData();
  };

  const handleDeleteCol = async () => {
    if (!deleteCol) return;
    const colCards = allCards.filter(c => c.column_id === deleteCol.id);
    if (colCards.length > 0 && moveToColId) {
      for (const c of colCards) {
        await supabase.from("imphq_kanban_cards").update({ column_id: moveToColId }).eq("id", c.id);
      }
    }
    await supabase.from("imphq_kanban_columns").delete().eq("id", deleteCol.id);
    toast.success("Coluna excluída");
    setDeleteCol(null); setMoveToColId("");
    loadAllData();
  };

  const handleAddCol = async () => {
    if (!newColTitle.trim() || activeBoard === "geral") return;
    const maxPos = allColumns.filter(c => c.board === activeBoard).reduce((m, c) => Math.max(m, c.position), -1);
    await supabase.from("imphq_kanban_columns").insert({ title: newColTitle.trim(), color: "#8b5cf6", position: maxPos + 1, board: activeBoard });
    toast.success("Coluna criada");
    setNewColTitle(""); setShowNewCol(false);
    loadAllData();
  };

  // Quick actions
  const quickDelete = async (cardId: string) => {
    if (!confirm("Excluir este card?")) return;
    await supabase.from("imphq_kanban_cards").delete().eq("id", cardId);
    toast.success("Card excluído");
    loadAllData();
  };

  const quickMarkDone = async (card: KanbanCard) => {
    const doneCol = allColumns.find(c => c.board === card.board && normalizeColTitle(c.title) === "feito");
    if (doneCol) {
      await supabase.from("imphq_kanban_cards").update({ column_id: doneCol.id }).eq("id", card.id);
      toast.success("Movido para Feito");
      loadAllData();
    }
  };

  const clearAllFilters = () => {
    setSearchTerm(""); setFilterMember("all");
    setFilters({ priority: "all", project: "all", product: "all", deadline: "all" });
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Render a card mini (used in board view)
  const renderCard = (card: KanbanCard) => {
    const member = getMember(card.member_id);
    const projName = getProjectName(card.project_id);
    const expertName = getProjectExpert(card.project_id);
    const productName = getProjectProduct(card.project_id);
    const priorityBorder = PRIORITY_BORDER[card.priority] || PRIORITY_BORDER.medium;
    const attCount = cardAttachmentCounts[card.id] || 0;
    const checkInfo = cardChecklistCounts[card.id];
    return (
      <Card
        key={card.id}
        draggable
        onDragStart={(e) => handleDragStart(e as unknown as DragEvent, card.id)}
        className={`bg-card border-l-[3px] ${priorityBorder} hover:border-primary/20 transition-colors group/card cursor-grab active:cursor-grabbing ${dragCardId === card.id ? "opacity-50" : ""}`}
        onClick={() => setEditCard({ ...card })}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-medium flex-1 leading-tight">{card.title}</p>
            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); quickMarkDone(card); }}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-success/20 text-success"
                title="Marcar como feito"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); quickDelete(card.id); }}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/20 text-destructive"
                title="Excluir"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[card.priority] || PRIORITY_DOT.medium}`} />
              {activeBoard === "geral" && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">{card.board}</Badge>
              )}
              {projName && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 bg-primary/5 text-primary border-primary/20">
                  <FolderOpen className="h-2 w-2" /> {projName}
                </Badge>
              )}
              {expertName && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
                  👤 {expertName}
                </Badge>
              )}
              {productName && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  📦 {productName}
                </Badge>
              )}
              {card.tags && card.tags.length > 0 && card.tags.slice(0, 2).map((tag, i) => (
                <Badge key={i} className="text-[8px] px-1 py-0 bg-accent text-accent-foreground">{tag}</Badge>
              ))}
              {card.tags && card.tags.length > 2 && (
                <span className="text-[8px] text-muted-foreground">+{card.tags.length - 2}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {checkInfo && checkInfo.total > 0 && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <CheckSquare className="h-2.5 w-2.5" /> {checkInfo.done}/{checkInfo.total}
                </span>
              )}
              {attCount > 0 && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Paperclip className="h-2.5 w-2.5" /> {attCount}
                </span>
              )}
              {card.due_date && (
                <p className={`text-[10px] font-mono ${isOverdue(card.due_date) ? "text-destructive" : "text-muted-foreground"}`}>
                  {new Date(card.due_date).toLocaleDateString("pt-BR")}
                </p>
              )}
              {member && (
                <Avatar className="h-5 w-5" title={member.name}>
                  {member.avatar_url ? <AvatarImage src={member.avatar_url} /> : null}
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{(member.name || "?")[0]}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
          <CardMetricsChips metrics={card.metrics} statusColor={card.status_color} compact />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">Kanban <SectionInfo {...sectionHelpTexts.kanban} /></h1>
      </div>

      {/* Mini Analytics KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-muted-foreground/20">
          <CardContent className="p-3 flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <div><div className="text-lg font-bold">{allCards.length}</div><div className="text-[10px] text-muted-foreground">Total Cards</div></div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div><div className="text-lg font-bold text-destructive">{stuckCount}</div><div className="text-[10px] text-muted-foreground">Travados</div></div>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="p-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-warning" />
            <div><div className="text-lg font-bold text-warning">{allCards.filter(c => c.due_date && isOverdue(c.due_date) && getCardNormalizedCol(c) !== "feito").length}</div><div className="text-[10px] text-muted-foreground">Atrasados</div></div>
          </CardContent>
        </Card>
        <Card className="border-success/30">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <div><div className="text-lg font-bold text-success">{doneCount}</div><div className="text-[10px] text-muted-foreground">Concluídos</div></div>
          </CardContent>
        </Card>
        <Card className="border-muted-foreground/20">
          <CardContent className="p-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div><div className="text-lg font-bold">{noOwnerCount}</div><div className="text-[10px] text-muted-foreground">Sem dono</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar cards..." className="pl-9 bg-secondary" />
        </div>

        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="w-[160px] h-9">
            <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                    {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                    <AvatarFallback className="text-[8px] bg-secondary">{(m.name || "?")[0]}</AvatarFallback>
                  </Avatar>
                  {m.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Advanced Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Filtros
              {activeFiltersCount > 0 && (
                <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-primary text-primary-foreground">{activeFiltersCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
           <PopoverContent className="w-64 space-y-3" align="start" onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target?.closest("[data-radix-popper-content-wrapper]")) {
                e.preventDefault();
              }
            }}>
            <div>
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <Select value={filters.priority} onValueChange={v => setFilters(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Projeto</Label>
              <Select value={filters.project} onValueChange={v => setFilters(f => ({ ...f, project: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Prazo</Label>
              <Select value={filters.deadline} onValueChange={v => setFilters(f => ({ ...f, deadline: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue">Atrasados</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="none">Sem prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {allProducts.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <Select value={filters.product} onValueChange={v => setFilters(f => ({ ...f, product: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {allProducts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeFiltersCount > 0 && (
              <Button size="sm" variant="ghost" className="w-full text-xs" onClick={clearAllFilters}>
                <X className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {activeFiltersCount > 0 && (
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={clearAllFilters}>Limpar</Button>
        )}

        {/* Hide done toggle */}
        <div className="flex items-center gap-2">
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="hide-done">Ocultar concluídas</Label>
          <Switch id="hide-done" checked={hideDone} onCheckedChange={toggleHideDone} />
        </div>

        {/* AI Doc button */}
        <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={generateAiDoc} disabled={aiDocLoading}>
          {aiDocLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Gerar Doc IA
        </Button>

        {/* View toggle */}
        <div className="flex items-center border border-border rounded-md ml-auto">
          <Button
            variant={viewMode === "board" ? "secondary" : "ghost"}
            size="sm" className="h-8 px-2 rounded-r-none"
            onClick={() => setViewMode("board")}
            title="Board"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm" className="h-8 px-2 rounded-none"
            onClick={() => setViewMode("list")}
            title="Lista"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "sheet" ? "secondary" : "ghost"}
            size="sm" className="h-8 px-2 rounded-l-none"
            onClick={() => setViewMode("sheet")}
            title="Planilha"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <BoardTabsBar
        boards={boards}
        activeBoard={activeBoard}
        onActive={setActiveBoard}
        cardCounts={boardCardCounts}
        onReload={loadAllData}
      />
      <Tabs value={activeBoard} onValueChange={setActiveBoard}>
        <TabsList className="hidden" />


        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : viewMode === "board" ? (
            /* ====== BOARD VIEW ====== */
            <div className="flex gap-3 min-h-[60vh] overflow-x-auto pb-2 snap-x snap-mandatory">
              {displayColumns.map((col) => {
                const colTitle = normalizeColTitle(col.title);
                const config = COL_CONFIG[colTitle] || COL_CONFIG.backlog;
                const colCards = cardsForCol(col);
                return (
                  <div
                    key={col.id}
                    className={`rounded-lg border-l-[3px] ${config.border} ${config.bg} p-3 transition-colors min-w-[260px] flex-1 snap-start`}
                    style={col.color && !["#8b5cf6"].includes(col.color) ? { borderLeftColor: col.color, backgroundColor: hexToTint(col.color, 0.05) } : undefined}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    <div
                      className={`rounded-md ${config.headerBg} px-3 py-2 mb-3 flex items-center justify-between`}
                      style={col.color && !["#8b5cf6"].includes(col.color) ? { backgroundColor: hexToTint(col.color, 0.15) } : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {col.color && !["#8b5cf6"].includes(col.color)
                          ? <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                          : config.icon}
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80">{col.title}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] h-5 min-w-[20px] justify-center">{colCards.length}</Badge>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setShowNewCard(col.id); setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewDesc(""); setNewBoard("agentes"); setNewMemberId("none"); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        {activeBoard !== "geral" && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-5 w-5">
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="end">
                              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                                onClick={() => { setRenameCol(col); setRenameValue(col.title); }}>
                                <Pencil className="h-3 w-3" /> Renomear
                              </button>
                              <div className="px-2 py-1.5">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                                  <Palette className="h-3 w-3" /> Cor
                                </div>
                                <ColumnColorMenu
                                  currentColor={col.color}
                                  onPick={async (hex) => {
                                    await supabase.from("imphq_kanban_columns").update({ color: hex }).eq("id", col.id);
                                    loadAllData();
                                  }}
                                />
                              </div>
                              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-destructive/10 text-destructive flex items-center gap-2"
                                onClick={() => { setDeleteCol(col); setMoveToColId(""); }}>
                                <Trash2 className="h-3 w-3" /> Excluir
                              </button>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {colCards.length === 0 && (
                        <p className="text-xs text-muted-foreground/50 text-center py-6 italic">Nenhuma tarefa</p>
                      )}
                      {colCards.map(renderCard)}
                    </div>
                  </div>
                );
              })}
              {/* Add column button + templates */}
              {activeBoard !== "geral" && (
                <div className="min-w-[220px] flex items-start pt-2">
                  {showNewCol ? (
                    <div className="space-y-2 w-full">
                      <Input value={newColTitle} onChange={e => setNewColTitle(e.target.value)} placeholder="Nome da coluna" className="h-8 text-sm" autoFocus />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-xs" onClick={handleAddCol}>Criar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowNewCol(false); setNewColTitle(""); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full space-y-1">
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full justify-start gap-1.5" onClick={() => setShowNewCol(true)}>
                        <Plus className="h-3 w-3" /> Coluna
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full justify-start gap-1.5">
                            <Sparkles className="h-3 w-3" /> Aplicar template
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-1" align="start">
                          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Modelos operacionais
                          </div>
                          {TEMPLATES.map((t: BoardTemplate) => (
                            <button
                              key={t.id}
                              className="w-full text-left px-2 py-2 rounded hover:bg-muted flex items-start gap-2"
                              onClick={async () => {
                                if (!confirm(`Adicionar ${t.columns.length} colunas do template "${t.name}"?`)) return;
                                const startPos = allColumns.filter(c => c.board === activeBoard).reduce((m, c) => Math.max(m, c.position), -1) + 1;
                                const rows = t.columns.map((c, i) => ({ title: c.title, color: c.color, position: startPos + i, board: activeBoard }));
                                const { error } = await supabase.from("imphq_kanban_columns").insert(rows);
                                if (error) { toast.error("Erro ao aplicar template"); return; }
                                toast.success(`Template "${t.name}" aplicado`);
                                loadAllData();
                              }}
                            >
                              <span className="text-base leading-none">{t.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold">{t.name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{t.description}</div>
                                <div className="flex gap-1 mt-1">
                                  {t.columns.map((c, i) => (
                                    <span key={i} className="h-1.5 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
                                  ))}
                                </div>
                              </div>
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === "sheet" ? (
            /* ====== SHEET (PLANILHA) VIEW ====== */
            <KanbanSheetView
              cards={displayColumns.flatMap(col => cardsForCol(col)) as any}
              columns={displayColumns as any}
              members={members}
              projects={projects}
              onReload={loadAllData}
            />
          ) : (
            /* ====== LIST VIEW ====== */
            <div className="space-y-2">
              {displayColumns.map(col => {
                const colTitle = normalizeColTitle(col.title);
                const config = COL_CONFIG[colTitle] || COL_CONFIG.backlog;
                const colCards = cardsForCol(col);
                const isCollapsed = collapsedGroups.has(col.id);
                return (
                  <Collapsible key={col.id} open={!isCollapsed} onOpenChange={() => toggleGroup(col.id)}>
                    <CollapsibleTrigger asChild>
                      <div
                        className={`rounded-md ${config.headerBg} px-4 py-2.5 flex items-center gap-2 cursor-pointer hover:opacity-80`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                      >
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {config.icon}
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">{col.title}</span>
                        <Badge variant="outline" className="text-[10px] h-5 ml-1">{colCards.length}</Badge>
                        <button
                          className="ml-auto h-5 w-5 flex items-center justify-center rounded hover:bg-background/50"
                          onClick={(e) => { e.stopPropagation(); setInlineCreateCol(inlineCreateCol === col.id ? null : col.id); setInlineCreateTitle(""); }}
                          title="Criar tarefa"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div
                        onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; e.currentTarget.classList.add("ring-1", "ring-primary/30", "bg-primary/5"); }}
                        onDragLeave={(e: React.DragEvent<HTMLDivElement>) => { e.currentTarget.classList.remove("ring-1", "ring-primary/30", "bg-primary/5"); }}
                        onDrop={(e: React.DragEvent<HTMLDivElement>) => { e.currentTarget.classList.remove("ring-1", "ring-primary/30", "bg-primary/5"); handleDrop(e as unknown as DragEvent, col.id); }}
                        className="transition-colors rounded-b-md"
                      >
                      {/* Inline create */}
                      {inlineCreateCol === col.id && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
                          <Input
                            value={inlineCreateTitle}
                            onChange={e => setInlineCreateTitle(e.target.value)}
                            placeholder="Título da tarefa..."
                            className="h-7 text-sm flex-1"
                            autoFocus
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && inlineCreateTitle.trim()) {
                                const board = activeBoard === "geral" ? "agentes" : activeBoard;
                                let targetColId = col.id;
                                if (activeBoard === "geral") {
                                  const boardCol = allColumns.find(c => c.board === board && normalizeColTitle(c.title) === colTitle);
                                  if (boardCol) targetColId = boardCol.id;
                                }
                                await supabase.from("imphq_kanban_cards").insert({
                                  column_id: targetColId, title: inlineCreateTitle.trim(), priority: "medium",
                                  board, position: allCards.filter(c => c.column_id === targetColId).length, tags: [],
                                });
                                toast.success("Tarefa criada!");
                                setInlineCreateCol(null); setInlineCreateTitle("");
                                loadAllData();
                              } else if (e.key === "Escape") {
                                setInlineCreateCol(null); setInlineCreateTitle("");
                              }
                            }}
                          />
                          <Button size="sm" className="h-7 text-xs" onClick={async () => {
                            if (!inlineCreateTitle.trim()) return;
                            const board = activeBoard === "geral" ? "agentes" : activeBoard;
                            let targetColId = col.id;
                            if (activeBoard === "geral") {
                              const boardCol = allColumns.find(c => c.board === board && normalizeColTitle(c.title) === colTitle);
                              if (boardCol) targetColId = boardCol.id;
                            }
                            await supabase.from("imphq_kanban_cards").insert({
                              column_id: targetColId, title: inlineCreateTitle.trim(), priority: "medium",
                              board, position: allCards.filter(c => c.column_id === targetColId).length, tags: [],
                            });
                            toast.success("Tarefa criada!");
                            setInlineCreateCol(null); setInlineCreateTitle("");
                            loadAllData();
                          }}>Criar</Button>
                        </div>
                      )}
                      {colCards.length === 0 && !inlineCreateCol ? (
                        <p className="text-xs text-muted-foreground/50 text-center py-3 italic">Nenhuma tarefa</p>
                      ) : colCards.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-[10px] h-7">Tarefa</TableHead>
                              <TableHead className="text-[10px] h-7 w-[80px]">Prioridade</TableHead>
                              <TableHead className="text-[10px] h-7 w-[100px]">Responsável</TableHead>
                              <TableHead className="text-[10px] h-7 w-[100px]">Projeto</TableHead>
                              <TableHead className="text-[10px] h-7 w-[80px]">Prazo</TableHead>
                              {activeBoard === "geral" && <TableHead className="text-[10px] h-7 w-[70px]">Board</TableHead>}
                              <TableHead className="text-[10px] h-7 w-[50px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {colCards.map(card => {
                              const member = getMember(card.member_id);
                              const projName = getProjectName(card.project_id);
                              return (
                                <TableRow
                                  key={card.id}
                                  className={`hover:bg-muted/50 ${dragCardId === card.id ? "opacity-50" : ""}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e as unknown as DragEvent, card.id)}
                                >
                                  <TableCell className="text-sm py-2 cursor-pointer" onClick={() => setEditCard({ ...card })}>
                                    <div className="flex items-center gap-2">
                                      <span className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[card.priority] || PRIORITY_DOT.medium}`} />
                                      {card.title}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                                    <Select
                                      value={card.priority}
                                      onValueChange={async (v) => {
                                        await supabase.from("imphq_kanban_cards").update({ priority: v }).eq("id", card.id);
                                        loadAllData();
                                      }}
                                    >
                                      <SelectTrigger className="h-6 text-[10px] border-none bg-transparent px-1 w-[70px]">
                                        <span className={`h-1.5 w-1.5 rounded-full mr-1 ${PRIORITY_DOT[card.priority]}`} />
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low">Baixa</SelectItem>
                                        <SelectItem value="medium">Média</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                        <SelectItem value="urgent">Urgente</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                                    <Select
                                      value={card.member_id || "none"}
                                      onValueChange={async (v) => {
                                        await supabase.from("imphq_kanban_cards").update({ member_id: v === "none" ? null : v }).eq("id", card.id);
                                        loadAllData();
                                      }}
                                    >
                                      <SelectTrigger className="h-6 text-[10px] border-none bg-transparent px-1 w-[90px]">
                                        <SelectValue placeholder="—" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Nenhum</SelectItem>
                                        {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                                    <Select
                                      value={card.project_id || "none"}
                                      onValueChange={async (v) => {
                                        await supabase.from("imphq_kanban_cards").update({ project_id: v === "none" ? null : v }).eq("id", card.id);
                                        loadAllData();
                                      }}
                                    >
                                      <SelectTrigger className="h-6 text-[10px] border-none bg-transparent px-1 w-[90px]">
                                        <SelectValue placeholder="—" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Nenhum</SelectItem>
                                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                                    <Input
                                      type="date"
                                      value={card.due_date ? card.due_date.split("T")[0] : ""}
                                      onChange={async (e) => {
                                        await supabase.from("imphq_kanban_cards").update({ due_date: e.target.value || null }).eq("id", card.id);
                                        loadAllData();
                                      }}
                                      className={`h-6 text-[10px] border-none bg-transparent px-1 w-[90px] ${card.due_date && isOverdue(card.due_date) ? "text-destructive" : "text-muted-foreground"}`}
                                    />
                                  </TableCell>
                                  {activeBoard === "geral" && (
                                    <TableCell className="py-2">
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{card.board}</Badge>
                                    </TableCell>
                                  )}
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-0.5">
                                      <button onClick={(e) => { e.stopPropagation(); quickMarkDone(card); }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-success/20 text-success"><Check className="h-3 w-3" /></button>
                                      <button onClick={(e) => { e.stopPropagation(); quickDelete(card.id); }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/20 text-destructive"><Trash2 className="h-3 w-3" /></button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : null}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>
      </Tabs>

      {/* New Card Dialog */}
      <Dialog open={!!showNewCard} onOpenChange={() => setShowNewCard(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Card</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título do card" /></div>
            <div><Label>Descrição</Label><Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data Limite</Label><Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} /></div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={newMemberId} onValueChange={setNewMemberId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                          <AvatarFallback className="text-[8px] bg-secondary">{(m.name || "?")[0]}</AvatarFallback>
                        </Avatar>
                        {m.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {activeBoard === "geral" && (
              <div>
                <Label>Quadro</Label>
                <Select value={newBoard} onValueChange={setNewBoard}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOARDS.filter(b => b !== "geral").map(b => <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={createCard}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Column Dialog */}
      <Dialog open={!!renameCol} onOpenChange={() => setRenameCol(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear Coluna</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder="Novo nome" />
          <DialogFooter><Button onClick={handleRenameCol}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Dialog */}
      <Dialog open={!!deleteCol} onOpenChange={() => setDeleteCol(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Coluna</DialogTitle></DialogHeader>
          {deleteCol && allCards.filter(c => c.column_id === deleteCol.id).length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Esta coluna tem cards. Mover para:</p>
              <Select value={moveToColId} onValueChange={setMoveToColId}>
                <SelectTrigger><SelectValue placeholder="Selecionar coluna" /></SelectTrigger>
                <SelectContent>
                  {allColumns.filter(c => c.board === deleteCol.board && c.id !== deleteCol.id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DialogFooter><Button variant="destructive" onClick={handleDeleteCol} disabled={!moveToColId}>Excluir e mover</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Excluir esta coluna vazia?</p>
              <DialogFooter><Button variant="destructive" onClick={handleDeleteCol}>Excluir</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Card Detail Panel */}
      <CardDetailPanel
        card={editCard}
        open={!!editCard}
        onClose={() => setEditCard(null)}
        onUpdate={loadAllData}
        columns={allColumns}
        members={members}
        projects={projects}
      />

      {/* AI Doc Dialog */}
      <Dialog open={showAiDoc} onOpenChange={setShowAiDoc}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle>📄 Documento Gerado por IA</DialogTitle></DialogHeader>
          <Textarea value={aiDocResult} readOnly className="min-h-[300px] text-sm font-mono" />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(aiDocResult); toast.success("Copiado!"); }}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAiDoc(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
