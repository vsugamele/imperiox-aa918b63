// Templates de blueprints OpenFlow para fluxos pós-venda.
// Gera 3 fluxos: compra aprovada, compra recusada, checkout abandonado.

export function buildPostSaleBlueprints(opts: {
  project_id: string;
  produto_nome: string;
  user_id: string;
}) {
  const { project_id, produto_nome, user_id } = opts;
  const now = Date.now();

  const make = (titulo: string, evento: string, nodes: any[]) => ({
    project_id,
    user_id,
    title: titulo,
    trigger_event: evento,
    status: "rascunho",
    blueprint: {
      title: titulo,
      trigger: { event: evento, produto: produto_nome },
      nodes,
    },
  });

  return [
    make(`✅ Aprovada — ${produto_nome}`, "compra_aprovada", [
      { id: `n_${now}_1`, type: "wa_message", title: "Boas-vindas",
        blocks: [{ id: `b1`, type: "text", content: `🎉 Parabéns pela compra de {{produto}}! Sua jornada começa agora.\nQualquer dúvida, é só me chamar por aqui.` }] },
      { id: `n_${now}_2`, type: "delay", title: "Aguardar 30min", blocks: [{ id: `b2`, type: "delay", minutes: 30 }] },
      { id: `n_${now}_3`, type: "wa_message", title: "Entrega + acesso",
        blocks: [{ id: `b3`, type: "text", content: `📦 Aqui está seu acesso:\n{{link_entrega}}\n\nGuarde com carinho e bons estudos!` }] },
      { id: `n_${now}_4`, type: "delay", title: "Aguardar 24h", blocks: [{ id: `b4`, type: "delay", minutes: 1440 }] },
      { id: `n_${now}_5`, type: "wa_message", title: "Upsell",
        blocks: [{ id: `b5`, type: "text", content: `Já que você entrou pro {{produto}}, abri uma vaga pra você no {{upsell_nome}} com condição especial. Quer ver?` }] },
      { id: `n_${now}_6`, type: "delay", title: "Aguardar 7 dias", blocks: [{ id: `b6`, type: "delay", minutes: 10080 }] },
      { id: `n_${now}_7`, type: "wa_message", title: "Pedido de depoimento",
        blocks: [{ id: `b7`, type: "text", content: `Como tá sendo sua experiência? Se puder me mandar um print do resultado ou um áudio rapidinho me ajuda muito! 🙏` }] },
    ]),

    make(`⚠️ Recusada — ${produto_nome}`, "compra_recusada", [
      { id: `r_${now}_1`, type: "wa_message", title: "Alerta amigável",
        blocks: [{ id: `b1`, type: "text", content: `Oi! Vi que rolou um problema no pagamento de {{produto}}. Acontece. Quer que eu tente liberar via Pix? É mais rápido e direto.` }] },
      { id: `r_${now}_2`, type: "delay", title: "Aguardar 1h", blocks: [{ id: `b2`, type: "delay", minutes: 60 }] },
      { id: `r_${now}_3`, type: "wa_message", title: "Tentar Pix",
        blocks: [{ id: `b3`, type: "text", content: `Aqui o link novo via Pix (sem chance de cair de novo):\n{{link_pix}}` }] },
      { id: `r_${now}_4`, type: "delay", title: "Aguardar 24h", blocks: [{ id: `b4`, type: "delay", minutes: 1440 }] },
      { id: `r_${now}_5`, type: "wa_message", title: "Downsell",
        blocks: [{ id: `b5`, type: "text", content: `Se o valor cheio tá apertado, separei uma versão entrada do {{produto}} pra você começar agora: {{link_downsell}}` }] },
    ]),

    make(`🛒 Abandono Checkout — ${produto_nome}`, "checkout_abandonado", [
      { id: `a_${now}_1`, type: "delay", title: "Aguardar 15min", blocks: [{ id: `b1`, type: "delay", minutes: 15 }] },
      { id: `a_${now}_2`, type: "wa_message", title: "Lembrete leve",
        blocks: [{ id: `b2`, type: "text", content: `Oi! Vi que você começou a comprar o {{produto}} mas não finalizou. Ficou alguma dúvida?` }] },
      { id: `a_${now}_3`, type: "delay", title: "Aguardar 2h", blocks: [{ id: `b3`, type: "delay", minutes: 120 }] },
      { id: `a_${now}_4`, type: "wa_message", title: "Quebrar objeção",
        blocks: [{ id: `b4`, type: "text", content: `Só pra te lembrar: você tem 7 dias de garantia. Se não servir, devolve. Risco zero.\nLink direto: {{link_checkout}}` }] },
      { id: `a_${now}_5`, type: "delay", title: "Aguardar 24h", blocks: [{ id: `b5`, type: "delay", minutes: 1440 }] },
      { id: `a_${now}_6`, type: "wa_message", title: "Última chance",
        blocks: [{ id: `b6`, type: "text", content: `Última chance com a condição de hoje: {{link_checkout}}\nDepois disso, volta pro preço cheio.` }] },
    ]),
  ];
}
