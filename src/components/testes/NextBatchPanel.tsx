import { useState } from "react";
import { Check, Layers, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { CARGAS, PORTAS } from "@shared/hw-taxonomy";
import type { LevaItem } from "@shared/batch-strategist";
import { useLevaAction, usePlanLeva, useSavedLevas, type LevaPreview } from "@/hooks/useBatchStrategist";
import { useProjectsAndMaps } from "@/hooks/usePlaybooks";

const BLOCO_LABEL: Record<LevaItem["bloco"], string> = { variacao: "Variação do vencedor", angulo_novo: "Ângulo novo", formato_novo: "Formato novo" };
const STATUS_LABEL: Record<string, string> = { planejado: "Aguardando aprovação", aprovado: "Aprovada", descartado: "Descartada" };

/** Estrategista (OPS1.3): monta a próxima leva de criativos a partir da biblioteca, do mercado e do placar. Não gera arte. */
export function NextBatchPanel() {
  const { data: targets } = useProjectsAndMaps();
  const { data: levas = [] } = useSavedLevas();
  const plan = usePlanLeva();
  const action = useLevaAction();
  const [projectId, setProjectId] = useState("");
  const [tamanho, setTamanho] = useState(20);
  const [preview, setPreview] = useState<LevaPreview | null>(null);
  const projectName = (id: string) => targets?.projects.find((p) => p.id === id)?.name ?? id;

  const montar = () => plan.mutate({ project_id: projectId, tamanho }, { onSuccess: setPreview, onError: (e) => toast.error(errorMessage(e)) });
  const salvar = () => action.mutate({ modo: "salvar", project_id: projectId, tamanho }, {
    onSuccess: () => { toast.success("Leva salva para aprovação"); setPreview(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Próxima leva">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Layers className="h-4 w-4" /> Próxima leva</h2>
        <span className="text-[11px] text-muted-foreground">Cruza a biblioteca de ângulos, o que o mercado roda e o placar. Só planeja: gerar arte é outro passo.</span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-48" aria-label="Projeto da leva"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>{(targets?.projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" min={5} max={40} value={tamanho} onChange={(e) => setTamanho(Number(e.target.value) || 20)} className="h-9 w-20" aria-label="Tamanho da leva" />
        <Button size="sm" onClick={montar} disabled={!projectId || plan.isPending}>
          {plan.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Layers className="mr-1 h-3.5 w-3.5" />} Montar leva
        </Button>
        {preview && <Button size="sm" variant="outline" onClick={salvar} disabled={action.isPending}><Save className="mr-1 h-3.5 w-3.5" /> Salvar para aprovação</Button>}
      </div>

      {preview && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {preview.tamanho} criativos · {preview.composicao.variacao} variações · {preview.composicao.angulo_novo} ângulos novos · {preview.composicao.formato_novo} formatos novos
            · base: {preview.contexto.referencias} referências do mercado, {preview.contexto.testados} anúncios testados
          </p>
          {preview.avisos.map((a) => <p key={a} className="text-xs text-warning">{a}</p>)}
          <LevaTable itens={preview.itens} />
        </div>
      )}

      {levas.length > 0 && (
        <ul className="divide-y divide-border">
          {levas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-xs" aria-label={`Leva ${l.nome}`}>
              <span className="rounded border border-border px-1.5 text-[10px] uppercase text-muted-foreground">{projectName(l.project_id)}</span>
              <span className="font-medium text-foreground">{l.nome}</span>
              <span className={cn("text-muted-foreground", l.status === "aprovado" && "text-success")}>{STATUS_LABEL[l.status] ?? l.status}</span>
              {l.status === "planejado" && (
                <span className="ml-auto flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={action.isPending} onClick={() => action.mutate({ modo: "aprovar", leva_id: l.id }, { onSuccess: () => toast.success("Leva aprovada"), onError: (e) => toast.error(errorMessage(e)) })}><Check className="mr-1 h-3.5 w-3.5" /> Aprovar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={action.isPending} onClick={() => action.mutate({ modo: "descartar", leva_id: l.id })}><X className="mr-1 h-3.5 w-3.5" /> Descartar</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LevaTable({ itens }: { itens: LevaItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-[11px] uppercase text-muted-foreground">
          <tr><th className="py-1 pr-2 font-medium">#</th><th className="px-2 font-medium">Bloco</th><th className="px-2 font-medium">Ângulo</th><th className="px-2 font-medium">Formato</th><th className="px-2 font-medium">Porta</th><th className="px-2 font-medium">Ponto</th><th className="px-2 font-medium">Carga</th><th className="px-2 font-medium">Hipótese</th></tr>
        </thead>
        <tbody>
          {itens.map((i, idx) => (
            <tr key={`${i.bloco}-${idx}`} className="border-t border-border align-top">
              <td className="py-1.5 pr-2 font-mono text-muted-foreground">{String(idx + 1).padStart(2, "0")}</td>
              <td className="px-2 text-muted-foreground">{BLOCO_LABEL[i.bloco]}</td>
              <td className="px-2 text-foreground">{i.angulo}</td>
              <td className="px-2">{i.formato_label}{i.precisa_video ? " (vídeo)" : ""}</td>
              <td className="px-2">{PORTAS[i.porta]}</td>
              <td className="px-2">{i.ponto_rota}</td>
              <td className="px-2">{CARGAS[i.carga]}</td>
              <td className="px-2 text-muted-foreground" title={i.motivo}>{i.hipotese}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
