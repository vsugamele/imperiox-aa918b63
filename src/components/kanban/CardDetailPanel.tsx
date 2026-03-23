import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2, Plus, Send, CheckSquare, MessageSquare,
  Calendar, User, Columns, GripVertical
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
  position?: number;
  member_id?: string;
  project_id?: string;
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
}

interface Comment {
  id: string;
  card_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface CardDetailPanelProps {
  card: KanbanCard | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  columns: Column[];
  members: TeamMember[];
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgente", color: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  high: { label: "Alta", color: "bg-warning/15 text-warning border-warning/30", dot: "bg-warning" },
  medium: { label: "Média", color: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  low: { label: "Baixa", color: "bg-muted text-muted-foreground border-muted-foreground/30", dot: "bg-muted-foreground/40" },
};

export default function CardDetailPanel({ card, open, onClose, onUpdate, columns, members }: CardDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [columnId, setColumnId] = useState("");
  const [memberId, setMemberId] = useState("none");

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);

  const saveTimer = useRef<NodeJS.Timeout>();

  // Load card data
  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description || "");
    setPriority(card.priority || "medium");
    setDueDate(card.due_date || "");
    setColumnId(card.column_id);
    setMemberId(card.member_id || "none");
    loadChecklist(card.id);
    loadComments(card.id);
  }, [card]);

  const loadChecklist = async (cardId: string) => {
    const { data } = await supabase
      .from("imphq_card_checklists")
      .select("*")
      .eq("card_id", cardId)
      .order("position");
    setChecklist((data as any[]) || []);
  };

  const loadComments = async (cardId: string) => {
    const { data } = await supabase
      .from("imphq_card_comments")
      .select("*")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false });
    setComments((data as any[]) || []);
  };

  const autoSave = useCallback((field: string, value: any) => {
    if (!card) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("imphq_kanban_cards")
        .update({ [field]: value } as any)
        .eq("id", card.id);
      onUpdate();
    }, 600);
  }, [card, onUpdate]);

  const handleTitleChange = (v: string) => { setTitle(v); autoSave("title", v); };
  const handleDescChange = (v: string) => { setDescription(v); autoSave("description", v); };
  const handlePriorityChange = (v: string) => { setPriority(v); autoSave("priority", v); };
  const handleDueDateChange = (v: string) => { setDueDate(v); autoSave("due_date", v || null); };
  const handleMemberChange = (v: string) => {
    setMemberId(v);
    autoSave("member_id", v === "none" ? null : v);
  };
  const handleColumnChange = async (v: string) => {
    if (!card) return;
    setColumnId(v);
    await supabase.from("imphq_kanban_cards").update({ column_id: v } as any).eq("id", card.id);
    onUpdate();
  };

  // Checklist
  const addCheckItem = async () => {
    if (!card || !newCheckItem.trim()) return;
    const { error } = await supabase.from("imphq_card_checklists").insert({
      card_id: card.id,
      title: newCheckItem.trim(),
      position: checklist.length,
    } as any);
    if (error) { toast.error("Erro ao adicionar item"); return; }
    setNewCheckItem("");
    loadChecklist(card.id);
  };

  const toggleCheckItem = async (item: ChecklistItem) => {
    await supabase.from("imphq_card_checklists")
      .update({ is_done: !item.is_done } as any)
      .eq("id", item.id);
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, is_done: !c.is_done } : c));
  };

  const deleteCheckItem = async (id: string) => {
    await supabase.from("imphq_card_checklists").delete().eq("id", id);
    setChecklist(prev => prev.filter(c => c.id !== id));
  };

  // Comments
  const addComment = async () => {
    if (!card || !newComment.trim()) return;
    const { error } = await supabase.from("imphq_card_comments").insert({
      card_id: card.id,
      author_name: "Time",
      content: newComment.trim(),
    } as any);
    if (error) { toast.error("Erro ao adicionar comentário"); return; }
    setNewComment("");
    loadComments(card.id);
  };

  const deleteCard = async () => {
    if (!card) return;
    if (!confirm("Excluir esta tarefa permanentemente?")) return;
    await supabase.from("imphq_kanban_cards").delete().eq("id", card.id);
    toast.success("Tarefa excluída");
    onClose();
    onUpdate();
  };

  if (!card) return null;

  const boardColumns = columns.filter(c => c.board === card.board);
  const doneCount = checklist.filter(c => c.is_done).length;
  const totalCheck = checklist.length;
  const checkProgress = totalCheck > 0 ? (doneCount / totalCheck) * 100 : 0;
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const member = members.find(m => m.id === memberId);

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
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
            <Badge variant="outline" className="text-[10px] capitalize">{card.board}</Badge>
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
          <div className="p-5 space-y-5">
            {/* Metadata */}
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
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <Calendar className="h-3 w-3" /> Prazo
                </Label>
                <Input type="date" value={dueDate} onChange={e => handleDueDateChange(e.target.value)} className="h-8 text-xs" />
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
                  <Columns className="h-3 w-3" /> Coluna
                </Label>
                <Select value={columnId} onValueChange={handleColumnChange}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {boardColumns.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckSquare className="h-3 w-3" /> Checklist
                  {totalCheck > 0 && <span className="font-mono">({doneCount}/{totalCheck})</span>}
                </Label>
              </div>
              {totalCheck > 0 && (
                <Progress value={checkProgress} className="h-1.5 mb-3" />
              )}
              <div className="space-y-1">
                {checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group py-1">
                    <Checkbox
                      checked={item.is_done}
                      onCheckedChange={() => toggleCheckItem(item)}
                      className="shrink-0"
                    />
                    <span className={`text-sm flex-1 ${item.is_done ? "line-through text-muted-foreground" : ""}`}>
                      {item.title}
                    </span>
                    <button
                      onClick={() => deleteCheckItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newCheckItem}
                  onChange={e => setNewCheckItem(e.target.value)}
                  placeholder="Nova subtarefa..."
                  className="h-8 text-xs"
                  onKeyDown={e => e.key === "Enter" && addCheckItem()}
                />
                <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={addCheckItem}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Comments */}
            <div>
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
                <MessageSquare className="h-3 w-3" /> Anotações ({comments.length})
              </Label>
              <div className="flex gap-2 mb-3">
                <Textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Adicionar nota ou comentário..."
                  className="min-h-[60px] text-xs resize-none"
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(); }}
                />
                <Button size="sm" variant="outline" className="h-8 px-2 shrink-0 self-end" onClick={addComment}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="bg-muted/30 rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-foreground">{c.author_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(c.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3 italic">Nenhuma anotação ainda</p>
                )}
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
  );
}
