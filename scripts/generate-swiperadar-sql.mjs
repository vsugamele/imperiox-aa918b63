import fs from 'fs';

const offers = JSON.parse(fs.readFileSync('C:/Users/vsuga/projects/imperiox/scripts/swiperadar_parsed.json', 'utf8'));

const USER_ID = 'bded734b-15c0-4db3-851b-5ad763ee33c8';

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJson(obj) {
  if (!obj) return 'NULL';
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

function escapeArray(arr) {
  if (!arr || !arr.length) return "'{}'::text[]";
  const items = arr.map(s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
  return "ARRAY[" + arr.map(s => escapeSql(s)).join(', ') + "]::text[]";
}

// Mecanismos e resumos detalhados por oferta
const MECHANISMS = {
  'SodaTide': {
    mecanismo: 'Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica',
    gancho: 'O "truque do bicarbonato de sódio" testado pelo Dr. Oz que ativa a perda acelerada de peso.',
    participacao: 'Público que já tentou dietas restritivas e esteve acima do peso sem conseguir manter o resultado.',
    narrativa: 'Página no estilo portal TODAY com reportagem investigativa. Dois funis simultâneos: Funil A rodando VSL com corte do Dr. Oz via cloaker TWR; Funil B com LP direta e VSL nativa.',
    reframe: 'A causa real do ganho de peso não é a falta de exercício, mas a acidez crônica do organismo que bloqueia as células adiposas. O bicarbonato alkaliza e desbloqueia.',
    oferta: 'Suplemento líquido / gotas aceleradoras baseadas no princípio do bicarbonato ativo com frete grátis e kits promocionais.'
  },
  'JellyPeak': {
    mecanismo: 'Chia Jelly Trick (Gelatina caseira de semente de chia para queima acelerada de gordura e firmeza da pele)',
    gancho: '“Try the Chia Jelly Trick, if you want to wave goodbye to your bat wings!”',
    participacao: 'Mulheres com mais de 50 anos incomodadas com flacidez nos braços ("asinhas de morcego") e barriga.',
    narrativa: 'Imagem estática de alto contraste → Pré-sell advertorial de depoimento emocional (“At 57, I wear smaller jeans…”) → Página da VSL formatada como post do Dr. Oz no Facebook com centenas de comentários sociais.',
    reframe: 'A flacidez e o acúmulo de gordura nessa idade decorrem da perda de viscosidade gástrica e colágeno enzimático. A gelatina de chia retarda a absorção de glicose e firma a derme.',
    oferta: 'Fórmula concentrada de sementes e botânicos em gotas com garantia de devolução.'
  },
  'NeuroMemory': {
    mecanismo: 'Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
    gancho: '"Alerta urgente de saúde neurológica: como manter a mente afiada aos 67 anos sem remédios tarja preta."',
    participacao: 'Adultos 60+ e filhos de idosos preocupados com lapsos frequentes de memória e risco de demência.',
    narrativa: 'VSL no formato do clássico telejornal investigativo americano 60 Minutes, embutida em página com contador dinâmico de visualizadores ("1.482 pessoas assistindo agora") e selo de Urgência Médica. Teste A/B com 7 versões de VSL (a VSL C lidera).',
    reframe: 'A perda de memória não é envelhecimento natural: é um bloqueio nas sinapses causado pela oxidação acelerada das bainhas neurais.',
    oferta: 'NeuroMemory suplemento nootrópico em cápsulas, kits de 3 e 6 potes com frete rápido.'
  },
  'Vapo Cept': {
    mecanismo: 'Inalação aromaterápica cognitiva via vapor ("Vapo Ritual") para desobstrução das vias olfativo-cerebrais',
    gancho: '"Por que inalar este vapor botânico por 15 segundos antes de dormir restaura a clareza mental?"',
    participacao: 'Homens e mulheres 55+ sentindo névoa mental matinal e esquecimento de nomes e compromissos.',
    narrativa: 'Página no estilo portal de notícias de saúde independente com player de VSL no estilo “60 Minutes” (botão chamativo “Play 60 Minutes”) seguido por seção densa de depoimentos com foto.',
    reframe: 'Os remédios para memória falham porque passam pelo fígado e estômago. O nervo olfativo é a única rota direta para o hipocampo sem barreira hematoencefálica.',
    oferta: 'Aparelho inalador + blend concentrado de óleos essenciais terapêuticos.'
  },
  'Golden Brain': {
    mecanismo: 'Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
    gancho: '“Top US Neurologist confirms: Alzheimer’s can be reversed in 45 days with this cinnamon and honey ritual”',
    participacao: 'Pessoas com histórico familiar de declínio cognitivo e sinais iniciais de esquecimento.',
    narrativa: 'Funil multi-etapa de alta conformidade: Pré-sell de qualificação com pergunta de retenção (“Este vídeo pode sair do ar a qualquer momento. Você concorda em assistir até o fim? Sim/Não”) → Redirecionamento para página CNN Health (Funil A) ou AP News (Funil C).',
    reframe: 'As placas de proteína beta-amiloide acumulam-se no cérebro por deficiência de antioxidantes lipofílicos específicos presentes apenas no mel bruto e na canela do Ceilão.',
    oferta: 'Composto solúvel Golden Brain Elixir com garantia blindada de reembolso.'
  },
  'MemoHoney': {
    mecanismo: 'Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
    gancho: '“Elon Musk revela o truque do mel com Vicks para perda de memória e demência”',
    participacao: 'Consumidores de notícias e entusiastas de biohacking e soluções alternativas fora da Big Pharma.',
    narrativa: 'Página layout CNN Health com matéria bombástica ligando celebridades e tecnologia a um remédio caseiro esquecido. Player direto com contador de urgência (“vídeo disponível apenas pelas próximas 3 horas”). Criativo de 131k views no Funil B.',
    reframe: 'A inflamação crônica cerebral desidrata os neurônios; o mentol abre os microvasos enquanto o mel carrega nutrientes reparadores para o córtex.',
    oferta: 'Extrato líquido MemoHoney concentrado para gotejamento diário.'
  },
  'Memo Matrix': {
    mecanismo: 'Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã',
    gancho: '"Dois itens inocentes que você come no café da manhã estão destruindo a sua memória sem você perceber."',
    participacao: 'Pessoas maduras que tomam café tradicional e sentem cansaço mental e esquecimento durante o dia.',
    narrativa: 'Página estilo CNN Health explorando a zona azul da Sardenha (onde centenários mantêm memória fotográfica). Três LPs e 3 VSLs distintas testadas na mesma campanha.',
    reframe: 'Alimentos industrializados oxidam o hipocampo, mas o néctar das abelhas da Sardenha contém compostos fenólicos raros que revertem os danos em 45 dias.',
    oferta: 'Suplemento em gotas Memo Matrix com desconto progressivo por quantidade.'
  },
  'Sugar Balance': {
    mecanismo: 'Pancreatic Sludge (Lodo Pancreático) / Fórmula rara com mel para dissolver acúmulo tóxico no pâncreas',
    gancho: '“Médicos achavam que o tipo 2 era permanente… até a descoberta do ‘Pancreatic Sludge’!”',
    participacao: 'Diabéticos tipo 2 e pré-diabéticos cansados de picadas diárias, metformina e restrições alimentares severas.',
    narrativa: 'Página com VSL direta revelando que o diabetes tipo 2 não é um problema hereditário, mas mecânico: o canal pancreático fica entupido com "lodo glicêmico". Criativos escalados com mais de 97k views no Meta Ads.',
    reframe: 'Quando você dissolve o lodo pancreático com nutrientes específicos, o pâncreas volta a secretar insulina natural em questão de semanas.',
    oferta: 'Sugar Balance frascos com fórmula líquida de absorção sublingual rápida.'
  },
  'GlycoZen': {
    mecanismo: 'Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada',
    gancho: '“Esse ritual matinal de 20 segundos elimina o parasita que destrói o pâncreas e reverte o tipo 2 em 21 dias?”',
    participacao: 'Homens e mulheres com glicemia acima de 140 que sentem cansaço crônico, visão turva e formigamento nos pés.',
    narrativa: 'Dois funis testados em grande escala: Funil A com assinatura de autoridade médica (Dr. Sanjay Gupta em estilo CNN Health); Funil B no estilo CBS News ligando o mecanismo a uma "bebida milenar mencionada na Bíblia".',
    reframe: 'A causa oculta do diabetes é um parasita microscópico que se aloja nos tecidos pancreáticos e consome a insulina antes de chegar ao sangue.',
    oferta: 'GlycoZen kits de 2, 3 e 6 potes com bônus digitais exclusivos de receitas anti-glicêmicas.'
  },
  'Olivaro': {
    mecanismo: 'Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)',
    gancho: '“Esta bebida mencionada 33 vezes na Bíblia reconstrói o pâncreas e reverte o diabetes tipo 2 em 21 dias”',
    participacao: 'Público americano 45+ conservador e religioso que valoriza soluções naturais com respaldo bíblico e histórico.',
    narrativa: 'Dois funis sofisticados: Funil A em portal jornalístico CBS News; Funil B com simulação hiper-realista de um post viral da CBS News no feed do Facebook com comentários engajados e prova social massiva.',
    reframe: 'O ácido oleico polifenólico em sua forma pura cria uma película protetora nas células beta pancreáticas, restabelecendo a sensibilidade à insulina.',
    oferta: 'Gotas de extrato botânico de oliva e ervas bíblicas purificadas.'
  },
  'GLPro': {
    mecanismo: 'Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
    gancho: '“Forget insulin and metformin — this simple trick is clinically proven to reverse type 2!”',
    participacao: 'Diabéticos insatisfeitos com os efeitos colaterais da metformina (náusea, diarreia) e custo da insulina.',
    narrativa: 'Sete criativos diferentes rodando com até 52k views. O médico apresenta na VSL um estudo clínico que comprova a ativação dos receptores GLUT-4 antes de dormir. Dois funis com 8 VSLs no total.',
    reframe: 'O corpo já sabe como queimar açúcar; os receptores celulares apenas adormecem por causa da toxicidade lipídica noturna. O ritual reativa esses receptores enquanto você dorme.',
    oferta: 'GLPro cápsulas noturnas com frete grátis e garantia incondicional de 90 dias.'
  },
  'GlycoBarrier': {
    mecanismo: 'Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
    gancho: '"Como criar uma barreira natural contra picos de glicose após as refeições sem abrir mão da comida."',
    participacao: 'Diabéticos que sofrem com compulsão por doces e carboidratos e sentem culpa após comer.',
    narrativa: 'Três funis completos rodando simultaneamente: Funil A na healthynewsletters.site com oferta direta abaixo da VSL (US$ 79 / 69 / 49 por pote, frete grátis, 180 dias de garantia); Funil B com post da CBS News no Facebook; Funil C alimentando 3 variações de VSL.',
    reframe: 'Em vez de tentar produzir mais insulina com remédios pesados, o segredo é neutralizar as enzimas amilase e glucosidase no intestino, impedindo o pico glicêmico na fonte.',
    oferta: 'GlycoBarrier kits de 2, 3 e 6 potes com US$ 79 / 69 / 49 por frasco e garantia estendida de 180 dias.'
  }
};

const sqlStatements = [];

sqlStatements.push(`-- Limpeza de swipes anteriores do SwipeRadar (idempotência)`);
sqlStatements.push(`DELETE FROM imphq_swipes WHERE tags @> ARRAY['swiperadar']::text[];`);
sqlStatements.push(`DELETE FROM imphq_referencias WHERE fonte = 'SwipeRadar';\n`);

let totalSwipes = 0;
let totalReferencias = 0;

for (const o of offers) {
  totalSwipes++;
  const m = MECHANISMS[o.title] || {
    mecanismo: 'Mecanismo inovador de alta escala no nicho de ' + o.nicho,
    gancho: o.title,
    participacao: 'Público comprador qualificado',
    narrativa: o.fullText.slice(0, 200),
    reframe: 'Nova oportunidade no mercado',
    oferta: 'Oferta direta com kits promocionais'
  };

  const allDriveUrls = [
    ...o.criativos.map(c => c.url),
    ...o.vsls.map(v => v.url),
    ...o.zips.map(z => z.url)
  ].filter(u => u && u.includes('drive.google.com'));

  const primaryVideoUrl = o.vsls[0]?.url || o.criativos[0]?.url || (o.paginas[0]?.url ?? null);

  // Montar dossiê em Markdown
  let markdown = `# 📁 Dossiê de Inteligência: ${o.title}\n\n`;
  markdown += `**Nicho:** ${o.nicho}\n`;
  markdown += `**Fonte:** [SwipeRadar Notion](${o.notionUrl})\n`;
  markdown += `**Mecanismo Único:** ${m.mecanismo}\n\n`;

  markdown += `## 💡 Resumo do Funil e Estratégia\n`;
  markdown += `${o.fullText.split('\\n\\n')[0] || o.fullText.slice(0, 350)}\n\n`;

  markdown += `## 🧬 Anatomia Persuasiva\n`;
  markdown += `- **Gancho Principal:** ${m.gancho}\n`;
  markdown += `- **Público & Dor:** ${m.participacao}\n`;
  markdown += `- **Linha Narrativa:** ${m.narrativa}\n`;
  markdown += `- **Virada de Crença / Mecanismo:** ${m.reframe}\n`;
  markdown += `- **Construção da Oferta:** ${m.oferta}\n\n`;

  markdown += `## 🎬 Criativos Escalados (${o.criativos.length} disponíveis)\n`;
  if (o.criativos.length > 0) {
    o.criativos.forEach((c, idx) => {
      markdown += `${idx + 1}. [${c.text || 'Abrir Criativo ' + (idx + 1)}](${c.url})\n`;
    });
  } else {
    markdown += `_Nenhum criativo em pasta externa catalogado no momento._\n`;
  }
  markdown += `\n`;

  markdown += `## 🌐 Páginas & Funis (${o.paginas.length} links)\n`;
  if (o.paginas.length > 0) {
    o.paginas.forEach((p, idx) => {
      markdown += `- [${p.text || 'Página ' + (idx + 1)}](${p.url})\n`;
    });
  }
  if (o.zips.length > 0) {
    markdown += `\n### 📦 Downloads de Código HTML (.zip)\n`;
    o.zips.forEach((z, idx) => {
      markdown += `- 📥 [${z.text || 'Baixar HTML (.zip)'}](${z.url})\n`;
    });
  }
  markdown += `\n`;

  markdown += `## 📽️ VSLs na Íntegra (${o.vsls.length} vídeos)\n`;
  if (o.vsls.length > 0) {
    o.vsls.forEach((v, idx) => {
      markdown += `- ▶️ [${v.text || 'Assistir VSL ' + (idx + 1)}](${v.url})\n`;
    });
  } else {
    markdown += `_VSLs inclusas diretamente na página de vendas._\n`;
  }
  markdown += `\n`;

  markdown += `## 🔍 Meta Ads Library (Concorrente ao Vivo)\n`;
  if (o.metaAds.length > 0) {
    o.metaAds.forEach((a, idx) => {
      markdown += `- 🔎 [${a.text || 'Ver anúncios ativos na Meta'}](${a.url})\n`;
    });
  }
  markdown += `\n`;

  markdown += `## 🎯 Como Modelar para o Império HQ\n`;
  if (o.nicho === 'Emagrecimento') {
    markdown += `Ideal para modelagem no **LinfaFlow** ou **SlimSoda**: utilize o ângulo da quebra de expectativa rápida (truque do ingrediente natural) e a validação social em páginas advertorial.\n`;
  } else if (o.nicho === 'Memória') {
    markdown += `Excelente para ofertas cognitivas como **MemoFlow**: aproveite a estrutura "60 Minutes" de jornalismo investigativo e o enquadramento de neuro-proteção com mel e canela.\n`;
  } else {
    markdown += `Perfeito para ofertas de metabolismo e glicemia como **CardioFlush / Cinna-Shield**: o mecanismo do lodo/parasita é altamente persuasivo e transfere a culpa da fraqueza para um agente invasor palpável.\n`;
  }

  const blocksObj = {
    gancho: m.gancho,
    participacao_ativa: m.participacao,
    narrativa: m.narrativa,
    reframe: m.reframe,
    cta_engajamento: `Criativos (${o.criativos.length}) e VSLs (${o.vsls.length}) disponíveis no Google Drive.`,
    cta_venda: `LPs ativas: ${o.paginas.map(p => p.url).slice(0, 2).join(' | ')}. Links Meta Ads Library ativos.`
  };

  const resultadoJson = {
    oferta: o.title,
    nicho: o.nicho,
    notion_url: o.notionUrl,
    mecanismo: m.mecanismo,
    total_criativos: o.criativos.length,
    total_vsls: o.vsls.length,
    total_lps: o.paginas.length,
    criativos: o.criativos,
    paginas: o.paginas,
    vsls: o.vsls,
    meta_ads: o.metaAds,
    zips: o.zips,
    prints: o.prints
  };

  const tags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/\s+/g, '-'), 'escalado', 'meta_ads'];

  // Inserir Swipe
  sqlStatements.push(`INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    ${escapeSql(USER_ID)},
    ${escapeSql(`[SwipeRadar] ${o.title} (${o.nicho})`)},
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    ${escapeSql(m.mecanismo)},
    ${escapeSql(o.nicho)},
    ${escapeArray(tags)},
    5,
    'ativo',
    ${escapeJson(blocksObj)},
    ${escapeSql(o.notionUrl)},
    ${escapeSql(primaryVideoUrl)},
    ${escapeArray(allDriveUrls)},
    ${escapeSql(markdown)},
    ${escapeJson(resultadoJson)},
    true
  );\n`);

  // Inserir itens em imphq_referencias
  const pasta = `SwipeRadar — ${o.nicho}`;
  const firstThumb = o.prints[0] || null;

  // 1. Criativos
  o.criativos.forEach((c, idx) => {
    totalReferencias++;
    const refTags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/\s+/g, '-'), 'criativo'];
    sqlStatements.push(`INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      ${escapeSql(`${o.title} — Criativo ${idx + 1} (${c.text || 'Drive'})`)},
      ${escapeSql(c.url)},
      ${escapeSql(firstThumb)},
      ${escapeArray(refTags)},
      ${escapeSql(`Criativo da oferta escalada ${o.title} (${o.nicho}). Mecanismo: ${m.mecanismo}`)},
      9,
      'Meta Ads',
      ${escapeSql(pasta)},
      ${escapeSql(o.title)},
      'SwipeRadar',
      'video'
    );`);
  });

  // 2. VSLs
  o.vsls.forEach((v, idx) => {
    totalReferencias++;
    const refTags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/\s+/g, '-'), 'vsl'];
    sqlStatements.push(`INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      ${escapeSql(`${o.title} — ${v.text.replace(/▶\s*/, '')}`)},
      ${escapeSql(v.url)},
      ${escapeSql(firstThumb)},
      ${escapeArray(refTags)},
      ${escapeSql(`VSL completa da oferta ${o.title} (${o.nicho}). Mecanismo: ${m.mecanismo}`)},
      10,
      'Drive / VSL',
      ${escapeSql(pasta)},
      ${escapeSql(o.title)},
      'SwipeRadar',
      'vsl'
    );`);
  });

  // 3. Landing Pages
  o.paginas.forEach((p, idx) => {
    totalReferencias++;
    const refTags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/\s+/g, '-'), 'landing_page'];
    const matchingZip = o.zips[idx]?.url ? ` | ZIP com HTML: ${o.zips[idx].url}` : '';
    sqlStatements.push(`INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      ${escapeSql(`${o.title} — LP ${p.text}`)},
      ${escapeSql(p.url)},
      ${escapeSql(o.prints[idx % o.prints.length] || firstThumb)},
      ${escapeArray(refTags)},
      ${escapeSql(`Landing page da oferta ${o.title} (${o.nicho}).${matchingZip}`)},
      9,
      'Web',
      ${escapeSql(pasta)},
      ${escapeSql(o.title)},
      'SwipeRadar',
      'lp'
    );`);
  });
}

const finalSql = sqlStatements.join('\n');
fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scripts/import_swiperadar.sql', finalSql, 'utf8');

console.log(`SQL gerado com sucesso!`);
console.log(`Total Swipes: ${totalSwipes}`);
console.log(`Total Referências: ${totalReferencias}`);
console.log(`Arquivo salvo em scripts/import_swiperadar.sql (${finalSql.length} bytes)`);
