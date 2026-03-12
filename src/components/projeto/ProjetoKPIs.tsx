import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KPI_FIELDS = [
  { key: "cpl", label: "Custo por Lead (CPL)", prefix: "R$" },
  { key: "cac", label: "CAC", prefix: "R$" },
  { key: "roi", label: "ROI", suffix: "%" },
  { key: "roas", label: "ROAS", suffix: "x" },
  { key: "ticket_medio", label: "Ticket Médio", prefix: "R$" },
  { key: "ltv", label: "LTV", prefix: "R$" },
  { key: "taxa_conversao", label: "Taxa de Conversão", suffix: "%" },
  { key: "leads_mes", label: "Leads / Mês" },
];

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
}

export function ProjetoKPIs({ project, onUpdateData }: Props) {
  const data = project.data || {};
  const kpis = data.kpis || {};

  const update = (key: string, val: string) => {
    onUpdateData({ ...data, kpis: { ...kpis, [key]: val } });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📊 KPIs do Projeto</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <div className="relative">
              {f.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{f.prefix}</span>}
              <Input
                value={kpis[f.key] || ""}
                onChange={(e) => update(f.key, e.target.value)}
                className={`bg-secondary font-mono ${f.prefix ? "pl-8" : ""} ${f.suffix ? "pr-8" : ""}`}
              />
              {f.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{f.suffix}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
