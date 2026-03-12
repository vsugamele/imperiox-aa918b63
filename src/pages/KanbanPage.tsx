import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { toast } from "sonner";

const BOARDS = ["agentes", "humanas", "criativos", "campanhas"];
const DEFAULT_COLUMNS = ["backlog", "doing", "stuck", "review", "done"];
const COL_COLORS: Record<string, string> = {
  backlog: "border-muted-foreground/30",
  doing: "border-primary/50",
  stuck: "border-destructive/50",
  review: "border-warning/50",
  done: "border-success/50",
};

interface KanbanColumn { id: string; title: string; color: string; position: number; board: string; }
interface KanbanCard {
  id: string; column_id: string; title: string; description?: string;
  priority: string; due_date?: string; tags: string[]; position: number; board: string;
}

export default function KanbanPage() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [activeBoard, setActiveBoard] = useState("agentes");
  const [showNewCard, setShowNewCard] = useState<string | null>(null);
  const [editCard, setEditCard] = useState<KanbanCard | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (board: string) => {
    setLoading(true);
    const [colRes, cardRes] = await Promise.all([
      supabase.from("imphq_kanban_columns").select("*").eq("board", board).order("position"),
      supabase.from("imphq_kanban_cards").select("*").eq("board", board).order("position"),
    ]);

    let cols = (colRes.data || []) as KanbanColumn[];

    // Auto-init columns if none exist for this board
    if (cols.length === 0) {
      const newCols = DEFAULT_COLUMNS.map((title, i) => ({
        title,
        color: COL_COLORS[title] || "#8b5cf6",
        position: i,
        board,
      }));
      const { data } = await supabase.from("imphq_kanban_columns").insert(newCols).select();
      cols = (data || []) as KanbanColumn[];
    }

    setColumns(cols);
    setCards((cardRes.data || []) as KanbanCard[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(activeBoard); }, [activeBoard, loadData]);

  const handleBoardChange = (board: string) => { setActiveBoard(board); };

  const createCard = async () => {
    if (!newTitle.trim() || !showNewCard) return;
    const { error } = await supabase.from("imphq_kanban_cards").insert({
      column_id: showNewCard,
      title: newTitle.trim(),
      priority: newPriority,
      due_date: newDueDate || null,
      description: newDesc || null,
      board: activeBoard,
      position: cards.filter(c => c.column_id === showNewCard).length,
      tags: [],
    });
    if (error) { toast.error("Erro ao criar card"); return; }
    toast.success("Card criado!");
    setShowNewCard(null); setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewDesc("");
    loadData(activeBoard);
  };

  const updateCard = async () => {
    if (!editCard) return;
    const { error } = await supabase.from("imphq_kanban_cards")
      .update({ title: editCard.title, description: editCard.description, priority: editCard.priority, due_date: editCard.due_date || null })
      .eq("id", editCard.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Card atualizado!");
    setEditCard(null);
    loadData(activeBoard);
  };

  const deleteCard = async (id: string) => {
    await supabase.from("imphq_kanban_cards").delete().eq("id", id);
    toast.success("Card removido");
    setEditCard(null);
    loadData(activeBoard);
  };

  const moveCard = async (card: KanbanCard, direction: number) => {
    const colIndex = columns.findIndex(c => c.id === card.column_id);
    const newColIndex = colIndex + direction;
    if (newColIndex < 0 || newColIndex >= columns.length) return;
    const newCol = columns[newColIndex];
    await supabase.from("imphq_kanban_cards")
      .update({ column_id: newCol.id })
      .eq("id", card.id);
    loadData(activeBoard);
  };

  const boardColumns = columns;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Kanban</h1>

      <Tabs value={activeBoard} onValueChange={handleBoardChange}>
        <TabsList className="bg-secondary">
          {BOARDS.map((b) => (
            <TabsTrigger key={b} value={b} className="capitalize">{b}</TabsTrigger>
          ))}
        </TabsList>

        {BOARDS.map((board) => (
          <TabsContent key={board} value={board} className="mt-4">
            {loading && activeBoard === board ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <div className="grid grid-cols-5 gap-3 min-h-[60vh]">
                {boardColumns.map((col, colIdx) => {
                  const colCards = cards.filter(c => c.column_id === col.id);
                  const colTitle = col.title.toLowerCase();
                  return (
                    <div key={col.id} className={`rounded-lg border-t-2 ${COL_COLORS[colTitle] || "border-primary/30"} bg-secondary/30 p-3`}>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
                        {col.title}
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{colCards.length}</Badge>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setShowNewCard(col.id); setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewDesc(""); }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </h3>
                      <div className="space-y-2">
                        {colCards.map((card) => (
                          <Card key={card.id} className="bg-card border-border hover:border-primary/20 transition-colors group">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-sm font-medium cursor-pointer flex-1" onClick={() => setEditCard({ ...card })}>{card.title}</p>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {colIdx > 0 && (
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveCard(card, -1)}>
                                      <ChevronLeft className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {colIdx < boardColumns.length - 1 && (
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveCard(card, 1)}>
                                      <ChevronRight className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {card.due_date && (
                                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                                  {new Date(card.due_date).toLocaleDateString("pt-BR")}
                                </p>
                              )}
                              {card.priority && card.priority !== "medium" && (
                                <Badge variant="outline" className={`mt-2 text-[10px] ${card.priority === "urgent" ? "border-destructive text-destructive" : card.priority === "high" ? "border-warning text-warning" : "border-muted text-muted-foreground"}`}>
                                  {card.priority}
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
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
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data Limite</Label><Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={createCard}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={!!editCard} onOpenChange={() => setEditCard(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Card</DialogTitle></DialogHeader>
          {editCard && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editCard.title} onChange={e => setEditCard({ ...editCard, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editCard.description || ""} onChange={e => setEditCard({ ...editCard, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prioridade</Label>
                  <Select value={editCard.priority} onValueChange={v => setEditCard({ ...editCard, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Data Limite</Label><Input type="date" value={editCard.due_date || ""} onChange={e => setEditCard({ ...editCard, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Mover para coluna</Label>
                <Select value={editCard.column_id} onValueChange={v => setEditCard({ ...editCard, column_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {columns.map(col => <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => editCard && deleteCard(editCard.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Excluir
            </Button>
            <Button onClick={updateCard}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
