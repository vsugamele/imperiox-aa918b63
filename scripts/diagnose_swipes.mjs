import { execSync } from 'child_process';

function queryDb(sql) {
  const cmd = `npx supabase db query --linked "${sql.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
  const res = execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const start = res.indexOf('{');
  const end = res.lastIndexOf('}');
  if (start === -1 || end === -1) return [];
  return JSON.parse(res.slice(start, end + 1)).rows || [];
}

console.log("=== SWIPES SEM REVERSE ENGINEERING ===");
const semRE = queryDb(`
  SELECT id, title, criador, nicho, created_at 
  FROM imphq_swipes 
  WHERE reverse_engineering IS NULL OR reverse_engineering = '{}'::jsonb 
  LIMIT 35;
`);
console.log(`Total: ${semRE.length}`);
semRE.forEach(s => console.log(`- [${s.criador || 'Sem criador'}] ${s.title} (${s.nicho || 'Sem nicho'})`));

console.log("\n=== SWIPES COM NICHOS NULOS OU 'Sem nicho' ===");
const semNicho = queryDb(`
  SELECT id, title, criador, formato, tags 
  FROM imphq_swipes 
  WHERE nicho IS NULL OR nicho = ''
  LIMIT 20;
`);
console.log(`Total com nicho nulo/vazio: ${semNicho.length}`);
semNicho.forEach(s => console.log(`- [${s.criador || 'Sem criador'}] ${s.title} | Tags: ${s.tags?.join(', ')}`));
