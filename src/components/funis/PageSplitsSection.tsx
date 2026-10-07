import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCopy, FlaskConical, Plus, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { MIN_VISITAS } from "@shared/page-split";
import { useCreatePageSplit, useEndPageSplit, usePageSplits, type PageSplit } from "@/hooks/usePageSplits";

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success("Link copiado: use no anúncio"); } catch { toast.error("Não consegui copiar"); }
}

/** Testes A/B/C de página do projeto: um link único no anúncio, a divisão pelo peso e a leitura por variante. */
export function PageSplitsSection({ projectId }: { projectId: string }) {
  const { data: splits = [] } = usePageSplits(projectId);
  const [creating, setCreating] = useState(false);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Testes de página">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><FlaskConical className="h-4 w-4" /> Testes de página (A/B/C)</h3>
        {!creating && <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="mr-1 h-3.5 w-3.5" /> Novo teste</Button>}
      </div>
      {creating && <NewSplitForm projectId={projectId} onDone={() => setCreating(false)} />}
      {!splits.length && !creating && <p className="text-xs text-muted-foreground">Nenhum teste de página. Crie um, cole o link no anúncio e o tráfego se divide entre as páginas.</p>}
      {splits.map((s) => <SplitCard key={s.id} split={s} />)}
    </section>
  );
}

function NewSplitForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const create = useCreatePageSplit();
  const [nome, setNome] = useState("");
  const [rows, setRows] = useState([{ url: "", peso: 1 }, { url: "", peso: 1 }]);
  const set = (i: number, patch: Partial<{ url: string; peso: number }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const submit = () => create.mutate({ projectId, nome, variantes: rows }, {
    onSuccess: (link) => { copy(link); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do teste (ex.: CCP página de vendas)" aria-label="Nome do teste" />
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 font-mono text-xs font-semibold text-primary">{String.fromCharCode(65 + i)}</span>
          <Input value={r.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="https://…" aria-label={`Página ${String.fromCharCode(65 + i)}`} className="flex-1" />
          <Input type="number" min={0} value={r.peso} onChange={(e) => set(i, { peso: Number(e.target.value) })} aria-label={`Peso ${String.fromCharCode(65 + i)}`} className="w-20" />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {rows.length < 3 && <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, { url: "", peso: 1 }])}>+ Página C</Button>}
        <Button size="sm" onClick={submit} disabled={create.isPending}>Criar e copiar link</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">As páginas precisam do rastreador do Império para medir visitas e cliques. A pessoa volta sempre para a mesma página.</p>
    </div>
  );
}

function SplitCard({ split }: { split: PageSplit }) {
  const end = useEndPageSplit();
  const r = split.report;
  const ativo = split.status === "ativo";
  return (
    <motion.article layout className="space-y-2 rounded-md border border-border p-3" aria-label={`Teste ${split.nome}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">{split.nome}</div>
          <div className="text-[11px] text-muted-foreground">{ativo ? `${r.totalEnviados} pessoas enviadas` : `Encerrado${split.vencedor ? ` · tudo vai para a ${split.vencedor}` : ""}`}</div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copy(split.link)}><ClipboardCopy className="mr-1 h-3.5 w-3.5" /> Link</Button>
          {ativo && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={end.isPending}
              onClick={() => end.mutate({ id: split.id, vencedor: r.vencedor }, { onSuccess: () => toast.success(r.vencedor ? `Encerrado: o link agora manda tudo para a ${r.vencedor}` : "Teste encerrado") })}>
              <X className="mr-1 h-3.5 w-3.5" /> Encerrar{r.vencedor ? ` (fica a ${r.vencedor})` : ""}
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-[10px] uppercase text-muted-foreground">
            <tr><th className="py-1 pr-2 font-medium">Página</th><th className="px-2 font-medium">Peso</th><th className="px-2 font-medium">Enviados</th><th className="px-2 font-medium">Visitas</th><th className="px-2 font-medium">Cliques</th><th className="px-2 font-medium">Checkouts</th><th className="px-2 font-medium">Conversão</th></tr>
          </thead>
          <tbody className="font-mono">
            {r.linhas.map((l) => (
              <tr key={l.key} className={cn("border-t border-border", (r.vencedor === l.key || split.vencedor === l.key) && "text-success")}>
                <td className="max-w-[260px] py-1.5 pr-2 font-sans"><span className="mr-1 font-semibold">{l.key}</span><span className="truncate text-muted-foreground" title={l.url}>{l.url.replace(/^https?:\/\//, "")}</span>{(r.vencedor === l.key || split.vencedor === l.key) && <Trophy className="ml-1 inline h-3 w-3" />}</td>
                <td className="px-2">{l.peso}</td>
                <td className="px-2">{l.enviados}</td>
                <td className="px-2">{l.visitas ?? "—"}</td>
                <td className="px-2">{l.cliques ?? "—"}</td>
                <td className="px-2">{l.checkouts ?? "—"}</td>
                <td className="px-2">{l.conversao === null ? "—" : `${l.conversao}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {r.leitura}{r.semRastreador.length ? ` Sem rastreador: ${r.semRastreador.join(", ")}.` : ""} Mínimo de {MIN_VISITAS} visitas por página e 20% de vantagem para declarar vencedora.
      </p>
    </motion.article>
  );
}
