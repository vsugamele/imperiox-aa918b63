import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, X, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { findItem, COLOR_TOKENS } from "./assetCatalog";
import { cn } from "@/lib/utils";

interface MirrorAsset {
  catId: string;
  itemId: string;
  motivo: string;
  prioridade?: "alta" | "media" | "baixa";
}

interface HackResult {
  dossie?: {
    promessa_central?: string;
    mecanismo_unico?: string;
    ofertas_detectadas?: Array<{ tipo: string; nome: string; preco: string }>;
    garantia?: string;
    provas_sociais?: string[];
    urgencia?: string;
    estrutura_pagina?: string;
  };
  gaps_identificados?: string[];
  angulo_contra_ataque?: string;
  ativos_espelho?: MirrorAsset[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  product: any;
  onAddAsset: (catId: string, itemId: string) => void;
}

export function FunnelHackingDialog({ open, onClose, projectId, product, onAddAsset }: Props) {
  const [urls, setUrls] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HackResult | null>(null);

  const updateUrl = (i: number, v: string) => {
    const next = [...urls];
    next[i] = v;
    setUrls(next);
  };
  const addUrl = () => urls.length < 3 && setUrls([...urls, ""]);
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i));

  const run = async () => {
    const cleaned = urls.map(u => u.trim()).filter(Boolean);
    if (!cleaned.length) {
      toast.error("Adicione ao menos 1 URL");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("funnel-hacking-auto", {
        body: { project_id: projectId, product, urls: cleaned },
      });
      if (error) throw error;
      setResult((data as any)?.result || {});
      toast.success("Análise concluída");
    } catch (e: any) {
      toast.error(e?.message || "Erro no scraping/análise");
    } finally {
      setLoading(false);
    }
  };

  const prioColor = (p?: string) =>
    p === "alta" ? "text-red-300 bg-red-500/15 border-red-500/40" :
    p === "media" ? "text-amber-300 bg-amber-500/15 border-amber-500/40" :
                    "text-sky-300 bg-sky-500/15 border-sky-500/40";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl bg-secondary/40 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Search className="h-4 w-4 text-pink-400" />
            Funnel Hacking — Clonar Concorrente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-5">
              Cole até 3 URLs do funil do concorrente (LP, VSL, checkout). A IA extrai promessa, oferta, gaps e sugere ativos espelho.
            </p>
            {urls.map((u, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={u}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  placeholder="https://concorrente.com/oferta"
                  className="text-xs"
                />
                {urls.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => removeUrl(i)} className="h-9 w-9 flex-shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              {urls.length < 3 && (
                <Button size="sm" variant="outline" onClick={addUrl} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar URL
                </Button>
              )}
              <Button size="sm" onClick={run} disabled={loading} className="ml-auto bg-pink-600 hover:bg-pink-500">
                {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                Analisar concorrente
              </Button>
            </div>
          </div>

          {result && (
            <div className="space-y-4 pt-2 border-t border-border/40">
              {result.dossie && (
                <div className="rounded-xl border border-pink-500/40 bg-pink-500/5 p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-pink-300 font-semibold">Dossiê</p>
                  {result.dossie.promessa_central && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Promessa central</p>
                      <p className="text-sm leading-6 text-foreground">{result.dossie.promessa_central}</p>
                    </div>
                  )}
                  {result.dossie.mecanismo_unico && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Mecanismo único</p>
                      <p className="text-sm leading-6 text-foreground">{result.dossie.mecanismo_unico}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {result.dossie.estrutura_pagina && (
                      <div className="bg-secondary/30 rounded p-2">
                        <p className="text-[9px] text-muted-foreground uppercase">Estrutura</p>
                        <p className="text-foreground/90">{result.dossie.estrutura_pagina}</p>
                      </div>
                    )}
                    {result.dossie.urgencia && (
                      <div className="bg-secondary/30 rounded p-2">
                        <p className="text-[9px] text-muted-foreground uppercase">Urgência</p>
                        <p className="text-foreground/90">{result.dossie.urgencia}</p>
                      </div>
                    )}
                    {result.dossie.garantia && (
                      <div className="bg-secondary/30 rounded p-2 col-span-2">
                        <p className="text-[9px] text-muted-foreground uppercase">Garantia</p>
                        <p className="text-foreground/90">{result.dossie.garantia}</p>
                      </div>
                    )}
                  </div>
                  {result.dossie.ofertas_detectadas && result.dossie.ofertas_detectadas.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Ofertas detectadas</p>
                      <div className="space-y-1">
                        {result.dossie.ofertas_detectadas.map((o, i) => (
                          <div key={i} className="text-xs bg-secondary/30 rounded p-2">
                            <span className="text-pink-300 font-semibold uppercase text-[9px]">{o.tipo}</span>
                            {" — "}{o.nome} <span className="text-emerald-300">{o.preco}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.angulo_contra_ataque && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Ângulo de contra-ataque</p>
                  </div>
                  <p className="text-xs text-foreground/90 leading-6">{result.angulo_contra_ataque}</p>
                </div>
              )}

              {result.gaps_identificados && result.gaps_identificados.length > 0 && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Gaps do concorrente (= nossas oportunidades)</p>
                  <ul className="space-y-1">
                    {result.gaps_identificados.map((g, i) => (
                      <li key={i} className="text-xs text-foreground/90 leading-5 flex gap-2">
                        <span className="text-emerald-400 font-bold">⚠</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ativos_espelho && result.ativos_espelho.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-foreground font-semibold">Ativos espelho para clonar</p>
                  <div className="grid grid-cols-2 gap-2">
                    {result.ativos_espelho.map((a, i) => {
                      const meta = findItem(a.catId, a.itemId);
                      if (!meta) return null;
                      const colors = COLOR_TOKENS[meta.cat.color];
                      return (
                        <div key={i} className={cn("rounded-lg border bg-secondary/20 p-2.5 space-y-1.5", colors.border)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className={cn("text-[9px] uppercase tracking-wider font-semibold", colors.text)}>{meta.cat.label}</p>
                              <p className="text-xs font-semibold text-foreground leading-tight">{meta.item.label}</p>
                            </div>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-bold flex-shrink-0", prioColor(a.prioridade))}>
                              {(a.prioridade || "media").toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-4">{a.motivo}</p>
                          <Button
                            size="sm" variant="outline" className="h-6 w-full text-[10px] gap-1"
                            onClick={() => { onAddAsset(a.catId, a.itemId); toast.success("Adicionado ao canvas"); }}
                          >
                            <Plus className="h-3 w-3" /> Adicionar ao hub
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
