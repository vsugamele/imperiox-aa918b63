import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Link2, Plus, RefreshCw, Send, Trash2 } from "lucide-react";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Hook {
  id: string;
  project_id: string | null;
  automacao_id: string | null;
  nome: string;
  token: string;
  evento: string | null;
  field_map: Record<string, string> | null;
  ativo: boolean;
  total_recebidos: number;
  last_payload: any;
  last_received_at: string | null;
}

interface Props {
  projects: { id: string; nome?: string; name?: string }[];
  automacoes: { id: string; nome: string; trigger_tipo?: string }[];
}

const MAP_FIELDS = ["nome", "email", "telefone", "produto", "valor", "mensagem"] as const;

const randomToken = () =>
  crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);

export function InboundWebhooks({ projects, automacoes }: Props) {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const webhookFlows = automacoes.filter((a) => a.trigger_tipo === "webhook_externo");

  const load = async () => {
    const { data } = await (supabase as any)
      .from("imphq_flow_webhooks")
      .select("*")
      .order("created_at", { ascending: false });
    setHooks((data || []) as Hook[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const urlOf = (h: Hook) => `${SUPA_URL}/functions/v1/openflow-webhook/${h.token}`;

  const create = async () => {
    const { error } = await (supabase as any)
      .from("imphq_flow_webhooks")
      .insert({ nome: "Novo webhook", token: randomToken() });
    if (error) return toast.error(error.message);
    toast.success("Webhook criado");
    load();
  };

  const update = async (id: string, values: Partial<Hook>) => {
    const { error } = await (supabase as any)
      .from("imphq_flow_webhooks")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setHooks((prev) => prev.map((h) => (h.id === id ? { ...h, ...values } as Hook : h)));
  };

  const rotate = async (id: string) => {
    const token = randomToken();
    await update(id, { token });
    toast.success("Token rotacionado — atualize a URL no provedor");
  };

  const remove = async (id: string) => {
    if (!confirm("Apagar este webhook? A URL para de funcionar.")) return;
    const { error } = await (supabase as any).from("imphq_flow_webhooks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setHooks((prev) => prev.filter((h) => h.id !== id));
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const test = async (h: Hook) => {
    setTesting(h.id);
    try {
      const res = await fetch(urlOf(h), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: h.evento || "teste",
          event_id: `test-${Date.now()}`,
          name: "Lead de Teste",
          email: "teste@exemplo.com",
          phone: "5511999999999",
          message: "Disparo de teste do painel",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.ok) toast.success("Disparo enviado — confira em Logs & Monitoramento");
      else toast.error(json?.error || "Falha no disparo");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro no disparo");
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Webhooks de entrada
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-6">
                Gere uma URL e cole no Zernio, n8n, Make ou qualquer plataforma. Cada disparo inicia um fluxo
                com o gatilho <code className="text-primary">Webhook externo</code>. O payload inteiro fica
                disponível nas mensagens como <code className="text-primary">{"{{campo}}"}</code>.
              </p>
            </div>
            <Button size="sm" onClick={create} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Novo webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      {hooks.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum webhook criado ainda.</p>
      )}

      {hooks.map((h) => (
        <Card key={h.id} className="bg-card border-border">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={h.nome}
                onChange={(e) => setHooks((p) => p.map((x) => (x.id === h.id ? { ...x, nome: e.target.value } : x)))}
                onBlur={(e) => update(h.id, { nome: e.target.value })}
                className="max-w-[240px] h-9"
              />
              <Badge variant="outline">{h.total_recebidos} disparos</Badge>
              {h.last_received_at && (
                <span className="text-xs text-muted-foreground">
                  último: {new Date(h.last_received_at).toLocaleString("pt-BR")}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Ativo</Label>
                <Switch checked={h.ativo} onCheckedChange={(v) => update(h.id, { ativo: v })} />
                <Button size="icon" variant="ghost" onClick={() => remove(h.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[260px] text-xs bg-secondary/40 rounded px-3 py-2 break-all">
                {urlOf(h)}
              </code>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => copy(urlOf(h))}>
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => rotate(h.id)}>
                <RefreshCw className="h-4 w-4" /> Novo token
              </Button>
              <Button size="sm" className="gap-2" disabled={testing === h.id} onClick={() => test(h)}>
                <Send className="h-4 w-4" /> {testing === h.id ? "Enviando…" : "Testar"}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Projeto</Label>
                <Select
                  value={h.project_id ?? "__none__"}
                  onValueChange={(v) => update(h.id, { project_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem projeto</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome || p.name || p.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fluxo específico (opcional)</Label>
                <Select
                  value={h.automacao_id ?? "__all__"}
                  onValueChange={(v) => update(h.id, { automacao_id: v === "__all__" ? null : v })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos com gatilho Webhook externo</SelectItem>
                    {webhookFlows.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome do evento (opcional)</Label>
                <Input
                  value={h.evento ?? ""}
                  placeholder="ex: novo_contato"
                  onChange={(e) => setHooks((p) => p.map((x) => (x.id === h.id ? { ...x, evento: e.target.value } : x)))}
                  onBlur={(e) => update(h.id, { evento: e.target.value || null })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Mapeamento de campos (deixe vazio para detecção automática)
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {MAP_FIELDS.map((f) => (
                  <Input
                    key={f}
                    className="h-9"
                    placeholder={`${f} → ex: customer.${f}`}
                    defaultValue={(h.field_map || {})[f] || ""}
                    onBlur={(e) => {
                      const next = { ...(h.field_map || {}) };
                      if (e.target.value) next[f] = e.target.value;
                      else delete next[f];
                      update(h.id, { field_map: next });
                    }}
                  />
                ))}
              </div>
            </div>

            {h.last_payload && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Último payload recebido</summary>
                <pre className="mt-2 max-h-56 overflow-auto rounded bg-secondary/40 p-3 text-[11px] leading-5">
                  {JSON.stringify(h.last_payload, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
