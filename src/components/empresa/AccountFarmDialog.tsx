import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const WARMUP = ["novo", "aquecendo", "pronto", "pausado", "banido"];
const STATUS_VENDA = ["mantida", "listada", "negociando", "vendida"];

interface Props {
  accountId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

/**
 * Dialog compartilhado de edição de parâmetros de FARM de uma conta em `imphq_empresa`.
 * Usado tanto na aba Farm quanto nos cards de Instagram/TikTok/YouTube/Email.
 */
export function AccountFarmDialog({ accountId, open, onOpenChange, onSaved }: Props) {
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !accountId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("imphq_empresa").select("*").eq("id", accountId).maybeSingle();
      setRow(data || null);
      setLoading(false);
    })();
  }, [open, accountId]);

  const patch = (k: string, v: any) => setRow((r: any) => ({ ...(r || {}), [k]: v }));

  const save = async () => {
    if (!row?.id) return;
    const { id, nome, tipo, foto_url, mapa_node_id, extra, created_at, updated_at, ...clean } = row;
    const { error } = await supabase.from("imphq_empresa").update(clean).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Farm atualizado");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-secondary/40">
        <DialogHeader><DialogTitle>Farm da conta {row?.nome ? `— ${row.nome}` : ""}</DialogTitle></DialogHeader>
        {loading || !row ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm leading-7">
            <Field label="Nicho"><Input value={row.nicho || ""} onChange={e => patch("nicho", e.target.value)} /></Field>
            <Field label="Data criação da conta"><Input type="date" value={row.data_criacao_conta || ""} onChange={e => patch("data_criacao_conta", e.target.value)} /></Field>
            <Field label="Warmup">
              <Select value={row.warmup_status || "novo"} onValueChange={v => patch("warmup_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WARMUP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Dias em warmup"><Input type="number" value={row.warmup_days || 0} onChange={e => patch("warmup_days", +e.target.value)} /></Field>
            <Field label="Seguidores"><Input type="number" value={row.seguidores || 0} onChange={e => patch("seguidores", +e.target.value)} /></Field>
            <Field label="Engajamento médio (%)"><Input type="number" step="0.1" value={row.engajamento_medio || 0} onChange={e => patch("engajamento_medio", +e.target.value)} /></Field>
            <Field label="Último alcance"><Input type="number" value={row.ultimo_alcance || 0} onChange={e => patch("ultimo_alcance", +e.target.value)} /></Field>
            <Field label="Cloud phone provider"><Input placeholder="GeeLark, etc." value={row.cloud_phone_provider || ""} onChange={e => patch("cloud_phone_provider", e.target.value)} /></Field>
            <Field label="Cloud phone ID"><Input value={row.cloud_phone_id || ""} onChange={e => patch("cloud_phone_id", e.target.value)} /></Field>
            <Field label="Proxy tipo"><Input placeholder="residencial / mobile" value={row.proxy_tipo || ""} onChange={e => patch("proxy_tipo", e.target.value)} /></Field>
            <Field label="Proxy geo"><Input placeholder="BR-SP" value={row.proxy_geo || ""} onChange={e => patch("proxy_geo", e.target.value)} /></Field>
            <Field label="Fingerprint ID"><Input value={row.fingerprint_id || ""} onChange={e => patch("fingerprint_id", e.target.value)} /></Field>
            <Field label="Preço-alvo (R$)"><Input type="number" value={row.preco_alvo || ""} onChange={e => patch("preco_alvo", +e.target.value)} /></Field>
            <Field label="Status de venda">
              <Select value={row.status_venda || "mantida"} onValueChange={v => patch("status_venda", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_VENDA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Marketplace"><Input value={row.marketplace || ""} onChange={e => patch("marketplace", e.target.value)} /></Field>
            <Field label="Comprador"><Input value={row.comprador || ""} onChange={e => patch("comprador", e.target.value)} /></Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={loading || !row}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
