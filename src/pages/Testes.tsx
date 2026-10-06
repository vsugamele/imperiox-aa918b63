import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ClipboardCopy, FlaskConical, Loader2, Sparkles, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { AXIS_ORDER, VARIATION_AXES, type VariationAxis } from "@shared/creative-variations";
import { useGenerateVariations, useTestLive, useTestOrders, useVariationBatches, type TestLive, type TestOrder, type VariationBatch } from "@/hooks/useTestOrders";
import { LIVE_LABEL, liveEvaluation, liveLabel, type LiveOrder, type LiveVariant } from "@shared/test-live";
import type { Tables } from "@/integrations/supabase/types";

type Variant = Tables<"imphq_test_variants">;

const STATUS_LABEL: Record<string, string> = { rascunho: "Rascunho", pronto: "Pronto (pausado)", no_ar: "No ar", encerrado: "Encerrado", cancelado: "Cancelado" };
const VARIANT_TONE: Record<string, string> = {
  vencedor: "border-success/40 bg-success/10 text-success",
  morto: "border-destructive/40 bg-destructive/10 text-destructive",
  pausado: "border-border text-muted-foreground",
  no_ar: "border-primary/30 bg-primary/5 text-primary",
  planejado: "border-dashed border-border text-muted-foreground",
};

const brl = (n: unknown) => `R$ ${Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function Testes() {
  const { data: orders = [], isLoading, error } = useTestOrders();
  const { data: batches = [] } = useVariationBatches();
  const { data: live = {} } = useTestLive(orders);
  const [target, setTarget] = useState<{ order: TestOrder; variant: Variant } | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <div className="kicker">Testes</div>
        <h1 className="section-title mt-1 text-2xl md:text-3xl">Testes de criativos</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cada teste roda um ângulo por conjunto e é julgado pela Esteira de Escala (fase 1) a partir do fim do dia 2. Do ângulo que vende, gere variações:
          a fábrica recria a arte mantendo a pessoa e o estilo e escreve a copy nova.
        </p>
      </header>

      {isLoading && <PageSkeleton variant="grid" label="Carregando testes" />}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}
        </div>
      )}
      {!isLoading && !error && orders.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum teste ainda. Peça ao Claude: "monta um teste com estes criativos".</p>
      )}

      {orders.map((o) => <OrderCard key={o.id} order={o} live={live[o.id]} onVariations={(variant) => setTarget({ order: o, variant })} />)}

      <BatchesSection batches={batches} />

      <VariationsDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

const LABEL_TONE: Record<string, string> = { vendendo: "font-semibold text-success", ic_barato: "text-success", pausar: "text-destructive", aguardando: "text-muted-foreground", parado: "text-muted-foreground" };

function OrderCard({ order, live, onVariations }: { order: TestOrder; live?: TestLive; onVariations: (v: Variant) => void }) {
  const dias = order.ativado_em ? Math.max(0, (Date.now() - Date.parse(order.ativado_em)) / 86_400_000) : 0;
  const readings = live?.readings ?? [];
  const byOrdem = new Map(readings.map((r) => [r.ordem, r]));
  const ev = readings.length ? liveEvaluation(order as LiveOrder, order.variantes as LiveVariant[], readings, new Date()) : null;
  const evByOrdem = new Map((ev?.avaliacoes ?? []).map((a) => [a.ordem, a]));
  const gasto = readings.reduce((s, r) => s + r.gasto, 0);
  const vendas = readings.reduce((s, r) => s + r.vendas, 0);
  const liquido = readings.reduce((s, r) => s + r.receita_liquida, 0);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label={`Teste ${order.nome}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{order.nome}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {order.oferta} · {STATUS_LABEL[order.status] ?? order.status} · {brl(order.verba_dia_conjunto)}/dia por ângulo
            {order.ativado_em ? ` · ${dias.toFixed(1)} dia(s) no ar` : ""}
            {order.corte_autorizado_por ? ` · corte autorizado por ${order.corte_autorizado_por} até ${order.corte_ate}` : ""}
          </p>
        </div>
        {readings.length ? (
          <div className="text-right text-xs text-muted-foreground" aria-label="Resultado ao vivo">
            <div className="font-mono text-sm text-foreground">{brl(gasto)} · {vendas} venda(s) · CPA {vendas ? brl(gasto / vendas) : "—"}</div>
            <div>Líquido {brl(liquido)} · saldo <span className={liquido - gasto >= 0 ? "text-success" : "text-destructive"}>{brl(liquido - gasto)}</span></div>
            <div>Gasto do Zernio até {live?.sync ? new Date(live.sync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"} · vendas ao vivo</div>
          </div>
        ) : <span className="text-xs text-muted-foreground">Sem leitura ainda</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {order.variantes.map((v) => {
          const r = byOrdem.get(v.ordem);
          const a = evByOrdem.get(v.ordem);
          return (
            <motion.div key={v.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex flex-col overflow-hidden rounded-md border bg-background", v.status === "vencedor" ? "border-success/50" : "border-border")}>
              <img src={v.image_url} alt={v.angulo} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight text-foreground">{String(v.ordem).padStart(2, "0")} · {v.angulo}</span>
                  <span className={cn("shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium uppercase", VARIANT_TONE[v.status] ?? VARIANT_TONE.planejado)}>
                    {v.status === "vencedor" ? <Trophy className="inline h-3 w-3" /> : v.status === "morto" ? <XCircle className="inline h-3 w-3" /> : null} {v.status.replace("_", " ")}
                  </span>
                </div>
                {v.hipotese && <p className="text-[11px] text-muted-foreground">Hipótese: {v.hipotese}</p>}
                {r ? (
                  <div className="font-mono text-[11px] text-muted-foreground">
                    <div>{brl(r.gasto)} · {r.ic} IC · <span className={r.vendas ? "font-semibold text-success" : ""}>{r.vendas} venda(s)</span></div>
                    <div>CTR {r.ctr ?? "—"}% · CPA {r.cpa ? brl(r.cpa) : "—"}{r.status_meta && r.status_meta !== "ACTIVE" ? " · pausado na Meta" : ""}</div>
                  </div>
                ) : null}
                {a && (() => { const lb = liveLabel(a.decisao, r?.vendas ?? 0); return <p className={cn("text-[11px]", LABEL_TONE[lb])} title={`${a.rotulo}. ${a.motivo}`}>Esteira: {LIVE_LABEL[lb].icon} {LIVE_LABEL[lb].texto}</p>; })()}
                {v.veredito && <p className="line-clamp-2 text-[11px] text-foreground" title={v.veredito}>{v.veredito}</p>}
                <Button size="sm" variant="outline" className="mt-auto h-7" onClick={() => onVariations(v)}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Gerar variações
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function VariationsDialog({ target, onClose }: { target: { order: TestOrder; variant: Variant } | null; onClose: () => void }) {
  const generate = useGenerateVariations();
  const [quantidade, setQuantidade] = useState(2);
  const [eixos, setEixos] = useState<VariationAxis[]>(["headline", "avatar"]);
  const [publico, setPublico] = useState("");
  const [marca, setMarca] = useState("");

  const toggle = (axis: VariationAxis, on: boolean) => setEixos((cur) => (on ? [...new Set([...cur, axis])] : cur.filter((a) => a !== axis)));

  const submit = () => {
    if (!target) return;
    generate.mutate({
      project_id: target.order.project_id, base_image_url: target.variant.image_url, angulo: target.variant.angulo,
      hipotese: target.variant.hipotese, oferta: target.order.oferta, publico: publico || null, marca_topo: marca || null,
      texto_base: target.variant.texto, quantidade, eixos,
    }, {
      onSuccess: (r) => { toast.success(`Lote criado: ${r.quantidade} arte(s) a caminho. Leva de 1 a 3 minutos.`); onClose(); },
      onError: (e) => toast.error(`A fábrica recusou: ${errorMessage(e)}`),
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Variações de “{target?.variant.angulo}”</DialogTitle>
          <DialogDescription>A arte deste ângulo vira referência: mesma pessoa e estilo, texto novo em cada eixo. Imagem pela Kie (Nano Banana Pro), copy pela OpenRouter.</DialogDescription>
        </DialogHeader>
        {target && <img src={target.variant.image_url} alt="" className="mx-auto h-40 rounded object-cover" />}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="var-qtd">Quantidade (1 a 6)</Label>
            <Input id="var-qtd" type="number" min={1} max={6} value={quantidade} onChange={(e) => setQuantidade(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Eixos</legend>
            {AXIS_ORDER.map((axis) => (
              <label key={axis} className="flex items-start gap-2 text-sm">
                <Checkbox checked={eixos.includes(axis)} onCheckedChange={(c) => toggle(axis, c === true)} aria-label={VARIATION_AXES[axis].label} />
                <span><strong>{VARIATION_AXES[axis].label}</strong> <span className="text-muted-foreground">{VARIATION_AXES[axis].instrucao}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="var-publico">Público (opcional)</Label>
              <Input id="var-publico" value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ex.: cabeleireiras de cachos" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="var-marca">Texto fixo no topo (opcional)</Label>
              <Input id="var-marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: O CÓDIGO DOS CORTES PERFEITOS" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={generate.isPending || eixos.length === 0}>
            {generate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gerar {quantidade} variação(ões)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchesSection({ batches }: { batches: VariationBatch[] }) {
  if (!batches.length) return null;
  const copyId = async (id: string) => {
    try { await navigator.clipboard.writeText(id); toast.success("Id do lote copiado"); } catch { toast.error("Não consegui copiar"); }
  };
  return (
    <section className="space-y-3" aria-label="Variações geradas">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FlaskConical className="h-4 w-4" /> Variações geradas</h2>
      <AnimatePresence initial={false}>
        {batches.map((b) => {
          const running = b.status === "pending" || b.status === "processing";
          return (
            <motion.div key={b.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{b.nome}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {running ? "Gerando" : b.status === "failed" ? "Falhou" : "Pronto"} · {b.total_gerado ?? 0}/{b.total_planejado ?? 0}
                  <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => copyId(b.id)} title="Para testar estas artes, peça ao Claude: monta um teste com o lote <id>">
                    <ClipboardCopy className="h-3.5 w-3.5" /> id do lote
                  </button>
                </span>
              </div>
              {b.error_message && <p className="text-xs text-warning">{b.error_message}</p>}
              {b.artes.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {b.artes.map((a) => (
                    <figure key={a.id} className="overflow-hidden rounded border border-border">
                      <a href={a.image_url} target="_blank" rel="noopener noreferrer"><img src={a.image_url} alt={a.headline_arte ?? ""} loading="lazy" className="aspect-[4/5] w-full object-cover" /></a>
                      <figcaption className="space-y-0.5 p-1.5 text-[11px]">
                        <div className="font-medium uppercase text-muted-foreground">{a.eixo ?? "variação"}</div>
                        {a.texto_anuncio && <p className="line-clamp-3 text-foreground" title={a.texto_anuncio}>{a.texto_anuncio}</p>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </section>
  );
}
