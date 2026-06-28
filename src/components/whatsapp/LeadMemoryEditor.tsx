import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, Globe, Lock, Cpu } from "lucide-react";
import { toast } from "sonner";

interface LeadMemoryEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  projectId?: string | null;
  phone?: string | null;
}

interface MemoryRow {
  id: string;
  memory_type: string;
  content: string;
  emotional_state: string | null;
  last_objection: string | null;
  cross_shareable: boolean;
  updated_at: string;
  _dirty?: boolean;
  _new?: boolean;
}

const MEMORY_TYPES = [
  { value: "general", label: "Geral" },
  { value: "pain", label: "Dor" },
  { value: "desire", label: "Desejo" },
  { value: "objection", label: "Objeção" },
  { value: "trigger", label: "Gatilho" },
  { value: "preference", label: "Preferência" },
  { value: "emotional_snapshot", label: "Estado emocional" },
  { value: "internal_note", label: "Nota interna" },
];

export function LeadMemoryEditor({ open, onOpenChange, leadId, projectId, phone }: LeadMemoryEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [freeform, setFreeform] = useState("");
  const [freeformDirty, setFreeformDirty] = useState(false);

  useEffect(() => {
    if (!open || !leadId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  async function load() {
    if (!leadId) return;
    setLoading(true);
    try {
      const [{ data: mems }, { data: lead }] = await Promise.all([
        supabase
          .from("imphq_wa_lead_memories")
          .select("id, memory_type, content, emotional_state, last_objection, cross_shareable, updated_at")
          .eq("lead_id", leadId)
          .order("updated_at", { ascending: false }),
        supabase.from("imphq_leads").select("lead_memory").eq("id", leadId).maybeSingle(),
      ]);
      setRows(((mems as any[]) || []) as MemoryRow[]);
      setFreeform((lead as any)?.lead_memory || "");
      setFreeformDirty(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar memória");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(id: string, patch: Partial<MemoryRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)));
  }

  function addRow() {
    if (!projectId) {
      toast.error("Projeto não definido — não dá pra criar memória.");
      return;
    }
    setRows((prev) => [
      {
        id: `new-${Date.now()}`,
        memory_type: "general",
        content: "",
        emotional_state: null,
        last_objection: null,
        cross_shareable: false,
        updated_at: new Date().toISOString(),
        _dirty: true,
        _new: true,
      },
      ...prev,
    ]);
  }

  async function deleteRow(row: MemoryRow) {
    if (row._new) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    if (!confirm("Apagar essa memória?")) return;
    const { error } = await supabase.from("imphq_wa_lead_memories").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Memória removida");
  }

  async function saveAll() {
    if (!leadId) return;
    setSaving(true);
    try {
      // Freeform
      if (freeformDirty) {
        const { error } = await supabase
          .from("imphq_leads")
          .update({ lead_memory: freeform })
          .eq("id", leadId);
        if (error) throw error;
      }

      // Structured memories
      const dirty = rows.filter((r) => r._dirty);
      for (const r of dirty) {
        if (!r.content.trim()) continue;
        if (r._new) {
          if (!projectId) continue;
          const { error } = await supabase.from("imphq_wa_lead_memories").insert({
            project_id: projectId,
            lead_id: leadId,
            phone: phone || null,
            memory_type: r.memory_type,
            content: r.content,
            emotional_state: r.emotional_state,
            last_objection: r.last_objection,
            cross_shareable: r.cross_shareable,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("imphq_wa_lead_memories")
            .update({
              memory_type: r.memory_type,
              content: r.content,
              emotional_state: r.emotional_state,
              last_objection: r.last_objection,
              cross_shareable: r.cross_shareable,
              updated_at: new Date().toISOString(),
            })
            .eq("id", r.id);
          if (error) throw error;
        }
      }

      toast.success("Memória salva");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = freeformDirty || rows.some((r) => r._dirty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-blue-400" /> Editar Memória do Lead
          </DialogTitle>
          <DialogDescription className="leading-7">
            Ajuste o que a IA lembra sobre este lead. Memórias com <Globe className="inline h-3 w-3" /> são
            compartilhadas entre todos os projetos do mesmo telefone.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Freeform */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Memória livre (campo do lead)
              </Label>
              <Textarea
                value={freeform}
                onChange={(e) => {
                  setFreeform(e.target.value);
                  setFreeformDirty(true);
                }}
                rows={4}
                placeholder="Notas internas que a IA usa como contexto..."
                className="bg-background/60"
              />
            </div>

            {/* Structured */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Memórias estruturadas ({rows.length})
                </Label>
                <Button size="sm" variant="outline" onClick={addRow} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Nova
                </Button>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  Nenhuma memória estruturada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-md border border-border/40 bg-background/40 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={r.memory_type}
                          onValueChange={(v) => updateRow(r.id, { memory_type: v })}
                        >
                          <SelectTrigger className="h-8 w-[180px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMORY_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {r.cross_shareable ? (
                            <Globe className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                          <Label className="text-[10px] text-muted-foreground">Cross-projeto</Label>
                          <Switch
                            checked={r.cross_shareable}
                            onCheckedChange={(v) => updateRow(r.id, { cross_shareable: v })}
                          />
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteRow(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Textarea
                        value={r.content}
                        onChange={(e) => updateRow(r.id, { content: e.target.value })}
                        rows={2}
                        placeholder="Conteúdo da memória..."
                        className="bg-background/60 text-sm"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={r.emotional_state || ""}
                          onChange={(e) => updateRow(r.id, { emotional_state: e.target.value || null })}
                          placeholder="Estado emocional (opcional)"
                          className="h-8 text-xs bg-background/60"
                        />
                        <Input
                          value={r.last_objection || ""}
                          onChange={(e) => updateRow(r.id, { last_objection: e.target.value || null })}
                          placeholder="Última objeção (opcional)"
                          className="h-8 text-xs bg-background/60"
                        />
                      </div>

                      {r._new && <Badge variant="outline" className="text-[9px]">Nova</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAll} disabled={!hasChanges || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
