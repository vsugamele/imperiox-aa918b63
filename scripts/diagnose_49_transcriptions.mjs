import { execSync } from 'child_process';

const q = `SELECT id, titulo, tipo, plataforma, pasta, url FROM imphq_referencias WHERE tipo IN ('video', 'criativo') AND (transcricao IS NULL OR length(trim(transcricao)) = 0);`;
const res = execSync(`npx supabase db query --linked "${q.replace(/\n/g, ' ')}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const start = res.indexOf('{');
const end = res.lastIndexOf('}');
const rows = JSON.parse(res.slice(start, end + 1)).rows || [];

console.log(`Total de vídeos/criativos sem transcrição: ${rows.length}`);
const byPasta = {};
rows.forEach(r => { byPasta[r.pasta || 'Sem pasta'] = (byPasta[r.pasta || 'Sem pasta'] || 0) + 1; });
console.log("Distribuição por pasta:", byPasta);

console.log("\nTodos os 49 itens:");
rows.forEach((r, i) => {
  console.log(`${i + 1}. [${r.pasta}] ${r.titulo} -> ${r.url}`);
});
