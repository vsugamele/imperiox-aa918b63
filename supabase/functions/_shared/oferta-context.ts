// Formata bloco de ofertas ativas para injetar em system prompts de IA.
// Lê `project.data.produtos[].ofertas[]` (estrutura editada em ProjetoBriefing).
export function formatOfertasAtivas(produtos: any[], produtoFiltro?: string | null): string {
  if (!Array.isArray(produtos) || produtos.length === 0) return "";
  const now = Date.now();
  const linhas: string[] = [];

  for (const p of produtos) {
    if (produtoFiltro && p?.nome && p.nome !== produtoFiltro) continue;
    const ofertas = Array.isArray(p?.ofertas) ? p.ofertas : [];
    for (const o of ofertas) {
      if (o?.ativo === false) continue;
      const de = String(o?.preco_de || "").trim();
      const por = String(o?.preco_por || "").trim();
      if (!de && !por) continue;
      // valida prazo
      if (o?.validade) {
        const t = Date.parse(o.validade);
        if (!Number.isNaN(t) && t < now) continue;
      }
      const partes = [`⚡ OFERTA ATIVA — ${p.nome}${o.nome ? ` · ${o.nome}` : ""}`];
      if (de && por) partes.push(`de R$ ${de} por R$ ${por}`);
      else if (por) partes.push(`R$ ${por}`);
      if (o.tipo_oferta) partes.push(`(${o.tipo_oferta})`);
      if (o.validade) partes.push(`válida até ${o.validade}`);
      if (o.motivo) partes.push(`— motivo: ${o.motivo}`);
      if (o.link_checkout) partes.push(`checkout: ${o.link_checkout}`);
      linhas.push(partes.join(" "));
    }
  }

  if (linhas.length === 0) return "";
  return [
    "",
    "═══ OFERTAS ATIVAS (use ancoragem e urgência genuína) ═══",
    ...linhas,
    "Regras: cite o preço DE/POR para ancorar valor. Se houver validade, use urgência real (sem inventar prazo). Se houver motivo, conecte à narrativa.",
    "",
  ].join("\n");
}
