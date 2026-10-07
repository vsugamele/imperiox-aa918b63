import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, ExternalLink, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { marketSummary } from "@shared/method-scoreboard";
import { useLibraryHealth, useReferenceAngles, useReviewReferenceAngle, type CopyLibraryItem, type ReferenceAngle } from "@/hooks/useCopyLibrary";

interface Alt { id: string; p: number }

const altList = (r: ReferenceAngle): Alt[] => (Array.isArray(r.copy_lib_alt) ? (r.copy_lib_alt as unknown as Alt[]) : []).filter((a) => a && typeof a.id === "string");

const FORMATO_LABEL: Record<string, string> = {
  estatico: "Estático", carrossel: "Carrossel", print_conversa: "Print de conversa", antes_depois: "Antes e depois", depoimento: "Depoimento",
  ugc_fala: "UGC falando", demonstracao: "Demonstração", narrativa_broll: "Narração com b-roll", entrevista_podcast: "Entrevista/podcast",
  produto: "Produto", infografico: "Infográfico", meme: "Meme", outro: "Outro",
};

/** Quanto da biblioteca já passou pelo pipeline (REF2.1): texto, projeto, ângulo e formatos. */
function LibraryHealthCard() {
  const { data } = useLibraryHealth();
  if (!data) return null;
  const bar = (label: string, n: number, total: number) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-foreground">{label}</span><span className="font-mono text-muted-foreground">{n}/{total}</span></div>
      <div className="h-1.5 overflow-hidden rounded bg-muted"><motion.div className="h-full rounded bg-primary" initial={{ width: 0 }} animate={{ width: `${total ? (n / total) * 100 : 0}%` }} /></div>
    </div>
  );
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Saúde da biblioteca">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Saúde da biblioteca</h3>
        <span className="text-[11px] text-muted-foreground">O pipeline processa sozinho a cada 10 minutos: guarda a mídia, transcreve, lê a imagem, etiqueta projeto e ângulo.</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {bar("Vídeos transcritos", data.videos_com_texto, data.videos)}
        {bar("Imagens lidas", data.imagens_lidas, data.imagens)}
        {bar("Com projeto", data.com_projeto, data.total)}
        {bar("Com ângulo", data.com_angulo, data.total)}
      </div>
      {data.formatos.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Formatos">
          {data.formatos.map((f) => <span key={f.formato} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground">{FORMATO_LABEL[f.formato] ?? f.formato} <span className="font-mono text-muted-foreground">{f.n}</span></span>)}
        </div>
      )}
    </section>
  );
}

/** O que o mercado está rodando (referências classificadas pelo Jev) e a fila de dúvidas para alguém do time decidir. */
export function MarketAngles({ library }: { library: CopyLibraryItem[] }) {
  const { data: refs = [], isLoading, error } = useReferenceAngles();
  const review = useReviewReferenceAngle();
  const [angulo, setAngulo] = useState<string | null>(null);
  const resumo = useMemo(() => marketSummary(refs, library), [refs, library]);
  const duvidas = refs.filter((r) => r.copy_lib_status === "duvida");
  const nome = (id: string | null | undefined) => {
    const l = library.find((x) => x.id === id);
    return l ? `${l.numero} · ${l.nome}` : id === "nenhum" ? "Nenhum ângulo claro" : id ?? "—";
  };
  const maxCamada = Math.max(1, ...resumo.camadas.map((c) => c.n));
  const doAngulo = angulo ? refs.filter((r) => r.copy_lib_id === angulo && r.copy_lib_status !== "duvida") : [];

  const decide = (r: ReferenceAngle, id: string | null) => review.mutate({ id: r.id, copy_lib_id: id && id !== "nenhum" ? id : null }, {
    onSuccess: () => toast.success("Ângulo decidido"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <><LibraryHealthCard /><PageSkeleton variant="list" label="Carregando o mercado" /></>;
  if (error) return <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}</div>;
  if (!refs.length) return <><LibraryHealthCard /><p className="py-6 text-center text-sm text-muted-foreground">Nenhuma referência classificada ainda. O Jev roda a cada 6 horas nas referências com transcrição.</p></>;

  return (
    <div className="space-y-5">
      <LibraryHealthCard />
      <p className="text-sm text-muted-foreground">
        {resumo.classificadas} referências com ângulo decidido (o Jev com confiança alta, ou alguém do time). {resumo.duvidas} esperando revisão.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Camadas do mercado">
          <h3 className="text-sm font-semibold text-foreground">Por camada</h3>
          {resumo.camadas.map((c) => (
            <div key={c.id} className="space-y-1">
              <div className="flex justify-between text-xs"><span className="text-foreground">{c.rotulo}</span><span className="font-mono text-muted-foreground">{c.n}</span></div>
              <div className="h-2 overflow-hidden rounded bg-muted">
                <motion.div className="h-full rounded bg-primary" initial={{ width: 0 }} animate={{ width: `${(c.n / maxCamada) * 100}%` }} transition={{ duration: 0.5 }} />
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Ângulos do mercado">
          <h3 className="text-sm font-semibold text-foreground">Ângulos mais usados</h3>
          <div className="flex flex-wrap gap-1.5">
            {resumo.angulos.map((a) => (
              <button key={a.id} type="button" onClick={() => setAngulo(angulo === a.id ? null : a.id)} aria-pressed={angulo === a.id}
                className={cn("rounded-md border px-2 py-1 text-xs", angulo === a.id ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/40")}>
                {a.rotulo} <span className="font-mono text-muted-foreground">{a.n}</span>
              </button>
            ))}
          </div>
          {angulo && (
            <ul className="mt-2 space-y-1 border-t border-border pt-2 text-sm" aria-label="Referências do ângulo">
              {doAngulo.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{r.titulo ?? r.id}</span>
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Abrir referência"><ExternalLink className="h-3.5 w-3.5" /></a>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {duvidas.length > 0 && (
        <section className="space-y-2" aria-label="Dúvidas para revisar">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><HelpCircle className="h-4 w-4" /> Dúvidas para revisar ({duvidas.length})</h3>
          <p className="text-xs text-muted-foreground">O Jev não teve certeza. Escolha o ângulo que a peça usa: a decisão entra no placar do mercado.</p>
          <div className="grid gap-2 md:grid-cols-2">
            {duvidas.slice(0, 12).map((r) => (
              <article key={r.id} className="space-y-2 rounded-md border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{r.titulo ?? r.id}</span>
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Abrir referência"><ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: r.copy_lib_id ?? "nenhum", p: Number(r.copy_lib_conf ?? 0) }, ...altList(r)].map((a, i) => (
                    <Button key={`${a.id}-${i}`} size="sm" variant={i === 0 ? "default" : "outline"} className="h-7 text-xs" disabled={review.isPending} onClick={() => decide(r, a.id)}>
                      {i === 0 && <Check className="mr-1 h-3 w-3" />}{nome(a.id)}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {duvidas.length > 12 && <p className="text-xs text-muted-foreground">Mostrando 12 de {duvidas.length}. As próximas aparecem conforme estas são decididas.</p>}
        </section>
      )}
    </div>
  );
}
