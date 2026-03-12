import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { Competitor } from "./types";

interface Props {
  competitors: Competitor[];
  updateField: (id: string, field: string, value: any) => void;
  removeCompetitor: (id: string) => void;
}

const FIELDS: { key: keyof Competitor; label: string }[] = [
  { key: "oferta_principal", label: "Oferta Principal" },
  { key: "preco", label: "Preço" },
  { key: "garantia", label: "Garantia" },
  { key: "bonus", label: "Bônus" },
];

export function OfertaTab({ competitors, updateField, removeCompetitor }: Props) {
  if (!competitors.length) return <p className="text-muted-foreground text-sm p-4">Nenhum concorrente adicionado.</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px] text-xs uppercase tracking-wider text-primary/80">Campo</TableHead>
            {competitors.map(c => (
              <TableHead key={c.id} className="min-w-[180px]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-sm font-semibold flex-1">{c.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeCompetitor(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {FIELDS.map(f => (
            <TableRow key={f.key}>
              <TableCell className="font-medium text-xs uppercase tracking-wider text-primary/80">{f.label}</TableCell>
              {competitors.map(c => (
                <TableCell key={c.id}>
                  <Input
                    value={(c[f.key] as string) || ""}
                    onChange={e => updateField(c.id, f.key, e.target.value)}
                    className="h-7 text-xs bg-secondary border-none"
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
