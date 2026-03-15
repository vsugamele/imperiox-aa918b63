import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Plus, FileText, CheckCircle2, Clock, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["Admin", "Editor", "Viewer"];
const DEPARTMENTS = ["Dev", "Marketing", "Copy", "Tráfego", "Design", "Operação", "Financeiro"];
const AVATAR_COLORS = [
  "bg-primary", "bg-accent", "bg-destructive", "bg-emerald-500",
  "bg-violet-500", "bg-orange-500", "bg-cyan-500", "bg-rose-500",
];

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface MemberDetailPanelProps {
  member: any | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

interface TeamDoc {
  id: string;
  member_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  column_id?: string;
  board?: string;
  due_date?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  backlog: { label: "A Fazer", icon: <Clock className="h-3 w-3" />, color: "text-muted-foreground" },
  fazendo: { label: "Em Progresso", icon: <AlertTriangle className="h-3 w-3 text-warning" />, color: "text-warning" },
  feito: { label: "Feito", icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" />, color: "text-emerald-500" },
};

export default function MemberDetailPanel({ member, open, onClose, onUpdated }: MemberDetailPanelProps) {
  const [form, setForm] = useState({ name: "", email: "", role: "Viewer", department: "" });
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [docs, setDocs] = useState<TeamDoc[]>([]);
  const [editingDoc, setEditingDoc] = useState<TeamDoc | null>(null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [showNewDoc, setShowNewDoc] = useState(false);

  useEffect(() => {
    if (member) {
      setForm({ name: member.name || "", email: member.email || "", role: member.role || "Viewer", department: member.department || "" });
      loadActivities(member.id);
      loadDocs(member.id);
    }
  }, [member]);

  const loadActivities = async (memberId: string) => {
    const [cardsRes, colsRes] = await Promise.all([
      supabase.from("imphq_kanban_cards").select("id, title, description, priority, column_id, board, due_date").eq("member_id", memberId),
      supabase.from("imphq_kanban_columns").select("id, title"),
    ]);
    setCards((cardsRes.data || []) as KanbanCard[]);
    setColumns((colsRes.data || []) as KanbanColumn[]);
  };

  const loadDocs = async (memberId: string) => {
    const { data } = await supabase.from("imphq_team_docs").select("*").eq("member_id", memberId).order("created_at", { ascending: false });
    setDocs((data || []) as TeamDoc[]);
  };

  const getColumnTitle = (colId?: string) => {
    if (!colId) return "backlog";
    return columns.find(c => c.id === colId)?.title.toLowerCase() || "backlog";
  };

  const groupedCards = {
    fazendo: cards.filter(c => getColumnTitle(c.column_id) === "fazendo"),
    backlog: cards.filter(c => ["backlog", "travado", "revisão"].includes(getColumnTitle(c.column_id))),
    feito: cards.filter(c => getColumnTitle(c.column_id) === "feito"),
  };

  const saveMember = async () => {
    if (!member) return;
    const { error } = await supabase.from("imphq_team_members").update({
      name: form.name, email: form.email, role: form.role, department: form.department,
    }).eq("id", member.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Membro atualizado!");
    onUpdated();
  };

  const deleteMember = async () => {
    if (!member) return;
    await supabase.from("imphq_team_members").delete().eq("id", member.id);
    toast.success("Membro removido");
    onClose();
    onUpdated();
  };

  const createDoc = async () => {
    if (!member || !newDocTitle.trim()) return;
    await supabase.from("imphq_team_docs").insert({
      member_id: member.id, title: newDocTitle, content: newDocContent,
    } as any);
    setNewDocTitle(""); setNewDocContent(""); setShowNewDoc(false);
    loadDocs(member.id);
    toast.success("Documento criado!");
  };

  const updateDoc = async () => {
    if (!editingDoc) return;
    await supabase.from("imphq_team_docs").update({
      title: editingDoc.title, content: editingDoc.content, updated_at: new Date().toISOString(),
    }).eq("id", editingDoc.id);
    setEditingDoc(null);
    if (member) loadDocs(member.id);
    toast.success("Documento salvo!");
  };

  const deleteDoc = async (id: string) => {
    await supabase.from("imphq_team_docs").delete().eq("id", id);
    if (member) loadDocs(member.id);
    toast.success("Documento removido");
  };

  if (!member) return null;

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className={`h-12 w-12 ${getAvatarColor(member.name || "")}`}>
              <AvatarFallback className="text-white font-bold bg-transparent">{getInitials(member.name || "?")}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-lg">{member.name}</SheetTitle>
              <p className="text-xs text-muted-foreground">{member.email} · {member.department}</p>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="perfil" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="perfil" className="flex-1">Perfil</TabsTrigger>
            <TabsTrigger value="atividades" className="flex-1">
              Atividades {cards.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{cards.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex-1">
              Docs {docs.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{docs.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* PERFIL TAB */}
          <TabsContent value="perfil" className="space-y-3 mt-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-between pt-3">
              <Button variant="destructive" size="sm" onClick={deleteMember}>
                <Trash2 className="h-3 w-3 mr-1" /> Remover
              </Button>
              <Button onClick={saveMember}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
            </div>
          </TabsContent>

          {/* ATIVIDADES TAB */}
          <TabsContent value="atividades" className="mt-4 space-y-4">
            {Object.entries(groupedCards).map(([status, items]) => (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  {STATUS_CONFIG[status]?.icon}
                  <span className={`text-xs font-semibold ${STATUS_CONFIG[status]?.color}`}>
                    {STATUS_CONFIG[status]?.label} ({items.length})
                  </span>
                </div>
                {items.length === 0 && <p className="text-xs text-muted-foreground pl-5">Nenhuma tarefa</p>}
                <div className="space-y-1.5">
                  {items.map(card => (
                    <Card key={card.id} className="bg-card border-border">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{card.title}</p>
                            {card.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{card.description}</p>}
                          </div>
                          {card.priority && (
                            <Badge variant="outline" className="text-[10px] capitalize">{card.priority}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {card.board && <span className="text-[10px] text-muted-foreground">{card.board}</span>}
                          {card.due_date && <span className="text-[10px] text-muted-foreground">📅 {new Date(card.due_date).toLocaleDateString("pt-BR")}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            {cards.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade atribuída a este membro</p>
            )}
          </TabsContent>

          {/* DOCUMENTOS TAB */}
          <TabsContent value="documentos" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{docs.length} documento(s)</span>
              <Button size="sm" variant="outline" onClick={() => { setShowNewDoc(true); setEditingDoc(null); }}>
                <Plus className="h-3 w-3 mr-1" /> Novo Doc
              </Button>
            </div>

            {showNewDoc && (
              <Card className="bg-card border-primary/30">
                <CardContent className="p-3 space-y-2">
                  <Input placeholder="Título do documento" value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} />
                  <Textarea placeholder="Conteúdo / instruções..." value={newDocContent} onChange={e => setNewDocContent(e.target.value)} rows={4} />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setShowNewDoc(false)}>Cancelar</Button>
                    <Button size="sm" onClick={createDoc}>Criar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {editingDoc && (
              <Card className="bg-card border-primary/30">
                <CardContent className="p-3 space-y-2">
                  <Input value={editingDoc.title} onChange={e => setEditingDoc({ ...editingDoc, title: e.target.value })} />
                  <Textarea value={editingDoc.content} onChange={e => setEditingDoc({ ...editingDoc, content: e.target.value })} rows={6} />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingDoc(null)}>Cancelar</Button>
                    <Button size="sm" onClick={updateDoc}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {docs.filter(d => d.id !== editingDoc?.id).map(doc => (
              <Card key={doc.id} className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all" onClick={() => { setEditingDoc(doc); setShowNewDoc(false); }}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{doc.content || "Sem conteúdo"}</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Atualizado {new Date(doc.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            ))}

            {docs.length === 0 && !showNewDoc && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento criado para este membro</p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
