import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileUpload } from "@/components/FileUpload";
import {
  Trash2, Plus, Send, CheckSquare, MessageSquare,
  Calendar, User, Columns, Paperclip, X, FolderOpen,
  Clock, Tag, Link2, ArrowRight, Search, Download, UserCircle2
} from "lucide-react";
import { toast } from "sonner";
import { updateCalendarEventForCard, removeCalendarEventForCard } from "@/lib/calendarSync";

interface KanbanCard {
  id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  tags: string[];
  board: string;
  position?: number;
  member_id?: string;
  project_id?: string;
  metadata?: any;
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

interface ChecklistItem {
  id: string;
  card_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
  member_id?: string;
}

interface Comment {
  id: string;
  card_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface Attachment {
  id: string;
  card_id: string;
  file_url: string;
  file_name: string;
  file_type?: string;
  created_at: string;
}

interface CardRelation {
  id: string;
  card_id: string;
  related_card_id: string;
  relation_type: string;
  created_at: string;
  related_card?: { id: string; title: string; priority: string; board: string };
}

interface CardDetailPanelProps {
  card: KanbanCard | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  columns: Column[];
  members: TeamMember[];
  projects?: { id: string; name: string; data?: any }[];
}

const BOARDS = ["geral", "agentes", "humanas", "criativos", "campanhas"];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgente", color: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  high: { label: "Alta", color: "bg-warning/15 text-warning border-warning/30", dot: "bg-warning" },
  medium: { label: "Média", color: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  low: { label: "Baixa", color: "bg-muted text-muted-foreground border-muted-foreground/30", dot: "bg-muted-foreground/40" },
};

const RELATION_TYPES = [
  { value: "related", label: "Relacionado" },
  { value: "blocks", label: "Bloqueia" },
  { value: "blocked_by", label: "Bloqueado por" },
  { value: "sequencia", label: "Próximo passo" },
];

const RELATION_COLORS: Record<string, string> = {
  related: "bg-primary/10 text-primary border-primary/20",
  blocks: "bg-destructive/10 text-destructive border-destructive/20",
  blocked_by: "bg-warning/10 text-warning border-warning/20",
  sequencia: "bg-success/10 text-success border-success/20",
};

export default function CardDetailPanel({ card, open, onClose, onUpdate, columns, members, projects = [] }: CardDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [columnId, setColumnId] = useState("");
  const [memberId, setMemberId] = useState("none");
  const [projectId, setProjectId] = useState("none");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Metadata fields
  const [startDate, setStartDate] = useState("");
  const [timeEstimate, setTimeEstimate] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newCheckMember, setNewCheckMember] = useState<string>("none");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Relations
  const [relations, setRelations] = useState<CardRelation[]>([]);
  const [allCards, setAllCards] = useState<{ id: string; title: string; priority: string; board: string }[]>([]);
  const [relationSearch, setRelationSearch] = useState("");
  const [showRelationSearch, setShowRelationSearch] = useState(false);
  const [newRelationType, setNewRelationType] = useState("related");

  const saveTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description || "");
    setPriority(card.priority || "medium");
    setDueDate(card.due_date || "");
    setColumnId(card.column_id);
    setMemberId(card.member_id || "none");
    setProjectId(card.project_id || "none");
    setTags(card.tags || []);

    const meta = card.metadata || {};
    setStartDate(meta.start_date || "");
    setTimeEstimate(meta.time_estimate || "");
    setCustomFields(meta.custom_fields || {});

    loadChecklist(card.id);
    loadComments(card.id);
    loadAttachments(card.id);
    loadRelations(card.id);
    loadAllCards();
  }, [card]);

  const loadChecklist = async (cardId: string) => {
    const { data } = await supabase.from("imphq_card_checklists").select("*").eq("card_id", cardId).order("position");
    setChecklist((data as any[]) || []);
  };

  const loadComments = async (cardId: string) => {
    const { data } = await supabase.from("imphq_card_comments").select("*").eq("card_id", cardId).order("created_at", { ascending: false });
    setComments((data as any[]) || []);
  };

  const loadAttachments = async (cardId: string) => {
    const { data } = await supabase.from("imphq_card_attachments").select("*").eq("card_id", cardId).order("created_at", { ascending: false });
    setAttachments((data as any[]) || []);
  };

  const loadRelations = async (cardId: string) => {
    const { data } = await supabase.from("imphq_card_relations").select("*").or(`card_id.eq.${cardId},related_card_id.eq.${cardId}`);
    if (!data) { setRelations([]); return; }

    // Load related card titles
    const relatedIds = (data as any[]).map(r => r.card_id === cardId ? r.related_card_id : r.card_id);
    const { data: relatedCards } = await supabase.from("imphq_kanban_cards").select("id, title, priority, board").in("id", relatedIds);

    const enriched = (data as any[]).map(r => {
      const isSource = r.card_id === cardId;
      const relId = isSource ? r.related_card_id : r.card_id;
      const relCard = (relatedCards || []).find((c: any) => c.id === relId);
      return {
        ...r,
        relation_type: isSource ? r.relation_type : (r.relation_type === "blocks" ? "blocked_by" : r.relation_type === "blocked_by" ? "blocks" : r.relation_type),
        related_card: relCard || { id: relId, title: "Card não encontrado", priority: "medium", board: "" },
      };
    });
    setRelations(enriched);
  };

  const loadAllCards = async () => {
    const { data } = await supabase.from("imphq_kanban_cards").select("id, title, priority, board").limit(500);
    setAllCards((data as any[]) || []);
  };

  const autoSave = useCallback((field: string, value: any) => {
    if (!card) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("imphq_kanban_cards").update({ [field]: value } as any).eq("id", card.id);
      onUpdate();
    }, 600);
  }, [card, onUpdate]);

  const saveMetadata = useCallback((updates: Record<string, any>) => {
    if (!card) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const currentMeta = card.metadata || {};
      const newMeta = { ...currentMeta, ...updates };
      await supabase.from("imphq_kanban_cards").update({ metadata: newMeta } as any).eq("id", card.id);
      onUpdate();
    }, 600);
  }, [card, onUpdate]);

  const handleTitleChange = (v: string) => { setTitle(v); autoSave("title", v); };
  const handleDescChange = (v: string) => { setDescription(v); autoSave("description", v); };
  const handlePriorityChange = (v: string) => { setPriority(v); autoSave("priority", v); };
  const handleDueDateChange = (v: string) => { setDueDate(v); autoSave("due_date", v || null); if (card) updateCalendarEventForCard(card.id, v || null); };
  const handleMemberChange = (v: string) => { setMemberId(v); autoSave("member_id", v === "none" ? null : v); };
  const handleProjectChange = (v: string) => { setProjectId(v); autoSave("project_id", v === "none" ? null : v); };
  const handleStartDateChange = (v: string) => { setStartDate(v); saveMetadata({ start_date: v || null }); };
  const handleTimeEstimateChange = (v: string) => { setTimeEstimate(v); saveMetadata({ time_estimate: v || null }); };

  const handleColumnChange = async (v: string) => {
    if (!card) return;
    setColumnId(v);
    const target = columns.find(c => c.id === v);
    const updates: any = { column_id: v };
    if (target && target.board && target.board !== card.board) {
      updates.board = target.board;
    }
    await supabase.from("imphq_kanban_cards").update(updates).eq("id", card.id);
    onUpdate();
  };

  const handleBoardChange = async (newBoard: string) => {
    if (!card || newBoard === card.board) return;
    // Find first column of the new board
    const newBoardCols = columns.filter(c => c.board === newBoard).sort((a, b) => (a.position || 0) - (b.position || 0));
    const firstCol = newBoardCols[0];
    if (!firstCol) { toast.error("Board sem colunas"); return; }
    await supabase.from("imphq_kanban_cards").update({ board: newBoard, column_id: firstCol.id } as any).eq("id", card.id);
    setColumnId(firstCol.id);
    toast.success(`Movido para board "${newBoard}"`);
    onUpdate();
  };

  // Tags
  const addTag = () => {
    if (!newTag.trim() || !card) return;
    const updated = [...tags, newTag.trim()];
    setTags(updated);
    setNewTag("");
    autoSave("tags", updated);
  };
  const removeTag = (idx: number) => {
    const updated = tags.filter((_, i) => i !== idx);
    setTags(updated);
    autoSave("tags", updated);
  };

  // Custom fields
  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    const updated = { ...customFields, [newFieldName.trim()]: newFieldValue };
    setCustomFields(updated);
    setNewFieldName("");
    setNewFieldValue("");
    saveMetadata({ custom_fields: updated });
  };
  const updateCustomField = (key: string, value: string) => {
    const updated = { ...customFields, [key]: value };
    setCustomFields(updated);
    saveMetadata({ custom_fields: updated });
  };
  const removeCustomField = (key: string) => {
    const updated = { ...customFields };
    delete updated[key];
    setCustomFields(updated);
    saveMetadata({ custom_fields: updated });
  };

  // Checklist
  const addCheckItem = async () => {
    if (!card || !newCheckItem.trim()) return;
    const insertData: any = { card_id: card.id, title: newCheckItem.trim(), position: checklist.length };
    if (newCheckMember !== "none") insertData.member_id = newCheckMember;
    await supabase.from("imphq_card_checklists").insert(insertData);
    setNewCheckItem("");
    setNewCheckMember("none");
    loadChecklist(card.id);
  };
  const toggleCheckItem = async (item: ChecklistItem) => {
    await supabase.from("imphq_card_checklists").update({ is_done: !item.is_done } as any).eq("id", item.id);
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, is_done: !c.is_done } : c));
  };
  const deleteCheckItem = async (id: string) => {
    await supabase.from("imphq_card_checklists").delete().eq("id", id);
    setChecklist(prev => prev.filter(c => c.id !== id));
  };
  const updateCheckMember = async (itemId: string, memberId: string) => {
    const val = memberId === "none" ? null : memberId;
    await supabase.from("imphq_card_checklists").update({ member_id: val } as any).eq("id", itemId);
    setChecklist(prev => prev.map(c => c.id === itemId ? { ...c, member_id: val || undefined } : c));
  };

  // Comments
  const addComment = async () => {
    if (!card || !newComment.trim()) return;
    await supabase.from("imphq_card_comments").insert({ card_id: card.id, author_name: "Time", content: newComment.trim() } as any);
    setNewComment("");
    loadComments(card.id);
  };

  // Attachments
  const handleAttachmentUpload = async (url: string) => {
    if (!card) return;
    const fileName = url.split("/").pop() || "arquivo";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const videoExts = ["mp4", "webm", "mov", "avi"];
    let fileType = "application/octet-stream";
    if (imageExts.includes(ext)) fileType = `image/${ext === "jpg" ? "jpeg" : ext}`;
    else if (videoExts.includes(ext)) fileType = `video/${ext}`;
    await supabase.from("imphq_card_attachments").insert({ card_id: card.id, file_url: url, file_name: fileName, file_type: fileType } as any);
    loadAttachments(card.id);
    onUpdate();
  };
  const deleteAttachment = async (id: string) => {
    await supabase.from("imphq_card_attachments").delete().eq("id", id);
    setAttachments(prev => prev.filter(a => a.id !== id));
    onUpdate();
  };

  const downloadAttachment = async (att: Attachment) => {
    try {
      const res = await fetch(att.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.file_name || "arquivo";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab if fetch blocked by CORS
      window.open(att.file_url, "_blank", "noopener,noreferrer");
    }
  };

  // Relations
  const addRelation = async (relatedCardId: string) => {
    if (!card) return;
    const { error } = await supabase.from("imphq_card_relations").insert({
      card_id: card.id,
      related_card_id: relatedCardId,
      relation_type: newRelationType,
    } as any);
    if (error) { toast.error("Erro ao vincular tarefa"); return; }
    setShowRelationSearch(false);
    setRelationSearch("");
    loadRelations(card.id);
  };
  const deleteRelation = async (id: string) => {
    await supabase.from("imphq_card_relations").delete().eq("id", id);
    if (card) loadRelations(card.id);
  };

  const deleteCard = async () => {
    if (!card) return;
    if (!confirm("Excluir esta tarefa permanentemente?")) return;
    removeCalendarEventForCard(card.id);
    await supabase.from("imphq_kanban_cards").delete().eq("id", card.id);
    toast.success("Tarefa excluída");
    onClose();
    onUpdate();
  };

  if (!card) return null;

  // Disambiguate duplicate column titles within the same board (keep all real columns)
  const labelColumns = (cols: Column[]) => {
    const counts = new Map<string, number>();
    cols.forEach(c => counts.set(c.title, (counts.get(c.title) || 0) + 1));
    const seen = new Map<string, number>();
    return cols.map(c => {
      if ((counts.get(c.title) || 0) > 1) {
        const idx = (seen.get(c.title) || 0) + 1;
        seen.set(c.title, idx);
        return { ...c, displayTitle: `${c.title} (${idx})` };
      }
      return { ...c, displayTitle: c.title };
    });
  };
  const rawBoardColumns = columns.filter(c => c.board === card.board);
  const boardColumns = labelColumns(rawBoardColumns);
  const useFallback = boardColumns.length === 0;
  if (useFallback) {
    console.warn(`[Kanban] Board "${card.board}" sem colunas — exibindo fallback multi-board`);
  }
  // Group all columns by board for fallback
  const columnsByBoard = columns.reduce<Record<string, Column[]>>((acc, c) => {
    const b = c.board || "outros";
    (acc[b] = acc[b] || []).push(c);
    return acc;
  }, {});
  // Ensure current column is always selectable
  const currentCol = columns.find(c => c.id === columnId);
  const currentInList = boardColumns.some(c => c.id === columnId);
  const doneCount = checklist.filter(c => c.is_done).length;
  const totalCheck = checklist.length;
  const checkProgress = totalCheck > 0 ? (doneCount / totalCheck) * 100 : 0;
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const member = members.find(m => m.id === memberId);
  const project = projects.find(p => p.id === projectId);
  const isImage = (type?: string) => type?.startsWith("image/");
  const isVideo = (type?: string) => type?.startsWith("video/");

  const filteredSearchCards = allCards
    .filter(c => c.id !== card.id && c.title.toLowerCase().includes(relationSearch.toLowerCase()))
    .slice(0, 8);

  const TAG_COLORS = ["bg-primary/15 text-primary", "bg-warning/15 text-warning", "bg-success/15 text-success", "bg-destructive/15 text-destructive", "bg-accent text-accent-foreground"];

  return (
    <>
      <Sheet open={open} onOpenChange={() => onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {/* Header */}
          <div className="p-5 pb-3 border-b border-border space-y-3">
            <div className="flex items-start gap-2">
              <span className={`h-2.5 w-2.5 rounded-full mt-2 shrink-0 ${pConfig.dot}`} />
              <Input
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                placeholder="Título da tarefa"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-[10px] ${pConfig.color}`}>{pConfig.label}</Badge>
              {project && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 text-primary border-primary/20">
                  <FolderOpen className="h-2.5 w-2.5" /> {project.name}
                </Badge>
              )}
              {member && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px] bg-secondary">{member.name[0]}</AvatarFallback>
                  </Avatar>
                  {member.name}
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-5 space-y-4">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <User className="h-3 w-3" /> Responsável
                  </Label>
                  <Select value={memberId} onValueChange={handleMemberChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={m.avatar_url || undefined} />
                              <AvatarFallback className="text-[7px] bg-secondary">{m.name[0]}</AvatarFallback>
                            </Avatar>
                            {m.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1">Prioridade</Label>
                  <Select value={priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="h-3 w-3" /> Início
                  </Label>
                  <Input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="h-3 w-3" /> Prazo
                  </Label>
                  <Input type="date" value={dueDate} onChange={e => handleDueDateChange(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Columns className="h-3 w-3" /> Board
                  </Label>
                  <Select value={card.board} onValueChange={handleBoardChange}>
                    <SelectTrigger className="h-8 text-xs capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOARDS.filter(b => b !== "geral").map(b => (
                        <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Columns className="h-3 w-3" /> Coluna
                  </Label>
                  <Select value={columnId} onValueChange={handleColumnChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {!useFallback && currentCol && !currentInList && (
                        <SelectItem value={currentCol.id}>
                          {currentCol.title} (atual)
                        </SelectItem>
                      )}
                      {!useFallback && boardColumns.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.displayTitle}</SelectItem>
                      ))}
                      {useFallback && Object.entries(columnsByBoard).map(([boardName, cols]) => (
                        <SelectGroup key={boardName}>
                          <SelectLabel className="capitalize">{boardName}</SelectLabel>
                          {labelColumns(cols).map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.displayTitle}{c.id === columnId ? " (atual)" : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Clock className="h-3 w-3" /> Estimativa
                  </Label>
                  <Input value={timeEstimate} onChange={e => handleTimeEstimateChange(e.target.value)} placeholder="ex: 4h, 2d" className="h-8 text-xs" />
                </div>
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <FolderOpen className="h-3 w-3" /> Projeto
                  </Label>
                  <Select value={projectId} onValueChange={handleProjectChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem projeto</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Expert (derived from project) — change project to switch expert */}
              {projects.length > 0 && (() => {
                const expertMap = new Map<string, { id: string; name: string }[]>();
                projects.forEach(p => {
                  const exp = p.data?.expert?.nome || "Sem Expert";
                  if (!expertMap.has(exp)) expertMap.set(exp, []);
                  expertMap.get(exp)!.push({ id: p.id, name: p.name });
                });
                const currentProj = projects.find(p => p.id === projectId);
                const currentExpert = currentProj?.data?.expert?.nome || "none";
                const handleExpertChange = (expertName: string) => {
                  if (expertName === "none") { handleProjectChange("none"); return; }
                  const projsOfExpert = expertMap.get(expertName) || [];
                  // Keep current project if already belongs to this expert; otherwise pick the first
                  const stay = projsOfExpert.find(p => p.id === projectId);
                  const target = stay?.id || projsOfExpert[0]?.id;
                  if (target) handleProjectChange(target);
                };
                return (
                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                      <UserCircle2 className="h-3 w-3" /> Expert
                    </Label>
                    <Select value={currentExpert} onValueChange={handleExpertChange}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem expert" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem expert</SelectItem>
                        {Array.from(expertMap.keys()).filter(n => n !== "Sem Expert").map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Trocar o expert reatribui o projeto do card automaticamente.
                    </p>
                  </div>
                );
              })()}

              {/* Tags */}
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
                  <Tag className="h-3 w-3" /> Tags
                </Label>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {tags.map((tag, i) => (
                    <Badge key={i} className={`text-[10px] gap-1 ${TAG_COLORS[i % TAG_COLORS.length]}`}>
                      {tag}
                      <button onClick={() => removeTag(i)} className="hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nova tag..." className="h-7 text-xs" onKeyDown={e => e.key === "Enter" && addTag()} />
                  <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={addTag}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>

              <Separator />

              {/* Custom Fields */}
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5 block">Campos personalizados</Label>
                <div className="space-y-1.5">
                  {Object.entries(customFields).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 group">
                      <span className="text-[11px] text-muted-foreground w-24 truncate shrink-0">{key}</span>
                      <Input
                        value={val}
                        onChange={e => updateCustomField(key, e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <button onClick={() => removeCustomField(key)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <Input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Nome do campo" className="h-7 text-xs w-28" />
                  <Input value={newFieldValue} onChange={e => setNewFieldValue(e.target.value)} placeholder="Valor" className="h-7 text-xs flex-1" onKeyDown={e => e.key === "Enter" && addCustomField()} />
                  <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={addCustomField}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1">Descrição</Label>
                <Textarea
                  value={description}
                  onChange={e => handleDescChange(e.target.value)}
                  placeholder="Adicione uma descrição..."
                  className="min-h-[80px] text-sm resize-none"
                />
              </div>

              <Separator />

              {/* Related Tasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Tarefas relacionadas ({relations.length})
                  </Label>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setShowRelationSearch(!showRelationSearch)}>
                    <Plus className="h-2.5 w-2.5 mr-1" /> Vincular
                  </Button>
                </div>
                {showRelationSearch && (
                  <div className="mb-3 space-y-2 bg-muted/20 rounded-md p-2 border border-border">
                    <div className="flex gap-2">
                      <Select value={newRelationType} onValueChange={setNewRelationType}>
                        <SelectTrigger className="h-7 text-[10px] w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RELATION_TYPES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1 relative">
                        <Search className="h-3 w-3 absolute left-2 top-2 text-muted-foreground" />
                        <Input value={relationSearch} onChange={e => setRelationSearch(e.target.value)} placeholder="Buscar tarefa..." className="h-7 text-xs pl-7" />
                      </div>
                    </div>
                    {relationSearch && (
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {filteredSearchCards.map(c => (
                          <button
                            key={c.id}
                            onClick={() => addRelation(c.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted/50 flex items-center gap-2"
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CONFIG[c.priority]?.dot || "bg-muted-foreground"}`} />
                            <span className="truncate flex-1">{c.title}</span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0">{c.board}</Badge>
                          </button>
                        ))}
                        {filteredSearchCards.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">Nenhuma tarefa encontrada</p>}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  {relations.map(rel => (
                    <div key={rel.id} className="flex items-center gap-2 group py-1">
                      <Badge className={`text-[9px] shrink-0 ${RELATION_COLORS[rel.relation_type] || "bg-muted"}`}>
                        {RELATION_TYPES.find(r => r.value === rel.relation_type)?.label || rel.relation_type}
                      </Badge>
                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate flex-1">{rel.related_card?.title}</span>
                      <button onClick={() => deleteRelation(rel.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {relations.length === 0 && !showRelationSearch && (
                    <p className="text-xs text-muted-foreground text-center py-2 italic">Nenhuma tarefa vinculada</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> Anexos ({attachments.length})
                  </Label>
                  <FileUpload
                    bucket="project-docs"
                    path={`card-attachments/${card.id}`}
                    onUpload={handleAttachmentUpload}
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    label="Anexar"
                    multiple
                  />
                </div>
                {attachments.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {attachments.map(att => (
                      <div key={att.id} className="relative group rounded-md border border-border overflow-hidden bg-muted/20">
                        {isImage(att.file_type) ? (
                          <img src={att.file_url} alt={att.file_name} className="w-full h-20 object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setLightboxUrl(att.file_url)} />
                        ) : isVideo(att.file_type) ? (
                          <video src={att.file_url} className="w-full h-20 object-cover cursor-pointer" onClick={() => setLightboxUrl(att.file_url)} />
                        ) : (
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-20 text-xs text-muted-foreground hover:text-foreground">
                            <Paperclip className="h-5 w-5" />
                          </a>
                        )}
                        <p className="text-[9px] text-muted-foreground truncate px-1.5 py-1">{att.file_name}</p>
                        <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadAttachment(att); }}
                            className="bg-background/80 hover:bg-background text-foreground rounded-full p-1 backdrop-blur-sm"
                            title="Baixar"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                            className="bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full p-1"
                            title="Excluir"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {attachments.length === 0 && <p className="text-xs text-muted-foreground text-center py-3 italic">Nenhum anexo</p>}
              </div>

              <Separator />

              {/* Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CheckSquare className="h-3 w-3" /> Checklist
                    {totalCheck > 0 && <span className="font-mono">({doneCount}/{totalCheck})</span>}
                  </Label>
                </div>
                {totalCheck > 0 && <Progress value={checkProgress} className="h-1.5 mb-3" />}
                <div className="space-y-1">
                  {checklist.map(item => {
                    const assignee = members.find(m => m.id === item.member_id);
                    return (
                      <div key={item.id} className="flex items-center gap-2 group py-1">
                        <Checkbox checked={item.is_done} onCheckedChange={() => toggleCheckItem(item)} className="shrink-0" />
                        <span className={`text-sm flex-1 ${item.is_done ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                        <Select value={item.member_id || "none"} onValueChange={(v) => updateCheckMember(item.id, v)}>
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent [&>svg]:hidden shrink-0">
                            <SelectValue>
                              {assignee ? (
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={assignee.avatar_url || undefined} />
                                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{assignee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground/50" />
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem responsável</SelectItem>
                            {members.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={m.avatar_url || undefined} />
                                    <AvatarFallback className="text-[7px]">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  {m.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button onClick={() => deleteCheckItem(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} placeholder="Nova subtarefa..." className="h-8 text-xs flex-1" onKeyDown={e => e.key === "Enter" && addCheckItem()} />
                  <Select value={newCheckMember} onValueChange={setNewCheckMember}>
                    <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                      <SelectValue placeholder="Resp." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={m.avatar_url || undefined} />
                              <AvatarFallback className="text-[7px]">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{m.name.split(" ")[0]}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={addCheckItem}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>

              <Separator />

              {/* Comments */}
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
                  <MessageSquare className="h-3 w-3" /> Anotações ({comments.length})
                </Label>
                <div className="flex gap-2 mb-3">
                  <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Adicionar nota ou comentário..." className="min-h-[60px] text-xs resize-none" onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(); }} />
                  <Button size="sm" variant="outline" className="h-8 px-2 shrink-0 self-end" onClick={addComment}><Send className="h-3 w-3" /></Button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="bg-muted/30 rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-foreground">{c.author_name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}
                  {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-3 italic">Nenhuma anotação ainda</p>}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button variant="destructive" size="sm" className="w-full" onClick={deleteCard}>
              <Trash2 className="h-3 w-3 mr-1" /> Excluir Tarefa
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-2">
          {lightboxUrl && (
            lightboxUrl.match(/\.(mp4|webm|mov|avi)$/i) ? (
              <video src={lightboxUrl} controls className="w-full max-h-[80vh] rounded" />
            ) : (
              <img src={lightboxUrl} alt="Anexo" className="w-full max-h-[80vh] object-contain rounded" />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
