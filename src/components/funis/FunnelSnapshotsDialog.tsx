import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { History, Save, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Snapshot {
  id: string;
  funil_id: string;
  label?: string;
  motivo: string;
  canvas: any;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  funil: { id: string; nome: string; project_id?: string; data: any } | null;
  onRestore: (canvas: any) => void;
}

export function FunnelSnapshotsDialog({ open, onOpenChange, funil, onRestore }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!funil) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_funnel_snapshots" as any)
      .select("*")
      .eq("funil_id", funil.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error("Erro: " + error.message);
    else setSnapshots((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open && funil) load();
  }, [open, funil?.id]);

  const handleSave = async () => {
    if (!funil) return;
    setSaving(true);
    const { error } = await supabase.from("imphq_funnel_snapshots" as any).insert([{
      projeto_id: funil.project_id || "global",
      funil_id: funil.id,
      label: label.trim() || `Snapshot ${new Date().toLocaleString("pt-BR")}`,
      motivo: "manual",
      canvas: funil.data,
    }]);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Versão salva!");
    setLabel("");
    load();
  };

  const handleRestore = async (snap: Snapshot) => {
    if (!confirm(`Restaurar "${snap.label || snap.id}"? O canvas atual será substituído (mas salvamos um backup antes).`)) return;
    if (funil) {
      await supabase.from("imphq_funnel_snapshots" as any).insert([{
        projeto_id: funil.project_id || "global",
        funil_id: funil.id,
        label: `Auto-backup antes de restaurar ${snap.label || snap.id}`,
        motivo: "auto_before_restore",
        canvas: funil.data,
      }]);
    }
    onRestore(snap.canvas);
    toast.success("Versão restaurada");
    onOpenChange(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar este snapshot?")) return;
    await supabase.from("imphq_funnel_snapshots" as any).delete().eq("id", id);
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de versões — {funil?.nome}
          </DialogTitle>
          <DialogDescription>
            Salve fotos do canvas antes de mudanças grandes. Restaure quando quiser voltar.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <Label>Salvar versão atual</Label>
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Antes de adicionar upsell premium"
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma versão salva ainda.</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((s) => {
              const etapas = (s.canvas?.etapas || []).length;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{s.label || "Sem rótulo"}</p>
                      {s.motivo !== "manual" && (
                        <Badge variant="outline" className="text-[10px]">{s.motivo}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: ptBR })} • {etapas} etapas
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleRestore(s)} title="Restaurar">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} title="Apagar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
