import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleDashed, CircleAlert, Factory } from "lucide-react";
import { cn } from "@/lib/utils";
import { flowSteps, nextStep, type FlowStep, type StepKey } from "@/lib/creative-flow";
import { useFactoryStatus } from "@/hooks/useFactoryStatus";
import { useGlobalProject, useGlobalProjectList } from "@/hooks/useGlobalProject";
import { CastTab } from "@/components/studio/CastTab";
import { MiningSources } from "@/components/estrategias/MiningSources";
import { NextBatchPanel } from "@/components/testes/NextBatchPanel";

const ICON = { feito: CheckCircle2, atencao: CircleAlert, pendente: CircleDashed } as const;
const TONE = {
  feito: "border-success/40 text-success",
  atencao: "border-warning/50 text-warning",
  pendente: "border-border text-muted-foreground",
} as const;

const anchor = (k: StepKey) => `passo-${k}`;

/**
 * Fábrica de criativos (UX1.2): o fluxo inteiro de um projeto numa tela só — Elenco → Mercado → Leva → Artes →
 * Teste no ar → Placar — com o próximo passo em destaque. Usa o projeto escolhido no topo.
 */
export default function Fabrica() {
  const { projectId } = useGlobalProject();
  const { data: projects = [] } = useGlobalProjectList();
  const { data: status, isLoading, error } = useFactoryStatus(projectId);
  const steps = status ? flowSteps(status) : [];
  const proximo = nextStep(steps);
  const nome = projects.find((p) => p.id === projectId)?.name ?? projectId;

  return (
    <div className="space-y-6">
      <header>
        <div className="kicker">Criativos</div>
        <h1 className="section-title mt-1 flex items-center gap-2 text-2xl md:text-3xl"><Factory className="h-6 w-6" /> Fábrica de criativos{projectId ? ` · ${nome}` : ""}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          O caminho inteiro numa tela: monte o elenco, alimente o mercado, monte e aprove a leva, gere as artes, suba o teste e leia o placar.
          Nada aqui roda sozinho: cada passo pede o seu clique.
        </p>
      </header>

      {!projectId && (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Escolha o projeto no seletor do topo da tela para ver o passo a passo dele.</p>
      )}
      {error && <p className="text-sm text-destructive">Não deu para ler o estado do projeto. Tente recarregar.</p>}

      {projectId && (
        <>
          <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Passos da fábrica">
            {(isLoading ? [] : steps).map((s, i) => <StepCard key={s.key} step={s} n={i + 1} destaque={proximo?.key === s.key} />)}
          </ol>

          {proximo ? (
            <a href={`#${anchor(proximo.key)}`} className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-foreground hover:bg-primary/10" aria-label="Próximo passo">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span><strong>Próximo passo · {proximo.titulo}:</strong> {proximo.proximo}</span>
            </a>
          ) : status && (
            <p className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-foreground">Tudo em dia neste projeto. Siga a leitura do placar e a próxima onda do molde.</p>
          )}

          <section id={anchor("elenco")} className="scroll-mt-20 space-y-2" aria-label="Passo Elenco"><CastTab /></section>

          <section id={anchor("mercado")} className="scroll-mt-20 space-y-2" aria-label="Passo Mercado">
            <MiningSources />
            <p className="text-xs text-muted-foreground">As referências mineradas entram classificadas em <Link to="/referencias" className="text-primary hover:underline">Referências</Link>; o Estrategista usa ângulo e formato delas.</p>
          </section>

          <section id={anchor("leva")} className="scroll-mt-20 space-y-2" aria-label="Passo Leva e Artes">
            <span id={anchor("artes")} />
            <NextBatchPanel />
          </section>

          <section id={anchor("teste")} className="scroll-mt-20 rounded-lg border border-border bg-card p-4 text-sm" aria-label="Passo Teste e Placar">
            <span id={anchor("placar")} />
            <h2 className="text-lg font-semibold text-foreground">Teste no ar e placar</h2>
            <p className="mt-1 text-muted-foreground">
              Os testes, a leitura ao vivo e o placar por porta, formato, avatar e ângulo ficam em <Link to="/testes" className="text-primary hover:underline">Testes e placar</Link>.
              Para montar um teste com as artes prontas ou desmontar um vencedor (molde), peça no chat: "monta um teste com a leva X" / "desmonta o vencedor".
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function StepCard({ step: s, n, destaque }: { step: FlowStep; n: number; destaque: boolean }) {
  const Icon = ICON[s.estado];
  return (
    <li>
      <a href={`#${anchor(s.key)}`} aria-label={`Passo ${n} ${s.titulo}`}
        className={cn("flex h-full flex-col gap-1 rounded-lg border bg-card p-3 text-xs transition-colors hover:bg-muted/40", TONE[s.estado], destaque && "ring-2 ring-primary/50")}>
        <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4" /> {n}. {s.titulo}</span>
        <span className="text-muted-foreground">{s.resumo}</span>
      </a>
    </li>
  );
}
