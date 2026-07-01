import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Send, Copy, RefreshCw, Webhook, Eye } from "lucide-react";
import { toast } from "sonner";

const EVENTS: { id: string; label: string; desc: string }[] = [
  { id: "lead.created", label: "Lead criado", desc: "Novo lead capturado em qualquer formulário" },
  { id: "lead.hot", label: "Lead quente", desc: "Lead gerou Pix/Boleto recentemente" },
  { id: "lead.estagio_mudou", label: "Mudança de estágio", desc: "Lead avançou ou regrediu no funil" },
  { id: "venda.paga", label: "Venda paga", desc: "Pagamento aprovado em qualquer plataforma" },
  { id: "venda.reembolsada", label: "Venda reembolsada", desc: "Reembolso confirmado" },
  { id: "whatsapp.resposta_recebida", label: "Resposta no WhatsApp", desc: "Lead respondeu uma mensagem" },
  { id: "imperius.acao_executada", label: "Ação Imperius", desc: "IA autônoma executou ação" },
  { id: "ads.alerta_critico", label: "Alerta crítico de ads", desc: "CPA disparou, CTR caiu, etc." },
  { id: "campanha.meta_batida", label: "Meta batida", desc: "Projeto atingiu meta configurada" },
];

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  project_id: string | null;
  total_deliveries: number;
  total_failures: number;
  last_status: string | null;
  last_delivery_at: string | null;
}

export function OutboundWebhooksTab() {
  const { user } = useAuth();
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewingDeliveries, setViewingDeliveries] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  // form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const load = async () => {
    const { data } = await supabase.from("imphq_outbound_webhooks" as any).select("*").order("created_at", { ascending: false });
    setHooks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user || !name.trim() || !url.trim() || selectedEvents.length === 0) {
      toast.error("Preencha nome, URL e selecione pelo menos 1 evento");
      return;
    }
    try { new URL(url); } catch { toast.error("URL inválida"); return; }
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
    const { error } = await supabase.from("imphq_outbound_webhooks" as any).insert({
      user_id: user.id, name: name.trim(), url: url.trim(), events: selectedEvents, secret, active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Webhook criado!");
    setName(""); setUrl(""); setSelectedEvents([]); setCreating(false);
    load();
  };

  const toggle = async (h: Webhook) => {
    await supabase.from("imphq_outbound_webhooks" as any).update({ active: !h.active }).eq("id", h.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este webhook?")) return;
    await supabase.from("imphq_outbound_webhooks" as any).delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const test = async (h: Webhook) => {
    toast.info("Disparando teste...");
    const { data, error } = await supabase.functions.invoke("outbound-webhook-dispatcher", {
      body: { webhook_id: h.id, event: "webhook.test", payload: { message: "Teste do Imperius", timestamp: new Date().toISOString() } },
    });
    if (error) toast.error(error.message);
    else toast.success(`Enviado (${(data as any)?.dispatched ?? 0} entrega)`);
    setTimeout(load, 1500);
  };

  const openDeliveries = async (h: Webhook) => {
    setViewingDeliveries(h);
    const { data } = await supabase
      .from("imphq_outbound_webhook_deliveries" as any)
      .select("*").eq("webhook_id", h.id).order("created_at", { ascending: false }).limit(50);
    setDeliveries((data as any) || []);
  };

  const resend = async (deliveryId: string, event: string, payload: any, webhookId: string) => {
    const { error } = await supabase.functions.invoke("outbound-webhook-dispatcher", {
      body: { webhook_id: webhookId, event, payload },
    });
    if (error) toast.error(error.message); else toast.success("Reenviado");
    if (viewingDeliveries) openDeliveries(viewingDeliveries);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhooks de Saída</h2>
          <p className="text-xs text-muted-foreground">Envie eventos do Imperius em tempo real para Zapier, Make, n8n, Slack, planilhas, etc.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Novo webhook</Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : hooks.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum webhook configurado.</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Novo webhook" para começar.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {hooks.map(h => (
            <Card key={h.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{h.name}</p>
                      <Badge variant={h.active ? "default" : "secondary"} className="text-[10px]">{h.active ? "Ativo" : "Pausado"}</Badge>
                      {h.last_status === "failed" && <Badge variant="destructive" className="text-[10px]">Última falhou</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono break-all mt-0.5">{h.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {h.events.map(e => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {h.total_deliveries} entregas · {h.total_failures} falhas
                      {h.last_delivery_at && ` · última: ${new Date(h.last_delivery_at).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={h.active} onCheckedChange={() => toggle(h)} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Testar" onClick={() => test(h)}>
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver entregas" onClick={() => openDeliveries(h)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(h.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground">Secret HMAC:</span>
                  <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono">{h.secret.slice(0, 16)}...</code>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(h.secret); toast.success("Copiado"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-secondary/30 border-border">
        <CardContent className="p-4 space-y-2 text-xs">
          <p className="font-semibold">📖 Como validar a assinatura</p>
          <p className="text-muted-foreground">
            Cada request inclui <code className="bg-secondary px-1 rounded">X-Imperius-Signature</code> (HMAC SHA256 hex do body usando seu <code className="bg-secondary px-1 rounded">secret</code>).
            Headers extras: <code className="bg-secondary px-1 rounded">X-Imperius-Event</code>, <code className="bg-secondary px-1 rounded">X-Imperius-Delivery-Id</code>.
          </p>
          <p className="text-muted-foreground">Retries automáticos: 1min → 5min → 30min (até 3 tentativas) em falhas (non-2xx ou timeout 10s).</p>
        </CardContent>
      </Card>

      {/* Modal: criar */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="bg-secondary/40 max-w-lg">
          <DialogHeader><DialogTitle>Novo Webhook</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Slack #vendas" className="bg-secondary" />
            </div>
            <div>
              <Label className="text-xs">URL de destino</Label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." className="bg-secondary" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Eventos a assinar</Label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {EVENTS.map(ev => (
                  <label key={ev.id} className="flex items-start gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer">
                    <Checkbox
                      checked={selectedEvents.includes(ev.id)}
                      onCheckedChange={c => setSelectedEvents(s => c ? [...s, ev.id] : s.filter(x => x !== ev.id))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{ev.label} <code className="text-[10px] text-muted-foreground">{ev.id}</code></p>
                      <p className="text-[10px] text-muted-foreground leading-5">{ev.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={create}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: entregas */}
      <Dialog open={!!viewingDeliveries} onOpenChange={() => setViewingDeliveries(null)}>
        <DialogContent className="bg-secondary/40 max-w-3xl">
          <DialogHeader><DialogTitle>Últimas entregas — {viewingDeliveries?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {deliveries.length === 0 && <p className="text-xs text-muted-foreground">Sem entregas ainda.</p>}
            {deliveries.map(d => (
              <div key={d.id} className="p-2 rounded bg-secondary/50 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === "success" ? "default" : d.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                      {d.status}
                    </Badge>
                    <code className="text-[10px]">{d.event}</code>
                    {d.status_code && <span className="text-[10px] text-muted-foreground">HTTP {d.status_code}</span>}
                    <span className="text-[10px] text-muted-foreground">tentativa {d.attempt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" title="Reenviar"
                      onClick={() => resend(d.id, d.event, d.payload, d.webhook_id)}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {d.error_message && <p className="text-[10px] text-destructive">{d.error_message}</p>}
                {d.response_body && <p className="text-[10px] text-muted-foreground font-mono truncate">{d.response_body}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
