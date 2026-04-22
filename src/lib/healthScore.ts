// Health Score do projeto: 0-100 combinando 4 fatores.
// - ROAS (peso 30): >=2.0 = 100, 0 = 0
// - Conversão lead→venda (peso 25): >=10% = 100
// - Atividade (peso 25): vendas últimos 7d (>=5 = 100)
// - Frequência conteúdo (peso 20): conteúdos últimos 14d (>=4 = 100)

export interface HealthInput {
  roas?: number;            // receita/gasto últimos 30d
  leadsRecent?: number;     // leads últimos 30d
  vendasRecent?: number;    // vendas aprovadas últimos 30d
  vendas7d?: number;        // vendas aprovadas últimos 7d
  conteudos14d?: number;    // peças de conteúdo criadas últimos 14d
}

export interface HealthBreakdown {
  score: number;
  roasScore: number;
  conversaoScore: number;
  atividadeScore: number;
  conteudoScore: number;
  conversao: number;
  status: "critico" | "atencao" | "saudavel" | "excelente";
  statusLabel: string;
  cor: string;
}

export function calcHealthScore(i: HealthInput): HealthBreakdown {
  const roas = i.roas ?? 0;
  const leads = i.leadsRecent ?? 0;
  const vendas = i.vendasRecent ?? 0;
  const v7 = i.vendas7d ?? 0;
  const c14 = i.conteudos14d ?? 0;

  const roasScore = Math.max(0, Math.min(100, (roas / 2) * 100));
  const conversao = leads > 0 ? (vendas / leads) * 100 : 0;
  const conversaoScore = Math.max(0, Math.min(100, (conversao / 10) * 100));
  const atividadeScore = Math.max(0, Math.min(100, (v7 / 5) * 100));
  const conteudoScore = Math.max(0, Math.min(100, (c14 / 4) * 100));

  const score = Math.round(
    roasScore * 0.3 + conversaoScore * 0.25 + atividadeScore * 0.25 + conteudoScore * 0.2
  );

  let status: HealthBreakdown["status"] = "critico";
  let statusLabel = "Crítico";
  let cor = "text-red-400";
  if (score >= 80) { status = "excelente"; statusLabel = "Excelente"; cor = "text-emerald-400"; }
  else if (score >= 60) { status = "saudavel"; statusLabel = "Saudável"; cor = "text-emerald-400"; }
  else if (score >= 40) { status = "atencao"; statusLabel = "Atenção"; cor = "text-amber-400"; }

  return { score, roasScore, conversaoScore, atividadeScore, conteudoScore, conversao, status, statusLabel, cor };
}
