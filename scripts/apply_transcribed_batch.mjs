import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CACHE_DIR = 'C:/Users/vsuga/projects/imperiox/scratch/creatives_cache';
const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));

console.log(`Carregando ${files.length} análises em cache para sincronização no Supabase...`);

const sqls = [];
for (const file of files) {
  const filePath = path.join(CACHE_DIR, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cId = data.id || file.replace('.json', '');
    const trans = (data.transcricao || '').replace(/'/g, "''");
    const analise = JSON.stringify(data.analise || {}).replace(/'/g, "''");
    const dur = Number(data.duracao || 0);

    sqls.push(`UPDATE imphq_referencias
SET transcricao = '${trans}',
    analise = '${analise}'::jsonb,
    duracao = ${dur},
    transcribe_status = 'done',
    transcribe_provider = 'google/gemini-2.5-flash',
    transcribed_at = NOW(),
    updated_at = NOW()
WHERE id = '${cId}';`);
  } catch (err) {
    console.error(`Erro ao ler ${file}:`, err);
  }
}

if (sqls.length > 0) {
  const finalSql = sqls.join('\n\n');
  fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scripts/sync_cache_to_db.sql', finalSql, 'utf8');
  console.log(`Gerado sync_cache_to_db.sql com ${sqls.length} atualizações.`);
  try {
    const out = execSync(`npx supabase db query --linked -f C:/Users/vsuga/projects/imperiox/scripts/sync_cache_to_db.sql`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    console.log(`✅ Sincronizados ${sqls.length} criativos com sucesso no Supabase!`);
  } catch (e) {
    console.error("Erro ao rodar SQL:", e.stdout || e.message);
  }
} else {
  console.log("Nenhum arquivo pronto para sincronizar.");
}
