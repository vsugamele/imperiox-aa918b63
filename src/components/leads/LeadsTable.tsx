import React from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, AlertCircle } from "lucide-react";
import { parseISO, isValid, format } from "date-fns";

interface LeadVenda {
  id: string; produto_nome?: string; valor: number; plataforma?: string; status?: string; data?: any; created_at?: string;
}

interface Lead {
  id: string; nome?: string; phone?: string; email?: string; project_id?: string;
  funil_id?: string; plataforma?: string; status?: string; score?: number;
  tags?: string[]; total_gasto?: number; data?: any; criado_em?: string; updated_at?: string;
  _isNew?: boolean; _vendas?: LeadVenda[]; _score?: number;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  lead_capturado: { label: "Lead", color: "bg-blue-500/20 text-blue-400" },
  carrinho_abandonado: { label: "Carrinho", color: "bg-amber-500/20 text-amber-400" },
  pix_gerado: { label: "Pix Gerado", color: "bg-yellow-500/20 text-yellow-400" },
  aguardando_pagamento: { label: "Aguardando", color: "bg-orange-500/20 text-orange-400" },
  compra_aprovada: { label: "Compra ✓", color: "bg-emerald-500/20 text-emerald-400" },
  reembolso: { label: "Reembolso", color: "bg-destructive/20 text-destructive" },
};

function getLeadStage(lead: Lead): string {
  if (lead.status === "cliente") return "compra_aprovada";
  return (lead.data as any)?.ultimo_evento || "lead_capturado";
}

function getLeadReferenceDate(lead: Lead): string | null {
  const data = (lead.data as any) || {};
  const interacoes = Array.isArray(data.interacoes) ? data.interacoes : [];
  const lastInteraction = interacoes.length > 0 ? interacoes[interacoes.length - 1]?.data : null;
  return data.ultimo_evento_em || lastInteraction || lead.updated_at || lead.criado_em || null;
}

interface Props {
  leads: Lead[];
  projects: any[];
  captureForms: { id: string; name: string }[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allFilteredSelected: boolean;
  onEditLead: (lead: Lead) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export default function LeadsTable({
  leads, projects, captureForms, selectedIds, onToggleSelect, onToggleSelectAll,
  allFilteredSelected, onEditLead, page, totalPages, totalCount, pageSize, loading, onPageChange,
}: Props) {
  return (
    <>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allFilteredSelected} onCheckedChange={onToggleSelectAll} /></TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Formulário</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Estágio</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Receita</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => {
              const stage = getLeadStage(l);
              const cfg = STAGE_LABELS[stage] || STAGE_LABELS.lead_capturado;
              const isPending = ["carrinho_abandonado", "pix_gerado", "aguardando_pagamento"].includes(stage);
              const proj = projects.find((p: any) => p.id === l.project_id);
              const formName = (l.data as any)?.form_name;
              const formId = (l.data as any)?.form_id;
              const vendas = (l._vendas || []) as any[];
              const tipoMap: Record<string, string> = { orderbump: "OB", upsell: "UP", downsell: "DS" };
              const tipoCls: Record<string, string> = { orderbump: "bg-amber-500/20 text-amber-400 border-amber-500/30", upsell: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", downsell: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
              const pgto = vendas.find((v: any) => v.data?.metodo_pagamento)?.data?.metodo_pagamento;
              const ultimoProduto = (l.data as any)?.ultimo_produto;
              // Receita: usa total_gasto se houver, senão soma vendas aprovadas como fallback
              const APROVADOS = ["aprovado","aprovada","approved","paid","pago","completed","complete","succeeded"];
              const totalGastoNum = l.total_gasto != null ? parseFloat(String(l.total_gasto)) : 0;
              const vendasAprovadasTotal = vendas
                .filter((v: any) => APROVADOS.includes(String(v.status || "").toLowerCase()))
                .reduce((acc: number, v: any) => acc + (parseFloat(String(v.valor || 0)) || 0), 0);
              const receitaExibir = totalGastoNum > 0 ? totalGastoNum : vendasAprovadasTotal;

              return (
                <TableRow key={l.id} className={cn("cursor-pointer hover:bg-secondary/50 transition-all", l._isNew && "animate-pulse bg-emerald-500/10 ring-1 ring-emerald-500/30", selectedIds.has(l.id) && "bg-primary/5")} onClick={() => onEditLead({ ...l })}>
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(l.id)} onCheckedChange={() => onToggleSelect(l.id)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 bg-secondary"><AvatarFallback className="text-xs font-bold bg-secondary text-foreground">{(l.nome || "?")[0].toUpperCase()}</AvatarFallback></Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">{l.nome}</p>
                          {l._isNew && <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">NOVO</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] text-muted-foreground">{l.email || "—"}</p>
                          {l.tags && l.tags.slice(0, 2).map(t => <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 h-3.5 leading-none">{t}</Badge>)}
                          {l.tags && l.tags.length > 2 && <span className="text-[8px] text-muted-foreground">+{l.tags.length - 2}</span>}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{proj ? <span className="text-xs text-muted-foreground truncate max-w-[100px] block">{proj.icon || "📁"} {proj.name}</span> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{(() => { if (formName) return <span className="text-xs text-muted-foreground truncate max-w-[120px] block" title={formName}>📋 {formName}</span>; if (formId) { const cf = captureForms.find(f => f.id === formId); return cf ? <span className="text-xs text-muted-foreground truncate max-w-[120px] block" title={cf.name}>📋 {cf.name}</span> : <span className="text-xs text-muted-foreground">📋 Form</span>; } return <span className="text-xs text-muted-foreground">—</span>; })()}</TableCell>
                  <TableCell>{vendas.length === 0 ? (ultimoProduto ? <span className="text-xs text-muted-foreground truncate max-w-[140px] block" title={ultimoProduto}>{ultimoProduto}</span> : <span className="text-xs text-muted-foreground">—</span>) : <div className="flex flex-col gap-0.5 max-w-[140px]">{vendas.slice(0, 3).map((v: any, i: number) => { const badge = tipoMap[v.tipo_venda]; return <div key={i} className="flex items-center gap-1"><span className="text-xs text-primary truncate" title={v.produto_nome}>{v.produto_nome || "—"}</span>{badge && <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5 leading-none border", tipoCls[v.tipo_venda])}>{badge}</Badge>}</div>; })}{vendas.length > 3 && <span className="text-[10px] text-muted-foreground">+{vendas.length - 3} mais</span>}</div>}</TableCell>
                  <TableCell>{pgto ? <span className="text-[10px] text-muted-foreground">{pgto}</span> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell><div className="flex items-center gap-1"><Badge className={cn("text-[10px]", cfg.color, isPending && "animate-pulse ring-1 ring-amber-500/40")}>{cfg.label}</Badge>{isPending && <AlertCircle className="h-3 w-3 text-amber-400" />}</div></TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${l._score || 0}%` }} /></div><span className="text-[10px] font-mono text-muted-foreground">{l._score || 0}</span></div></TableCell>
                  <TableCell className="font-mono text-sm text-primary">{l.total_gasto ? `R$ ${parseFloat(String(l.total_gasto)).toFixed(0)}` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(() => { const refDate = getLeadReferenceDate(l); if (!refDate) return "—"; try { const d = parseISO(refDate); return isValid(d) ? format(d, "dd/MM/yy HH:mm") : "—"; } catch { return "—"; } })()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {l.phone && <Button size="icon" variant="ghost" asChild className="h-7 w-7"><a href={`https://wa.me/${(() => { const d = l.phone!.replace(/\D/g, ""); return d.startsWith("55") ? d : "55" + d; })()}`} target="_blank" rel="noopener"><MessageCircle className="h-4 w-4 text-emerald-400" /></a></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount} leads</p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)}>Anterior</Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) { pageNum = i; }
              else if (page < 4) { pageNum = i; }
              else if (page > totalPages - 5) { pageNum = totalPages - 7 + i; }
              else { pageNum = page - 3 + i; }
              return <Button key={pageNum} size="sm" variant={pageNum === page ? "default" : "outline"} className="h-8 w-8 text-xs p-0" onClick={() => onPageChange(pageNum)}>{pageNum + 1}</Button>;
            })}
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page >= totalPages - 1 || loading} onClick={() => onPageChange(page + 1)}>Próximo</Button>
          </div>
        </div>
      )}
    </>
  );
}

export { getLeadStage, STAGE_LABELS };
export type { Lead, LeadVenda };
