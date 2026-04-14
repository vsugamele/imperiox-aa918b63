import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: any | null;
  waProviders: any[];
  waTemplates: any[];
  projects: any[];
}

export default function LeadWhatsAppDialog({ open, onOpenChange, target, waProviders, waTemplates, projects }: Props) {
  const [providerId, setProviderId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Auto-select provider: prefer project match, then first active
  useEffect(() => {
    if (!open || waProviders.length === 0) return;
    const projectProviders = target?.project_id
      ? waProviders.filter((p: any) => p.project_id === target.project_id)
      : [];
    if (projectProviders.length > 0) {
      setProviderId(projectProviders[0].id);
    } else if (waProviders.length === 1) {
      setProviderId(waProviders[0].id);
    }
  }, [open, target?.project_id, waProviders]);

  const sendMessage = async () => {
    if (!target?.phone) { toast.error("Lead sem telefone"); return; }
    if (!providerId) { toast.error("Selecione um provider WhatsApp"); return; }
    if (!message.trim()) { toast.error("Digite uma mensagem"); return; }
    setSending(true);
    try {
      const digits = (target.phone || "").replace(/\D/g, "");
      const normalized = digits.startsWith("55") && digits.length >= 12 ? digits : (digits.length === 10 || digits.length === 11) ? "55" + digits : digits;
      const finalMsg = message
        .replace(/\{\{nome\}\}/g, target.nome || "")
        .replace(/\{\{email\}\}/g, target.email || "")
        .replace(/\{\{telefone\}\}/g, target.phone || "");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-api?action=send_message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            provider_id: providerId,
            phone: normalized,
            content: finalMsg,
            project_id: target.project_id || null,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao enviar");
      toast.success("Mensagem enviada via WhatsApp!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "falha ao enviar"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>💬 Enviar WhatsApp para {target?.nome || target?.phone}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Sessão / Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger><SelectValue placeholder="Selecionar número..." /></SelectTrigger>
              <SelectContent>
                {waProviders.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.provider === "hub_local" ? "📱" : p.provider === "evolution" ? "🟢" : "🔵"} {p.instance_name || p.twilio_from} — {projects.find((pr: any) => pr.id === p.project_id)?.name || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {waProviders.length === 0 && <p className="text-[10px] text-destructive mt-1">⚠️ Nenhum provider WhatsApp ativo. Configure em WhatsApp Hub.</p>}
          </div>
          {waTemplates.length > 0 && (
            <div>
              <Label>Template (opcional)</Label>
              <Select onValueChange={v => { const t = waTemplates.find((t: any) => t.id === v); if (t) setMessage(t.content); }}>
                <SelectTrigger><SelectValue placeholder="Usar template..." /></SelectTrigger>
                <SelectContent>
                  {waTemplates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Olá {{nome}}, tudo bem?" />
            <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{telefone}}"}</p>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { const d = (target?.phone || "").replace(/\D/g, ""); const n = d.startsWith("55") ? d : "55" + d; window.open(`https://wa.me/${n}`, "_blank"); }}>
            <ExternalLink className="h-3 w-3 mr-1" /> wa.me
          </Button>
          <Button onClick={sendMessage} disabled={sending || !providerId}>
            <Send className="h-3.5 w-3.5 mr-1" /> {sending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
