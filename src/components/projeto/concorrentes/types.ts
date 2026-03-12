export interface Competitor {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  url: string;
  ponto_forte: string;
  fraqueza: string;
  canais_principais: string;
  nicho: string;
  sub_nicho: string;
  publico_alvo: string;
  mecanismo_unico: string;
  score_escala: number;
  score_max: number;
  canais_keywords: string[];
  headline: string;
  hook: string;
  cta: string;
  oferta_principal: string;
  preco: string;
  garantia: string;
  bonus: string;
  trafego_est: string;
  ads_ativos: boolean;
  importado_em: string | null;
  stack_tecnologico: string[];
  paginas_funil: string[];
  insights: string;
  screenshot_url: string;
  color: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const COMPETITOR_COLORS = [
  "#c9922a", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
  "#e67e22", "#1abc9c", "#f39c12", "#d35400", "#8e44ad",
];
