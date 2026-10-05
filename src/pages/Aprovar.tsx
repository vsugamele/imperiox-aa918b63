import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, Check, CheckCircle2, ExternalLink, FileCheck2, Film, Loader2, MessageSquareReply, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { SOURCE_LABEL, waitingFor, type ApprovalItem, type ApprovalSource } from "@shared/approval-queue";
import { useApprovals, useDecideApproval, type ApprovalDecision } from "@/hooks/useApprovals";
import { useProjectsAndMaps } from "@/hooks/usePlaybooks";
import { PageSkeleton } from "@/components/PageSkeleton";

const SOURCES: ApprovalSource[] = ["rascunho", "etapa", "acao_ia", "conteudo"];
const SOURCE_ICON: Record<ApprovalSource, typeof Bot> = { rascunho: MessageSquareReply, etapa: FileCheck2, acao_ia: Bot, conteudo: Film };
const APPROVE_LABEL: Record<ApprovalSource, string> = { rascunho: "Abrir para responder", etapa: "Aprovar", acao_ia: "Executar", conteudo: "Aprovar" };
const REJECT_LABEL: Record<ApprovalSource, string> = { rascunho: "", etapa: "Devolver", acao_ia: "Rejeitar", conteudo: "Reprovar" };
const RISK_TONE = { high: "border-destructive/40 bg-destructive/10 text-destructive", medium: "border-warning/40 bg-warning/10 text-warning", low: "border-border text-muted-foreground" } as const;
const RISK_LABEL = { high: "risco alto", medium: "risco médio", low: "risco baixo" } as const;

export default function Aprovar() {
  const { data: items = [], isLoading, error } = useApprovals();
  const { data: targets } = useProjectsAndMaps();
  const [source, setSource] = useState<ApprovalSource | "todas">("todas");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.source] = (c[i.source] ?? 0) + 1;
    return c;
  }, [items]);
  const shown = source === "todas" ? items : items.filter((i) => i.source === source);
  const projectName = (id: string | null) => (id ? targets?.projects.find((p) => p.id === id)?.name ?? id : null);

  return (
    <div className="space-y-6">
      <header>
        <div className="kicker">Decisões Comerciais & IA</div>
        <h1 className="section-title mt-1 text-2xl md:text-3xl">Aprovações Estratégicas</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Fila comercial limpa para decisões que geram tração e faturamento: campanhas da IA, lotes de criativos prontos e respostas pendentes para clientes. Alertas técnicos de infraestrutura/tracking foram removidos do fluxo humano.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Origem">
        {(["todas", ...SOURCES] as const).map((s) => {
          const n = s === "todas" ? items.length : counts[s] ?? 0;
          return (
            <button key={s} role="tab" aria-selected={source === s} onClick={() => setSource(s)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                source === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s === "todas" ? "Tudo" : SOURCE_LABEL[s]} <span className="ml-1 font-mono">{n}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <PageSkeleton variant="list" label="Juntando o que espera aprovação" />}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}
        </div>
      )}

      {!isLoading && !error && shown.length === 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-2 py-16 text-center">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}>
            <CheckCircle2 className="h-10 w-10 text-success" />
          </motion.span>
          <p className="text-sm font-medium text-foreground">Nada esperando aprovação</p>
          <p className="text-xs text-muted-foreground">Quando a IA ou o time deixar algo para decidir, aparece aqui.</p>
        </motion.div>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((item, i) => (
            <ApprovalCard key={item.key} item={item} index={i} project={projectName(item.projectId)} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function ApprovalCard({ item, index, project }: { item: ApprovalItem; index: number; project: string | null }) {
  const decide = useDecideApproval();
  const Icon = SOURCE_ICON[item.source];
  const wait = waitingFor(item.createdAt);

  const act = (decision: ApprovalDecision) => {
    decide.mutate({ item, decision }, {
      onSuccess: () => toast.success(`${decision === "approve" ? APPROVE_LABEL[item.source] : REJECT_LABEL[item.source]}: ${item.title}`),
      onError: (e) => toast.error(`Não foi possível: ${errorMessage(e) || "erro desconhecido"}`),
    });
  };

  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.03 } }}
      exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, transition: { duration: 0.25 } }}
      className="flex gap-3 overflow-hidden rounded-lg border border-border bg-card p-3">
      {item.media ? (
        <img src={item.media} alt="" loading="lazy" className="h-20 w-14 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">{SOURCE_LABEL[item.source]}</span>
          {project && <span>· {project}</span>}
          {wait && <span>· esperando há {wait}</span>}
          {item.risk && <span className={cn("rounded-full border px-1.5 py-px", RISK_TONE[item.risk])}>{RISK_LABEL[item.risk]}</span>}
          {item.impactBrl ? <span>· impacto R$ {Math.round(item.impactBrl).toLocaleString("pt-BR")}</span> : null}
        </div>
        <p className="mt-0.5 text-sm font-medium text-foreground">{item.title}</p>
        {item.detail && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.inline ? (
            <>
              <Button size="sm" className="h-7" onClick={() => act("approve")} disabled={decide.isPending}>
                {decide.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}{APPROVE_LABEL[item.source]}
              </Button>
              <Button size="sm" variant="outline" className="h-7" onClick={() => act("reject")} disabled={decide.isPending}>
                {item.source === "etapa" ? <Undo2 className="mr-1.5 h-3.5 w-3.5" /> : <X className="mr-1.5 h-3.5 w-3.5" />}{REJECT_LABEL[item.source]}
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-7">
                {item.link.startsWith("http")
                  ? <a href={item.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver</a>
                  : <Link to={item.link}><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir</Link>}
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="h-7"><Link to={item.link}><MessageSquareReply className="mr-1.5 h-3.5 w-3.5" /> {APPROVE_LABEL[item.source]}</Link></Button>
          )}
        </div>
      </div>
    </motion.li>
  );
}
