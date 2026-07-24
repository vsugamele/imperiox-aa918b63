import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MoreHorizontal, Pencil, Trash2, Copy } from "lucide-react";
import { ColumnColorMenu, hexToTint } from "./ColumnColorMenu";
import { toast } from "sonner";

export interface KanbanBoard {
  id: string;
  label: string;
  emoji?: string | null;
  color?: string | null;
  position: number;
  is_pinned?: boolean;
}

interface Props {
  boards: KanbanBoard[];
  activeBoard: string;
  onActive: (id: string) => void;
  cardCounts: Record<string, number>;
  onReload: () => void;
}

const EMOJIS = ["📋", "🤖", "👥", "🎨", "🚀", "⭐", "🎣", "🧪", "📝", "🔁", "🛡️", "💰", "📈", "🎯", "🔥", "🧠", "💡", "🎬"];

export function BoardTabsBar({ boards, activeBoard, onActive, cardCounts, onReload }: Props) {
  const [editing, setEditing] = useState<KanbanBoard | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ label: string; emoji: string; color: string }>({ label: "", emoji: "📋", color: "#8b5cf6" });

  const openCreate = () => {
    setForm({ label: "", emoji: "📋", color: "#8b5cf6" });
    setCreating(true);
  };

  const openEdit = (b: KanbanBoard) => {
    setForm({ label: b.label, emoji: b.emoji || "📋", color: b.color || "#8b5cf6" });
    setEditing(b);
  };

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `board-${Date.now()}`;

  const saveNew = async () => {
    if (!form.label.trim()) return;
    const id = slugify(form.label);
    const position = boards.reduce((m, b) => Math.max(m, b.position), -1) + 1;
    const { error } = await supabase.from("imphq_kanban_boards").insert({
      id, label: form.label.trim(), emoji: form.emoji, color: form.color, position,
    });
    if (error) { toast.error("Erro ao criar aba: " + error.message); return; }
    toast.success("Aba criada");
    setCreating(false);
    onReload();
  };

  const saveEdit = async () => {
    if (!editing || !form.label.trim()) return;
    const { error } = await supabase.from("imphq_kanban_boards").update({
      label: form.label.trim(), emoji: form.emoji, color: form.color, updated_at: new Date().toISOString(),
    }).eq("id", editing.id);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Aba atualizada");
    setEditing(null);
    onReload();
  };

  const deleteBoard = async (b: KanbanBoard) => {
    if (b.is_pinned) { toast.error("Aba fixa não pode ser removida"); return; }
    const count = cardCounts[b.id] || 0;
    if (count > 0 && !confirm(`Esta aba tem ${count} cards. Eles serão movidos para "Geral". Continuar?`)) return;
    if (count > 0) {
      await supabase.from("imphq_kanban_cards").update({ board: "geral" }).eq("board", b.id);
      await supabase.from("imphq_kanban_columns").delete().eq("board", b.id);
    }
    const { error } = await supabase.from("imphq_kanban_boards").delete().eq("id", b.id);
    if (error) { toast.error("Erro ao remover: " + error.message); return; }
    toast.success("Aba removida");
    setEditing(null);
    if (activeBoard === b.id) onActive("geral");
    onReload();
  };

  const duplicateBoard = async (b: KanbanBoard) => {
    const newLabel = `${b.label} (cópia)`;
    const id = slugify(newLabel) + "-" + Math.random().toString(36).slice(2, 6);
    const position = boards.reduce((m, x) => Math.max(m, x.position), -1) + 1;
    const { error } = await supabase.from("imphq_kanban_boards").insert({
      id, label: newLabel, emoji: b.emoji, color: b.color, position,
    });
    if (error) { toast.error("Erro ao duplicar: " + error.message); return; }
    const { data: cols } = await supabase.from("imphq_kanban_columns").select("title,color,position").eq("board", b.id);
    if (cols && cols.length > 0) {
      await supabase.from("imphq_kanban_columns").insert(cols.map(c => ({ ...c, board: id })));
    }
    toast.success("Aba duplicada");
    setEditing(null);
    onReload();
  };

  return (
    <div className="flex items-center gap-1 flex-wrap bg-secondary rounded-md p-1">
      {boards.map((b) => {
        const active = activeBoard === b.id;
        const tint = b.color ? hexToTint(b.color, active ? 0.25 : 0.08) : undefined;
        return (
          <div key={b.id} className="flex items-center">
            <button
              onClick={() => onActive(b.id)}
              className={`h-8 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{
                backgroundColor: active ? tint : undefined,
                borderLeft: b.color ? `2px solid ${b.color}` : undefined,
              }}
            >
              {b.emoji && <span>{b.emoji}</span>}
              <span>{b.label}</span>
              <Badge variant="outline" className="text-[9px] h-4 min-w-[18px] justify-center px-1">
                {cardCounts[b.id] || 0}
              </Badge>
            </button>
            {!b.is_pinned && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="opacity-40 hover:opacity-100 px-1 py-1" title="Opções da aba">
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="start">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => openEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => duplicateBoard(b)}>
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={() => deleteBoard(b)}>
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        );
      })}
      <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={openCreate}>
        <Plus className="h-3.5 w-3.5" /> Nova aba
      </Button>

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar aba" : "Nova aba"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Ofertas" autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Emoji</label>
              <div className="grid grid-cols-9 gap-1 mt-1">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={`h-8 rounded-md text-lg hover:bg-muted ${form.emoji === e ? "bg-muted ring-1 ring-primary" : ""}`}
                  >{e}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cor</label>
              <ColumnColorMenu currentColor={form.color} onPick={(hex) => setForm(f => ({ ...f, color: hex }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={editing ? saveEdit : saveNew}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
