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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, ChevronLeft, ChevronRight, Flame, AlertTriangle, Search, CheckCircle2, Inbox, Eye, Users } from "lucide-react";
import { toast } from "sonner";

const BOARDS = ["geral", "agentes", "humanas", "criativos", "campanhas"];
const DEFAULT_COLUMNS = ["backlog", "fazendo", "travado", "revisão", "feito"];

const COL_CONFIG: Record<string, { icon: React.ReactNode; bg: string; border: string; headerBg: string }> = {
  backlog: { icon: <Inbox className="h-3.5 w-3.5" />, bg: "bg-muted/20", border: "border-l-muted-foreground/40", headerBg: "bg-muted/30" },
  fazendo: { icon: <Flame className="h-3.5 w-3.5 text-warning" />, bg: "bg-warning/5", border: "border-l-warning/50", headerBg: "bg-warning/10" },
  travado: { icon: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />, bg: "bg-destructive/5", border: "border-l-destructive/50", headerBg: "bg-destructive/10" },
  "revisão": { icon: <Eye className="h-3.5 w-3.5 text-primary" />, bg: "bg-primary/5", border: "border-l-primary/50", headerBg: "bg-primary/10" },
  feito: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, bg: "bg-success/5", border: "border-l-success/50", headerBg: "bg-success/10" },
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-destructive",
  high: "bg-warning",
  medium: "bg-success",
  low: "bg-muted-foreground/40",
};

interface TeamMember { id: string; nome: string; avatar_url?: string; cargo?: string; }
interface KanbanColumn { id: string; title: string; color: string; position: number; board: string; }
interface KanbanCard {
  id: string; column_id: string; title: string; description?: string;
  priority: string; due_date?: string; tags: string[]; position: number; board: string;
  member_id?: string;
}

export default function KanbanPage() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [allCards, setAllCards] = useState<KanbanCard[]>([]);
  const [allColumns, setAllColumns] = useState<KanbanColumn[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeBoard, setActiveBoard] = useState("geral");
  const [showNewCard, setShowNewCard] = useState<string | null>(null);
  const [editCard, setEditCard] = useState<KanbanCard | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newBoard, setNewBoard] = useState("agentes");
  const [newMemberId, setNewMemberId] = useState("none");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMember, setFilterMember] = useState("all");

  const loadAllData = useCallback(async () => {
    setLoading(true);
    const [colRes, cardRes, memberRes] = await Promise.all([
      supabase.from("imphq_kanban_columns").select("*").order("position"),
      supabase.from("imphq_kanban_cards").select("*").order("position"),
      supabase.from("imphq_team_members").select("id, nome, avatar_url, cargo"),
    ]);

    let cols = (colRes.data || []) as KanbanColumn[];
    const existingBoards = new Set(cols.map(c => c.board));

    for (const board of ["agentes", "humanas", "criativos", "campanhas"]) {
      if (!existingBoards.has(board)) {
        const newCols = DEFAULT_COLUMNS.map((title, i) => ({
          title, color: "#8b5cf6", position: i, board,
        }));
        const { data } = await supabase.from("imphq_kanban_columns").insert(newCols).select();
        if (data) cols = [...cols, ...(data as KanbanColumn[])];
      }
    }

    setAllColumns(cols);
    setAllCards((cardRes.data || []) as KanbanCard[]);
    setMembers((memberRes.data || []) as TeamMember[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  useEffect(() => {
    if (activeBoard === "geral") {
      const mergedMap = new Map<string, KanbanColumn>();
      for (const col of allColumns) {
        const key = col.title.toLowerCase();
        if (!mergedMap.has(key)) mergedMap.set(key, col);
      }
      setColumns(Array.from(mergedMap.values()).sort((a, b) => a.position - b.position));
      setCards(allCards);
    } else {
      const boardCols = allColumns.filter(c => c.board === activeBoard);
      setColumns(boardCols);
      setCards(allCards.filter(c => c.board === activeBoard));
    }
  }, [activeBoard, allColumns, allCards]);

  const getColTitle = (card: KanbanCard) => {
    const col = allColumns.find(c => c.id === card.column_id);
    return col?.title.toLowerCase() || "";
  };
  const countByCol = (title: string) => allCards.filter(c => getColTitle(c) === title).length;
  const stuckCount = countByCol("travado");
  const doingCount = countByCol("fazendo");
  const doneCount = countByCol("feito");

  const filteredCards = (colId: string) => {
    let filtered: KanbanCard[];
    if (activeBoard === "geral") {
      const col = allColumns.find(c => c.id === colId);
      const colTitle = col?.title.toLowerCase() || "";
      filtered = allCards.filter(c => getColTitle(c) === colTitle);
    } else {
      filtered = cards.filter(c => c.column_id === colId);
    }
    if (searchTerm) {
      filtered = filtered.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (filterMember !== "all") {
      filtered = filtered.filter(c => c.member_id === filterMember);
    }
    return filtered;
  };

  const getMember = (memberId?: string) => memberId ? members.find(m => m.id === memberId) : undefined;

  const createCard = async () => {
    if (!newTitle.trim() || !showNewCard) return;
    const board = activeBoard === "geral" ? newBoard : activeBoard;
    let targetColId = showNewCard;
    if (activeBoard === "geral") {
      const selectedCol = allColumns.find(c => c.id === showNewCard);
      const colTitle = selectedCol?.title.toLowerCase() || "";
      const boardCol = allColumns.find(c => c.board === board && c.title.toLowerCase() === colTitle);
      if (boardCol) targetColId = boardCol.id;
    }
    const { error } = await supabase.from("imphq_kanban_cards").insert({
      column_id: targetColId, title: newTitle.trim(), priority: newPriority,
      due_date: newDueDate || null, description: newDesc || null,
      board, position: allCards.filter(c => c.column_id === targetColId).length, tags: [],
      member_id: newMemberId === "none" ? null : newMemberId,
    });
    if (error) { toast.error("Erro ao criar card"); return; }
    toast.success("Card criado!");
    setShowNewCard(null); setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewDesc(""); setNewBoard("agentes"); setNewMemberId("none");
    loadAllData();
  };

  const updateCard = async () => {
    if (!editCard) return;
    const { error } = await supabase.from("imphq_kanban_cards")
      .update({
        title: editCard.title, description: editCard.description, priority: editCard.priority,
        due_date: editCard.due_date || null, column_id: editCard.column_id,
        member_id: editCard.member_id || null,
      })
      .eq("id", editCard.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Card atualizado!");
    setEditCard(null);
    loadAllData();
  };

  const deleteCard = async (id: string) => {
    await supabase.from("imphq_kanban_cards").delete().eq("id", id);
    toast.success("Card removido");
    setEditCard(null);
    loadAllData();
  };

  const moveCard = async (card: KanbanCard, direction: number) => {
    const boardCols = allColumns.filter(c => c.board === card.board).sort((a, b) => a.position - b.position);
    const colIndex = boardCols.findIndex(c => c.id === card.column_id);
    const newColIndex = colIndex + direction;
    if (newColIndex < 0 || newColIndex >= boardCols.length) return;
    const newCol = boardCols[newColIndex];
    await supabase.from("imphq_kanban_cards").update({ column_id: newCol.id }).eq("id", card.id);
    loadAllData();
  };

  const isOverdue = (d?: string) => d ? new Date(d) < new Date() : false;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">Kanban</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1.5 px-3 py-1">
            <AlertTriangle className="h-3 w-3" /> {stuckCount} Travados
          </Badge>
          <Badge className="bg-warning/15 text-warning border-warning/30 gap-1.5 px-3 py-1">
            <Flame className="h-3 w-3" /> {doingCount} Fazendo
          </Badge>
          <Badge className="bg-success/15 text-success border-success/30 gap-1.5 px-3 py-1">
            <CheckCircle2 className="h-3 w-3" /> {doneCount} Feitos
          </Badge>
        </div>
      </div>

      {/* Search + Member Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar cards..." className="pl-9 bg-secondary" />
        </div>
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="w-[180px] h-9">
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
                    <AvatarFallback className="text-[8px] bg-secondary">{(m.nome || "?")[0]}</AvatarFallback>
                  </Avatar>
                  {m.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterMember !== "all" && (
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setFilterMember("all")}>Limpar</Button>
        )}
      </div>

      <Tabs value={activeBoard} onValueChange={setActiveBoard}>
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
                {columns.map((col) => {
                  const colTitle = col.title.toLowerCase();
                  const config = COL_CONFIG[colTitle] || COL_CONFIG.backlog;
                  const colCards = filteredCards(col.id);
                  return (
                    <div key={col.id} className={`rounded-lg border-l-[3px] ${config.border} ${config.bg} p-3`}>
                      <div className={`rounded-md ${config.headerBg} px-3 py-2 mb-3 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                            {col.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] h-5 min-w-[20px] justify-center">{colCards.length}</Badge>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setShowNewCard(col.id); setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewDesc(""); setNewBoard("agentes"); setNewMemberId("none"); }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {colCards.length === 0 && (
                          <p className="text-xs text-muted-foreground/50 text-center py-6 italic">Nenhuma tarefa</p>
                        )}
                        {colCards.map((card) => {
                          const cardBoardCols = allColumns.filter(c => c.board === card.board).sort((a, b) => a.position - b.position);
                          const cardColIdx = cardBoardCols.findIndex(c => c.id === card.column_id);
                          const member = getMember(card.member_id);
                          return (
                            <Card key={card.id} className="bg-card border-border hover:border-primary/20 transition-colors group cursor-pointer" onClick={() => setEditCard({ ...card })}>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-sm font-medium flex-1">{card.title}</p>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    {cardColIdx > 0 && (
                                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveCard(card, -1)}>
                                        <ChevronLeft className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {cardColIdx < cardBoardCols.length - 1 && (
                                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveCard(card, 1)}>
                                        <ChevronRight className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[card.priority] || PRIORITY_DOT.medium}`} />
                                    {activeBoard === "geral" && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{card.board}</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {card.due_date && (
                                      <p className={`text-[10px] font-mono ${isOverdue(card.due_date) ? "text-destructive" : "text-muted-foreground"}`}>
                                        {new Date(card.due_date).toLocaleDateString("pt-BR")}
                                      </p>
                                    )}
                                    {member && (
                                      <Avatar className="h-5 w-5" title={member.nome}>
                                        {member.avatar_url ? <AvatarImage src={member.avatar_url} /> : null}
                                        <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{(member.nome || "?")[0]}</AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
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
                          <AvatarFallback className="text-[8px] bg-secondary">{(m.nome || "?")[0]}</AvatarFallback>
                        </Avatar>
                        {m.nome}
                      </div>
                    </SelectItem>
                  ))}
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
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Data Limite</Label><Input type="date" value={editCard.due_date || ""} onChange={e => setEditCard({ ...editCard, due_date: e.target.value })} /></div>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={editCard.member_id || "none"} onValueChange={v => setEditCard({ ...editCard, member_id: v === "none" ? undefined : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4">
                            {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                            <AvatarFallback className="text-[8px] bg-secondary">{(m.nome || "?")[0]}</AvatarFallback>
                          </Avatar>
                          {m.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Mover para coluna</Label>
                <Select value={editCard.column_id} onValueChange={v => setEditCard({ ...editCard, column_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allColumns.filter(c => c.board === editCard.board).map(col => <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>)}
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
