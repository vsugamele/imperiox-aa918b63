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

function isLikelyCheckoutUrl(url: string): boolean {
  return /checkout\.ticto\.app|payment\.ticto\.app|pay\.hotmart|kiwify\.com\.br\/checkout|checkout|payment/i.test(url);
}

/** Aceita formato antigo (string[]) ou novo (ProductLink[]) e devolve normalizado. */
export function normalizeProductLinks(produto: unknown): ProductLink[] {
  if (!produto || typeof produto !== "object") return [];
  const p = produto as Record<string, unknown>;

  const collected: ProductLink[] = [];
  const seenUrls = new Set<string>();

  const addLink = (link: ProductLink) => {
    const normUrl = link.url.trim().toLowerCase();
    if (!normUrl || seenUrls.has(normUrl)) return;
    seenUrls.add(normUrl);
    collected.push(link);
  };

  // 1. Explicit link_checkout / checkout_url no nível raiz do objeto
  const rootCheckout = typeof p.link_checkout === "string" && p.link_checkout.trim()
    ? p.link_checkout.trim()
    : (typeof p.checkout_url === "string" && p.checkout_url.trim() ? p.checkout_url.trim() : null);

  if (rootCheckout) {
    addLink({
      url: rootCheckout,
      label: "Checkout",
      tipo: "checkout",
      prioridade_ia: "preferido",
      ativo: true,
    });
  }

  // 2. Extrai de p.links ou fallback para p.link
  const raw = Array.isArray(p.links) ? p.links : (typeof p.link === "string" && p.link ? [p.link] : []);

  for (const l of raw) {
    if (typeof l === "string") {
      if (!l.trim()) continue;
      const url = l.trim();
      const isCheckout = isLikelyCheckoutUrl(url);
      addLink({
        url,
        label: isCheckout ? "Checkout" : "",
        tipo: isCheckout ? "checkout" : "outro",
        prioridade_ia: isCheckout ? "preferido" : "alternativo",
        ativo: true,
      });
    } else if (l && typeof l === "object" && "url" in l && typeof (l as Record<string, unknown>).url === "string") {
      const obj = l as Record<string, unknown>;
      const url = (obj.url as string).trim();
      if (!url) continue;

      const explicitTipo = "tipo" in obj && typeof obj.tipo === "string" ? LINK_TIPOS.find((t) => t.value === obj.tipo)?.value : undefined;
      const isCheckout = explicitTipo === "checkout" || (!explicitTipo && isLikelyCheckoutUrl(url));
      const tipo = explicitTipo ?? (isCheckout ? "checkout" : "outro");

      const label = "label" in obj && typeof obj.label === "string" ? obj.label : (isCheckout ? "Checkout" : "");
      const prioridade_ia = "prioridade_ia" in obj && typeof obj.prioridade_ia === "string"
        ? (PRIORIDADES.find((pr) => pr.value === obj.prioridade_ia)?.value ?? "alternativo")
        : (isCheckout ? "preferido" : "alternativo");

      addLink({
        url,
        label,
        tipo,
        observacao: "observacao" in obj && typeof obj.observacao === "string" ? obj.observacao : "",
        prioridade_ia,
        contexto_ia: "contexto_ia" in obj && Array.isArray(obj.contexto_ia) ? obj.contexto_ia.filter((c): c is string => typeof c === "string") : [],
        ativo: !("ativo" in obj) || obj.ativo !== false,
      });
    }
  }

  return collected;
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
