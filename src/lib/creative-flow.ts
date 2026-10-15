// Fábrica de criativos (UX1.2): o fluxo guiado de um projeto — Elenco → Mercado → Leva → Artes → Teste no ar → Placar.
// Cada passo diz se está feito, o que falta e qual é o próximo; a tela mostra o primeiro passo pendente em destaque.

export interface FactoryStatus {
  elenco: { visual: number; comFoto: number; persona: number };
  mercado: { referencias: number; classificadas: number; fontes: number };
  levas: { planejadas: number; aprovadas: number; gerando: number; prontas: number };
  testes: { noAr: number; total: number };
  placar: { vencedores: number; moldes: number };
}

export type StepKey = "elenco" | "mercado" | "leva" | "artes" | "teste" | "placar";
export type StepState = "feito" | "pendente" | "atencao";

export interface FlowStep { key: StepKey; titulo: string; estado: StepState; resumo: string; proximo: string }

export function flowSteps(s: FactoryStatus): FlowStep[] {
  const elencoOk = s.elenco.visual >= 2 && s.elenco.comFoto >= 2 && s.elenco.persona >= 1;
  const mercadoOk = s.mercado.classificadas >= 30 && s.mercado.fontes >= 1;
  const levaOk = s.levas.planejadas + s.levas.aprovadas + s.levas.gerando + s.levas.prontas > 0;
  const artesOk = s.levas.prontas > 0;
  const testeOk = s.testes.noAr > 0;
  const placarOk = s.placar.vencedores > 0;
  return [
    {
      key: "elenco", titulo: "Elenco",
      estado: elencoOk ? "feito" : s.elenco.visual + s.elenco.persona > 0 ? "atencao" : "pendente",
      resumo: `${s.elenco.visual} avatar(es) nas artes (${s.elenco.comFoto} com foto) · ${s.elenco.persona} persona(s) do público`,
      proximo: s.elenco.visual + s.elenco.persona === 0 ? "Sugerir o elenco com IA (persona + rostos)."
        : s.elenco.persona === 0 ? "Criar a persona do público (para quem a copy fala)."
        : s.elenco.comFoto < 2 ? "Gerar fotos de pelo menos 2 avatares para o rosto ficar igual nas artes." : "Elenco pronto.",
    },
    {
      key: "mercado", titulo: "Mercado",
      estado: mercadoOk ? "feito" : s.mercado.referencias > 0 || s.mercado.fontes > 0 ? "atencao" : "pendente",
      resumo: `${s.mercado.classificadas} referências classificadas de ${s.mercado.referencias} · ${s.mercado.fontes} fonte(s) de mineração`,
      proximo: s.mercado.fontes === 0 ? "Cadastrar fontes de mineração (palavras e páginas de concorrentes)."
        : s.mercado.classificadas < 30 ? "Esperar a mineração diária juntar pelo menos 30 referências classificadas." : "Mercado com amostra boa.",
    },
    {
      key: "leva", titulo: "Leva",
      estado: levaOk ? "feito" : "pendente",
      resumo: `${s.levas.planejadas} esperando aprovação · ${s.levas.aprovadas} aprovada(s)`,
      proximo: s.levas.planejadas > 0 ? "Revisar e aprovar a leva salva." : levaOk ? "Leva aprovada." : "Montar a próxima leva (ângulos × formatos × elenco).",
    },
    {
      key: "artes", titulo: "Artes",
      estado: artesOk ? "feito" : s.levas.gerando > 0 ? "atencao" : "pendente",
      resumo: `${s.levas.gerando} gerando · ${s.levas.prontas} pronta(s)`,
      proximo: s.levas.gerando > 0 ? "Aguardar a fábrica terminar (1 a 6 minutos)." : s.levas.aprovadas > 0 ? "Gerar as artes da leva aprovada." : artesOk ? "Artes prontas: revisar antes de subir." : "Precisa de uma leva aprovada.",
    },
    {
      key: "teste", titulo: "Teste no ar",
      estado: testeOk ? "feito" : "pendente",
      resumo: `${s.testes.noAr} teste(s) no ar de ${s.testes.total}`,
      proximo: testeOk ? "Leitura só depois de 48h; os cortes da escada já valem." : artesOk ? "Montar o teste com as artes prontas e subir." : "Precisa de artes prontas.",
    },
    {
      key: "placar", titulo: "Placar e molde",
      estado: placarOk ? "feito" : "pendente",
      resumo: `${s.placar.vencedores} vencedor(es) · ${s.placar.moldes} molde(s)`,
      proximo: placarOk && s.placar.moldes === 0 ? "Desmontar o vencedor (V00) e gerar a primeira onda de variações." : placarOk ? "Próxima onda do molde." : "Ainda sem vencedor (3 vendas dentro do payout).",
    },
  ];
}

/** O passo para olhar agora: o primeiro que não está feito (na ordem do fluxo). */
export function nextStep(steps: ReadonlyArray<FlowStep>): FlowStep | null {
  return steps.find((x) => x.estado !== "feito") ?? null;
}
