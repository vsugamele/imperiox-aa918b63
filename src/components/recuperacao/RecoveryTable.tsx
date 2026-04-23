import { ExternalLink, Mail, MessageCircle, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, type RecoveryItem } from "@/lib/recoveryBuckets";

interface RecoveryTableProps {
  items: RecoveryItem[];
  onSendWhatsApp: (item: RecoveryItem) => void;
  onSendEmail: (item: RecoveryItem) => void;
  onMarkRecovered: (item: RecoveryItem) => void;
  onMarkLost: (item: RecoveryItem) => void;
}

export function RecoveryTable({ items, onSendWhatsApp, onSendEmail, onMarkRecovered, onMarkLost }: RecoveryTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        Nenhum item encontrado neste bucket agora.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Tempo no bucket</TableHead>
          <TableHead>Último contato</TableHead>
          <TableHead className="w-[320px]">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{item.leadName}</p>
                <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  {item.email && <span>{item.email}</span>}
                  {item.phone && <span>{item.phone}</span>}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <p className="text-sm text-foreground">{item.product}</p>
                {item.paymentLink && <Badge variant="outline" className="text-[10px]">Link disponível</Badge>}
              </div>
            </TableCell>
            <TableCell className="font-medium text-foreground">{item.value > 0 ? formatCurrency(item.value) : "—"}</TableCell>
            <TableCell className="text-muted-foreground">{item.ageLabel}</TableCell>
            <TableCell>
              {item.lastContact ? (
                <span className="text-xs text-foreground">{item.lastContact}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Sem contato</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onSendWhatsApp(item)} disabled={!item.phone}>
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSendEmail(item)} disabled={!item.email}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => onMarkRecovered(item)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Recuperado
                </Button>
                <Button size="sm" variant="outline" onClick={() => onMarkLost(item)}>
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Perdido
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={`/leads?lead=${item.leadId || ""}`}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    CRM
                  </a>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
