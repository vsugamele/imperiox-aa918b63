import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Venda {
  id: string;
  produto_nome?: string | null;
  valor?: number | null;
  data_venda?: string | null;
  utm_campaign?: string | null;
  plataforma?: string;
}

interface Props {
  vendas: Venda[];
}

export function AttributionDiagnostic({ vendas }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const stats = useMemo(() => {
    const total = vendas.length;
    if (total === 0) return null;
    const semUtm = vendas.filter((v) => !v.utm_campaign);
    const comUtm = vendas.filter((v) => !!v.utm_campaign);
    const valorPerdido = semUtm.reduce((s, v) => s + Number(v.valor || 0), 0);
    const pct = Math.round((semUtm.length / total) * 100);
    return { total, semUtm, comUtm, valorPerdido, pct };
  }, [vendas]);

  if (!stats || stats.semUtm.length === 0) return null;

  const severity = stats.pct >= 50 ? "destructive" : stats.pct >= 20 ? "amber" : "muted";
  const tone =
    severity === "destructive"
      ? "border-destructive/40 bg-destructive/5"
      : severity === "amber"
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-border/40 bg-secondary/20";

  return (
    <>
      <Card className={`${tone} border`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  severity === "destructive"
                    ? "text-destructive"
                    : severity === "amber"
                    ? "text-amber-400"
                    : "text-muted-foreground"
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">
                    Atribuição quebrada
                  </span>
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    {stats.semUtm.length}/{stats.total} ({stats.pct}%)
                  </Badge>
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    R$ {stats.valorPerdido.toFixed(2)} sem origem
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-5">
                  {stats.semUtm.length} venda{stats.semUtm.length > 1 ? "s" : ""} no período sem{" "}
                  <code className="text-[10px] px-1 py-0.5 rounded bg-secondary">utm_campaign</code>
                  . Isso impede medir ROAS real e atribuir receita à campanha certa.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setShowHelp(true)} className="h-7 text-[11px]">
                Como corrigir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded((e) => !e)}
                className="h-7 text-[11px]"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" /> Esconder
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" /> Ver vendas
                  </>
                )}
              </Button>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-border/40 max-h-[280px] overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="text-muted-foreground sticky top-0 bg-background/80 backdrop-blur">
                  <tr>
                    <th className="text-left py-1 font-medium">Data</th>
                    <th className="text-left py-1 font-medium">Produto</th>
                    <th className="text-left py-1 font-medium">Plataforma</th>
                    <th className="text-right py-1 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.semUtm.slice(0, 50).map((v) => (
                    <tr key={v.id} className="border-t border-border/20 hover:bg-secondary/20">
                      <td className="py-1.5 tabular-nums">
                        {v.data_venda
                          ? new Date(v.data_venda).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="py-1.5 truncate max-w-[260px]" title={v.produto_nome || ""}>
                        {v.produto_nome || "—"}
                      </td>
                      <td className="py-1.5 text-muted-foreground">{v.plataforma || "—"}</td>
                      <td className="py-1.5 text-right tabular-nums font-mono">
                        R$ {Number(v.valor || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stats.semUtm.length > 50 && (
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Mostrando 50 de {stats.semUtm.length}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl bg-secondary/40 backdrop-blur">
          <DialogHeader>
            <DialogTitle>Como corrigir a atribuição</DialogTitle>
            <DialogDescription className="leading-7">
              Para que o webhook receba <code>utm_campaign</code>, a página de checkout precisa
              propagar os UTMs da URL. O ImperioHQ já extrai do <code>xcod</code>, <code>src</code>{" "}
              e <code>sck</code> automaticamente — você só precisa configurar a origem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-7">
            <div>
              <p className="font-bold text-foreground mb-1">1. Use o Tracker do ImperioHQ</p>
              <p className="text-muted-foreground">
                Em todas as páginas/VSLs, use o link <code>/tracker?to=URL_CHECKOUT</code> — ele
                codifica os macros do Meta (campanha, adset, ad) no <code>xcod</code> e repassa
                para o checkout.
              </p>
            </div>

            <div>
              <p className="font-bold text-foreground mb-1">2. Ticto</p>
              <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                <li>
                  Configurações do produto → ative <strong>"Receber UTMs"</strong>
                </li>
                <li>
                  No link do produto, adicione:{" "}
                  <code className="text-[10px]">?xcod=&#123;&#123;campaign.name&#125;&#125;%7C&#123;&#123;adset.name&#125;&#125;%7C&#123;&#123;ad.name&#125;&#125;</code>
                </li>
                <li>O webhook v2.0 já entrega no campo <code>tracking</code></li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-foreground mb-1">3. Hotmart</p>
              <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                <li>
                  Use <code>?src=&#123;&#123;campaign.name&#125;&#125;</code> + UTMs no link do
                  produto
                </li>
                <li>
                  Em "Configurações de checkout" ative{" "}
                  <strong>"Manter parâmetros UTM"</strong>
                </li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-foreground mb-1">4. Validar</p>
              <p className="text-muted-foreground">
                Faça uma compra de teste com{" "}
                <code>?utm_campaign=teste&xcod=teste%7Ctest_adset%7Ctest_ad</code>. A venda deve
                aparecer aqui com a campanha correta em até 30s.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button asChild variant="outline" size="sm">
              <a href="/tracker" target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir Tracker
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
