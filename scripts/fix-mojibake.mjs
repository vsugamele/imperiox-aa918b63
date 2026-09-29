import fs from 'fs';

const filePath = 'src/data/skillsData.ts';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  [/ðŸ•µï¸ /g, '🕵️'],
  [/âš—ï¸ /g, '✨'],
  [/ðŸª¤/g, '🪤'],
  [/ðŸ“„/g, '📄'],
  [/âš”ï¸ /g, '⚔️'],
  [/ðŸ” /g, '🔍'],
  [/ðŸŽ­/g, '🎭'],
  [/âœ ï¸ /g, '✍️'],
  [/ðŸ§ /g, '🧠'],
  [/ðŸŽ¯/g, '🎯']
];

for (const [pat, rep] of replacements) {
  content = content.replace(pat, rep);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed remaining icons!');
