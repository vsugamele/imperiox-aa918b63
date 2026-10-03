import { useEffect, useMemo, useState } from "react";
import { DownloadCloud, Gauge, Plus, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { addDays, localDate } from "@shared/map-steps";
import {
  SCALE_PHASE_LABEL, ZONE_LABEL, bidStep, dailyBrake, deriveParams, evaluateActiveAngle, evaluateAdset, evaluateConcept, evaluateGraveyardAngle,
  evaluateP1Round, evaluateP2Days, evaluateRound, p2Checkpoint, paramsFrom, roundSummary, spendByAdset, spendByDay, type ScalePhase,
} from "@shared/scale-ladder";
import { loadSpend, useSaveScaleRound, useScaleRounds, type ScaleRound } from "@/hooks/useScaleRounds";

interface StepScaleLadderProps {
  nodeId: string;
  projectId: string | null;
  fase: ScalePhase;
}

type Row = Record<string, string>;
type Data = Record<string, Row[] | Row | string>;
interface Col { key: string; label: string; kind: "text" | "number" | "yesno"; wide?: boolean }
interface TableSpec { key: string; title: string; cols: Col[]; blank: () => Row; start: number }
interface Reading { veredito: string; rotulo: string; acao: string }

const num = (label: string, key: string): Col => ({ key, label, kind: "number" });
const TABLES: Record<ScalePhase, TableSpec[]> = {
  parametros: [],
  p1: [{ key: "concepts", title: "Concepts (1 conjunto cada, veredito no fim do dia 2)", start: 5,
    cols: [{ key: "concept", label: "Concept (ângulo · avatar)", kind: "text", wide: true }, { key: "hipotese", label: "Hipótese testada", kind: "text", wide: true }, num("Gasto", "gasto"), num("IC", "ic"), num("Vendas", "vendas")],
    blank: () => ({ concept: "", hipotese: "", gasto: "", ic: "", vendas: "" }) }],
  p2: [
    { key: "dias", title: "Diário (agregado dos 5 conjuntos, julga no dia 3)", start: 3, cols: [num("Gasto", "gasto"), num("Vendas", "vendas")], blank: () => ({ gasto: "", vendas: "" }) },
    { key: "conjuntos", title: "Conjuntos no dia 3", start: 5, cols: [{ key: "nome", label: "Conjunto", kind: "text" }, num("Gasto", "gasto"), num("Vendas", "vendas")], blank: () => ({ nome: "", gasto: "", vendas: "" }) },
  ],
  p3: [
    { key: "lances", title: "Escada do lance (sobe ~17%, espera 48 h)", start: 2, cols: [num("Lance", "lance"), { key: "cresceu", label: "Gasto cresceu?", kind: "yesno" }], blank: () => ({ lance: "", cresceu: "" }) },
    { key: "angulos", title: "Ângulos ativos (1 conjunto por ângulo)", start: 3, cols: [{ key: "nome", label: "Ângulo", kind: "text", wide: true }, num("Gasto 7d", "gasto7"), num("Vendas 7d", "vendas7"), num("Dias sem gastar", "diasSemGastar")], blank: () => ({ nome: "", gasto7: "", vendas7: "", diasSemGastar: "" }) },
  ],
  p4: [{ key: "angulos", title: "Ângulos no cemitério (cost cap)", start: 3, cols: [{ key: "nome", label: "Ângulo · adformat", kind: "text", wide: true }, num("Gasto 7d", "gasto7"), num("Vendas 7d", "vendas7"), num("Dias seguidos no CPA", "diasSeguidosNoCpa")], blank: () => ({ nome: "", gasto7: "", vendas7: "", diasSeguidosNoCpa: "" }) }],
};

/** Período padrão para puxar do sync de anúncios em cada fase. */
const PULL_DAYS: Record<ScalePhase, number> = { parametros: 0, p1: 2, p2: 3, p3: 7, p4: 7 };

const GOOD = new Set(["qualificado", "aprovado", "duplica", "rodando", "catando", "volta_p3"]);
const MID = new Set(["mais_textos", "estende", "mantem", "cedo", "sem_gasto", "gastou_sem_venda", "dormindo"]);
const BAD = new Set(["morto", "reprovado", "pausa", "revisa"]);
const tone = (v: string) => GOOD.has(v) ? "border-success/40 bg-success/10 text-success"
  : MID.has(v) ? "border-warning/40 bg-warning/10 text-warning"
  : BAD.has(v) ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border text-muted-foreground";

const c = (row: Row, key: string) => row[key] ?? "";
const filled = (row: Row) => Object.values(row).some((v) => v.trim() !== "");
const rowsOf = (data: Data, key: string): Row[] => (Array.isArray(data[key]) ? (data[key] as Row[]) : []);
const textOf = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function emptyData(fase: ScalePhase): Data {
  const data: Data = {};
  for (const t of TABLES[fase]) data[t.key] = Array.from({ length: t.start }, t.blank);
  if (fase === "p2") data.checkpoint = { ic: "", pageviews: "" };
  if (fase === "p3") { data.verba = ""; data.gasto_ontem = ""; }
  return data;
}

/** Rodada salva (JSON) → rascunho editável em texto, sem perder colunas. */
function draftFromRound(fase: ScalePhase, round: ScaleRound): Data {
  const base = emptyData(fase);
  const saved = round.data && typeof round.data === "object" && !Array.isArray(round.data) ? round.data as Record<string, unknown> : {};
  for (const t of TABLES[fase]) {
    const list = Array.isArray(saved[t.key]) ? saved[t.key] as unknown[] : [];
    if (list.length) base[t.key] = list.map((item) => {
      const o = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return Object.fromEntries(Object.keys(t.blank()).map((k) => [k, k === "cresceu" ? (o[k] === true ? "sim" : o[k] === false ? "nao" : "") : textOf(o[k])]));
    });
  }
  const cp = saved.checkpoint && typeof saved.checkpoint === "object" ? saved.checkpoint as Record<string, unknown> : null;
  if (fase === "p2" && cp) base.checkpoint = { ic: textOf(cp.ic), pageviews: textOf(cp.pageviews) };
  if (fase === "p3") { base.verba = textOf(saved.verba); base.gasto_ontem = textOf(saved.gasto_ontem); }
  return base;
}

/** Rascunho → entrada do motor (linhas vazias saem; o checkpoint do P2 soma o gasto dos dias 1 e 2). */
function engineData(fase: ScalePhase, data: Data): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const t of TABLES[fase]) out[t.key] = rowsOf(data, t.key).filter(filled).map((r) => t.key === "lances" ? { ...r, cresceu: r.cresceu === "sim" ? true : r.cresceu === "nao" ? false : null } : r);
  if (fase === "p2") {
    const dias = rowsOf(data, "dias");
    const cp = (data.checkpoint ?? {}) as Row;
    out.checkpoint = { gasto2d: (Number(dias[0]?.gasto || 0) + Number(dias[1]?.gasto || 0)), ic: cp.ic, pageviews: cp.pageviews };
  }
  if (fase === "p3") { out.verba = data.verba; out.gasto_ontem = data.gasto_ontem; }
  return out;
}

const money = (v: number | null | undefined) => v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Números da fase da Esteira de Escala lançados na própria etapa, com o veredito ao vivo e o histórico do projeto. */
export function StepScaleLadder({ nodeId, projectId, fase }: StepScaleLadderProps) {
  const { data: stored } = useScaleRounds(projectId, fase);
  const save = useSaveScaleRound();
  const [roundId, setRoundId] = useState<string | null>(null);
  const [rodada, setRodada] = useState("");
  const [params, setParams] = useState({ payout: "", cpa_alvo: "", ics_por_venda: "8" });
  const [data, setData] = useState<Data>(() => emptyData(fase));
  const [pulling, setPulling] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Abre na rodada mais recente da fase; sem rodada, herda os últimos parâmetros do projeto.
  useEffect(() => {
    if (!stored || loaded) return;
    const latest = stored.rounds[0];
    if (latest) openRound(latest);
    else if (stored.lastParams) {
      const p = paramsFrom(stored.lastParams);
      setParams({ payout: p.payout ? String(p.payout) : "", cpa_alvo: p.cpaAlvo ? String(p.cpaAlvo) : "", ics_por_venda: String(p.icsPorVenda ?? 8) });
    }
    setLoaded(true);
    // openRound só usa setters; rodar uma vez quando o histórico chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, loaded]);

  function openRound(round: ScaleRound) {
    const p = paramsFrom(round.params);
    setRoundId(round.id);
    setRodada(round.rodada ?? "");
    setParams({ payout: p.payout ? String(p.payout) : "", cpa_alvo: p.cpaAlvo ? String(p.cpaAlvo) : "", ics_por_venda: String(p.icsPorVenda ?? 8) });
    setData(draftFromRound(fase, round));
  }

  function newRound() {
    setRoundId(null);
    setRodada("");
    setData(emptyData(fase));
  }

  const numericParams = { payout: Number(params.payout) || 0, cpa_alvo: Number(params.cpa_alvo) || 0, ics_por_venda: Number(params.ics_por_venda) || 8 };
  const engineParams = paramsFrom(numericParams);
  const ready = engineParams.payout > 0 && engineParams.cpaAlvo > 0;
  const derived = ready ? deriveParams(engineParams) : null;
  const input = useMemo(() => engineData(fase, data), [fase, data]);
  const result = useMemo(() => evaluateRound(fase, numericParams, input), [fase, numericParams.payout, numericParams.cpa_alvo, numericParams.ics_por_venda, input]); // eslint-disable-line react-hooks/exhaustive-deps
  const p2Days = useMemo(() => ready && fase === "p2" ? evaluateP2Days(rowsOf(data, "dias").map((r) => ({ gasto: c(r, "gasto"), vendas: c(r, "vendas") })), engineParams) : [], [ready, fase, data, engineParams.payout, engineParams.cpaAlvo]); // eslint-disable-line react-hooks/exhaustive-deps

  const brake = fase === "p3" ? dailyBrake({ verba: textOf(data.verba), gastoOntem: textOf(data.gasto_ontem) }) : null;
  const checkpoint = ready && fase === "p2" ? p2Checkpoint(input.checkpoint as { gasto2d: number; ic: string; pageviews: string }, engineParams) : null;
  const placar = ready && fase === "p1" ? evaluateP1Round(rowsOf(data, "concepts").map((r) => ({ concept: c(r, "concept"), hipotese: c(r, "hipotese"), gasto: c(r, "gasto"), ic: c(r, "ic"), vendas: c(r, "vendas") })), engineParams) : null;

  function reading(table: string, row: Row, index: number): Reading | null {
    if (!ready || !filled(row)) return null;
    if (table === "concepts") return evaluateConcept({ gasto: c(row, "gasto"), ic: c(row, "ic"), vendas: c(row, "vendas") }, engineParams);
    if (table === "dias") return c(row, "gasto").trim() ? p2Days[index] ?? null : null;
    if (table === "conjuntos") { const r = evaluateAdset({ gasto: c(row, "gasto"), vendas: c(row, "vendas") }, engineParams); return { ...r, rotulo: `${r.rotulo} · ${ZONE_LABEL[r.zona]}` }; }
    if (table === "lances") { const r = bidStep({ lance: row.lance, cresceu: row.cresceu === "sim" ? true : row.cresceu === "nao" ? false : null }); return { veredito: row.cresceu === "sim" ? "rodando" : row.cresceu === "nao" ? "pausa" : "aguarda", rotulo: r.proximo_lance ? `→ ${money(r.proximo_lance)}` : row.cresceu === "nao" ? "PARA" : "48 h", acao: r.acao }; }
    if (table === "angulos") return fase === "p4"
      ? evaluateGraveyardAngle({ gasto7: c(row, "gasto7"), vendas7: c(row, "vendas7"), diasSeguidosNoCpa: c(row, "diasSeguidosNoCpa") })
      : evaluateActiveAngle({ gasto7: c(row, "gasto7"), vendas7: c(row, "vendas7"), diasSemGastar: c(row, "diasSemGastar") }, engineParams);
    return null;
  }

  function setCell(table: string, index: number, key: string, value: string) {
    setData((d) => ({ ...d, [table]: rowsOf(d, table).map((r, i) => (i === index ? { ...r, [key]: value } : r)) }));
  }

  async function pull() {
    if (!projectId) return;
    const days = PULL_DAYS[fase];
    const to = localDate(), from = addDays(to, -(days - 1));
    setPulling(true);
    try {
      const rows = await loadSpend(projectId, from, to);
      if (!rows.length) { toast.warning(`Sem dados de anúncio de ${from} a ${to}. O sync da conta de anúncio pode estar parado.`); return; }
      const adsets = spendByAdset(rows);
      const byDay = spendByDay(rows);
      setData((d) => {
        const next = { ...d };
        if (fase === "p1") {
          const old = new Map(rowsOf(d, "concepts").map((r) => [r.concept, r.hipotese]));
          next.concepts = adsets.slice(0, 10).map((a) => ({ concept: a.nome, hipotese: old.get(a.nome) ?? "", gasto: String(a.gasto), ic: String(a.ic), vendas: String(a.vendas) }));
        } else if (fase === "p2") {
          next.dias = byDay.slice(-6).map((day) => ({ gasto: String(day.gasto), vendas: String(day.vendas) }));
          next.conjuntos = adsets.slice(0, 10).map((a) => ({ nome: a.nome, gasto: String(a.gasto), vendas: String(a.vendas) }));
          next.checkpoint = { ...(d.checkpoint as Row), ic: String(byDay.slice(0, 2).reduce((s, day) => s + day.ic, 0)) };
        } else {
          const key = fase === "p3" ? "diasSemGastar" : "diasSeguidosNoCpa";
          const old = new Map(rowsOf(d, "angulos").map((r) => [r.nome, r[key]]));
          next.angulos = adsets.slice(0, 10).map((a) => ({ nome: a.nome, gasto7: String(a.gasto), vendas7: String(a.vendas), [key]: old.get(a.nome) ?? "" }));
          if (fase === "p3") next.gasto_ontem = String(byDay.find((day) => day.dia === addDays(to, -1))?.gasto ?? 0);
        }
        return next;
      });
      toast.success(`${rows.length} linhas do sync de anúncios (${from} a ${to}).`);
    } catch (e) {
      toast.error(`Falha ao puxar do Império: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setPulling(false);
    }
  }

  async function onSave() {
    if (!projectId) return;
    try {
      const id = await save.mutateAsync({ id: roundId, projectId, nodeId, fase, rodada, params: numericParams, data: input });
      setRoundId(id);
      toast.success("Rodada salva com o veredito.");
    } catch (e) {
      toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  if (!projectId) {
    return <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">Ligue a etapa a um projeto para lançar os números da esteira.</p>;
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3" data-testid="step-scale-ladder">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1 text-xs"><Gauge className="h-3.5 w-3.5" /> Esteira de Escala · {SCALE_PHASE_LABEL[fase]}</Label>
        {fase !== "parametros" && <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={newRound}><Plus className="h-3 w-3" /> Nova rodada</Button>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([["payout", "Payout"], ["cpa_alvo", "CPA alvo"], ["ics_por_venda", "ICs por venda"]] as const).map(([k, label]) => (
          <div key={k}>
            <Label className="text-[11px] text-muted-foreground">{label}</Label>
            <Input type="number" inputMode="decimal" aria-label={label} value={params[k]} onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))} className="h-8" />
          </div>
        ))}
      </div>
      {derived ? (
        <p className="text-[11px] text-muted-foreground">
          Teto por IC {money(derived.teto_custo_ic_qualificado)} · mais textos até {money(derived.teto_custo_ic_mais_textos)} · lance inicial P3 {money(derived.lance_inicial_p3)} · cost cap P4 {money(derived.cost_cap_p4)} · ROAS alvo {derived.roas_alvo ?? "—"}
        </p>
      ) : (
        <p className="text-[11px] text-warning">Preencha payout e CPA alvo para ver o veredito.</p>
      )}

      {fase !== "parametros" && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-[11px] text-muted-foreground">Rodada</Label>
            <Input value={rodada} placeholder="ex.: S41 · concepts inchaço" onChange={(e) => setRodada(e.target.value)} className="h-8" />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={pulling} onClick={pull} title={`Gasto, checkouts e compras dos últimos ${PULL_DAYS[fase]} dias`}>
            <DownloadCloud className="h-3.5 w-3.5" /> {pulling ? "Puxando…" : "Puxar do Império"}
          </Button>
        </div>
      )}

      {fase === "p3" && (
        <div className="grid grid-cols-2 gap-2">
          {([["verba", "Verba hoje"], ["gasto_ontem", "Gasto de ontem"]] as const).map(([k, label]) => (
            <div key={k}>
              <Label className="text-[11px] text-muted-foreground">{label}</Label>
              <Input type="number" aria-label={label} value={textOf(data[k])} onChange={(e) => setData((d) => ({ ...d, [k]: e.target.value }))} className="h-8" />
            </div>
          ))}
          {brake && (
            <p className={cn("col-span-2 rounded border px-2 py-1 text-xs", tone(brake.freio === "verba" ? "rodando" : "mantem"))}>
              {brake.pct_verba_gasta}% da verba gasta · freio: {brake.freio}. {brake.acao}
            </p>
          )}
        </div>
      )}

      {TABLES[fase].map((t) => (
        <div key={t.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">{t.title}</span>
            <Button size="sm" variant="ghost" className="h-6 px-1 text-[11px]" onClick={() => setData((d) => ({ ...d, [t.key]: [...rowsOf(d, t.key), t.blank()] }))}>+ linha</Button>
          </div>
          {rowsOf(data, t.key).map((row, i) => {
            const r = reading(t.key, row, i);
            return (
              <div key={i} className="space-y-1 rounded border border-border/60 p-1.5">
                <div className="flex flex-wrap gap-1">
                  {t.key === "dias" && <span className="w-10 self-center text-[11px] text-muted-foreground">Dia {i + 1}</span>}
                  {t.cols.map((c) => c.kind === "yesno" ? (
                    <select key={c.key} aria-label={c.label} value={row[c.key]} onChange={(e) => setCell(t.key, i, c.key, e.target.value)} className="h-7 rounded border border-input bg-background px-1 text-xs">
                      <option value="">{c.label}</option><option value="sim">Sim</option><option value="nao">Não</option>
                    </select>
                  ) : (
                    <Input key={c.key} aria-label={c.label} placeholder={c.label} type={c.kind === "number" ? "number" : "text"} value={row[c.key]}
                      onChange={(e) => setCell(t.key, i, c.key, e.target.value)} className={cn("h-7 text-xs", c.wide ? "min-w-[10rem] flex-1 basis-full" : "w-[5.5rem]")} />
                  ))}
                </div>
                {r && (
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={cn("rounded border px-1.5 py-0.5 font-medium", tone(r.veredito))}>{r.rotulo}</span>
                    <span className="text-muted-foreground">{r.acao}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {fase === "p2" && (
        <div className="grid grid-cols-2 gap-2">
          {([["ic", "IC dos 2 primeiros dias"], ["pageviews", "Pageviews dos 2 primeiros dias"]] as const).map(([k, label]) => (
            <div key={k}>
              <Label className="text-[11px] text-muted-foreground">{label}</Label>
              <Input type="number" aria-label={label} value={((data.checkpoint ?? {}) as Row)[k] ?? ""} onChange={(e) => setData((d) => ({ ...d, checkpoint: { ...(d.checkpoint as Row), [k]: e.target.value } }))} className="h-8" />
            </div>
          ))}
          {checkpoint?.ic.leitura && (
            <p className="col-span-2 text-[11px] text-muted-foreground">Sinal do dia 2 (não decide): IC {checkpoint.ic.leitura}{checkpoint.pageview.leitura ? ` · pageview ${checkpoint.pageview.leitura}` : ""}.</p>
          )}
        </div>
      )}

      {placar && placar.placar_hipoteses.length > 0 && (
        <div className="space-y-1 rounded border border-border/60 p-2">
          <span className="flex items-center gap-1 text-[11px] font-medium"><Sparkles className="h-3 w-3" /> Placar de hipóteses</span>
          {placar.placar_hipoteses.map((h, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px]">
              <span className={cn("rounded border px-1.5 py-0.5 font-medium", tone(h.resultado === "confirmada" ? "qualificado" : h.resultado === "parcial" ? "mais_textos" : "morto"))}>{h.resultado.toUpperCase()}</span>
              <span>{h.hipotese}</span>
            </p>
          ))}
          <p className="text-[11px] text-subtle">{placar.regra}</p>
        </div>
      )}

      {result && fase !== "parametros" && <p className="text-xs">{roundSummary(fase, result)}</p>}

      <Button size="sm" className="w-full gap-1" disabled={save.isPending || !ready} onClick={onSave}>
        <Save className="h-3.5 w-3.5" /> {save.isPending ? "Salvando…" : roundId ? "Salvar rodada" : fase === "parametros" ? "Salvar parâmetros" : "Salvar nova rodada"}
      </Button>

      {!!stored?.rounds.length && fase !== "parametros" && (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">Histórico do projeto</span>
          {stored.rounds.map((round) => (
            <button key={round.id} type="button" onClick={() => openRound(round)}
              className={cn("block w-full rounded border px-2 py-1 text-left text-[11px] hover:bg-muted/40", round.id === roundId ? "border-primary/50" : "border-border/60")}>
              <span className="font-medium">{round.rodada || "Sem nome"}</span>
              <span className="text-muted-foreground"> · {new Date(round.updated_at).toLocaleDateString("pt-BR")} · {round.resumo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
