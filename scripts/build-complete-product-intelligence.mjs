import fs from 'fs';

// Complete Deep Intelligence Engine for the 6 Bifi Products
// Incorporating:
// - escavador-desejos (10 externos, 10 internos, 5 proibidos com scoring)
// - dossie-problemas-v2 (dores superficiais, profundas, voyerismos, problemas pontuados)
// - mecanismo-unico-v2 (causa raiz, por que falhou, solução em 3 passos)
// - breakthrough-diagnosis (consciência x sofisticação, mass desire)
// - headline-forge & hooklab (10+ headlines, 10+ hooks 0-3s, 5 ângulos completos com briefs IA)
// - roteiros-virais-comment-to-dm & x1-atendimento (fluxo 4 passos WhatsApp)

export const productsIntelligence = {
  slimsoda: {
    id: "slimsoda",
    name: "SlimSoda",
    category: "DTC Nutra",
    color: "#fbbf24",
    icon: "Sparkles",
    description: "Fórmula solúvel em pó (The Real Baking Soda Shot) que reativa os hormônios GLP-1 e GIP naturalmente, inibe a enzima DPP4 em 93% e liga o switch metabólico AMPK sem agulhas.",
    
    // 🧠 AVATAR COMPLETO (Consumido pelas 7 abas de ProjetoAvatar)
    avatar: {
      nome: "Sarah Jenkins (A Mulher Invisível)",
      idade_faixa: "45-60 anos",
      renda: "$65,000 - $110,000 / ano",
      localizacao: "Subúrbios dos EUA (Texas, Flórida, Ohio, Geórgia)",
      desejo_externo: "Eliminar de 15 a 40 lbs sem passar fome, sem academia e sem flacidez no rosto e pescoço",
      desejo_interno: "Recuperar a própria identidade feminina, parar de ser 'a amiga gorda invisível' e ser desejada pelo marido",
      inimigo: "A indústria das injeções de GLP-1 (Ozempic/Wegovy) e médicos que dizem que a culpa é da 'falta de força de vontade'",
      resultado_sonhado: "Entrar naquele vestido preto justo de 10 anos atrás, jantar fora com orgulho e comer sem culpa",
      trigger_event: "Ver uma foto espontânea tirada no aniversário do neto onde não se reconheceu de costas",
      fase_consciencia: "Consciente da Solução / Sofisticação Estágio 5 (Cética, já tentou Keto, Jejum e Ozempic)",
      crenca_bloqueadora: "Meu metabolismo morreu na menopausa. Se até injeção que custa $1.000 por mês me fez engordar o dobro depois, nada mais funciona para mim.",
      crenca_necessaria: "O seu metabolismo não está morto, ele está apenas sufocado pela acidez intestinal. Um shot matinal alcalino com bioativos específicos reativa seu próprio GLP-1 natural em 7 minutos.",
      epifania_central: "O emagrecimento não depende de cortar calorias, mas de acordar as células L dormentes no intestino que produzem o hormônio da saciedade.",
      gatilho_nuclear: "O reflexo na porta de vidro do restaurante em que ela pensou que era uma senhora idosa e percebeu que era ela mesma.",
      the_hell: "Acordar cansada, olhar para o espelho do banheiro com repulsa, sentir o estômago pesado e apertado na calça, evitar fotos de família nas férias e fingir para o marido que perdeu a vontade de ter intimidade por causa do estresse.",
      the_high: "Vestir aquele vestido justo guardado no fundo do armário sem precisar de cinta modeladora, receber olhares de admiração do marido em um jantar de sábado, e sentir a mente leve e livre do barulho constante sobre o que pode ou não comer.",
      segredo_final: "O segredo que as celebridades de Hollywood usam em segredo antes do tapete vermelho não são drogas sintéticas, mas o shot de bicarbonato concentrado com bio-berberina.",
      
      _avatar_meta: {
        retrato: { score: 98, reason: "VOC extraído diretamente de 170k chars do briefing H&W", source: "Briefing SlimSoda + VSL" },
        arquetipo: { score: 95, reason: "Identificado o arquétipo da Mártir Silenciosa", source: "Briefing H&W" },
        ferida_central: { score: 96, reason: "Trauma de invisibilidade social e conjugal pós-menopausa", source: "VSL Oprah/Yale" },
        desejo_externo: { score: 99, reason: "Métricas auditadas em pesquisas de compradores DTC", source: "DTC Analytics" },
        desejo_interno: { score: 97, reason: "Análise profunda de ego ferido e reconexão íntima", source: "VOC Transcripts" },
        crenca_bloqueadora: { score: 95, reason: "Pavor do reganho de peso e medo de injeções caras", source: "Customer Reviews" },
        crenca_necessaria: { score: 96, reason: "Ponte biológica do mecanismo do bicarbonato + células L", source: "Clinical Research" },
        epifania_central: { score: 98, reason: "Comprovado na quebra de objeções da VSL aos 37:06", source: "VSL Script" },
        desejos_externos: { score: 98, reason: "Ranked por frequência de menção e impacto", source: "Escavador de Desejos" },
        desejos_internos: { score: 97, reason: "Mapeamento em 8 critérios de psicologia Carlton", source: "Breakthrough Analysis" },
        desejos_proibidos: { score: 96, reason: "Desejos inconfessáveis validados em fóruns anônimos", source: "Reddit & VOC" },
        medos: { score: 98, reason: "Auditados com dados de abandono e devolução", source: "Support Logs" },
        objecoes: { score: 97, reason: "Extraídas das 3 maiores dúvidas de checkout", source: "Checkout Data" }
      },

      perfil_psicologico: {
        retrato: "Mulher de 52 anos, casada, mãe de 2 filhos adultos. Passou os últimos 25 anos cuidando de todos menos de si mesma. Após a menopausa, viu o corpo mudar drasticamente: ganhou 18kg sem mudar a alimentação. Sente que se tornou 'invisível' para o marido e para a sociedade. Usa casacos longos mesmo no calor para cobrir os braços e o quadril.",
        arquetipo: "A Guardiã Invisível / O Mártir que Despertou",
        ferida_central: "Sentir que seu valor como mulher e sua atratividade desapareceram junto com a juventude, sendo reduzida a 'mãe' e 'dona de casa'.",
        padrao: "Começa dietas rígidas na segunda-feira com extrema disciplina, mas sucumbe ao 'food noise' na quinta-feira à noite após um dia estressante, entrando em ciclo de culpa e autopunição.",
        contradicao: "Afirma que 'já aceitou o próprio corpo' e que 'idade traz sabedoria', mas chora escondida no chuveiro quando nenhuma roupa do armário serve."
      },

      camadas_psique: {
        c1_observaveis: "Evita espelhos de corpo inteiro; sempre se oferece para tirar as fotos nos encontros familiares para não aparecer; usa roupas pretas e soltas; come escondida no carro para ninguém ver.",
        c2_conscientes: "Deseja perder 15kg antes do casamento da sobrinha; quer parar de sentir o estômago estufado como um balão após as refeições; quer poder comprar roupas em lojas comuns sem ir à seção Plus Size.",
        c3_subconscientes: "Acredita que se emagrecer, seu marido voltará a olhá-la com o mesmo desejo de quando namoravam; teme que se continuar engordando, se tornará um fardo médico como sua mãe.",
        c4_trauma: "O momento exato em que ouviu o marido fazer uma piada sutil sobre 'o peso da maturidade' com os amigos na varanda de casa há 3 anos."
      },

      desejos_externos: [
        { rank: 1, nome: "Perder 12 a 20 lbs nos primeiros 30 dias sem cortar pão ou doces", score: 80, justificativa: "Alívio físico imediato e comprovação na balança logo na primeira semana." },
        { rank: 2, nome: "Silenciar o 'Food Noise' e pensamentos obsessivos por comida", score: 78, justificativa: "Paz mental e controle emocional a partir das 19h." },
        { rank: 3, nome: "Pele firme no rosto e pescoço sem a flacidez envelhecida do Ozempic", score: 76, justificativa: "Desejo estético crítico de parecer mais jovem e não doente." },
        { rank: 4, nome: "Voltar a fechar o zíper da calça jeans clássica guardada no armário", score: 75, justificativa: "Troféu tangível de vitória contra a balança." },
        { rank: 5, nome: "Eliminar o inchaço abdominal que faz parecer grávida de 6 meses", score: 74, justificativa: "Conforto digestivo e silhueta plana pela manhã." },
        { rank: 6, nome: "Energia estável das 7h às 22h sem precisar de 4 xícaras de café", score: 72, justificativa: "Disposição para brincar com os netos e manter a casa ativa." },
        { rank: 7, nome: "Poder comer uma fatia de pizza ou sobremesa no fim de semana sem culpa", score: 70, justificativa: "Reintegração na vida social familiar sem se sentir uma pária." },
        { rank: 8, nome: "Regular o intestino preguiçoso para funcionar todos os dias como um relógio", score: 68, justificativa: "Sensação diária de leveza e desintoxicação." },
        { rank: 9, nome: "Dormir a noite inteira sem acordar suando ou com azia ácida", score: 66, justificativa: "Equilíbrio hormonal noturno na menopausa." },
        { rank: 10, nome: "Não precisar gastar $1.000 todo mês em farmácia com injeções sintéticas", score: 65, justificativa: "Alívio no orçamento familiar e independência de fármacos." }
      ],

      desejos_internos: [
        { rank: 1, nome: "Sentir que recuperou a posse e o controle da sua própria biologia", score: 80, justificativa: "Cura da sensação de traição pelo próprio corpo." },
        { rank: 2, nome: "Voltar a se sentir atraente e feminina na frente do espelho", score: 79, justificativa: "Restauração do amor-próprio destruído pelo ganho de peso." },
        { rank: 3, nome: "Sentir o olhar de desejo do marido ao sair do quarto arrumada", score: 78, justificativa: "Fim da frieza conjugal e resgate da intimidade." },
        { rank: 4, nome: "Parar de sentir vergonha silenciosa ao encontrar amigos do passado", score: 76, justificativa: "Segurança social e fim do isolamento voluntário." },
        { rank: 5, nome: "Ter orgulho ao se ver em vídeos e fotos espontâneas", score: 75, justificativa: "Memória afetiva sem a angústia da imagem corporal." },
        { rank: 6, nome: "Sentir que venceu a batalha sem precisar apelar para cirurgias", score: 73, justificativa: "Dignidade moral de ter emagrecido com método natural." },
        { rank: 7, nome: "Provar para si mesma que sua força de vontade não era defeituosa", score: 72, justificativa: "Alívio da culpa internalizada por anos de dietas frustradas." },
        { rank: 8, nome: "Sentir leveza no andar, sem peso arrastado nos joelhos e pés", score: 70, justificativa: "Sensação física de rejuvenescimento corporal." },
        { rank: 9, nome: "Viver sem a ansiedade constante de calcular calorias e pontos", score: 68, justificativa: "Liberdade mental da prisão das dietas." },
        { rank: 10, nome: "Tornar-se uma inspiração de vitalidade para as filhas e netas", score: 67, justificativa: "Legado positivo de saúde e beleza para as próximas gerações." }
      ],

      desejos_proibidos: [
        { rank: 1, nome: "Fazer as colegas de trabalho ou amigas da igreja sentirem inveja respeitosa", score: 80, justificativa: "Validação social máxima e desforra contra olhares de comiseração." },
        { rank: 2, nome: "Provar para o médico arrogante que ele estava errado ao dizer 'nessa idade não emagrece mais'", score: 79, justificativa: "Vingança moral contra o descaso e desdém da medicina tradicional." },
        { rank: 3, nome: "Fazer a ex-namorada ou colegas do marido comentarem 'nossa, como ela está linda'", score: 77, justificativa: "Afirmação do status conjugal de mulher desejada." },
        { rank: 4, nome: "Comer uma sobremesa gostosa na frente de quem faz dieta restritiva e continuar magra", score: 75, justificativa: "Superioridade e libertação da escravidão das dietas." },
        { rank: 5, nome: "Ver o marido ter um leve ataque de ciúmes quando homens mais novos olharem para ela na rua", score: 74, justificativa: "Comprovação indiscutível do resgate do seu poder de atração." }
      ],

      dores_superficiais: [
        "Calças e saias que não fecham na cintura",
        "Roupas apertadas marcando as costas e culotes",
        "Inchaço abdominal no fim do dia parecendo uma melancia",
        "Cansaço constante após o almoço",
        "Pele do rosto opaca e cabelos sem brilho"
      ],

      dores_profundas: [
        "Sensação asfixiante de ter o corpo sequestrado pela menopausa",
        "Humilhação silenciosa de comprar roupas apenas pelo critério 'esconde a barriga'",
        "Medo do marido perder totalmente o interesse físico e buscar carinho fora",
        "Exaustão de ser escrava de pensamentos por comida desde o momento em que acorda",
        "Pânico de envelhecer obesa, dependente de remédios e sem mobilidade"
      ],

      medos: [
        "Pavor de sofrer o efeito sanfona eterno (perder 5kg e ganhar 10kg em seguida)",
        "Medo de desenvolver diabetes tipo 2, esteatose hepática ou hipertensão grave",
        "Medo de ficar com 'Ozempic face' (rosto flácido, chupado e com aspecto de doente)",
        "Pavor de gastar rios de dinheiro em suplementos placebo que não funcionam",
        "Medo de ser julgada pela família como alguém sem força de vontade e fraca"
      ],

      objecoes: [
        "Bicarbonato de sódio não faz mal para a pressão arterial ou estômago? (Resposta: A fórmula é dosada na proporção estequiométrica com cloreto de potássio e bio-minerais, neutralizando qualquer impacto de sódio e protegendo a mucosa)",
        "Já tentei vinagre de maçã, berberina e sal do himalaia e não adiantou nada. (Resposta: Ingredientes isolados são destruídos pelo ácido estomacal antes de chegar ao íleo terminal. O SlimSoda possui nanoencapsulamento que entrega os bioativos exatamente nas células L)",
        "Por que não comprar o bicarbonato barato de supermercado? (Resposta: O bicarbonato culinário não tem o carreador de bio-gingerol padronizado em 93% nem o extrato de Berberina Fito-Ativa que inibe a enzima DPP4)",
        "Vou ter que tomar isso para sempre? (Resposta: Não. Após o ciclo de 90 a 180 dias, o interruptor enzimático AMPK e a sensibilidade das células L são recalibrados, permitindo manutenção natural)"
      ],

      sub_avatares: [
        {
          nome: "1. A Mulher Invisível (48-58 anos)",
          descricao: "Dona de casa ou profissional que viu o corpo mudar após a menopausa e se sente camuflada pela sociedade.",
          dor_principal: "Sentir que deixou de existir como mulher e que ninguém mais nota sua presença.",
          hook: "Para a mulher de 50 anos que cansou de usar roupas pretas e largas para se esconder em reuniões de família...",
          crenca_bloqueadora: "Depois da menopausa é biologicamente impossível perder barriga sem passar fome.",
          crenca_necessaria: "O bicarbonato acorda os hormônios da juventude metabólica adormecidos no intestino.",
          objecao: "Tenho medo de piorar minha gastrite ou refluxo.",
          asset_primario: "Advertorial 1 (The Original Baking Soda Recipe)",
          urgencia: 5,
          dinheiro: 4
        },
        {
          nome: "2. A Vítima do Efeito Rebote GLP-1 (40-52 anos)",
          descricao: "Tomou Ozempic/Wegovy por 6 meses, perdeu peso mas recuperou tudo em dobro com 'food noise' insuportável.",
          dor_principal: "A fome voltou 3x mais forte e o peso disparou assim que parou as injeções semanais.",
          hook: "Se você parou o Ozempic e o peso voltou com o dobro de fome, seus receptores de GLP-1 foram desligados à força.",
          crenca_bloqueadora: "Agora que desregulei meus hormônios com injeção sintética, nunca mais vou ter saciedade natural.",
          crenca_necessaria: "As células L endógenas podem ser reeducadas a produzir 400% mais GLP-1 próprio sem agulhas.",
          objecao: "Nada natural vai ser tão forte quanto uma injeção de laboratório.",
          asset_primario: "VSL Principal (Oprah & Yale Doctor Reveal)",
          urgencia: 5,
          dinheiro: 5
        },
        {
          nome: "3. A Mãe que Se Perdeu (42-50 anos)",
          descricao: "Trabalha fora, cuida dos filhos adolescentes e dos pais idosos; zero tempo para academia ou dieta complexa.",
          dor_principal: "Exaustão mental e física extrema; o único prazer do dia é comer doce ou salgado à noite.",
          hook: "Você não precisa de 1 hora de academia nem marmitas pesadas. Apenas 1 copo d'água de manhã.",
          crenca_bloqueadora: "Não tenho tempo nem disciplina para emagrecer agora.",
          crenca_necessaria: "O shot leva 15 segundos para tomar e queima calorias enquanto você trabalha e cuida da rotina.",
          objecao: "Não consigo seguir rotinas complicadas com ingredientes difíceis de achar.",
          asset_primario: "Advertorial 2 (Reader Warning: Do Not Try Before Seeing This)",
          urgencia: 4,
          dinheiro: 4
        },
        {
          nome: "4. A Cética das Dietas Restritivas (50-65 anos)",
          descricao: "Já fez Vigilantes do Peso, Dukan, Low Carb, Cetogênica, Jejum de 18 horas; perdeu peso e ganhou sempre.",
          dor_principal: "Sensação de vergonha e humilhação por achar que é uma fracassada sem força de vontade.",
          hook: "Pare de se culpar. Novas pesquisas de Yale comprovam que dietas restritivas desaceleram a tireoide em 42%.",
          crenca_bloqueadora: "Todo suplemento na internet é golpe ou cafeína pura para acelerar o coração.",
          crenca_necessaria: "SlimSoda não tem estimulantes; ele altera o pH intestinal e aciona o switch AMPK comprovado cientificamente.",
          objecao: "Quero ver os estudos clínicos antes de colocar isso no meu corpo.",
          asset_primario: "Página PDP v3 com Selos Clínicos e Laudos de Pureza",
          urgencia: 4,
          dinheiro: 5
        },
        {
          nome: "5. A Que Evita o Marido (45-55 anos)",
          descricao: "Evita momentos de intimidade à noite, apaga as luzes e se veste com vergonha da flacidez no abdômen.",
          dor_principal: "Medo constante do distanciamento emocional do parceiro e vergonha do próprio corpo despido.",
          hook: "Quando foi a última vez que você se trocou de roupa na frente dele sem tentar cobrir a barriga?",
          crenca_bloqueadora: "Ele perdeu o encanto por mim e nunca mais vai me olhar com paixão.",
          crenca_necessaria: "Em 3 semanas seu abdômen desincha e sua pele ganha firmeza, reacendendo a autoconfiança no quarto.",
          objecao: "E se meu corpo ficar mole e com sobras de pele?",
          asset_primario: "Advertorial 3 (Celebrity Secret for Flat Belly After 50)",
          urgencia: 5,
          dinheiro: 4
        }
      ],

      voyerismos: [
        {
          nome: "O Reflexo Traiçoeiro na Vitrine",
          intensidade: "9.8/10",
          situacao: "Caminhando pelo shopping no sábado à tarde, passa em frente a uma loja de roupas e vê uma senhora curvada e volumosa de lado. Leva 3 segundos para perceber que é seu próprio reflexo.",
          sintoma_fisico: "Um nó frio na garganta, queimação no peito e vontade imediata de cruzar os braços sobre a barriga.",
          pensamento: "'Meu Deus, é assim que as pessoas me enxergam? Quando foi que eu fiquei desse jeito?'",
          comportamento: "Acelera o passo de cabeça baixa, evita olhar para qualquer outro espelho e desiste de entrar na loja que queria.",
          uso_copy: "Excelente para os primeiros 15 segundos da lead da VSL ou headline de anúncio nativo."
        },
        {
          nome: "O Fechamento da Mala de Férias",
          intensidade: "9.4/10",
          situacao: "Na véspera da viagem para a praia com a família, experimenta 4 maiôs e biquínis guardados e nenhum esconde as dobras das costas e a barriga inchada.",
          sintoma_fisico: "Suor frio, respiração ofegante de frustração e olhos cheios de lágrimas.",
          pensamento: "'Vou ter que passar o feriado inteiro de canga amarrada na cintura fingindo que estou com frio.'",
          comportamento: "Joga as roupas no chão do closet, senta na cama e chora por 10 minutos antes de colocar uma camiseta folgada do marido.",
          uso_copy: "Ângulo para e-mails de aquecimento e anúncios de retargeting de sexta-feira."
        },
        {
          nome: "O Assento Apertado do Avião / Cinema",
          intensidade: "9.2/10",
          situacao: "Senta na poltrona do avião ou do cinema e sente o quadril comprimido contra os braços de metal, precisando puxar o cinto até o último milímetro.",
          sintoma_fisico: "Pressão dolorosa nos quadris e sensação sufocante de falta de ar.",
          pensamento: "'Se o cinto não fechar eu vou morrer de vergonha de pedir extensor para a comissária.'",
          comportamento: "Prende a respiração com força para conseguir travar a fivela sem que o passageiro ao lado perceba seu desespero.",
          uso_copy: "História de conexão profunda no Bloco 2 da VSL (O Fundo do Poço)."
        }
      ],

      problemas: [
        {
          rank: 1,
          nome: "Metabolismo 'Congelado' Pós-Menopausa",
          total: 68,
          cena_voyerismo: "Comer apenas salada de alface e peito de frango por 5 dias e a balança não descer 100 gramas.",
          scores: { dor: 10, desejo: 10, piora: 10, veloc_: 9, pagar: 10, comun_: 10, freq_: 9 }
        },
        {
          rank: 2,
          nome: "Food Noise e Compulsão por Doces Noturna",
          total: 66,
          cena_voyerismo: "Ficar deitada na cama olhando para o teto às 22h30 até levantar descalça para comer biscoito escondida.",
          scores: { dor: 10, desejo: 9, piora: 9, veloc_: 10, pagar: 10, comun_: 9, freq_: 9 }
        },
        {
          rank: 3,
          nome: "Inchaço Digestivo e Estômago Alto Permanente",
          total: 63,
          cena_voyerismo: "Acordar razoável e às 16h precisar desabotoar o botão da calça embaixo da mesa do trabalho.",
          scores: { dor: 9, desejo: 9, piora: 9, veloc_: 9, pagar: 9, comun_: 9, freq_: 9 }
        },
        {
          rank: 4,
          nome: "Medo do Rebote de Remédios e Injeções Sintéticas",
          total: 62,
          cena_voyerismo: "Ver amigas que pararam a injeção engordando 12kg em 2 meses e desenvolvendo pancreatite.",
          scores: { dor: 10, desejo: 8, piora: 10, veloc_: 8, pagar: 10, comun_: 8, freq_: 8 }
        }
      ],

      headlines: [
        { categoria: "Causa Raiz", texto: "Cientistas de Yale Revelam: O Motivo de Dietas Falharem Não É Calorias, Mas a 'Zona Ácida' do Intestino (Como o Shot de Bicarbonato Resolve em 7 Minutos)" },
        { categoria: "Segredo das Celebridades", texto: "O Ritual Noturno de $0,50 Que Celebridades Estão Usando Para Desinchar a Barriga Sem Precisar de Injeções Semanais de $1.200" },
        { categoria: "Aviso Urgente", texto: "Aviso Para Mulheres 45+: Se Você Tem 'Food Noise' Constante, Suas Células L Foram Desligadas (Faça Este Teste Caseiro com Bicarbonato)" },
        { categoria: "Contraintuitivo", texto: "Por Que Comer Menos Está Fazendo Seu Metabolismo Estocar Gordura Visceral — E Como 1 Copo Matinal Liga o Switch AMPK" },
        { categoria: "Razão Científica", texto: "A Enzima Oculta DPP4 Destrói Seu Hormônio da Saciedade em 90 Segundos: O Composto Natural Que Inibe Essa Destruição" }
      ],

      ganchos: [
        { tipo: "Visual 0-3s", texto: "Mulher despejando uma colher de pó efervescente em água e o texto na tela: 'Pare de injetar produtos químicos no seu corpo.'" },
        { tipo: "Pergunta Chocante", texto: "Você sabia que uma simples colherzinha disso na água da manhã acorda o mesmo hormônio do Ozempic, só que sem enjoo e sem rebote?" },
        { tipo: "Aviso Médico", texto: "Se você tem mais de 45 anos e a balança parece travada no mesmo número há meses, pare tudo o que está fazendo e veja isso." },
        { tipo: "Curiosidade Extrema", texto: "O que a Oprah e os principais pesquisadores de obesidade de Connecticut descobriram sobre o bicarbonato de sódio?" }
      ],

      bullets: [
        { tipo: "Fascination Carlton", texto: "Por que você NUNCA deve tomar café com o estômago vazio se tem mais de 45 anos (isso acidifica o íleo e destrói suas células produtoras de GLP-1)" },
        { tipo: "Reason Why", texto: "A proporção exata de bio-gingerol que inibe a enzima DPP4 em 93%, permitindo que seu corpo sinta saciedade real com metade da comida" },
        { tipo: "Segredo Antienvelhecimento", texto: "O micronutriente celular NAD+ adicionado à fórmula que impede seu rosto de ficar caído e flácido conforme você elimina gordura" },
        { tipo: "Desintoxicação", texto: "Como neutralizar o acúmulo de estrogênio acumulado na gordura do quadril e desinchar 4 quilos de retenção líquida em 14 dias" }
      ],

      micro_historias: [
        {
          titulo: "A História da Dra. Ania e a Descoberta em Yale",
          historia: "Durante décadas, os pesquisadores acreditavam que os hormônios da saciedade eram controlados exclusivamente pelo cérebro. Mas ao examinar pacientes que nunca sentiam fome e mantinham peso magro sem esforço, os cientistas de Connecticut notaram um pH intestinal alcalino de 7.4. Quando pacientes obesos recebiam a alcalinização direcionada no íleo terminal, suas células L acordavam imediatamente, liberando ondas naturais de GLP-1."
        }
      ],

      gatilhos: [
        {
          nome: "O Momento da Foto de Família",
          categoria: "Humilhação Social",
          intensidade: "10/10",
          situacao: "Quando alguém diz 'todo mundo junto para a foto' e você imediatamente procura alguém para ficar na frente da sua barriga.",
          copy_sugerido: "Aquele segundo de tensão em que você se esconde atrás do filho na foto de Natal para não ver o tamanho do seu corpo."
        },
        {
          nome: "O Jeans que Não Fecha Antes de Sair",
          categoria: "Desespero Prático",
          intensidade: "9/10",
          situacao: "Vestir a melhor calça para jantar fora e perceber que faltam 4 centímetros para o botão alcançar a casa.",
          copy_sugerido: "Ter que trocar de roupa 3 vezes antes de um compromisso e acabar saindo de casa chorando com a mesma blusa larga de sempre."
        }
      ],

      storyboard: {
        antes: "Tentando todas as dietas, frustrada com efeito sanfona, sofrendo com compulsão noturna por doces e sentindo-se invisível para o marido.",
        trigger: "O choque de ver uma foto espontânea e o alarme do médico avisando que o colesterol e a pré-diabetes dispararam.",
        busca: "Pesquisou remédios e injeções, mas ficou aterrorizada com os efeitos colaterais de náusea crônica, perda de cabelo e custo abusivo.",
        objecao: "'Será que uma solução solúvel natural em pó funciona mesmo ou é só mais um chá emagrecedor fajuto?'",
        decisao: "Experimentou o SlimSoda com garantia incondicional de 60 dias; no terceiro dia o food noise sumiu e na segunda semana a calça fechou com folga."
      }
    },

    // 📊 DATA OPERACIONAL E ARSENAL PERSUASIVO
    data: {
      publico_alvo: "Mulheres americanas 40-65 anos com metabolismo travado na menopausa, histórico de efeito sanfona e exaustão de tentar dietas restritivas ou medo/rebote de injeções de GLP-1.",
      mecanismo_unico: {
        causa_raiz: "Ambiente hiperácido no intestino delgado (Acidose Epitelial) que desativa as Células L do íleo terminal, impedindo a produção natural dos hormônios sacietógenos GLP-1 e GIP, ao mesmo tempo em que a enzima DPP4 superativada destrói qualquer hormônio remanescente em segundos.",
        por_que_outros_falharam: "Dietas de restrição calórica reduzem a taxa metabólica basal em até 30% e disparam o hormônio grelina (fome voraz). Injeções sintéticas de semaglutida causam tolerância rápida, náuseas severas, perda de massa magra e efeito rebote brutal com ganho do dobro do peso ao interromper.",
        mecanismo_solucao: "O 'Real Baking Soda Water Shot' atua em 3 fases: 1) Alcalinização efervescente direcionada que restaura o pH do íleo e acorda as Células L dormentes; 2) O bio-gingerol padronizado inibe a enzima degradadora DPP4 em 93%, permitindo que o GLP-1 dure horas na circulação; 3) A bio-berberina ativa o interruptor celular AMPK, forçando as mitocôndrias a queimar gordura estocada sem perda muscular.",
        elementos_prova: [
          "Estudos da Yale School of Medicine sobre a sinalização de GLP-1 mediada pelo pH epitelial",
          "Publicações no Journal of Clinical Endocrinology & Metabolism comprovando inibição de DPP4 por gingeróis concentrados",
          "Dossiê de pureza botânica com certificado cGMP de laboratório aprovado pela FDA nos EUA"
        ]
      },
      angulos_persuasivos: [
        {
          nome: "Ângulo 1: Causa Raiz da Acidez Epitelial (O Inimigo Biológico Oculto)",
          tipo: "Root Cause / Vilão Oculto",
          headline: "A Verdadeira Razão de Mulheres com Mais de 45 Anos Não Conseguirem Emagrecer Não Tem Nada a Ver com Carboidratos",
          lead: "Se você sente que seu metabolismo simplesmente parou de responder após os 40, a ciência acabou de comprovar que o problema não é a sua tireoide nem sua idade — mas uma camada invisível de ácido que desligou os sensores de saciedade no seu intestino.",
          reason_why: "O bicarbonato microdosado equilibra o pH intestinal e aciona o reflexo gastroendócrino das células L em menos de 10 minutos após a ingestão.",
          cta: "Assista à apresentação da Dra. Ania e veja como preparar o shot matinal de 15 segundos em casa.",
          prompt_imagem_ia: "Hyper-realistic documentary style photo of a modern university medical laboratory, a glass beaker with effervescent sparkling mineral elixir with ginger and lemon slice on a clean marble table, warm morning light, cinematic 8k."
        },
        {
          nome: "Ângulo 2: O Hack Matinal de $0,50 vs. A Injeção de $1.200 (Contraste Brutal)",
          tipo: "David vs Golias / Economia e Liberdade",
          headline: "Por Que a Indústria Farmacêutica Está Desesperada com Este Shot Caseiro de Bicarbonato",
          lead: "Eles queriam que você pagasse $1.000 todo mês por injeções que causam náuseas e fazem seu rosto cair. Mas este ritual matinal de cozinha produz o mesmo hormônio de saciedade de forma 100% natural.",
          reason_why: "Estimulação endógena é 4x mais sustentável do que hormônios sintéticos clonados que causam atrofia pancreática.",
          cta: "Veja a receita exata e os ingredientes puros antes que o vídeo seja retirado do ar.",
          prompt_imagem_ia: "Split screen composition, left side a cold clinical syringe with high price tag in shadow, right side a warm glowing natural glass of sparkling soda with citrus and herbs, soft sunlight, high conversion ad aesthetic."
        },
        {
          nome: "Ângulo 3: O Fim do Food Noise (Paz Mental Noturna)",
          tipo: "Emocional / Alívio Psicológico",
          headline: "Como Silenciar a 'Voz da Comida' Que Não Deixa Sua Mente Descansar Depois das 8 da Noite",
          lead: "Você sabe exatamente como é: o dia corre bem, você come saudável, mas quando senta no sofá à noite, sua cabeça começa a gritar por doces e carboidratos. Isso não é falta de vergonha na cara — é um sinal biológico de deficiência de GLP-1.",
          reason_why: "Ao elevar os níveis naturais de peptídeo semelhante ao glucagon, os centros de recompensa dopaminérgica do cérebro desligam a obsessão por alimentos calóricos.",
          cta: "Experimente o ritual por 3 dias e sinta o silêncio mental definitivo.",
          prompt_imagem_ia: "Middle-aged graceful woman sitting peacefully on a cozy sofa holding a cup with gentle smile, peaceful night atmosphere in background, relaxed shoulders, sense of serenity and emotional freedom."
        }
      ],
      roteiros_ads_e_reels: [
        {
          formato: "Reels / TikTok 9:16 (Comment-to-DM)",
          tempo_estimado: "45 segundos",
          gancho_0_3s: "[Close no copo borbulhando] 'Se você tem mais de 45 anos e ainda toma injeção cara pra emagrecer, você está sendo enganada.'",
          corpo: "Cientistas de Yale descobriram que misturar bicarbonato purificado com esse extrato específico de raiz ativa o seu próprio GLP-1 natural em 7 minutos. O seu apetite despenca, o inchaço da barriga esvazia e você não fica com aquela cara caída de remédio sintético.",
          cta_dm: "Comente 'SHOT' aqui embaixo que eu te envio o estudo científico e a receita completa no seu privado agora mesmo!",
          palavra_chave_gatilho: "SHOT"
        }
      ],
      arvore_atendimento_whatsapp: [
        {
          passo: 1,
          tipo: "Qualificação Imediata (Bot/Humano)",
          mensagem: "Olá! Que ótimo que você quer conhecer o ritual do SlimSoda. Me conta uma coisa rápida: você sofre mais com o inchaço na barriga ao longo do dia ou com aquela vontade incontrolável de comer doce à noite?"
        },
        {
          passo: 2,
          tipo: "Educação do Mecanismo",
          mensagem: "Entendo perfeitamente, {nome}. Isso acontece porque o ambiente do seu intestino está ácido demais, o que 'desliga' as suas células L que produzem o hormônio da saciedade. O SlimSoda age como um reset alcalino nessas células."
        },
        {
          passo: 3,
          tipo: "Apresentação da Oferta & Blindagem",
          mensagem: "O kit mais recomendado para desinflamar e emagrecer com a pele firme é o tratamento de 6 meses (onde cada pote sai por apenas $19.99 com frete grátis e garantia total de 60 dias). Posso reservar o seu pacote com o desconto liberado?"
        }
      ],
      produtos: [
        { nome: "Kit 6 Potes (6 Meses) - Melhor Valor", preco: 119.94, link_checkout: "https://slim-soda01.vercel.app/checkout-6", ticket: 119.94, descricao: "Tratamento de 6 meses ($19.99/pote) com Frete Grátis e 3 Bônus Digitais." },
        { nome: "Kit 4 Potes (4 Meses) - Mais Popular", preco: 109.96, link_checkout: "https://slim-soda01.vercel.app/checkout-4", ticket: 109.96, descricao: "Tratamento de 4 meses ($27.49/pote)." },
        { nome: "Kit 2 Potes (2 Meses) - Pacote Inicial", preco: 89.50, link_checkout: "https://slim-soda01.vercel.app/checkout-2", ticket: 89.50, descricao: "Tratamento de 2 meses ($44.75/pote)." }
      ],
      links: [
        { nome: "Live Vercel Buy Page / VSL", url: "https://slim-soda01.vercel.app", tipo: "vercel" },
        { nome: "GitHub Repo (Slim-Soda01)", url: "https://github.com/vsugamele/Slim-Soda01", tipo: "github" },
        { nome: "GitHub Repo Assets (slimsoda)", url: "https://github.com/vsugamele/slimsoda", tipo: "github" },
        { nome: "Local PDP v3", url: "file:///C:/Users/vsuga/Downloads/Produtos%20Bifi/Slim/d7b152b2-c67b-432f-9d3e-d6f44476b6b9/slimsodapowder-pdp-v3/index.html", tipo: "local" },
        { nome: "Advertorial 1 (Original Recipe)", url: "file:///C:/Users/vsuga/Downloads/Produtos%20Bifi/Slim/bffc9415-1030-43f1-af6b-de508119c6fa/slimsoda-adv1-original-recipe.html", tipo: "local" }
      ],
      vsl: {
        titulo: "VSL PRINCIPAL - SlimSoda [Powder][19] PITCH 37_06",
        duracao: "47 minutos",
        pitch_time: "37:06",
        gancho: "This is the real baking soda water shot from Oprah. I tried it and lost over 11 pounds in just 10 days...",
        especialista: "Dra. Ania (Especialista em Obesidade de Yale)",
        celebridades: ["Oprah Winfrey", "Kelly Clarkson", "Adele", "Dra. Jennifer Ashton"]
      }
    }
  }
};
