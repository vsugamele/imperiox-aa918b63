import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sparkles, Zap, Brain, Target, Shield, Copy, Check, Info, Flame, Eye,
  ShieldAlert, UserCheck, RefreshCw, MessageSquare, ArrowRight, Lightbulb, Compass
} from "lucide-react";
import { toast } from "sonner";

// ==========================================
// 16 ÂNGULOS ORGANIZADOS EM 4 BLOCOS
// ==========================================
interface SubAngle {
  key: string;
  label: string;
  description: string;
  neuroTrigger: string;
  states: {
    negacao: string;
    frustracao: string;
    desejo_latente: string;
    pronto: string;
  };
  hooks: string[];
}

interface Block {
  title: string;
  description: string;
  gradient: string;
  color: string;
  icon: any;
  angles: SubAngle[];
}

const MATRIX_BLOCKS: Block[] = [
  {
    title: "Dor",
    description: "Reconhecimento imediato do problema. A pessoa sente que você está lendo a mente dela.",
    gradient: "from-red-500/20 via-orange-500/10 to-transparent border-red-500/30",
    color: "text-red-400",
    icon: Flame,
    angles: [
      {
        key: "dor_presente",
        label: "Dor Presente",
        description: "Foca no problema imediato que está sangrando agora e gerando desconforto físico ou emocional.",
        neuroTrigger: "Instinto de sobrevivência, resposta imediata do Cérebro Reptiliano.",
        states: {
          negacao: "Você acha que é só cansaço, mas essa queimação no estômago toda segunda-feira é seu corpo gritando por socorro.",
          frustracao: "Mais uma noite em claro encarando o teto, fazendo contas na mente sabendo que o salário acabou no dia 15.",
          desejo_latente: "Como seria passar um mês inteiro sem aquela pontada de ansiedade toda vez que o celular toca?",
          pronto: "O método passo a passo para estancar o sangramento financeiro da sua operação em 7 dias úteis."
        },
        hooks: [
          "Seu celular vibra, seu estômago aperta. Você já sabe qual cobrança é antes mesmo de desbloquear a tela.",
          "O salário caiu há 48 horas e você já está fazendo malabarismo para pagar a conta de luz.",
          "O preço que você paga por fingir que esse problema não existe está ficando caro demais."
        ]
      },
      {
        key: "sintoma_visivel",
        label: "Sintoma Visível",
        description: "Descreve um comportamento físico ou hábito cotidiano inegável que denuncia o problema.",
        neuroTrigger: "Ancoragem visual e reconhecimento situacional de alta especificidade.",
        states: {
          negacao: "Você diz que está tudo bem, mas abrir o app do banco e fechar em 3 segundos é puro medo da realidade.",
          frustracao: "Você compra cursos, baixa planilhas e no final do dia a única coisa que acumula é culpa e abas abertas.",
          desejo_latente: "O momento exato em que você percebe que a sua rotina atual está te matando lentamente.",
          pronto: "O checklist definitivo para identificar os 3 gargalos silenciosos que estão sugando seu lucro."
        },
        hooks: [
          "Abriu o aplicativo do banco, olhou o saldo por 2 segundos, fechou rápido e fingiu que não viu.",
          "Você compra o livro, lê as primeiras 10 páginas, deixa na cabeceira e nunca mais abre. Por que fazemos isso?",
          "O olhar que seu parceiro te dá quando você diz que precisa comprar 'mais um curso' para dar certo."
        ]
      },
      {
        key: "causa_oculta",
        label: "Causa Oculta",
        description: "Revela o verdadeiro motivo por trás do sofrimento, algo que a pessoa nunca havia pensado antes.",
        neuroTrigger: "Pattern Interrupt forte. Quebra de crença comum.",
        states: {
          negacao: "Você acha que te falta força de vontade. A verdade? Seus hormônios estão programados para te fazer falhar.",
          frustracao: "O erro não é seu. O sistema de anúncios foi desenhado para fazer você gastar antes de lucrar.",
          desejo_latente: "Quando você entender a verdadeira raiz da sua procrastinação, tudo vai parecer ridículo de tão fácil.",
          pronto: "A revelação científica por trás da procrastinação e a técnica de 2 minutos para destravá-la."
        },
        hooks: [
          "O motivo de você não conseguir emagrecer não tem nada a ver com preguiça (é um hormônio silencioso).",
          "A mentira que a indústria de marketing te contou para fazer você comprar ferramentas caras sem precisar.",
          "O segredo biológico de porque seu cérebro sabota qualquer projeto novo após o quarto dia."
        ]
      },
      {
        key: "custo_inacao",
        label: "Custo de Inação",
        description: "Calcula matematicamente ou emocionalmente o preço de continuar no mesmo lugar.",
        neuroTrigger: "Aversão à perda severa. Estimativa de prejuízo futuro.",
        states: {
          negacao: "Adiar essa decisão por mais um mês vai te custar exatamente 365 dias de arrependimento.",
          frustracao: "Cada dia que você passa sem estruturar seu funil é dinheiro escorrendo pelo ralo dos concorrentes.",
          desejo_latente: "Quanto vale a paz de espírito de saber que sua família está protegida caso tudo dê errado amanhã?",
          pronto: "A planilha comparativa: o custo exato de fazer você mesmo vs delegar para especialistas."
        },
        hooks: [
          "Daqui a 6 meses você vai desejar ter começado exatamente hoje.",
          "Deixar seu dinheiro na poupança está te custando R$ 142 de prejuízo invisível todas as semanas.",
          "O preço de não tomar uma atitude agora é ver alguém menos preparado que você ocupando o seu espaço."
        ]
      }
    ]
  },
  {
    title: "Medo",
    description: "Ativa o instinto biológico de evitar a perda. Geralmente converte mais rápido que o desejo puro.",
    gradient: "from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/30",
    color: "text-amber-400",
    icon: ShieldAlert,
    angles: [
      {
        key: "fomo_real",
        label: "FOMO Real (Ficar pra Trás)",
        description: "Mostra que o mercado está se movendo rápido e quem não agir agora ficará obsoleto instantaneamente.",
        neuroTrigger: "Instinto social de pertencimento e medo de exclusão do grupo.",
        states: {
          negacao: "Você acha que a inteligência artificial é modinha? Seus concorrentes já reduziram a equipe pela metade usando ela.",
          frustracao: "Ver garotos de 19 anos faturando o que você não ganha em um ano inteiro de trabalho duro dói, eu sei.",
          desejo_latente: "A janela de oportunidade ideal para pegar o começo dessa nova onda antes que ela sature.",
          pronto: "O guia prático para migrar sua operação para a nova tecnologia antes do final deste trimestre."
        },
        hooks: [
          "Enquanto você debate se isso funciona ou não, seus concorrentes já automatizaram 80% do processo.",
          "O mercado mudou nas últimas 12 semanas. Quem insistir no modelo antigo vai quebrar antes do Natal.",
          "A última onda que permitiu pessoas comuns enriquecerem do zero está se fechando agora."
        ]
      },
      {
        key: "fracasso_repetido",
        label: "Fracasso Repetido",
        description: "Toca no calcanhar de Aquiles de quem já tentou várias soluções e teme se decepcionar novamente.",
        neuroTrigger: "Validação da dor passada e construção de uma ponte de segurança inabalável.",
        states: {
          negacao: "Você comprou aquela mentira de 'ganho rápido' e agora está com medo de qualquer proposta séria.",
          frustracao: "Você sente que o problema é com você, que nada funciona na sua mão. Mas o método anterior que era falho.",
          desejo_latente: "Como recomeçar do zero sem carregar o peso psicológico de todas as tentativas frustradas do passado.",
          pronto: "O protocolo anti-falhas: por que nosso sistema garante resultado mesmo se você já errou em tudo."
        },
        hooks: [
          "Você já tentou antes e não funcionou. Eu sei. E a culpa não foi da sua falta de disciplina.",
          "Antes de comprar qualquer outro treinamento, você precisa ver esse vídeo de 3 minutos.",
          "O exato motivo pelo qual 97% das pessoas que tentam começar esse negócio falham na primeira semana."
        ]
      },
      {
        key: "arrependimento",
        label: "Arrependimento Futuro",
        description: "Projeta a mente do avatar anos à frente, fazendo-o experimentar a dor do 'e se' antes de acontecer.",
        neuroTrigger: "Contraste temporal negativo. Experiência simulada de frustração futura.",
        states: {
          negacao: "Ignorar isso agora é garantir que na próxima reunião de família você estará contando as mesmas desculpas.",
          frustracao: "Imagine olhar para trás aos 50 anos e perceber que o medo de arriscar te manteve preso a uma vida morna.",
          desejo_latente: "A paz de olhar para trás sabendo que, mesmo com medo, você teve coragem de mudar seu destino.",
          pronto: "O teste de 3 perguntas para saber se você vai se arrepender da sua carreira atual nos próximos 2 anos."
        },
        hooks: [
          "Imagine acordar daqui a 5 anos exatamente no mesmo lugar, com as mesmas contas e a mesma frustração.",
          "O que você vai dizer para os seus filhos quando eles perguntarem por que você não aproveitou essa oportunidade?",
          "O pior sentimento do mundo não é o fracasso. É a dúvida eterna do 'e se eu tivesse tentado?'."
        ]
      },
      {
        key: "perda_controle",
        label: "Perda de Controle",
        description: "Mostra que fatores externos (governo, CLT, inflação, demissões) controlam a vida da pessoa.",
        neuroTrigger: "Desejo intrínseco de agência, poder de escolha e liberdade individual.",
        states: {
          negacao: "Você acha que seu emprego público ou CLT é estável? Você é apenas uma linha numa planilha de custos.",
          frustracao: "Trabalhar 10 horas por dia para enriquecer um chefe que nem sabe o seu nome é a maior armadilha moderna.",
          desejo_latente: "Tomar as rédeas do seu próprio destino financeiro e nunca mais depender de um 'sim' de terceiros.",
          pronto: "O plano de transição de carreira seguro para construir seu plano B sem largar sua fonte de renda atual."
        },
        hooks: [
          "Sua estabilidade é uma ilusão. Você está a uma demissão de distância do desespero financeiro.",
          "O algoritmo mudou e seu negócio sumiu do mapa em 24 horas. Até quando você vai depender de plataformas de terceiros?",
          "Se você tem apenas uma fonte de renda, você está jogando roleta russa com o futuro da sua família."
        ]
      }
    ]
  },
  {
    title: "Desejo",
    description: "A visão da vida idealizada. Funciona muito bem no topo do funil ou com audiências já aquecidas.",
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30",
    color: "text-emerald-400",
    icon: Compass,
    angles: [
      {
        key: "liberdade_escolha",
        label: "Liberdade de Escolha",
        description: "Foca no poder de decidir onde estar, com quem trabalhar e o que comprar sem restrições financeiras.",
        neuroTrigger: "Liberação de dopamina através da visualização de autonomia e ausência de limites.",
        states: {
          negacao: "Liberdade não é sobre ostentar carros luxuosos. É sobre poder acordar terça-feira às 10h e decidir não trabalhar.",
          frustracao: "Cansado de ter que olhar o lado esquerdo do cardápio antes de escolher o que vai comer?",
          desejo_latente: "Ter uma operação rodando no automático que te permite viajar enquanto o faturamento entra.",
          pronto: "Como estruturar uma agência enxuta de apenas 2 pessoas faturando alto e operando de forma 100% remota."
        },
        hooks: [
          "O verdadeiro luxo não é ter coisas caras. É ter o controle total sobre a sua agenda.",
          "Como eu configurei um negócio digital que roda sozinho enquanto eu passo a tarde com meus filhos.",
          "A sensação indescritível de receber uma notificação de venda de R$ 997 enquanto está almoçando em frente à praia."
        ]
      },
      {
        key: "status_reconhecimento",
        label: "Status & Reconhecimento",
        description: "Apela para a vaidade social e a validação de pessoas próximas (família, amigos, mercado).",
        neuroTrigger: "Recompensa social de alto impacto. Elevação de serotonina.",
        states: {
          negacao: "Você finge que não liga para o que pensam, mas o silêncio de quem duvidou de você quando você vencer vai ser lindo.",
          frustracao: "Trabalhar duro em silêncio por anos sem que ninguém ao menos elogie ou entenda o que você faz é exaustivo.",
          desejo_latente: "Ser a pessoa de referência na sua família, aquela que resolve os problemas e patrocina os sonhos de todos.",
          pronto: "O método de posicionamento premium para cobrar 5x mais caro que seus concorrentes e ser idolatrado por isso."
        },
        hooks: [
          "O dia em que a pessoa que riu do seu projeto no início te mandou mensagem pedindo um emprego.",
          "Como é o sentimento de entrar na concessionária e pagar o carro dos sonhos à vista sem pedir desconto.",
          "Quando você finalmente cala a boca de todos os céticos mostrando o painel de resultados na tela."
        ]
      },
      {
        key: "ganho_acelerado",
        label: "Ganho Acelerado",
        description: "Apresenta um atalho seguro, um método que reduz a curva de aprendizado de anos para semanas.",
        neuroTrigger: "Conservação de energia biológica (o cérebro ama atalhos eficientes).",
        states: {
          negacao: "Por que você quer passar 5 anos na faculdade se pode aprender a profissão mais lucrativa do mercado em 3 meses?",
          frustracao: "Você está há 2 anos tentando quebrar a cabeça sozinho. Um mentor te economizaria esse tempo em uma única call.",
          desejo_latente: "Ter acesso ao exato checklist passo a passo que grandes players usam de portas fechadas.",
          pronto: "O plano de aceleração: como sair do absoluto zero aos R$ 10k mensais em tempo recorde usando templates prontos."
        },
        hooks: [
          "Você pode continuar tentando adivinhar o caminho sozinho por anos... ou simplesmente copiar esse método.",
          "Eu gastei mais de R$ 150 mil em testes errados para que você só precise seguir esse passo a passo de 4 etapas.",
          "O atalho silencioso que os maiores copywriters do Brasil usam para escrever páginas em 2 horas."
        ]
      },
      {
        key: "alivio_imediato",
        label: "Alívio Imediato",
        description: "Foca no fim da ansiedade, da sobrecarga de tarefas e na sensação de que tudo finalmente faz sentido.",
        neuroTrigger: "Redução do cortisol (stress) e promessa de paz mental instantânea.",
        states: {
          negacao: "Parar de correr atrás de clientes como um desesperado é o primeiro passo para ter um negócio saudável.",
          frustracao: "Você não precisa trabalhar 16 horas por dia para ter sucesso. Isso é escravidão moderna, não empreendedorismo.",
          desejo_latente: "Poder fechar o computador às 18h com a certeza absoluta de que suas campanhas estão dando lucro.",
          pronto: "O script exato de vendas que converte contatos frios em clientes pagantes sem reuniões exaustivas."
        },
        hooks: [
          "Respire fundo. A sobrecarga mental de não saber de onde virá seu próximo cliente acaba hoje.",
          "O exato momento em que você desliga as notificações do celular porque o funil está rodando perfeitamente.",
          "Você não precisa de mais ferramentas ou mais tarefas. Você precisa de simplificação."
        ]
      }
    ]
  },
  {
    title: "Identidade",
    description: "O bloco mais poderoso de todos. O produto vira uma extensão de quem a pessoa é ou quer ser.",
    gradient: "from-purple-500/20 via-indigo-500/10 to-transparent border-purple-500/30",
    color: "text-purple-400",
    icon: UserCheck,
    angles: [
      {
        key: "incompreendido",
        label: "O Incompreendido Esforçado",
        description: "Valida quem sempre trabalhou mais que os outros, mas nunca recebeu o reconhecimento devido.",
        neuroTrigger: "Empatia profunda, validação de identidade e sentimento de justiça tardia.",
        states: {
          negacao: "Você sempre foi o que chega mais cedo e sai mais tarde, mas na hora da promoção escolhem o amigo do chefe.",
          frustracao: "Eles acham que você é louco por querer construir algo seu. Dizem para você se contentar com o pouco.",
          desejo_latente: "O dia em que sua vitória provará para todos que sua 'loucura' era apenas visão de futuro.",
          pronto: "O manifesto dos inconformados: como transformar sua indignação na maior força empreendedora da sua vida."
        },
        hooks: [
          "Para você que sempre foi o mais esforçado da sala, mas sentia que as cartas estavam marcadas contra você.",
          "Eles disseram que você estava jogando sua vida fora. Mostre que eles estavam errados.",
          "O manifesto silencioso de quem cansa de carregar a operação inteira nas costas para outros levarem o crédito."
        ]
      },
      {
        key: "o_escolhido",
        label: "O Escolhido / Excepcional",
        description: "Desperta a sensação de destino, de que a pessoa nasceu para realizar algo verdadeiramente fora da curva.",
        neuroTrigger: "Ativação do ego superior e projeção de autoimagem heróica.",
        states: {
          negacao: "No fundo da sua alma, você sempre soube que uma vida comum de escritório não era o seu teto.",
          frustracao: "Você sente uma inquietação constante, como se estivesse desperdiçando seu potencial em tarefas medíocres.",
          desejo_latente: "Erguer um império digital que sirva de inspiração para as próximas gerações do seu nicho.",
          pronto: "O treinamento avançado desenhado exclusivamente para quem quer jogar o jogo dos 7 dígitos reais."
        },
        hooks: [
          "Se você sente uma inquietação profunda todo domingo à noite, este aviso é para você.",
          "Você não nasceu para viver pagando boleto e esperando o final de semana chegar. Você sabe disso.",
          "Há um grupo seleto de pessoas que se recusa a aceitar a mediocridade do mercado tradicional."
        ]
      },
      {
        key: "provedor_seguro",
        label: "O Provedor Seguro",
        description: "Conecta o sucesso do produto diretamente com a honra e a capacidade de blindar financeiramente a família.",
        neuroTrigger: "Instinto de proteção, legado familiar e responsabilidade social/paterna/materna.",
        states: {
          negacao: "Prosperar não é capricho seu. É o único jeito de garantir que seus pais tenham velhice digna e seus filhos a melhor escola.",
          frustracao: "Dói no peito ter que dizer 'não' para o brinquedo do seu filho porque a fatura do cartão está estourada.",
          desejo_latente: "Poder dar a chave de uma casa nova para sua mãe e dizer: 'Obrigado por tudo, agora é por minha conta'.",
          pronto: "A estrutura de negócios anti-crise construída para proteger o patrimônio da sua família sob qualquer cenário econômico."
        },
        hooks: [
          "O dia em que entreguei a chave do apartamento quitado para a minha mãe e disse: 'Você nunca mais vai pagar aluguel'.",
          "O verdadeiro papel de um líder de família é garantir que o dinheiro nunca seja uma barreira para a segurança de quem ama.",
          "Não é sobre você. É sobre a marca e a segurança que você vai deixar para os seus filhos."
        ]
      },
      {
        key: "rebelde_inconformado",
        label: "O Rebelde Inconformado",
        description: "Apela para a quebra de regras, a aversão a chefes, relógios de ponto, ternos e burocracia corporativa.",
        neuroTrigger: "Necessidade humana primária de liberdade absoluta e oposição a autoridades repressoras.",
        states: {
          negacao: "O terno e a gravata viraram a algema do século XXI. Você está vendendo suas melhores horas em troca de migalhas.",
          frustracao: "Bater ponto e fingir simpatia em reuniões corporativas inúteis é a morte lenta da sua criatividade.",
          desejo_latente: "Construir suas próprias regras, trabalhar de bermuda no sofá e mandar as convenções sociais para o espaço.",
          pronto: "O modelo de negócios descompromissado: como faturar como expert sem precisar de equipes inchadas ou reuniões chatas."
        },
        hooks: [
          "Eu me recusei a passar os próximos 40 anos batendo ponto e fingindo que estava feliz com isso.",
          "O sistema tradicional foi desenhado para te manter endividado e obediente. Aqui está a saída de emergência.",
          "Se você odeia reuniões de equipe, planilhas de RH e dinâmicas de grupo corporativas... bem-vindo ao clube."
        ]
      }
    ]
  }
];

// ==========================================
// OUTRAS CAMADAS NEURO-SENSORIAIS DATA
// ==========================================
const NEURO_CONCEPTS = [
  {
    title: "Pattern Interrupt (Quebra de Padrão)",
    icon: Brain,
    description: "O cérebro humano ignora 99% das informações repetitivas para economizar energia. Se os primeiros 3s do seu anúncio se parecem com um anúncio comum, ele é filtrado instantaneamente.",
    application: "Use contrastes visuais chocantes, frases contraintuitivas ou silêncios dramáticos no início.",
    example: "Começar um vídeo de negócios segurando uma melancia na cabeça ou sussurrando bem perto do microfone."
  },
  {
    title: "Loss Aversion (Aversão à Perda)",
    icon: Shield,
    description: "Psicologicamente, a dor de perder R$ 1.000 é duas vezes maior do que o prazer de ganhar R$ 1.000. Copy que promete evitar perdas converte mais rápido.",
    application: "Em vez de prometer ganhos, mostre o vazamento invisível de recursos ou a perda de tempo na rotina do lead.",
    example: "'O erro invisível que está fazendo você perder até 43% do engajamento orgânico sem você perceber.'"
  },
  {
    title: "Efeito Zeigarnik (Loops Abertos)",
    icon: Sparkles,
    description: "O cérebro experimenta tensão neurológica ao se deparar com uma tarefa ou história incompleta. Ele é forçado a reter a atenção até fechar o loop.",
    application: "Abra loops mentais logo no início de anúncios e VSLs, prometendo a resposta para o final.",
    example: "'Existe uma única frase que eu disse para o cliente que salvou o contrato... e eu vou te revelar ela nos próximos 40 segundos.'"
  },
  {
    title: "Ancoragem Cognitiva",
    icon: Target,
    description: "A primeira informação recebida estabelece o ponto de referência para todas as decisões subsequentes do cérebro.",
    application: "Apresente o valor astronômico da dor ou de soluções concorrentes ineficientes antes de introduzir sua oferta acessível.",
    example: "'Contratar uma agência tradicional te custaria pelo menos R$ 5.000 por mês de fee fixo...'"
  }
];

const ARCHETYPES = [
  {
    name: "O Herói em Jornada",
    role: "Aquele que veio do nada, enfrentou monstros e traz a fórmula da vitória.",
    icon: Flame,
    color: "from-red-500/20 to-orange-500/10 border-red-500/20 text-red-300",
    mechanism: "Identificação aspiracional e prova viva de viabilidade.",
    pitfall: "Soar arrogante ou inalcançável. Se você parecer perfeito demais, o lead perde a conexão de identidade.",
    hook: "'Eu estava exatamente onde você está hoje: falido, com o nome sujo e sem saber como seria o dia de amanhã. Até que eu descobri...'"
  },
  {
    name: "O Sábio Mentor",
    role: "O detentor do conhecimento técnico, guiado por dados, lógica e ciência.",
    icon: Brain,
    color: "from-blue-500/20 to-indigo-500/10 border-blue-500/20 text-blue-300",
    mechanism: "Segurança intelectual e autoridade incontestável.",
    pitfall: "Ser excessivamente chato, prolixo ou acadêmico. Traduza termos técnicos complexos em metáforas simples.",
    hook: "'Após analisar mais de 1.400 páginas de vendas e rastrear R$ 4.2 milhões em anúncios pagos, identificamos esse padrão exato...'"
  },
  {
    name: "O Rebelde Inconformado",
    role: "O que quebra as regras do sistema, expõe os mentirosos e prega a independência.",
    icon: Zap,
    color: "from-amber-500/20 to-yellow-500/10 border-amber-500/20 text-amber-300",
    mechanism: "Cumplicidade e sentimento de rebeldia compartilhada (inimigo comum).",
    pitfall: "Ser agressivo demais de forma gratuita. Mantenha a raiva focada no 'problema/sistema' e não nas pessoas.",
    hook: "'A verdade nua e crua que os gurus de marketing tentam esconder de você para continuarem vendendo cursos inúteis...'"
  },
  {
    name: "A Pessoa Comum (O Espelho)",
    role: "O avatar idêntico ao lead. Não tem poderes, apenas aplicou um método simples.",
    icon: UserCheck,
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/20 text-emerald-300",
    mechanism: "Gera a sensação imediata de: 'Se ele que é comum conseguiu, eu também consigo'.",
    pitfall: "Falta de autoridade no início. Precisa compensar mostrando resultados claros obtidos logo após aplicar o método.",
    hook: "'Eu não sou programador, nunca fui bom em matemática e trabalho como atendente. Mas essa ferramenta me gerou R$ 342 extras ontem...'"
  }
];

export function CreativeMatrix({ onSelectAngle, onSelectPrompt }: { 
  onSelectAngle?: (angleKey: string, text: string) => void;
  onSelectPrompt?: (prompt: string) => void;
}) {
  const [selectedAngle, setSelectedAngle] = useState<SubAngle | null>(MATRIX_BLOCKS[0].angles[0]);
  const [stateFilter, setStateFilter] = useState<"negacao" | "frustracao" | "desejo_latente" | "pronto">("frustracao");
  
  // Calibrador state
  const [specLevel, setSpecLevel] = useState<number>(3);
  
  // Custom topic states for Calibrador
  const [customTopic, setCustomTopic] = useState("");
  const [customNiche, setCustomNiche] = useState("marketing");
  
  const currentBlock = useMemo(() => {
    if (!selectedAngle) return null;
    return MATRIX_BLOCKS.find(b => b.angles.some(a => a.key === selectedAngle.key)) || null;
  }, [selectedAngle]);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  // Spec levels dynamic rendering
  const getSpecExample = (level: number) => {
    switch(level) {
      case 1:
        return {
          title: "Nível 1: Ultra Genérico (Perda de Dinheiro)",
          desc: "Ignorado instantaneamente pelo cérebro por parecer panfletagem digital.",
          text: "Quer ganhar dinheiro na internet trabalhando do conforto da sua casa?",
          tips: "Falta de contexto situacional, termos saturados, promessa inflacionada sem conexão real."
        };
      case 2:
        return {
          title: "Nível 2: Informativo Direto",
          desc: "Melhor que o Nível 1, mas ainda frio e focado em recursos, não no benefício.",
          text: "Aprenda a trabalhar como designer freelancer prestando serviços para empresas e fature R$ 5 mil mensais.",
          tips: "Define o produto/nicho, mas ainda não gera identificação emocional ou dor situacional."
        };
      case 3:
        return {
          title: "Nível 3: Específico Contextualizado (Padrão de Conversão)",
          desc: "Conversão ideal. Toca numa dor específica e num benefício direto tangível.",
          text: "Como designers estão saindo de freelas chatos de R$ 50 no Canva para contratos mensais de R$ 2.000 recorrentes, usando um portfólio de 3 páginas.",
          tips: "Usa números tangíveis, define o inimigo (freelas de R$50) e traz clareza na solução."
        };
      case 4:
        return {
          title: "Nível 4: Emocional Cinematográfico",
          desc: "Extremamente persuasivo. Descreve a cena física vivida pelo avatar.",
          text: "Você desliga o computador às 21h, com as costas doendo, sabendo que cobrou R$ 100 por um logo que levou 3 dias para fazer. O cliente te manda mais alterações no WhatsApp... e você aceita só por medo de ficar sem o pagamento.",
          tips: "Gera efeito espelho instantâneo. A pessoa se vê fisicamente na cena descrita."
        };
      case 5:
        return {
          title: "Nível 5: Cirúrgico Hiper-Segmentado (Retargeting Quente)",
          desc: "Impacto devastador de conversão. Ancoragem sensorial completa.",
          text: "Domingo à noite, 22:43. O silêncio da casa só é quebrado pelo barulho do ventilador de teto. Você olha para a geladeira aberta, procurando um doce para aliviar a ansiedade da segunda-feira no escritório. O estômago aperta só de lembrar do trânsito das 7h e da voz do seu chefe te cobrando relatórios inúteis...",
          tips: "Perfeito para retargeting ou públicos ultra-segmentados. Inegável identificação física e temporal."
        };
      default:
        return { title: "", desc: "", text: "", tips: "" };
    }
  };

  const currentSpec = getSpecExample(specLevel);

  // Generate sequence output
  const [seqNiche, setSeqNiche] = useState("Vendas de Infoproduto");
  const [seqAngleA, setSeqAngleA] = useState("dor_presente");
  const [seqAngleB, setSeqAngleB] = useState("status_reconhecimento");

  const generatedSequencePrompt = useMemo(() => {
    const angleAObj = MATRIX_BLOCKS.flatMap(b => b.angles).find(a => a.key === seqAngleA);
    const angleBObj = MATRIX_BLOCKS.flatMap(b => b.angles).find(a => a.key === seqAngleB);
    
    return `=== PROMPT DE ENGENHARIA DE CRIATIVOS ===
Por favor, crie uma sequência persuasiva de criativos para o nicho de [${seqNiche}].
Você usará a técnica do contraste emocional combinando dois ângulos estratégicos:

ÂNGULO 1: [${angleAObj?.label}]
Lógica: ${angleAObj?.description}
Instrução do Hook: Crie um pattern interrupt focado no estado de "Frustração". Exemplo de tom: "${angleAObj?.states.frustracao}"

ÂNGULO 2: [${angleBObj?.label}]
Lógica: ${angleBObj?.description}
Instrução da Transição/Identidade: Faça a transição da dor anterior mostrando como a resolução ativa a identidade de "${angleBObj?.states.desejo_latente}"

[ESTRUTURA DA COPY]:
1. Gancho (Hook 3s): Utilize uma quebra de padrão visual e auditiva.
2. Tensão (30s): Desenvolva a cena física baseada no Ângulo 1 (Dor/Medo).
3. Ruptura (15s): Apresente o mecanismo único da oferta como a única saída lógica.
4. Resolução & CTA (15s): Encerre ancorando na nova identidade do avatar (Ângulo 2) com chamada para ação clara.`;
  }, [seqNiche, seqAngleA, seqAngleB]);

  return (
    <Card className="border-border bg-card/45 backdrop-blur-md text-foreground">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Compass className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl font-serif text-primary flex items-center gap-2">
                Matriz de Engenharia de Criativos de Elite
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Framework neurológico de 16 ângulos, camadas cognitivas e calibrador de especificidade situacional.
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-primary/20 border-primary/40 text-primary text-[10px] uppercase font-mono px-2.5 py-1">
            CTO Copy Module
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="angles" className="w-full">
          <TabsList className="grid w-full grid-cols-4 rounded-none border-b border-border/30 bg-muted/20 text-muted-foreground p-0 h-12">
            <TabsTrigger value="angles" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-1.5 text-xs font-semibold h-full">
              <Zap className="h-3.5 w-3.5" /> 16 Ângulos Persuasivos
            </TabsTrigger>
            <TabsTrigger value="neuro" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-1.5 text-xs font-semibold h-full">
              <Brain className="h-3.5 w-3.5" /> Camadas Neuro-Sensoriais
            </TabsTrigger>
            <TabsTrigger value="calibrator" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-1.5 text-xs font-semibold h-full">
              <Eye className="h-3.5 w-3.5" /> Calibrador de Especificidade
            </TabsTrigger>
            <TabsTrigger value="sequences" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-1.5 text-xs font-semibold h-full">
              <Sparkles className="h-3.5 w-3.5" /> Orquestrador de Sequências
            </TabsTrigger>
          </TabsList>

          {/* ==========================================
              TAB 1: 16 ÂNGULOS PERSUASIVOS (GRID)
              ========================================== */}
          <TabsContent value="angles" className="p-6 m-0 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Matrix Left Grid */}
              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MATRIX_BLOCKS.map((block) => {
                    const BlockIcon = block.icon;
                    return (
                      <div key={block.title} className={`p-4 rounded-xl border bg-gradient-to-br ${block.gradient} transition-all`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`h-8 w-8 rounded-lg bg-background/50 border border-border flex items-center justify-center ${block.color}`}>
                            <BlockIcon className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <h4 className="font-serif font-bold text-sm text-foreground">{block.title}</h4>
                            <p className="text-[10px] text-muted-foreground leading-snug">{block.description}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {block.angles.map((angle) => {
                            const isSelected = selectedAngle?.key === angle.key;
                            return (
                              <button
                                key={angle.key}
                                onClick={() => setSelectedAngle(angle)}
                                className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all duration-150 ${
                                  isSelected 
                                    ? "bg-background border-primary text-primary ring-1 ring-primary/25 shadow-md shadow-primary/5 -translate-y-0.5" 
                                    : "bg-background/40 hover:bg-background/80 border-border/40 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <span className="block truncate">{angle.label}</span>
                                <span className="block text-[8px] text-muted-foreground mt-0.5 truncate">{angle.description.slice(0, 36)}...</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Angle Detail Panel */}
              <div className="lg:col-span-4">
                {selectedAngle && currentBlock && (
                  <Card className="border-border/60 bg-muted/20 sticky top-4">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-background ${currentBlock.color}`}>
                          Bloco {currentBlock.title}
                        </span>
                        <Badge variant="outline" className="text-[9px] gap-1 bg-background/40">
                          <Brain className="h-2.5 w-2.5" /> Neuro-Gatilho
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-serif text-primary mt-2">{selectedAngle.label}</CardTitle>
                      <CardDescription className="text-xs">{selectedAngle.description}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pt-4 space-y-4 text-xs">
                      {/* Neurological brief */}
                      <div className="p-3 rounded-lg bg-background border border-border/40 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-[10px] text-primary uppercase tracking-wider">
                          <Info className="h-3 w-3" /> Foco Neurológico
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">{selectedAngle.neuroTrigger}</p>
                      </div>

                      {/* State Matrix Selector */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado do Avatar</label>
                          <div className="flex gap-1">
                            {(["negacao", "frustracao", "desejo_latente", "pronto"] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => setStateFilter(st)}
                                className={`text-[8px] px-1.5 py-0.5 rounded transition ${
                                  stateFilter === st
                                    ? "bg-primary text-primary-foreground font-semibold"
                                    : "bg-background border border-border text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {st === "negacao" ? "Negação" : st === "frustracao" ? "Frustrado" : st === "desejo_latente" ? "Desejo" : "Pronto"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* State specific copy block */}
                        <div className="p-3 rounded-lg border bg-background/50 relative group">
                          <p className="italic text-[11px] leading-relaxed pr-8">
                            "{selectedAngle.states[stateFilter]}"
                          </p>
                          <button 
                            onClick={() => copyText(selectedAngle.states[stateFilter])}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-primary transition opacity-0 group-hover:opacity-100"
                            title="Copiar texto do estado"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Copy Hooks */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hooks recomendados para Criativos</div>
                        <div className="space-y-2">
                          {selectedAngle.hooks.map((hook, i) => (
                            <div key={i} className="p-2.5 rounded-lg border bg-background/80 flex items-start gap-2 relative group hover:border-primary/30 transition-colors">
                              <span className="text-[9px] font-mono text-primary bg-primary/10 rounded px-1 mt-0.5">{i+1}</span>
                              <p className="text-[11px] leading-snug flex-1 pr-6">"{hook}"</p>
                              
                              <button 
                                onClick={() => {
                                  copyText(hook);
                                  if (onSelectAngle) onSelectAngle(selectedAngle.key, hook);
                                }}
                                className="absolute top-2 right-2 text-muted-foreground hover:text-primary transition opacity-0 group-hover:opacity-100"
                                title="Selecionar e Copiar Hook"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {onSelectAngle && (
                        <Button 
                          onClick={() => {
                            const selText = `[Ângulo: ${selectedAngle.label}] - Hook: "${selectedAngle.hooks[0]}" - Contexto: "${selectedAngle.states[stateFilter]}"`;
                            onSelectAngle(selectedAngle.key, selText);
                            toast.success("Ângulo injetado no criador de criativos!");
                          }}
                          className="w-full text-xs gap-1.5"
                          size="sm"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Injetar este Ângulo no Briefing
                        </Button>
                      )}

                    </CardContent>
                  </Card>
                )}
              </div>

            </div>
          </TabsContent>

          {/* ==========================================
              TAB 2: CAMADAS NEURO-SENSORIAIS
              ========================================== */}
          <TabsContent value="neuro" className="p-6 m-0 space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Neurociência column */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-primary flex items-center gap-2">
                    <Brain className="h-5 w-5 text-red-400" /> Neurobiologia da Atenção
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Como o cérebro humano filtra criativos nos primeiros 3 segundos. Ignore isso e seu lead fará scroll-down sem pensar.
                  </p>
                </div>

                <div className="grid gap-3">
                  {NEURO_CONCEPTS.map((c) => {
                    const Icon = c.icon;
                    return (
                      <div key={c.title} className="p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-background/80 transition-all space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <h4 className="text-xs font-bold text-foreground">{c.title}</h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{c.description}</p>
                        <div className="text-[10px] p-2 bg-muted/40 rounded border border-border/30">
                          <span className="font-bold text-[9px] uppercase tracking-wider text-primary block mb-0.5">Como Aplicar:</span>
                          {c.application}
                        </div>
                        <div className="text-[10px] italic text-muted-foreground/90 pl-2 border-l border-primary/30">
                          Exemplo: "{c.example}"
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Arquétipos column */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-primary flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-purple-400" /> Arquétipos de Personagem (Quem Fala)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quem fala no criativo ou story dita qual circuito neurológico e qual nível de confiança é disparado no cérebro do lead.
                  </p>
                </div>

                <div className="grid gap-3">
                  {ARCHETYPES.map((a) => {
                    const Icon = a.icon;
                    return (
                      <div key={a.name} className={`p-4 rounded-xl border bg-gradient-to-br ${a.color} transition-all space-y-2 relative group`}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <h4 className="text-xs font-bold text-foreground">{a.name}</h4>
                        </div>
                        <p className="text-[11px] font-medium leading-snug">{a.role}</p>
                        
                        <div className="grid grid-cols-2 gap-2 text-[9px] pt-1">
                          <div>
                            <span className="font-bold uppercase tracking-wider text-muted-foreground block">Mecanismo:</span>
                            <span className="text-muted-foreground/80">{a.mechanism}</span>
                          </div>
                          <div>
                            <span className="font-bold uppercase tracking-wider text-red-300 block">Armadilha/Erro:</span>
                            <span className="text-red-300/80">{a.pitfall}</span>
                          </div>
                        </div>

                        <div className="p-2 bg-background/60 rounded border border-border/30 text-[10px] relative group">
                          <span className="font-bold uppercase tracking-wider text-primary text-[8px] block mb-0.5">Hook pronto para uso:</span>
                          <span className="italic">"{a.hook}"</span>
                          
                          <button 
                            onClick={() => copyText(a.hook)}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-primary transition opacity-0 group-hover:opacity-100"
                            title="Copiar Hook do Arquétipo"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </TabsContent>

          {/* ==========================================
              TAB 3: CALIBRADOR DE ESPECIFICIDADE
              ========================================== */}
          <TabsContent value="calibrator" className="p-6 m-0 space-y-6 animate-fade-in">
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="text-center space-y-2">
                <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                  <Lightbulb className="h-3.5 w-3.5" /> O Efeito "Como você sabe disso?"
                </Badge>
                <h3 className="font-serif text-2xl text-primary">Calibrador de Especificidade Situacional</h3>
                <p className="text-xs text-muted-foreground max-w-xl mx-auto">
                  A resistência à venda desaparece quando a copy descreve a cena cotidiana do avatar com tanta precisão que ele sente que você esteve vigiando a vida dele.
                </p>
              </div>

              {/* Interactive Slider Card */}
              <Card className="border-border/50 bg-background/55 p-6 space-y-6">
                
                {/* Slider bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>Nível 1: Genérico</span>
                    <span className="text-primary bg-primary/10 rounded px-2 py-0.5 font-mono text-[10px]">Espec. Nível {specLevel}/5</span>
                    <span>Nível 5: Cinematográfico</span>
                  </div>
                  <Slider 
                    value={[specLevel]} 
                    min={1} 
                    max={5} 
                    step={1} 
                    onValueChange={(val) => setSpecLevel(val[0])}
                    className="cursor-pointer"
                  />
                </div>

                {/* Live Preview Display */}
                <div className="p-5 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent space-y-3 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-primary tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3 w-3 animate-spin" /> {currentSpec.title}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{currentSpec.desc}</span>
                  </div>
                  
                  <p className="font-serif text-sm italic leading-relaxed text-foreground bg-background/30 p-4 rounded-lg border border-border/30">
                    "{currentSpec.text}"
                  </p>

                  <div className="text-xs p-3 bg-background/80 rounded border border-border/40 space-y-1">
                    <span className="font-bold text-[9px] uppercase tracking-wider text-muted-foreground block">Diagnóstico Copywriter:</span>
                    <p className="text-muted-foreground text-[11px] leading-snug">{currentSpec.tips}</p>
                  </div>

                  <button 
                    onClick={() => copyText(currentSpec.text)}
                    className="absolute top-4 right-4 bg-background border p-1.5 rounded-md text-muted-foreground hover:text-primary hover:border-primary/50 transition"
                    title="Copiar esta variação calibrada"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

              </Card>

              {/* Educational Matrix Anchor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <span className="font-serif font-bold text-primary flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Onde usar Nível 3-4?
                  </span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Ideal para anúncios frios de topo de funil. É específico o bastante para qualificar os cliques sem alienar a audiência de massa do Facebook/Meta Ads.
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <span className="font-serif font-bold text-primary flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Onde usar Nível 5?
                  </span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Destinado a públicos quentes, e-mails de recuperação de carrinho, VSLs longas ou remarketing direto de compra. A identificação profunda quebra o ceticismo de quem já conhece o produto.
                  </p>
                </div>
              </div>

            </div>
          </TabsContent>

          {/* ==========================================
              TAB 4: ORQUESTRADOR DE SEQUÊNCIAS
              ========================================== */}
          <TabsContent value="sequences" className="p-6 m-0 space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Sequence control left */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-primary flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Matrix Combinator
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie uma ponte psicológica combinando dois ângulos distintos no mesmo anúncio. O cérebro responde ao contraste emocional.
                  </p>
                </div>

                <Card className="p-4 bg-background/55 border-border/50 space-y-4">
                  {/* Nicho Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nicho / Produto</label>
                    <Select value={seqNiche} onValueChange={setSeqNiche}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vendas de Infoproduto BR">Vendas de Infoproduto (High Ticket)</SelectItem>
                        <SelectItem value="Saúde & Emagrecimento Corporativo">Saúde & Emagrecimento (Bem-Estar)</SelectItem>
                        <SelectItem value="Transição de Carreira para TI">Transição de Carreira (Tecnologia)</SelectItem>
                        <SelectItem value="Investimentos & Finanças Pessoais">Finanças & Investimento Premium</SelectItem>
                        <SelectItem value="Estética & Skincare Personalizado">Beleza & Estética Avançada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Combination presets */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Combinações Clássicas de Alta Conversão</label>
                    <div className="space-y-1.5">
                      <button 
                        onClick={() => { setSeqAngleA("dor_presente"); setSeqAngleB("incompreendido"); }}
                        className="w-full text-left text-[11px] p-2 rounded-lg border bg-background hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>Dor Presente + Incompreendido (Cirúrgico)</span>
                        <ArrowRight className="h-3 w-3 text-primary" />
                      </button>
                      <button 
                        onClick={() => { setSeqAngleA("fracasso_repetido"); setSeqAngleB("liberdade_escolha"); }}
                        className="w-full text-left text-[11px] p-2 rounded-lg border bg-background hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>Fracasso Repetido + Liberdade (Contraste)</span>
                        <ArrowRight className="h-3 w-3 text-primary" />
                      </button>
                      <button 
                        onClick={() => { setSeqAngleA("perda_controle"); setSeqAngleB("rebelde_inconformado"); }}
                        className="w-full text-left text-[11px] p-2 rounded-lg border bg-background hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>Perda de Controle + Rebelde (Manifesto)</span>
                        <ArrowRight className="h-3 w-3 text-primary" />
                      </button>
                    </div>
                  </div>

                  {/* Manual Selector Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Ângulo A (Gatilho inicial)</label>
                      <select 
                        value={seqAngleA}
                        onChange={(e) => setSeqAngleA(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-[11px]"
                      >
                        {MATRIX_BLOCKS.flatMap(b => b.angles).map(a => (
                          <option key={a.key} value={a.key}>{a.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Ângulo B (Resolução/CTA)</label>
                      <select 
                        value={seqAngleB}
                        onChange={(e) => setSeqAngleB(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-[11px]"
                      >
                        {MATRIX_BLOCKS.flatMap(b => b.angles).map(a => (
                          <option key={a.key} value={a.key}>{a.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </Card>
              </div>

              {/* Generated Prompt Output right */}
              <div className="lg:col-span-7">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3 border-b border-border/30 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-serif text-primary">Receita de Prompt Combinador</CardTitle>
                      <CardDescription className="text-[10px]">Use no Content Generator IA ou no ChatGPT para gerar copies estruturadas.</CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => copyText(generatedSequencePrompt)}
                      className="text-xs gap-1 bg-background"
                    >
                      <Copy className="h-3 w-3" /> Copiar Prompt
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <pre className="text-[11px] leading-relaxed bg-background/50 border border-border/40 rounded-lg p-4 font-mono overflow-x-auto whitespace-pre-wrap max-h-[340px]">
                      {generatedSequencePrompt}
                    </pre>

                    {onSelectPrompt && (
                      <Button 
                        onClick={() => {
                          onSelectPrompt(generatedSequencePrompt);
                          toast.success("Prompt injetado com sucesso no Gerador!");
                        }}
                        className="w-full mt-4 text-xs gap-1.5"
                      >
                        <Zap className="h-3.5 w-3.5" /> Injetar Diretamente no Gerador IA
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
}
