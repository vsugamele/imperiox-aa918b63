// Veredito simplificado por campanha — variante leve do Yoshitani 7/5/3
// Usado inline no /gerenciador. Versão mais robusta vive em FinancasAds.tsx.

export type Verdict = "ESCALAR" | "MANTER" | "OTIMIZAR" | "MATAR" | "AGUARDAR" | "—";

export interface VerdictResult {
  verdict: Verdict;
  reason: string;
}

export function computeVerdict(args: {
  valor: number;          // gasto no período
  compras: number;
  receita: number;        // receita atribuída (utm)
  frequencia: number;
  ticketMedioGlobal?: number;
  marginTarget?: number;  // teto de CPA = ticket * marginTarget (default 0.4)
}): VerdictResult {
  const { valor, compras, receita, frequencia, ticketMedioGlobal = 0, marginTarget = 0.4 } = args;

  // Sem dados suficientes
  if (valor < 50 && compras === 0) {
    return { verdict: "AGUARDAR", reason: "Amostra insuficiente (gasto < R$50 e zero compras)." };
  }

  const cpa = compras > 0 ? valor / compras : Infinity;
  const roas = valor > 0 ? receita / valor : 0;
  const metaCpa = ticketMedioGlobal > 0 ? ticketMedioGlobal * marginTarget : 0;

  // Critérios de MATAR
  if (valor >= 200 && compras === 0) {
    return { verdict: "MATAR", reason: `Gastou R$${valor.toFixed(0)} sem nenhuma venda.` };
  }
  if (metaCpa > 0 && cpa > metaCpa * 2.5) {
    return { verdict: "MATAR", reason: `CPA (R$${cpa.toFixed(0)}) > 2.5× meta (R$${metaCpa.toFixed(0)}).` };
  }
  if (frequencia > 5) {
    return { verdict: "MATAR", reason: `Frequência ${frequencia.toFixed(1)} indica saturação severa.` };
  }

  // ESCALAR
  if (roas >= 2.5 && compras >= 3 && frequencia < 3) {
    return { verdict: "ESCALAR", reason: `ROAS ${roas.toFixed(2)}x com ${compras} vendas. Frequência saudável.` };
  }
  if (metaCpa > 0 && cpa > 0 && cpa < metaCpa * 0.7 && compras >= 3) {
    return { verdict: "ESCALAR", reason: `CPA (R$${cpa.toFixed(0)}) muito abaixo da meta. Hora de escalar.` };
  }

  // OTIMIZAR
  if (metaCpa > 0 && cpa > metaCpa * 1.3) {
    return { verdict: "OTIMIZAR", reason: `CPA 30%+ acima da meta. Mexer em criativo/público.` };
  }
  if (roas > 0 && roas < 1) {
    return { verdict: "OTIMIZAR", reason: `ROAS ${roas.toFixed(2)}x abaixo do ponto de equilíbrio.` };
  }
  if (frequencia > 3.5) {
    return { verdict: "OTIMIZAR", reason: `Frequência ${frequencia.toFixed(1)} alta. Renovar criativo.` };
  }

  // MANTER (default quando há vendas e está saudável)
  if (compras > 0) {
    return { verdict: "MANTER", reason: `Performance dentro da meta. Manter.` };
  }
  return { verdict: "AGUARDAR", reason: "Sem vendas ainda. Monitorar." };
}

export function verdictColor(v: Verdict): string {
  switch (v) {
    case "ESCALAR": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "MANTER":  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "OTIMIZAR":return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "MATAR":   return "bg-red-500/15 text-red-400 border-red-500/30";
    case "AGUARDAR":return "bg-muted text-muted-foreground border-border/40";
    default:        return "bg-muted text-muted-foreground border-border/40";
  }
}
