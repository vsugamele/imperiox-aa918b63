import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { LeadRow, VendaRow, leadsForCohortCell, formatBRL } from "@/lib/cohortAnalysis";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortMonth: string | null;
  monthOffset: number | null;
  leads: LeadRow[];
  vendas: VendaRow[];
}

export function CohortDrillPanel({ open, onOpenChange, cohortMonth, monthOffset, leads, vendas }: Props) {
  if (!cohortMonth || monthOffset == null) return null;
  const items = leadsForCohortCell(leads, vendas, cohortMonth, monthOffset);
  const totalRev = items.reduce((s, i) => s + i.revenue, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-lg">
            Cohort {cohortMonth} · M{monthOffset}
          </SheetTitle>
          <SheetDescription>
            {items.length} {monthOffset === 0 ? "leads capturados" : "compradores no mês"} · Receita {formatBRL(totalRev)}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-140px)] mt-4 pr-4">
          <div className="space-y-2">
            {items.map(({ lead, revenue, vendas: vs }) => (
              <div key={lead.id} className="border border-border rounded-md p-3 hover:bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{lead.nome || lead.email || lead.phone || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                  </div>
                  {revenue > 0 && (
                    <Badge variant="outline" className="border-emerald-400/40 text-emerald-400 bg-emerald-400/10 shrink-0">
                      {formatBRL(revenue)}
                    </Badge>
                  )}
                </div>
                {vs.length > 0 && (
                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                    {vs.map((v) => (
                      <div key={v.id} className="flex justify-between">
                        <span className="truncate">{(v as any).data?.produto_nome || "Venda"}</span>
                        <span>{v.data_venda?.slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead nesta célula.</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
