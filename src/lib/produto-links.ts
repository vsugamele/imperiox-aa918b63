// Tipos e helpers para "links do produto" — rico em metadata pra IA escolher o melhor.

export type ProductLinkTipo =
  | "checkout" | "vsl" | "lp" | "captura" | "obrigado"
  | "grupo_wpp" | "downsell" | "upsell" | "bonus" | "outro";

export type ProductLinkPrioridade = "preferido" | "alternativo" | "evitar";

export type ProductLink = {
  url: string;
  label?: string;
  tipo?: ProductLinkTipo;
  observacao?: string;
  prioridade_ia?: ProductLinkPrioridade;
  contexto_ia?: string[];
  ativo?: boolean;
};

export const LINK_TIPOS: { value: ProductLinkTipo; label: string }[] = [
  { value: "checkout", label: "Checkout" },
  { value: "vsl", label: "VSL" },
  { value: "lp", label: "Landing Page" },
  { value: "captura", label: "Captura" },
  { value: "obrigado", label: "Obrigado" },
  { value: "grupo_wpp", label: "Grupo WhatsApp" },
  { value: "downsell", label: "Downsell" },
  { value: "upsell", label: "Upsell" },
  { value: "bonus", label: "Bônus" },
  { value: "outro", label: "Outro" },
];

export const PRIORIDADES: { value: ProductLinkPrioridade; label: string; tone: string }[] = [
  { value: "preferido", label: "Preferido", tone: "text-primary" },
  { value: "alternativo", label: "Alternativo", tone: "text-muted-foreground" },
  { value: "evitar", label: "Evitar", tone: "text-destructive" },
];

/** Aceita formato antigo (string[]) ou novo (ProductLink[]) e devolve normalizado. */
export function normalizeProductLinks(produto: any): ProductLink[] {
  if (!produto) return [];
  const raw = produto.links;
  if (!Array.isArray(raw)) {
    if (typeof produto.link === "string" && produto.link) {
      return [{ url: produto.link, tipo: "outro", prioridade_ia: "alternativo", ativo: true }];
    }
    return [];
  }
  return raw
    .map((l: any): ProductLink | null => {
      if (typeof l === "string") {
        if (!l) return null;
        return { url: l, tipo: "outro", prioridade_ia: "alternativo", ativo: true };
      }
      if (l && typeof l === "object" && typeof l.url === "string") {
        return {
          url: l.url,
          label: l.label || "",
          tipo: l.tipo || "outro",
          observacao: l.observacao || "",
          prioridade_ia: l.prioridade_ia || "alternativo",
          contexto_ia: Array.isArray(l.contexto_ia) ? l.contexto_ia : [],
          ativo: l.ativo !== false,
        };
      }
      return null;
    })
    .filter((x): x is ProductLink => !!x);
}

/** Escolhe o melhor link dado um contexto opcional (ex.: "pix", "objeção-preço"). */
export function pickBestLink(
  links: ProductLink[],
  opts: { contexto?: string; tipo?: ProductLinkTipo } = {}
): ProductLink | null {
  const active = links.filter((l) => l.ativo !== false && l.prioridade_ia !== "evitar");
  if (active.length === 0) return null;

  const score = (l: ProductLink) => {
    let s = 0;
    if (l.prioridade_ia === "preferido") s += 100;
    if (opts.tipo && l.tipo === opts.tipo) s += 50;
    if (opts.contexto && l.contexto_ia?.some((c) => c.toLowerCase() === opts.contexto!.toLowerCase())) s += 30;
    return s;
  };
  return [...active].sort((a, b) => score(b) - score(a))[0];
}

/** Texto compacto pra injetar em prompts de IA. */
export function formatLinksForPrompt(produto: any): string {
  const links = normalizeProductLinks(produto);
  if (links.length === 0) return "(sem links)";
  return links
    .filter((l) => l.ativo !== false)
    .map((l) => {
      const tags = [l.tipo, l.prioridade_ia].filter(Boolean).join(" · ");
      const ctx = l.contexto_ia?.length ? ` [ctx: ${l.contexto_ia.join(", ")}]` : "";
      const obs = l.observacao ? ` — ${l.observacao}` : "";
      return `- ${l.label || l.url} (${tags})${ctx}${obs}\n  ${l.url}`;
    })
    .join("\n");
}
