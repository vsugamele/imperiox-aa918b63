// Farm Health Score: 0-100 por conta de perfil (Instagram/TikTok/YouTube).
// Combina: idade (20), engajamento (25), alcance (20), warmup (20), risco (-, até -100).

export interface FarmAccount {
  data_criacao_conta?: string | null;
  seguidores?: number | null;
  engajamento_medio?: number | null;
  ultimo_alcance?: number | null;
  warmup_status?: string | null;
  warmup_days?: number | null;
  warmup_started_at?: string | null;
  sinais_risco?: string[] | null;
  status_venda?: string | null;
}

export interface FarmHealth {
  score: number;
  idadeScore: number;
  engScore: number;
  alcanceScore: number;
  warmupScore: number;
  riscoPenalty: number;
  status: "banido" | "critico" | "atencao" | "saudavel" | "excelente";
  statusLabel: string;
  cor: string;
  cor_bg: string;
  idadeDias: number | null;
  warmupDiasRestantes: number | null;
}

const WARMUP_META_DIAS = 21;

export function calcFarmHealth(a: FarmAccount): FarmHealth {
  const idadeDias = a.data_criacao_conta
    ? Math.floor((Date.now() - new Date(a.data_criacao_conta).getTime()) / 86400000)
    : null;

  // idade: 0d = 0, >=90d = 100
  const idadeScore = idadeDias === null ? 20 : Math.max(0, Math.min(100, (idadeDias / 90) * 100));

  // engajamento: >=5% = 100
  const eng = Number(a.engajamento_medio || 0);
  const engScore = Math.max(0, Math.min(100, (eng / 5) * 100));

  // alcance: escala relativa a seguidores; se >=30% dos seguidores = 100
  const seg = Number(a.seguidores || 0);
  const alc = Number(a.ultimo_alcance || 0);
  const alcanceScore = seg > 0 ? Math.max(0, Math.min(100, (alc / (seg * 0.3)) * 100)) : (alc > 0 ? 40 : 0);

  // warmup: pronto=100, aquecendo=proporcional, novo=20, pausado=40, banido=0
  const w = (a.warmup_status || "novo").toLowerCase();
  let warmupScore = 20;
  if (w === "pronto") warmupScore = 100;
  else if (w === "aquecendo") {
    const d = a.warmup_days || 0;
    warmupScore = Math.max(20, Math.min(90, (d / WARMUP_META_DIAS) * 100));
  } else if (w === "pausado") warmupScore = 40;
  else if (w === "banido") warmupScore = 0;

  // risco: cada sinal -20
  const riscos = Array.isArray(a.sinais_risco) ? a.sinais_risco : [];
  const riscoPenalty = Math.min(100, riscos.length * 20);

  const base = idadeScore * 0.20 + engScore * 0.25 + alcanceScore * 0.20 + warmupScore * 0.35;
  const raw = Math.round(base - riscoPenalty);
  const score = w === "banido" ? 0 : Math.max(0, Math.min(100, raw));

  let status: FarmHealth["status"] = "critico";
  let statusLabel = "Crítico";
  let cor = "text-red-400";
  let cor_bg = "bg-red-500/15 border-red-500/40";
  if (w === "banido") { status = "banido"; statusLabel = "Banido"; cor = "text-red-500"; cor_bg = "bg-red-500/25 border-red-500/60"; }
  else if (score >= 80) { status = "excelente"; statusLabel = "Excelente"; cor = "text-emerald-400"; cor_bg = "bg-emerald-500/15 border-emerald-500/40"; }
  else if (score >= 60) { status = "saudavel"; statusLabel = "Saudável"; cor = "text-emerald-300"; cor_bg = "bg-emerald-500/10 border-emerald-500/30"; }
  else if (score >= 40) { status = "atencao"; statusLabel = "Atenção"; cor = "text-amber-400"; cor_bg = "bg-amber-500/15 border-amber-500/40"; }

  // dias restantes de warmup (se aquecendo)
  let warmupDiasRestantes: number | null = null;
  if (w === "aquecendo") {
    if (a.warmup_started_at) {
      const dias = Math.floor((Date.now() - new Date(a.warmup_started_at).getTime()) / 86400000);
      warmupDiasRestantes = Math.max(0, WARMUP_META_DIAS - dias);
    } else if (typeof a.warmup_days === "number") {
      warmupDiasRestantes = Math.max(0, WARMUP_META_DIAS - a.warmup_days);
    }
  }

  return { score, idadeScore, engScore, alcanceScore, warmupScore, riscoPenalty, status, statusLabel, cor, cor_bg, idadeDias, warmupDiasRestantes };
}

export function nextWarmupAction(a: FarmAccount, h: FarmHealth): string | null {
  const w = (a.warmup_status || "novo").toLowerCase();
  if (w === "banido") return "Marcar como perdida ou revender";
  if (w === "novo") return "Iniciar warmup (login + navegação natural 15min)";
  if (w === "aquecendo") {
    const d = a.warmup_days || 0;
    if (d < 3) return "Curtir + seguir contas do nicho (sem postar)";
    if (d < 7) return "Postar 1 story leve/dia";
    if (d < 14) return "1 post + 2 stories/dia, engajar";
    if (d < WARMUP_META_DIAS) return "Ritmo cheio: 1 reel + 3 stories/dia";
    return "Warmup completo — marcar como pronto";
  }
  if (w === "pronto" && h.score < 60) return "Reengajar: postar hoje pra manter saúde";
  if (w === "pausado") return "Retomar warmup ou revender";
  return null;
}
