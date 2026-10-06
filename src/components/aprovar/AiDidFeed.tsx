import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, BookOpen, CheckCircle2, MessageCircle, Pencil, ThumbsUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { FEED_KIND_LABEL, feedCounts, type FeedItem, type FeedKind } from "@shared/ai-feed";
import { useAiFeed, useAiFeedback } from "@/hooks/useAiFeed";

const KIND_ICON: Record<FeedKind, typeof Bot> = { resposta_wa: MessageCircle, recuperacao_pix: Zap, acervo: BookOpen, acao_auto: Bot };

const CONTEXT_LABEL: Record<FeedKind, string> = { resposta_wa: "O lead disse", recuperacao_pix: "Situação", acervo: "Pergunta", acao_auto: "Motivo" };
const DONE_LABEL: Record<FeedKind, string> = { resposta_wa: "A IA respondeu", recuperacao_pix: "A IA fez", acervo: "Resposta ensinada", acao_auto: "A IA fez" };
const PLACEHOLDER: Record<FeedKind, string> = {
  resposta_wa: "Como você responderia? Vira resposta ou regra do bot.",
  recuperacao_pix: "O que você faria diferente nesta recuperação?",
  acervo: "Escreva a resposta certa (em branco: tiro do acervo).",
  acao_auto: "O que você faria diferente?",
};

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

/** "A IA fez": a IA age sozinha e conta o que fez; o time só diz "tá certo" ou "faria diferente". */
export function AiDidFeed({ projectName }: { projectName: (id: string | null) => string | null }) {
  const { data: items = [], isLoading, error } = useAiFeed();
  const [kind, setKind] = useState<FeedKind | "todos">("todos");
  const [soPendentes, setSoPendentes] = useState(true);
  const counts = useMemo(() => feedCounts(items), [items]);
  const shown = items.filter((i) => (kind === "todos" || i.kind === kind) && (!soPendentes || !i.feedback));

  return (
    <section className="space-y-4" aria-label="A IA fez">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Nas últimas 48 horas a IA fez {counts.total} coisas sozinha. Você não precisa aprovar antes: só diga se está certo ou como faria diferente.
        A correção vira resposta ou regra do bot na hora.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {(["todos", ...(Object.keys(FEED_KIND_LABEL) as FeedKind[])] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", kind === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {k === "todos" ? "Tudo" : FEED_KIND_LABEL[k]} <span className="ml-1 font-mono">{k === "todos" ? counts.total : counts.por_tipo[k]}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} /> só sem revisão ({counts.sem_revisao})
        </label>
      </div>

      {isLoading && <PageSkeleton variant="list" label="Juntando o que a IA fez" />}
      {error && <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}</div>}
      {!isLoading && !error && shown.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-9 w-9 text-success" /> Tudo revisado.
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {shown.slice(0, 60).map((item) => <FeedCard key={`${item.kind}:${item.id}`} item={item} projectName={projectName} />)}
        </AnimatePresence>
      </div>
    </section>
  );
}

function FeedCard({ item, projectName }: { item: FeedItem; projectName: (id: string | null) => string | null }) {
  const feedback = useAiFeedback();
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState("");
  const Icon = KIND_ICON[item.kind];

  const send = (verdict: "ok" | "diferente") => feedback.mutate({ item, verdict, correcao: texto }, {
    onSuccess: () => { toast.success(verdict === "ok" ? "Anotado: tá certo" : "Correção incorporada"); setEditing(false); setTexto(""); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className={cn("rounded-lg border bg-card p-4", item.feedback?.verdict === "diferente" ? "border-warning/40" : "border-border")} aria-label={item.titulo}>
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium uppercase text-primary">{FEED_KIND_LABEL[item.kind]}</span>
            {projectName(item.project_id) && <span>· {projectName(item.project_id)}</span>}
            <span>· {ago(item.at)}</span>
            {item.resultado && <span className={cn("rounded-full border px-1.5", item.resultado.includes("✓") ? "border-success/40 text-success" : "border-border")}>{item.resultado}</span>}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{item.titulo}</h3>
          {item.contexto && (
            <div className="rounded-md bg-muted/50 p-2.5 text-sm">
              <div className="text-[11px] font-medium uppercase text-muted-foreground">{CONTEXT_LABEL[item.kind]}</div>
              <p className="text-foreground">{item.contexto}</p>
            </div>
          )}
          <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-sm">
            <div className="text-[11px] font-medium uppercase text-primary">{DONE_LABEL[item.kind]}</div>
            <p className="whitespace-pre-line text-foreground">{item.feito}</p>
          </div>

          {item.feedback ? (
            <p className={cn("text-xs", item.feedback.verdict === "ok" ? "text-success" : "text-warning")}>
              {item.feedback.verdict === "ok" ? "✓ Revisado: tá certo" : `✎ Você faria diferente${item.feedback.correcao ? `: ${item.feedback.correcao}` : ""}`}
            </p>
          ) : editing ? (
            <div className="space-y-2">
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={PLACEHOLDER[item.kind]} rows={3} aria-label="Como você faria" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => send("diferente")} disabled={feedback.isPending}>Enviar correção</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => send("ok")} disabled={feedback.isPending}><ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Tá certo</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Faria diferente</Button>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
