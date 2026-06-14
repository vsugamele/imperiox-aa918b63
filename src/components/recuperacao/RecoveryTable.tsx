import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, Mail, MessageCircle, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, type RecoveryItem } from "@/lib/recoveryBuckets";

interface RecoveryTableProps {
  items: RecoveryItem[];
  onSendWhatsApp: (item: RecoveryItem) => void;
  onSendEmail: (item: RecoveryItem) => void;
  onMarkRecovered: (item: RecoveryItem) => void;
  onMarkLost: (item: RecoveryItem) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function RecoveryTable({ items, onSendWhatsApp, onSendEmail, onMarkRecovered, onMarkLost }: RecoveryTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);

  // Reset to page 0 when items list changes substantially
  useEffect(() => {
    setPage(0);
  }, [items.length, pageSize]);

  const paged = useMemo(
    () => items.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [items, currentPage, pageSize],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        Nenhum item encontrado neste bucket agora.
      </div>
    );
  }

  const start = currentPage * pageSize + 1;
  const end = Math.min(items.length, start + paged.length - 1);

  return (
    <div className="space-y-3">
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
          {paged.map((item) => (
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Mostrando {start}–{end} de {items.length}</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-7 w-[88px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {opt} / pág
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPage(0)} disabled={currentPage === 0} aria-label="Primeira página">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-foreground">{currentPage + 1} / {totalPages}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPage(totalPages - 1)} disabled={currentPage >= totalPages - 1} aria-label="Última página">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
