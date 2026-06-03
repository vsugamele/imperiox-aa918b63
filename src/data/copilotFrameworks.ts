export interface CopywritingFramework {
  id: string;
  name: string;
  description: string;
  steps: string[];
}

export const COPILOT_FRAMEWORKS = {
  vsl: {
    name: "Estrutura de VSL em 7 Blocos (19m30s)",
    description: "Estrutura de vídeo de vendas de alta conversão adaptada para qualquer nicho.",
    blocks: [
      {
        num: 1,
        title: "Gancho & Interrupção de Padrão (0-1:30)",
        description: "Capturar atenção imediata, prometer uma revelação chocante e qualificar o público.",
        rule: "Nunca comece se apresentando. Comece com uma cena sensorial, uma estatística assustadora ou uma contradição do mercado."
      },
      {
        num: 2,
        title: "Agitação do Problema (1:30-4:00)",
        description: "Expor a dor superficial e afundar na dor profunda. Mostrar o porquê de os métodos comuns falharem.",
        rule: "Conecte o sintoma observável com a causa raiz negligenciada pelo mercado."
      },
      {
        num: 3,
        title: "História de Origem & Epifania (4:00-8:30)",
        description: "Apresentar o expert/personagem, sua jornada de fracasso à descoberta do novo mecanismo.",
        rule: "A epifania é o divisor de águas: a percepção de que a culpa não era deles, mas sim do sistema/método antigo."
      },
      {
        num: 4,
        title: "Apresentação do Mecanismo Único (8:30-11:00)",
        description: "Explicar cientificamente ou logicamente por que a nova solução funciona e por que a concorrência é obsoleta.",
        rule: "O mecanismo deve ter um apelido marcante (ex: 'Ciclo do Fio Forte', 'Protocolo 3P')."
      },
      {
        num: 5,
        title: "Revelação da Oferta & Ancoragem (11:00-14:00)",
        description: "Apresentar o produto físico ou infoproduto como a materialização do mecanismo. Ancorar o preço inicial.",
        rule: "Use a escada de ancoragem: Valor Real vs. Custo de Desenvolvimento vs. Preço Especial."
      },
      {
        num: 6,
        title: "Value Stack & Bônus Agressivos (14:00-17:00)",
        description: "Listar os bônus um por um, agregando valor percebido maciço.",
        rule: "Cada bônus deve eliminar uma objeção ou acelerar o resultado do produto principal."
      },
      {
        num: 7,
        title: "Garantia & CTA Urgente (17:00-19:30)",
        description: "Garantia incondicional de eliminação de risco (ex: 7 ou 30 dias) + escassez real.",
        rule: "Apresente a decisão binária: Caminho A (continuar na dor) vs. Caminho B (segurança + transformação)."
      }
    ]
  },
  valueEquation: {
    name: "Equação de Valor Grand Slam (Alex Hormozi)",
    formula: "Valor = (Resultado Desejado × Probabilidade Percebida) / (Tempo de Espera × Esforço & Sacrifício)",
    rules: [
      "Resultado Desejado: O que o avatar mais quer alcançar no mundo perfeito.",
      "Probabilidade Percebida: Quão certo o lead está de que o seu método trará esse resultado.",
      "Tempo de Espera: Quanto tempo leva até o lead ver os primeiros sinais de vitória.",
      "Esforço & Sacrifício: A dor, o trabalho e a chatice que ele precisa passar para ter o resultado."
    ]
  },
  salesPage: {
    name: "Estrutura de Página de Vendas (PDS) em 14 Blocos",
    blocks: [
      "B1: Headline Devastadora (Promessa + Mecanismo)",
      "B2: VSL / Vídeo Principal + CTA Rápido",
      "B3: Espelho da Dor (Identificação com a situação atual)",
      "B4: O Grande Erro (Por que os tratamentos tradicionais falharam)",
      "B5: A Epifania (A descoberta do novo caminho)",
      "B6: O Mecanismo Único (A ciência/lógica por trás do método)",
      "B7: Apresentação do Produto (O que é e para quem serve)",
      "B8: Conteúdo por Dentro (Módulos, aulas ou componentes)",
      "B9: Prova Social (Depoimentos e estudos de caso)",
      "B10: Ancoragem de Preço & Oferta Principal",
      "B11: Stack de Bônus (Entregáveis complementares gratuitos)",
      "B12: Garantia Incondicional (Risco Zero)",
      "B13: FAQ (Quebra de objeções frequentes)",
      "B14: CTA de Fechamento (Decisão final)"
    ]
  },
  avatarLayers: {
    name: "As 4 Camadas da Psique do Avatar",
    layers: [
      {
        name: "C1: Sintomas Observáveis",
        desc: "O que o lead vê e reclama no dia a dia. Ex: 'meu cabelo cai', 'não tenho dinheiro'."
      },
      {
        name: "C2: Dores Conscientes",
        desc: "O que ele sabe que é um problema, mas guarda para si. Ex: 'tenho vergonha de postar fotos', 'estou falindo'."
      },
      {
        name: "C3: Reparação do Ego Ferido (Subconsciente)",
        desc: "Desejos egoístas e tabus que ele nunca admitiria. Ex: 'quero provar para minha família que não sou um fracasso', 'vingança silenciosa contra quem duvidou'."
      },
      {
        name: "C4: Ferida Central (Trauma)",
        desc: "O evento ou sentimento formador que dita seu comportamento de autossabotagem."
      }
    ]
  },
  adAngles: [
    {
      name: "Raiva / Indignação",
      focus: "Apontar para o culpado sistêmico (ex: gurus, cursos caros, indústrias) que lucra com o erro do lead."
    },
    {
      name: "Medo / Perda",
      focus: "Mostrar o custo financeiro ou pessoal de continuar ignorando o problema por mais 6 meses."
    },
    {
      name: "Lógica / Ciência",
      focus: "Apresentar dados frios, estatísticas ou uma explicação mecânica simples de por que as outras opções falham."
    },
    {
      name: "Status / Reconhecimento",
      focus: "Apelar para o desejo de ser a maior referência na sua cidade ou o orgulho de faturar alto."
    },
    {
      name: "Curiosidade / Pattern Interrupt",
      focus: "Mostrar uma imagem/frase completamente fora do contexto para que o lead pare o scroll e queira entender."
    }
  ]
};
