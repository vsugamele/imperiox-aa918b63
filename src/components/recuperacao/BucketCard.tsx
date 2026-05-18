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

interface BucketCardProps {
  bucket: RecoveryBucketSummary;
  active?: boolean;
  disabledAutomate?: boolean;
  onSelect: () => void;
  onAutomate: () => void;
}

export function BucketCard({ bucket, active, disabledAutomate, onSelect, onAutomate }: BucketCardProps) {
  const Icon = bucketIcons[bucket.id];

  return (
    <Card className={`border-border bg-card transition-colors ${active ? "border-primary" : "hover:border-primary/40"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4 text-primary" />
              {bucket.shortTitle}
            </CardTitle>
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

        <div className="flex gap-2">
          <Button variant={active ? "default" : "outline"} size="sm" className="flex-1" onClick={onSelect}>
            Ver itens
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onAutomate} disabled={disabledAutomate}>
            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
            Automatizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
