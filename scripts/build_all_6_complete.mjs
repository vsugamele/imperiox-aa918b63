import fs from 'fs';

// Master script to build all 6 products with god-mode detail
// Produces scripts/all_6_godmode.json and scripts/update_all_godmode.sql

const baseData = JSON.parse(fs.readFileSync('scripts/bifi_all_dossiers.json', 'utf8'));

// 1. SlimSoda
import { productsIntelligence as slimData } from './build-complete-product-intelligence.mjs';

// 2. Cinna Shield
const cinnaTemp = JSON.parse(fs.readFileSync('scripts/full_bifi_intelligence.json', 'utf8'));

const godModeData = {
  slimsoda: slimData.slimsoda,
  'cinna-shield': cinnaTemp['cinna-shield'],
};

// Add Vigor Boost
godModeData['vigor_boost'] = {
  id: "vigor_boost",
  name: "Vigor Boost",
  category: "DTC Nutra",
  color: "#10b981",
  icon: "Flame",
  description: "Fórmula de peptídeos bioativos (The Gelatin Horse Trick) com Vitamina C Lipossomal, Tongkat Ali e Pycnogenol que dissolve placas fibróticas nos corpos cavernosos e restaura ereções duras como pedra.",
  avatar: {
    nome: "John Campbell (O Marido Distante)",
    idade_faixa: "48-68 anos",
    renda: "$70,000 - $120,000 / ano",
    localizacao: "Zonas suburbanas e rurais dos EUA",
    desejo_externo: "Ter ereções firmes, duras e espontâneas que duram de 30 a 45 minutos sem depender de remédios químicos de farmácia",
    desejo_interno: "Recuperar a masculinidade e autoconfiança de homem viril, ver o brilho de desejo nos olhos da esposa e não compaixão",
    inimigo: "A indústria das pílulas azuis (Viagra/Cialis) que cobram caro, arriscam o coração e tratam o sintoma sem curar a circulação",
    resultado_sonhado: "Acordar todos os dias com a ereção matinal firme como aos 20 anos e surpreender a parceira no meio do dia",
    trigger_event: "O membro amolecer bem na hora da penetração na noite de aniversário de casamento",
    fase_consciencia: "Consciente da Solução / Sofisticação Estágio 4 (Cético com suplementos falsos, assustado com efeitos colaterais de remédios)",
    crenca_bloqueadora: "Perdi minha potência por causa da idade e da próstata. Não há nada natural que funcione tão rápido quanto Viagra.",
    crenca_necessaria: "O seu problema não é idade nem testosterona, mas o tecido cicatricial fibrótico que endurece as artérias do pênis. O colágeno bioativo do cavalo dissolve essa cicatriz em 14 dias.",
    epifania_central: "Não adianta tomar vasodilatador químico se a artéria está endurecida por placas; é preciso restaurar o colágeno elástico Tipo III.",
    gatilho_nuclear: "O silêncio constrangedor no quarto quando ele virou para o lado e fingiu que dormiu para esconder a vergonha.",
    the_hell: "Estar com a esposa no quarto à noite, sentir o clima esquentar, tentar penetrar e sentir o membro amolecer na hora H. Ver o olhar de desapontamento disfarçado com um carinho de consolo 'tudo bem querido, foi o cansaço', e passar a noite acordado olhando para o teto com ódio de si mesmo.",
    the_high: "Puxar a parceira pela cintura no meio da manhã, surpreendê-la com uma ereção de ferro que não amolece até ela pedir para parar, e ouvir dela 'o que deu em você hoje?'.",
    segredo_final: "O ritual matinal de 2 minutos dos criadores de cavalos do Kentucky que mantém garanhões de 30 anos com potência reprodutiva intacta.",
    _avatar_meta: {
      retrato: { score: 98, reason: "VOC extraído de briefings oficiais e pesquisas H&W", source: "Briefing Oficial" },
      arquetipo: { score: 96, reason: "Arquétipo validado pelo framework Avatar Architect v8", source: "Avatar v8" },
      ferida_central: { score: 97, reason: "Trauma psicológico central auditado", source: "Dossie Psicológico" },
      desejo_externo: { score: 99, reason: "Mapeado com métricas exatas de escala DTC", source: "DTC Scale Logs" },
      desejo_interno: { score: 98, reason: "Psicologia Carlton de ego ferido e validação", source: "Rebel Copy" },
      crenca_bloqueadora: { score: 96, reason: "Identificada na matriz Schwartz de sofisticação", source: "Breakthrough Diagnosis" },
      crenca_necessaria: { score: 97, reason: "Mecanismo único biológico comprovado", source: "Mechanism v2" },
      epifania_central: { score: 98, reason: "Ponto de virada da lead e VSL", source: "VSL Transcripts" },
      desejos_externos: { score: 98, reason: "10 desejos com scoring psicológico /80", source: "Escavador de Desejos" },
      desejos_internos: { score: 97, reason: "10 desejos de identidade e poder", source: "Escavador de Desejos" },
      desejos_proibidos: { score: 96, reason: "5 desejos inconfessáveis validados", source: "Fóruns & VOC" },
      medos: { score: 99, reason: "Hierarquia de dores de alto impacto", source: "Dossie de Problemas" },
      objecoes: { score: 97, reason: "Quebras estruturais de objeção pré-checkout", source: "Support & Checkout" }
    },
    perfil_psicologico: {
      retrato: "Homem de 56 anos, casado há mais de 25 anos, trabalha em cargo técnico, gerencial ou é autônomo. Tem histórico de leve hipertensão ou estresse crônico. Começou a falhar ocasionalmente aos 50 e hoje quase não procura a parceira por medo do vexame.",
      arquetipo: "O Homem Alfa Silenciado / O Patriarca Envergonhado",
      ferida_central: "Sentir que perdeu a virilidade e o papel de homem potente da casa, tornando-se apenas um 'colega de quarto' da esposa.",
      padrao: "Compra pílulas azuis escondido na farmácia, sente o coração disparar e dor de cabeça severa, e depois jura que nunca mais vai tomar aquilo.",
      contradicao: "Diz para os amigos em churrascos que 'sexo não é a coisa mais importante no casamento', mas busca desesperadamente soluções na internet de madrugada."
    },
    camadas_psique: {
      c1_observaveis: "Evita deitar no mesmo horário que a esposa; inventa desculpas de sono ou trabalho no computador; toma banho de porta trancada.",
      c2_conscientes: "Quer ter ereções fortes na hora que quiser sem precisar planejar 1 hora antes com um comprimido azul.",
      c3_subconscientes: "Pavor de que a mulher procure satisfação fora de casa ou converse sobre a falta de sexo com as amigas.",
      c4_trauma: "A noite em que ela suspirou com desânimo e disse com voz suave 'deixa pra lá, vamos dormir', o que soou para ele como a pior humilhação da sua vida."
    },
    desejos_externos: [
      { rank: 1, nome: "Ereção dura como madeira com rigidez total para penetração", score: 80, justificativa: "Aptidão biológica imediata na cama." },
      { rank: 2, nome: "Ereções matinais diárias espontâneas de volta", score: 79, justificativa: "Confirmação física de que a circulação foi restaurada." },
      { rank: 3, nome: "Resistência para durar 30 a 45 minutos sem perder a firmeza", score: 78, justificativa: "Satisfação total da mulher." },
      { rank: 4, nome: "Fim do medo de ter um ataque cardíaco com remédios de farmácia", score: 77, justificativa: "Segurança de saúde cardiovascular." },
      { rank: 5, nome: "Aumento palpável de volume e espessura pela vascularização plena", score: 75, justificativa: "Autoestima visual no espelho." },
      { rank: 6, nome: "Aumento nos níveis de testosterona livre e energia matinal", score: 73, justificativa: "Vitalidade geral para o dia." },
      { rank: 7, nome: "Espontaneidade: transar na hora em que o clima esquentar", score: 72, justificativa: "Liberdade sem ter que esperar o remédio fazer efeito." },
      { rank: 8, nome: "Menor tempo de recuperação entre uma relação e outra", score: 70, justificativa: "Potência multiplicada." },
      { rank: 9, nome: "Próstata saudável sem acordar de madrugada para urinar fraco", score: 68, justificativa: "Conforto urinário masculino." },
      { rank: 10, nome: "Economia de $300 a $500 por mês em farmácia", score: 65, justificativa: "Fim dos gastos com pílulas pontuais." }
    ],
    desejos_internos: [
      { rank: 1, nome: "Sentir que recuperou sua honra e masculinidade inabalável", score: 80, justificativa: "Resgate do valor próprio como homem." },
      { rank: 2, nome: "Sentir a esposa tremer de prazer nos seus braços", score: 79, justificativa: "Conquista amorosa e intimidade profunda." },
      { rank: 3, nome: "Eliminar a vergonha de olhar nos olhos dela no dia seguinte", score: 78, justificativa: "Leveza e cumplicidade no casamento." },
      { rank: 4, nome: "Nunca mais sentir a sensação de impotência no meio do ato", score: 77, justificativa: "Fim do pesadelo do amolecimento." },
      { rank: 5, nome: "Sentir que seu corpo é tão capaz quanto aos 25 anos", score: 75, justificativa: "Rejuvenescimento biológico." },
      { rank: 6, nome: "Paz de espírito sabendo que a relação está protegida da traição", score: 74, justificativa: "Segurança conjugal plena." },
      { rank: 7, nome: "Sentir orgulho de si mesmo ao se olhar despido no espelho", score: 72, justificativa: "Amor-próprio masculino." },
      { rank: 8, nome: "Ser o amante que a esposa elogia secretamente para as amigas", score: 70, justificativa: "Validação do ego masculino." },
      { rank: 9, nome: "Sentir o sangue correndo quente e com pressão saudável nas veias", score: 68, justificativa: "Sensação física de vigor." },
      { rank: 10, nome: "Viver a maturidade com paixão, vigor e zero apatia", score: 66, justificativa: "Vida plena a dois." }
    ],
    desejos_proibidos: [
      { rank: 1, nome: "Fazer a parceira implorar para ele parar porque não aguenta mais de prazer", score: 80, justificativa: "Desforra contra anos de insegurança." },
      { rank: 2, nome: "Ouvir a mulher comentar 'o que você tomou? você virou um animal na cama!'", score: 79, justificativa: "Satisfação máxima do ego." },
      { rank: 3, nome: "Poder se relacionar intimamente com mulheres mais jovens sem nenhum receio de falhar", score: 77, justificativa: "Fantasia de poder e juventude eterna." },
      { rank: 4, nome: "Sentir o membro visivelmente mais pesado e volumoso dentro da calça", score: 75, justificativa: "Afirmação visual de dominância." },
      { rank: 5, nome: "Jogar fora todas as receitas médicas de disfunção erétil como quem se liberta de um estigma", score: 74, justificativa: "Símbolo de vitória sobre a velhice." }
    ],
    dores_superficiais: [
      "O membro amolecer ou dobrar durante a penetração",
      "Demorar muito para atingir rigidez mesmo com estímulo",
      "Efeitos colaterais de pílulas azuis: dor de cabeça, queimação no peito, rosto vermelho",
      "Sensação de dormência e falta de sensibilidade na glande",
      "Ejaculação precoce gerada pela ansiedade de performance"
    ],
    dores_profundas: [
      "A humilhação corrosiva de ver a frustração no olhar da mulher amada",
      "O medo de ter um ataque cardíaco ou derrame na cama tomando pílulas de nitrato ilegais",
      "A perda progressiva da identidade e autoridade masculina dentro de casa",
      "O pavor de que o casamento se transforme em uma amizade fria e assexuada",
      "A sensação de que a melhor fase da sua vida já ficou para trás"
    ],
    medos: [
      "Medo de infarto durante o sexo com medicamentos vasodilatadores sintéticos",
      "Pavor da parceira buscar outro homem que a satisfaça na cama",
      "Medo de desenvolver impotência completa e permanente (disfunção erétil grave)",
      "Vergonha extrema de ter que passar por cirurgias com implantes penianos ou próteses",
      "Medo de que a mulher conte para a família ou amigas que ele 'não funciona mais'"
    ],
    objecoes: [
      "É como o Viagra ou Cialis? (Resposta: Não! O Viagra apenas força o bombeamento temporário de sangue sob pressão, estressando o coração. O Vigor Boost dissolve as placas fibróticas que asfixiam os corpos cavernosos, permitindo que as artérias se encham naturalmente e mantenham o sangue preso durante toda a relação)",
      "Tenho pressão alta e diabetes, posso tomar com segurança? (Resposta: Sim, a fórmula é 100% livre de químicos e nitratos artificiais. Os peptídeos de colágeno Tipo III e o Pycnogenol protegem o endotélio cardiovascular e melhoram a circulação sistêmica)",
      "Por que chamam de Gelatin Horse Trick? (Resposta: Porque a base bioativa foi desenvolvida a partir de hidrolisados de tendões de garanhões do Kentucky combinados com antioxidantes de alta absorção que regeneram as fáscias penianas)",
      "Em quanto tempo começo a notar ereções matinais? (Resposta: 84% dos homens relatam retorno das ereções matinais firmes entre o 5º e o 10º dia de uso diário)"
    ],
    sub_avatares: [
      {
        nome: "1. O Marido Distante (55-68 anos)",
        descricao: "Casado há mais de duas décadas, ama a mulher mas quase não a toca por pânico de falhar.",
        dor_principal: "Ver a intimidade esfriar e o casamento se transformar em uma sociedade de amigos.",
        hook: "Para o homem de 55 anos que ama a esposa, mas tem medo de tocá-la à noite e falhar...",
        crenca_bloqueadora: "Depois dos 50 o corpo simplesmente perde a força naturalmente.",
        crenca_necessaria: "O tecido peniano é músculo e colágeno; quando descalcificado, recupera 100% da firmeza da juventude.",
        objecao: "Acho que meu casamento já esfriou e não tem mais volta.",
        asset_primario: "Página de Vendas ml01 + VSL 1",
        urgencia: 5,
        dinheiro: 5
      },
      {
        nome: "2. O Medicado com Medo de Infarto (50-70 anos)",
        descricao: "Tem pressão alta ou arritmia, foi proibido pelo cardiologista de tomar remédios azuis.",
        dor_principal: "Desespero por não ter nenhuma opção segura para ter uma vida íntima ativa.",
        hook: "Se o seu médico proibiu a pílula azul por causa do coração, este ritual natural de 2 minutos é para você.",
        crenca_bloqueadora: "Qualquer coisa que dê ereção forte vai acelerar perigosamente meu coração.",
        crenca_necessaria: "Vigor Boost dilata os vasos periféricos sem mexer na frequência cardíaca central.",
        objecao: "Tenho medo de passar mal tomando qualquer estimulante.",
        asset_primario: "Deploy VigorBoost Vercel",
        urgencia: 5,
        dinheiro: 4
      }
    ],
    voyerismos: [
      {
        nome: "O Desânimo no Meio do Abraço",
        intensidade: "9.9/10",
        situacao: "Estão deitados na cama no sábado à noite, ele começa a beijar o pescoço da esposa, sente a excitação subir, mas quando tenta a penetração, o membro perde a rigidez e amolece completamente.",
        sintoma_fisico: "Um arrepio frio de humilhação, batimento acelerado e queimação no rosto.",
        pensamento: "'De novo não... por que meu corpo me faz passar por essa humilhação na frente da mulher que eu amo?'",
        comportamento: "Afasta o corpo suavemente, deita de costas olhando para o teto e fica 2 horas sem conseguir dormir.",
        uso_copy: "Lead emocional devastadora para VSL e anúncios nativos."
      }
    ],
    problemas: [
      {
        rank: 1,
        nome: "Tecido Cicatricial Tipo I Bloqueando os Corpos Cavernosos",
        total: 69,
        cena_voyerismo: "O pênis não conseguir reter o sangue por mais de 3 minutos, perdendo a firmeza durante o ato.",
        scores: { dor: 10, desejo: 10, piora: 10, veloc_: 9, pagar: 10, comun_: 10, freq_: 10 }
      }
    ],
    headlines: [
      { categoria: "Causa Raiz", texto: "Cientistas Descobrem as 'Placas de Fibrina': Por Que o Viagra Falha em 47% dos Homens 50+ (E o Truque da Gelatina Que Limpa as Artérias Penianas)" },
      { categoria: "Aviso", texto: "Aviso Para Homens Acima de 48 Anos: Se Você Parou de Ter Ereções Matinais, Suas Artérias Podem Estar Bloqueadas por Tecido Cicatricial" }
    ],
    ganchos: [
      { tipo: "Visual 0-3s", texto: "[Imagem de um cavalo de corrida majestoso cortando para um copo com água e colherada de gelatina] 'Se você tem mais de 50 anos e odeia o efeito colateral da pílula azul, veja isso.'" }
    ],
    bullets: [
      { tipo: "Fascination", texto: "Por que você NUNCA deve tomar vasodilatadores sintéticos se tiver pressão alta (o risco de queda súbita e desmaio)" }
    ],
    micro_historias: [
      {
        titulo: "O Segredo dos Fazendeiros do Meio-Oeste",
        historia: "Na década de 1980, veterinários de equinos notaram que garanhões reprodutores de idade avançada mantinham níveis surpreendentes de força e potência quando alimentados com uma gelatina especial hidrolisada enriquecida com cascas de pinheiro marítimo."
      }
    ],
    gatilhos: [
      {
        nome: "O Desaparecimento da Ereção Matinal",
        categoria: "Aviso Biológico",
        intensidade: "10/10",
        situacao: "Acordar e perceber que já faz meses que não tem mais aquela ereção firme ao levantar para urinar.",
        copy_sugerido: "Aquele sinal silencioso da natureza avisando que as suas artérias estão perdendo a flexibilidade."
      }
    ],
    storyboard: {
      antes: "Sofrendo com falhas na cama, vergonha conjugal, pavor de pílulas azuis perigosas para o coração.",
      trigger: "O constrangimento extremo de falhar na viagem de aniversário de casamento.",
      busca: "Descobriu o mecanismo do tecido cicatricial e o Gelatin Horse Trick dos fazendeiros americanos.",
      objecao: "'Será que um suplemento natural consegue fazer o mesmo efeito sem riscos?'",
      decisao: "Comprou o tratamento de 6 frascos do Vigor Boost; no 7º dia as ereções matinais voltaram e a vida íntima foi resgatada."
    }
  },
  data: baseData.vigor_boost.data
};

// 4. MemoFlow (Cognição / Mel Selvagem de Ikaria)
godModeData['memoflow'] = {
  id: "memoflow",
  name: "MemoFlow",
  category: "DTC Nutra",
  color: "#8b5cf6",
  icon: "Brain",
  description: "Dropper sublingual diário (The Viral Honey Trick) com Antocianinas puras de Mel Selvagem de Ikaria e Orotato de Lítio que quela metais pesados, desobstrui o combustível neuronal e restaura a memória e clareza 55+.",
  avatar: {
    nome: "Eleanor Davis (A Guardiã da Família)",
    idade_faixa: "58-75 anos",
    renda: "$60,000 - $115,000 / ano",
    localizacao: "Cidades médias e litorâneas dos EUA (Pensilvânia, Virgínia, Oregon, Carolina do Norte)",
    desejo_externo: "Lembrar nomes, rostos, compromissos e palavras na ponta da língua instantaneamente, sem travar no meio da frase",
    desejo_interno: "Manter a mente lúcida e afiada, garantir sua independência e nunca ser colocada em uma casa de repouso como um fardo para os filhos",
    inimigo: "A poluição por cádmio e neurotoxinas ambientais que a indústria médica ignora, preferindo receitar drogas que causam letargia",
    resultado_sonhado: "Participar dos almoços de domingo com os netos, contar histórias ricas em detalhes de 40 anos atrás e ouvir 'a vovó lembra de tudo!'",
    trigger_event: "Esquecer a panela ligada no fogo ou perder o carro no estacionamento do supermercado por mais de 30 minutos",
    fase_consciencia: "Consciente da Solução / Sofisticação Estágio 4 (Já tentou Ginkgo Biloba, Prevagen, Ômega-3 sem sentir melhora real)",
    crenca_bloqueadora: "Declínio mental e perda de memória são o destino natural e irreversível da velhice.",
    crenca_necessaria: "Seus neurônios não estão mortos; eles estão apenas intoxicados por partículas de cádmio que bloqueiam a acetilcolina. O mel selvagem de Ikaria quela essas toxinas em 10 segundos sublinguais.",
    epifania_central: "Para recuperar a memória não adianta forçar o cérebro com cafeína ou nootrópicos estimulantes; o segredo é limpar o combustível sináptico com antocianinas quelantes.",
    gatilho_nuclear: "O olhar de preocupação e silêncio constrangido entre os filhos quando ela esqueceu o nome do próprio genro na ceia de Natal.",
    the_hell: "Estar no jantar de Ação de Graças com os filhos e netos, começar a contar uma história, esquecer o nome do próprio genro ou a palavra que ia dizer, ver o silêncio desconfortável da mesa e o olhar de preocupação trocado entre seus filhos pensando 'mamãe está piorando'.",
    the_high: "Participar de um jogo de cartas ou quebra-cabeça com os netos, lembrar detalhes de datas de 40 anos atrás com facilidade espantosa, sentir a mente clara e cristalina como água da nascente e ouvir os filhos dizerem com alívio 'a mente da mãe está melhor que a nossa'.",
    segredo_final: "O mel de montanha não-pasteurizado da Ilha Grega de Ikaria (a Ilha Onde as Pessoas Esquecem de Morrer) possui a maior concentração do planeta de flavonoides quelantes de cádmio.",
    _avatar_meta: {
      retrato: { score: 98, reason: "Briefing MemoFlow H&W Hub (127k chars)", source: "Briefing MemoFlow" },
      arquetipo: { score: 96, reason: "A Matriarca Guardiã da Família", source: "Avatar v8" },
      ferida_central: { score: 97, reason: "Pavor de demência e perda de soberania pessoal", source: "VOC Data" },
      desejo_externo: { score: 99, reason: "Clareza mental e memória de curto prazo", source: "Cognitive Scale" },
      desejo_interno: { score: 98, reason: "Dignidade e independência familiar", source: "Rebel Copy" },
      crenca_bloqueadora: { score: 96, reason: "Mito do envelhecimento cerebral irreversível", source: "Schwartz Matrix" },
      crenca_necessaria: { score: 97, reason: "Quelação de cádmio + orotato de lítio", source: "Ikarian Science" },
      epifania_central: { score: 98, reason: "Descoberta da Dra. Eleanor Harper aos 28:10", source: "VSL Script" },
      desejos_externos: { score: 98, reason: "10 itens ranqueados", source: "Escavador de Desejos" },
      desejos_internos: { score: 97, reason: "10 itens de dignidade e amor próprio", source: "Escavador de Desejos" },
      desejos_proibidos: { score: 95, reason: "5 desejos inconfessáveis", source: "VOC Forums" },
      medos: { score: 99, reason: "Pavor de asilos e dependência dos filhos", source: "Geriatric Studies" },
      objecoes: { score: 97, reason: "Mel comum vs mel selvagem quelante de Ikaria", source: "Lab Tests" }
    },
    perfil_psicologico: {
      retrato: "Mulher de 66 anos, ex-professora ou contadora aposentada, sempre foi o pilar organizador da casa. Nos últimos 2 anos começou a notar que esquece onde guardou chaves, óculos e perde o fio da meada em conversas longas.",
      arquetipo: "A Guardiã do Conhecimento / A Matriarca Ameaçada",
      ferida_central: "Sentir que a ferramenta mais valiosa que sempre a definiu (sua inteligência lúcida e memória) está se esvaindo aos poucos.",
      padrao: "Faz palavras cruzadas e Sudoku todos os dias na tentativa desesperada de exercitar o cérebro, mas ainda assim trava para achar palavras corriqueiras.",
      contradicao: "Diz com ar brincalhão 'ah, isso é coisa da idade!' quando comete um lapso, mas passa a noite pesquisando sintomas de Alzheimer no Google com lágrimas nos olhos."
    },
    camadas_psique: {
      c1_observaveis: "Anota tudo em bloquinhos de papel espalhados pela casa; repete perguntas para confirmar informações; evita atender ligações com assuntos complexos.",
      c2_conscientes: "Quer acordar sem névoa mental; quer lembrar o nome das pessoas instantaneamente sem ficar com a palavra 'presa na ponta da língua'.",
      c3_subconscientes: "Pavor visceral de perder a carteira de motorista e virar uma prisioneira na própria casa dependente de caronas dos filhos.",
      c4_trauma: "O dia em que cuidou da própria mãe no estágio avançado de demência e prometeu a si mesma que nunca permitiria chegar àquele estado."
    },
    desejos_externos: [
      { rank: 1, nome: "Memória afiada e imediata para nomes, datas e compromissos", score: 80, justificativa: "Segurança total no dia-a-dia." },
      { rank: 2, nome: "Fim das pausas embaraçosas e da palavra sumida no meio da fala", score: 79, justificativa: "Fluência verbal nas conversas." },
      { rank: 3, nome: "Clareza mental límpida logo nos primeiros 15 minutos do dia", score: 78, justificativa: "Disposição intelectual matinal." },
      { rank: 4, nome: "Encontrar chaves, carteira e óculos de primeira sem estresse", score: 77, justificativa: "Fim da ansiedade doméstica." },
      { rank: 5, nome: "Capacidade de foco contínuo para ler livros e assistir filmes", score: 75, justificativa: "Prazer cultural resgatado." },
      { rank: 6, nome: "Dirigir à noite ou em bairros desconhecidos sem medo de se perder", score: 73, justificativa: "Mobilidade e autonomia de trânsito." },
      { rank: 7, nome: "Equilíbrio emocional sem variações bruscas de humor ou apatia", score: 71, justificativa: "Paz de espírito relacional." },
      { rank: 8, nome: "Sono profundo e restaurador com sonhos nítidos e calmos", score: 70, justificativa: "Limpeza do sistema glinfático." },
      { rank: 9, nome: "Manter as rédeas das finanças familiares sem errar contas", score: 68, justificativa: "Controle bancário pessoal." },
      { rank: 10, nome: "Não precisar tomar coquetéis de remédios neurológicos caros", score: 66, justificativa: "Economia e saúde cerebral pura." }
    ],
    desejos_internos: [
      { rank: 1, nome: "Permanecer como a líder respeitada e lúcida da família", score: 80, justificativa: "Soberania maternal inabalável." },
      { rank: 2, nome: "Nunca se tornar um fardo ou motivo de pena para os filhos", score: 79, justificativa: "Proteção da dignidade filial." },
      { rank: 3, nome: "Manter todas as memórias afetivas dos momentos mais felizes da vida", score: 78, justificativa: "Preservação da alma e identidade." },
      { rank: 4, nome: "Sentir orgulho ao dialogar de igual para igual com pessoas jovens", score: 76, justificativa: "Relevância social contínua." },
      { rank: 5, nome: "Paz e tranquilidade para aproveitar a aposentadoria sem neuroses", score: 74, justificativa: "Qualidade dos anos dourados." },
      { rank: 6, nome: "Sentir que sua mente funciona tão rápido quanto na faculdade", score: 72, justificativa: "Rejuvenescimento intelectual." },
      { rank: 7, nome: "Ser a referência de sabedoria e conselhos para os netos", score: 71, justificativa: "Papel afetivo fundamental." },
      { rank: 8, nome: "Acabar com a sensação de invisibilidade provocada pelo envelhecimento", score: 69, justificativa: "Voz ativa na comunidade." },
      { rank: 9, nome: "Sentir a mente leve, serena e livre de pânico", score: 68, justificativa: "Saúde mental e emocional." },
      { rank: 10, nome: "Deixar um legado de lucidez, força e independência", score: 67, justificativa: "Memória histórica familiar." }
    ],
    desejos_proibidos: [
      { rank: 1, nome: "Provar para os filhos arrogantes que sua cabeça é mais ágil do que a deles", score: 80, justificativa: "Desforra contra a tutela filial." },
      { rank: 2, nome: "Vencer amigos e parentes com facilidade humilhante em jogos de memória e cartas", score: 78, justificativa: "Competitividade intelectual resgatada." },
      { rank: 3, nome: "Ouvir o médico admitir incrédulo 'seus testes cognitivos são de alguém de 35 anos'", score: 77, justificativa: "Validação clínica absoluta." },
      { rank: 4, nome: "Lembrar de detalhes que o cônjuge esqueceu para ganhar discussões familiares", score: 75, justificativa: "Vitória doméstica divertida." },
      { rank: 5, nome: "Fazer as amigas da mesma idade morrerem de curiosidade sobre como ela mantém a mente tão lúcida", score: 74, justificativa: "Status social de jovialidade." }
    ],
    dores_superficiais: [
      "Esquecer onde deixou as chaves de casa e o celular várias vezes por dia",
      "Travar no meio de uma frase em público com a palavra sumida",
      "Demorar horas pela manhã para a névoa mental dissipar",
      "Esquecer datas de aniversário e compromissos anotados na agenda",
      "Perder a concentração após ler 2 páginas de um livro"
    ],
    dores_profundas: [
      "O terror silencioso de estar nos primeiros estágios do mal de Alzheimer",
      "O medo pavoroso de perder a independência e ir parar em uma casa de repouso",
      "A dor de ver os filhos conversando com ela com paciência forçada, como se fosse uma criança",
      "O receio de perder a capacidade de dirigir e cuidar do próprio dinheiro",
      "A sensação de que sua mente está se desvanecendo dia após dia"
    ],
    medos: [
      "Perder a memória completa do rosto e nome dos netos",
      "Ficar dopada em uma cama de hospital geriátrico",
      "Depender de fraldas geriátricas e cuidadores desconhecidos em casa",
      "Gastar toda a herança da família em tratamentos médicos ineficazes",
      "Perder a lucidez e não ter mais voz sobre sua própria vida"
    ],
    objecoes: [
      "Comer mel comum do supermercado não faz o mesmo efeito? (Resposta: Não! O mel comum de mercado é pasteurizado a altas temperaturas, diluído com xarope de milho e sem nenhum bioativo vivo. O MemoFlow usa o mel selvagem não-aquecido da Ilha de Ikaria colhido em altitude, onde as abelhas polinizam plantas ricas em antocianinas raras que quelam metais pesados)",
      "Já tomei Ginkgo Biloba e Prevagen e não adiantou nada. (Resposta: Prevagen e Ginkgo tentam forçar neurônios intoxicados a conduzir impulsos. O MemoFlow quela o cádmio primeiro em 10 segundos sublinguais, limpando o caminho para a acetilcolina fluir)",
      "É seguro para quem tem diabetes? (Resposta: Sim, a dosagem sublingual de 2 gotas fornece menos de 0,2g de carboidrato — insignificante para a glicose, mas com concentração máxima de fitoquímicos no sangue)",
      "Como devo tomar? (Resposta: Apenas 2 gotas sublinguais sob a língua toda manhã ao acordar; deixe agir por 10 segundos antes de engolir)"
    ],
    sub_avatares: [
      {
        nome: "1. A Guardiã Matriarca (60-75 anos)",
        descricao: "Mulher que sempre cuidou de tudo na família e teme que a perda de memória destrua sua liderança.",
        dor_principal: "Sentir que os filhos estão assumindo suas decisões porque ela esqueceu algumas coisas.",
        hook: "Para a mãe de 65 anos que cansou de ver os filhos trocarem olhares quando ela esquece um nome...",
        crenca_bloqueadora: "Não há como reverter o esquecimento depois dos 60 anos.",
        crenca_necessaria: "O mel de Ikaria desbloqueia a acetilcolina sináptica em menos de 10 dias.",
        objecao: "Acho que meu caso já é demência e não tem conserto.",
        asset_primario: "Advertorial 1 (The Honey Trick) + Advertorial Eleanor",
        urgencia: 5,
        dinheiro: 5
      },
      {
        nome: "2. O Intelectual Aposentado (58-72 anos)",
        descricao: "Homem acostumado a ler muito, trabalhar com raciocínio e que agora perde o foco rapidamente.",
        dor_principal: "Ver sua capacidade analítica e memória de trabalho se deteriorando.",
        hook: "Se você sempre teve raciocínio rápido e agora se pega travando no meio de frases simples...",
        crenca_bloqueadora: "Só remédios psiquiátricos pesados conseguem agir no cérebro.",
        crenca_necessaria: "O orotato de lítio natural protege a bainha de mielina com segurança botânica.",
        objecao: "Quero ver os estudos científicos de Ikaria antes de tomar.",
        asset_primario: "PDP MemoPryl LPs",
        urgencia: 5,
        dinheiro: 5
      }
    ],
    voyerismos: [
      {
        nome: "O Branco no Jantar de Família",
        intensidade: "9.8/10",
        situacao: "Na mesa de domingo, começa a contar uma história sobre a infância da filha, tenta lembrar o nome da professora, trava por 15 segundos, o genro tenta adivinhar e todos ficam em silêncio com olhares complacentes.",
        sintoma_fisico: "Calor subindo pelo pescoço, mãos trêmulas e nó na garganta.",
        pensamento: "'Meu Deus, eles acham que eu estou ficando gagá... eu não posso esquecer as coisas na frente deles.'",
        comportamento: "Disfarça dizendo que 'o cansaço está grande', levanta para ir à cozinha e fica olhando pela janela chorando baixinho.",
        uso_copy: "Lead emocional suprema para VSL e anúncios em redes sociais."
      }
    ],
    problemas: [
      {
        rank: 1,
        nome: "Biofilme de Cádmio Bloqueando Sinapses de Acetilcolina",
        total: 69,
        cena_voyerismo: "Esquecer a palavra que ia dizer exatamente no segundo em que abriu a boca para falar.",
        scores: { dor: 10, desejo: 10, piora: 10, veloc_: 9, pagar: 10, comun_: 10, freq_: 10 }
      }
    ],
    headlines: [
      { categoria: "Segredo Blue Zone", texto: "A Descoberta da Ilha de Ikaria: O Truque do Mel Sublingual de 10 Segundos Que Neurologistas Estão Usando Para Restaurar a Memória 55+" },
      { categoria: "Causa Raiz", texto: "Estudo Revela a 'Neurotoxina Invisível' Que Destrói a Memória Após os 55 Anos (E Não É o Que os Médicos Dizem)" }
    ],
    ganchos: [
      { tipo: "Visual 0-3s", texto: "[Gotas de mel dourado caindo de um conta-gotas sob a língua] 'Se você tem mais de 55 anos e vive esquecendo chaves e nomes, pingue isso sob a língua toda manhã.'" }
    ],
    bullets: [
      { tipo: "Fascination", texto: "Por que você NUNCA deve tomar nootrópicos com cafeína pesada após os 55 anos (eles aceleram o esgotamento da acetilcolina)" }
    ],
    micro_historias: [
      {
        titulo: "O Enigma dos Centenários de Ikaria",
        historia: "Na pequena ilha grega de Ikaria, as pessoas vivem rotineiramente além dos 90 anos sem apresentar nenhum sinal de perda de memória ou demência. O mistério só foi decifrado quando bioquímicos analisaram o mel das montanhas consumido diariamente em jejum: ele é carregado de flavonoides raros que agem como ímãs, quelando metais pesados e restaurando a bainha de mielina dos neurônios."
      }
    ],
    gatilhos: [
      {
        nome: "O Esquecimento da Chave na Porta",
        categoria: "Alarme de Pânico",
        intensidade: "10/10",
        situacao: "Voltar para casa e encontrar a chave esquecida virada na fechadura do lado de fora desde a manhã.",
        copy_sugerido: "Aquele susto paralisante ao ver que você deixou a porta destrancada o dia inteiro sem perceber."
      }
    ],
    storyboard: {
      antes: "Lapsos diários de memória, constrangimento em reuniões familiares, medo sufocante de asilos e perda de controle.",
      trigger: "O susto de esquecer o fogão ligado e quase causar um acidente doméstico sério.",
      busca: "Pesquisou sobre a longevidade cognitiva da Ilha de Ikaria e descobriu a ação quelante das antocianinas sublinguais.",
      objecao: "'Será que 2 gotinhas sublinguais conseguem recuperar sinapses de quem já passou dos 65?'",
      decisao: "Comprou o tratamento de 6 frascos do MemoFlow; na 2ª semana a clareza mental voltou com vigor e os brancos desapareceram."
    }
  },
  data: baseData.memoflow.data
};

// 5. CardioFlush (CardioClear / Hipertensão)
godModeData['cardioflush'] = {
  id: "cardioflush",
  name: "CardioFlush",
  category: "DTC Nutra",
  color: "#ef4444",
  icon: "Heart",
  description: "Solução líquida cardiovascular (The Arterial Flush Ritual) com fitonutrientes botânicos que dissolvem placas de cálcio e fibrina no endotélio, relaxam as paredes arteriais e normalizam a pressão em 120/80 sem efeitos colaterais.",
  avatar: {
    nome: "Arthur Vance (O Hipertenso Apreensivo)",
    idade_faixa: "52-72 anos",
    renda: "$65,000 - $110,000 / ano",
    localizacao: "Regiões metropolitanas dos EUA",
    desejo_externo: "Pressão arterial estável cravada em 120 por 80 todos os dias sem precisar de 3 remédios pesados",
    desejo_interno: "Viver em paz sem o pavor constante de sofrer um AVC isquêmico dormindo ou ter um infarto fulminante na cadeira da sala",
    inimigo: "O protocolo tradicional que trata hipertensão apenas com diuréticos e betabloqueadores que enfraquecem o coração e causam disfunção erétil",
    resultado_sonhado: "Colocar o aparelho de pressão no braço toda manhã e ver o visor verde marcando 118 por 78 com batimentos calmos",
    trigger_event: "Sentir o sangue latejando com força na nuca e no ouvido após uma discussão no trabalho e ver o monitor marcar 175/105",
    fase_consciencia: "Consciente da Solução / Sofisticação Estágio 4 (Toma Losartana, Anlodipino e Hidroclorotiazida, mas a pressão continua instável)",
    crenca_bloqueadora: "Pressão alta é para sempre; minhas artérias já estão velhas e preciso de remédios cada vez mais fortes.",
    crenca_necessaria: "A sua pressão não sobe por causa do coração, mas porque suas artérias estão calcificadas como canos enferrujados. O ritual de descalcificação limpa a fibrina endotelial em 30 dias.",
    epifania_central: "Não adianta tomar remédio que força o coração a bater mais fraco; a solução definitiva é descalcificar as paredes arteriais para o sangue correr livre.",
    gatilho_nuclear: "O som alto do próprio coração batendo no travesseiro à noite, impedindo o sono pelo medo da morte súbita.",
    the_hell: "Sentir a cabeça pulsar nas têmporas no final do dia, colocar o aparelho de pressão no braço e ver 165 por 98. Lembrar do irmão ou amigo que teve um AVC do nada aos 58 anos e passar a noite com medo de não acordar no dia seguinte.",
    the_high: "Medir a pressão em repouso e ver 118 por 78 no visor, sentir o peito leve e solto sem nenhuma queimação, e receber os parabéns do médico no check-up anual.",
    segredo_final: "O ritual matinal de extratos botânicos revelado pelo Dr. Gupta que quebra a ligação eletrostática do cálcio com a fibrina nas paredes das artérias coronárias.",
    _avatar_meta: {
      retrato: { score: 98, reason: "Dossiê vascular de compradores hipertensos", source: "Briefing CardioFlush" },
      arquetipo: { score: 96, reason: "O Provedor em Tensão Máxima", source: "Avatar v8" },
      ferida_central: { score: 97, reason: "Terror paralisante de AVC e sequelas motoras", source: "Clinical Stats" },
      desejo_externo: { score: 99, reason: "Pressão arterial 120/80 estável", source: "Cardio Logs" },
      desejo_interno: { score: 98, reason: "Paz mental e segurança de longevidade", source: "Rebel Copy" },
      crenca_bloqueadora: { score: 96, reason: "Crença de que artérias rígidas nunca voltam a ser elásticas", source: "Schwartz Matrix" },
      crenca_necessaria: { score: 97, reason: "Descalcificação endotelial e síntese de óxido nítrico", source: "CBS Gupta Lead" },
      epifania_central: { score: 98, reason: "Momento chave do pitch aos 29:40", source: "VSL Script" },
      desejos_externos: { score: 98, reason: "10 desejos clínicos ranqueados", source: "Escavador de Desejos" },
      desejos_internos: { score: 97, reason: "10 desejos emocionais profundos", source: "Escavador de Desejos" },
      desejos_proibidos: { score: 95, reason: "5 desejos inconfessáveis", source: "VOC Surveys" },
      medos: { score: 99, reason: "AVC com paralisia e infarto agudo", source: "AHA Reports" },
      objecoes: { score: 97, reason: "Segurança de associação com medicação atual", source: "Medical Protocols" }
    },
    perfil_psicologico: {
      retrato: "Homem de 62 anos, executivo, empresário ou servidor aposentado. Há 12 anos convive com diagnóstico de pressão alta. Toma coquetel de 3 comprimidos diários que o deixam letárgico, com tonturas ao levantar e disfunção erétil crônica.",
      arquetipo: "O Vigilante Angustiado / O Prisioneiro do Tensiómetro",
      ferida_central: "Sentir que seu coração é uma bomba-relógio prestes a explodir a qualquer momento de tensão emocional.",
      padrao: "Mede a pressão obsessivamente 4 vezes ao dia. Quanto mais alta a medição, mais nervoso ele fica, gerando um ciclo vicioso que sobe a pressão ainda mais.",
      contradicao: "Diz para a família que 'está tudo sob controle médico', mas vive em terror secreto toda vez que sente uma dorzinha no braço esquerdo ou uma pontada no peito."
    },
    camadas_psique: {
      c1_observaveis: "Carrega a braçadeira de pressão digital na pasta de trabalho; evita sal de forma neurótica; senta para descansar ao subir escadas.",
      c2_conscientes: "Quer ver o aparelho marcar 120 por 80 de forma estável; quer parar de tomar remédios diuréticos que o fazem urinar a cada 30 minutos.",
      c3_subconscientes: "Pavor de ter um derrame que paralise metade do seu corpo e tire sua capacidade de falar ou trabalhar.",
      c4_trauma: "Presenciou o infarto fulminante de um colega de trabalho da mesma idade durante uma reunião há 4 anos."
    },
    desejos_externos: [
      { rank: 1, nome: "Pressão arterial 120/80 consistente de manhã e à noite", score: 80, justificativa: "Normalização cardiovascular definitiva." },
      { rank: 2, nome: "Poder diminuir ou eliminar comprimidos pesados sob supervisão médica", score: 79, justificativa: "Fim da intoxicação medicamentosa." },
      { rank: 3, nome: "Fim das tonturas e vertigens ao levantar da cama ou da cadeira", score: 78, justificativa: "Equilíbrio postural seguro." },
      { rank: 4, nome: "Coração batendo com ritmo leve, calmo e firme sem palpitações", score: 77, justificativa: "Fim do pavor de arritmias." },
      { rank: 5, nome: "Fôlego limpo para subir escadas e caminhar sem cansaço no peito", score: 75, justificativa: "Resistência aeróbica resgatada." },
      { rank: 6, nome: "Sono tranquilo sem ouvir o sangue batendo no ouvido", score: 73, justificativa: "Paz para descansar à noite." },
      { rank: 7, nome: "Melhora expressiva da circulação e potência masculina", score: 72, justificativa: "Fim dos efeitos colaterais de betabloqueadores." },
      { rank: 8, nome: "Eliminação do inchaço nos tornozelos e retenção de sódio", score: 70, justificativa: "Conforto nos pés e pernas." },
      { rank: 9, nome: "Descalcificação comprovada nos exames de ultrassom de carótidas", score: 68, justificativa: "Comprovação clínica de desobstrução." },
      { rank: 10, nome: "Economia de $200 a $400 mensais com copagamento de remédios", score: 66, justificativa: "Alívio financeiro familiar." }
    ],
    desejos_internos: [
      { rank: 1, nome: "Sentir paz e certeza de que seu coração está blindado", score: 80, justificativa: "Fim da neurose da morte súbita." },
      { rank: 2, nome: "Viver com segurança para acompanhar o crescimento dos netos", score: 79, justificativa: "Propósito familiar primordial." },
      { rank: 3, nome: "Não ser uma preocupação médica angustiante para a esposa", score: 78, justificativa: "Alívio conjugal mútuo." },
      { rank: 4, nome: "Recuperar a energia vital para viajar e praticar esportes leves", score: 76, justificativa: "Aproveitamento dos anos de aposentadoria." },
      { rank: 5, nome: "Sentir o corpo leve, limpo e desintoxicado de químicos", score: 74, justificativa: "Bem-estar fisiológico profundo." },
      { rank: 6, nome: "Parar de viver com medo de cada pontada nas costas ou no braço", score: 73, justificativa: "Liberdade psicológica diária." },
      { rank: 7, nome: "Ver o médico parabenizá-lo pela saúde das suas artérias", score: 71, justificativa: "Validação médica oficial." },
      { rank: 8, nome: "Sentir-se um homem forte, capaz e provedor", score: 70, justificativa: "Autoestima masculina." },
      { rank: 9, nome: "Nunca precisar passar por cirurgia cardíaca aberta ou cateterismo", score: 68, justificativa: "Fuga de procedimentos invasivos." },
      { rank: 10, nome: "Viver com calma e serenidade sem ansiedade hipertensiva", score: 67, justificativa: "Equilíbrio emocional." }
    ],
    desejos_proibidos: [
      { rank: 1, nome: "Poder comer um churrasco saboroso com sal e cerveja sem a esposa vigiando apavorada", score: 80, justificativa: "Liberdade alimentar e conjugal sem censura." },
      { rank: 2, nome: "Guardar o aparelho de medir pressão em uma gaveta trancada e esquecer dele", score: 79, justificativa: "Abolição da rotina hospitalar em casa." },
      { rank: 3, nome: "Provar para a família inteira que sua saúde arterial é mais jovem que a deles", score: 77, justificativa: "Triunfo de vitalidade." },
      { rank: 4, nome: "Ter relações íntimas intensas sem medo do coração falhar no meio", score: 76, justificativa: "Resgate da paixão sem paranoia médica." },
      { rank: 5, nome: "Ver o cardiologista suspender as receitas com cara de surpresa", score: 74, justificativa: "Vitória contra a dependência farmacêutica." }
    ],
    dores_superficiais: [
      "Cabeça latejando nas têmporas no fim da tarde",
      "Visão com pontinhos brilhantes ao levantar rápido",
      "Tosse seca crônica causada por remédios de pressão (inibidores da ECA)",
      "Pés e tornozelos inchados no final do dia",
      "Letargia pesada e cansaço ao fazer qualquer esforço físico leve"
    ],
    dores_profundas: [
      "O terror paralisante de sofrer um AVC que deixe sequelas de fala e movimento",
      "O pavor de ter um infarto do miocárdio fulminante e não ver os filhos vencerem na vida",
      "A frustração amarga de depender de um coquetel diário de remédios químicos para sobreviver",
      "A impotência sexual gerada pelos efeitos colaterais dos remédios de pressão",
      "A sensação sufocante de que seu corpo é uma bomba-relógio com pavio curto"
    ],
    medos: [
      "Medo de ficar paralisado em uma cadeira de rodas após um derrame hemorrágico",
      "Pavor de precisar de cateterismo de emergência, stents coronários ou pontes de safena",
      "Medo de morte súbita enquanto dorme ao lado da parceira",
      "Pavor de falência renal provocada pela hipertensão crônica não resolvida",
      "Medo de virar um paciente dependente de cuidados em tempo integral"
    ],
    objecoes: [
      "Posso parar de tomar meus remédios de pressão imediatamente? (Resposta: Não! Nunca interrompa medicações prescritas de forma abrupta. Tome o CardioFlush diariamente; conforme suas artérias forem descalcificadas e sua pressão se normalizar em 120/80, seu próprio médico fará a redução gradual e segura dos comprimidos)",
      "Suplementos de coração realmente funcionam? (Resposta: A maioria vende apenas CoQ10 barato com menos de 5% de absorção. O CardioClear utiliza a dosagem clínica exata de bioflavonoides que quebram o cálcio endotelial comprovada em ensaios clínicos)",
      "Tenho pressão alta há mais de 15 anos, ainda funciona para mim? (Resposta: Sim, a regeneração endotelial ocorre em qualquer idade quando o biofilme de fibrina e os microdepósitos minerais são dissolvidos)",
      "Em quanto tempo a pressão começa a estabilizar? (Resposta: Grande parte dos usuários nota queda na rigidez vascular e estabilização dos picos pressóricos já entre 14 e 21 dias de uso contínuo)"
    ],
    sub_avatares: [
      {
        nome: "1. O Hipertenso Polimedicado (55-70 anos)",
        descricao: "Toma 2 a 3 remédios de pressão todo dia, sofre com tosse seca, tontura e impotência.",
        dor_principal: "A pressão continua subindo mesmo com a dose máxima de remédios.",
        hook: "Para quem toma 2 ou mais remédios de pressão e ainda assim vê o visor marcar 150 por 90...",
        crenca_bloqueadora: "Se com 3 remédios não baixou, nada natural vai resolver.",
        crenca_necessaria: "Remédios apenas forçam o vaso; o ritual botânico limpa a placa de cálcio que obstrui o vaso.",
        objecao: "Tenho medo de misturar o suplemento com minha medicação.",
        asset_primario: "VSL Oficial CBS Breaking News + Domínio usecardioclear.com",
        urgencia: 5,
        dinheiro: 5
      }
    ],
    voyerismos: [
      {
        nome: "A Pulsação no Travesseiro",
        intensidade: "9.9/10",
        situacao: "Deita a cabeça no travesseiro às 23h30 e ouve o sangue batendo no ouvido com força acelerada: 'tum... tum... tum...', lembrando do amigo que enfartou dormindo.",
        sintoma_fisico: "Boca seca, suor frio nas palmas das mãos e respiração curta de pânico.",
        pensamento: "'Será que minha pressão subiu de novo? Se eu dormir agora, será que eu acordo amanhã?'",
        comportamento: "Levanta no escuro, vai até a cozinha, bebe um copo d'água e senta no sofá por 40 minutos com a luz apagada até se acalmar.",
        uso_copy: "Abertura hipnótica de alta conversão para VSL e advertoriais."
      }
    ],
    problemas: [
      {
        rank: 1,
        nome: "Calcificação Endotelial e Perda de Elasticidade das Artérias",
        total: 69,
        cena_voyerismo: "A pressão disparar para 165/100 mesmo sem ter feito nenhum esforço físico no dia.",
        scores: { dor: 10, desejo: 10, piora: 10, veloc_: 9, pagar: 10, comun_: 10, freq_: 10 }
      }
    ],
    headlines: [
      { categoria: "Breaking News CBS", texto: "Cardiologistas Revelam o 'Arterial Flush Ritual': A Descoberta de $0,40 Que Está Descalcificando Artérias e Normalizando a Pressão em 120/80" },
      { categoria: "Causa Raiz", texto: "Por Que Seus Remédios de Pressão Não Estão Funcionando: A 'Malha de Fibrina' Oculta Que Ninguém Te Mostrou" }
    ],
    ganchos: [
      { tipo: "Visual 0-3s", texto: "[Gráfico 3D de uma artéria entupida de cálcio sendo lavada por um líquido dourado] 'Se a sua pressão insiste em ficar acima de 140, pare tudo e veja este ritual matinal.'" }
    ],
    bullets: [
      { tipo: "Fascination", texto: "O sinal de alerta na nuca que indica se suas carótidas estão com fluxo sanguíneo restrito" }
    ],
    micro_historias: [
      {
        titulo: "O Relatório de Desobstrução do Dr. Gupta",
        historia: "Ao analisar exames angiográficos de pacientes idosos que mantinham artérias flexíveis como as de jovens de 20 anos, cardiologistas identificaram que a enzima eNOS desses indivíduos era constantemente alimentada por flavonoides específicos que impedem a adesão de cálcio nas paredes dos vasos."
      }
    ],
    gatilhos: [
      {
        nome: "A Tontura ao Levantar do Sofá",
        categoria: "Aviso Vascular",
        intensidade: "10/10",
        situacao: "Levantar rápido para atender a porta e sentir o chão sumir debaixo dos pés pela queda brusca de oxigenação cerebral.",
        copy_sugerido: "Aquele segundo de escuridão nos olhos quando você levanta e precisa se apoiar na parede."
      }
    ],
    storyboard: {
      antes: "Hipertenso há anos, polimedicado com tonturas e disfunção erétil, pavor de AVC súbito na cama.",
      trigger: "Uma crise hipertensiva severa no trabalho que o levou para o pronto-socorro com 180 por 110.",
      busca: "Assistiu ao documentário do Dr. Gupta sobre o ritual de descalcificação endotelial e os perigos dos diuréticos sintéticos.",
      objecao: "'Será que um composto botânico líquido consegue baixar a pressão melhor que 3 remédios químicos?'",
      decisao: "Adquiriu o protocolo de 6 frascos do CardioClear; em 21 dias a pressão cravou em 118/78 estável e as dores na nuca sumiram."
    }
  },
  data: baseData.cardioflush.data
};

// 6. Leaftide (Matcha / Drenagem Linfática)
godModeData['leaftide'] = {
  id: "leaftide",
  name: "Leaftide",
  category: "DTC Nutra",
  color: "#06b6d4",
  icon: "Droplets",
  description: "Chá solúvel cerimonial concentrado (The $1 Matcha Ritual) que estimula a circulação linfática, desincha pernas e tornozelos pesados e ativa a queima de gordura retida sem dietas radicais.",
  avatar: {
    nome: "Brenda Taylor (A Mulher das Pernas Cansadas)",
    idade_faixa: "45-68 anos",
    renda: "$50,000 - $90,000 / ano",
    localizacao: "Cidades do interior e subúrbios dos EUA",
    desejo_externo: "Tornozelos finos e desinchados todos os dias, eliminando 10 lbs de líquido retido e dores nas pernas",
    desejo_interno: "Sentir o corpo leve e rejuvenescido, voltar a usar vestidos curtos e sandálias no verão sem vergonha da celulite e inchaço",
    inimigo: "A crença de que retenção severa de líquidos é 'gordura teimosa' ou 'falta de exercício', e clínicas de drenagem linfática que cobram $150 por sessão",
    resultado_sonhado: "Chegar em casa às 19h após um dia inteiro de trabalho, tirar os sapatos e ver as pernas finas, leves e sem nenhuma marca de edema",
    trigger_event: "Ver a marca funda e dolorosa da meia cravada no tornozelo e não conseguir fechar o zíper de uma bota de inverno",
    fase_consciencia: "Consciente da Solução / Sofisticação Estágio 4 (Já tomou chás diuréticos comuns de farmácia, mas o inchaço volta em dobro no dia seguinte)",
    crenca_bloqueadora: "Minhas pernas inchadas são varizes e gordura genética; nada além de cirurgia ou meia elástica sufocante resolve.",
    crenca_necessaria: "O seu problema não é gordura, mas 4 litros de linfa tóxica estagnada nos gânglios inguinais. O Matcha cerimonial microfiltrado desobstrui esses gânglios em 24 horas.",
    epifania_central: "Para desinchar as pernas você não precisa de massagens caras nem de cortar sal; precisa apenas reabrir as comportas dos capilares linfáticos.",
    gatilho_nuclear: "Apertar o tornozelo com o polegar e ver a marca afundada na carne por mais de 10 segundos (sinal clássico de cacifo/edema).",
    the_hell: "Chegar em casa às 18h, tirar o sapato com dor, ver o tornozelo com o dobro do tamanho normal com o elástico da meia cravado na pele inchada, e ter que deitar no sofá com as pernas levantadas em almofadas sem ânimo para fazer o jantar.",
    the_high: "Acordar de manhã, colocar uma bota de cano alto sem apertar nada, passar o dia inteiro de pé com pernas leves como plumas e olhar no espelho vendo pernas esguias e tonificadas.",
    segredo_final: "O ritual matinal de Matcha Cerimonial puro revelado no TODAY Show pela Melissa McCarthy que ativou a drenagem intersticial e eliminou 95 lbs de peso e linfa.",
    _avatar_meta: {
      retrato: { score: 98, reason: "Dossiê de retenção linfática feminina", source: "Briefing Leaftide" },
      arquetipo: { score: 96, reason: "A Trabalhadora Resignada", source: "Avatar v8" },
      ferida_central: { score: 97, reason: "Vergonha estética e sofrimento físico nas pernas", source: "VOC Surveys" },
      desejo_externo: { score: 99, reason: "Desinchar pernas e tornozelos finos", source: "Clinical Data" },
      desejo_interno: { score: 98, reason: "Autoestima corporal feminina plena", source: "Rebel Copy" },
      crenca_bloqueadora: { score: 96, reason: "Confusão entre gordura real e líquido estagnado", source: "Schwartz Matrix" },
      crenca_necessaria: { score: 97, reason: "Mecanismo das comportas linfáticas e EGCG", source: "Lymphatic Health" },
      epifania_central: { score: 98, reason: "Ponto alto do TODAY Show pitch aos 20:15", source: "VSL Script" },
      desejos_externos: { score: 98, reason: "10 itens ranqueados", source: "Escavador de Desejos" },
      desejos_internos: { score: 97, reason: "10 itens de alívio e bem estar", source: "Escavador de Desejos" },
      desejos_proibidos: { score: 95, reason: "5 desejos inconfessáveis", source: "VOC Forums" },
      medos: { score: 99, reason: "Linfedema crônico e trombose venosa", source: "Vascular Reports" },
      objecoes: { score: 97, reason: "Matcha cerimonial vs chá verde comum", source: "Nutritional Labs" }
    },
    perfil_psicologico: {
      retrato: "Mulher de 54 anos, enfermeira, professora, vendedora ou funcionária pública. Passa de 6 a 10 horas de pé ou sentada na mesma posição. Ao final da tarde, sente as pernas pesadas como toras de madeira.",
      arquetipo: "A Heroína Cansada / A Mulher das Pernas Pesadas",
      ferida_central: "Sentir que seu corpo perdeu a leveza e a feminilidade, sendo obrigada a usar calças compridas e sapatos ortopédicos feios mesmo no verão.",
      padrao: "Compra meias elásticas de compressão apertadas que pinicam a pele, usa por 2 dias e desiste porque não aguenta o calor e o incômodo.",
      contradicao: "Diz que 'o inchaço é apenas cansaço da rotina', mas esconde as pernas debaixo da mesa e recusa convites para ir à praia ou piscina."
    },
    camadas_psique: {
      c1_observaveis: "Senta com as pernas levantadas sobre pufes ou almofadas; descalça os sapatos embaixo da mesa; usa calças largas para cobrir as pernas.",
      c2_conscientes: "Quer calçar sandálias abertas sem o tornozelo transbordar sobre as tiras; quer eliminar 5kg de retenção de líquido rápido.",
      c3_subconscientes: "Medo de desenvolver trombose venosa profunda (TVP) ou úlceras varicosas que deixem cicatrizes permanentes.",
      c4_trauma: "O dia em que foi madrinha de casamento e teve que tirar o salto alto no meio da festa porque o pé não cabia mais no calçado."
    },
    desejos_externos: [
      { rank: 1, nome: "Tornozelos finos, definidos e sem inchaço ao fim do dia", score: 80, justificativa: "Alívio físico imediato nos calçados." },
      { rank: 2, nome: "Eliminar de 8 a 15 lbs de retenção líquida nas primeiras 3 semanas", score: 79, justificativa: "Redução instantânea do peso na balança." },
      { rank: 3, nome: "Redução visível dos nódulos de celulite nas coxas e bumbum", score: 78, justificativa: "Melhora da textura e firmeza da pele." },
      { rank: 4, nome: "Pernas leves como plumas sem sensação de peso ou queimação", score: 77, justificativa: "Energia para caminhar e trabalhar." },
      { rank: 5, nome: "Poder usar sandálias de tiras finas e sapatos elegantes", score: 75, justificativa: "Liberdade de vestuário feminino." },
      { rank: 6, nome: "Fim das marcas profundas das meias ou calças na pele", score: 73, justificativa: "Sinal de circulação desimpedida." },
      { rank: 7, nome: "Dormir a noite inteira sem cãibras ou síndrome das pernas inquietas", score: 72, justificativa: "Descanso muscular noturno." },
      { rank: 8, nome: "Sensação de cintura mais fina e abdômen menos estufado", score: 70, justificativa: "Drenagem corporal integral." },
      { rank: 9, nome: "Economia de fortunas com massagistas e sessões de drenagem", score: 68, justificativa: "Autonomia de autocuidado em casa." },
      { rank: 10, nome: "Prevenção efetiva contra varizes grossas e vasinhos roxos", score: 67, justificativa: "Saúde vascular das pernas." }
    ],
    desejos_internos: [
      { rank: 1, nome: "Sentir o corpo leve, ágil e jovem novamente", score: 80, justificativa: "Libertação do peso morto da linfa." },
      { rank: 2, nome: "Recuperar a autoestima e o orgulho das próprias pernas", score: 79, justificativa: "Segurança estética feminina." },
      { rank: 3, nome: "Sentir-se bonita e atraente de vestido curto no calor", score: 78, justificativa: "Aproveitamento do verão sem vergonha." },
      { rank: 4, nome: "Voltar para casa do trabalho com disposição para passear", score: 76, justificativa: "Vida social ativa após as 18h." },
      { rank: 5, nome: "Sentir que venceu a batalha contra a retenção sem remédios", score: 74, justificativa: "Dignidade e autocuidado natural." },
      { rank: 6, nome: "Nunca mais ter vergonha de colocar os pés descalços à mostra", score: 73, justificativa: "Fim da timidez corporal." },
      { rank: 7, nome: "Receber elogios sobre como seu corpo desinchou rápido", score: 71, justificativa: "Validação das amigas e familiares." },
      { rank: 8, nome: "Paz de espírito sabendo que suas veias estão saudáveis", score: 70, justificativa: "Segurança de longevidade." },
      { rank: 9, nome: "Viver sem a dor latejante nas panturrilhas ao deitar", score: 68, justificativa: "Conforto físico essencial." },
      { rank: 10, nome: "Sentir-se renovada, disposta e cheia de energia feminina", score: 67, justificativa: "Vitalidade plena." }
    ],
    desejos_proibidos: [
      { rank: 1, nome: "Receber elogios ardentes no verão sobre como suas pernas estão lindas para a sua idade", score: 80, justificativa: "Autoafirmação de beleza e juventude." },
      { rank: 2, nome: "Fazer as colegas que reclamam de pernas pesadas morrerem de inveja da sua leveza", score: 78, justificativa: "Superioridade estética graciosa." },
      { rank: 3, nome: "Jogar no lixo todas as meias de compressão grossas e feias com ar de alívio", score: 77, justificativa: "Símbolo de libertação da prisão médica." },
      { rank: 4, nome: "Usar um vestido curto e decotado em uma festa sem nenhuma preocupação com celulite", score: 75, justificativa: "Sensualidade feminina recuperada." },
      { rank: 5, nome: "Comprovar na balança que perdeu 4 quilos em 7 dias apenas fazendo xixi", score: 74, justificativa: "Prazer imediato de esvaziamento de líquidos." }
    ],
    dores_superficiais: [
      "Tornozelos inchados que dobram de tamanho no final do dia",
      "Marcas fundas da costura da meia cravadas na pele por horas",
      "Sapatos apertando os dedos e calcanhares às 17h",
      "Pele das coxas com aspecto ondulado e celulite profunda",
      "Dores latejantes e cansaço pesado nas panturrilhas"
    ],
    dores_profundas: [
      "A vergonha sufocante de usar saias ou biquíni em público por causa do inchaço",
      "O medo paralisante de que o inchaço evolua para linfedema crônico irreversível",
      "A frustração de subir na balança e ver o peso subir mesmo sem ter comido nada pesado",
      "O esgotamento físico de terminar todo dia de trabalho sem ânimo para brincar com os filhos",
      "A sensação de que seu corpo está envelhecendo mais rápido que o das suas amigas"
    ],
    medos: [
      "Medo de desenvolver trombose venosa profunda (TVP) com coágulos que viajem para o pulmão",
      "Pavor de ficar com pernas deformadas (linfedema avançado) e precisar de andador",
      "Medo de perder a mobilidade e não conseguir mais trabalhar de pé",
      "Pavor de cirurgias vasculares dolorosas para remoção de veias varicosas",
      "Medo de ficar confinada em casa com as pernas para cima pelo resto da vida"
    ],
    objecoes: [
      "Chá verde comum de supermercado não faz a mesma coisa? (Resposta: De jeito nenhum! Chás de saquinho de mercado utilizam folhas oxidadas e moídas com menos de 2% de EGCG bioativo. O Leaftide é formulado com Matcha Cerimonial Japonês de 1ª colheita com biodisponibilidade 137x superior, veiculado com bioflavonoides que reabrem os capilares linfáticos)",
      "Vou ficar desidratada ou perder minerais importantes? (Resposta: Não. Diuréticos químicos roubam potássio e desidratam os tecidos. O ritual de Matcha drena apenas o fluido tóxico estagnado do espaço intersticial, mantendo o equilíbrio eletrolítico celular perfeito)",
      "Em quanto tempo começo a notar os tornozelos mais finos? (Resposta: A imensa maioria das mulheres relata aumento expressivo na frequência urinária nas primeiras 24 horas e redução palpável do inchaço nos tornozelos em 5 a 7 dias)"
    ],
    sub_avatares: [
      {
        nome: "1. A Enfermeira / Vendedora que Trabalha em Pé (45-60 anos)",
        descricao: "Fica o dia inteiro de pé, chega em casa com as pernas pulsando de dor e tornozelos estufados.",
        dor_principal: "Dor física e sensação de peso insuportável ao final da jornada de trabalho.",
        hook: "Para a mulher que passa mais de 6 horas de pé por dia e volta para casa com as pernas parecendo troncos...",
        crenca_bloqueadora: "Trabalhar em pé inevitavelmente destrói a circulação e não tem como evitar.",
        crenca_necessaria: "O Matcha cerimonial ativa as bombas linfáticas naturais enquanto você caminha.",
        objecao: "Não tenho tempo para fazer rituais demorados.",
        asset_primario: "Quiz Funnel Vercel (Healthy Legs Daily)",
        urgencia: 5,
        dinheiro: 4
      }
    ],
    voyerismos: [
      {
        nome: "O Descalçar Doloroso das Botas",
        intensidade: "9.8/10",
        situacao: "Chega em casa às 18h30 depois de um dia puxado, senta na beirada da cama para puxar o zíper da bota e ele simplesmente trava na metade da panturrilha porque a perna dobrou de volume.",
        sintoma_fisico: "Dor aguda ao puxar o couro esticado, pele quente e avermelhada pelo aperto.",
        pensamento: "'Que horror... de manhã fechou tão fácil e agora eu mal consigo tirar o sapato do pé.'",
        comportamento: "Puxa a bota com força com os dentes cerrados, deita de costas na cama e fica 15 minutos com os pés para o alto esperando a dor latejante passar.",
        uso_copy: "Lead visual e sensorial de abertura para VSL e anúncios verticais."
      }
    ],
    problemas: [
      {
        rank: 1,
        nome: "Colapso dos Capilares Linfáticos e Retenção Intersticial de Linfa Tóxica",
        total: 69,
        cena_voyerismo: "O elástico da meia afundar 1 centímetro na carne inchada do tornozelo e a marca ficar visível por 4 horas.",
        scores: { dor: 10, desejo: 10, piora: 10, veloc_: 9, pagar: 10, comun_: 10, freq_: 10 }
      }
    ],
    headlines: [
      { categoria: "Celebridade TODAY Show", texto: "Melhor Que Ozempic? O Ritual de Matcha de $1 Que Melissa McCarthy Revelou no TODAY Show Para Eliminar 95 lbs e Desinchar as Pernas" },
      { categoria: "Causa Raiz", texto: "Não É Gordura, É Linfa Tóxica: O Truque de Cozinha Que Esvazia 4 Litros de Retenção das Coxas e Tornozelos em 14 Dias" }
    ],
    ganchos: [
      { tipo: "Visual 0-3s", texto: "[Apertando um tornozelo inchado com o polegar e a marca branca ficando afundada] 'Se o seu tornozelo fica assim no fim do dia, pare de tomar diuréticos de farmácia.'" }
    ],
    bullets: [
      { tipo: "Fascination", texto: "Por que chás de saquinho de supermercado pioram a retenção ao inflamar a mucosa do estômago" }
    ],
    micro_historias: [
      {
        titulo: "O Ritual Matinal de Melissa McCarthy",
        historia: "Ao se preparar para papéis no cinema onde precisava de energia e perda rápida de inchaço corporal, a atriz recorreu a um mestre herbalista japonês que formulou um ritual simples de Matcha cerimonial em pó com bioflavonoides drenantes. O resultado foi uma perda de mais de 90 lbs e o fim absoluto das dores nas pernas."
      }
    ],
    gatilhos: [
      {
        nome: "A Marca Funda no Tornozelo",
        categoria: "Sinal Clínico Visível",
        intensidade: "10/10",
        situacao: "Tirar a meia esportiva e ver o sulco profundo deixado na pele que não volta ao normal.",
        copy_sugerido: "Apertar o tornozelo e ver a marca do dedo afundada avisando que a linfa parou de circular."
      }
    ],
    storyboard: {
      antes: "Pernas pesadas como chumbo, tornozelos inchados, meias apertadas e vergonha de usar vestidos no verão.",
      trigger: "Uma foto tirada nas férias onde os tornozelos estavam inchados sobre as sandálias, estragando o dia.",
      busca: "Descobriu o segredo do ritual de Matcha das celebridades e a ciência da drenagem dos capilares linfáticos.",
      objecao: "'Será que um chá solúvel em pó consegue desinchar minhas pernas melhor que drenagem linfática em clínica?'",
      decisao: "Comprou o tratamento de 6 potes do Leaftide; na primeira semana eliminou 3kg de retenção de líquido e as pernas ficaram finas e leves."
    }
  }
};

function extractDataPayload(item) {
  if (item.data) return item.data;
  return {
    publico_alvo: item.publico_alvo,
    mecanismo_unico: item.mecanismo_unico,
    dores: item.dores,
    desejos: item.desejos,
    produtos: item.produtos,
    links: item.links,
    vsl: item.vsl
  };
}

godModeData['vigor_boost'].data = extractDataPayload(baseData.vigor_boost);
godModeData['memoflow'].data = extractDataPayload(baseData.memoflow);
godModeData['cardioflush'].data = extractDataPayload(baseData.cardioflush);
godModeData['leaftide'].data = extractDataPayload(baseData.leaftide);

// Write full data
fs.writeFileSync('scripts/all_6_godmode.json', JSON.stringify(godModeData, null, 2), 'utf8');
console.log('Successfully wrote scripts/all_6_godmode.json with all 6 products in God-Mode!');

// Write SQL statements
for (const [key, p] of Object.entries(godModeData)) {
  const avatarJson = JSON.stringify(p.avatar);
  const dataJson = JSON.stringify(p.data);
  const desc = p.description.replace(/'/g, "''");
  const cat = (p.category || 'DTC Nutra').replace(/'/g, "''");
  const color = (p.color || '#F59E0B').replace(/'/g, "''");
  const icon = (p.icon || 'Sparkles').replace(/'/g, "''");

  const sql = `UPDATE imphq_projects
SET 
  avatar = $avatar$${avatarJson}$avatar$::jsonb,
  data = $data$${dataJson}$data$::jsonb,
  description = '${desc}',
  category = '${cat}',
  color = '${color}',
  icon = '${icon}',
  updated_at = NOW()
WHERE id = '${p.id}';`;

  fs.writeFileSync(`scripts/godmode_update_${p.id}.sql`, sql, 'utf8');
  console.log(`Generated scripts/godmode_update_${p.id}.sql (avatar: ${avatarJson.length} bytes, data: ${dataJson.length} bytes)`);
}
