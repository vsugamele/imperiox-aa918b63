import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  Film,
  HelpCircle,
  Loader2,
  MessageSquareReply,
  Send,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { SOURCE_LABEL, waitingFor, type ApprovalItem, type ApprovalSource } from "@shared/approval-queue";
import { useApprovals, useDecideApproval, type ApprovalDecision } from "@/hooks/useApprovals";
import { useProjectsAndMaps } from "@/hooks/usePlaybooks";
import { PageSkeleton } from "@/components/PageSkeleton";

const SOURCES: ApprovalSource[] = [
  "pix_travado",
  "semaforo_ads",
  "duvida_bot",
  "rascunho",
  "etapa",
  "acao_ia",
  "conteudo",
];

const SOURCE_ICON: Record<ApprovalSource, typeof Bot> = {
  pix_travado: Zap,
  semaforo_ads: SlidersHorizontal,
  duvida_bot: HelpCircle,
  rascunho: MessageSquareReply,
  etapa: FileCheck2,
  acao_ia: Bot,
  conteudo: Film,
};

const APPROVE_LABEL: Record<ApprovalSource, string> = {
  pix_travado: "Disparar WhatsApp (1-Clique)",
  semaforo_ads: "Executar Decisão",
  duvida_bot: "Aprovar no Acervo (RAG)",
  rascunho: "Abrir para responder",
  etapa: "Aprovar",
  acao_ia: "Executar",
  conteudo: "Aprovar",
};

const REJECT_LABEL: Record<ApprovalSource, string> = {
  pix_travado: "Descartar",
  semaforo_ads: "Ignorar / Manter",
  duvida_bot: "Descartar",
  rascunho: "",
  etapa: "Devolver",
  acao_ia: "Rejeitar",
  conteudo: "Reprovar",
};

const RISK_TONE = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-border text-muted-foreground",
} as const;

const RISK_LABEL = {
  high: "risco alto",
  medium: "risco médio",
  low: "risco baixo",
} as const;

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
        <h1 className="section-title mt-1 text-2xl md:text-3xl">Fila Única de Decisão</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Central executiva para intervenções diretas de faturamento: semáforo de anúncios para cortar desperdício ou escalar, recuperação de Pix travados em 1-clique e aprovação de dúvidas do bot para alimentar a base de conhecimento.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Origem">
        {(["todas", ...SOURCES] as const).map((s) => {
          const n = s === "todas" ? items.length : counts[s] ?? 0;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={source === s}
              onClick={() => setSource(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                source === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "todas" ? "Tudo" : SOURCE_LABEL[s]} <span className="ml-1 font-mono font-semibold">{n}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <PageSkeleton variant="list" label="Organizando a fila de decisões" />}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}
        </div>
      )}

      {!isLoading && !error && shown.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-2 py-16 text-center"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          >
            <CheckCircle2 className="h-10 w-10 text-success" />
          </motion.span>
          <p className="text-sm font-medium text-foreground">Nada esperando aprovação</p>
          <p className="text-xs text-muted-foreground">
            Quando o semáforo alertar um anúncio, um Pix travar ou o bot tiver uma dúvida, aparece aqui.
          </p>
        </motion.div>
      )}

      <ul className="space-y-3">
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
  const Icon = SOURCE_ICON[item.source] || Bot;
  const wait = waitingFor(item.createdAt);
  const [customAnswer, setCustomAnswer] = useState(item.metadata?.suggestedAnswer || "");

  const act = (decision: ApprovalDecision, extraAnswer?: string) => {
    decide.mutate(
      { item, decision, customAnswer: extraAnswer ?? customAnswer },
      {
        onSuccess: () => {
          const label =
            decision === "mark_paid"
              ? "Venda marcada como paga"
              : decision === "approve"
              ? APPROVE_LABEL[item.source]
              : REJECT_LABEL[item.source];
          toast.success(`${label}: ${item.title}`);
        },
        onError: (e) => toast.error(`Não foi possível: ${errorMessage(e) || "erro desconhecido"}`),
      },
    );
  };

  const copyToClipboard = (text: string, msg = "Copiado com sucesso!") => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const handlePixDispatch = () => {
    if (item.metadata?.whatsappUrl && item.metadata.whatsappUrl.startsWith("http")) {
      try {
        window.open(item.metadata.whatsappUrl, "_blank", "noopener,noreferrer");
      } catch {
        // Ignora em ambientes sem suporte a window.open (ex.: testes jsdom)
      }
    }
    act("approve");
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.03 } }}
      exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, transition: { duration: 0.25 } }}
      className={cn(
        "overflow-hidden rounded-lg border bg-card p-4 transition-all shadow-sm",
        item.source === "pix_travado" && "border-amber-500/30 bg-amber-500/[0.02]",
        item.source === "semaforo_ads" && "border-red-500/30 bg-red-500/[0.02]",
        item.source === "duvida_bot" && "border-cyan-500/30 bg-cyan-500/[0.02]",
      )}
    >
      <div className="flex items-start gap-3">
        {item.media ? (
          <img src={item.media} alt="" loading="lazy" className="h-20 w-14 shrink-0 rounded object-cover" />
        ) : (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              item.source === "pix_travado"
                ? "bg-amber-500/10 text-amber-500"
                : item.source === "semaforo_ads"
                ? "bg-red-500/10 text-red-500"
                : item.source === "duvida_bot"
                ? "bg-cyan-500/10 text-cyan-500"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          {/* Header metadata chips */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[10px]",
                item.source === "pix_travado" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                item.source === "semaforo_ads" && "bg-red-500/15 text-red-600 dark:text-red-400",
                item.source === "duvida_bot" && "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
                !["pix_travado", "semaforo_ads", "duvida_bot"].includes(item.source) && "bg-muted text-foreground",
              )}
            >
              {SOURCE_LABEL[item.source]}
            </span>
            {project && <span className="font-medium text-foreground">· {project}</span>}
            {wait && <span>· há {wait}</span>}
            {item.risk && (
              <span className={cn("rounded-full border px-1.5 py-px", RISK_TONE[item.risk])}>
                {RISK_LABEL[item.risk]}
              </span>
            )}
            {item.impactBrl != null && item.impactBrl > 0 && (
              <span className="font-semibold text-foreground">
                · R$ {Number(item.impactBrl).toFixed(2).replace(".", ",")}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="mt-1 text-sm font-semibold text-foreground">{item.title}</p>

          {/* PIX TRAVADO CUSTOM CARD */}
          {item.source === "pix_travado" && item.metadata && (
            <div className="mt-2.5 space-y-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                <span>
                  Cliente: <strong className="text-foreground">{item.metadata.customerName || "Não identificado"}</strong>
                  {item.metadata.customerPhone && ` · ${item.metadata.customerPhone}`}
                </span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-300">
                  Régua Nível {item.metadata.recoveryLevel || 1}
                </span>
              </div>

              {item.metadata.recoveryMessage && (
                <div className="rounded border border-border/60 bg-background/80 p-2 text-foreground">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span className="font-medium">Mensagem sugerida no WhatsApp:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.metadata?.recoveryMessage || "", "Texto da mensagem copiado!")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                  <p className="italic text-xs text-foreground/90 whitespace-pre-line">{item.metadata.recoveryMessage}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  onClick={handlePixDispatch}
                  disabled={decide.isPending}
                >
                  {decide.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Disparar WhatsApp (1-Clique)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => act("mark_paid")}
                  disabled={decide.isPending}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5 text-success" /> Já pagou (Aprovar)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => act("reject")}
                  disabled={decide.isPending}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Descartar
                </Button>
              </div>
            </div>
          )}

          {/* SEMÁFORO DE ANÚNCIOS CUSTOM CARD */}
          {item.source === "semaforo_ads" && (
            <div className="mt-2.5 space-y-2 rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-bold text-[10px] uppercase",
                    item.metadata?.recommendation === "escalar"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/20 text-red-600 dark:text-red-400",
                  )}
                >
                  {item.metadata?.recommendation === "escalar" ? "🟢 Oportunidade de Escala" : "🔴 Recomenda Pausar"}
                </span>
                {item.metadata?.spendBrl != null && (
                  <span className="text-muted-foreground">
                    Gasto: <strong className="text-foreground">R$ {item.metadata.spendBrl.toFixed(2)}</strong>
                  </span>
                )}
                {item.metadata?.purchases != null && (
                  <span className="text-muted-foreground">
                    Vendas: <strong className="text-foreground">{item.metadata.purchases}</strong>
                  </span>
                )}
                {item.metadata?.cpaBrl != null && (
                  <span className="text-muted-foreground">
                    CPA: <strong className="text-foreground">R$ {item.metadata.cpaBrl.toFixed(2)}</strong>
                  </span>
                )}
                {item.metadata?.clicks != null && (
                  <span className="text-muted-foreground">
                    Cliques: <strong className="text-foreground">{item.metadata.clicks}</strong>
                  </span>
                )}
              </div>

              {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className={cn(
                    "h-8 font-medium",
                    item.metadata?.recommendation === "escalar"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                  )}
                  onClick={() => act("approve")}
                  disabled={decide.isPending}
                >
                  {decide.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {item.metadata?.recommendation === "escalar" ? "Escalar Orçamento" : "Pausar Imediatamente"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => act("reject")}
                  disabled={decide.isPending}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Ignorar recomendação
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link to="/gerenciador-ads">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver métricas no Ads
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* DÚVIDA DO BOT / ACERVO RAG CUSTOM CARD */}
          {item.source === "duvida_bot" && (
            <div className="mt-2.5 space-y-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-semibold text-[11px]">
                <Sparkles className="h-3.5 w-3.5" /> Pergunta de lead sem resposta cadastrada
              </div>

              {item.metadata?.question && (
                <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-2 font-medium text-foreground text-xs">
                  "{item.metadata.question}"
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Resposta a gravar no acervo da IA:
                </label>
                <Textarea
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  placeholder="Escreva a resposta correta para que o bot aprenda e responda automaticamente no futuro..."
                  className="min-h-[64px] text-xs bg-background"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
                  onClick={() => act("approve", customAnswer)}
                  disabled={decide.isPending}
                >
                  {decide.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Aprovar no Acervo (Alimentar RAG)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => act("reject")}
                  disabled={decide.isPending}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Descartar pergunta
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link to="/acervo">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver Acervo
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* GENERIC FALLBACK FOR OTHER SOURCES (RASCUNHO, ETAPA, ACAO_IA, CONTEUDO) */}
          {!["pix_travado", "semaforo_ads", "duvida_bot"].includes(item.source) && (
            <>
              {item.detail && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {item.inline ? (
                  <>
                    <Button size="sm" className="h-7" onClick={() => act("approve")} disabled={decide.isPending}>
                      {decide.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {APPROVE_LABEL[item.source]}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => act("reject")}
                      disabled={decide.isPending}
                    >
                      {item.source === "etapa" ? (
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <X className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {REJECT_LABEL[item.source]}
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-7">
                      {item.link.startsWith("http") ? (
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver
                        </a>
                      ) : (
                        <Link to={item.link}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir
                        </Link>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button asChild size="sm" className="h-7">
                    <Link to={item.link}>
                      <MessageSquareReply className="mr-1.5 h-3.5 w-3.5" /> {APPROVE_LABEL[item.source]}
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.li>
  );
}

