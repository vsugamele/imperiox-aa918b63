import { useState } from "react";
import { Loader2, Pickaxe, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { useAddMiningSource, useMiningSources, useRunMiningSource, useToggleMiningSource, type MiningSource } from "@/hooks/useMiningSources";
import { useProjectsAndMaps } from "@/hooks/usePlaybooks";

const TIPO_LABEL = { palavra: "Palavra-chave", pagina: "Página (concorrente)", url: "Link da Biblioteca" } as const;

/** Mineração diária da Biblioteca de Anúncios (REF2.2): o que buscar, por projeto, e o resultado da última rodada. */
export function MiningSources() {
  const { data: sources = [] } = useMiningSources();
  const { data: targets } = useProjectsAndMaps();
  const add = useAddMiningSource();
  const [projectId, setProjectId] = useState("");
  const [tipo, setTipo] = useState<"palavra" | "pagina" | "url">("palavra");
  const [valor, setValor] = useState("");
  const [pais, setPais] = useState("BR");
  const projectName = (id: string) => targets?.projects.find((p) => p.id === id)?.name ?? id;

  const submit = () => add.mutate({ project_id: projectId, tipo, valor, pais, limite: 15 }, {
    onSuccess: () => { toast.success("Fonte adicionada: entra na rodada diária das 6h"); setValor(""); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Mineração">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Pickaxe className="h-4 w-4" /> Mineração diária (Biblioteca de Anúncios)</h3>
        <span className="text-[11px] text-muted-foreground">Todo dia às 6h: pega os anúncios há mais tempo no ar e com mais variações, guarda a mídia e manda para o pipeline.</span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-44" aria-label="Projeto da fonte"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>{(targets?.projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
          <SelectTrigger className="h-9 w-48" aria-label="Tipo de fonte"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(TIPO_LABEL) as Array<keyof typeof TIPO_LABEL>).map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === "palavra" ? "ex.: weight loss drink" : "link da página ou da busca"} className="h-9 min-w-[200px] flex-1" aria-label="Valor da fonte" />
        {tipo === "palavra" && (
          <Select value={pais} onValueChange={setPais}>
            <SelectTrigger className="h-9 w-20" aria-label="País"><SelectValue /></SelectTrigger>
            <SelectContent>{["BR", "US", "PT", "ALL"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Button size="sm" onClick={submit} disabled={!projectId || add.isPending}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar</Button>
      </div>

      {sources.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma fonte ainda.</p> : (
        <ul className="divide-y divide-border">
          {sources.map((s) => <SourceRow key={s.id} source={s} projectName={projectName(s.project_id)} />)}
        </ul>
      )}
    </section>
  );
}

function SourceRow({ source: s, projectName }: { source: MiningSource; projectName: string }) {
  const run = useRunMiningSource();
  const toggle = useToggleMiningSource();
  const r = (s.ultimo_resultado ?? {}) as { encontrados?: number; gravados?: number; erro?: string };
  return (
    <li className={cn("flex flex-wrap items-center gap-2 py-2 text-xs", !s.ativo && "opacity-60")} aria-label={`Fonte ${s.valor}`}>
      <span className="rounded border border-border px-1.5 text-[10px] uppercase text-muted-foreground">{projectName}</span>
      <span className="font-medium text-foreground">{s.tipo === "palavra" ? `"${s.valor}" · ${s.pais}` : s.valor}</span>
      <span className="text-muted-foreground">
        {s.ultima_execucao ? (r.erro ? `erro na última rodada: ${r.erro}` : `última: ${new Date(s.ultima_execucao).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${r.encontrados ?? 0} vistos, ${r.gravados ?? 0} novos`) : "ainda não rodou"}
      </span>
      <span className="ml-auto flex gap-1.5">
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={run.isPending || !s.ativo}
          onClick={() => run.mutate(s.id, { onSuccess: (x) => toast.success(`${x.gravados ?? 0} referências novas`), onError: (e) => toast.error(errorMessage(e)) })}>
          {run.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />} Rodar agora
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggle.mutate({ id: s.id, ativo: !s.ativo })}>{s.ativo ? "Pausar" : "Ativar"}</Button>
      </span>
    </li>
  );
}
