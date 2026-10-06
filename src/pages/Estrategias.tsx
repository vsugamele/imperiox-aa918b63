import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Bot, Cog, Gauge, Loader2, Plug, Target, User, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { FAMILY_COLOR, FAMILY_LABEL, type Playbook, type PlaybookFamily, type PlaybookStep } from "@shared/playbooks";
import { metricKey } from "@shared/metric-keys";
import { executorGroup, EXECUTOR_LABEL, type ExecutorGroup } from "@shared/map-steps";
import { ApplyPlaybookDialog } from "@/components/estrategias/ApplyPlaybookDialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useProjectsAndMaps, usePlaybooks, type PlaybookApplication } from "@/hooks/usePlaybooks";
import { CopyLibrary } from "@/components/estrategias/CopyLibrary";

const FAMILIES = Object.keys(FAMILY_LABEL) as PlaybookFamily[];
const EXECUTOR_ICON: Record<ExecutorGroup, typeof Bot> = { ia: Bot, automatico: Cog, ferramenta: Plug, humano: User };

type View = "estrategias" | "biblioteca";

export default function Estrategias() {
  const [view, setView] = useState<View>("estrategias");
  return (
    <div className="space-y-6">
      <header>
        <div className="kicker">Estratégias</div>
        <h1 className="section-title mt-1 text-2xl md:text-3xl">{view === "estrategias" ? "Como cada projeto pode crescer" : "Biblioteca de copy"}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {view === "estrategias"
            ? "Cada estratégia é um passo a passo pronto: etapas com contrato, quem executa (IA, automação ou você), a skill e a métrica de cada uma. Aplique a um projeto e ela vira etapas no mapa, que aparecem em Hoje. A IA usa a mesma biblioteca pelo MCP."
            : "Ângulos, objeções, provas e mecanismos para escrever anúncio com método. A IA consulta a mesma biblioteca pelo MCP (get_copy_library)."}
        </p>
        <div className="mt-3 inline-flex rounded-md border border-border p-0.5" role="tablist" aria-label="Visão">
          {([["estrategias", "Estratégias"], ["biblioteca", "Biblioteca de copy"]] as const).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={cn("rounded px-3 py-1 text-xs font-medium transition-colors", view === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {view === "estrategias" ? <PlaybooksView /> : <CopyLibrary />}
    </div>
  );
}

function PlaybooksView() {
  const { data, isLoading, error } = usePlaybooks();
  const { data: targets } = useProjectsAndMaps();
  const [familia, setFamilia] = useState<PlaybookFamily | "todas">("todas");
  const [openId, setOpenId] = useState<string | null>(null);
  const [applying, setApplying] = useState<Playbook | null>(null);

  const playbooks = useMemo(() => (data?.playbooks ?? []).filter((p) => familia === "todas" || p.familia === familia), [data, familia]);
  const open = data?.playbooks.find((p) => p.id === openId) ?? null;
  const projectName = (id: string) => targets?.projects.find((p) => p.id === id)?.name ?? id;
  const appliedTo = (id: string) => [...new Set((data?.applications ?? []).filter((a: PlaybookApplication) => a.playbook_id === id).map((a) => a.project_id))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Famílias de estratégia">
        {(["todas", ...FAMILIES] as const).map((f) => (
          <button key={f} role="tab" aria-selected={familia === f} onClick={() => setFamilia(f)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              familia === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {f === "todas" ? "Todas" : FAMILY_LABEL[f]}
          </button>
        ))}
      </div>

      {isLoading && <PageSkeleton variant="grid" label="Carregando estratégias" />}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}
        </div>
      )}

      <motion.div layout className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {playbooks.map((p, i) => {
            const ns = metricKey(p.north_star);
            const projects = appliedTo(p.id);
            return (
              <motion.button key={p.id} layout type="button" onClick={() => setOpenId(p.id === openId ? null : p.id)}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 260, damping: 26 }} whileHover={{ y: -3 }}
                aria-expanded={p.id === openId}
                className={cn("group relative overflow-hidden rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-lg",
                  p.id === openId ? "border-primary" : "border-border")}>
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: FAMILY_COLOR[p.familia] }} />
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: FAMILY_COLOR[p.familia] }}>{FAMILY_LABEL[p.familia]}</div>
                <h2 className="mt-1 text-base font-semibold text-foreground">{p.nome}</h2>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.resumo}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {ns?.label ?? p.north_star}</span>
                  <span>{p.steps.length} etapas</span>
                  {p.horizonte && <span className="truncate">{p.horizonte}</span>}
                </div>
                {projects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {projects.map((id) => <span key={id} className="rounded bg-success/10 px-1.5 py-0.5 text-[11px] text-success">em uso · {projectName(id)}</span>)}
                  </div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {open && <PlaybookDetail key={open.id} playbook={open} onClose={() => setOpenId(null)} onApply={() => setApplying(open)} />}
      </AnimatePresence>

      <ApplyPlaybookDialog playbook={applying} onOpenChange={(o) => !o && setApplying(null)} />
    </div>
  );
}

interface PlaybookDetailProps { playbook: Playbook; onClose: () => void; onApply: () => void }

function PlaybookDetail({ playbook: p, onClose, onApply }: PlaybookDetailProps) {
  const sections: string[] = [];
  for (const s of p.steps) if (!sections.includes(s.secao)) sections.push(s.secao);
  const color = FAMILY_COLOR[p.familia];

  return (
    <motion.section aria-label={`Detalhes de ${p.nome}`}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }}
      className="space-y-5 rounded-lg border border-border bg-card p-5" style={{ boxShadow: `inset 0 3px 0 ${color}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold text-foreground">{p.nome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onApply}><Wand2 className="mr-2 h-4 w-4" /> Aplicar a um projeto</Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhes"><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Info title="Quando usar" text={p.quando_usar} />
        <Info title="Quando evitar" text={p.quando_evitar} />
        <Info title="Horizonte" text={p.horizonte} />
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> Como medir</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {p.kpis.map((k) => {
            const m = metricKey(k.key);
            return (
              <div key={k.key} className={cn("rounded-md border p-2.5", k.key === p.north_star ? "border-primary/40 bg-primary/5" : "border-border")}>
                <div className="text-sm font-medium text-foreground">{k.label}{k.key === p.north_star && <span className="ml-1 text-[10px] uppercase text-primary">principal</span>}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Meta: {k.meta}</div>
                {m && !m.disponivel && <div className="mt-1 text-[11px] text-warning">Fonte ainda não ligada ({m.fonte})</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Passo a passo</h3>
        {sections.map((secao, row) => (
          <div key={secao} className="rounded-md border border-dashed border-border p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{secao}</div>
            <div className="flex flex-wrap items-stretch gap-2">
              {p.steps.filter((s) => s.secao === secao).map((s, i, arr) => (
                <div key={s.ordem} className="flex items-center gap-2">
                  <StepChip step={s} delay={(row * 4 + i) * 0.05} color={color} />
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {p.riscos.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-warning"><AlertTriangle className="h-3.5 w-3.5" /> Cuidados</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">{p.riscos.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
    </motion.section>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      <p className="mt-1 text-sm text-foreground">{text || "—"}</p>
    </div>
  );
}

function StepChip({ step, delay, color }: { step: PlaybookStep; delay: number; color: string }) {
  const group = executorGroup({ executor_type: step.executor_type });
  const Icon = EXECUTOR_ICON[group];
  const metric = step.metrica ? metricKey(step.metrica.key) : null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, type: "spring", stiffness: 300, damping: 24 }}
      title={step.contrato.o}
      className="w-52 rounded-md border border-border bg-background p-2.5">
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black" style={{ background: color }}>{step.ordem}</span>
        <span className="text-sm font-medium leading-tight text-foreground">{step.label}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Icon className="h-3 w-3" /> {EXECUTOR_LABEL[group]}</span>
        {step.skill && <span className="truncate">· {step.skill}</span>}
      </div>
      {metric && <div className="mt-1 text-[11px] text-muted-foreground">Mede: {metric.label}{step.metrica?.meta ? ` (${step.metrica.meta})` : ""}</div>}
    </motion.div>
  );
}
