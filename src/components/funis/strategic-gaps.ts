
interface GapRule {
  id: string;
  title: string;
  desc: string;
  impact: "alto" | "medio" | "baixo";
  suggest: { kind: string; label: string };
}

interface NodeLite {
  id?: string;
  kind: string;
  label: string;
  description?: string | null;
}

interface EdgeLite { source: string; target: string; }

function analyzeGaps(nodes: NodeLite[], edges: EdgeLite[] = []): GapRule[] {
  const has = (k: string) => nodes.some(n => n.kind === k);
  const gaps: GapRule[] = [];

  if (!has("captura")) gaps.push({
    id: "no-captura", title: "Sem Página de Captura",
    desc: "Você está queimando tráfego sem coletar lead. Sem página de captura, todo anúncio é desperdício.",
    impact: "alto", suggest: { kind: "captura", label: "Página de Captura" },
  });
  if (!has("vsl") && !has("pagina_vendas")) gaps.push({
    id: "no-vsl", title: "Sem ativo de conversão principal",
    desc: "Nenhuma VSL ou página de vendas no mapa. Você não tem onde converter o lead em cliente.",
    impact: "alto", suggest: { kind: "vsl", label: "VSL Principal" },
  });
  if (!has("checkout")) gaps.push({
    id: "no-checkout", title: "Sem nó de Checkout",
    desc: "Sem checkout mapeado você não vê onde o dinheiro entra — nem consegue anexar orderbump.",
    impact: "alto", suggest: { kind: "checkout", label: "Checkout" },
  });
  if (has("checkout") && !has("orderbump")) gaps.push({
    id: "no-orderbump", title: "Checkout sem Orderbump",
    desc: "Ticket médio limitado. Orderbump é a forma mais barata de aumentar receita por cliente.",
    impact: "medio", suggest: { kind: "orderbump", label: "Orderbump" },
  });
  if (has("checkout") && !has("upsell")) gaps.push({
    id: "no-upsell", title: "Checkout sem Upsell",
    desc: "Você está deixando ticket na mesa. Cliente comprando é o momento mais quente para vender de novo.",
    impact: "alto", suggest: { kind: "upsell", label: "Upsell 1" },
  });
  if (has("upsell") && !has("downsell")) gaps.push({
    id: "no-downsell", title: "Upsell sem Downsell",
    desc: "Quem recusa o upsell some sem chance de recuperação. Downsell resgata parte da receita perdida.",
    impact: "medio", suggest: { kind: "downsell", label: "Downsell" },
  });
  if (!has("email")) gaps.push({
    id: "no-email", title: "Sem sequência de e-mail",
    desc: "Lead frio sem nurture. Sequência de e-mail é o que aquece quem não comprou de primeira.",
    impact: "medio", suggest: { kind: "email", label: "Sequência de Nurture" },
  });
  if (!has("whatsapp")) gaps.push({
    id: "no-wa", title: "Sem canal WhatsApp",
    desc: "Recuperação de carrinho e follow-up de lead quente rodam no WhatsApp. Sem chip, você perde 30-50% da conversão.",
    impact: "alto", suggest: { kind: "whatsapp", label: "WhatsApp de Vendas" },
  });
  if (!has("anuncio")) gaps.push({
    id: "no-ads", title: "Sem nó de tráfego pago",
    desc: "Nenhum anúncio mapeado. Difícil escalar sem previsibilidade de aquisição.",
    impact: "baixo", suggest: { kind: "anuncio", label: "Campanha de Anúncios" },
  });
  if (has("anuncio") && !has("captura")) gaps.push({
    id: "ads-no-capt", title: "Anúncio sem captura vinculada",
    desc: "Você tem anúncio rodando mas ninguém sendo capturado. Todo o investimento vai pro ralo.",
    impact: "alto", suggest: { kind: "captura", label: "Captura para o Anúncio" },
  });
  if (has("vsl") && !has("pagina_vendas") && !has("checkout")) gaps.push({
    id: "vsl-no-next", title: "VSL sem próximo passo",
    desc: "VSL sem página de vendas ou checkout depois. Quem assiste até o fim não tem para onde ir.",
    impact: "alto", suggest: { kind: "pagina_vendas", label: "Página pós-VSL" },
  });

  // Detecção de nós órfãos (sem nenhuma conexão)
  if (edges.length > 0 && nodes.some(n => n.id)) {
    const connected = new Set<string>();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    const orphans = nodes.filter(n => n.id && !connected.has(n.id) && !["doc", "meta"].includes(n.kind));
    if (orphans.length > 0) gaps.push({
      id: "orphans", title: `${orphans.length} nó(s) órfão(s)`,
      desc: `Sem conexão: ${orphans.slice(0, 3).map(o => o.label).join(", ")}${orphans.length > 3 ? "…" : ""}. Nó isolado não gera fluxo.`,
      impact: "medio", suggest: { kind: "__orphan__", label: "Ver órfãos" },
    });
  }

  return gaps;
}

export { type GapRule, type NodeLite, type EdgeLite, analyzeGaps };
