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
export function normalizeProductLinks(produto: unknown): ProductLink[] {
  if (!produto || typeof produto !== "object") return [];
  if (!("links" in produto)) {
    return "link" in produto && typeof produto.link === "string" && produto.link
      ? [{ url: produto.link, tipo: "outro", prioridade_ia: "alternativo", ativo: true }]
      : [];
  }
  const raw = produto.links;
  if (!Array.isArray(raw)) {
    if ("link" in produto && typeof produto.link === "string" && produto.link) {
      return [{ url: produto.link, tipo: "outro", prioridade_ia: "alternativo", ativo: true }];
    }
    return [];
  }
  return raw
    .map((l: unknown): ProductLink | null => {
      if (typeof l === "string") {
        if (!l) return null;
        return { url: l, tipo: "outro", prioridade_ia: "alternativo", ativo: true };
      }
      if (l && typeof l === "object" && "url" in l && typeof l.url === "string") {
        return {
          url: l.url,
          label: "label" in l && typeof l.label === "string" ? l.label : "",
          tipo: "tipo" in l ? LINK_TIPOS.find((t) => t.value === l.tipo)?.value ?? "outro" : "outro",
          observacao: "observacao" in l && typeof l.observacao === "string" ? l.observacao : "",
          prioridade_ia: "prioridade_ia" in l ? PRIORIDADES.find((p) => p.value === l.prioridade_ia)?.value ?? "alternativo" : "alternativo",
          contexto_ia: "contexto_ia" in l && Array.isArray(l.contexto_ia) ? l.contexto_ia.filter((c): c is string => typeof c === "string") : [],
          ativo: !("ativo" in l) || l.ativo !== false,
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
export function formatLinksForPrompt(produto: unknown): string {
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
