import { record } from "@/lib/funis-data";
export const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  lead_capturado: { label: "Lead", color: "bg-blue-500/20 text-blue-400" },
  carrinho_abandonado: { label: "Carrinho", color: "bg-amber-500/20 text-amber-400" },
  pix_gerado: { label: "Pix Gerado", color: "bg-yellow-500/20 text-yellow-400" },
  aguardando_pagamento: { label: "Aguardando", color: "bg-orange-500/20 text-orange-400" },
  compra_aprovada: { label: "Compra ✓", color: "bg-emerald-500/20 text-emerald-400" },
  reembolso: { label: "Reembolso", color: "bg-destructive/20 text-destructive" },
};

export function getLeadStage(lead: {status?:string;data?:unknown}): string {
  if (lead.status === "cliente") return "compra_aprovada";
  return String(record(lead.data).ultimo_evento || "lead_capturado");
}

