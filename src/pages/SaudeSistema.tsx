import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CircleHelp, HeartPulse, Loader2, RefreshCw, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";
import {
  STATUS_ORDER, summarize, timeAgo, useSystemHealth,
  type HealthCheck, type HealthStatus,
} from "@/lib/system-health";

const STATUS_UI: Record<HealthStatus, { label: string; icon: LucideIcon; tone: string; badge: string }> = {
  fail:    { label: "Quebrado",   icon: XCircle,       tone: "text-red-500",     badge: "bg-red-500/10 text-red-500 border-red-500/30" },
  warn:    { label: "Atenção",    icon: AlertTriangle, tone: "text-amber-500",   badge: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  unknown: { label: "Sem dado",   icon: CircleHelp,    tone: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
  ok:      { label: "Funcionando", icon: CheckCircle2, tone: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
};

function CheckRow({ check }: { check: HealthCheck }) {
  const ui = STATUS_UI[check.status];
  const Icon = ui.icon;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0" data-testid={`health-${check.key}`}>
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${ui.tone}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-foreground">{check.label}</span>
          <Badge variant="outline" className={`text-[10px] ${ui.badge}`}>{ui.label}</Badge>
          <span className="text-[11px] text-muted-foreground">último registro: {timeAgo(check.last_at)}</span>
        </div>
        {check.detail && <p className="text-xs text-muted-foreground mt-0.5 break-words">{check.detail}</p>}
        {check.hint && check.status !== "ok" && (
          <p className="text-xs mt-1 text-foreground"><span className="font-semibold">O que fazer:</span> {check.hint}</p>
        )}
      </div>
    </div>
  );
}

export default function SaudeSistema() {
  const { data, error, isLoading, isFetching, refetch } = useSystemHealth();
  const checks = [...(data?.checks ?? [])].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const count = summarize(checks);
  const areas = Array.from(new Set(checks.map((c) => c.area)));
  const commit = typeof __APP_COMMIT__ === "string" && __APP_COMMIT__ ? __APP_COMMIT__.slice(0, 7) : "local";
  const build = typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" /> O que está no ar</h1>
          <p className="text-xs text-muted-foreground">
            Cada linha vem do banco agora. Se algo parou de chegar, aparece aqui com o que fazer.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Verificar agora
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["fail", "warn", "unknown", "ok"] as HealthStatus[]).map((s) => {
          const ui = STATUS_UI[s];
          const Icon = ui.icon;
          return (
            <Card key={s}><CardContent className="p-3 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${ui.tone}`} />
              <div>
                <div className="text-xl font-bold tabular-nums">{data ? count[s] : "—"}</div>
                <div className="text-[11px] text-muted-foreground">{ui.label}</div>
              </div>
            </CardContent></Card>
          );
        })}
      </div>

      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando…</div>}
      {error && (
        <Card className="border-red-500/40"><CardContent className="p-4 text-sm text-red-500">
          Não consegui ler o diagnóstico: {errorMessage(error)}
        </CardContent></Card>
      )}

      {areas.map((area) => (
        <Card key={area}>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{area}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {checks.filter((c) => c.area === area).map((c) => <CheckRow key={c.key} check={c} />)}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">Versão do site</CardTitle></CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
          <p>Commit no ar: <code className="text-foreground">{commit}</code>{build && <> · build {new Date(build).toLocaleString("pt-BR")}</>}</p>
          <p>Se este commit não for o último do GitHub (<code>main</code>), o deploy da Vercel não foi promovido para produção.</p>
          {data && <p>Diagnóstico gerado {timeAgo(data.generated_at)}. <Link className="underline" to="/sala-de-maquinas">Sala de máquinas</Link></p>}
        </CardContent>
      </Card>
    </div>
  );
}
