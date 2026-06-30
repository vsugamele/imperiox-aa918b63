import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  product: any;
  coreOffer?: string;
}

export function TripwireEngineDialog({ open, onClose, projectId, product, coreOffer }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("tripwire-engine", {
        body: { project_id: projectId, product, core_offer: coreOffer },
      });
      if (error) throw error;
      setResult((data as any)?.result || {});
      toast.success("Tripwire gerado");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-secondary/40 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Zap className="h-4 w-4 text-amber-400" />
            Engine de Tripwire — Oferta de Entrada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40">
            <div className="text-xs leading-5">
              <p className="text-muted-foreground">Core do funil</p>
              <p className="text-foreground font-medium">{coreOffer || product?.nome || product?.name || "—"}</p>
            </div>
            <Button onClick={run} disabled={loading} size="sm" className="bg-amber-600 hover:bg-amber-500">
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
              {result ? "Gerar outro" : "Gerar Tripwire"}
            </Button>
          </div>

          {result && (
            <div className="space-y-3">
              {result.nome_escolhido && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Nome</p>
                  <p className="text-lg font-cormorant text-foreground">{result.nome_escolhido.nome}</p>
                  <p className="text-xs text-muted-foreground leading-5">{result.nome_escolhido.justificativa}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {result.formato && <Field label="Formato" value={result.formato} />}
                {result.quick_win && <Field label="Quick win" value={result.quick_win} />}
                {result.preco?.valor && <Field label="Preço" value={`R$ ${result.preco.valor} — ${result.preco.ancora || ""}`} />}
                {result.diagnostico_escada && <Field label="Posição na escada" value={result.diagnostico_escada} />}
              </div>

              {result.copy && (
                <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-foreground font-semibold">Copy da página</p>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => copy("copy", JSON.stringify(result.copy, null, 2))}>
                      {copied === "copy" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copiar tudo
                    </Button>
                  </div>
                  {result.copy.headline && <p className="text-base font-cormorant text-foreground leading-7">{result.copy.headline}</p>}
                  {result.copy.subheadline && <p className="text-xs text-muted-foreground leading-6">{result.copy.subheadline}</p>}
                  {result.copy.corpo && <p className="text-xs text-foreground/90 leading-6 whitespace-pre-wrap">{result.copy.corpo}</p>}
                  {Array.isArray(result.copy.empilhamento) && result.copy.empilhamento.length > 0 && (
                    <ul className="text-xs text-foreground/90 leading-6 list-disc pl-4">
                      {result.copy.empilhamento.map((e: string, i: number) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  {result.copy.garantia && <p className="text-[11px] text-emerald-300/90 leading-5">🛡 {result.copy.garantia}</p>}
                  {result.copy.cta && <p className="text-xs text-amber-300 font-semibold">→ {result.copy.cta}</p>}
                </div>
              )}

              {result.pagina_obrigado && (
                <details className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                  <summary className="text-[10px] uppercase tracking-wider text-foreground font-semibold cursor-pointer">Página de obrigado (TYP)</summary>
                  <p className="text-xs text-foreground/90 leading-6 whitespace-pre-wrap mt-2">{result.pagina_obrigado}</p>
                </details>
              )}

              {result.incompletude_estrategica && (
                <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-fuchsia-300 font-semibold mb-1">Ponte para o Core</p>
                  <p className="text-xs text-foreground/90 leading-6">{result.incompletude_estrategica}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/30 rounded p-2">
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
      <p className="text-foreground/90 leading-5">{value}</p>
    </div>
  );
}
