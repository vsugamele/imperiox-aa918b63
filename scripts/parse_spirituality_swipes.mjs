import fs from 'fs';
import path from 'path';

const steps = [
  { step: 2832, notionUrl: 'https://swiperadar.notion.site/The-King-s-Code-2-0-3f60ddb389138127a252d80d781687bb', nicho: 'Prosperidade' },
  { step: 2840, notionUrl: 'https://swiperadar.notion.site/The-Sacred-Prayer-3f60ddb38913815f803fcc398df10075', nicho: 'Espiritualidade' },
  { step: 2846, notionUrl: 'https://swiperadar.notion.site/Divine-Script-discount-3f60ddb38913811b85bcff32ea709ba8', nicho: 'Espiritualidade' },
  { step: 2852, notionUrl: 'https://swiperadar.notion.site/Frequency-of-Angels-3f60ddb3891381c2a9ffe557e4832b1e', nicho: 'Espiritualidade' },
  { step: 2858, notionUrl: 'https://swiperadar.notion.site/Seed-of-Faith-3f60ddb3891381009810ce898392480a', nicho: 'Espiritualidade' },
  { step: 2864, notionUrl: 'https://swiperadar.notion.site/Manuscript-of-Miracles-3f60ddb3891381aeaa14e437d3ac730d', nicho: 'Espiritualidade' }
];

const basePath = 'C:/Users/vsuga/.gemini/antigravity/brain/fb21137e-e8e8-4622-8ba3-6e324270c5ec/.system_generated/steps';

const parsedOffers = [];

for (const item of steps) {
  const filePath = path.join(basePath, String(item.step), 'output.txt');
  if (!fs.existsSync(filePath)) {
    console.error(`Missing file: ${filePath}`);
    continue;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const jsonMatch = raw.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  if (!jsonMatch) {
    console.error(`No JSON match in step ${item.step}`);
    continue;
  }
  const data = JSON.parse(jsonMatch[1]);
  
  // Categorizar links
  const criativos = [];
  const transcricoesCriativos = [];
  const paginas = [];
  const checkouts = [];
  const vsls = [];
  const transcricoesVsl = [];
  const metaAds = [];
  const zips = [];
  const outros = [];

  for (const l of data.links || []) {
    const txt = (l.text || '').trim();
    const href = (l.href || '').trim();
    const ptxt = (l.parentText || '').trim();

    if (!href || href.startsWith('https://swiperadar.notion.site') || href.includes('#main')) continue;

    if (href.includes('facebook.com/ads/library')) {
      metaAds.push({ text: txt || ptxt || 'Biblioteca de Anúncios', url: href });
    } else if (href.includes('checkout-ds24.com') || href.includes('checkout') || href.includes('buygoods') || href.includes('clickbank') || href.includes('digistore24')) {
      checkouts.push({ text: txt || ptxt || 'Checkout', url: href });
    } else if (href.includes('drive.google.com')) {
      if (txt.includes('zip') || txt.includes('.zip') || ptxt.includes('.zip') || txt.includes('HTML') || ptxt.includes('HTML')) {
        zips.push({ text: txt || 'HTML (.zip)', url: href, parent: ptxt });
      } else if (txt.includes('Transcrição da VSL') || ptxt.includes('Transcrição da VSL') || txt.includes('Transcrição VSL')) {
        transcricoesVsl.push({ text: ptxt || txt || 'Transcrição VSL', url: href });
      } else if (txt.includes('Transcrição') || ptxt.includes('Transcrição')) {
        transcricoesCriativos.push({ text: ptxt || txt || 'Transcrição Criativo', url: href });
      } else if (txt.includes('Assistir VSL') || ptxt.includes('Assistir VSL') || txt.includes('VSL') || ptxt.includes('VSL')) {
        vsls.push({ text: ptxt || txt || 'VSL', url: href });
      } else {
        criativos.push({ text: ptxt || txt || 'Criativo', url: href });
      }
    } else if (href.startsWith('http')) {
      // Normalizar / remover duplicatas de www / non-www
      const exists = paginas.some(p => p.url === href || p.url === href + '/' || p.url + '/' === href);
      if (!exists) {
        paginas.push({ text: txt || ptxt || 'Landing Page', url: href, parent: ptxt });
      }
    } else {
      outros.push({ text: txt, url: href });
    }
  }

  // Filtrar imagens reais (não SVG ou placeholders)
  const prints = (data.images || []).filter(img => 
    img && !img.includes('.svg') && !img.startsWith('data:image/gif') && !img.includes('dummyimage')
  );

  parsedOffers.push({
    title: data.title,
    nicho: item.nicho,
    notionUrl: item.notionUrl,
    fullText: data.text,
    criativos,
    transcricoesCriativos,
    paginas,
    checkouts,
    vsls,
    transcricoesVsl,
    metaAds,
    zips,
    prints
  });
}

console.log(`Sucesso! Processadas ${parsedOffers.length} ofertas.`);
for (const o of parsedOffers) {
  console.log(`\n========================================`);
  console.log(`[${o.nicho}] ${o.title}`);
  console.log(`Criativos (${o.criativos.length}):`, o.criativos.map(c => c.url));
  console.log(`Transcricoes Criativos (${o.transcricoesCriativos.length}):`, o.transcricoesCriativos.map(c => c.url));
  console.log(`VSLs (${o.vsls.length}):`, o.vsls.map(c => c.url));
  console.log(`Transcricoes VSL (${o.transcricoesVsl.length}):`, o.transcricoesVsl.map(c => c.url));
  console.log(`Paginas (${o.paginas.length}):`, o.paginas.map(c => c.url));
  console.log(`Checkouts (${o.checkouts.length}):`, o.checkouts.map(c => c.url));
  console.log(`Meta Ads (${o.metaAds.length}):`, o.metaAds.map(c => c.url));
  console.log(`HTML Zips (${o.zips.length}):`, o.zips.map(c => c.url));
  console.log(`Prints (${o.prints.length}):`, o.prints);
}

fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scripts/swiperadar_spirituality_parsed.json', JSON.stringify(parsedOffers, null, 2), 'utf8');
console.log('\nSalvo em scripts/swiperadar_spirituality_parsed.json');
