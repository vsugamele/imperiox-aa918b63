import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: any[];
  templates?: any[];
}

export default function BulkSendDialog({ open, onOpenChange, providers, templates = [] }: Props) {
  const [leads, setLeads] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [providerId, setProviderId] = useState("");
  const [template, setTemplate] = useState("Olá {{nome}}, tudo bem?");
  const [delayMs, setDelayMs] = useState(3000);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from("imphq_leads").select("id, nome, telefone, projeto_id").not("telefone", "is", null).order("nome").then(({ data }) => {
        setLeads(data || []);
      });
    }
  }, [open]);

  const toggleLead = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selected.length === leads.length) setSelected([]);
    else setSelected(leads.map(l => l.id));
  };

  const send = async () => {
    if (!providerId) { toast.error("Selecione um provider"); return; }
    if (selected.length === 0) { toast.error("Selecione ao menos 1 contato"); return; }
    setSending(true);
    setResults([]);
    try {
      const contacts = leads.filter(l => selected.includes(l.id)).map(l => ({
        phone: l.telefone.replace(/\D/g, ""),
        name: l.nome || "",
      }));
      const provider = providers.find(p => p.id === providerId);
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_bulk", {
        body: {
          provider_id: providerId,
          contacts,
          message_template: template,
          project_id: provider?.project_id || "",
          delay_ms: delayMs,
        },
      });
      if (error) throw error;
      setResults(data?.results || []);
      toast.success(`Disparo concluído: ${data?.results?.length || 0} mensagens`);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>📢 Disparo em Massa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger><SelectValue placeholder="Selecione o provider" /></SelectTrigger>
              <SelectContent>
                {providers.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.provider === "evolution" ? "🟢" : "🔵"} {p.instance_name || p.twilio_from || p.provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Template de mensagem</Label>
            <Textarea value={template} onChange={e => setTemplate(e.target.value)} rows={3} placeholder="Use {{nome}} para personalizar" />
            <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {"{{nome}}"}, {"{{telefone}}"}</p>
          </div>

          <div>
            <Label>Delay entre mensagens (ms)</Label>
            <Input type="number" value={delayMs} onChange={e => setDelayMs(Number(e.target.value))} min={1000} step={500} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Contatos ({selected.length}/{leads.length})</Label>
              <Button size="sm" variant="ghost" onClick={selectAll}>
                {selected.length === leads.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
            <ScrollArea className="h-48 border border-border rounded-lg p-2">
              {leads.map(l => (
                <label key={l.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm">
                  <Checkbox checked={selected.includes(l.id)} onCheckedChange={() => toggleLead(l.id)} />
                  <span className="flex-1 truncate">{l.nome || "Sem nome"}</span>
                  <span className="text-xs text-muted-foreground font-mono">{l.telefone}</span>
                </label>
              ))}
              {leads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum lead com telefone</p>}
            </ScrollArea>
          </div>

          {results.length > 0 && (
            <div>
              <Label>Resultados</Label>
              <ScrollArea className="h-32 border border-border rounded-lg p-2">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1">
                    <Badge variant={r.status === "sent" ? "default" : "destructive"} className="text-[9px]">{r.status}</Badge>
                    <span className="font-mono">{r.phone}</span>
                    {r.error && <span className="text-destructive truncate">{r.error}</span>}
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={sending}>
            {sending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4 mr-1" /> Disparar ({selected.length})</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
