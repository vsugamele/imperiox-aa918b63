import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface Offer {
  nicho: string;
  subNicho?: string;
  microNicho?: string;
  dorCentral?: string;
  nomeOferta: string;
  ticket?: string;
  bump?: string;
  upsell?: string;
  semAparecer?: string;
  score: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offers: Offer[];
}

export function NicheComparator({ open, onOpenChange, offers }: Props) {
  const rows: Array<{ label: string; key: keyof Offer; cmp?: "max" }> = [
    { label: "Nicho", key: "nicho" },
    { label: "Micro-nicho", key: "microNicho" },
    { label: "Dor central", key: "dorCentral" },
    { label: "Ticket", key: "ticket" },
    { label: "Bump", key: "bump" },
    { label: "Upsell", key: "upsell" },
    { label: "Sem rosto", key: "semAparecer" },
    { label: "Score", key: "score", cmp: "max" },
  ];

  const winnerScore = Math.max(...offers.map(o => o.score || 0));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto bg-secondary/40">
        <SheetHeader>
          <SheetTitle>Comparativo de nichos ({offers.length})</SheetTitle>
        </SheetHeader>
        {offers.length < 2 ? (
          <p className="mt-6 text-sm text-muted-foreground">Selecione 2 a 4 ofertas para comparar.</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-border/30">
            <table className="w-full text-sm leading-7">
              <thead>
                <tr className="bg-secondary/60">
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Atributo</th>
                  {offers.map((o, i) => (
                    <th key={i} className="text-left px-3 py-2 text-xs font-medium max-w-[220px]" title={o.nomeOferta}>
                      {o.nomeOferta}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={String(r.key)} className="border-t border-border/20 align-top">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.label}</td>
                    {offers.map((o, i) => {
                      const v = (o as any)[r.key];
                      const isWinner = r.cmp === "max" && v === winnerScore;
                      if (r.key === "score") {
                        return (
                          <td key={i} className={`px-3 py-2 ${isWinner ? "text-primary font-bold" : ""}`}>
                            <Badge variant="outline" className={isWinner ? "border-primary/50 text-primary" : ""}>{v}</Badge>
                          </td>
                        );
                      }
                      return <td key={i} className="px-3 py-2 text-foreground/90">{v || "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
