// Biblioteca de referências analisadas (Story REF1.1), no padrão do Centro de Comando: quadros com tempo,
// vídeo sob demanda (link temporário), link da referência, ficha editorial e análise completa (anatomia, transcrição, prompt).
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Frame { seconds: number; url: string }
interface Editorial {
  referenceId?: string; primaryNiche?: string; topic?: string; classificationBasis?: string; format?: string; audienceHypothesis?: string;
  copyOperation?: string; payoff?: string; ctaObserved?: string; critique?: string; transfer?: string; performance?: string;
}
interface AnatomyBlock { kind: string; start: number; end: number; label: string; purpose: string }
interface Analise {
  ordinal?: number | null; arquivo?: string | null; report?: string | null; editorial?: Editorial | null;
  anatomy?: { intent?: string; cta_mode?: string; blocks?: AnatomyBlock[] } | null; transcript?: Array<{ start: number; end: number; text: string }>;
  awareness_level?: string | null; angle_family?: string | null; angle_lens?: string | null; belief_shift?: { from: string; to: string } | null;
  quality_score?: number | null; replication_prompt?: string | null; criador?: string | null;
}
interface LibraryRef { id: string; titulo: string; url: string | null; lote: string | null; duracao: number | null; quadros: Frame[] | null; analise: Analise | null }

const KIND_LABEL: Record<string, string> = { hook: "Gancho", body: "Corpo", bridge: "Ponte", proof: "Prova", demonstration: "Demonstração", offer: "Oferta", reason_why: "Porquê", cta: "CTA" };
const secs = (n: number) => `${n.toFixed(2)}s`;
const isHttp = (u: string | null) => !!u && /^https?:\/\//i.test(u);

function EditorialCard({ e }: { e: Editorial }) {
  const rows: Array<[string, string | undefined]> = [
    ["Tema", e.topic], ["Público — hipótese", e.audienceHypothesis], ["Estrutura da copy", e.copyOperation], ["Entrega / promessa da fonte", e.payoff],
    ["CTA observado", e.ctaObserved], ["Crítica editorial", e.critique], ["O que aproveitar", e.transfer],
  ];
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5">
      <p className="text-sm font-semibold text-primary">{[e.primaryNiche, e.format].filter(Boolean).join(" · ")}</p>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <p key={k} className="text-[13px] leading-snug"><span className="font-semibold text-foreground">{k}: </span><span className="text-foreground/85">{v}</span></p>
      ))}
      {(e.classificationBasis || e.performance) && (
        <p className="pt-1 text-[11px] text-muted-foreground">{e.classificationBasis} {e.performance ? `Desempenho: ${e.performance}.` : ""}</p>
      )}
    </div>
  );
}

function VideoPlayer({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    if (src || loading) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("reference-video-url", { body: { referencia_id: id } });
    setLoading(false);
    if (error || !data?.url) { toast.error(`Vídeo indisponível: ${data?.error ?? error?.message ?? "sem resposta"}`); return; }
    setSrc(data.url);
  };
  return (
    <details onToggle={(ev) => { if ((ev.target as HTMLDetailsElement).open) void load(); }}>
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground">Assistir ao vídeo</summary>
      <div className="mt-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {src && <video src={src} controls playsInline className="max-h-[420px] w-full rounded-md bg-black" />}
      </div>
    </details>
  );
}

// Limita a inferência a esta consulta, evitando expansão recursiva do schema inteiro.
interface ReferenceQuery extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  eq(column: string, value: string): ReferenceQuery;
}
const referenceDatabase = supabase as unknown as {
  from(table: "imphq_referencias"): { select(columns: string): ReferenceQuery };
};

export function ReferenceLibraryView() {
  const [refs, setRefs] = useState<LibraryRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [lote, setLote] = useState("all");
  const [nicho, setNicho] = useState("all");
  const [aberta, setAberta] = useState<LibraryRef | null>(null);

  useEffect(() => {
    referenceDatabase.from("imphq_referencias").select("id, titulo, url, lote, duracao, quadros, analise").eq("fonte", "centro").then(({ data, error }) => {
      if (error) toast.error(`Biblioteca: ${error.message}`);
      const rows = ((data ?? []) as unknown as LibraryRef[]).sort((a, b) => (a.lote ?? "").localeCompare(b.lote ?? "") || (a.analise?.ordinal ?? 0) - (b.analise?.ordinal ?? 0));
      setRefs(rows);
      setLoading(false);
    });
  }, []);

  const lotes = useMemo(() => [...new Set(refs.map((r) => r.lote).filter(Boolean) as string[])].sort(), [refs]);
  const nichos = useMemo(() => [...new Set(refs.map((r) => r.analise?.editorial?.primaryNiche).filter(Boolean) as string[])].sort(), [refs]);
  const shown = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return refs.filter((r) => (lote === "all" || r.lote === lote) && (nicho === "all" || r.analise?.editorial?.primaryNiche === nicho)
      && (!q || [r.titulo, r.analise?.editorial?.topic, r.analise?.criador, r.analise?.report].some((v) => (v ?? "").toLowerCase().includes(q))));
  }, [refs, busca, lote, nicho]);

  if (loading) return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar título, tema, criador..." className="pl-9" />
        </div>
        <Select value={nicho} onValueChange={setNicho}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Nicho" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os nichos</SelectItem>{nichos.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={lote} onValueChange={setLote}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Lote" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os lotes</SelectItem>{lotes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">{shown.length} referência(s) encontrada(s)</p>

      {shown.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma referência analisada.</p> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((r) => {
            const a = r.analise ?? {};
            const frames = r.quadros ?? [];
            return (
              <article key={r.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <header>
                  <h3 className="text-[15px] font-semibold text-foreground">{String(a.ordinal ?? "").padStart(2, "0")} · {r.titulo}</h3>
                  <p className="text-xs text-muted-foreground">{r.duracao ? secs(r.duracao) : "—"} · {frames.length} frames · lote {r.lote}</p>
                </header>
                {frames.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {frames.map((f) => (
                      <figure key={f.url} className="space-y-1">
                        <img src={f.url} alt={`Quadro em ${secs(f.seconds)}`} loading="lazy" className="aspect-[9/16] w-full rounded-md border border-border object-cover" />
                        <figcaption className="text-center text-[11px] text-muted-foreground">{secs(f.seconds)}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                <div className="border-t border-border/60 pt-3 space-y-3">
                  <VideoPlayer id={r.id} />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="secondary" onClick={() => setAberta(r)}>Examinar análise</Button>
                    {isHttp(r.url) && <a href={r.url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">Link da referência <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                  {a.arquivo && <p className="text-[11px] text-muted-foreground break-all">Origem: {a.arquivo}</p>}
                </div>
                {a.editorial ? <EditorialCard e={a.editorial} /> : a.report && <p className="rounded-lg border border-border bg-secondary/30 p-3 text-[13px] text-foreground/85 line-clamp-6">{a.report}</p>}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!aberta} onOpenChange={(o) => { if (!o) setAberta(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {aberta && (() => {
            const a = aberta.analise ?? {};
            return (
              <>
                <DialogHeader><DialogTitle>{aberta.titulo}</DialogTitle></DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    {a.awareness_level && <Badge variant="outline">Consciência: {a.awareness_level}</Badge>}
                    {a.angle_family && <Badge variant="outline">Ângulo: {a.angle_family}</Badge>}
                    {a.angle_lens && <Badge variant="outline">Lente: {a.angle_lens}</Badge>}
                    {typeof a.quality_score === "number" && <Badge variant="outline">Qualidade: {a.quality_score}/20</Badge>}
                    {a.criador && <Badge variant="outline">@{a.criador}</Badge>}
                  </div>
                  {a.belief_shift && <p><span className="font-semibold">Troca de crença: </span>{a.belief_shift.from} → {a.belief_shift.to}</p>}
                  {a.anatomy?.blocks?.length ? (
                    <section className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anatomia</h4>
                      {a.anatomy.blocks.map((b, i) => (
                        <p key={i} className="text-[13px]"><span className="font-mono text-muted-foreground">{secs(b.start)}–{secs(b.end)}</span> <span className="font-semibold">{KIND_LABEL[b.kind] ?? b.kind}:</span> {b.label} <span className="text-muted-foreground">— {b.purpose}</span></p>
                      ))}
                    </section>
                  ) : null}
                  {a.report && <section><h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Análise</h4><p className="whitespace-pre-line text-[13px] text-foreground/85">{a.report}</p></section>}
                  {a.replication_prompt && <section><h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Prompt de replicação</h4><pre className="whitespace-pre-wrap rounded-md bg-secondary/50 p-2 text-[12px]">{a.replication_prompt}</pre></section>}
                  {a.transcript?.length ? (
                    <section className="space-y-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcrição</h4>
                      {a.transcript.map((s, i) => <p key={i} className="text-[13px]"><span className="font-mono text-muted-foreground">{secs(s.start)}</span> {s.text}</p>)}
                    </section>
                  ) : null}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
