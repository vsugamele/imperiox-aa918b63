// Templates de board inspirados no operacional Direct Response (KGroup style).
// Cada template define cor de coluna + títulos padrão.

export interface BoardTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  columns: Array<{ title: string; color: string }>;
}

// Paleta de tokens semânticos (cores permitidas na coluna).
export const COLUMN_COLOR_PRESETS: Array<{ id: string; label: string; hsl: string; hex: string }> = [
  { id: "amber",   label: "Âmbar",    hsl: "45 95% 55%",  hex: "#f0b100" },
  { id: "yellow",  label: "Amarelo",  hsl: "55 95% 60%",  hex: "#facc15" },
  { id: "green",   label: "Verde",    hsl: "142 70% 45%", hex: "#22c55e" },
  { id: "teal",    label: "Ciano",    hsl: "180 65% 45%", hex: "#14b8a6" },
  { id: "blue",    label: "Azul",     hsl: "215 85% 60%", hex: "#3b82f6" },
  { id: "violet",  label: "Roxo",     hsl: "265 75% 65%", hex: "#8b5cf6" },
  { id: "pink",    label: "Rosa",     hsl: "330 80% 65%", hex: "#ec4899" },
  { id: "red",     label: "Vermelho", hsl: "0 75% 60%",   hex: "#ef4444" },
  { id: "gray",    label: "Cinza",    hsl: "220 10% 55%", hex: "#71717a" },
];

export const TEMPLATES: BoardTemplate[] = [
  {
    id: "hooks",
    name: "Banco de Hooks",
    emoji: "🎣",
    description: "Índice, Teste, Validado, Escalado, Morto",
    columns: [
      { title: "Índice", color: "#71717a" },
      { title: "Testando", color: "#facc15" },
      { title: "Validado", color: "#22c55e" },
      { title: "Escalado", color: "#3b82f6" },
      { title: "Morto", color: "#ef4444" },
    ],
  },
  {
    id: "crm-testes",
    name: "CRM de Testes",
    emoji: "🧪",
    description: "Rodando, Consolidando, Vencedor, Descartado",
    columns: [
      { title: "Rodando", color: "#facc15" },
      { title: "Consolidando", color: "#14b8a6" },
      { title: "Vencedor", color: "#22c55e" },
      { title: "Descartado", color: "#ef4444" },
    ],
  },
  {
    id: "bodies",
    name: "Banco de Bodies",
    emoji: "📝",
    description: "Rascunho, Testando, Validado, Reciclado",
    columns: [
      { title: "Rascunho", color: "#71717a" },
      { title: "Testando", color: "#facc15" },
      { title: "Validado", color: "#ec4899" },
      { title: "Reciclado", color: "#8b5cf6" },
    ],
  },
  {
    id: "backend",
    name: "Back-end & Recorrência",
    emoji: "🔁",
    description: "Carrinho, Pós-compra, Back-end, Remarketing, E-mail",
    columns: [
      { title: "Carrinho abandonado", color: "#facc15" },
      { title: "Pós-compra", color: "#22c55e" },
      { title: "Back-end", color: "#3b82f6" },
      { title: "Remarketing WA", color: "#14b8a6" },
      { title: "E-mail (calendário)", color: "#8b5cf6" },
    ],
  },
  {
    id: "contingencia",
    name: "Contingência",
    emoji: "🛡️",
    description: "Status, Contas, Domínios, Checkout, Backups, Contatos",
    columns: [
      { title: "Status geral", color: "#71717a" },
      { title: "Contas caídas", color: "#ef4444" },
      { title: "Domínios", color: "#facc15" },
      { title: "Checkout", color: "#3b82f6" },
      { title: "Backups criativos", color: "#22c55e" },
      { title: "Contatos emergência", color: "#ec4899" },
    ],
  },
];

// Métricas conhecidas exibidas como chips no card. Ordem = ordem de exibição.
export const METRIC_FIELDS: Array<{ key: string; label: string; format: "pct" | "roi" | "money" | "int" }> = [
  { key: "hook_rate", label: "hook", format: "pct" },
  { key: "body_rate", label: "body", format: "pct" },
  { key: "roi", label: "ROI", format: "roi" },
  { key: "sales", label: "vendas", format: "int" },
  { key: "cpa", label: "CPA", format: "money" },
  { key: "ctr", label: "CTR", format: "pct" },
  { key: "spend", label: "spend", format: "money" },
];

export function formatMetric(value: number | string | undefined | null, format: "pct" | "roi" | "money" | "int"): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (format === "pct") return `${n.toFixed(1).replace(".", ",")}%`;
  if (format === "roi") return `${n.toFixed(1).replace(".", ",")}x`;
  if (format === "money") return `R$ ${n.toFixed(0)}`;
  return String(Math.round(n));
}

// Semáforo automático baseado em ROI (se existir).
export function autoStatusColor(metrics: Record<string, any> | undefined): "green" | "yellow" | "red" | null {
  if (!metrics) return null;
  const roi = Number(metrics.roi);
  if (!Number.isFinite(roi)) return null;
  if (roi >= 1.5) return "green";
  if (roi >= 1) return "yellow";
  return "red";
}
