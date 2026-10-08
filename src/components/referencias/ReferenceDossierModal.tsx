import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, Play, Copy, Check, Sparkles, Video, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

async function downloadMedia(url: string, filename?: string) {
  try {
    toast.info("Iniciando download do vídeo...");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha no download");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const ext = url.split("?")[0].split(".").pop() || "mp4";
    const cleanTitle = (filename || "referencia").replace(/[^a-zA-Z0-9_\-\u00C0-\u017F ]/g, "_").slice(0, 50);
    a.download = `${cleanTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast.success("Download concluído!");
  } catch {
    window.open(url, "_blank");
  }
}

export interface Frame {
  seconds: number;
  url: string;
}

export interface Editorial {
  referenceId?: string;
  primaryNiche?: string;
  topic?: string;
  classificationBasis?: string;
  format?: string;
  audienceHypothesis?: string;
  copyOperation?: string;
  payoff?: string;
  ctaObserved?: string;
  critique?: string;
  transfer?: string;
  performance?: string;
}

export interface AnatomyBlock {
  kind: string;
  start: number;
  end: number;
  label: string;
  purpose: string;
}

export interface Analise {
  ordinal?: number | null;
  arquivo?: string | null;
  report?: string | null;
  editorial?: Editorial | null;
  anatomy?: { intent?: string; cta_mode?: string; blocks?: AnatomyBlock[] } | null;
  transcript?: Array<{ start: number; end: number; text: string }>;
  awareness_level?: string | null;
  angle_family?: string | null;
  angle_lens?: string | null;
  belief_shift?: { from: string; to: string } | null;
  quality_score?: number | null;
  replication_prompt?: string | null;
  criador?: string | null;
  copy?: { gancho?: string | null; mecanismo?: string | null; vilao?: string | null; promessa?: string | null; prova?: string | null; cta?: string | null } | null;
  cenas?: Array<{ seconds: number; descricao: string }> | null;
}

export interface DossierRefItem {
  id: string;
  titulo: string;
  url?: string | null;
  lote?: string | null;
  duracao?: number | null;
  quadros?: Frame[] | null;
  analise?: Analise | null;
}

const KIND_LABEL: Record<string, string> = {
  hook: "Gancho",
  body: "Corpo",
  bridge: "Ponte",
  proof: "Prova",
  demonstration: "Demonstração",
  offer: "Oferta",
  reason_why: "Porquê",
  cta: "CTA"
};

const secs = (n: number) => `${n.toFixed(2)}s`;
const isHttp = (u?: string | null) => !!u && /^https?:\/\//i.test(u);

function VideoPlayer({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (src || loading) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("reference-video-url", {
      body: { referencia_id: id }
    });
    setLoading(false);
    if (error || !data?.url) {
      toast.error(`Vídeo indisponível: ${data?.error ?? error?.message ?? "sem resposta"}`);
      return;
    }
    setSrc(data.url);
  };

  return (
    <details onToggle={(ev) => { if ((ev.target as HTMLDetailsElement).open) void load(); }} className="rounded-xl border border-border bg-slate-900/60 p-3">
      <summary className="cursor-pointer select-none text-xs font-semibold text-slate-200 flex items-center gap-2">
        <Video className="h-4 w-4 text-violet-400" />
        Assistir ao vídeo original (link temporário sob demanda)
      </summary>
      <div className="mt-3">
        {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando link seguro...</div>}
        {src && <video src={src} controls playsInline className="max-h-[380px] w-full rounded-lg bg-black shadow-lg" />}
      </div>
    </details>
  );
}

function EditorialCard({ e }: { e: Editorial }) {
  const rows: Array<[string, string | undefined]> = [
    ["Tema", e.topic],
    ["Público — hipótese", e.audienceHypothesis],
    ["Estrutura da copy", e.copyOperation],
    ["Entrega / promessa da fonte", e.payoff],
    ["CTA observado", e.ctaObserved],
    ["Crítica editorial", e.critique],
    ["O que aproveitar", e.transfer],
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
          {[e.primaryNiche, e.format].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="space-y-1.5 pt-1">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <p key={k} className="text-xs leading-relaxed">
            <span className="font-semibold text-slate-300">{k}: </span>
            <span className="text-slate-400">{v}</span>
          </p>
        ))}
      </div>
      {(e.classificationBasis || e.performance) && (
        <p className="pt-2 text-[11px] text-muted-foreground border-t border-slate-800/80">
          {e.classificationBasis} {e.performance ? `Desempenho: ${e.performance}.` : ""}
        </p>
      )}
    </div>
  );
}

export function ReferenceDossierModal({
  item,
  open,
  onOpenChange
}: {
  item: DossierRefItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  if (!item) return null;

  const a = item.analise ?? {};
  const frames = item.quadros ?? [];

  const handleCopyPrompt = () => {
    if (!a.replication_prompt) return;
    navigator.clipboard.writeText(a.replication_prompt);
    setCopiedPrompt(true);
    toast.success("Prompt de replicação copiado!");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-slate-800 text-slate-100 shadow-2xl backdrop-blur-xl">
        {/* Header fixo */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] uppercase font-bold">
                  {a.ordinal ? `#${String(a.ordinal).padStart(2, "0")}` : "Storyboard"}
                </Badge>
                {item.lote && (
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-800">
                    Lote: {item.lote}
                  </Badge>
                )}
                {item.duracao && (
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-800">
                    ⏱️ {secs(item.duracao)}
                  </Badge>
                )}
                {frames.length > 0 && (
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-800">
                    🎞️ {frames.length} quadros
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-lg font-bold text-slate-100 leading-tight">
                {item.titulo}
              </DialogTitle>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {item.url && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-slate-800 text-slate-300 hover:text-white"
                  onClick={() => downloadMedia(item.url!, item.titulo)}
                >
                  <Download className="h-3.5 w-3.5" /> Baixar Vídeo
                </Button>
              )}
              {isHttp(item.url) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-slate-800 text-slate-300 hover:text-white"
                  onClick={() => window.open(item.url!, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ver Post Original
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com rolagem independente */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
          {/* 1. FITA DE QUADROS FRAME A FRAME (STORYBOARD) */}
          {frames.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  🎞️ Storyboard Frame por Frame ({frames.length} cenas)
                </h4>
                <span className="text-[11px] text-slate-500">Clique para ampliar o quadro</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 p-3 rounded-xl border border-slate-800/80 bg-slate-900/40">
                {frames.map((f, i) => (
                  <figure
                    key={f.url || i}
                    onClick={() => setSelectedFrame(f.url)}
                    className="space-y-1.5 cursor-pointer group"
                  >
                    <div className="relative aspect-[9/16] w-full rounded-lg overflow-hidden border border-slate-800 group-hover:border-amber-500/60 transition-all bg-slate-950">
                      <img
                        src={f.url}
                        alt={`Quadro ${i + 1} em ${secs(f.seconds)}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono text-slate-200">
                        {secs(f.seconds)}
                      </div>
                    </div>
                    <figcaption className="text-center text-[10px] text-slate-400 font-medium" title={a.cenas?.find((c) => Math.abs(c.seconds - f.seconds) < 0.5)?.descricao}>
                      Cena {i + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* Modal de ampliação de quadro individual */}
          {selectedFrame && (
            <Dialog open={!!selectedFrame} onOpenChange={() => setSelectedFrame(null)}>
              <DialogContent className="max-w-md bg-slate-950 border-slate-800 p-2">
                <img src={selectedFrame} alt="Quadro ampliado" className="w-full h-auto rounded-lg object-contain" />
              </DialogContent>
            </Dialog>
          )}

          {/* 2. PLAYER DE VÍDEO SEGURO */}
          <VideoPlayer id={item.id} />

          {/* 3. METADADOS E ÂNGULOS PERSUASIVOS */}
          <div className="flex flex-wrap gap-2 pt-1">
            {a.awareness_level && (
              <Badge variant="outline" className="text-xs bg-slate-900 border-slate-800 text-slate-300">
                Consciência: <strong className="text-amber-400 ml-1">{a.awareness_level}</strong>
              </Badge>
            )}
            {a.angle_family && (
              <Badge variant="outline" className="text-xs bg-slate-900 border-slate-800 text-slate-300">
                Ângulo: <strong className="text-amber-400 ml-1">{a.angle_family}</strong>
              </Badge>
            )}
            {a.angle_lens && (
              <Badge variant="outline" className="text-xs bg-slate-900 border-slate-800 text-slate-300">
                Lente: <strong className="text-amber-400 ml-1">{a.angle_lens}</strong>
              </Badge>
            )}
            {typeof a.quality_score === "number" && (
              <Badge variant="outline" className="text-xs bg-slate-900 border-slate-800 text-slate-300">
                Score de Qualidade: <strong className="text-emerald-400 ml-1">{a.quality_score}/10</strong>
              </Badge>
            )}
            {a.criador && (
              <Badge variant="outline" className="text-xs bg-slate-900 border-slate-800 text-slate-300">
                Criador: <strong className="text-sky-400 ml-1">@{a.criador}</strong>
              </Badge>
            )}
          </div>

          {/* Troca de Crença */}
          {a.belief_shift && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs">
              <span className="font-bold text-purple-400 uppercase tracking-wide">Troca de Crença (Belief Shift): </span>
              <span className="text-slate-300">{a.belief_shift.from} ➔ <strong className="text-purple-300">{a.belief_shift.to}</strong></span>
            </div>
          )}

          {/* Dossiê da copy (Dissecador REF3.1) */}
          {a.copy && Object.values(a.copy).some(Boolean) && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">🎯 Dossiê da Copy</h4>
              <div className="grid gap-2 sm:grid-cols-2 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 text-xs">
                {([
                  ["gancho", "Gancho"], ["mecanismo", "Mecanismo"], ["vilao", "Vilão"],
                  ["promessa", "Promessa"], ["prova", "Prova"], ["cta", "CTA"],
                ] as const).map(([k, label]) => a.copy?.[k] ? (
                  <div key={k} className="space-y-0.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="text-slate-200 leading-relaxed">{a.copy[k]}</div>
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {/* 4. ANATOMIA DA COPY (BLOCOS DE PERSUASÃO COM CRONOMETRAGEM) */}
          {a.anatomy?.blocks && a.anatomy.blocks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                🧠 Anatomia da Copy por Blocos
              </h4>
              <div className="space-y-2 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
                {a.anatomy.blocks.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <span className="font-mono text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                      {secs(b.start)}–{secs(b.end)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-200">
                        {KIND_LABEL[b.kind] ?? b.kind}:{" "}
                      </span>
                      <span className="text-slate-300 font-medium">{b.label}</span>
                      <span className="text-slate-500 ml-1.5">— {b.purpose}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. FICHA EDITORIAL OU RELATÓRIO */}
          {a.editorial ? (
            <EditorialCard e={a.editorial} />
          ) : a.report ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Análise Editorial</h4>
              <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                {a.report}
              </p>
            </div>
          ) : null}

          {/* 6. PROMPT DE REPLICAÇÃO PARA IA */}
          {a.replication_prompt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Prompt de Replicação para IA
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPrompt}
                  className="h-7 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/30 gap-1.5"
                >
                  {copiedPrompt ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedPrompt ? "Copiado!" : "Copiar Prompt"}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap rounded-xl bg-slate-900 border border-slate-800 p-3.5 text-xs text-slate-300 leading-relaxed font-mono">
                {a.replication_prompt}
              </pre>
            </div>
          )}

          {/* 7. TRANSCRIÇÃO CRONOMETRADA */}
          {a.transcript && a.transcript.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                📝 Transcrição Cronometrada
              </h4>
              <div className="space-y-1.5 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 max-h-60 overflow-y-auto">
                {a.transcript.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs leading-relaxed">
                    <span className="font-mono text-[10px] text-slate-500 shrink-0 mt-0.5">
                      {secs(s.start)}
                    </span>
                    <span className="text-slate-300">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
