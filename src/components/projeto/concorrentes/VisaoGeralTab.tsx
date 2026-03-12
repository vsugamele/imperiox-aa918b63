import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Competitor } from "./types";

interface Props {
  competitors: Competitor[];
  updateField: (id: string, field: string, value: any) => void;
}

const FIELDS: { key: keyof Competitor; label: string }[] = [
  { key: "url", label: "URL / Site" },
  { key: "ponto_forte", label: "Ponto Forte" },
  { key: "fraqueza", label: "Fraqueza" },
  { key: "canais_principais", label: "Canais Principais" },
  { key: "nicho", label: "Nicho" },
  { key: "sub_nicho", label: "Sub-nicho" },
  { key: "publico_alvo", label: "Público-alvo" },
  { key: "mecanismo_unico", label: "Mecanismo Único" },
];

export function VisaoGeralTab({ competitors, updateField }: Props) {
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
                  <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                  <Input
                    value={c.name}
                    onChange={e => updateField(c.id, "name", e.target.value)}
                    className="h-7 text-xs font-semibold bg-secondary border-none"
                  />
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
