// Sala de máquinas (Story OP1.3): a saúde do Império numa tela — rotinas, ações automáticas, webhooks, anúncios,
// chips, Instagram, voz, custo de IA, fontes por projeto e banco. Mesma regra da CLI (scripts/health.mjs).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleAlert, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { alertCounts, machineAlerts, type MachineRoom, type Severity } from "@shared/machine-room";

const AREA_LABEL: Record<string, string> = {
  rotinas: "Rotinas", acoes: "Ações automáticas", webhooks: "Webhooks", anuncios: "Anúncios", whatsapp: "WhatsApp",
  instagram: "Instagram", voz: "Voz", custo: "Custo de IA", fontes: "Fontes", banco: "Banco",
};
const SEVERITY: Record<Severity, { label: string; icon: typeof CircleAlert; cls: string }> = {
  erro: { label: "Erro", icon: CircleAlert, cls: "text-destructive border-destructive/40 bg-destructive/10" },
  atencao: { label: "Atenção", icon: AlertTriangle, cls: "text-warning border-warning/40 bg-warning/10" },
  info: { label: "Info", icon: Info, cls: "text-muted-foreground border-border bg-secondary/40" },
};

async function loadMachineRoom(): Promise<MachineRoom> {
  const { data, error } = await supabase.rpc("imphq_machine_room");
  if (error) throw error;
  return (typeof data === "string" ? JSON.parse(data) : data) as unknown as MachineRoom;
}

export default function SalaMaquinas() {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const { data: room, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["machine-room"], queryFn: loadMachineRoom, staleTime: 60_000 });
  const alerts = useMemo(() => (room ? machineAlerts(room) : []), [room]);
  const counts = alertCounts(alerts);
  const shown = filter === "all" ? alerts : alerts.filter((a) => a.severidade === filter);

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sala de máquinas</h1>
          <p className="text-sm text-muted-foreground">
            Saúde das rotinas, fontes de número, credenciais e custos. Também na CLI: <code className="font-mono text-xs">node scripts/health.mjs</code>
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {error && <p className="text-sm text-destructive">Não foi possível ler a sala de máquinas: {error instanceof Error ? error.message : String(error)}</p>}

      {room && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por gravidade">
            {(["all", "erro", "atencao", "info"] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={filter === s} onClick={() => setFilter(s)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                {s === "all" ? `Tudo (${alerts.length})` : `${SEVERITY[s].label} (${counts[s]})`}
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] text-muted-foreground">
              Lido em {new Date(room.gerado_em).toLocaleString("pt-BR")} · {room.rotinas.length} rotinas ativas · banco {room.banco?.total_mb ?? "?"} MB
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nada aqui.</p>
          ) : (
            <div className="space-y-2">
              {shown.map((a, i) => {
                const sev = SEVERITY[a.severidade];
                const Icon = sev.icon;
                return (
                  <Card key={`${a.area}-${i}`} className={cn("border", sev.cls)}>
                    <CardContent className="flex items-start gap-3 p-3">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-label={sev.label} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          <span className="mr-2 text-[11px] uppercase tracking-wide text-muted-foreground">{AREA_LABEL[a.area] ?? a.area}</span>
                          {a.titulo}
                        </p>
                        {a.detalhe && <p className="mt-0.5 text-xs text-muted-foreground break-words">{a.detalhe}</p>}
                        {a.acao && <p className="mt-1 text-xs text-foreground/80">→ {a.acao}</p>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
