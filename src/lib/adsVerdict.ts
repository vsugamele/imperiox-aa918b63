// Veredito simplificado por campanha — variante leve do Yoshitani 7/5/3
// Usado inline no /gerenciador. Versão mais robusta vive em FinancasAds.tsx.

export type Verdict = "ESCALAR" | "MANTER" | "OTIMIZAR" | "MATAR" | "AGUARDAR" | "—";

export interface VerdictResult {
  verdict: Verdict;
  reason: string;
}

export interface ComputeVerdictArgs {
  valor: number;          // gasto no período
  compras: number;
  receita: number;        // receita atribuída (utm)
  frequencia: number;
  cliques?: number;
  ticketMedioGlobal?: number;
  marginTarget?: number;  // teto de CPA = ticket * marginTarget (default 0.4)
  cpaTarget?: number;     // CPA alvo explícito (opcional)
  status?: string | null; // status da entidade (ACTIVE, PAUSED)
}

export function computeVerdict(args: ComputeVerdictArgs): VerdictResult {
  const {
    valor,
    compras,
    receita,
    frequencia,
    cliques = 0,
    ticketMedioGlobal = 0,
    marginTarget = 0.4,
    cpaTarget,
  } = args;

  const cpa = compras > 0 ? valor / compras : Infinity;
  const roas = valor > 0 ? receita / valor : 0;

  // Determina CPA alvo: parâmetro explícito > ticket * margem > fallback de R$ 50
  const metaCpa = cpaTarget && cpaTarget > 0
    ? cpaTarget
    : (ticketMedioGlobal > 0 ? ticketMedioGlobal * marginTarget : 50);

  // 1. CRITÉRIOS DE MATAR (SANGRANDO - PAUSAR)
  // Gasto > 1.5x CPA-alvo sem nenhuma venda (estancar sangramento)
  if (compras === 0 && valor >= metaCpa * 1.5) {
    return {
      verdict: "MATAR",
      reason: `Sangrando: gastou R$ ${valor.toFixed(0)} sem vendas (> 1.5× CPA-alvo de R$ ${metaCpa.toFixed(0)}). Pausar para estancar sangramento.`,
    };
  }
  // Gasto com vendas, mas CPA explodiu > 2.5x da meta
  if (compras > 0 && cpa > metaCpa * 2.5) {
    return {
      verdict: "MATAR",
      reason: `CPA crítico (R$ ${cpa.toFixed(0)}) > 2.5× a meta de R$ ${metaCpa.toFixed(0)}. Pausar imediatamente.`,
    };
  }
  // Saturação severa
  if (frequencia > 5) {
    return {
      verdict: "MATAR",
      reason: `Frequência ${frequencia.toFixed(1)} indica saturação severa do público.`,
    };
  }

  // 2. CRITÉRIOS DE AGUARDAR (EM VALIDAÇÃO)
  // Menos de 50 cliques ou gasto abaixo do limite de teste (1.5x CPA) sem vendas ainda
  if (compras === 0) {
    if (cliques < 50 && valor < metaCpa * 1.5) {
      return {
        verdict: "AGUARDAR",
        reason: `Em validação: ${cliques} cliques e R$ ${valor.toFixed(0)} investidos (meta R$ ${metaCpa.toFixed(0)}). Amostra inicial em maturação.`,
      };
    }
    if (valor < 50) {
      return {
        verdict: "AGUARDAR",
        reason: `Em validação: gasto inicial de R$ ${valor.toFixed(0)}. Aguardar mais dados.`,
      };
    }
  }

  // 3. CRITÉRIOS DE ESCALAR (CAMPEÕES)
  // Pelo menos 2 vendas, CPA abaixo da meta e ROAS > 2.0x
  if (compras >= 2 && roas >= 2.0 && cpa <= metaCpa) {
    return {
      verdict: "ESCALAR",
      reason: `Campeão: ROAS ${roas.toFixed(2)}x com ${compras} vendas e CPA saudável (R$ ${cpa.toFixed(0)} vs meta R$ ${metaCpa.toFixed(0)}). Escalar orçamento.`,
    };
  }
  // ROAS muito alto mesmo com CPA próximo da meta
  if (compras >= 2 && roas >= 2.5 && frequencia < 3.5) {
    return {
      verdict: "ESCALAR",
      reason: `Campeão: ROAS ${roas.toFixed(2)}x excelente com ${compras} vendas e frequência saudável (${frequencia.toFixed(1)}). Escalar.`,
    };
  }
  // CPA muito barato (< 70% da meta)
  if (compras >= 2 && cpa > 0 && cpa <= metaCpa * 0.7) {
    return {
      verdict: "ESCALAR",
      reason: `Campeão: CPA R$ ${cpa.toFixed(0)} muito abaixo da meta (R$ ${metaCpa.toFixed(0)}). Pronto para escala.`,
    };
  }

  // 4. CRITÉRIOS DE OTIMIZAR
  if (compras > 0 && cpa > metaCpa * 1.3) {
    return {
      verdict: "OTIMIZAR",
      reason: `CPA (R$ ${cpa.toFixed(0)}) está 30%+ acima da meta (R$ ${metaCpa.toFixed(0)}). Otimizar público ou criativo.`,
    };
  }
  if (roas > 0 && roas < 1.0) {
    return {
      verdict: "OTIMIZAR",
      reason: `ROAS ${roas.toFixed(2)}x abaixo do ponto de equilíbrio (1.0x). Ajustar oferta/página.`,
    };
  }
  if (frequencia > 3.5) {
    return {
      verdict: "OTIMIZAR",
      reason: `Frequência ${frequencia.toFixed(1)} alta. Público começando a saturar, renovar criativos.`,
    };
  }

  // 5. MANTER (padrão quando há vendas e saúde)
  if (compras > 0) {
    return {
      verdict: "MANTER",
      reason: `Performance saudável: ${compras} vendas com ROAS ${roas.toFixed(2)}x e CPA R$ ${cpa.toFixed(0)}. Manter ativo.`,
    };
  }

  return {
    verdict: "AGUARDAR",
    reason: "Sem dados suficientes para conclusão. Continuar monitorando.",
  };
}

export function verdictColor(v: Verdict): string {
  switch (v) {
    case "ESCALAR": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "MANTER":  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "OTIMIZAR":return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "MATAR":   return "bg-red-500/15 text-red-400 border-red-500/30";
    case "AGUARDAR":return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    default:        return "bg-muted text-muted-foreground border-border/40";
  }
}
