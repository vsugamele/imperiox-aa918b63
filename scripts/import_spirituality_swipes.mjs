import fs from 'fs';
import { execSync } from 'child_process';

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
  return "ARRAY[" + arr.map(s => escapeSql(s)).join(', ') + "]::text[]";
}

// Carregar links detalhados
const stepsInfo = [
  { step: 2832, id: 'the-kings-code', title: "The King's Code 2.0", nicho: 'Prosperidade' },
  { step: 2840, id: 'the-sacred-prayer', title: 'The Sacred Prayer', nicho: 'Espiritualidade' },
  { step: 2846, id: 'divine-script', title: 'Divine Script (discount)', nicho: 'Espiritualidade' },
  { step: 2852, id: 'frequency-of-angels', title: 'Frequency of Angels', nicho: 'Espiritualidade' },
  { step: 2858, id: 'seed-of-faith', title: 'Seed of Faith', nicho: 'Espiritualidade' },
  { step: 2864, id: 'manuscript-of-miracles', title: 'Manuscript of Miracles', nicho: 'Espiritualidade' }
];

const basePath = 'C:/Users/vsuga/.gemini/antigravity/brain/fb21137e-e8e8-4622-8ba3-6e324270c5ec/.system_generated/steps';

const parsedOffers = [];

for (const s of stepsInfo) {
  const p = `${basePath}/${s.step}/output.txt`;
  const raw = fs.readFileSync(p, 'utf8');
  const m = raw.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  const data = JSON.parse(m[1]);

  const links = data.links.filter(l => l.href && !l.href.includes('swiperadar.notion.site'));
  const prints = (data.images || []).filter(img => img && img.includes('attachment') && !img.includes('.svg'));

  parsedOffers.push({
    ...s,
    desc: data.desc || '',
    text: data.text,
    links,
    prints
  });
}

// Metadados analíticos e de engenharia reversa por oferta
const MECHANISMS = {
  'the-kings-code': {
    mecanismo: "Michael Jackson's 60-Sec Manifestation Method / Frequência alfa-teta revelada por neurocientista de celebridades",
    gancho: 'O método de manifestação de 60 segundos que Michael Jackson utilizava nos bastidores para criar uma fortuna inabalável — revelado por seu neurocientista pessoal.',
    participacao: 'Público que busca lei da atração, manifestação financeira e abundância rápida sem passar horas meditando ou estudando.',
    narrativa: 'VSL minimalista direto na página com botão chamativo "Click to listen". Revela que a riqueza não vem do esforço braçal, mas da sincronização neuroacústica em ondas alfa e teta em 60 segundos antes de dormir.',
    reframe: 'A pobreza e o endividamento são causados por frequências cerebrais dissonantes; ao calibrar o cérebro com o código dos reis, o dinheiro é atraído naturalmente.',
    oferta: "The King's Code 2.0 protocolo sonoro binaural + guia de reprogramação subconsciente rápida via Digistore24 ($39).",
    modelagem: 'Excelente para adaptar no nicho de infoprodutos e PLR espiritual brasileiro (Kiwify/Hotmart). Ângulo de celebridade mundial confere autoridade instantânea e curiosidade irresistível no Meta Ads.'
  },
  'the-sacred-prayer': {
    mecanismo: 'A Oração Sagrada de 7 Frases do Rei Salomão / Decodificação do texto litúrgico hebraico',
    gancho: 'A oração secreta de 30 segundos que o Rei Salomão sussurrava todas as noites e acumulou mais ouro que qualquer império na Terra.',
    participacao: 'Cristãos, católicos e evangélicos que oram todos os dias mas continuam vivendo com o dinheiro contado e pedem socorro a Deus.',
    narrativa: 'Dois funis escalados simultâneos: Funil A com ambientação bíblica devocional com versículos e selos de fé; Funil B utilizando o formato de falsa live da "Vatican News" no YouTube revelando uma escavação secreta em Jerusalém.',
    reframe: 'Deus quer que você seja próspero, mas suas orações têm sido bloqueadas porque você está usando a estrutura grega errada de súplica em vez do código de bênção salomônico.',
    oferta: 'The Sacred Prayer manuscrito completo + áudio guiado de salmos salomônicos via Digistore24 e KashPay.',
    modelagem: 'Perfeito para rodar no Brasil com voz de pastor ou historiador bíblico. O ângulo de quebra de crença ("por que Deus não respondeu até agora") remove a culpa do avatar.'
  },
  'divine-script': {
    mecanismo: 'The 12-Word Divine Script / Comando verbal bíblico de alinhamento com a Providência Divina',
    gancho: 'Jesus ordena que você aceite este milagre financeiro hoje: o roteiro sagrado de 12 palavras que destrava abundância 100x mais rápido.',
    participacao: 'Pessoas com dívidas pesadas e sentimento de estagnação que precisam de permissão teológica para receber dinheiro sem culpa.',
    narrativa: 'Funil de alta qualificação com pré-sell interativo das "20 sacred words" para aquecer o tráfego frio → VSL dinâmica de 12 palavras com provas bíblicas e testemunhos gravados.',
    reframe: 'Pedir dinheiro não é pecado; os patriarcas da Bíblia eram os homens mais ricos de sua época porque sabiam invocar o roteiro divino exato.',
    oferta: 'Divine Script livro digital + meditação guiada de 7 minutos + bônus de livramento de juros via Digistore24.',
    modelagem: 'O formato de pré-sell com perguntas bíblicas eleva o CTR da página em até 40% e filtra o público qualificado antes do checkout.'
  },
  'frequency-of-angels': {
    mecanismo: 'Frequência Harmônica Arcangélica 777Hz / Ressonância dos 7 Arcanjos para purificação do campo de escassez',
    gancho: 'A frequência sonora angélica guardada a sete chaves nos arquivos secretos do Vaticano que sintoniza milagres financeiros imediatos.',
    participacao: 'Público espiritualista, devotos de anjos e arcanjos, praticantes de lei da atração sonora e meditação.',
    narrativa: 'Página no domínio institucional "thevaticannews.online" com atmosfera sacra, reportagem de áudio e player de alta retenção com testemunhos de milagres recebidos em 48 horas.',
    reframe: 'A escassez é uma baixa vibração energética que repele bênçãos; ao tocar a frequência pura dos arcanjos, o bloqueio espiritual se dissolve.',
    oferta: 'Frequency of Angels suíte sonora com frequências de São Miguel e Gabriel + guia de conexão angelical via VendePay.',
    modelagem: 'Ótimo modelo para monetizar com low-ticket (R$ 37 a R$ 67) com upsell de oração personalizada por inteligência artificial.'
  },
  'seed-of-faith': {
    mecanismo: 'O Princípio da Semente de Mostarda / Funil de Quiz Rápido com Apresentação de 2 Minutos (Maior Escala: +2,6M views)',
    gancho: 'Faça o teste bíblico de 60 segundos e descubra qual semente de fé está faltando em sua vida para Deus multiplicar sua provisão.',
    participacao: 'Público massivo no Meta Ads (mais de 2,6 milhões de visualizações nos criativos), homens e mulheres 40+ religiosos e conectados ao celular.',
    narrativa: 'Rompe completamente o padrão da VSL longa de 40 minutos! Leva o usuário para um Quiz dinâmico de 4 perguntas no site planfaith.com, seguido de uma apresentação ultra-direta de 2 minutos que vai direto ao ponto e entrega a oferta.',
    reframe: 'Você não precisa de horas de oração vazia; Jesus disse que uma fé do tamanho de um grão de mostarda move montanhas quando ativada no momento certo.',
    oferta: 'Plano Seed of Faith protocolo diário de 21 dias + diário de sementes e colheita via KashPay.',
    modelagem: 'MODELO DE OURO DO NICHO. Criativos no Reels/Shorts com milhões de views e funil de Quiz eliminam a fadiga de VSLs longas e geram volume colossal de vendas no Perpétuo.'
  },
  'manuscript-of-miracles': {
    mecanismo: 'Manuscrito Aramaico do Mar Morto / As 3 Invocações de Melquisedeque para Prosperidade Material',
    gancho: 'O manuscrito de 2.000 anos encontrado em uma caverna em Qumran que revela o segredo dos milagres financeiros esquecido pelas igrejas modernas.',
    participacao: 'Curiosos por arqueologia bíblica, cristãos tradicionais e pessoas que querem um método ancorado em história e manuscritos antigos.',
    narrativa: 'Oferta nova escalando velozmente (anúncio recente com mais de 37k views em poucos dias). VSL investigativa com imagens históricas de pergaminhos e documentos autenticados.',
    reframe: 'A versão moderna das escrituras omitiu as instruções práticas de prosperidade que os antigos profetas utilizavam para erguer cidades e rebanhos.',
    oferta: 'Manuscript of Miracles edição digital comentada com pronúncia original em aramaico via KashPay.',
    modelagem: 'Excelente gancho histórico/arqueológico para tráfego frio. Atrai o homem maduro e cético que não cai em "simpatias" mas acredita em pergaminhos históricos.'
  }
};

const sqlStatements = [];
let totalSwipes = 0;
let totalReferencias = 0;

for (const o of parsedOffers) {
  const m = MECHANISMS[o.id];
  totalSwipes++;

  const driveUrls = o.links.filter(l => l.href.includes('drive.google.com')).map(l => l.href);
  const webUrls = o.links.filter(l => !l.href.includes('drive.google.com') && !l.href.includes('facebook.com'));
  const metaAds = o.links.filter(l => l.href.includes('facebook.com/ads/library'));
  const primaryVideoUrl = driveUrls.find(u => u.includes('view')) || webUrls[0]?.href || null;

  // Montar Markdown analítico detalhado
  let markdown = `# ${o.title} (${o.nicho})\n\n`;
  markdown += `> **Nicho:** ${o.nicho} | **Fonte:** SwipeRadar | **Status:** Escalado no Meta Ads\n\n`;
  markdown += `### 💡 Mecanismo Persuasivo\n${m.mecanismo}\n\n`;
  markdown += `### 🎯 Gancho Central (Hook)\n"${m.gancho}"\n\n`;
  markdown += `### 👤 Avatar & Participação Ativa\n${m.participacao}\n\n`;
  markdown += `### 📖 Narrativa & Estrutura de Funil\n${m.narrativa}\n\n`;
  markdown += `### 🔄 Quebra de Crença & Reframe\n${m.reframe}\n\n`;
  markdown += `### 💰 Oferta & Monetização\n${m.oferta}\n\n`;
  markdown += `### 🚀 Como Modelar para o Império HQ\n${m.modelagem}\n\n`;

  markdown += `## 🎬 Criativos & Vídeos de Anúncio\n`;
  o.links.filter(l => l.text.includes('criativo') || l.text.includes('post') || l.parentText.includes('Criativo')).forEach((c, idx) => {
    markdown += `- 📲 [${c.text || 'Criativo ' + (idx + 1)}](${c.href}) — _${c.parentText.replace(/\n/g, ' ')}_\n`;
  });
  markdown += `\n`;

  markdown += `## 🌐 Páginas & Funis\n`;
  webUrls.forEach((w, idx) => {
    markdown += `- 🔗 [${w.text || 'Link ' + (idx + 1)}](${w.href}) — _${w.parentText.replace(/\n/g, ' ')}_\n`;
  });
  markdown += `\n`;

  markdown += `## 📽️ VSLs & Apresentações\n`;
  o.links.filter(l => l.text.includes('VSL') || l.text.includes('apresentação') || l.parentText.includes('VSL')).forEach((v, idx) => {
    markdown += `- ▶️ [${v.text || 'VSL ' + (idx + 1)}](${v.href})\n`;
  });
  markdown += `\n`;

  markdown += `## 🔍 Meta Ads Library (Concorrente ao Vivo)\n`;
  metaAds.forEach(a => {
    markdown += `- 🔎 [${a.text || 'Ver anúncios ativos na Meta Ads Library'}](${a.href})\n`;
  });
  markdown += `\n`;

  const blocksObj = {
    gancho: m.gancho,
    participacao_ativa: m.participacao,
    narrativa: m.narrativa,
    reframe: m.reframe,
    cta_engajamento: `Anúncios ativos no Meta Ads. Materiais e vídeos disponíveis no Drive.`,
    cta_venda: m.oferta
  };

  const resultadoJson = {
    oferta: o.title,
    nicho: o.nicho,
    mecanismo: m.mecanismo,
    links: o.links,
    prints: o.prints
  };

  const tags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''), 'escalado', 'meta_ads'];

  // Inserir Swipe em imphq_swipes
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
    ${escapeArray(driveUrls)},
    ${escapeSql(markdown)},
    ${escapeJson(resultadoJson)},
    true
  );`);

  // Inserir itens individuais na pasta de Referências
  const pasta = `SwipeRadar — ${o.nicho}`;
  const firstThumb = o.prints[0] || null;

  // Criativos e vídeos
  const criativosLinks = o.links.filter(l => l.text.includes('criativo') || l.text.includes('post') || (l.parentText && l.parentText.includes('Criativo') && !l.text.includes('Transcrição')));
  criativosLinks.forEach((c, idx) => {
    totalReferencias++;
    const refTags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/[^a-z0-9]/g, ''), 'criativo', 'anuncio'];
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
      transcribe_status
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      ${escapeSql(`${o.title} — Criativo ${idx + 1}`)},
      ${escapeSql(c.href)},
      ${escapeSql(firstThumb)},
      ${escapeArray(refTags)},
      ${escapeSql(`Criativo escalado da oferta ${o.title} (${o.nicho}). Gancho: ${m.gancho}`)},
      9,
      'Meta Ads',
      ${escapeSql(pasta)},
      ${escapeSql(o.title)},
      'SwipeRadar',
      'done'
    );`);
  });

  // VSLs
  const vslLinks = o.links.filter(l => l.text.includes('VSL') || l.text.includes('apresentação') || (l.parentText && l.parentText.includes('VSL') && !l.text.includes('Transcrição')));
  vslLinks.forEach((v, idx) => {
    totalReferencias++;
    const refTags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/[^a-z0-9]/g, ''), 'vsl', 'pitch'];
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
      transcribe_status
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      ${escapeSql(`${o.title} — VSL / Apresentação ${idx + 1}`)},
      ${escapeSql(v.href)},
      ${escapeSql(firstThumb)},
      ${escapeArray(refTags)},
      ${escapeSql(`VSL da oferta ${o.title} (${o.nicho}). Mecanismo: ${m.mecanismo}`)},
      10,
      'Web / VSL',
      ${escapeSql(pasta)},
      ${escapeSql(o.title)},
      'SwipeRadar',
      'done'
    );`);
  });

  // Landing pages
  const lpLinks = o.links.filter(l => l.href.startsWith('http') && !l.href.includes('drive.google.com') && !l.href.includes('facebook.com') && !l.href.includes('checkout') && !l.href.includes('vendepay'));
  lpLinks.forEach((p, idx) => {
    totalReferencias++;
    const refTags = ['swiperadar', o.nicho.toLowerCase(), o.title.toLowerCase().replace(/[^a-z0-9]/g, ''), 'landing_page', 'funil'];
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
      transcribe_status
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      ${escapeSql(`${o.title} — Página ${idx + 1}`)},
      ${escapeSql(p.href)},
      ${escapeSql(firstThumb)},
      ${escapeArray(refTags)},
      ${escapeSql(`Página de vendas / Quiz / Pré-sell da oferta ${o.title}. Mecanismo: ${m.mecanismo}`)},
      9,
      'Web',
      ${escapeSql(pasta)},
      ${escapeSql(o.title)},
      'SwipeRadar',
      'done'
    );`);
  });
}

console.log(`Gerando SQL para ${totalSwipes} swipes e ${totalReferencias} referências...`);
const sqlPath = 'C:/Users/vsuga/projects/imperiox/scripts/import_spirituality_swipes.sql';
fs.writeFileSync(sqlPath, sqlStatements.join('\n\n'), 'utf8');
console.log(`Arquivo SQL salvo em ${sqlPath}`);

console.log('Executando migração no Supabase...');
try {
  const out = execSync(`npx supabase db query --linked -f ${sqlPath}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  console.log('Resultado do banco:');
  console.log(out.slice(0, 500));
  console.log(`\n🎉 SUCESSO! Inseridos ${totalSwipes} Swipes e ${totalReferencias} Referências no Império HQ!`);
} catch (e) {
  console.error('Erro na execução do SQL:', e.message);
  if (e.stdout) console.error('STDOUT:', e.stdout);
  if (e.stderr) console.error('STDERR:', e.stderr);
}
