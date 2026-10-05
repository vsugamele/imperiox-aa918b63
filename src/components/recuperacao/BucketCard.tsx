import { AlertTriangle, ArrowRightLeft, BellRing, Loader2, Receipt, RotateCcw, Send, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, type RecoveryBucketSummary } from "@/lib/recoveryBuckets";

const bucketIcons = {
  pix_urgent: AlertTriangle,
  pix_cooling: BellRing,
  boleto_due: Receipt,
  abandoned_cart: ShoppingCart,
  refunds: RotateCcw,
} as const;

const bucketTouchMeta: Record<string, { label: string; className: string }> = {
  pix_urgent: { label: "Toque 1 (15m)", className: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  pix_cooling: { label: "Toque 2 (2h)", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  boleto_due: { label: "Toque Boleto", className: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  abandoned_cart: { label: "Régua 15m–24h", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  refunds: { label: "Feedback", className: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
};

interface BucketCardProps {
  bucket: RecoveryBucketSummary;
  active?: boolean;
  disabledAutomate?: boolean;
  dispatching?: boolean;
  onSelect: () => void;
  onAutomate: () => void;
  onDispatch?: () => void;
}

export function BucketCard({ bucket, active, disabledAutomate, dispatching, onSelect, onAutomate, onDispatch }: BucketCardProps) {
  const Icon = bucketIcons[bucket.id];
  const touch = bucketTouchMeta[bucket.id];
  const canDispatch = !!onDispatch && bucket.items.length > 0 && bucket.id !== "refunds";

  return (
    <Card className={`border-border bg-card transition-colors ${active ? "border-primary" : "hover:border-primary/40"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-primary" />
                {bucket.shortTitle}
              </CardTitle>
              {touch && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${touch.className}`}>
                  {touch.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{bucket.description}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {bucket.items.length} itens
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(bucket.totalValue)}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recuperação</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{bucket.recoveryRate}%</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={active ? "default" : "outline"} size="sm" className="flex-1 min-w-[80px]" onClick={onSelect}>
            Ver itens
          </Button>
          <Button variant="outline" size="sm" className="flex-1 min-w-[80px]" onClick={onAutomate} disabled={disabledAutomate}>
            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
            Automatizar
          </Button>
          {canDispatch && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 min-w-[125px] bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={onDispatch}
              disabled={disabledAutomate || dispatching}
              title="Dispara mensagem com Pix Copia e Cola e link respeitando a trava anti-duplicação"
            >
              {dispatching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Disparar Régua IA
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
