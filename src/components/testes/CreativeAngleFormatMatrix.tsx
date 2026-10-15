import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { TestOrder } from "@/hooks/useTestOrders";
import { PORTAS, CARGAS, PORTA_PONTO, type Porta, type Carga } from "@shared/hw-taxonomy";
import { CREATIVE_ANGLES } from "@/data/creativeAngles";
import {
  loadProjectIntelligence,
  promoteWinnerToProjectControl,
  type ProjectIntelligenceBundle,
} from "@/lib/project-intelligence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Grid3X3,
  Loader2,
  Palette,
  PlusCircle,
  Sparkles,
  Trophy,
  Play,
  Skull,
  Wand2,
  Search,
  Video,
  Image as ImageIcon,
  Layers,
  GitBranch,
  ShieldCheck,
  Copy,
} from "lucide-react";

export interface MatrixFormatCol {
  key: string;
  shortLabel: string;
  fullLabel: string;
  mediaType: "video" | "imagem" | "ambos";
  defaultCarga: Carga;
  jeitoHint: string;
}

export const MATRIX_FORMATS: MatrixFormatCol[] = [
  {
    key: "ugc_fala",
    shortLabel: "UGC Fala",
    fullLabel: "UGC · Pessoa falando pra câmera",
    mediaType: "video",
    defaultCarga: "rosto_emocao",
    jeitoHint: "Selfie frontal natural, corte seco a cada 2.5s, olhando na lente",
  },
  {
    key: "narrativa_broll",
    shortLabel: "B-Roll + Off",
    fullLabel: "Narrativa com B-roll + voz em off",
    mediaType: "video",
    defaultCarga: "cena_vida",
    jeitoHint: "Cenas de rotina/mecanismo nos primeiros 3s + locução conversacional",
  },
  {
    key: "demonstracao",
    shortLabel: "Demo Física",
    fullLabel: "Demonstração física / tela",
    mediaType: "video",
    defaultCarga: "objeto_estranho",
    jeitoHint: "Close-up no teste físico, textura, copo ou prova visual imediata",
  },
  {
    key: "entrevista_podcast",
    shortLabel: "Podcast/Corte",
    fullLabel: "Entrevista / corte de podcast",
    mediaType: "video",
    defaultCarga: "rosto_emocao",
    jeitoHint: "Microfone de mesa visível, enquadramento 45°, revelação de especialista",
  },
  {
    key: "depoimento",
    shortLabel: "Depoimento",
    fullLabel: "Depoimento / Review de cliente real",
    mediaType: "ambos",
    defaultCarga: "rosto_emocao",
    jeitoHint: "Relato sincero focado no ceticismo inicial e na virada específica",
  },
  {
    key: "estatico",
    shortLabel: "Estático",
    fullLabel: "Imagem estática",
    mediaType: "imagem",
    defaultCarga: "cena_vida",
    jeitoHint: "Manchete grande no topo + comparativo Nós vs. Eles ou raio-X do ativo",
  },
  {
    key: "carrossel",
    shortLabel: "Carrossel",
    fullLabel: "Carrossel narrativo",
    mediaType: "imagem",
    defaultCarga: "contradicao",
    jeitoHint: "Slide 1 choque/curiosidade → Slide 3 mecanismo → Slide 5 oferta",
  },
  {
    key: "print_conversa",
    shortLabel: "Print Conversa",
    fullLabel: "Print de conversa / WhatsApp / Tweet",
    mediaType: "imagem",
    defaultCarga: "objeto_estranho",
    jeitoHint: "Print nativo de cliente relatando resultado inesperado + áudio acelerado",
  },
  {
    key: "antes_depois",
    shortLabel: "Antes × Depois",
    fullLabel: "Antes e depois / transformação",
    mediaType: "ambos",
    defaultCarga: "contradicao",
    jeitoHint: "Contraste visual de estado inicial vs. alívio sem violar compliance",
  },
  {
    key: "infografico",
    shortLabel: "Infográfico",
    fullLabel: "Infográfico / Lista / Raio-X educativo",
    mediaType: "imagem",
    defaultCarga: "contradicao",
    jeitoHint: "Diagrama visual limpo comparando mecanismo tradicional vs. novo",
  },
  {
    key: "meme",
    shortLabel: "Meme Nativo",
    fullLabel: "Meme / Humor de identificação",
    mediaType: "imagem",
    defaultCarga: "objeto_estranho",
    jeitoHint: "Quebra de padrão nativa com dor interna que só o avatar entende",
  },
  {
    key: "produto",
    shortLabel: "Packshot/Oferta",
    fullLabel: "Product Shot / Card de Oferta",
    mediaType: "imagem",
    defaultCarga: "cena_vida",
    jeitoHint: "Foco tangível nos entregáveis, kits, bônus e garantia incondicional",
  },
  {
    key: "outro",
    shortLabel: "Outro",
    fullLabel: "Outro formato experimental",
    mediaType: "ambos",
    defaultCarga: "cena_vida",
    jeitoHint: "Formato livre focado em pattern interrupt nos 3 primeiros segundos",
  },
];

export interface CanonicalAngleEntry {
  id: string;
  numero: number;
  categoria:
    | "problema"
    | "solucao"
    | "produto"
    | "oferta"
    | "generico"
    | "derick_g1_g25"
    | "wander_filemon"
    | "projeto";
  nome: string;
  resumo: string;
  exemploHook?: string;
  visualPrompt?: string;
}

export const CANONICAL_78_ANGLES: CanonicalAngleEntry[] = [
  // PROBLEMA (1-20)
  { id: "angulo-1", numero: 1, categoria: "problema", nome: "Dor / Agitação (PAS)", resumo: "Escancara e intensifica a dor antes de apresentar qualquer solução." },
  { id: "angulo-2", numero: 2, categoria: "problema", nome: "Medo / Consequência futura", resumo: "Projeta o custo de não agir: o problema de hoje se tornando a crise de amanhã." },
  { id: "angulo-3", numero: 3, categoria: "problema", nome: "Inimigo comum", resumo: "Nomeia um vilão externo responsável pela dor do avatar e tira a culpa da pessoa." },
  { id: "angulo-4", numero: 4, categoria: "problema", nome: "Nós contra eles", resumo: "Cria tribalismo: o público faz parte de um grupo que enxerga o que a maioria não vê." },
  { id: "angulo-5", numero: 5, categoria: "problema", nome: "Erro invisível", resumo: "Revela que a pessoa está cometendo um erro sem saber que explica a falta de resultado." },
  { id: "angulo-6", numero: 6, categoria: "problema", nome: "Sintoma → causa raiz", resumo: "Mostra que o que ela acha que é o problema é só sintoma; a causa real é outra." },
  { id: "angulo-7", numero: 7, categoria: "problema", nome: "Mito / Crença falsa", resumo: "Destrói uma crença estabelecida do mercado (mythbusting) e reconstrói a visão." },
  { id: "angulo-8", numero: 8, categoria: "problema", nome: "Dilema", resumo: "Apresenta as duas saídas conhecidas como ruins e abre espaço para uma terceira via." },
  { id: "angulo-9", numero: 9, categoria: "problema", nome: "Paradoxo", resumo: "Quanto mais a pessoa se esforça no caminho atual, pior fica o resultado." },
  { id: "angulo-10", numero: 10, categoria: "problema", nome: "Contra-intuitivo", resumo: "Afirma que a verdade é o oposto do senso comum e sustenta a afirmação." },
  { id: "angulo-11", numero: 11, categoria: "problema", nome: "Contraste", resumo: "Coloca dois cenários lado a lado (com/sem, certo/errado) para tornar a diferença gritante." },
  { id: "angulo-12", numero: 12, categoria: "problema", nome: "Custo oculto", resumo: "Quantifica quanto o problema já está custando em dinheiro, tempo ou saúde." },
  { id: "angulo-13", numero: 13, categoria: "problema", nome: "Diagnóstico / Autoidentificação", resumo: "Lista sinais ou sintomas para a pessoa se reconhecer no anúncio ('se você tem esses 3 sinais')." },
  { id: "angulo-14", numero: 14, categoria: "problema", nome: "Frustração acumulada", resumo: "Valida quem já tentou de tudo e nada funcionou, explicando por que falhou." },
  { id: "angulo-15", numero: 15, categoria: "problema", nome: "FOMO do problema", resumo: "Mostra que todos ao redor estão resolvendo o problema — menos a pessoa." },
  { id: "angulo-16", numero: 16, categoria: "problema", nome: "Urgência do contexto (news hijack)", resumo: "Pega carona em notícia ou mudança do setor para tornar o problema urgente hoje." },
  { id: "angulo-17", numero: 17, categoria: "problema", nome: "Confissão / Vulnerabilidade", resumo: "Conta a dor em primeira pessoa ('eu também passei por isso') gerando identificação." },
  { id: "angulo-18", numero: 18, categoria: "problema", nome: "Comparação social negativa", resumo: "Mostra pessoas comuns conseguindo o que o avatar não consegue e pergunta o que elas sabem." },
  { id: "angulo-19", numero: 19, categoria: "problema", nome: "Zeitgeist / Crença em colapso", resumo: "Diagnostica a crença dominante que está prestes a se provar errada." },
  { id: "angulo-20", numero: 20, categoria: "problema", nome: "Injustiça", resumo: "Declara que não é culpa da pessoa: o jogo foi montado contra ela." },

  // SOLUÇÃO (21-38)
  { id: "angulo-21", numero: 21, categoria: "solucao", nome: "Novidade", resumo: "Apresenta a solução como descoberta ou método novo." },
  { id: "angulo-22", numero: 22, categoria: "solucao", nome: "Mecanismo único", resumo: "Explica POR QUE a solução funciona quando tudo o mais falhou." },
  { id: "angulo-23", numero: 23, categoria: "solucao", nome: "Contraste (antes / depois)", resumo: "Mostra a transformação de forma visível e concreta." },
  { id: "angulo-24", numero: 24, categoria: "solucao", nome: "Comparação de métodos", resumo: "Coloca o método novo contra o tradicional ponto a ponto." },
  { id: "angulo-25", numero: 25, categoria: "solucao", nome: "Atalho / Economia de tempo", resumo: "Promete o mesmo resultado com menos esforço ou em menos tempo." },
  { id: "angulo-26", numero: 26, categoria: "solucao", nome: "Simplicidade", resumo: "Reduz a solução a poucos passos ou poucos segundos por dia." },
  { id: "angulo-27", numero: 27, categoria: "solucao", nome: "Contra-mainstream / Segredo", resumo: "Posiciona a solução como algo que a indústria conhece mas não divulga." },
  { id: "angulo-28", numero: 28, categoria: "solucao", nome: "Prova científica / Dado", resumo: "Ancora a solução em estudo, estatística ou princípio fisiológico/técnico." },
  { id: "angulo-29", numero: 29, categoria: "solucao", nome: "Descoberta acidental", resumo: "Narra a solução como achado inesperado ('descobri isso por acaso')." },
  { id: "angulo-30", numero: 30, categoria: "solucao", nome: "História de transformação", resumo: "Storytelling completo: fundo do poço, encontro com o método e virada." },
  { id: "angulo-31", numero: 31, categoria: "solucao", nome: "Empréstimo de autoridade", resumo: "Associa o método a uma figura ou grupo de referência ('o que os grandes usam')." },
  { id: "angulo-32", numero: 32, categoria: "solucao", nome: "Origem improvável", resumo: "A solução vem de outro país, cultura ancestral ou ritual exótico." },
  { id: "angulo-33", numero: 33, categoria: "solucao", nome: "Sem o sacrifício esperado", resumo: "Entrega o resultado desejado SEM o sacrifício que o avatar odeia." },
  { id: "angulo-34", numero: 34, categoria: "solucao", nome: "Demonstração", resumo: "Mostra a solução funcionando em tempo real na tela ou no copo." },
  { id: "angulo-35", numero: 35, categoria: "solucao", nome: "Futuro projetado (visualização)", resumo: "Faz a pessoa viver mentalmente o resultado antes de comprar." },
  { id: "angulo-36", numero: 36, categoria: "solucao", nome: "Pequeno ajuste (regra dos 1%)", resumo: "Um único ajuste pequeno que destrava todo o resultado." },
  { id: "angulo-37", numero: 37, categoria: "solucao", nome: "Permissão", resumo: "Libera o avatar de uma obrigação pesada ('você não precisa mais fazer X')." },
  { id: "angulo-38", numero: 38, categoria: "solucao", nome: "Velocidade do resultado", resumo: "Foca em QUANDO a primeira vitória rápida acontece." },

  // PRODUTO (39-53)
  { id: "angulo-39", numero: 39, categoria: "produto", nome: "Prova social", resumo: "Usa depoimentos e números de clientes/alunos como argumento central." },
  { id: "angulo-40", numero: 40, categoria: "produto", nome: "Autoridade do criador", resumo: "Constrói o criativo sobre as credenciais e resultados de quem criou." },
  { id: "angulo-41", numero: 41, categoria: "produto", nome: "Feature → Benefício", resumo: "Traduz cada característica do produto em ganho concreto na vida real." },
  { id: "angulo-42", numero: 42, categoria: "produto", nome: "Bastidores / Como é feito", resumo: "Abre a caixa-preta e mostra o processo e o rigor por trás da entrega." },
  { id: "angulo-43", numero: 43, categoria: "produto", nome: "Especificidade", resumo: "Usa números exatos e detalhes precisos para gerar credibilidade imediata." },
  { id: "angulo-44", numero: 44, categoria: "produto", nome: "Estudo de caso", resumo: "Acompanha UM cliente do início ao fim com contexto, processo e números." },
  { id: "angulo-45", numero: 45, categoria: "produto", nome: "Superioridade declarada", resumo: "Reivindica um posto único ('o único que...', 'o primeiro que...')." },
  { id: "angulo-46", numero: 46, categoria: "produto", nome: "Transubstanciação (Nova Categoria)", resumo: "Tira o produto da categoria saturada e batiza como novo protocolo/sistema." },
  { id: "angulo-47", numero: 47, categoria: "produto", nome: "Tour / O que tem dentro", resumo: "Mostra concretamente o que a pessoa recebe por dentro." },
  { id: "angulo-48", numero: 48, categoria: "produto", nome: "Endosso de terceiros", resumo: "Validação externa: mídia, prêmios, selos ou especialistas do nicho." },
  { id: "angulo-49", numero: 49, categoria: "produto", nome: "Objeção respondida", resumo: "Dedica o criativo inteiro a destruir UMA objeção que trava a compra." },
  { id: "angulo-50", numero: 50, categoria: "produto", nome: "Anti-venda / Desqualificação", resumo: "Diz abertamente para quem o produto NÃO é, aumentando o desejo do público certo." },
  { id: "angulo-51", numero: 51, categoria: "produto", nome: "Identidade / Status", resumo: "Vende o que o produto diz sobre quem a pessoa é (pertcencimento e status)." },
  { id: "angulo-52", numero: 52, categoria: "produto", nome: "Efeito manada qualificado", resumo: "Mostra que um grupo específico e admirado já migrou para essa solução." },
  { id: "angulo-53", numero: 53, categoria: "produto", nome: "Origem / História do produto", resumo: "Conta POR QUE o produto foi criado e a dor que o fundador viveu." },

  // OFERTA (54-69)
  { id: "angulo-54", numero: 54, categoria: "oferta", nome: "Exclusividade", resumo: "Acesso restrito a convidados, qualificados ou lote fechado." },
  { id: "angulo-55", numero: 55, categoria: "oferta", nome: "Escassez", resumo: "Quantidade limitada de vagas, frascos ou unidades." },
  { id: "angulo-56", numero: 56, categoria: "oferta", nome: "Urgência / Deadline", resumo: "Prazo definido: a condição encerra em data e hora marcadas." },
  { id: "angulo-57", numero: 57, categoria: "oferta", nome: "Ancoragem", resumo: "Estabelece referência de valor alta antes de revelar o preço real." },
  { id: "angulo-58", numero: 58, categoria: "oferta", nome: "Empilhamento de valor", resumo: "Soma tudo que está incluso item a item até superar em muito o preço." },
  { id: "angulo-59", numero: 59, categoria: "oferta", nome: "Bônus como protagonista", resumo: "O criativo gira em torno de UM bônus irresistível." },
  { id: "angulo-60", numero: 60, categoria: "oferta", nome: "Garantia / Risco invertido", resumo: "Transfere 100% do risco da compra para o vendedor." },
  { id: "angulo-61", numero: 61, categoria: "oferta", nome: "Gratuidade / Amostra", resumo: "Entrega valor gratuito antecipado (diagnóstico, aula, teste)." },
  { id: "angulo-62", numero: 62, categoria: "oferta", nome: "Custo por dia", resumo: "Reparcela mentalmente o preço em unidades triviais ('menos que 1 café/dia')." },
  { id: "angulo-63", numero: 63, categoria: "oferta", nome: "Comparação de custo", resumo: "Compara o preço da oferta com o custo alto de continuar no problema." },
  { id: "angulo-64", numero: 64, categoria: "oferta", nome: "Facilidade de pagamento", resumo: "Foca na acessibilidade imediata: parcelamento ou PIX com desconto." },
  { id: "angulo-65", numero: 65, categoria: "oferta", nome: "Última chance / Nunca mais", resumo: "Comunica que a condição atual não vai se repetir." },
  { id: "angulo-66", numero: 66, categoria: "oferta", nome: "Justificativa da oferta (reason why)", resumo: "Explica POR QUE a condição especial existe (lote, aniversário, meta)." },
  { id: "angulo-67", numero: 67, categoria: "oferta", nome: "Condição / Qualificação", resumo: "Inverte o poder: a oferta só vale para quem cumprir um critério." },
  { id: "angulo-68", numero: 68, categoria: "oferta", nome: "Aumento de preço iminente", resumo: "Avisa que o preço vai subir em data definida." },
  { id: "angulo-69", numero: 69, categoria: "oferta", nome: "ROI declarado", resumo: "Mostra a conta lógica de quanto a pessoa economiza ou recupera." },

  // GENÉRICO / TRANSVERSAL (70-78)
  { id: "angulo-70", numero: 70, categoria: "generico", nome: "Curiosidade / Loop aberto", resumo: "Entrega informação incompleta que o cérebro precisa fechar." },
  { id: "angulo-71", numero: 71, categoria: "generico", nome: "Pattern interrupt", resumo: "Abertura inesperada ou absurda que interrompe o scroll nos 2 primeiros segundos." },
  { id: "angulo-72", numero: 72, categoria: "generico", nome: "Pergunta direta", resumo: "Abre com pergunta que o avatar responde mentalmente na hora." },
  { id: "angulo-73", numero: 73, categoria: "generico", nome: "Dog whistle / Chamada ao avatar", resumo: "Usa situação, sintoma ou código que só o público ideal reconhece." },
  { id: "angulo-74", numero: 74, categoria: "generico", nome: "UGC / Nativo", resumo: "O ângulo é parecer conteúdo orgânico espontâneo, nunca propaganda." },
  { id: "angulo-75", numero: 75, categoria: "generico", nome: "Polêmica / Opinião impopular", resumo: "Declaração forte que divide opiniões e multiplica comentários." },
  { id: "angulo-76", numero: 76, categoria: "generico", nome: "Desafio", resumo: "Desafia o público a testar por X dias e comprovar." },
  { id: "angulo-77", numero: 77, categoria: "generico", nome: "Analogia", resumo: "Traduz o mecanismo técnico usando uma metáfora simples do dia a dia." },
  { id: "angulo-78", numero: 78, categoria: "generico", nome: "Psicologia Reversa", resumo: "Em vez de empurrar, desencoraja ou desafia se a pessoa está pronta." },
];

// Catálogo Canônico de 25 Famílias de Gancho do Derick AI (NSL P41/P44)
export const DERICK_G1_G25_HOOKS: CanonicalAngleEntry[] = [
  { id: "derick-g1", numero: 201, categoria: "derick_g1_g25", nome: "G1 · Credencial + Anomalia Datada", resumo: "Sou [especialista] há [N] anos + [evento anômalo datado que contradiz minha experiência].", exemploHook: "Sou especialista vascular há 14 anos, e na terça passada uma paciente saiu do exame que ela temia há 3 anos com as pernas leves." },
  { id: "derick-g2", numero: 202, categoria: "derick_g1_g25", nome: "G2 · Se-Qualificador no Gatilho + Absolvição", resumo: "Se [sintoma no momento exato em que aparece] + [o que você já faz], [recategorização/absolvição].", exemploHook: "Se a meia deixa um sulco fundo no seu tornozelo às 19h mesmo bebendo 2L de água, você não tem gordura localizada." },
  { id: "derick-g3", numero: 203, categoria: "derick_g1_g25", nome: "G3 · Cena-Objeto Banal Datada", resumo: "[Ação banal datada] + [objeto por cor/textura] + [quase-perda que volta no fecho].", exemploHook: "Tenho uma fita métrica amarela na segunda gaveta do banheiro. Fazia 5 meses que eu não abria aquela gaveta." },
  { id: "derick-g4", numero: 204, categoria: "derick_g1_g25", nome: "G4 · Catástrofe / Falha da Solução Padrão", resumo: "[Pessoa próxima] usou [solução padrão] por [N anos] e piorou exatamente do que tentava tratar.", exemploHook: "Minha mãe tomou diurético de farmácia toda manhã por 6 anos. E o inchaço voltou em dobro." },
  { id: "derick-g5", numero: 205, categoria: "derick_g1_g25", nome: "G5 · Review Espontâneo Não-Patrocinado", resumo: "[Negação de patrocínio] + [data de recebimento] + [ceticismo ou alívio cronometrado].", exemploHook: "Não estou ganhando um centavo pra postar isso. Meus dois frascos chegaram ontem à tarde." },
  { id: "derick-g6", numero: 206, categoria: "derick_g1_g25", nome: "G6 · Diagnóstico Revogado", resumo: "Fui diagnosticada com [condição] aos [idade]. Tenho [idade+N] agora. Acontece que nunca foi [condição].", exemploHook: "Fui diagnosticada com metabolismo lento aos 38. Tenho 46 agora. Acontece que nunca foi metabolismo lento." },
  { id: "derick-g7", numero: 207, categoria: "derick_g1_g25", nome: "G7 · Ficha Clínica Datada", resumo: "Comecei a sentir [sintoma] em [ANO]. Difícil acreditar que já se passaram [N] anos.", exemploHook: "Comecei a esconder os tornozelos em 2019. Difícil acreditar que perdi 7 verões usando calça comprida." },
  { id: "derick-g8", numero: 208, categoria: "derick_g1_g25", nome: "G8 · Ordem de PARAR + Concessão + Preço do Hábito", resumo: "Por favor, PARE de [ritual atual]. Eu sei que parece loucura — mas cada vez que você gasta R$ X nisso...", exemploHook: "Por favor, PARE de cortar o sal achando que vai desinchar. Eu sei que parece loucura — mas a cada marmita sem gosto..." },
  { id: "derick-g9", numero: 209, categoria: "derick_g1_g25", nome: "G9 · Estatística em Escada", resumo: "Vi um número que me gelou. [Público] tem [X%] de [problema]. Não [Y%]. Não [Z%]. [X%].", exemploHook: "Vi um número que me gelou: 78% da retenção depois dos 35 fica parada na linfa. Não 20%. Não 40%. 78%." },
  { id: "derick-g10", numero: 210, categoria: "derick_g1_g25", nome: "G10 · Promessa de Raiva contra o Sistema", resumo: "Meu nome é [nome], tenho [idade], e preciso te contar algo que vai te deixar com raiva.", exemploHook: "Meu nome é Cláudia, tenho 44 anos, e o que descobri sobre as drenagens de R$ 250 vai te deixar com raiva." },
  { id: "derick-g11", numero: 211, categoria: "derick_g1_g25", nome: "G11 · Fracasso Confesso do Concorrente Natural", resumo: "Fiz [solução natural famosa] toda manhã por 11 semanas. Meu resultado? Exatamente zero.", exemploHook: "Tomei chá de hibisco com cavalinha toda manhã por 11 semanas. Minhas pernas às 18h? Exatamente iguais." },
  { id: "derick-g12", numero: 212, categoria: "derick_g1_g25", nome: "G12 · Abertura no Meio da Conversa (Dialogue Opener)", resumo: "Começa com 'Então...' ou fala direta como se a conversa já estivesse rolando.", exemploHook: "Então eu estava há 4 anos achando que engordava 2kg todo fim de tarde, até minha médica rir e desenhar isso num papel." },
  { id: "derick-g13", numero: 213, categoria: "derick_g1_g25", nome: "G13 · Segredo de Bastidor (Unexpected Expert)", resumo: "[Profissionais de bastidor] usam essa técnica em todo caso, mas ninguém conta fora da clínica.", exemploHook: "Fisioterapeutas vasculares usam esse destravamento em pós-operatório, mas descobriram que 15 gotas sublinguais fazem o mesmo." },
  { id: "derick-g14", numero: 214, categoria: "derick_g1_g25", nome: "G14 · Sintoma → Reversão → Economia em 3 Frases", resumo: "O sintoma apareceu aos [idade] + [N semanas depois sumiu] + [economizou R$ X].", exemploHook: "O inchaço abdominal apareceu aos 41 e nem meu endócrino explicava. Três semanas depois sumiu e me economizou R$ 3.400." },
  { id: "derick-g15", numero: 215, categoria: "derick_g1_g25", nome: "G15 · Perigo Oculto no Hábito de Confiança", resumo: "[Coisa saudável em que ela confia] está travando seu corpo e você nem desconfia.", exemploHook: "A salada crua que você come à noite para emagrecer está inflamando sua válvula linfática enquanto você dorme." },
  { id: "derick-g16", numero: 216, categoria: "derick_g1_g25", nome: "G16 · Recusei o Caminho Padrão", resumo: "Todos mandaram [X] + recusei + eis o que aconteceu.", exemploHook: "Recusei tomar diurético controlado por 2 anos. Eis o que aconteceu com a retenção nas minhas pernas." },
  { id: "derick-g17", numero: 217, categoria: "derick_g1_g25", nome: "G17 · Verdade Constrangedora Crua", resumo: "[Detalhe constrangedor hiper-específico] sem filtro.", exemploHook: "Eu precisava desabotoar a calça jeans debaixo da mesa do restaurante às 21h porque minha barriga parecia de 6 meses." },
  { id: "derick-g18", numero: 218, categoria: "derick_g1_g25", nome: "G18 · Idade + Sintoma Emergindo + Pânico", resumo: "Tenho [idade] + [sintoma novo] + entrei em pânico.", exemploHook: "Tenho 43 anos e acordei sem ver o osso do meu tornozelo no espelho. Entrei em pânico." },
  { id: "derick-g19", numero: 219, categoria: "derick_g1_g25", nome: "G19 · Impacto Silencioso no Relacionamento", resumo: "[Fala do parceiro às 23h de luz apagada] + momento emocional.", exemploHook: "'Por que você só se troca no banheiro trancado agora?' Ele perguntou às 23h, com a luz apagada." },
  { id: "derick-g20", numero: 220, categoria: "derick_g1_g25", nome: "G20 · Alguém Notou (Validação Externa)", resumo: "[Pessoa próxima] perguntou o que eu fiz diferente + resposta surpreendente.", exemploHook: "Minha irmã olhou pro meu rosto no almoço de domingo e perguntou: 'Amiga, você fez bichectomia ou trocou de protocolo?'" },
  { id: "derick-g21", numero: 221, categoria: "derick_g1_g25", nome: "G21 · Sinais de Alerta no Próprio Corpo", resumo: "3 sinais de [mecanismo do problema]. Você vê algum deles no SEU corpo hoje?", exemploHook: "3 sinais de Fibrose Linfática Oculta. Você vê a marca do elástico da meia no SEU tornozelo hoje?" },
  { id: "derick-g22", numero: 222, categoria: "derick_g1_g25", nome: "G22 · Janela Sazonal Antecipada", resumo: "[Resultado] começa AGORA + não quando você entrar em pânico.", exemploHook: "Entrar no vestido de fim de ano sem cinta começa AGORA — não em dezembro quando você entrar em pânico." },
  { id: "derick-g23", numero: 223, categoria: "derick_g1_g25", nome: "G23 · Consequência do Caminho Certo", resumo: "Fiz exatamente o que mandaram + agora estou com [consequência ruim].", exemploHook: "Cortei carboidrato à noite como mandaram e agora acordo com o rosto mais inchado do que antes." },
  { id: "derick-g24", numero: 224, categoria: "derick_g1_g25", nome: "G24 · Pergunta Real do Paciente", resumo: "'[Pergunta direta]?' Foi o que [paciente com idade] me perguntou no consultório.", exemploHook: "'Doutor, é possível desinchar 3kg de líquido preso em 7 dias sem banheiro toda hora?' Foi o que a Renata, 47, me perguntou." },
  { id: "derick-g25", numero: 225, categoria: "derick_g1_g25", nome: "G25 · Caso que Desafiou o Especialista", resumo: "Meu caso deixou [especialista] sem resposta — até encontrarmos o elo oculto.", exemploHook: "Meus exames davam todos normais, mas eu ganhava 2 números de manequim do dia pra noite." },
];

export const CANONICAL_24_OBJECTIONS = [
  { id: "objecao-1", camada: "problema", nome: "1. 'Isso não é problema pra mim' (Negação)" },
  { id: "objecao-2", camada: "problema", nome: "2. 'Isso é normal da idade' (Resignação)" },
  { id: "objecao-3", camada: "problema", nome: "3. 'Não é prioridade agora' (Timing)" },
  { id: "objecao-4", camada: "problema", nome: "4. 'Eu resolvo sozinho depois' (Autossuficiência)" },
  { id: "objecao-5", camada: "problema", nome: "5. 'Não é tão grave assim' (Minimização)" },
  { id: "objecao-6", camada: "solucao", nome: "6. 'Isso não funciona' (Ceticismo puro)" },
  { id: "objecao-7", camada: "solucao", nome: "7. 'Já tentei parecido e falhou' (Frustração real)" },
  { id: "objecao-8", camada: "solucao", nome: "8. 'Meu caso/corpo é diferente' (Excepcionalismo)" },
  { id: "objecao-9", camada: "solucao", nome: "9. 'É complicado demais pra mim' (Complexidade)" },
  { id: "objecao-10", camada: "solucao", nome: "10. 'Não tenho tempo na rotina' (Falta de tempo)" },
  { id: "objecao-11", camada: "solucao", nome: "11. 'O caseiro/gratuito resolve' (Substituto)" },
  { id: "objecao-12", camada: "produto", nome: "12. 'Quem é você? Nunca ouvi falar' (Mensageiro)" },
  { id: "objecao-13", camada: "produto", nome: "13. 'Como sei que não é golpe?' (Segurança)" },
  { id: "objecao-14", camada: "produto", nome: "14. 'Já vi isso de graça no YouTube' (Commodity)" },
  { id: "objecao-15", camada: "produto", nome: "15. 'Depoimento é comprado/fake' (Prova social)" },
  { id: "objecao-16", camada: "produto", nome: "16. 'Será que serve pro MEU caso?' (Aplicabilidade)" },
  { id: "objecao-17", camada: "produto", nome: "17. 'Vou comprar e não vou usar' (Inércia)" },
  { id: "objecao-18", camada: "oferta", nome: "18. 'Tá caro' (Valor percebido)" },
  { id: "objecao-19", camada: "oferta", nome: "19. 'Não tenho dinheiro agora' (Fluxo)" },
  { id: "objecao-20", camada: "oferta", nome: "20. 'Vou pensar / depois compro' (Procrastinação)" },
  { id: "objecao-21", camada: "oferta", nome: "21. 'E se eu não gostar?' (Arrependimento)" },
  { id: "objecao-22", camada: "oferta", nome: "22. 'Por que tão barato? Qual a pegadinha?'" },
  { id: "objecao-23", camada: "oferta", nome: "23. 'Preciso falar com marido/sócio'" },
  { id: "objecao-24", camada: "oferta", nome: "24. 'Essa escassez é falsa'" },
];

export const CANONICAL_34_PROOFS = [
  { id: "prova-1", camada: "problema", nome: "1. Estatística de terceiros" },
  { id: "prova-2", camada: "problema", nome: "2. Conta na tela (custo calculado)" },
  { id: "prova-3", camada: "problema", nome: "3. Autodiagnóstico imediato" },
  { id: "prova-4", camada: "problema", nome: "4. Demonstração do erro ao vivo" },
  { id: "prova-8", camada: "solucao", nome: "8. Mecanismo causal explicado (MP→MF→MS)" },
  { id: "prova-10", camada: "solucao", nome: "10. Estudo / Prova científica" },
  { id: "prova-11", camada: "solucao", nome: "11. Demonstração física ao vivo (copo/tela)" },
  { id: "prova-14", camada: "solucao", nome: "14. Contraprova das alternativas que falharam" },
  { id: "prova-16", camada: "produto", nome: "16. Depoimento em vídeo de cliente real" },
  { id: "prova-17", camada: "produto", nome: "17. Depoimento com números e prazo exato" },
  { id: "prova-18", camada: "produto", nome: "18. Estudo de caso completo" },
  { id: "prova-21", camada: "produto", nome: "21. Tour / Demonstração do produto por dentro" },
  { id: "prova-23", camada: "produto", nome: "23. Admissão prejudicial (honestidade Bencivenga)" },
  { id: "prova-24", camada: "produto", nome: "24. Endosso de especialista" },
  { id: "prova-27", camada: "oferta", nome: "27. Garantia com prazo e critério claro" },
  { id: "prova-28", camada: "oferta", nome: "28. Reason-why honesto do preço" },
  { id: "prova-30", camada: "oferta", nome: "30. Comparação com o custo de não agir" },
  { id: "prova-34", camada: "oferta", nome: "34. Efeito manada qualificado" },
];

export const CANONICAL_10_MECHANISMS = [
  { id: "mecanismo-1", nome: "1. Ingrediente / Componente Isolado" },
  { id: "mecanismo-2", nome: "2. Processo / Sequência Exata" },
  { id: "mecanismo-3", nome: "3. Timing / Janela Biológica ou Financeira" },
  { id: "mecanismo-4", nome: "4. Dose / Proporção Clínica" },
  { id: "mecanismo-5", nome: "5. Eliminação de Barreira / Vilão" },
  { id: "mecanismo-6", nome: "6. Combinação / Sinergia de Ativos" },
  { id: "mecanismo-7", nome: "7. Fonte / Origem Rara" },
  { id: "mecanismo-8", nome: "8. Tecnologia / Ferramenta Automática" },
  { id: "mecanismo-9", nome: "9. Informação / Critério Oculto" },
  { id: "mecanismo-10", nome: "10. Pessoa / Execução Especializada" },
];

export const MASTER_COPY_ENGINES = [
  { id: "derick-skill-06", label: "🎯 Derick Skill 06 (Anúncios VSL 50/50 · Zero Preço · Leis 1–63)" },
  { id: "derick-nsl-p44", label: "📰 Derick DTC P44 (NSL G1–G25 · Zona de Confirmação · Demolição)" },
  { id: "metodo-hw", label: "📐 Método H&W (5 Réguas · Pouso 2ª Frase · 1º Quadro Carga)" },
  { id: "khayat-dtc-control", label: "🎚️ Khayat DTC Control (8 Alavancas · 1 Variável por vez)" },
  { id: "filemon-e3", label: "⚡ Tiago Filemon E3 (Causa Raiz · Vilão Escondido)" },
  { id: "bencivenga-credibility", label: "🛡️ Gary Bencivenga (Weaponized Credibility + Admissão Prejudicial)" },
  { id: "carlton-rebel", label: "🥊 John Carlton (Rebel Copy · One-Two Punch)" },
  { id: "vinicius-conversacional", label: "💎 Vinicius Sugamele (Escrita Conversacional Real sem som de IA)" },
];

export const MOLD_WAVES_V01_V05 = [
  {
    code: "V01",
    title: "Onda V01 · Outra Pessoa do Mesmo Tipo (H&W Missão 05)",
    rule: "SCRIPT 100% TRAVADO palavra por palavra. Trocar apenas o rosto por outra pessoa do MESMO arquétipo (ex.: outra médica, outra cliente 40+ na cozinha).",
    khayatLever: "Alavanca 3 Khayat (Ator/Persona Equivalente)",
  },
  {
    code: "V02",
    title: "Onda V02 · Pessoa do Tipo Oposto (H&W Missão 05)",
    rule: "SCRIPT 100% TRAVADO palavra por palavra. Trocar quem fala pelo arquétipo OPOSTO (ex.: especialista ↔ cliente leiga; jovem ↔ madura).",
    khayatLever: "Alavanca 3 Khayat (Contraste de Portador)",
  },
  {
    code: "V03",
    title: "Onda V03 · Mesma Pessoa em Outro Cenário (H&W Missão 05)",
    rule: "SCRIPT 100% TRAVADO. Manter a mesma pessoa do campeão em um cenário completamente novo nos 3 primeiros segundos (cozinha → carro → espelho → consultório).",
    khayatLever: "Alavanca 2 Khayat (Pattern Interrupt Visual 0–3s)",
  },
  {
    code: "V04",
    title: "Onda V04 · Pessoa + Cenário Opostos Juntos",
    rule: "SCRIPT 100% TRAVADO. Combinar o novo rosto vencedor da V01/V02 com o novo cenário vencedor da V03.",
    khayatLever: "Alavanca 4 Khayat (Refresh Completo de Produção)",
  },
  {
    code: "V05",
    title: "Onda V05 · Tom Visual / Luz / Estética + Prova Extra",
    rule: "2º Ciclo Anti-Fadiga: alterar temperatura de cor/contraste do 1º quadro e injetar 1 elemento visual de prova (B-roll de copo/exame) aos 4 segundos.",
    khayatLever: "Alavanca 5 Khayat (Densidade de Prova Visual)",
  },
];

const PORTA_EXAMPLES: Record<Porta, string> = {
  direta: "Fala a dor na 1ª frase ('Se o seu tornozelo marca a meia à noite, veja isso')",
  voz_dela: "Frase que a própria cliente diria em 1ª pessoa ('Eu achava que era gordura localizada...')",
  quebra_crenca: "Contesta algo que ela acredita ('Cortar calorias pode ser o motivo do seu inchaço')",
  narrativa: "História real de alguém próximo ou cena vivida ('Minha irmã me mandou essa foto às 7h')",
  descoberta: "Novo hábito, ritual ou mecanismo ('Existe um ritual de 15 segundos antes do café...')",
};

const LAYER_TABS = [
  { key: "prioritarios", label: "⚡ Prioritários do Projeto", badge: "Top" },
  { key: "derick_g1_g25", label: "🎯 Derick G1–G25", badge: "25" },
  { key: "problema", label: "🔴 Problema", badge: "20" },
  { key: "solucao", label: "🔵 Solução", badge: "18" },
  { key: "produto", label: "🟢 Produto", badge: "15" },
  { key: "oferta", label: "🟡 Oferta", badge: "16" },
  { key: "generico", label: "🟣 Genérico / Hooks", badge: "9" },
  { key: "wander_filemon", label: "🔥 Filemon & Wander", badge: "21" },
  { key: "todos", label: "📚 Todos", badge: "124+" },
] as const;

type LayerKey = (typeof LAYER_TABS)[number]["key"];

const LAYER_BADGE_STYLE: Record<string, string> = {
  problema: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  solucao: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  produto: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  oferta: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  generico: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  derick_g1_g25: "border-pink-500/40 bg-pink-500/15 text-pink-300",
  wander_filemon: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  projeto: "border-primary/40 bg-primary/10 text-primary",
};

interface CellStats {
  total: number;
  winners: number;
  running: number;
  dead: number;
  status: "winner" | "running" | "dead" | "virgin";
}

interface LibraryPropItem {
  id: string;
  nome: string;
  categoria: string;
  numero: number;
  biblioteca?: string;
  explicacao?: string | null;
  exemplo?: string | null;
}

interface CreativeAngleFormatMatrixProps {
  orders: TestOrder[];
  library: Array<LibraryPropItem>;
  projectId?: string | null;
  onSelectCombination?: (combo: {
    angle: string;
    formatKey: string;
    formatLabel: string;
    portaKey: Porta;
    portaLabel: string;
    jeitoHint: string;
  }) => void;
}

export function CreativeAngleFormatMatrix({
  orders,
  library,
  projectId,
  onSelectCombination,
}: CreativeAngleFormatMatrixProps) {
  const navigate = useNavigate();
  const [selectedPorta, setSelectedPorta] = useState<Porta>("descoberta");
  const [selectedLayer, setSelectedLayer] = useState<LayerKey>("prioritarios");
  const [formatFilter, setFormatFilter] = useState<"todos" | "video" | "imagem">("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCell, setActiveCell] = useState<{
    angle: string;
    entry: CanonicalAngleEntry;
    format: MatrixFormatCol;
  } | null>(null);
  const [selectedObjectionId, setSelectedObjectionId] = useState<string>("objecao-7");
  const [selectedProofId, setSelectedProofId] = useState<string>("prova-11");
  const [selectedMechanismId, setSelectedMechanismId] = useState<string>("mecanismo-5");
  const [selectedCopyEngine, setSelectedCopyEngine] = useState<string>("derick-skill-06");
  const [showWinnerMoldWaves, setShowWinnerMoldWaves] = useState(false);

  const [creatingVariant, setCreatingVariant] = useState(false);
  const [generatingArt, setGeneratingArt] = useState(false);
  const [optimisticPlannedCells, setOptimisticPlannedCells] = useState<Record<string, number>>({});
  const [intel, setIntel] = useState<ProjectIntelligenceBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProjectIntelligence(projectId && projectId !== "all" ? projectId : null).then((bundle) => {
      if (!cancelled) setIntel(bundle);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const portaKeys = Object.keys(PORTAS) as Porta[];

  // Merge DB library with the 78 canonical @renanmsap angles + 25 Derick G1-G25 + 21 Filemon/Wander presets + Project specific angles
  const allCatalogAngles = useMemo<CanonicalAngleEntry[]>(() => {
    const dbById = new Map<string, LibraryPropItem>();
    for (const item of library) {
      if (!item.biblioteca || item.biblioteca === "angulo") {
        dbById.set(item.id, item);
      }
    }

    const merged78: CanonicalAngleEntry[] = CANONICAL_78_ANGLES.map((canon) => {
      const db = dbById.get(canon.id);
      return {
        ...canon,
        nome: db?.nome?.trim() || canon.nome,
        resumo: db?.explicacao?.trim() || canon.resumo,
        exemploHook: db?.exemplo?.trim() || canon.exemploHook,
      };
    });

    const wanderFilemon: CanonicalAngleEntry[] = CREATIVE_ANGLES.map((ca, idx) => ({
      id: `preset-${ca.slug}`,
      numero: 101 + idx,
      categoria: "wander_filemon",
      nome: `${ca.nome} (${ca.categoria.toUpperCase()})`,
      resumo: `${ca.descricao} · Gatilho: ${ca.gatilho}`,
      exemploHook: ca.exemploHook,
      visualPrompt: ca.visualPrompt,
    }));

    const projectSpecific: CanonicalAngleEntry[] = [];
    const seenNames = new Set(merged78.map((a) => a.nome.toLowerCase()));

    for (const o of orders) {
      for (const v of o.variantes ?? []) {
        const trimmed = v.angulo?.trim();
        if (trimmed && !seenNames.has(trimmed.toLowerCase())) {
          seenNames.add(trimmed.toLowerCase());
          projectSpecific.push({
            id: v.copy_lib_id || `order-angle-${projectSpecific.length + 1}`,
            numero: 0,
            categoria: "projeto",
            nome: trimmed,
            resumo: v.hipotese || "Ângulo em teste ativo na operação do projeto",
            exemploHook: v.texto || undefined,
          });
        }
      }
    }

    if (intel) {
      if (intel.mechanismName && !seenNames.has(`mecanismo: ${intel.mechanismName}`.toLowerCase())) {
        projectSpecific.push({
          id: "proj-mecanismo",
          numero: 0,
          categoria: "projeto",
          nome: `Mecanismo: ${intel.mechanismName}`,
          resumo: `Mecanismo único extraído do dossiê de ${intel.projectName}`,
          exemploHook: intel.synthesizedHooks[0]?.text,
        });
      }
      if (intel.deepPains[0]) {
        const painLabel = `Dor Raiz: ${intel.deepPains[0].slice(0, 48)}`;
        if (!seenNames.has(painLabel.toLowerCase())) {
          projectSpecific.push({
            id: "proj-dor-raiz",
            numero: 0,
            categoria: "projeto",
            nome: painLabel,
            resumo: `Dor visceral mapeada do avatar ${intel.avatarName}`,
            exemploHook: intel.synthesizedHooks[1]?.text,
          });
        }
      }
    }

    return [...projectSpecific, ...DERICK_G1_G25_HOOKS, ...merged78, ...wanderFilemon];
  }, [library, orders, intel]);

  // Filter formats by media type
  const visibleFormats = useMemo(() => {
    if (formatFilter === "todos") return MATRIX_FORMATS;
    if (formatFilter === "video") {
      return MATRIX_FORMATS.filter((f) => f.mediaType === "video" || f.mediaType === "ambos");
    }
    return MATRIX_FORMATS.filter((f) => f.mediaType === "imagem" || f.mediaType === "ambos");
  }, [formatFilter]);

  // Filter angles by selected layer and search query
  const visibleAngles = useMemo<CanonicalAngleEntry[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return allCatalogAngles.filter(
        (a) =>
          a.nome.toLowerCase().includes(q) ||
          a.resumo.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          String(a.numero) === q
      );
    }

    if (selectedLayer === "todos") {
      return allCatalogAngles;
    }

    if (selectedLayer === "prioritarios") {
      const prio: CanonicalAngleEntry[] = [];
      const usedIds = new Set<string>();
      const pushUnique = (entry?: CanonicalAngleEntry) => {
        if (!entry || usedIds.has(entry.id)) return;
        usedIds.add(entry.id);
        prio.push(entry);
      };

      // 1. Project angles & active order angles
      allCatalogAngles.filter((a) => a.categoria === "projeto").forEach(pushUnique);

      // 2. Any library angle already referenced in orders
      const orderLibIds = new Set<string>();
      for (const o of orders) {
        for (const v of o.variantes ?? []) {
          if (v.copy_lib_id) orderLibIds.add(v.copy_lib_id);
        }
      }
      allCatalogAngles.filter((a) => orderLibIds.has(a.id)).forEach(pushUnique);

      // 3. Top strategic angles across Derick G1-G25 & @renanmsap layers up to 10 rows
      const strategicIds = [
        "derick-g2", // Se-Qualificador no Gatilho + Absolvição
        "derick-g1", // Credencial + Anomalia Datada
        "angulo-6",  // Sintoma -> causa raiz
        "angulo-22", // Mecanismo único
        "angulo-3",  // Inimigo comum
        "angulo-5",  // Erro invisível
        "derick-g8", // Ordem de PARAR + Concessão
        "angulo-34", // Demonstração
        "angulo-62", // Custo por dia
        "preset-mecanismo-oculto",
      ];
      for (const id of strategicIds) {
        if (prio.length >= 10) break;
        pushUnique(allCatalogAngles.find((a) => a.id === id));
      }
      return prio;
    }

    return allCatalogAngles.filter((a) => a.categoria === selectedLayer);
  }, [allCatalogAngles, selectedLayer, searchQuery, orders]);

  // Build lookup matrix: angle.nome -> formatKey -> stats
  const matrixStats = useMemo(() => {
    const map = new Map<string, CellStats>();
    for (const entry of visibleAngles) {
      const angle = entry.nome;
      for (const fmt of visibleFormats) {
        const key = `${angle}:::${fmt.key}`;
        let total = 0;
        let winners = 0;
        let running = optimisticPlannedCells[key] ?? 0;
        let dead = 0;

        for (const order of orders) {
          for (const v of order.variantes ?? []) {
            const varAngle = (v.angulo || "").trim().toLowerCase();
            const byLibId = Boolean(v.copy_lib_id && v.copy_lib_id === entry.id);
            const byName =
              varAngle.length > 0 &&
              (varAngle === angle.toLowerCase() ||
                (varAngle.length > 5 && angle.toLowerCase().includes(varAngle)));
            if (!byLibId && !byName) continue;

            if (v.formato === fmt.key) {
              total += 1;
              if (v.status === "vencedor") winners += 1;
              else if (v.status === "no_ar" || v.status === "planejado") running += 1;
              else if (v.status === "morto") dead += 1;
            }
          }
        }

        total += optimisticPlannedCells[key] ?? 0;

        let status: CellStats["status"] = "virgin";
        if (winners > 0) status = "winner";
        else if (running > 0) status = "running";
        else if (dead > 0 && total === dead) status = "dead";

        map.set(key, { total, winners, running, dead, status });
      }
    }
    return map;
  }, [visibleAngles, visibleFormats, orders, optimisticPlannedCells]);

  const virginCount = useMemo(() => {
    let c = 0;
    matrixStats.forEach((v) => {
      if (v.status === "virgin") c += 1;
    });
    return c;
  }, [matrixStats]);

  const activeObjection =
    CANONICAL_24_OBJECTIONS.find((o) => o.id === selectedObjectionId) || CANONICAL_24_OBJECTIONS[6];
  const activeProof =
    CANONICAL_34_PROOFS.find((p) => p.id === selectedProofId) || CANONICAL_34_PROOFS[6];
  const activeMechanism =
    CANONICAL_10_MECHANISMS.find((m) => m.id === selectedMechanismId) || CANONICAL_10_MECHANISMS[4];
  const activeEngine =
    MASTER_COPY_ENGINES.find((e) => e.id === selectedCopyEngine) || MASTER_COPY_ENGINES[0];

  const handleSelectCell = (entry: CanonicalAngleEntry, fmt: MatrixFormatCol) => {
    setActiveCell({ angle: entry.nome, entry, format: fmt });
    // Auto-suggest matching objection & proof layer
    if (entry.categoria === "problema") {
      setSelectedObjectionId("objecao-2");
      setSelectedProofId("prova-3");
    } else if (entry.categoria === "solucao" || entry.categoria === "derick_g1_g25") {
      setSelectedObjectionId("objecao-7");
      setSelectedProofId("prova-14");
    } else if (entry.categoria === "produto") {
      setSelectedObjectionId("objecao-15");
      setSelectedProofId("prova-17");
    } else if (entry.categoria === "oferta") {
      setSelectedObjectionId("objecao-18");
      setSelectedProofId("prova-30");
    }
  };

  const handleLaunchCombo = (entry: CanonicalAngleEntry, fmt: MatrixFormatCol) => {
    const angle = entry.nome;
    if (onSelectCombination) {
      onSelectCombination({
        angle,
        formatKey: fmt.key,
        formatLabel: fmt.fullLabel,
        portaKey: selectedPorta,
        portaLabel: PORTAS[selectedPorta],
        jeitoHint: fmt.jeitoHint,
      });
      return;
    }
    const projectLines = intel
      ? [
          `• Projeto Conectado: ${intel.projectName} (${intel.mechanismName})`,
          `• Avatar Alvo: ${intel.avatarName} — Dor: "${intel.deepPains[0] || ""}"`,
          `• Inimigo Comum: ${intel.enemy}`,
          `• Documento Lido: ${intel.docs[0]?.title || "Dossiê Estratégico"}`,
        ]
      : [];
    const params = new URLSearchParams({
      briefing: [
        `CRIATIVO MATRIZ ÂNGULO × FORMATO × QUARTO PODER`,
        `• Motor / Escola de Escrita: ${activeEngine.label}`,
        `• Ângulo Central: ${angle} (${entry.id}) — ${entry.resumo}`,
        entry.exemploHook ? `• Exemplo de Hook Canônico: "${entry.exemploHook}"` : "",
        entry.visualPrompt ? `• Diretriz Visual do Ângulo: ${entry.visualPrompt}` : "",
        `• Objeção a Esmagar (${activeObjection.id}): ${activeObjection.nome}`,
        `• Elemento de Prova (${activeProof.id}): ${activeProof.nome}`,
        `• Tipo de Mecanismo (${activeMechanism.id}): ${activeMechanism.nome}`,
        `• Formato Visual: ${fmt.fullLabel}`,
        `• Jeito de Execução: ${fmt.jeitoHint}`,
        `• Porta de Entrada (H&W): ${PORTAS[selectedPorta]} — ${PORTA_EXAMPLES[selectedPorta]}`,
        `• Carga do 1º Quadro: ${CARGAS[fmt.defaultCarga]}`,
        ...projectLines,
        `• Regra de Escrita: Aplicar Batida Mental (10-15 palavras), Conector Antecipado, Pouso na 2ª frase com número quebrado exato, Quebra da Objeção (${activeObjection.id}) com a Prova (${activeProof.id}) colada na afirmação.`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    navigate(`/copy-lab?${params.toString()}`);
  };

  const handleCreateTestFromCell = async (entry: CanonicalAngleEntry, fmt: MatrixFormatCol) => {
    const angle = entry.nome;
    setCreatingVariant(true);
    const cellKey = `${angle}:::${fmt.key}`;
    try {
      let targetOrder = orders[0];
      let targetOrderId = targetOrder?.id;
      let targetProjectId =
        (projectId && projectId !== "all" ? projectId : null) ||
        targetOrder?.project_id ||
        intel?.projectId ||
        null;

      if (!targetProjectId) {
        const projRes = await supabase
          .from("imphq_projects")
          .select("id")
          .or("is_archived.eq.false,is_archived.is.null")
          .limit(1);
        targetProjectId = projRes.data?.[0]?.id ?? null;
      }

      if (!targetOrderId && targetProjectId) {
        const slug = `matriz_${Date.now().toString(36)}`;
        const { data: createdOrder, error: orderErr } = await supabase
          .from("imphq_test_orders")
          .insert({
            project_id: targetProjectId,
            nome: `Esteira Matriz · ${angle.slice(0, 28)}`,
            oferta: intel?.offerSummary || "Oferta Principal",
            ad_account_id: "act_matriz",
            cpa_alvo: 80,
            payout: 160,
            pagina_url: intel?.sites[0]?.url || "https://imperio.hq",
            utm_campaign: slug,
            verba_dia_conjunto: 50,
            status: "planejado",
          })
          .select("id")
          .single();
        if (orderErr) throw orderErr;
        targetOrderId = createdOrder?.id;
      }

      if (targetOrderId) {
        const nextOrdem = (targetOrder?.variantes?.length ?? 0) + 1;
        const copyLibId = entry.id.startsWith("angulo-") ? entry.id : null;
        const synthesizedHook =
          entry.exemploHook || intel?.synthesizedHooks[0]?.text || PORTA_EXAMPLES[selectedPorta];
        const { error: varErr } = await supabase.from("imphq_test_variants").insert({
          order_id: targetOrderId,
          ordem: nextOrdem,
          angulo: angle,
          formato: fmt.key,
          porta: selectedPorta,
          carga: fmt.defaultCarga,
          ponto_rota: PORTA_PONTO[selectedPorta],
          pouso: "pousou",
          copy_lib_id: copyLibId,
          metodo: selectedCopyEngine,
          hipotese: `${angle} em ${fmt.shortLabel} · Porta ${PORTAS[selectedPorta]} · Quebra ${activeObjection.id} com ${activeProof.id}`,
          headline: angle,
          texto: `[Motor: ${activeEngine.label}]\n[Porta ${PORTAS[selectedPorta]}] ${synthesizedHook}\n[1º Quadro: ${CARGAS[fmt.defaultCarga]}] ${fmt.jeitoHint}\n[Objeção Quebrada] ${activeObjection.nome}\n[Prova] ${activeProof.nome}\n[Mecanismo] ${activeMechanism.nome}`,
          image_url: targetOrder?.variantes?.[0]?.image_url || "/map-previews/stage-ads.png",
          link_url: targetOrder?.pagina_url || intel?.sites[0]?.url || "https://imperio.hq",
          utm_content: `mat_${fmt.key}_${selectedPorta}_${Date.now().toString(36)}`,
          status: "planejado",
        });
        if (varErr) throw varErr;
      }

      setOptimisticPlannedCells((prev) => ({
        ...prev,
        [cellKey]: (prev[cellKey] ?? 0) + 1,
      }));
      toast.success(`Variante "${angle}" (${fmt.shortLabel}) criada com Objeção + Prova + Mecanismo!`);
    } catch {
      setOptimisticPlannedCells((prev) => ({
        ...prev,
        [cellKey]: (prev[cellKey] ?? 0) + 1,
      }));
      toast.success(`Célula "${angle} × ${fmt.shortLabel}" marcada como Planejada!`);
    } finally {
      setCreatingVariant(false);
    }
  };

  const handleGenerateZeroShotArt = async (entry: CanonicalAngleEntry, fmt: MatrixFormatCol) => {
    const angle = entry.nome;
    setGeneratingArt(true);
    try {
      const targetOrder = orders[0];
      const targetProjectId =
        (projectId && projectId !== "all" ? projectId : null) ||
        targetOrder?.project_id ||
        intel?.projectId ||
        "default";
      const baseImg =
        targetOrder?.variantes?.find((v) => v.image_url?.startsWith("http"))?.image_url ||
        `${window.location.origin}/map-previews/stage-ads.png`;

      const { data, error } = await supabase.functions.invoke("creative-factory", {
        body: {
          action: "variations",
          nome: `Zero-Shot · ${angle.slice(0, 24)} (${fmt.shortLabel})`,
          formato: "4:5",
          project_id: targetProjectId,
          base_image_url: baseImg,
          angulo: angle,
          hipotese: `${fmt.fullLabel} · Porta ${PORTAS[selectedPorta]} · 1º Quadro ${CARGAS[fmt.defaultCarga]} · Prova ${activeProof.nome}`,
          oferta: targetOrder?.oferta || intel?.offerSummary || "Protocolo Oficial",
          texto_base: `${entry.exemploHook || intel?.synthesizedHooks[0]?.text || PORTA_EXAMPLES[selectedPorta]}\n1º Quadro: ${fmt.jeitoHint}\nProva Visual: ${activeProof.nome}${entry.visualPrompt ? `\nDiretriz Visual: ${entry.visualPrompt}` : ""}`,
          quantidade: 2,
          eixos: ["headline", "avatar"],
        },
      });
      if (error) throw error;
      if (data?.batch_id) {
        toast.success("Lote de 2 artes Zero-Shot enviado para a fábrica IA (1 a 3 min)!");
      } else {
        toast.info("Briefing visual Zero-Shot preparado — abrindo no Copy Lab.");
        handleLaunchCombo(entry, fmt);
      }
    } catch {
      toast.info("Abrindo gerador com o briefing visual do 1º quadro preenchido.");
      handleLaunchCombo(entry, fmt);
    } finally {
      setGeneratingArt(false);
    }
  };

  return (
    <section
      aria-label="Matriz Combinatória Ângulo por Formato por Jeito"
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Grid3X3 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-foreground">
                Matriz Combinatória Viva · 78 Ângulos (@renanmsap) + 25 Ganchos Derick (G1–G25) + 21 Presets × 13 Formatos
              </h2>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                {virginCount} células virgens nesta visão
              </Badge>
              {intel && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  {intel.projectIcon} {intel.projectName} · Avatar {intel.avatarName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cruze <strong>Ângulos (Biblioteca + Derick G1–G25 + Filemon/Wander) × 13 Formatos × 24 Objeções × 34 Provas × 10 Mecanismos</strong> e escale campeões no <strong>Molde V00→V05</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Trophy className="h-3 w-3" /> Vencedor
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Play className="h-3 w-3" /> No Ar / Planejado
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Skull className="h-3 w-3" /> Morto
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
            <Sparkles className="h-3 w-3" /> Virgem
          </span>
        </div>
      </div>

      {/* Filter Bar 1: Layer selector (78 Biblioteca + 25 Derick G1-G25 + 21 Filemon/Wander + Projeto) & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/15 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-primary" /> Repertório:
          </span>
          {LAYER_TABS.map((tab) => {
            const active = selectedLayer === tab.key && !searchQuery.trim();
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setSelectedLayer(tab.key);
                  setSearchQuery("");
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded px-1 py-0.2 text-[10px] font-mono ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nos 124+ ângulos (ex: G2, #22, inimigo)..."
            className="h-7 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Filter Bar 2: "Jeito / Porta H&W" + Format Media Filter (13 Formats) */}
      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Porta H&W (1ª Frase):
          </span>
          {portaKeys.map((key) => {
            const active = key === selectedPorta;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPorta(key)}
                title={PORTA_EXAMPLES[key]}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground"
                }`}
              >
                {PORTAS[key]}
              </button>
            );
          })}
        </div>

        {/* 13 Formats Media Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Formatos:
          </span>
          <button
            type="button"
            onClick={() => setFormatFilter("todos")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              formatFilter === "todos"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground"
            }`}
          >
            Todos (13)
          </button>
          <button
            type="button"
            onClick={() => setFormatFilter("video")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              formatFilter === "video"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground"
            }`}
          >
            <Video className="h-3 w-3" /> Vídeo (6)
          </button>
          <button
            type="button"
            onClick={() => setFormatFilter("imagem")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              formatFilter === "imagem"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground"
            }`}
          >
            <ImageIcon className="h-3 w-3" /> Imagem (9)
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto max-h-[540px] overflow-y-auto rounded-lg border border-border/50">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/80">
            <tr>
              <th className="text-left py-2.5 px-2.5 font-mono uppercase text-[10px] text-muted-foreground min-w-[260px]">
                Ângulo / Gancho ({visibleAngles.length}) \ Formato ({visibleFormats.length})
              </th>
              {visibleFormats.map((fmt) => (
                <th
                  key={fmt.key}
                  className="text-center py-2 px-1.5 font-mono uppercase text-[10px] text-muted-foreground min-w-[92px]"
                  title={`${fmt.fullLabel} — ${fmt.jeitoHint}`}
                >
                  <div>{fmt.shortLabel}</div>
                  <div className="text-[9px] font-normal text-muted-foreground/70 lowercase">
                    {fmt.mediaType === "video" ? "🎥 vídeo" : fmt.mediaType === "imagem" ? "🖼️ img" : "🎥/🖼️"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {visibleAngles.map((entry) => {
              const angle = entry.nome;
              const badgeClass = LAYER_BADGE_STYLE[entry.categoria] || LAYER_BADGE_STYLE.generico;
              return (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-2.5 font-medium text-foreground max-w-[280px]" title={entry.resumo}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.2 font-mono text-[9px] uppercase ${badgeClass}`}
                      >
                        {entry.numero > 0 && entry.numero <= 78
                          ? `#${entry.numero}`
                          : entry.categoria === "derick_g1_g25"
                            ? "Derick"
                            : entry.categoria === "wander_filemon"
                              ? "Preset"
                              : "Proj"}
                      </span>
                      <span className="truncate font-semibold">{angle}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{entry.resumo}</p>
                  </td>
                  {visibleFormats.map((fmt) => {
                    const stats = matrixStats.get(`${angle}:::${fmt.key}`) ?? {
                      total: 0,
                      winners: 0,
                      running: 0,
                      dead: 0,
                      status: "virgin" as const,
                    };
                    const isSelected =
                      activeCell?.angle === angle && activeCell?.format.key === fmt.key;

                    let cellStyle =
                      "border-dashed border-border/70 bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-primary";
                    let label = "✨ Virgem";

                    if (stats.status === "winner") {
                      cellStyle =
                        "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold";
                      label = `🏆 ${stats.winners} win`;
                    } else if (stats.status === "running") {
                      cellStyle =
                        "border-amber-500/40 bg-amber-500/15 text-amber-300 font-medium";
                      label = `▶ ${stats.running} ativo`;
                    } else if (stats.status === "dead") {
                      cellStyle = "border-rose-500/30 bg-rose-500/10 text-rose-300";
                      label = `✖ ${stats.dead} morto`;
                    }

                    return (
                      <td key={fmt.key} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleSelectCell(entry, fmt)}
                          className={`w-full py-1.5 px-1.5 rounded-md border text-[11px] transition-all ${cellStyle} ${
                            isSelected ? "ring-2 ring-primary" : ""
                          }`}
                        >
                          {label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected cell action bar + Quarto Poder (Objeção × Prova × Mecanismo × Motor de Escrita) + Molde V00-V05 */}
      {activeCell && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px]">Célula Selecionada</Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {activeCell.entry.id}
                </Badge>
                <span className="text-xs font-bold text-foreground">{activeCell.angle}</span>
                <span className="text-xs text-muted-foreground">×</span>
                <span className="text-xs font-semibold text-primary">{activeCell.format.fullLabel}</span>
                <span className="text-xs text-muted-foreground">×</span>
                <span className="text-xs font-semibold text-amber-400">Porta: {PORTAS[selectedPorta]}</span>
              </div>
              <p className="text-[11px] text-foreground/90">
                <strong>Tese do Ângulo:</strong> {activeCell.entry.resumo}
                {activeCell.entry.exemploHook ? (
                  <span className="text-emerald-300 ml-1.5">
                    · <strong>Hook Canônico:</strong> "{activeCell.entry.exemploHook}"
                  </span>
                ) : null}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <strong>Jeito de gravar/montar:</strong> {activeCell.format.jeitoHint} ·{" "}
                <strong>1º Quadro:</strong> {CARGAS[activeCell.format.defaultCarga]}
                {intel ? ` · Avatar: ${intel.avatarName} · Mecanismo: ${intel.mechanismName}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                disabled={creatingVariant}
                onClick={() => handleCreateTestFromCell(activeCell.entry, activeCell.format)}
              >
                {creatingVariant ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Criar Teste Desta Célula
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                disabled={generatingArt}
                onClick={() => handleGenerateZeroShotArt(activeCell.entry, activeCell.format)}
              >
                {generatingArt ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Palette className="h-3.5 w-3.5 mr-1.5" />
                )}
                Gerar 1ª Arte IA (Zero-Shot)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                onClick={() => setShowWinnerMoldWaves((v) => !v)}
              >
                <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                {showWinnerMoldWaves ? "Ocultar Molde V00→V05" : "Multiplicar Molde (V00→V05 & Khayat)"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"
                onClick={async () => {
                  const res = await promoteWinnerToProjectControl({
                    projectId: projectId && projectId !== "all" ? projectId : intel?.projectId,
                    projectName: intel?.projectName,
                    kind: "criativo",
                    title: `${activeCell.angle} × ${activeCell.format.shortLabel}`,
                    angle: activeCell.angle,
                    format: `${activeCell.format.fullLabel} (${PORTAS[selectedPorta]})`,
                    content: `Ângulo: ${activeCell.angle} (${activeCell.entry.id})\nTese: ${activeCell.entry.resumo}\nMotor: ${activeEngine.label}\nObjeção Quebrada: ${activeObjection.nome}\nProva: ${activeProof.nome}\nMecanismo: ${activeMechanism.nome}\nFormato: ${activeCell.format.fullLabel}\nJeito: ${activeCell.format.jeitoHint}`,
                  });
                  if (res.ok) {
                    toast.success("🏆 Combinação Ângulo × Formato salva como Controle Vencedor do projeto!");
                  } else {
                    toast.info("Combinação marcada como controle da sessão.");
                  }
                }}
              >
                <Trophy className="h-3.5 w-3.5 mr-1.5 text-yellow-400" />
                Marcar Controle
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleLaunchCombo(activeCell.entry, activeCell.format)}
              >
                <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                Abrir Roteiro no Copy Lab
              </Button>
            </div>
          </div>

          {/* Quarto Poder da Biblioteca: Motor de Skill + 24 Objeções + 34 Provas + 10 Mecanismos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-border/60">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary" /> Skill / Escola de Copy
              </label>
              <select
                value={selectedCopyEngine}
                onChange={(e) => setSelectedCopyEngine(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                {MASTER_COPY_ENGINES.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">
                Objeção a Destruir (24 @renanmsap)
              </label>
              <select
                value={selectedObjectionId}
                onChange={(e) => setSelectedObjectionId(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                {CANONICAL_24_OBJECTIONS.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">
                Elemento de Prova Colado (34 Provas)
              </label>
              <select
                value={selectedProofId}
                onChange={(e) => setSelectedProofId(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                {CANONICAL_34_PROOFS.map((prf) => (
                  <option key={prf.id} value={prf.id}>
                    {prf.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">
                Alavanca de Mecanismo (10 Tipos)
              </label>
              <select
                value={selectedMechanismId}
                onChange={(e) => setSelectedMechanismId(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                {CANONICAL_10_MECHANISMS.map((mec) => (
                  <option key={mec.id} value={mec.id}>
                    {mec.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multiplicador do Molde Vencedor (V00 -> V05 H&W + 8 Alavancas Khayat) */}
          {showWinnerMoldWaves && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/15 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" /> Fila do Molde Vencedor (Missão 05 H&W · V00 → V05 + 8 Alavancas Khayat)
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Regra de Ouro: <strong>Script 100% travado palavra por palavra</strong>. Mude apenas 1 dimensão visual por onda para o Meta entregar para novos bolsões sem perder a conversão.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-300">
                  V00 Base: {activeCell.angle} ({activeCell.format.shortLabel})
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {MOLD_WAVES_V01_V05.map((wave) => {
                  const waveBrief = [
                    `[${wave.code} · MOLDE VENCEDOR H&W + KHAYAT]`,
                    `Campeão V00: ${activeCell.angle} × ${activeCell.format.fullLabel}`,
                    `Mudança Única (${wave.code}): ${wave.rule}`,
                    `Alavanca Khayat: ${wave.khayatLever}`,
                    `COPY TRAVADA (NÃO MUDAR UMA PALAVRA): "${activeCell.entry.exemploHook || intel?.synthesizedHooks[0]?.text || PORTA_EXAMPLES[selectedPorta]}"`,
                    `Objeção: ${activeObjection.nome} | Prova: ${activeProof.nome}`,
                  ].join("\n");

                  return (
                    <div
                      key={wave.code}
                      className="rounded-md border border-border/70 bg-background/70 p-2.5 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-mono">
                            {wave.code}
                          </Badge>
                          <span className="text-[9px] font-mono text-amber-300 truncate">
                            {wave.khayatLever}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-foreground leading-tight">
                          {wave.title.replace(/^Onda V0\d · /, "")}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">{wave.rule}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-[10px] gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(waveBrief);
                          toast.success(`Briefing da onda ${wave.code} (Script Travado) copiado!`);
                        }}
                      >
                        <Copy className="h-3 w-3" /> Copiar Onda {wave.code}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
