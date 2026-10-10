import { execSync } from 'child_process';
import fs from 'fs';

console.log("=== APLICANDO UPDATES DAS 37 VSLS / CRIATIVOS NO BANCO ===");

const updates = JSON.parse(fs.readFileSync('scratch/updates_37_vsls.json', 'utf8'));

const BATCH_SIZE = 10;
for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  const batch = updates.slice(i, i + BATCH_SIZE);
  console.log(`Executando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(updates.length / BATCH_SIZE)}...`);

  const statements = batch.map(u => {
    const cleanText = (u.transcricao || '').replace(/'/g, "''");
    const analiseJson = JSON.stringify(u.analise || {}).replace(/'/g, "''");
    const durVal = (u.duracao && !isNaN(u.duracao)) ? u.duracao : 1200.0;
    return `UPDATE imphq_referencias 
      SET 
        transcricao = '${cleanText}', 
        analise = '${analiseJson}'::jsonb,
        duracao = COALESCE(duracao, ${durVal}), 
        transcribe_status = 'done', 
        transcribed_at = COALESCE(transcribed_at, now()) 
      WHERE id = '${u.id}';`;
  }).join('\n');

  const sqlFile = `scratch/batch_37_${i}.sql`;
  fs.writeFileSync(sqlFile, statements);
  execSync(`npx supabase db query --linked -f ${sqlFile}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  fs.unlinkSync(sqlFile);
}

console.log("✅ Todas as 37 referências foram atualizadas com sucesso!");
