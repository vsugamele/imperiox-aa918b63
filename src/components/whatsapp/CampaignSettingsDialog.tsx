import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: any;
  projects: { id: string; name: string }[];
  providers: any[];
  onSaved: () => void;
}

export default function CampaignSettingsDialog({ open, onClose, campaign, projects, providers, onSaved }: Props) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!campaign) return;
    setForm({
      name: campaign.name || "",
      produto: campaign.produto || "",
      project_id: campaign.project_id || "",
      provider_id: campaign.provider_id || "",
      fallback_provider_id: campaign.fallback_provider_id || "",
      auto_fallback: campaign.auto_fallback ?? true,
      pause_on_failure: campaign.pause_on_failure ?? false,
      start_date: campaign.start_date || "",
      send_window_start: campaign.send_window_start || "08:00",
      send_window_end: campaign.send_window_end || "22:00",
      exit_message: campaign.exit_message || "",
    });
  }, [campaign]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        produto: form.produto || null,
        project_id: form.project_id || null,
        provider_id: form.provider_id || null,
        fallback_provider_id: form.fallback_provider_id || null,
        auto_fallback: !!form.auto_fallback,
        pause_on_failure: !!form.pause_on_failure,
        start_date: form.start_date || null,
        send_window_start: form.send_window_start,
        send_window_end: form.send_window_end,
        exit_message: form.exit_message || null,
      };
      const { error } = await supabase.from("imphq_wa_campaigns").update(payload).eq("id", campaign.id);
      if (error) throw error;
      toast.success("Configurações salvas");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderProviderOption = (p: any) => {
    const statusColor = p.status === "open" || p.status === "connected" ? "text-emerald-400" : "text-amber-400";
    return (
      <span className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${p.status === "open" || p.status === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span>{p.instance_name || p.twilio_from || "—"}</span>
        <span className={`text-[10px] ${statusColor}`}>({p.status || "?"})</span>
      </span>
    );
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gold" /> Configurações — {campaign.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="provider">Provider & Contingência</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Produto</Label>
              <Input value={form.produto || ""} onChange={(e) => setForm({ ...form, produto: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Projeto</Label>
              <Select value={form.project_id || "__none__"} onValueChange={(v) => setForm({ ...form, project_id: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Data início</Label>
                <Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Janela início</Label>
                <Input type="time" value={form.send_window_start} onChange={(e) => setForm({ ...form, send_window_start: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Janela fim</Label>
                <Input type="time" value={form.send_window_end} onChange={(e) => setForm({ ...form, send_window_end: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem de saída</Label>
              <Textarea value={form.exit_message || ""} onChange={(e) => setForm({ ...form, exit_message: e.target.value })} rows={2} className="text-xs" />
            </div>
          </TabsContent>

          <TabsContent value="provider" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs flex items-center gap-2">
                Provider principal <Badge variant="outline" className="text-[9px]">obrigatório</Badge>
              </Label>
              <Select value={form.provider_id || "__none__"} onValueChange={(v) => setForm({ ...form, provider_id: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {providers.map((p) => <SelectItem key={p.id} value={p.id}>{renderProviderOption(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-2">
                Provider de contingência
                <Badge variant="outline" className="text-[9px] border-gold/40 text-gold">fallback</Badge>
              </Label>
              <Select value={form.fallback_provider_id || "__none__"} onValueChange={(v) => setForm({ ...form, fallback_provider_id: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="— Nenhum —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {providers
                    .filter((p) => p.id !== form.provider_id)
                    .map((p) => <SelectItem key={p.id} value={p.id}>{renderProviderOption(p)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1 leading-5">
                Se o principal falhar 2x seguidas, o scheduler tenta este provider automaticamente.
              </p>
            </div>

            <div className="rounded border border-border/40 bg-background/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1.5">⚡ Auto-fallback em falha</Label>
                  <p className="text-[10px] text-muted-foreground leading-5">Reenvia pelo provider de contingência se o principal falhar.</p>
                </div>
                <Switch checked={!!form.auto_fallback} onCheckedChange={(v) => setForm({ ...form, auto_fallback: v })} />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2.5">
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3 text-destructive" /> Pausar campanha se ambos falharem
                  </Label>
                  <p className="text-[10px] text-muted-foreground leading-5">Evita disparos cegos quando o WhatsApp está down.</p>
                </div>
                <Switch checked={!!form.pause_on_failure} onCheckedChange={(v) => setForm({ ...form, pause_on_failure: v })} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
