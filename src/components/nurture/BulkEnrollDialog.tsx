import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Loader2 } from "lucide-react";

interface Sequence { id: string; nome: string; produto: string | null; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sequences: Sequence[];
  onDone?: () => void;
}

export function BulkEnrollDialog({ open, onOpenChange, sequences, onDone }: Props) {
  const [sequenceId, setSequenceId] = useState<string>("");
  const [produto, setProduto] = useState("");
  const [tag, setTag] = useState("");
  const [scoreMin, setScoreMin] = useState<number>(0);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreviewCount(null);
      setProduto(""); setTag(""); setScoreMin(0);
    }
  }, [open]);

  const buildQuery = () => {
    let q = supabase.from("imphq_leads").select("id", { count: "exact", head: true });
    if (produto.trim()) q = q.ilike("ultimo_produto" as any, `%${produto.trim()}%`);
    if (tag.trim()) q = q.contains("tags" as any, [tag.trim()]);
    if (scoreMin > 0) q = q.gte("score", scoreMin);
    return q;
  };

  const preview = async () => {
    setBusy(true);
    try {
      const { count, error } = await buildQuery();
      if (error) throw error;
      setPreviewCount(count || 0);
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const enroll = async () => {
    if (!sequenceId) { toast.error("Selecione uma sequência"); return; }
    setBusy(true);
    try {
      let q = supabase.from("imphq_leads").select("id, email");
      if (produto.trim()) q = q.ilike("ultimo_produto" as any, `%${produto.trim()}%`);
      if (tag.trim()) q = q.contains("tags" as any, [tag.trim()]);
      if (scoreMin > 0) q = q.gte("score", scoreMin);
      const { data: leads, error } = await q.limit(2000);
      if (error) throw error;
      const filtered = (leads || []).filter((l: any) => l.email);
      if (filtered.length === 0) { toast.error("Nenhum lead com e-mail encontrado"); setBusy(false); return; }

      const rows = filtered.map((l: any) => ({
        sequence_id: sequenceId,
        lead_id: l.id,
        status: "ativo",
        dia_atual: 0,
        proximo_envio_em: new Date().toISOString(),
      }));

      const { error: insErr } = await supabase.from("imphq_lead_sequence_enrollments").insert(rows as any);
      if (insErr) throw insErr;

      toast.success(`${rows.length} leads inscritos na sequência!`);
      onOpenChange(false);
      onDone?.();
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Inscrição em Massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Sequência</Label>
            <Select value={sequenceId} onValueChange={setSequenceId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {sequences.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}{s.produto ? ` — ${s.produto}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filtrar por produto (opcional)</Label>
            <Input value={produto} onChange={e => setProduto(e.target.value)} placeholder="ex: Curso XYZ" />
          </div>
          <div>
            <Label>Filtrar por tag (opcional)</Label>
            <Input value={tag} onChange={e => setTag(e.target.value)} placeholder="ex: hot-lead" />
          </div>
          <div>
            <Label>Score mínimo</Label>
            <Input type="number" value={scoreMin} onChange={e => setScoreMin(Number(e.target.value) || 0)} />
          </div>

          {previewCount !== null && (
            <div className="text-sm bg-muted p-3 rounded">
              <strong>{previewCount}</strong> leads correspondem aos filtros.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={preview} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pré-visualizar"}
          </Button>
          <Button onClick={enroll} disabled={busy || !sequenceId}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Inscrever todos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
