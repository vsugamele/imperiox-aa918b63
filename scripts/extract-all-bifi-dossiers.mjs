import fs from 'fs';
import path from 'path';

function stripTags(html) {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
             .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&apos;/g, "'")
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

const files = {
  cinna: 'C:\\Users\\vsuga\\Downloads\\Produtos Bifi\\Diabetes\\brief.html',
  horse: 'C:\\Users\\vsuga\\Downloads\\Produtos Bifi\\Horse\\brief.html',
  slim: 'C:\\Users\\vsuga\\Downloads\\Produtos Bifi\\Slim\\bief.html',
  memo: 'C:\\Users\\vsuga\\Downloads\\Produtos Bifi\\MEMO\\9c9dab71-246d-4cb7-bf04-62c446407fb7.html'
};

for (const [key, p] of Object.entries(files)) {
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, 'utf8');
    const text = stripTags(raw);
    console.log(`\n=== PRODUCT [${key}] === (Total text: ${text.length} chars)`);
    
    // Search for Primary Avatar
    const avIdx = text.indexOf('Avatar Primário');
    if (avIdx !== -1) {
      console.log('--- AVATAR PRIMARIO ---');
      console.log(text.slice(avIdx, avIdx + 400));
    }
    
    // Search for Big Idea
    const biIdx = text.indexOf('Big Idea');
    if (biIdx !== -1) {
      console.log('--- BIG IDEA ---');
      console.log(text.slice(biIdx, biIdx + 300));
    }

    // Search for Mecanismo
    const mecIdx = text.indexOf('Mecanismo da Solução');
    if (mecIdx !== -1) {
      console.log('--- MECANISMO ---');
      console.log(text.slice(mecIdx, mecIdx + 350));
    }
  }
}
