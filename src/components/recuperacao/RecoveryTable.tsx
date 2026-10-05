import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  MoreVertical,
  RotateCcw,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, type RecoveryItem } from "@/lib/recoveryBuckets";
import { toast } from "sonner";

interface RecoveryTableProps {
  items: RecoveryItem[];
  onDirectWhatsApp: (item: RecoveryItem) => Promise<void> | void;
  onSendWhatsApp: (item: RecoveryItem) => void;
  onSendEmail: (item: RecoveryItem) => void;
  onMarkRecovered: (item: RecoveryItem) => void;
  onMarkLost: (item: RecoveryItem) => void;
  dispatchingId?: string | null;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function RecoveryTable({
  items,
  onDirectWhatsApp,
  onSendWhatsApp,
  onSendEmail,
  onMarkRecovered,
  onMarkLost,
  dispatchingId,
}: RecoveryTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);

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

  const handleCopyPix = async (item: RecoveryItem) => {
    if (!item.pixCode) return;
    await navigator.clipboard.writeText(item.pixCode);
    setCopiedPixId(item.id);
    toast.success("Código Pix Copia e Cola copiado!");
    setTimeout(() => setCopiedPixId(null), 2500);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        Nenhum item encontrado neste bucket agora. Todos os leads estão em dia ou com venda aprovada!
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
            <TableHead>Produto & Pagamento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Régua / Tempo</TableHead>
            <TableHead>Último contato</TableHead>
            <TableHead className="w-[280px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((item) => {
            const isDispatching = dispatchingId === item.id;
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{item.leadName}</p>
                    <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                      {item.email && <span>{item.email}</span>}
                      {item.phone && <span>• {item.phone}</span>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm text-foreground">{item.product}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.pixCode && (
                        <button
                          type="button"
                          onClick={() => handleCopyPix(item)}
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="Clique para copiar código Pix"
                        >
                          {copiedPixId === item.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          Pix Copia e Cola
                        </button>
                      )}
                      {item.paymentLink && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Link disponível
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-foreground">{item.value > 0 ? formatCurrency(item.value) : "—"}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {item.touchLevel === 1 && (
                      <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-400 text-[10px]">
                        <Clock className="mr-1 h-3 w-3" /> Toque 1 (15m)
                      </Badge>
                    )}
                    {item.touchLevel === 2 && (
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]">
                        <Clock className="mr-1 h-3 w-3" /> Toque 2 (2h)
                      </Badge>
                    )}
                    {item.touchLevel === 3 && (
                      <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px]">
                        <AlertCircle className="mr-1 h-3 w-3" /> Toque 3 (Urgente)
                      </Badge>
                    )}
                    <p className="text-[11px] text-muted-foreground">{item.ageLabel}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {item.lastContact ? (
                    <span className="text-xs text-foreground">{item.lastContact}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem contato</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Botão Principal: 1-Clique WhatsApp direto */}
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-8 shadow-sm"
                      onClick={() => onDirectWhatsApp(item)}
                      disabled={!item.phone || isDispatching}
                      title="Dispara mensagem personalizada com Pix Copia e Cola e link direto pelo WhatsApp do projeto"
                    >
                      {isDispatching ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" />
                      )}
                      Disparar WhatsApp
                    </Button>

                    {/* Menu com ações complementares */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Mais opções</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onSendWhatsApp(item)} disabled={!item.phone}>
                          <MessageCircle className="mr-2 h-4 w-4 text-emerald-400" />
                          Abrir WhatsApp Web
                        </DropdownMenuItem>
                        {item.pixCode && (
                          <DropdownMenuItem onClick={() => handleCopyPix(item)}>
                            <Copy className="mr-2 h-4 w-4 text-emerald-400" />
                            Copiar Código Pix
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onSendEmail(item)} disabled={!item.email}>
                          <Mail className="mr-2 h-4 w-4 text-blue-400" />
                          Enviar Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onMarkRecovered(item)}>
                          <RotateCcw className="mr-2 h-4 w-4 text-emerald-500" />
                          Marcar Recuperado
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkLost(item)}>
                          <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                          Marcar Perdido
                        </DropdownMenuItem>
                        {item.leadId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <a href={`/leads?lead=${item.leadId}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Abrir no CRM
                              </a>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
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
