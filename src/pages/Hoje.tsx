import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bot, CheckCircle2, ClipboardCopy, Eye, Loader2, Map as MapIcon, RefreshCw, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { EXECUTOR_LABEL, STATUS_LABEL_STEP, type StepStatus } from "@shared/map-steps";
import type { MapGap } from "@shared/project-map";
import { formatMoney, mapLink, type BoardStep, type ProjectBoard } from "@/lib/today-board";
import { useSetStepStatus, useTodayBoard } from "@/hooks/useTodayBoard";
import { useCompanyMap } from "@/hooks/useCompanyMap";
import { Stat } from "@/components/mapa/Stat";

const STEP_STATUSES: StepStatus[] = ["pending", "in_progress", "ready_review", "done"];
const MAX_ROWS = 6;

const STATUS_TONE: Record<StepStatus, string> = {
  pending: "border-border text-muted-foreground",
  in_progress: "border-primary/30 bg-primary/10 text-primary",
  ready_review: "border-warning/30 bg-warning/10 text-warning",
  done: "border-success/30 bg-success/10 text-success",
};

export default function Hoje() {
  const { data: boards = [], isLoading, isFetching, error, refetch } = useTodayBoard();
  const { data: companyMaps = [] } = useCompanyMap();

  const criticalByProject = useMemo(() => {
    const result: Record<string, MapGap[]> = {};
    for (const m of companyMaps) result[m.projectId] = m.gaps.filter((g) => g.severity === "critica");
    return result;
  }, [companyMaps]);

  const totals = useMemo(() => ({
    waiting: boards.reduce((n, b) => n + b.waitingYou.length + b.review.length, 0),
    ai: boards.reduce((n, b) => n + b.aiReady.length, 0),
    sales: boards.reduce((n, b) => n + b.salesToday.count, 0),
    leads: boards.reduce((n, b) => n + b.leadsToday, 0),
  }), [boards]);

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Hoje · {today}</div>
          <h1 className="section-title mt-1 text-2xl md:text-3xl">O que precisa andar hoje</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            As etapas dos mapas de cada projeto, separadas entre o que depende de você e o que a IA executa. Mude o status aqui ou abra a etapa no mapa.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isFetching && "animate-spin")} /> Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Esperando você" value={totals.waiting} tone={totals.waiting ? "text-warning" : undefined} hint="a fazer ou para revisar" />
        <Stat label="IA pode executar" value={totals.ai} hint="pendentes com skill ou automação" />
        <Stat label="Vendas hoje" value={totals.sales} tone={totals.sales ? "text-success" : undefined} />
        <Stat label="Leads hoje" value={totals.leads} />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo os mapas...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Não foi possível montar o dia: {errorMessage(error) || "erro desconhecido"}</span>
        </div>
      )}

      {!isLoading && !error && boards.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum projeto tem mapa de operação ainda. Monte um em <Link to="/funis?view=mapa" className="text-primary underline">Funis → Mapa</Link>.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {boards.map((board) => (
          <ProjectCard key={board.projectId} board={board} critical={criticalByProject[board.projectId] ?? []} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ board, critical }: { board: ProjectBoard; critical: MapGap[] }) {
  const pct = board.total ? Math.round((board.done / board.total) * 100) : 0;
  const money = Object.entries(board.salesToday.byCurrency).map(([cur, v]) => formatMoney(v, cur)).join(" + ");

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{board.projectName}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {board.done} de {board.total} etapas feitas ({pct}%) · {board.salesToday.count} venda(s) hoje{money ? ` · ${money}` : ""} · {board.leadsToday} lead(s)
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/funis?view=mapa&map=${board.mapIds[0]}`}><MapIcon className="mr-2 h-3.5 w-3.5" /> Abrir mapa</Link>
        </Button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {critical.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Lacunas críticas
          </div>
          {critical.slice(0, 3).map((gap, i) => (
            <p key={i} className="text-sm text-foreground">
              {gap.message} <span className="text-muted-foreground">→ {gap.action}</span>
            </p>
          ))}
        </div>
      )}

      <StepGroup title="Para revisar" icon={Eye} steps={board.review} empty={null} />
      <StepGroup title="Esperando você" icon={User} steps={board.waitingYou} empty="Nada pendente com o time." />
      <StepGroup title="IA pode executar" icon={Bot} steps={board.aiReady} empty="Nenhuma etapa de IA pendente." canCopy />
      <StepGroup title="Em andamento" icon={Loader2} steps={board.inProgress} empty={null} />
    </section>
  );
}

function StepGroup({ title, icon: Icon, steps, empty, canCopy }: {
  title: string;
  icon: typeof User;
  steps: BoardStep[];
  empty: string | null;
  canCopy?: boolean;
}) {
  if (!steps.length && empty === null) return null;
  const shown = steps.slice(0, MAX_ROWS);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-subtle">
        <Icon className="h-3.5 w-3.5" /> {title} <span className="font-mono text-muted-foreground">{steps.length}</span>
      </div>
      {!steps.length && <p className="text-sm text-muted-foreground">{empty}</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {shown.map((step) => <StepRow key={step.id} step={step} canCopy={canCopy} />)}
      </ul>
      {steps.length > MAX_ROWS && (
        <p className="mt-1 text-xs text-muted-foreground">+ {steps.length - MAX_ROWS} no mapa</p>
      )}
    </div>
  );
}

function StepRow({ step, canCopy }: { step: BoardStep; canCopy?: boolean }) {
  const setStatus = useSetStepStatus();

  const copyPrompt = async () => {
    const text = [step.prompt, step.skill ? `Skill: ${step.skill}` : null].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copiado");
    } catch {
      toast.error("Não consegui copiar");
    }
  };

  const changeStatus = (status: StepStatus) => {
    setStatus.mutate({ nodeId: step.id, status }, {
      onSuccess: () => toast.success(`"${step.label}" → ${STATUS_LABEL_STEP[status]}`),
      onError: (err) => toast.error(`Não salvou: ${errorMessage(err) || "erro desconhecido"}`),
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
      <div className="min-w-0 flex-1">
        <Link to={mapLink(step)} className="block truncate text-sm font-medium text-foreground hover:text-primary">{step.label}</Link>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{EXECUTOR_LABEL[step.executor]}</span>
          {step.skill && <span className="font-mono">· {step.skill}</span>}
          {step.stage && <span>· {step.stage}</span>}
          {step.progress.total > 0 && <span className="font-mono">· {step.progress.done}/{step.progress.total}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {canCopy && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyPrompt} title="Copiar prompt para a IA">
            <ClipboardCopy className="h-3.5 w-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider", STATUS_TONE[step.status])}
              disabled={setStatus.isPending}
            >
              {STATUS_LABEL_STEP[step.status]}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Mudar status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STEP_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => changeStatus(s)} disabled={s === step.status}>
                {s === "done" && <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-success" />}
                {STATUS_LABEL_STEP[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
