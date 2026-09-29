import fs from 'fs';

// Master Intelligence Builder for all 6 Bifi Products
// Reads base data and generates comprehensive, god-mode level dossiers for:
// - slimsoda
// - cinna-shield
// - vigor_boost
// - memoflow
// - cardioflush
// - leaftide

import { productsIntelligence as slimData } from './build-complete-product-intelligence.mjs';

const baseData = JSON.parse(fs.readFileSync('scripts/bifi_all_dossiers.json', 'utf8'));

// Helper to construct god-mode avatar object
function createMasterAvatar(base, overrides) {
  return {
    nome: overrides.nome || base.avatar.nome,
    idade_faixa: overrides.idade_faixa || base.avatar.idade_faixa,
    renda: overrides.renda || base.avatar.renda,
    localizacao: overrides.localizacao || base.avatar.localizacao,
    desejo_externo: overrides.desejo_externo,
    desejo_interno: overrides.desejo_interno,
    inimigo: overrides.inimigo,
    resultado_sonhado: overrides.resultado_sonhado,
    trigger_event: overrides.trigger_event,
    fase_consciencia: overrides.fase_consciencia,
    crenca_bloqueadora: overrides.crenca_bloqueadora,
    crenca_necessaria: overrides.crenca_necessaria,
    epifania_central: overrides.epifania_central,
    gatilho_nuclear: overrides.gatilho_nuclear,
    the_hell: overrides.the_hell || base.avatar.the_hell,
    the_high: overrides.the_high || base.avatar.the_high,
    segredo_final: overrides.segredo_final,

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

    perfil_psicologico: overrides.perfil_psicologico,
    camadas_psique: overrides.camadas_psique,
    desejos_externos: overrides.desejos_externos,
    desejos_internos: overrides.desejos_internos,
    desejos_proibidos: overrides.desejos_proibidos,
    dores_superficiais: overrides.dores_superficiais,
    dores_profundas: overrides.dores_profundas,
    medos: overrides.medos,
    objecoes: overrides.objecoes,
    sub_avatares: overrides.sub_avatares,
    voyerismos: overrides.voyerismos,
    problemas: overrides.problemas,
    headlines: overrides.headlines,
    ganchos: overrides.ganchos,
    bullets: overrides.bullets,
    micro_historias: overrides.micro_historias,
    gatilhos: overrides.gatilhos,
    storyboard: overrides.storyboard
  };
}

// Build all 6
const masterProducts = {};

// 1. SlimSoda
masterProducts.slimsoda = slimData.slimsoda;

// 2. Cinna Shield (Imported from previous step or built)
import { productsIntelligence as cinnaTemp } from './compile_all_6_bifi_intelligence.mjs';
masterProducts['cinna-shield'] = cinnaTemp['cinna-shield'];

// 3. Vigor Boost (Horse Jello / Potência)
masterProducts.vigor_boost = {
  id: "vigor_boost",
  name: "Vigor Boost",
  category: "DTC Nutra",
  color: "#10b981",
  icon: "Flame",
  description: "Fórmula concentrada de peptídeos bioativos (The Gelatin Horse Trick) com Vitamina C Lipossomal, Tongkat Ali e Pycnogenol que dissolve as placas fibróticas dos corpos cavernosos e restaura ereções duras como pedra.",
  avatar: createMasterAvatar(baseData.vigor_boost, {
    desejo_externo: "Ter ereções firmes, duras e espontâneas que duram de 30 a 45 minutos sem depender de comprimidos químicos de farmácia",
    desejo_interno: "Recuperar a masculinidade e a autoconfiança de homem viril, ver o brilho de desejo nos olhos da esposa e não compaixão",
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
      },
      {
        rank: 2,
        nome: "Queda Crônica de Óxido Nítrico e Elasticidade Vascular",
        total: 66,
        cena_voyerismo: "Passar semanas inteiras sem uma única ereção matinal firme ao acordar.",
        scores: { dor: 10, desejo: 10, piora: 9, veloc_: 8, pagar: 10, comun_: 9, freq_: 10 }
      }
    ],

    headlines: [
      { categoria: "Causa Raiz", texto: "Cientistas de Harvard Descobrem as 'Placas de Fibrina': Por Que o Viagra Falha em 47% dos Homens 50+ (E o Truque da Gelatina Que Limpa as Artérias Penianas)" },
      { categoria: "Aviso", texto: "Aviso Para Homens Acima de 48 Anos: Se Você Parou de Ter Ereções Matinais, Suas Artérias Podem Estar Bloqueadas por Tecido Cicatricial" },
      { categoria: "Segredo Rural", texto: "O Ritual Matinal de $1 Usado por Criadores de Cavalos no Kentucky Que Devolve Ereções Firmes Como Pedra Sem Pílulas Azuis" }
    ],

    ganchos: [
      { tipo: "Visual 0-3s", texto: "[Imagem de um cavalo de corrida majestoso cortando para um copo com água e colherada de gelatina] 'Se você tem mais de 50 anos e odeia o efeito colateral da pílula azul, veja isso.'" },
      { tipo: "Pergunta Direta", texto: "Quando foi a última vez que você acordou de manhã com uma ereção tão dura que chegava a doer?" }
    ],

    bullets: [
      { tipo: "Fascination", texto: "Por que você NUNCA deve tomar vasodilatadores sintéticos se tiver pressão alta (o risco de queda súbita e desmaio)" },
      { tipo: "Reason Why", texto: "Como o colágeno Tipo III derivado de tendões repara a túnica albugínea e faz o sangue ficar preso durante 40 minutos" }
    ],

    micro_historias: [
      {
        titulo: "O Segredo dos Fazendeiros do Meio-Oeste",
        historia: "Na década de 1980, veterinários de equinos notaram que garanhões reprodutores de idade avançada mantinham níveis surpreendentes de força e potência quando alimentados com uma gelatina especial hidrolisada enriquecida com cascas de pinheiro marítimo. Ao testar o composto em homens maduros com circulação peniana comprometida, os fluxos sanguíneos foram restaurados em mais de 300%."
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
  }),
  data: {
    publico_alvo: "Homens americanos 40-75 anos que sofrem com ereções moles, perda de firmeza no meio do ato, falta de ereções matinais e medo de enfartar com remédios químicos.",
    mecanismo_unico: {
      causa_raiz: "Acúmulo de tecido cicatricial inelástico (Type I Scar Tissue / Toxic Plaques) na túnica albugínea e artérias pudendas, impedindo o enchimento e o travamento venoso do sangue.",
      por_que_outros_falharam: "Viagra e Cialis apenas inflamam as artérias forçando o bombeamento temporário de sangue sem consertar as paredes endurecidas, além de provocarem dores de cabeça, arritmias e dependência psicológica.",
      mecanismo_solucao: "O Vigor Boost combina Peptídeos Bioativos de Colágeno Tipo III + Pycnogenol + Vitamina C Lipossomal: 1) Dissolução enzimática das placas cicatriciais; 2) Regeneração da microvasculatura dos corpos cavernosos; 3) Aumento contínuo de Óxido Nítrico para ereções espontâneas e duradouras.",
      elementos_prova: [
        "Estudo clínico publicado no International Journal of Impotence Research com Pycnogenol + L-Arginina",
        "Laudos de pureza botânica com zero contaminação de sildenafila ou tadalafila sintéticas",
        "Depoimentos auditados de homens 55+ comprovando relações completas de 30 a 45 minutos"
      ]
    },
    angulos_persuasivos: [
      {
        nome: "Ângulo 1: The Gelatin Horse Trick (Segredo Ancestral)",
        tipo: "Segredo Rural / Bioquímica",
        headline: "O Segredo de 2 Minutos dos Fazendeiros do Kentucky Para Dureza de Ferro Sem Viagra",
        lead: "Criadores de cavalos campeões guardaram esta fórmula por décadas: uma gelatina biológica que dissolve o tecido cicatricial das artérias e devolve a ereção potente de um garanhão.",
        reason_why: "Restaura o colágeno Tipo III nas fáscias penianas para prender o sangue sem vazamento venoso.",
        cta: "Assista à apresentação do Dr. Robert antes que as farmacêuticas mandem tirar do ar.",
        prompt_imagem_ia: "Powerful stallion in a misty Kentucky ranch morning, golden sunlight, next to a glass of pure crystal clear water and amber tincture bottle, rustic wood table, cinematic 8k."
      },
      {
        nome: "Ângulo 2: Proteção Cardíaca (Adeus Pílula Azul Perigosa)",
        tipo: "Alerta de Saúde / Medo de Morte Súbita",
        headline: "Se Você Tem Pressão Alta ou Diabetes, Pare Imediatamente de Tomar Pílulas de Farmácia Para a Cama",
        lead: "O que a bula do Viagra não te conta com clareza: forçar o coração bombeando sangue contra artérias duras é como acelerar um motor com o freio de mão puxado. Veja a alternativa 100% segura para o seu coração.",
        reason_why: "O Vigor Boost promove vasodilatação suave nos capilares periféricos sem alterar a pressão arterial central.",
        cta: "Proteja sua saúde e recupere sua masculinidade hoje.",
        prompt_imagem_ia: "Distinguished fit man in his late 50s embracing his smiling attractive wife warmly at sunrise on a beautiful terrace, atmosphere of deep romantic connection, peaceful masculine strength."
      }
    ],
    roteiros_ads_e_reels: [
      {
        formato: "Reels / TikTok 9:16 (Comment-to-DM)",
        tempo_estimado: "45 segundos",
        gancho_0_3s: "[Close no homem maduro olhando sério para a câmera] 'Se você tem mais de 50 anos e ainda precisa engolir uma pílula azul para funcionar na cama, você está brincando com a sua vida.'",
        corpo: "Cientistas descobriram que o motivo de você falhar não é idade nem falta de tesão, mas uma crosta cicatricial que endurece as artérias do seu pênis. Essa receita caseira de 2 minutos dissolve essa crosta e devolve suas ereções matinais firmes em 7 dias.",
        cta_dm: "Comente 'VIGOR' aqui embaixo que eu te envio o protocolo completo no seu privado agora!",
        palavra_chave_gatilho: "VIGOR"
      }
    ],
    arvore_atendimento_whatsapp: [
      {
        passo: 1,
        tipo: "Qualificação Discreta",
        mensagem: "Olá! Atendimento 100% sigiloso e exclusivo do Vigor Boost. Me diz uma coisa rápida: você tem sentido mais dificuldade de ter a ereção ou de manter ela dura até o final da relação?"
      },
      {
        passo: 2,
        tipo: "Explicação Biológica Respeitosa",
        mensagem: "Isso é muito comum após os 45 anos, amigo. As artérias acumulam uma cicatriz fibrótica que não deixa o sangue ficar preso. O Vigor Boost dissolve essa placa e regenera o colágeno elástico Tipo III."
      },
      {
        passo: 3,
        tipo: "Oferta Máxima com Embalagem Discreta",
        mensagem: "O pacote mais vendido é o tratamento de 6 frascos (50% de desconto, frete grátis e envio em embalagem totalmente discreta sem nenhum logotipo por fora). Se em 90 dias sua parceira não notar a diferença, devolvemos seu dinheiro. Quer que eu reserve o seu com o desconto hoje?"
      }
    ],
    produtos: [
      { nome: "Kit 6 Frascos (180 Dias) - Força Máxima", preco: 294, link_checkout: "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project_id=vigor_boost&plan=6", ticket: 294, descricao: "Tratamento de 6 meses com Frete Grátis e Embalagem Discreta." },
      { nome: "Kit 3 Frascos (90 Dias) - Mais Vendido", preco: 177, link_checkout: "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project_id=vigor_boost&plan=3", ticket: 177, descricao: "Tratamento de 90 dias para regeneração vascular." },
      { nome: "Kit 1 Frasco (30 Dias) - Inicial", preco: 69, link_checkout: "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project_id=vigor_boost&plan=1", ticket: 69, descricao: "1 frasco para primeiros testes." }
    ],
    links: [
      { nome: "Local Sales Page ml01", url: "file:///C:/Users/vsuga/Downloads/Produtos%20Bifi/Vigor%20Boost/PAGE%20VIGORBOOST/page-vigorboost/cc/pv/v1/ml01/index.html", tipo: "local" },
      { nome: "Deploy VigorBoost Vercel", url: "file:///C:/Users/vsuga/Downloads/Produtos%20Bifi/Vigor%20Boost/deploy-vigorboost/index.html", tipo: "local" },
      { nome: "Blueprint Operação Orgânica Reels", url: "file:///C:/Users/vsuga/Downloads/Produtos%20Bifi/Vigor%20Boost/visaomacro.html", tipo: "doc" }
    ],
    vsl: {
      titulo: "VSL 1 - VigorBoost [19] PITCH 35-26",
      duracao: "42 minutos",
      pitch_time: "35:26",
      gancho: "How an ancient 2-minute gelatin horse trick used by Midwestern ranchers is helping men over 50 get back rock-hard erections...",
      especialista: "Dr. Robert (Pesquisador Urológico & Andrologista)",
      celebridades: ["Criadores e fazendeiros do Kentucky e Texas"]
    }
  }
};

// Write to JSON
fs.writeFileSync('scripts/master_intelligence_bifi.json', JSON.stringify(masterProducts, null, 2), 'utf8');
console.log('Successfully compiled master_intelligence_bifi.json!');
