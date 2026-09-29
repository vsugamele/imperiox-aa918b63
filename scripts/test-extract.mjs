import fs from 'fs';
import path from 'path';

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSectionText(html, startPattern, endPattern) {
  const start = html.search(startPattern);
  if (start === -1) return '';
  const sub = html.slice(start);
  const end = endPattern ? sub.search(endPattern) : -1;
  const raw = end !== -1 ? sub.slice(0, end) : sub.slice(0, 5000);
  return stripTags(raw);
}

const diabetesHtml = fs.readFileSync('C:\\Users\\vsuga\\Downloads\\Produtos Bifi\\Diabetes\\brief.html', 'utf8');

console.log("=== DIABETES / CINNA SHIELD SAMPLE ===");
console.log("Avatar Primário:", extractSectionText(diabetesHtml, /Avatar Primário/i, /Avatares Secundários/i).slice(0, 500));
console.log("\nBig Idea:", extractSectionText(diabetesHtml, /Big Idea/i, /One Belief/i).slice(0, 500));
console.log("\nCausa Raiz:", extractSectionText(diabetesHtml, /Causa Raiz/i, /Mecanismo do Problema/i).slice(0, 500));
console.log("\nMecanismo Solucao:", extractSectionText(diabetesHtml, /Mecanismo da Solução/i, /True Ceylon Cinnamon/i).slice(0, 500));
