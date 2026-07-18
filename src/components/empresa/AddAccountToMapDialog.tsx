import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  accountId: string | null;
  accountLabel?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Escolhe um Mapa da Empresa e insere um nó de anotação `account` referenciando a conta.
 * O usuário é levado para o mapa após a inserção.
 */
export function AddAccountToMapDialog({ accountId, accountLabel, open, onOpenChange }: Props) {
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [mapId, setMapId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"compact" | "expanded">("compact");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase.from("imphq_company_maps" as any) as any)
        .select("id, name")
        .order("updated_at", { ascending: false });
      const list = (data || []) as { id: string; name: string }[];
      setMaps(list);
      if (list.length && !mapId) setMapId(list[0].id);
    })();
  }, [open]);

  const submit = async () => {
    if (!mapId || !accountId) { toast.error("Selecione um mapa"); return; }
    setSaving(true);
    // Insere centralizado (0,0) — usuário pode arrastar depois
    const payload: any = {
      map_id: mapId, kind: "account",
      x: -120, y: -60, width: 260, height: 130,
      text: accountLabel || "",
      style: { accountId, viewMode },
      z_index: 5,
    };
    const { error } = await (supabase.from("imphq_company_map_annotations" as any) as any).insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Adicionado ao mapa");
    onOpenChange(false);
    window.location.href = `/funis?view=mapa&map=${mapId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-secondary/40">
        <DialogHeader><DialogTitle>Adicionar ao Mapa da Empresa</DialogTitle></DialogHeader>
        <div className="space-y-3 leading-7">
          <div className="space-y-1">
            <Label className="text-xs">Mapa</Label>
            <Select value={mapId} onValueChange={setMapId}>
              <SelectTrigger><SelectValue placeholder="Selecione o mapa" /></SelectTrigger>
              <SelectContent>
                {maps.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                {maps.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum mapa. Crie um em Funis → Mapa.</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Modo inicial</Label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacto (avatar + status)</SelectItem>
                <SelectItem value="expanded">Expandido (todos os campos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Conta: <strong>{accountLabel}</strong> — o nó pode ser conectado a funis, cronogramas e scripts.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !mapId}>{saving ? "Adicionando…" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
