import { getLeadStage, STAGE_LABELS } from "@/components/leads/lead-stages";
import { record } from "@/lib/funis-data";
import type { Tables, Json } from "@/integrations/supabase/types";
import React from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import LeadActionsMenu from "./LeadActionsMenu";
import { parseISO, isValid, format } from "date-fns";


interface LeadVenda {
  id: string; tipo_venda?:string; produto_nome?: string; valor: number; plataforma?: string; status?: string; data?: Json; created_at?: string;
}

interface Lead {
  id: string; nome?: string; phone?: string; email?: string; project_id?: string;
  funil_id?: string; plataforma?: string; status?: string; score?: number;
  tags?: string[]; total_gasto?: number; data?: Json; criado_em?: string; updated_at?: string;
  _isNew?: boolean; _vendas?: LeadVenda[]; _score?: number;
}


function getLeadReferenceDate(lead: Lead): string | null {
  const data = record(lead.data) || {};
  const interacoes = Array.isArray(data.interacoes) ? data.interacoes : [];
  const lastInteraction = interacoes.length > 0 ? record(interacoes[interacoes.length - 1]).data : null;
  const date = data.ultimo_evento_em || lastInteraction || lead.updated_at || lead.criado_em;
  return typeof date === "string" ? date : null;
}

function getScoreBreakdown(lead: Lead): { items: { label: string; pts: number }[]; total: number } {
  const items: { label: string; pts: number }[] = [];
  const vendas = lead._vendas || [];
  if (lead.email) items.push({ label: "Email cadastrado", pts: 10 });
  if (lead.phone) items.push({ label: "Telefone cadastrado", pts: 5 });
  if (vendas.length > 0) items.push({ label: "Cliente (1+ compra)", pts: 30 });
  if (vendas.length > 1) items.push({ label: "Recorrência (2+ compras)", pts: 20 });
  const utms = record(lead.data)?.utms;
  if (utms && Object.values(utms).some(Boolean)) items.push({ label: "UTM rastreado", pts: 5 });
  const total = Math.min(items.reduce((s, i) => s + i.pts, 0), 100);
  return { items, total };
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-400";
  if (score >= 15) return "bg-orange-400";
  return "bg-muted-foreground/40";
}



interface Props {
  leads: Lead[];
  projects: Array<{id:string;name:string;icon?:string}>;
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
  automations?: Array<Pick<Tables<"imphq_automacoes">,"id"|"nome">>;
}

export default function LeadsTable({
  leads, projects, captureForms, selectedIds, onToggleSelect, onToggleSelectAll,
  allFilteredSelected, onEditLead, page, totalPages, totalCount, pageSize, loading, onPageChange, automations = [],
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
              const proj = projects.find((p) => p.id === l.project_id);
              const formName = String(record(l.data).form_name || "");
              const formId = String(record(l.data).form_id || "");
              const vendas = (l._vendas || []);
              const tipoMap: Record<string, string> = { orderbump: "OB", upsell: "UP", downsell: "DS" };
              const tipoCls: Record<string, string> = { orderbump: "bg-amber-500/20 text-amber-400 border-amber-500/30", upsell: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", downsell: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
              const pgto = vendas
                .map((v) => record(v.data).metodo_pagamento ?? record(v.data).payment_method ?? record(v.data).payment_type ?? record(v.data).forma_pagamento ?? record(record(v.data).payment).method ?? record(record(v.data).payment).type)
                .find((m) => m && String(m).trim().length > 0);
              const ultimoProduto = String(record(l.data).ultimo_produto || "");
              // Receita: usa total_gasto se houver, senão soma vendas aprovadas como fallback
              const APROVADOS = ["aprovado","aprovada","approved","paid","pago","completed","complete","succeeded"];
              const totalGastoNum = l.total_gasto != null ? parseFloat(String(l.total_gasto)) : 0;
              const vendasAprovadasTotal = vendas
                .filter((v) => APROVADOS.includes(String(v.status || "").toLowerCase()))
                .reduce((acc: number, v) => acc + (parseFloat(String(v.valor || 0)) || 0), 0);
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
                  <TableCell>{vendas.length === 0 ? (ultimoProduto ? <span className="text-xs text-muted-foreground truncate max-w-[140px] block" title={ultimoProduto}>{ultimoProduto}</span> : <span className="text-xs text-muted-foreground">—</span>) : <div className="flex flex-col gap-0.5 max-w-[140px]">{vendas.slice(0, 3).map((v, i: number) => { const badge = tipoMap[v.tipo_venda]; return <div key={i} className="flex items-center gap-1"><span className="text-xs text-primary truncate" title={v.produto_nome}>{v.produto_nome || "—"}</span>{badge && <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5 leading-none border", tipoCls[v.tipo_venda])}>{badge}</Badge>}</div>; })}{vendas.length > 3 && <span className="text-[10px] text-muted-foreground">+{vendas.length - 3} mais</span>}</div>}</TableCell>
                  <TableCell>{pgto ? <span className="text-[10px] text-muted-foreground">{String(pgto)}</span> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell><div className="flex items-center gap-1"><Badge className={cn("text-[10px]", cfg.color, isPending && "animate-pulse ring-1 ring-amber-500/40")}>{cfg.label}</Badge>{isPending && <AlertCircle className="h-3 w-3 text-amber-400" />}</div></TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>{(() => {
                    const bd = getScoreBreakdown(l);
                    const score = l._score ?? bd.total;
                    return (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 cursor-help">
                              <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full", scoreColor(score))} style={{ width: `${score}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">{score}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="bg-secondary/95 border-border max-w-[240px]">
                            <p className="text-[11px] font-bold mb-1.5">Score: {score}/100</p>
                            {bd.items.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">Sem pontos atribuídos.</p>
                            ) : (
                              <div className="space-y-0.5">
                                {bd.items.map((it, i) => (
                                  <div key={i} className="flex items-center justify-between gap-3 text-[10px]">
                                    <span className="text-muted-foreground">{it.label}</span>
                                    <span className="font-mono text-primary">+{it.pts}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-[9px] text-muted-foreground mt-1.5 italic">Score recalculado pelo trigger ao mudar lead/venda.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })()}</TableCell>

                  <TableCell className="font-mono text-sm text-primary">{receitaExibir > 0 ? `R$ ${receitaExibir.toFixed(0)}` : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(() => { const refDate = getLeadReferenceDate(l); if (!refDate) return "—"; try { const d = parseISO(refDate); return isValid(d) ? format(d, "dd/MM/yy HH:mm") : "—"; } catch { return "—"; } })()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <LeadActionsMenu lead={l} automations={automations} />
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


export type { Lead, LeadVenda };
