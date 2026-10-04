// Plataformas (Story OPS2.1): o que o Império pode usar, como opera cada uma e o que falta.
// Padrão da tela /plataformas do Centro de Comando; estado pelos sinais da sala de máquinas. CLI: node scripts/health.mjs --plataformas
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { MachineRoom } from "@shared/machine-room";
import { ACTION_LABEL, AUTONOMY_LABEL, CATEGORY_LABEL, PLATFORMS, STATE_LABEL, platformStatus, platformSummary, type PlatformState } from "@shared/platforms";

const STATE_STYLE: Record<PlatformState, string> = {
  operacional: "border-success/40 bg-success/10 text-success",
  atencao: "border-warning/40 bg-warning/10 text-warning",
  erro: "border-destructive/40 bg-destructive/10 text-destructive",
  pendente: "border-border bg-secondary text-muted-foreground",
  sem_sinal: "border-border bg-secondary/50 text-muted-foreground",
};

async function loadRoom(): Promise<MachineRoom> {
  const { data, error } = await supabase.rpc("imphq_machine_room");
  if (error) throw error;
  return (typeof data === "string" ? JSON.parse(data) : data) as unknown as MachineRoom;
}

export default function Plataformas() {
  const { data: room, isLoading, error } = useQuery({ queryKey: ["machine-room"], queryFn: loadRoom, staleTime: 60_000 });
  const rows = useMemo(() => (room ? PLATFORMS.map((p) => ({ p, s: platformStatus(p, room) })) : []), [room]);
  const summary = platformSummary(rows);
  const categories = [...new Set(PLATFORMS.map((p) => p.categoria))];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Cérebro operacional</p>
          <h1 className="text-2xl font-semibold text-foreground">O que podemos usar, como operar e o que falta.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso, capacidade, autonomia e autorização separados. Claude, os agentes e o time leem o mesmo estado; o estado vem dos sinais reais, não de declaração.</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold text-foreground">{summary.total}</p>
          <p className="text-xs text-muted-foreground">plataformas registradas</p>
        </div>
      </section>

      {isLoading && <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {error && <p className="text-sm text-destructive">Não foi possível ler os sinais: {error instanceof Error ? error.message : String(error)}</p>}

      {room && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumo">
            {[
              [summary.utilizaveis, "Utilizáveis", "Sinal de uso observado"],
              [summary.automatizaveis, "Automatizáveis", "API, CLI, webhook ou agente"],
              [summary.assistidas, "Assistidas", "Dependem de navegador ou pessoa"],
              [summary.pendentes, "Pendentes", "Erro ou configuração faltando"],
            ].map(([n, t, d]) => (
              <article key={String(t)} className="rounded-lg border border-border bg-card p-3">
                <p className="text-2xl font-semibold text-foreground">{n}</p>
                <p className="text-sm text-foreground">{t}</p>
                <p className="text-[11px] text-muted-foreground">{d}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            {[
              ["01", "Fonte da verdade", "Registro versionado no código define as capacidades; o banco guarda estado, tarefas e logs."],
              ["02", "Segredos fora da tela", "Aparecem só nomes de variáveis protegidas, nunca o valor de token ou senha."],
              ["03", "Acesso não é autorização", "Publicar, gastar e mandar mensagem continuam passando pela fila de aprovação."],
            ].map(([n, t, d]) => (
              <article key={n} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                <span className="text-xs font-mono text-primary">{n}</span>
                <p className="text-sm font-medium text-foreground">{t}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </article>
            ))}
          </section>

          {categories.map((cat) => (
            <section key={cat} className="space-y-3">
              <div className="flex items-baseline gap-2 border-b border-border/50 pb-1">
                <h2 className="text-base font-semibold text-foreground">{CATEGORY_LABEL[cat]}</h2>
                <span className="text-xs text-muted-foreground">{rows.filter((r) => r.p.categoria === cat).length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.filter((r) => r.p.categoria === cat).map(({ p, s }) => (
                  <article key={p.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                    <header className="flex items-start justify-between gap-2">
                      <strong className="text-sm text-foreground">{p.nome}</strong>
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px]", STATE_STYLE[s.estado])}>{STATE_LABEL[s.estado]}</span>
                    </header>
                    <p className="text-[13px] text-foreground/85">{p.objetivo}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.acoes.map((a) => <span key={a} className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{ACTION_LABEL[a]}</span>)}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                      <dt className="text-muted-foreground">Autonomia</dt><dd className="text-foreground">{AUTONOMY_LABEL[p.autonomia]}</dd>
                      <dt className="text-muted-foreground">Acesso</dt><dd className="text-foreground">{p.acesso}</dd>
                      <dt className="text-muted-foreground">Quem opera</dt><dd className="text-foreground">{p.quem}</dd>
                      <dt className="text-muted-foreground">Evidência</dt><dd className="text-foreground">{s.evidencia}</dd>
                      {s.custo && <><dt className="text-muted-foreground">Custo</dt><dd className="text-foreground">{s.custo}</dd></>}
                    </dl>
                    <div className="mt-auto rounded-md bg-secondary/40 p-2 text-[12px]">
                      <span className="text-muted-foreground">Próximo passo: </span><span className="text-foreground">{p.proximo}</span>
                      {s.bloqueio && <p className="mt-0.5 text-destructive">Bloqueio: {s.bloqueio}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
