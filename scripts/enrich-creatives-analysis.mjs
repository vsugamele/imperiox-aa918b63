import fs from 'fs';
import { execSync } from 'child_process';

const transcripts = JSON.parse(fs.readFileSync('C:/Users/vsuga/projects/imperiox/scratch/top5_transcripts.json', 'utf8'));

const CREATIVES_ANALYSIS = {
  // 1. MemoHoney Criativo 05
  '86fba351-96d4-4eb0-ab73-8d4bd2019a2f': {
    duracao: 153.5,
    transcricao: transcripts['memohoney_05'],
    analise: {
      anatomy: {
        blocks: [
          {
            start: 0,
            end: 24.0,
            kind: 'hook',
            label: 'Gancho de Provocação Religiosa + Choque Alimentar',
            purpose: 'Quebra imediata de padrão e polarização emocional extrema: conecta o hábito matinal de comer ovos à cura divina do Alzheimer e declara guerra aberta à indústria farmacêutica.'
          },
          {
            start: 24.0,
            end: 45.0,
            kind: 'problem_agitation',
            label: 'Mentira #1: A Causa Oculta Revelada por Harvard e Cambridge',
            purpose: 'Desqualifica velhice e genética como causas; introduz a toxina microscópica cerebral que bloqueia as sinapses, explicando por que exercícios mentais e palavras cruzadas são inúteis.'
          },
          {
            start: 45.0,
            end: 62.0,
            kind: 'problem_agitation',
            label: 'Mentira #2: Remédios de Farmácia Pioram as Placas',
            purpose: 'Destrói a autoridade dos tratamentos alopáticos clássicos (Aricept, Namenda), alegando que eles apenas mascaram sintomas e aceleram o acúmulo de placas tóxicas no cérebro.'
          },
          {
            start: 62.0,
            end: 95.0,
            kind: 'mechanism',
            label: 'Mentira #3 + Mecanismo de Stanford (3 Ingredientes de Despensa)',
            purpose: 'Instala a crença de reversibilidade total: estudo de Stanford com 86.000 voluntários (97% de remissão em <28 dias) usando um ritual matinal de 30s com ingredientes comuns de cozinha.'
          },
          {
            start: 95.0,
            end: 120.0,
            kind: 'proof',
            label: 'Benefício Emocional + Esvaziamento da Ala Neurológica',
            purpose: 'Pinta o alívio de lembrar o nome dos netos e acordar com lucidez plena, ancorado pelo relato do médico que afirma ter esvaziado a ala de neurologia do próprio hospital.'
          },
          {
            start: 120.0,
            end: 153.5,
            kind: 'cta',
            label: 'Ameaça de Censura Iminente da Big Pharma + CTA do Vídeo Oficial',
            purpose: 'Urgência máxima alegando ação judicial de advogados bilionários para derrubar a descoberta; orienta o clique no botão Saiba Mais para ver a apresentação do Dr. Dale Bredesen.'
          }
        ]
      },
      angle_family: 'Exposição das 3 Mentiras da Indústria Farmacêutica / Ritual Matinal de 30s dos 3 Ingredientes',
      caption: '131K views · Meta Ads Winner | MemoHoney Criativo 05',
      criador: 'MemoHoney',
      editorial: {
        format: 'Depoimento em Primeira Pessoa / Médico Dissidente Expondo a Indústria',
        primaryNiche: 'Saúde Cerebral / Memória / Alzheimer e Demência (Público 55+)',
        topic: 'Revelação de que o esquecimento não decorre da idade, mas de placas tóxicas removíveis em 28 dias com uma receita de 3 ingredientes caseiros.',
        transfer: 'Estrutura transferível de alta escala: Gancho de alimento comum ("Veja o que ovos fazem com...") + Alívio de culpa religioso/moral + Exposição em 3 mentiras canônicas (Causa real, Fracasso dos remédios, Falsa incurabilidade) + Âncora em Harvard/Stanford + Ritual de 30 segundos + Conspiração e censura iminente.'
      },
      replication_prompt: 'Crie um roteiro em vídeo de 2m30s para produto de saúde/memória (como MemoFlow). Abra no primeiro segundo com um choque alimentar em primeira pessoa ("Veja o que [alimento comum inocente] faz com seu cérebro...") proferido por um especialista que afirma estar cansado de ver famílias sofrendo. Desmonte em 3 tempos as 3 maiores mentiras que a indústria conta: 1) que o declínio é genético/idade (apresentando uma toxina/acúmulo que bloqueia a comunicação neural); 2) que remédios convencionais funcionam (mostrando que apenas mascaram e aumentam o problema); 3) que a condição é incurável. Apresente um estudo de universidade de ponta (Harvard/Stanford) que validou um ritual caseiro de 30 segundos com 3 ingredientes de despensa em dezenas de milhares de voluntários. Conecte com o benefício emocional mais doloroso (lembrar o nome dos netos e dos filhos). Feche com urgência conspiratória: advogados da indústria bilionária estão tentando derrubar o vídeo nas próximas horas, force o clique imediato no botão Saiba Mais.',
      transcript: [
        {
          start: 0,
          end: 153.48,
          text: transcripts['memohoney_05']
        }
      ]
    }
  },

  // 2. Sugar Balance Criativo 01
  'ff0a3e90-bd83-44e5-9b90-73864f0419dc': {
    duracao: 170.5,
    transcricao: transcripts['sugar_balance_01'],
    analise: {
      anatomy: {
        blocks: [
          {
            start: 0,
            end: 22.0,
            kind: 'hook',
            label: 'Gancho da Manteiga + Curiosidade Geográfica de Israel',
            purpose: 'Quebra de padrão nutricional imediata e curiosidade irresistível: o impacto da manteiga em diabéticos e a revelação do porquê o diabetes tipo 2 praticamente não existe em Israel.'
          },
          {
            start: 22.0,
            end: 60.0,
            kind: 'problem_agitation',
            label: 'Mentira #1: Carboidratos Inocentes vs Parasita Pancreático Oculto',
            purpose: 'Alivia 100% da culpa do paciente comendo doces ou massas, introduzindo um vilão visceral e assustador: um parasita no pâncreas que devora a insulina enquanto a pessoa dorme.'
          },
          {
            start: 60.0,
            end: 82.0,
            kind: 'problem_agitation',
            label: 'Mentira #2: Metformina é Perfume em Cima de Lixão',
            purpose: 'Metáfora demolidora contra medicamentos convencionais: remédios e dietas restritivas apenas disfarçam o odor superficial, mas o pâncreas continua sendo destruído por dentro.'
          },
          {
            start: 82.0,
            end: 120.0,
            kind: 'mechanism',
            label: 'Mentira #3 + Ritual do Azeite de Oliva de 3 Minutos',
            purpose: 'Afirmação de reversão total comprovada: uma colher de azeite de oliva com 3 ingredientes de despensa tomada em 3 minutos expulsa o parasita e normaliza o A1C.'
          },
          {
            start: 120.0,
            end: 145.0,
            kind: 'proof',
            label: 'Resultados Laboratoriais de Atleta + Proteção Permanente',
            purpose: 'Promessa de A1C em níveis de atletas jovens em idosos de até 80 anos, com blindagem perpétua contra picos de glicemia mesmo voltando a comer pizzas, bolos e massas.'
          },
          {
            start: 145.0,
            end: 170.5,
            kind: 'cta',
            label: 'Janela Estrita de 2 Horas contra Censura + Clique Imediato',
            purpose: 'Contagem regressiva psicológica de 120 minutos para remoção compulsória do vídeo por pressão da indústria farmacêutica, exigindo clique urgente no link abaixo.'
          }
        ]
      },
      angle_family: 'Segredo de Israel / Parasita no Pâncreas / Ritual do Azeite de Oliva em 3 Minutos',
      caption: '97K views · Meta Ads Winner | Sugar Balance Criativo 01',
      criador: 'Sugar Balance',
      editorial: {
        format: 'Alerta Médico Investigativo / Desmascaramento da Dieta Restritiva',
        primaryNiche: 'Diabetes Tipo 2 / Controle de Glicemia / Resistência à Insulina (Público 50+)',
        topic: 'A verdadeira raiz do diabetes tipo 2 não é o açúcar, mas um parasita no pâncreas combatido pelo segredo israelense do azeite de oliva com 3 ingredientes de despensa.',
        transfer: 'Padrão vencedor idêntico ao nicho de memória, adaptado para diabetes: Gancho de comida controversa (Manteiga) + Âncora de segredo geográfico (Israel) + 3 Mentiras canônicas + Inimigo invisível bizarro (parasita comendo insulina) + Ritual de despensa de 3 minutos + Urgência de 2 horas.'
      },
      replication_prompt: 'Crie um roteiro de anúncio de 2m50s para o nicho de diabetes e controle glicêmico (como Cinna-Shield ou CardioFlush). Abra com um gancho provocador sobre um alimento comum ("Veja o que [manteiga / banha / pão] realmente faz no corpo de quem tem diabetes... É por isso que em [Israel / Grécia] diabetes quase não existe"). Desmonte as 3 grandes mentiras do setor: 1) que carboidratos são os culpados (revele o verdadeiro causador biológico invisível — acúmulo gorduroso/parasitário que bloqueia a produção de insulina à noite); 2) que remédios como metformina resolvem ("é como jogar perfume num lixão"); 3) que a condição não tem cura. Apresente um ritual de 3 minutos usando 1 colher de azeite de oliva e 3 ingredientes comuns de despensa que devolvem o A1C a níveis de atleta. Feche avisando que o vídeo de emergência só ficará disponível pelas próximas 2 horas devido a ameaças de censura jurídica, ordenando o clique imediato no botão.',
      transcript: [
        {
          start: 0,
          end: 170.53,
          text: transcripts['sugar_balance_01']
        }
      ]
    }
  },

  // 3. GLPro Criativo 03
  '41d40d94-7b26-4119-82dd-a7d5a748913d': {
    duracao: 160.8,
    transcricao: transcripts['glpro_03'],
    analise: {
      anatomy: {
        blocks: [
          {
            start: 0,
            end: 22.0,
            kind: 'hook',
            label: 'Gancho da Confissão Constrangida do Especialista',
            purpose: 'Vulnerabilidade calculada e urgência pessoal: "Meu Deus, não acredito que estou gravando isso...", gerando cumplicidade e quebra imediata de suspeita de anúncio comercial.'
          },
          {
            start: 22.0,
            end: 58.0,
            kind: 'mechanism',
            label: 'O Estudo Oculto de Harvard: Canela + Segundo Ingrediente',
            purpose: 'Desfaz o mito comum de polvilhar canela na comida; revela que a canela precisa de um segundo elemento ativador de despensa para simular os efeitos da insulina e da metformina sem picadas.'
          },
          {
            start: 58.0,
            end: 105.0,
            kind: 'proof',
            label: 'Estudo de Caso Específico: Paciente A1C 10.4 para 6.2 em 12 Dias',
            purpose: 'Prova numérica forense: paciente com 4 remédios e insulina reduziu a hemoglobina glicada de 10.4 para 6.2 e acordou com glicemia 98 mg/dL após o ritual noturno de 30 segundos.'
          },
          {
            start: 105.0,
            end: 132.0,
            kind: 'problem_agitation',
            label: 'Liberdade Gastronômica sem Culpa (Pizza Toda Semana)',
            purpose: 'Pinta o contraste do retorno à vida normal: poder comer pizza semanalmente sem picos no aparelho, sem treinos exaustivos e sem os efeitos colaterais intestinais dos remédios.'
          },
          {
            start: 132.0,
            end: 160.8,
            kind: 'cta',
            label: 'Censura das 48 Horas da Indústria Farmacêutica + Botão Saiba Mais',
            purpose: 'Aviso de que o vídeo anterior foi banido em 48 horas pela indústria, exigindo ação rápida no botão Saiba Mais enquanto ainda estiver no ar.'
          }
        ]
      },
      angle_family: 'Estudo Oculto de Harvard / O Ritual Noturno da Canela com o Segundo Ingrediente',
      caption: '52K views · Meta Ads Winner | GLPro Criativo 03',
      criador: 'GLPro',
      editorial: {
        format: 'Confissão Médica em Close / Relato de Caso Clínico com Resultados Laboratoriais',
        primaryNiche: 'Diabetes Tipo 2 / Desmame de Injeções e Metformina',
        topic: 'A combinação sinérgica de canela com um segundo ingrediente de cozinha tomada antes de dormir atua nos mesmos receptores da metformina, derrubando o A1C em menos de duas semanas.',
        transfer: 'Abertura confessional irresistível ("Não acredito que estou dizendo isso...") + Correção da sabedoria popular (canela sozinha é inútil) + O segundo ingrediente sinérgico + Prova clínica com números cirúrgicos (A1C 10.4 ➔ 6.2 em 12 dias) + Garantia de liberdade alimentar (comer pizza) + Janela de 48 horas.'
      },
      replication_prompt: 'Escreva um roteiro confessional em vídeo de 2m40s para um suplemento ou protocolo glicêmico (ex.: Cinna-Shield). Abra com o especialista visivelmente dividido entre o sigilo profissional e a ética humana ("Meu Deus, não acredito que estou vindo a público falar isso... mas 90% das pessoas com diabetes estão errando feio"). Revele um estudo pouco divulgado de Harvard que explica por que a canela pura não resolve nada sozinha, mas quando combinada a um segundo ingrediente de cozinha tomado à noite, destrava a absorção celular de glicose de forma análoga à insulina. Conte a história de uma paciente real que tomava 4 medicações com A1C de 10.4 e em 12 dias de ritual noturno baixou para 6.2, acordando com 98 estável e voltando a comer pizza com os netos. Conclua alertando que o vídeo já foi banido uma vez em menos de 48 horas e que esta pode ser a última chance de assistir clicando em Saiba Mais.',
      transcript: [
        {
          start: 0,
          end: 160.77,
          text: transcripts['glpro_03']
        }
      ]
    }
  },

  // 4. Golden Brain Criativo 02
  '34d79bcb-51ee-4158-841e-5ea73b6c4c11': {
    duracao: 187.8,
    transcricao: transcripts['golden_brain_02'],
    analise: {
      anatomy: {
        blocks: [
          {
            start: 0,
            end: 25.0,
            kind: 'hook',
            label: 'Arrependimento Pessoal + Proibição Drástica no Café da Manhã',
            purpose: 'Abertura de choque: confissão de ter perdido 2 anos inteiros antes do remédio, seguida da ordem urgente de parar imediatamente de comer ovos ou beber água gelada pela manhã.'
          },
          {
            start: 25.0,
            end: 58.0,
            kind: 'problem_agitation',
            label: 'Estatística dos 78% dos 60+ e a Toxina Cerebral Silenciosa',
            purpose: 'Normaliza a dor e eleva a urgência: 78% dos idosos já sofrem perdas de memória e menos de 3% sabem que a causa não é velhice, mas uma toxina silenciosa que destrói neurônios.'
          },
          {
            start: 58.0,
            end: 105.0,
            kind: 'mechanism',
            label: 'A Fragilidade da Toxina + O Truque do Mel de 13 Segundos (< $2)',
            purpose: 'Esperança imediata: a toxina é extremamente frágil e um ritual de mel de 13 segundos que custa menos de 2 dólares a expulsa do cérebro em 3 minutos cravados.'
          },
          {
            start: 105.0,
            end: 145.0,
            kind: 'proof',
            label: 'Adeus ao Aricept e Consultas de Neurologistas Caras',
            purpose: 'Alívio financeiro e autonomia: eliminação do medo de esquecer nomes de entes queridos e descarte de medicações sintéticas de alto custo.'
          },
          {
            start: 145.0,
            end: 187.8,
            kind: 'cta',
            label: 'Prova Social dos 21 Milhões de Views + Botão Saiba Mais',
            purpose: 'Validação social gigantesca (21 milhões de pessoas já assistiram) com apelo ao dever familiar de proteger a memória antes da remoção por ordem de neurologistas.'
          }
        ]
      },
      angle_family: 'O Truque do Mel Noturno / Pare Imediatamente de Comer Ovos e Água Fria no Café da Manhã',
      caption: '17K views (21M na VSL) · Meta Ads Winner | Golden Brain Criativo 02',
      criador: 'Golden Brain',
      editorial: {
        format: 'Alerta Direto à Câmera / Proibição de Alimento Cotidiano Matinal',
        primaryNiche: 'Saúde Cerebral / Prevenção de Demência e Alzheimer (Idosos 60+)',
        topic: 'A toxina cerebral invisível que se aproveita de ovos e água gelada pela manhã é neutralizada por uma receita caseira de mel de 13 segundos tomada à noite.',
        transfer: 'Apelo emocional de remorso ("Perdi 2 anos inteiros...") + Ordem negativa imediata ("Pare de comer X no café...") + Custo ínfimo (< R$ 10 / 13 segundos) + Âncora de viralidade (21 milhões de views) + CTA de preservação da dignidade familiar.'
      },
      replication_prompt: 'Escreva um roteiro direto de 3 minutos para saúde cognitiva (MemoFlow). Comece com tom de advertência séria ("Eu perdi dois anos inteiros da minha vida até descobrir isso... Se você tem mais de 55 anos e já sente lapsos de memória, pare imediatamente de comer ovos ou beber água gelada no café da manhã"). Explique que 78% dos adultos acima dos 60 sofrem com esquecimentos constantes causados não pela idade, mas por uma toxina cerebral que se alimenta desses hábitos matinais. Revele que essa toxina é surpreendentemente frágil e que uma receita noturna com mel e outro ingrediente caseiro, custando menos de R$ 5 e levando 13 segundos para preparar, expulsa essa toxina em 3 minutos. Prometa clareza mental nas primeiras horas e reversão do declínio em 3 semanas sem Aricept nem visitas intermináveis a neurologistas. Finalize citando que mais de 20 milhões de famílias já assistiram à apresentação e oriente o clique imediato no botão Saiba Mais.',
      transcript: [
        {
          start: 0,
          end: 187.80,
          text: transcripts['golden_brain_02']
        }
      ]
    }
  },

  // 5. SodaTide Criativo 01
  'ac99ca2d-e45b-4011-98df-ce20c76d694a': {
    duracao: 108.7,
    transcricao: transcripts['sodatide_01'],
    analise: {
      anatomy: {
        blocks: [
          {
            start: 0,
            end: 20.0,
            kind: 'hook',
            label: 'Desafio ao Cético Acadêmico + Exposição Corporal Pós-Parto',
            purpose: 'Afronta direta aos defensores de estudos de laboratório mostrando o corpo sarado real após parto cesárea e normal em roupas curtas, quebrando qualquer argumento teórico.'
          },
          {
            start: 20.0,
            end: 45.0,
            kind: 'problem_agitation',
            label: 'A Solução dos Pobres Mortais vs Ozempic/Mounjaro ($1.200/mês)',
            purpose: 'Contraste financeiro visceral e identificação de classe: posiciona o ritual do bicarbonato como a salvação para quem não tem R$ 1.200 todo mês para injetar canetas emagrecedoras.'
          },
          {
            start: 45.0,
            end: 75.0,
            kind: 'mechanism',
            label: 'O Ritual da Água Morna com Bicarbonato e Limão em Jejum',
            purpose: 'Instrução do ritual de 15 segundos: água morna com limão e bicarbonato na proporção precisa, consumida rigorosamente em jejum antes de qualquer água fria para desinchar a barriga em 7 dias.'
          },
          {
            start: 75.0,
            end: 90.0,
            kind: 'proof',
            label: 'Prova Social Matrimonial: Ciúmes e Desejo do Marido',
            purpose: 'Gatilho de atratividade e rejuvenescimento conjugal: brinca que precisa conter o marido que já quer ter mais um filho de tão atraente e sequinha que a cintura ficou.'
          },
          {
            start: 90.0,
            end: 108.7,
            kind: 'cta',
            label: 'CTA Descontraído para o Passo a Passo da Proporção Exata',
            purpose: 'Chamada leve e amigável direcionando ao vídeo que demonstra a receita exata e as proporções dos ingredientes.'
          }
        ]
      },
      angle_family: 'A Alternativa dos Pobres Mortais ao Ozempic ($1.200) / Ritual do Bicarbonato e Limão em Jejum',
      caption: '7K views (escalando) · Meta Ads Winner | SodaTide Criativo 01',
      criador: 'SodaTide',
      editorial: {
        format: 'Vlog Casual em Casa / Mostrando Barriga Real Sem Filtro (UGC Radical)',
        primaryNiche: 'Emagrecimento Feminino / Desinchaço Abdominal Rápido / Pós-Parto e Menopausa',
        topic: 'Desinchar e chapar a cintura em uma semana sem gastar fortunas em Ozempic através da proporção certa de bicarbonato e limão com água morna em jejum.',
        transfer: 'Antagonismo a estudos científicos frios mostrando resultados reais no espelho + Polarização de classe social ("Para nós que não temos R$ 1.200 de Ozempic...") + Ritual de despensa de 15 segundos + Validação conjugal bem-humorada + CTA leve.'
      },
      replication_prompt: 'Crie um roteiro em vídeo vertical estilo UGC de 1m45s para LinfaFlow ou SlimSoda. Uma mulher comum na cozinha levanta a blusa e mostra a barriga sequinha, debochando dos médicos teóricos ("Ah, mas não tem estudo clínico provando o truque da água morna com gotas desinchantes? Amiga, olha pra minha barriga depois de ter filho!"). Polarize violentamente contra medicamentos caros ("Isso não é lipo e não é pra milionária que tem R$ 1.200 todo mês pra injetar caneta na barriga; isso é pra nós, pobres mortais"). Explique o ritual matinal de 15 segundos em jejum antes de beber água fria, prometendo que a cintura desincha em 7 dias. Adicione uma pitada de humor sobre a atenção e ciúmes do parceiro em casa. Finalize chamando para ver a receita exata clicando no link abaixo.',
      transcript: [
        {
          start: 0,
          end: 108.67,
          text: transcripts['sodatide_01']
        }
      ]
    }
  }
};

const sqls = [];

for (const [id, data] of Object.entries(CREATIVES_ANALYSIS)) {
  const escapedTranscricao = "'" + data.transcricao.replace(/'/g, "''") + "'";
  const escapedAnalise = "'" + JSON.stringify(data.analise).replace(/'/g, "''") + "'::jsonb";
  const duracao = data.duracao;

  sqls.push(`UPDATE imphq_referencias
SET transcricao = ${escapedTranscricao},
    analise = ${escapedAnalise},
    duracao = ${duracao},
    transcribe_status = 'transcribed',
    transcribe_provider = 'google/gemini-2.5-flash',
    transcribed_at = NOW(),
    updated_at = NOW()
WHERE id = '${id}';`);
}

const finalSql = sqls.join('\n\n');
fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scripts/update_creatives_analysis.sql', finalSql, 'utf8');
console.log('Script update_creatives_analysis.sql gerado com sucesso!');
