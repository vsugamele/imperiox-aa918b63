import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, HelpCircle, MousePointerClick, Radar, ShoppingCart, Sparkles, Target, MessageCircle, Megaphone } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { REFERENCIA, type Metric, type Stage, type StageId, type StageStatus } from "@shared/funnel-live";
import { useFunnelLive } from "@/hooks/useFunnelLive";
import { PageSplitsSection } from "@/components/funis/PageSplitsSection";

interface ProjectOption { id: string; name: string }

const STAGE_ICON: Record<StageId, typeof Megaphone> = { anuncio: Megaphone, pagina: MousePointerClick, checkout: ShoppingCart, venda: Target, extra: Sparkles, recuperacao: MessageCircle };

const STATUS_STYLE: Record<StageStatus, { ring: string; pill: string; label: string }> = {
  ok: { ring: "border-success/40", pill: "border-success/40 bg-success/10 text-success", label: "Saudável" },
  atencao: { ring: "border-warning/50", pill: "border-warning/50 bg-warning/10 text-warning", label: "Atenção" },
  gargalo: { ring: "border-destructive/60", pill: "border-destructive/50 bg-destructive/10 text-destructive", label: "Gargalo" },
  sem_dado: { ring: "border-border border-dashed", pill: "border-border text-muted-foreground", label: "Sem dado" },
  medicao_incompleta: { ring: "border-border border-dashed", pill: "border-warning/40 text-warning", label: "Medição incompleta" },
};

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function fmt(m: Pick<Metric, "value" | "fmt">): string {
  if (m.value === null) return "—";
  if (m.fmt === "brl") return brl(m.value);
  if (m.fmt === "pct") return `${m.value.toLocaleString("pt-BR")}%`;
  return m.value.toLocaleString("pt-BR");
}

/** Painel ao vivo: o funil do produto em linha, com os números reais de cada etapa e o gargalo destacado. */
export function FunnelLivePanel({ projects, initialProjectId }: { projects: ProjectOption[]; initialProjectId?: string | null }) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [produto, setProduto] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  useEffect(() => { if (!projectId && projects.length) setProjectId(projects.find((p) => p.id === "jp_freitas")?.id ?? projects[0].id); }, [projects, projectId]);
  const { data, isLoading, error } = useFunnelLive({ projectId, produto, days });

  return (
    <section className="space-y-5" aria-label="Painel ao vivo do funil">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase text-muted-foreground">Projeto</div>
          <Select value={projectId ?? undefined} onValueChange={(v) => { setProjectId(v); setProduto(null); }}>
            <SelectTrigger className="h-9 w-56" aria-label="Projeto"><SelectValue placeholder="Escolha o projeto" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase text-muted-foreground">Produto</div>
          <Select value={produto ?? "todos"} onValueChange={(v) => setProduto(v === "todos" ? null : v)}>
            <SelectTrigger className="h-9 w-64" aria-label="Produto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {(data?.produtos ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5" role="tablist" aria-label="Período">
          {[1, 7, 14, 30].map((d) => (
            <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)}
              className={cn("rounded px-2.5 py-1 text-xs font-medium", days === d ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {d === 1 ? "Hoje" : `${d} dias`}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <PageSkeleton variant="cards" label="Somando o funil" />}
      {error && <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Resultado do período">
            <Kpi label="Gasto" value={data.totais.gasto === null ? "—" : brl(data.totais.gasto)} hint={data.adsDoProjetoInteiro ? "projeto inteiro" : undefined} />
            <Kpi label="Faturamento" value={brl(data.totais.bruto)} />
            <Kpi label="Líquido" value={brl(data.totais.liquido)} />
            <Kpi label="Saldo" value={data.totais.saldo === null ? "—" : brl(data.totais.saldo)} tone={data.totais.saldo === null ? undefined : data.totais.saldo >= 0 ? "good" : "bad"} />
            <Kpi label="ROAS" value={data.totais.roas === null ? "—" : `${data.totais.roas.toLocaleString("pt-BR")}x`} />
            <Kpi label="CPA" value={data.totais.cpa === null ? "—" : brl(data.totais.cpa)} />
          </div>

          {data.gargalo && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground" role="status">
              <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>Gargalo agora: <strong>{data.etapas.find((e) => e.id === data.gargalo)?.label}</strong>. É a etapa mais abaixo da referência; é onde uma melhora rende mais.</span>
            </motion.div>
          )}

          <ol className="flex flex-col gap-2 xl:flex-row xl:items-stretch" aria-label="Etapas do funil">
            {data.etapas.map((e, i) => (
              <li key={e.id} className="flex flex-col items-stretch gap-2 xl:flex-1 xl:flex-row xl:items-center">
                {i > 0 && <Connector stage={e} />}
                <StageCard stage={e} index={i} isGargalo={data.gargalo === e.id} />
              </li>
            ))}
          </ol>

          {projectId && <PageSplitsSection projectId={projectId} />}

          {data.paginas.length > 0 && (
            <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Páginas medidas">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Radar className="h-4 w-4" /> Páginas com rastreador</h3>
              <ul className="space-y-1 text-xs">
                {data.paginas.slice(0, 8).map((p) => (
                  <li key={p.url} className="flex justify-between gap-2 font-mono"><span className="truncate text-foreground">{p.url}</span><span className="shrink-0 text-muted-foreground">{p.values.sessoes_pagina} visitas · {p.values.cliques_cta ?? 0} cliques</span></li>
                ))}
              </ul>
            </section>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Referências usadas para apontar o gargalo (infoproduto low ticket): CTR {REFERENCIA.ctr}%, chegada na página {REFERENCIA.chegada}%, início de checkout {REFERENCIA.inicio_checkout}%,
            aprovação {REFERENCIA.aprovacao}%, bump/upsell {REFERENCIA.extra}%, recuperação {REFERENCIA.recuperacao}%. Gasto e cliques vêm do Zernio; vendas da plataforma; páginas do rastreador.
          </p>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}{hint && <span className="normal-case"> · {hint}</span>}</div>
      <div className={cn("font-mono text-lg font-semibold", tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground")}>{value}</div>
    </div>
  );
}

function Connector({ stage }: { stage: Stage }) {
  const c = stage.conversao;
  const style = STATUS_STYLE[stage.status];
  return (
    <div className="flex items-center justify-center gap-1 xl:flex-col" aria-label={c ? `${c.label}: ${c.value === null ? "sem dado" : `${c.value}%`}` : undefined}>
      <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground xl:rotate-0" />
      {c && <span className={cn("whitespace-nowrap rounded-full border px-1.5 py-px font-mono text-[10px]", style.pill)}>{c.value === null ? "—" : `${c.value.toLocaleString("pt-BR")}%`}</span>}
    </div>
  );
}

function StageCard({ stage, index, isGargalo }: { stage: Stage; index: number; isGargalo: boolean }) {
  const Icon = STAGE_ICON[stage.id];
  const style = STATUS_STYLE[stage.status];
  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className={cn("flex-1 space-y-2 rounded-lg border-2 bg-card p-3", isGargalo ? "border-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.15)]" : style.ring)} aria-label={`Etapa ${stage.label}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {stage.label}</span>
        <span className={cn("rounded-full border px-1.5 py-px text-[10px] uppercase", isGargalo ? STATUS_STYLE.gargalo.pill : style.pill)}>
          {stage.status === "ok" && <CheckCircle2 className="mr-0.5 inline h-3 w-3" />}{isGargalo ? "Gargalo" : style.label}
        </span>
      </div>
      <dl className="space-y-1">
        {stage.metrics.map((m) => (
          <div key={m.label} className="flex justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">{m.label}</dt>
            <dd className="font-mono font-semibold text-foreground">{fmt(m)}</dd>
          </div>
        ))}
      </dl>
      {stage.conversao && (
        <p className="text-[11px] text-muted-foreground">{stage.conversao.label}: <span className="font-mono text-foreground">{stage.conversao.value === null ? "—" : `${stage.conversao.value}%`}</span> · ref. {stage.conversao.referencia}%</p>
      )}
      {stage.nota && <p className="text-[11px] text-warning">{stage.nota}</p>}
    </motion.article>
  );
}
