import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Eye, RotateCcw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface WebhookRow {
  id: string;
  project_id: string | null;
  plataforma: string;
  evento: string;
  lead_id: string | null;
  processado: boolean;
  created_at: string;
  payload: any;
  error?: { id: string; erro: string; reprocessado: boolean } | null;
}

export function WebhookLogTab() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [viewPayload, setViewPayload] = useState<any>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Load webhooks
      let query = supabase
        .from("imphq_webhooks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter !== "all") {
        query = query.eq("plataforma", filter);
      }

      const { data: wh } = await query;

      // Load errors
      const { data: errors } = await supabase
        .from("imphq_webhook_errors")
        .select("id, webhook_id, erro, reprocessado")
        .order("created_at", { ascending: false })
        .limit(200);

      const errorMap = new Map<string, any>();
      (errors || []).forEach((e: any) => {
        if (e.webhook_id) errorMap.set(e.webhook_id, e);
      });

      const rows: WebhookRow[] = (wh || []).map((w: any) => ({
        ...w,
        error: errorMap.get(w.id) || null,
      }));

      setWebhooks(rows);
    } catch {
      toast.error("Erro ao carregar webhooks");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const reprocess = async (wh: WebhookRow) => {
    if (!wh.payload) return;
    setReprocessing(wh.id);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "tkbivipqiewkfnhktmqq";
      const url = `https://${projectId}.supabase.co/functions/v1/webhook-pagamento${wh.project_id ? `?project=${wh.project_id}` : ""}`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wh.payload),
      });

      if (res.ok) {
        // Mark error as reprocessed
        if (wh.error?.id) {
          await supabase.from("imphq_webhook_errors").update({ reprocessado: true, reprocessado_at: new Date().toISOString() }).eq("id", wh.error.id);
        }
        toast.success("Webhook reprocessado com sucesso!");
        load();
      } else {
        toast.error("Falha no reprocessamento");
      }
    } catch {
      toast.error("Erro ao reprocessar");
    }
    setReprocessing(null);
  };

  const platforms = [...new Set(webhooks.map(w => w.plataforma))];

  const statusBadge = (wh: WebhookRow) => {
    if (wh.error && !wh.error.reprocessado) {
      return <Badge className="text-[9px] bg-destructive/20 text-destructive"><XCircle className="h-3 w-3 mr-0.5" /> Erro</Badge>;
    }
    if (wh.error?.reprocessado) {
      return <Badge className="text-[9px] bg-amber-500/20 text-amber-400"><RotateCcw className="h-3 w-3 mr-0.5" /> Reprocessado</Badge>;
    }
    if (wh.processado) {
      return <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-0.5" /> OK</Badge>;
    }
    return <Badge className="text-[9px] bg-muted text-muted-foreground"><Clock className="h-3 w-3 mr-0.5" /> Pendente</Badge>;
  };

  const platformColor = (p: string) => {
    const map: Record<string, string> = { Ticto: "text-violet-400", Hotmart: "text-orange-400", Kiwify: "text-emerald-400" };
    return map[p] || "text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Log de Webhooks</h2>
          <p className="text-xs text-muted-foreground">{webhooks.length} webhooks recentes</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p>
      ) : webhooks.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum webhook recebido ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {webhooks.map(wh => (
            <Card key={wh.id} className="bg-card border-border hover:bg-secondary/30 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${platformColor(wh.plataforma)}`}>{wh.plataforma}</span>
                        <Badge variant="outline" className="text-[9px]">{wh.evento}</Badge>
                        {statusBadge(wh)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(wh.created_at).toLocaleString("pt-BR")}
                        </span>
                        {wh.lead_id && <span className="text-[10px] text-muted-foreground">· Lead: {wh.lead_id.slice(0, 8)}...</span>}
                        {wh.error && !wh.error.reprocessado && (
                          <span className="text-[10px] text-destructive truncate max-w-[200px]">{wh.error.erro}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver payload" onClick={() => setViewPayload(wh.payload)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {wh.error && !wh.error.reprocessado && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-amber-400"
                        title="Reprocessar"
                        disabled={reprocessing === wh.id}
                        onClick={() => reprocess(wh)}
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${reprocessing === wh.id ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewPayload} onOpenChange={() => setViewPayload(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Payload do Webhook</DialogTitle>
          </DialogHeader>
          <pre className="text-[11px] bg-secondary rounded-lg p-4 overflow-auto whitespace-pre-wrap break-all">
            {JSON.stringify(viewPayload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
