import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown, ClipboardCopy, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { CATEGORIA_LABEL } from "@shared/method-scoreboard";
import { MarketAngles } from "@/components/estrategias/MarketAngles";
import { useCopyLibrary, type CopyLibraryItem } from "@/hooks/useCopyLibrary";

const BIBLIOTECAS = [
  { id: "angulo", label: "Ângulos" },
  { id: "objecao", label: "Objeções" },
  { id: "prova", label: "Provas" },
  { id: "mecanismo", label: "Mecanismos" },
  { id: "processo", label: "Como usar" },
  { id: "mercado", label: "No mercado" },
] as const;

type BibliotecaId = (typeof BIBLIOTECAS)[number]["id"];

const CATEGORIA_TONE: Record<string, string> = {
  problema: "border-destructive/30 text-destructive",
  solucao: "border-primary/30 text-primary",
  produto: "border-success/30 text-success",
  oferta: "border-warning/40 text-warning",
  generico: "border-border text-muted-foreground",
};

const EXTRA_LABEL: Record<string, string> = {
  prova_que_quebra: "Prova que quebra",
  onde_quebrar: "Onde quebrar",
  cuidado: "Cuidado / erro comum",
  observacao: "Observação",
};

const PROCESSO_LABEL: Record<string, string> = { angulo: "Ângulos", objecao: "Objeções", prova: "Provas", mecanismo: "Mecanismos" };

async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copiado`); } catch { toast.error("Não consegui copiar"); }
}

/** As bibliotecas do @renanmsap como consulta do time: escolher ângulo, objeção, prova e mecanismo antes de escrever. */
export function CopyLibrary() {
  const { data = [], isLoading, error } = useCopyLibrary();
  const [biblioteca, setBiblioteca] = useState<BibliotecaId>("angulo");
  const [categoria, setCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const daBiblioteca = useMemo(() => data.filter((i) => i.biblioteca === biblioteca), [data, biblioteca]);
  const categorias = useMemo(() => [...new Set(daBiblioteca.map((i) => i.categoria))], [daBiblioteca]);
  const itens = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return daBiblioteca.filter((i) => (categoria === "todas" || i.categoria === categoria)
      && (!b || `${i.nome} ${i.explicacao ?? ""} ${i.exemplo ?? ""}`.toLowerCase().includes(b)));
  }, [daBiblioteca, categoria, busca]);

  const catLabel = (c: string) => (biblioteca === "processo" ? PROCESSO_LABEL[c] : CATEGORIA_LABEL[c]) ?? c;

  return (
    <section className="space-y-4" aria-label="Biblioteca de copy">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Antes de escrever ou variar um anúncio: escolha o ângulo, a objeção que ele quebra e a prova que sustenta. O id de cada item (ex. <code>angulo-22</code>)
        é a etiqueta usada no teste, e o placar em Testes mostra qual tipo vende. Fonte: bibliotecas do @renanmsap, uso interno.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Bibliotecas">
          {BIBLIOTECAS.map((b) => (
            <button key={b.id} role="tab" aria-selected={biblioteca === b.id} onClick={() => { setBiblioteca(b.id); setCategoria("todas"); setOpen(null); }}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                biblioteca === b.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {b.label} {b.id !== "mercado" && <span className="text-muted-foreground">{data.filter((i) => i.biblioteca === b.id).length}</span>}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="h-9 pl-8" aria-label="Buscar na biblioteca" />
        </div>
      </div>

      {biblioteca === "mercado" && <MarketAngles library={data} />}

      {biblioteca !== "mercado" && categorias.length > 1 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Camadas">
          {["todas", ...categorias].map((c) => (
            <button key={c} onClick={() => setCategoria(c)} aria-pressed={categoria === c}
              className={cn("rounded-md border px-2 py-0.5 text-[11px]", categoria === c ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {c === "todas" ? "Todas as camadas" : catLabel(c)}
            </button>
          ))}
        </div>
      )}

      {isLoading && <PageSkeleton variant="list" label="Carregando biblioteca" />}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}
        </div>
      )}
      {biblioteca !== "mercado" && !isLoading && !error && itens.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>}

      <div className="grid gap-2 md:grid-cols-2">
        {itens.map((item) => (
          <LibraryCard key={item.id} item={item} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} catLabel={catLabel} />
        ))}
      </div>
    </section>
  );
}

function LibraryCard({ item, open, onToggle, catLabel }: { item: CopyLibraryItem; open: boolean; onToggle: () => void; catLabel: (c: string) => string }) {
  const extra = Object.entries((item.extra ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string" && v);
  return (
    <motion.article layout className={cn("rounded-md border bg-card", open ? "border-primary/40 md:col-span-2" : "border-border")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 p-3 text-left">
        {item.biblioteca !== "processo" && <span className="font-mono text-xs text-muted-foreground">{item.numero}</span>}
        <span className="flex-1">
          <span className="block text-sm font-medium text-foreground">{item.nome}</span>
          {!open && item.explicacao && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.explicacao}</span>}
        </span>
        <span className={cn("shrink-0 rounded-full border px-1.5 py-px text-[10px] uppercase", CATEGORIA_TONE[item.categoria] ?? CATEGORIA_TONE.generico)}>{catLabel(item.categoria)}</span>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-border p-3 text-sm" role="region" aria-label={`Detalhes de ${item.nome}`}>
              {item.explicacao && <Field label={item.biblioteca === "objecao" ? "O que ela significa" : item.biblioteca === "prova" ? "O que prova" : item.biblioteca === "mecanismo" ? "A alavanca" : "Explicação"} text={item.explicacao} />}
              {item.exemplo && <Field label="Exemplo" text={item.exemplo} />}
              {item.como_usar && <Field label={item.biblioteca === "objecao" ? "Como quebrar" : item.biblioteca === "prova" ? "Como construir no seu nicho" : "Como fazer"} text={item.como_usar} />}
              {extra.map(([k, v]) => <Field key={k} label={EXTRA_LABEL[k] ?? k} text={String(v)} />)}
              {item.prompt && (
                <div className="rounded-md bg-muted/50 p-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase text-muted-foreground">
                    Prompt
                    <button type="button" onClick={() => copy(item.prompt ?? "", "Prompt")} className="inline-flex items-center gap-1 normal-case hover:text-foreground"><ClipboardCopy className="h-3.5 w-3.5" /> copiar</button>
                  </div>
                  <p className="whitespace-pre-line text-xs text-foreground">{item.prompt}</p>
                </div>
              )}
              {item.biblioteca !== "processo" && (
                <button type="button" onClick={() => copy(item.id, "Id")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ClipboardCopy className="h-3.5 w-3.5" /> etiqueta <code>{item.id}</code>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <p className="whitespace-pre-line text-foreground">{text}</p>
    </div>
  );
}
