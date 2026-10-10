import fs from 'fs';
import path from 'path';

const steps = [
  { step: 1565, notionUrl: 'https://swiperadar.notion.site/SodaTide-3f10ddb38913811cb797d1022539a030', nicho: 'Emagrecimento' },
  { step: 1571, notionUrl: 'https://swiperadar.notion.site/JellyPeak-3f10ddb3891381a889d0cde1764bc315', nicho: 'Emagrecimento' },
  { step: 1579, notionUrl: 'https://swiperadar.notion.site/NeuroMemory-3f20ddb38913812ca787c05eada9fffe', nicho: 'Memória' },
  { step: 1585, notionUrl: 'https://swiperadar.notion.site/Vapo-Cept-3f20ddb3891381589880d6156db2ebeb', nicho: 'Memória' },
  { step: 1591, notionUrl: 'https://swiperadar.notion.site/Golden-Brain-3f20ddb3891381b4afd0cfbbe6041d0d', nicho: 'Memória' },
  { step: 1597, notionUrl: 'https://swiperadar.notion.site/MemoHoney-3f10ddb389138109bc0cd0f7af437c43', nicho: 'Memória' },
  { step: 1603, notionUrl: 'https://swiperadar.notion.site/Memo-Matrix-3f10ddb389138182ac18f5ace4a7bb52', nicho: 'Memória' },
  { step: 1609, notionUrl: 'https://swiperadar.notion.site/Sugar-Balance-3f20ddb38913818e9f7ef7e88a7fc40c', nicho: 'Diabetes' },
  { step: 1615, notionUrl: 'https://swiperadar.notion.site/GlycoZen-3f20ddb3891381bda9d9e27661306080', nicho: 'Diabetes' },
  { step: 1621, notionUrl: 'https://swiperadar.notion.site/Olivaro-3f20ddb38913811db2edcaf0c5be0990', nicho: 'Diabetes' },
  { step: 1627, notionUrl: 'https://swiperadar.notion.site/GLPro-3f20ddb3891381bb9917d542e02ffcfa', nicho: 'Diabetes' },
  { step: 1655, notionUrl: 'https://swiperadar.notion.site/GlycoBarrier-3f20ddb389138109b37aeb1095c735bf', nicho: 'Diabetes' }
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
  const paginas = [];
  const vsls = [];
  const metaAds = [];
  const zips = [];
  const outros = [];

  for (const l of data.links || []) {
    const txt = l.text || '';
    const href = l.href || '';
    const ptxt = l.parentText || '';

    if (!href || href.startsWith('https://swiperadar.notion.site') || href.includes('#main')) continue;

    if (href.includes('facebook.com/ads/library')) {
      metaAds.push({ text: txt || ptxt || 'Biblioteca de Anúncios', url: href });
    } else if (href.includes('drive.google.com')) {
      if (txt.includes('zip') || txt.includes('.zip') || ptxt.includes('.zip') || txt.includes('HTML') || ptxt.includes('HTML')) {
        zips.push({ text: txt || 'HTML (.zip)', url: href, parent: ptxt });
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
    paginas,
    vsls,
    metaAds,
    zips,
    prints
  });
}

console.log(`Sucesso! Processadas ${parsedOffers.length} ofertas.`);
for (const o of parsedOffers) {
  console.log(`- [${o.nicho}] ${o.title}: ${o.criativos.length} criativos, ${o.vsls.length} VSLs, ${o.paginas.length} LPs, ${o.metaAds.length} Ads Lib, ${o.prints.length} prints`);
}

fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scripts/swiperadar_parsed.json', JSON.stringify(parsedOffers, null, 2), 'utf8');
console.log('Salvo em scripts/swiperadar_parsed.json');
