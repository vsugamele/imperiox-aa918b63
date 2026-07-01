import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Zap, CheckCircle2, AlertCircle, Loader2, Play, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function normalizePhone(v: string | null | undefined): string {
  if (!v) return "";
  const d = String(v).replace(/\D/g, "");
  return d.startsWith("55") ? d : "55" + d;
}

function getChatLink(action: any): string | null {
  const p = action.payload || {};
  const phone = p.phone || p.lead_phone || p.lead?.phone || "";
  const project = p.project_id || action.projeto_id || "";
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `/inbox?tab=whatsapp&phone=${digits}${project ? `&project=${project}` : ""}`;
}

export default function Imperius() {
  const navigate = useNavigate();
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scouting, setScouting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("imphq_ai_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setActions(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScout = async () => {
    setScouting(true);
    try {
      const { data, error } = await supabase.functions.invoke("imperius-scout", { body: {} });
      if (error) throw error;
      toast.success(`Scout: ${data.proposed} ações propostas, ${data.auto_executed} auto-executadas`);
      await load();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setScouting(false);
    }
  };

  const stats = {
    total: actions.length,
    executed: actions.filter((a) => a.status === "executed").length,
    pending: actions.filter((a) => a.status === "proposed").length,
    failed: actions.filter((a) => a.status === "failed").length,
    auto: actions.filter((a) => a.auto_executed).length,
  };

  // Atividade IA (últimos 7d) — visibilidade de consumo/uso
  const aiActivity = (() => {
    const now = Date.now();
    const sevenD = now - 7 * 24 * 60 * 60 * 1000;
    const oneD = now - 24 * 60 * 60 * 1000;
    const recent = actions.filter((a) => new Date(a.created_at).getTime() >= sevenD);
    const last24 = actions.filter((a) => new Date(a.created_at).getTime() >= oneD).length;
    const byKind = new Map<string, number>();
    let impact = 0;
    recent.forEach((a) => {
      const k = a.kind || "outro";
      byKind.set(k, (byKind.get(k) || 0) + 1);
      const i = parseFloat(a.impact_brl);
      if (!isNaN(i)) impact += i;
    });
    const autoPct = recent.length > 0 ? Math.round((recent.filter((a) => a.auto_executed).length / recent.length) * 100) : 0;
    const failPct = recent.length > 0 ? Math.round((recent.filter((a) => a.status === "failed").length / recent.length) * 100) : 0;
    const topKinds = Array.from(byKind.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total7d: recent.length, last24, autoPct, failPct, impact, topKinds };
  })();


  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl text-foreground flex items-center gap-3">
            <Bot className="h-9 w-9 text-primary" /> Imperius Autônomo
          </h1>
          <p className="text-muted-foreground mt-1 leading-7">Decisões da IA em tempo real. Low-risk roda sozinho, high-risk vai pra fila.</p>
        </div>
        <Button onClick={runScout} disabled={scouting} className="bg-primary text-primary-foreground">
          {scouting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          Rodar Scout Agora
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-secondary/40">
          <p className="text-xs text-muted-foreground uppercase">Total</p>
          <p className="text-3xl font-serif text-foreground mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-secondary/40">
          <p className="text-xs text-muted-foreground uppercase">Auto-executadas</p>
          <p className="text-3xl font-serif text-primary mt-1">{stats.auto}</p>
        </Card>
        <Card className="p-4 bg-secondary/40">
          <p className="text-xs text-muted-foreground uppercase">Executadas</p>
          <p className="text-3xl font-serif text-emerald-400 mt-1">{stats.executed}</p>
        </Card>
        <Card className="p-4 bg-secondary/40">
          <p className="text-xs text-muted-foreground uppercase">Pendentes</p>
          <p className="text-3xl font-serif text-amber-400 mt-1">{stats.pending}</p>
        </Card>
        <Card className="p-4 bg-secondary/40">
          <p className="text-xs text-muted-foreground uppercase">Falhas</p>
          <p className="text-3xl font-serif text-red-400 mt-1">{stats.failed}</p>
        </Card>
      </div>

      <Card className="p-4 bg-secondary/40 border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-foreground">Atividade IA · últimos 7d</h2>
          <div className="flex gap-2 text-[11px] text-muted-foreground">
            <span>24h: <strong className="text-foreground">{aiActivity.last24}</strong></span>
            <span>•</span>
            <span>Auto: <strong className="text-primary">{aiActivity.autoPct}%</strong></span>
            <span>•</span>
            <span>Falhas: <strong className={aiActivity.failPct > 15 ? "text-red-400" : "text-foreground"}>{aiActivity.failPct}%</strong></span>
            <span>•</span>
            <span>Impacto: <strong className="text-emerald-400">R$ {aiActivity.impact.toFixed(0)}</strong></span>
          </div>
        </div>
        {aiActivity.topKinds.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sem atividade nos últimos 7 dias.</p>
        ) : (
          <div className="space-y-1.5">
            {aiActivity.topKinds.map(([kind, count]) => {
              const pct = Math.round((count / aiActivity.total7d) * 100);
              return (
                <div key={kind} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-32 truncate">{kind}</span>
                  <div className="flex-1 h-1.5 bg-background/60 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">{count} · {pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>


      <Card className="bg-secondary/40 border-border">
        <div className="p-4 border-b border-border">
          <h2 className="font-serif text-2xl text-foreground">Feed de decisões</h2>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : actions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>Nenhuma ação ainda. Clique em "Rodar Scout" para iniciar.</p>
            </div>
          ) : (
            actions.map((a) => (
              <div key={a.id} className="p-4 hover:bg-background/40 leading-7">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {a.status === "executed" && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                      {a.status === "failed" && <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />}
                      {a.status === "proposed" && <Zap className="h-4 w-4 text-amber-400 shrink-0" />}
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">{a.risk_level}</Badge>
                      <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
                      {a.auto_executed && <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary">AUTO</Badge>}
                    </div>
                    {a.reason && <p className="text-xs text-muted-foreground ml-6">{a.reason}</p>}
                    {a.error && <p className="text-xs text-red-400 ml-6 mt-1">{a.error}</p>}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{Math.round(a.confidence * 100)}%</p>
                    {(() => {
                      const link = getChatLink(a);
                      return link ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => navigate(link)}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Abrir chat
                        </Button>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
