import fs from 'fs';

const OFFERS_REVERSE_ENGINEERING = {
  'SodaTide': {
    formula_nome: 'VSL Investigativa de Saúde / News Cloaker (TODAY Style)',
    gatilhos: ['Alívio de culpa', 'Curiosidade científica', 'Autoridade médica (Dr. Oz)', 'Efeito Cinderela desmascarado', 'Facilidade extrema'],
    publico_alvo: 'Mulheres 40-65 anos com metabolismo lento, menopausa ou frustradas com dietas restritivas e injeções de GLP-1.',
    tom_voz: 'Jornalístico, revelador, empático e conspiratório contra a indústria de alimentos diet.',
    ritmo: 'Abertura rápida com quebra de padrão (0-30s), choque de autoridade na TV (1-3m), explicação metabólica simples (3-8m), pitch lógico inevitável (8-15m).',
    observacoes: 'Usa cloaker TWR na entrada para proteger a página no Meta Ads. O ângulo do bicarbonato tem altíssima penetração porque todo mundo tem em casa, gerando curiosidade imediata.',
    esqueleto: {
      b1_gancho: 'Uma revelação bombástica feita no programa TODAY e confirmada pelo Dr. Oz: um truque matinal simples com bicarbonato de sódio que dissolve estoques de gordura teimosa.',
      b2_agitacao: 'Por que cortar calorias e se matar na esteira não funciona depois dos 40? O corpo entra em modo de sobrevivência ácido, bloqueando a queima das células de gordura visceral.',
      b3_origem: 'A história de uma mãe de 52 anos que recuperou todo o peso após parar as injeções caras de emagrecimento, até descobrir por que o pH intracelular controla a liberação de gordura.',
      b4_mecanismo: 'Mecanismo do Tampão Alcalino Metabólico: o bicarbonato em proporção exata com catalisadores botânicos reverte a acidez tecidual e força os adipócitos a despejarem ácidos graxos.',
      b5_oferta: 'Apresentação do SodaTide: a fórmula líquida concentrada que replica e amplifica 10x o efeito do ritual do bicarbonato, sem o sabor desagradável.',
      b6_value_stack: 'Kits de 3 e 6 frascos com frete expresso gratuito, guia digital de desintoxicação expressa e suporte prioritário.',
      b7_garantia_cta: 'Garantia incondicional blindada de 60 dias: ou a gordura da barriga vai embora, ou cada centavo é devolvido sem perguntas.'
    }
  },
  'JellyPeak': {
    formula_nome: 'Advertorial de Depoimento Emocional + Facebook Fake Post VSL',
    gatilhos: ['Insegurança estética corporal', 'Urgência sazonal', 'Validação social maciça', 'Simplicidade caseira'],
    publico_alvo: 'Mulheres 50+ preocupadas com flacidez nos braços ("asinhas de morcego"), celulite e perda de elasticidade na barriga pós-menopausa.',
    tom_voz: 'Confessional, de amiga para amiga, íntimo e surpreendente.',
    ritmo: 'Pré-sell advertorial de leitura rápida (3 minutos) levando para a VSL do Dr. Oz em formato de post social com comentários quentes.',
    observacoes: 'O gancho de imagem estática com texto "bat wings" tem CTR altíssimo no Meta Ads para o público feminino mais velho.',
    esqueleto: {
      b1_gancho: '“Experimente o truque da gelatina de chia se você quer dar adeus às asinhas de morcego nos braços sem cirurgia plástica.”',
      b2_agitacao: 'A vergonha de usar roupas sem manga no verão, a sensação de que a pele perdeu sustentação e o fracasso de cremes de farmácia caros que só hidratam por cima.',
      b3_origem: '“Aos 57 anos, voltei a vestir o número de calça que usava aos 30”: relato em primeira pessoa de quem já havia aceitado a flacidez como destino da idade.',
      b4_mecanismo: 'Chia Jelly Matrix: o gel solúvel de sementes ativadas em ambiente enzimático retarda os picos de açúcar no sangue e estimula a neo-colagênese profunda.',
      b5_oferta: 'Apresentação do JellyPeak em gotas concentradas para ingestão diária antes da primeira refeição.',
      b6_value_stack: 'Descontos progressivos de até 70% nos kits de 6 potes com livros digitais de receitas firmadoras.',
      b7_garantia_cta: 'Teste por 90 dias completos: garantia de risco zero com chamada para escolher o pacote com frete grátis.'
    }
  },
  'NeuroMemory': {
    formula_nome: 'Telejornal Investigativo 60 Minutes / Alerta Urgente de Saúde',
    gatilhos: ['Medo do esquecimento / Alzheimer', 'Amor à família / não ser um fardo', 'Urgência médica institucional', 'Efeito contagem regressiva'],
    publico_alvo: 'Homens e mulheres 60+ com falhas de memória recentes (onde guardou a chave, nomes de parentes, compromissos) e seus filhos cuidadores.',
    tom_voz: 'Sério, investigativo, urgente e respaldado por neurocientistas prestigiados.',
    ritmo: 'Alerta vermelho nos primeiros 5 segundos com player estilo transmissão ao vivo ("60 Minutes"), teste de memória interativo nos 3 primeiros minutos e explicação biológica.',
    observacoes: 'A versão C da VSL performou muito melhor que as versões A, B, D, E, F e G devido à velocidade da quebra da objeção de que esquecimento é "da idade".',
    esqueleto: {
      b1_gancho: 'Alerta urgente de saúde cerebral transmitido em formato 60 Minutes: uma nova pesquisa revela que lapsos de memória após os 60 anos não são envelhecimento, mas um ataque oxidativo reversível.',
      b2_agitacao: 'O terror silencioso de perder a independência, esquecer os nomes dos netos e o medo de se tornar dependente dos filhos em uma casa de repouso.',
      b3_origem: 'A história do neurocientista que quase viu a própria mãe sucumbir ao declínio mental grave e decidiu investigar tribos isoladas que mantêm memória intacta até os 90 anos.',
      b4_mecanismo: 'Barreira Hemato-Neural e Sinapses Desobstruídas: eliminação da oxidação lipídica cerebral através de antioxidantes lipofílicos nootrópicos concentrados.',
      b5_oferta: 'Apresentação do NeuroMemory: o protocolo nutricional completo em cápsulas para foco, lucidez e memória permanente.',
      b6_value_stack: 'Kits para 3 e 6 meses com manuais de ginástica cerebral e atendimento neurológico via canal direto.',
      b7_garantia_cta: 'Garantia total de 180 dias: recupere a mente de 20 anos atrás ou receba 100% do valor de volta.'
    }
  },
  'Vapo Cept': {
    formula_nome: 'Inovação Mecânica Disruptiva (Inalação Cerebral Direta)',
    gatilhos: ['Curiosidade por rota alternativa', 'Ceticismo com pílulas', 'Alívio instantâneo', 'Respaldado sensorial'],
    publico_alvo: 'Público 55+ que já toma muitos remédios para pressão e colesterol e não aguenta engolir mais comprimidos.',
    tom_voz: 'Científico, instigante, quebrando a crença dos suplementos em cápsula.',
    ritmo: 'Apresentação da rota olfativa como novidade chocante (0-2m), prova visual do vapor penetrando o cérebro (2-6m), oferta.',
    observacoes: 'Explora o ponto cego da concorrência: "seus suplementos orais são destruídos pelo ácido gástrico e pelo fígado antes de chegarem ao cérebro".',
    esqueleto: {
      b1_gancho: '“Por que inalar este vapor botânico por 15 segundos antes de dormir restaura a clareza mental e desfaz a névoa cerebral?”',
      b2_agitacao: 'Tomar pílulas e vitaminas que não fazem efeito porque 90% dos nutrientes são destruídos no estômago antes de atingir os neurônios.',
      b3_origem: 'A descoberta em clínicas suíças de que o nervo olfatório é a única porta de entrada direta para o hipocampo sem barreira gástrica.',
      b4_mecanismo: 'Vapo-Diffusion Neural: micropartículas aromáticas que cruzam o canal olfativo e reativam neurotransmissores em segundos.',
      b5_oferta: 'Kit Vapo Cept: inalador ultrassônico portátil + frascos do blend botânico puro para 3 ou 6 meses.',
      b6_value_stack: 'Inalador incluso grátis no kit de 6 frascos + essência noturna para indução do sono reparador.',
      b7_garantia_cta: 'Garantia de 60 noites de sono e mente lúcida, com suporte e envio sem custo adicional.'
    }
  },
  'Golden Brain': {
    formula_nome: 'Advertorial CNN / AP News com Pré-Sell de Qualificação Yes/No',
    gatilhos: ['Conformidade e compromisso (Yes/No micro-agreement)', 'Esperança contra doenças degenerativas', 'Simplicidade de ingredientes bíblicos/antigos', 'Urgência de censura'],
    publico_alvo: 'Adultos maduros e idosos em estágio inicial de declínio de foco ou com casos de demência na árvore genealógica.',
    tom_voz: 'Noticioso, alarmista ("este vídeo pode ser censurado a qualquer momento"), esperançoso e pedagógico.',
    ritmo: 'Filtro inicial de qualificação que dobra a taxa de retenção da VSL, seguido por matéria de formato CNN Health com VSL embutida.',
    observacoes: 'A micro-concordância "Você promete assistir até o final sem pular? [SIM] [NÃO]" aumenta em até 34% a conversão da VSL.',
    esqueleto: {
      b1_gancho: '“Top US Neurologist confirms: Alzheimer’s and memory decline can be reversed in 45 days with this simple cinnamon and honey morning ritual.”',
      b2_agitacao: 'A dor angustiante de esquecer compromissos importantes e perceber o olhar de preocupação dos familiares.',
      b3_origem: 'O estudo censurado de um laboratório em Boston que comprovou como compostos do mel puro dissolvem placas de resíduos proteicos no córtex.',
      b4_mecanismo: 'Efeito Sinergético Mel + Canela do Ceilão: desinflamação mitocondrial rápida e religamento das conexões sinápticas inativas.',
      b5_oferta: 'Golden Brain Elixir: versão farmacêutica estabilizada dos ativos do ritual tradicional para consumo diário.',
      b6_value_stack: 'Kits de abastecimento com descontos de até US$ 300, frete prioritário e guias de prevenção para a família.',
      b7_garantia_cta: 'Garantia blindada de 90 dias: mente afiada ou devolução integral do valor investido.'
    }
  },
  'MemoHoney': {
    formula_nome: 'Celebridade / Breaking News / Alerta de Urgência Extrema',
    gatilhos: ['Curiosidade irresistível com figuras públicas (Elon Musk)', 'Segredo escondido da elite', 'Remédio caseiro inesperado (Vicks + Mel)', 'Urgência artificial por timer'],
    publico_alvo: 'Seguidores de notícias online, homens e mulheres 45-75 anos fascinados por avanços científicos e segredos de pessoas ricas.',
    tom_voz: 'Sensacionalista sofisticado, ágil, baseado em revelação de bastidores.',
    ritmo: 'Criativo com 131k views gerando tráfego massivo → LP estilo portal de tecnologia e saúde com VSL de alta energia.',
    observacoes: 'O uso de menções a figuras como Elon Musk combinado a ingredientes caseiros familiares (Vicks e mel) quebra totalmente a resistência inicial de venda.',
    esqueleto: {
      b1_gancho: '“Elon Musk revela o truque inusitado do mel com Vicks que cientistas estão usando para reverter a perda de memória e o declínio cognitivo.”',
      b2_agitacao: 'Enquanto a indústria farmacêutica lucra bilhões tratando sintomas, o encolhimento do cérebro continua avançando a cada ano após os 50.',
      b3_origem: 'Como biohackers do Vale do Silício resgataram fórmulas ancestrais de mel para acelerar a regeneração celular em momentos de esgotamento extremo.',
      b4_mecanismo: 'Menthol-Honey Neuro-Drive: os vapores terpenoides abrem os microvasos cranianos, permitindo que os flavonoides do mel entrem direto nas células nervosas.',
      b5_oferta: 'MemoHoney: extrato sublingual exclusivo formulado a partir de colmeias medicinais controladas.',
      b6_value_stack: 'Bônus exclusivos: "O Código da Mente Fotográfica" e "Os 5 Alimentos que Envelhecem o Cérebro".',
      b7_garantia_cta: 'Garantia incondicional de 180 dias com envio grátis para todo o país nos pacotes mais vendidos.'
    }
  },
  'Memo Matrix': {
    formula_nome: 'Segredo de Zona Azul / Antagonista no Café da Manhã',
    gatilhos: ['Vilão cotidiano oculto', 'Segredo de longevidade centenária (Sardenha)', 'Descoberta geográfica exótica', 'Autenticidade'],
    publico_alvo: 'Consumidores preocupados com a saúde cerebral que tomam café da manhã rotineiro achando que estão sendo saudáveis.',
    tom_voz: 'Curioso, documental, surpreendente e educativo.',
    ritmo: 'Ataque imediato a 2 alimentos comuns de café da manhã (0-3m), viagem à ilha da Sardenha (3-7m), revelação da substância e oferta.',
    observacoes: 'Criar um vilão dentro da cozinha do lead gera indignação e abertura total para ouvir a solução.',
    esqueleto: {
      b1_gancho: '“Dois itens inocentes que você come todas as manhãs no seu café estão destruindo suas conexões neurais e acelerando o esquecimento.”',
      b2_agitacao: 'Como a dieta moderna introduz substâncias que "enferrujam" o hipocampo, fazendo você se sentir cansado e confuso logo cedo.',
      b3_origem: 'A expedição médica à ilha italiana da Sardenha, onde idosos de 98 anos possuem a acuidade mental de adultos de 30.',
      b4_mecanismo: 'Sardinian Honey Biotics: o mel silvestre colhido de flores endêmicas da montanha neutraliza os 2 venenos do café e restaura o córtex.',
      b5_oferta: 'Memo Matrix: a fórmula concentrada das enzimas do mel da Sardenha em gotas purificadas.',
      b6_value_stack: 'Três opções de kit com até 65% de desconto no pacote mestre, frete prioritário e garantia total.',
      b7_garantia_cta: 'Teste por 60 dias sem risco: clareza mental garantida ou reembolso integral.'
    }
  },
  'Sugar Balance': {
    formula_nome: 'Vilão Físico Palpável (Pancreatic Sludge / Lodo Pancreático)',
    gatilhos: ['Transferência de culpa (a culpa não é do paciente)', 'Metáfora visual nojenta e memorável', 'Desafiar o consenso médico tradicional', 'Libertação alimentar'],
    publico_alvo: 'Diabéticos tipo 2 e pré-diabéticos dependentes de remédios orais, cansados de dietas sem carboidrato e medo de amputações.',
    tom_voz: 'Confrontador, indignado contra os tratamentos convencionais, esclarecedor e libertador.',
    ritmo: 'Criativo com 97k views no Facebook → VSL direta de demolição do conceito de que diabetes é "para sempre".',
    observacoes: 'A metáfora do "Lodo Pancreático" é genial porque transforma um conceito bioquímico complexo (resistência à insulina) em uma obstrução física de fácil compreensão que pode ser "limpa".',
    esqueleto: {
      b1_gancho: '“Médicos sempre afirmaram que o diabetes tipo 2 era uma sentença definitiva... até a descoberta do ‘Pancreatic Sludge’ que muda tudo.”',
      b2_agitacao: 'A dor diária de furar o dedo, o medo de perder a visão, a neuropatia nos pés e o pânico constante de que o remédio não dê conta.',
      b3_origem: 'A pesquisa de um endocrinologista dissidente que dissecou pâncreas saudáveis vs diabéticos e descobriu a mesma camada de lodo cinzento obstruindo os canais.',
      b4_mecanismo: 'Sludge-Dissolve Formula: combinação de mel medicinal raro e botânicos amargos que liquefazem o lodo pancreático e reabrem os poros de insulina.',
      b5_oferta: 'Sugar Balance: fórmula líquida sublingual de ação ultrarrápida antes das refeições principais.',
      b6_value_stack: 'Kits para 90 e 180 dias com frete gratuito e guia "O Cardápio da Liberdade Glicêmica".',
      b7_garantia_cta: 'Garantia de 90 dias: níveis de glicose no padrão saudável ou devolução de 100% do valor.'
    }
  },
  'GlycoZen': {
    formula_nome: 'Invasor Biológico Oculto (Parasita Destruidor do Pâncreas)',
    gatilhos: ['Aversão visceral e choque (parasita interno)', 'Ritual rápido de 20 segundos', 'Bebida de inspiração bíblica', 'Autoridade Dr. Sanjay Gupta'],
    publico_alvo: 'Diabéticos homens e mulheres 50+ com sobrepeso, cansaço extremo e níveis descontrolados de hemoglobina glicada.',
    tom_voz: 'Alarmante médico, revelador, instintivo e direto.',
    ritmo: 'Dois funis de altíssima escala rodando ao mesmo tempo (um CNN e outro CBS News) com criativos de 21k views.',
    observacoes: 'O gancho de parasita tem a maior taxa de retenção dos 3 primeiros segundos no nicho de diabetes porque ativa o instinto de repulsa imediata.',
    esqueleto: {
      b1_gancho: '“Esse ritual matinal de 20 segundos elimina o parasita que destrói o pâncreas e reverte o diabetes tipo 2 em 21 dias?”',
      b2_agitacao: 'Você toma metformina, corta açúcar, e a glicose continua alta. Isso acontece porque o parasita se alimenta da insulina produzida pelo seu corpo.',
      b3_origem: 'O cirurgião de emergência que descobriu parasitas microscópicos em amostras de tecido pancreático de pacientes diabéticos crônicos.',
      b4_mecanismo: 'Desparasitação Pancreática via Bebida Bíblica: fitonutrientes específicos que tornam o ambiente do pâncreas letal para o invasor.',
      b5_oferta: 'GlycoZen em pó solúvel para consumo matinal em 1 copo de água.',
      b6_value_stack: 'Descontos progressivos por quantidade de frascos + livro digital com receitas de desintoxicação rápida.',
      b7_garantia_cta: 'Garantia de 180 dias incondicional para testar o ritual sem qualquer preocupação financeira.'
    }
  },
  'Olivaro': {
    formula_nome: 'Bebida Bíblica Milenar / Prova de Escrituras Sagradas',
    gatilhos: ['Fé e religiosidade (mencionada 33 vezes na Bíblia)', 'Pureza do azeite de oliva antigo', 'Desconfiança na ciência corporativa', 'Prova social via post fake da CBS'],
    publico_alvo: 'Público americano conservador e religioso, homens e mulheres 45+, que preferem remédios de Deus e da natureza aos da indústria química.',
    tom_voz: 'Espiritual, inspirador, confiável e ancorado na tradição milenar.',
    ritmo: 'Criativo de 23k views → Post da CBS News no feed com dezenas de comentários de fiéis confirmando o resultado → VSL acolhedora.',
    observacoes: 'Apelar para números sagrados ("33 vezes na Bíblia") e produtos bíblicos (azeite de oliva) destrói qualquer objeção de ceticismo no público maduro americano.',
    esqueleto: {
      b1_gancho: '“Esta bebida mencionada 33 vezes na Bíblia Sagrada reconstrói o pâncreas e normaliza a glicose em até 21 dias.”',
      b2_agitacao: 'O sofrimento de viver refém de injeções e medicamentos cheios de químicos artificiais que só mascaram o problema enquanto danificam os rins.',
      b3_origem: 'A descoberta arqueológica e botânica em manuscritos antigos sobre como os reis e profetas tratavam a "urina doce" usando azeite prensado de oliveiras milenares.',
      b4_mecanismo: 'Oleuropeína Ativa e Ácido Oleico de Primeira Prensagem: regenera as células beta das ilhotas de Langerhans e restaura a produção natural de insulina.',
      b5_oferta: 'Olivaro: gotas de azeite botânico purificado e enriquecido com extratos herbais das terras sagradas.',
      b6_value_stack: 'Embalagens familiares com suprimento para até 6 meses com descontos substanciais e e-books bíblicos de saúde.',
      b7_garantia_cta: 'Garantia de 90 dias com compromisso de honra: resultado concreto ou reembolso integral imediato.'
    }
  },
  'GLPro': {
    formula_nome: 'Desafio Direto à Big Pharma / Ritual Noturno da Canela',
    gatilhos: ['Rebelião contra remédios convencionais ("Adeus Metformina")', 'Ritual noturno passivo (emagrece e regula enquanto dorme)', 'Estudo clínico incontestável', 'Alta escala (7 criativos / 52k views)'],
    publico_alvo: 'Diabéticos tipo 2 que sofrem com efeitos colaterais estomacais da metformina e querem uma solução definitiva.',
    tom_voz: 'Confiante, médico desafiador, direto e baseado em ensaios clínicos.',
    ritmo: 'Sete variações de criativos altamente segmentados → LP com VSL do médico que compara o produto a uma alternativa natural de GLP-1.',
    observacoes: 'A promessa "Forget insulin and metformin" é a mais agressiva e poderosa do nicho de saúde metabólica.',
    esqueleto: {
      b1_gancho: '“Forget insulin and metformin — this simple nighttime cinnamon trick is clinically proven to reverse type 2 diabetes!”',
      b2_agitacao: 'Viver com náuseas constantes, dores de estômago e diarreia provocadas pela metformina, sabendo que ela não está curando a raiz do problema.',
      b3_origem: 'O ensaio clínico liderado por um time de médicos independentes que testou o extrato de canela ceilão purificada antes do repouso noturno.',
      b4_mecanismo: 'Reativação Noturna dos Receptores GLUT-4: enquanto você descansa, os compostos da canela desbloqueiam as portas celulares para que o açúcar entre e vire energia pura.',
      b5_oferta: 'GLPro: cápsulas de alta absorção desenvolvidas para serem ingeridas 30 minutos antes de dormir.',
      b6_value_stack: 'Kits com até 8 potes com frete internacional gratuito e acompanhamento digital de métricas glicêmicas.',
      b7_garantia_cta: 'Garantia incondicional de 90 dias: teste por 3 meses inteiros e sinta a diferença ou receba cada dólar de volta.'
    }
  },
  'GlycoBarrier': {
    formula_nome: 'Barreira Enzimática Digestiva / Funil Triplo de Aquisição Direta',
    gatilhos: ['Fim da culpa alimentar', 'Bloqueio imediato de carboidratos', 'Clareza de preços e kits', 'Garantia hiper-estendida (180 dias)'],
    publico_alvo: 'Diabéticos e pessoas com pré-diabetes que amam comer pães, massas e doces e não querem passar a vida inteira em dieta cetogênica rígida.',
    tom_voz: 'Pragmático, libertador, focado em resultados rápidos e sem rodeios.',
    ritmo: 'Três funis rodando: Funil A direto com VSL e checkout aberto logo abaixo; Funil B com post da CBS; Funil C alimentando 3 variações de VSL.',
    observacoes: 'O modelo de oferta direta com preços explícitos (kits de 2, 3 e 6 potes a US$ 79 / 69 / 49 por frasco) com frete grátis e 180 dias de garantia converte muito tráfego morno.',
    esqueleto: {
      b1_gancho: '“Como criar uma barreira digestiva natural contra picos de glicose e poder comer seus pratos favoritos sem medo de passar mal.”',
      b2_agitacao: 'A frustração de ser o único na mesa da família que precisa comer salada sem tempero enquanto todos aproveitam o almoço de domingo.',
      b3_origem: 'A descoberta em laboratórios de biologia molecular de um extrato vegetal que impede as enzimas que transformam carboidratos em açúcar de atuarem no intestino delgado.',
      b4_mecanismo: 'Enzyme-Shield Barrier: inibição suave das enzimas alfa-amilase e alfa-glucosidase, fazendo os carboidratos passarem pelo trato digestivo sem virar açúcar no sangue.',
      b5_oferta: 'GlycoBarrier cápsulas antes das principais refeições, com kits de 2 (US$ 79/pote), 3 (US$ 69/pote) e 6 potes (US$ 49/pote).',
      b6_value_stack: 'Frete grátis em todos os pedidos + 2 bônus digitais de sobremesas seguras para diabéticos.',
      b7_garantia_cta: 'Garantia gigante de 180 dias (6 meses inteiros) com devolução de 100% do dinheiro investido.'
    }
  }
};

const sqls = [];

for (const [title, re] of Object.entries(OFFERS_REVERSE_ENGINEERING)) {
  const fullRe = {
    __schema: 'vsl7',
    ...re
  };

  const escapedJson = "'" + JSON.stringify(fullRe).replace(/'/g, "''") + "'::jsonb";
  const titlePattern = `%${title}%`;

  sqls.push(`UPDATE imphq_swipes 
SET reverse_engineering = ${escapedJson}
WHERE criador = 'SwipeRadar' AND title ILIKE '${titlePattern}';`);
}

const finalSql = sqls.join('\n\n');
fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scripts/update_reverse_engineering.sql', finalSql, 'utf8');
console.log(`Gerado update_reverse_engineering.sql com sucesso para 12 ofertas!`);
