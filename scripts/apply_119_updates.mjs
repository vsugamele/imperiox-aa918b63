import { execSync } from 'child_process';
import fs from 'fs';

const updates = JSON.parse(fs.readFileSync('scratch/updates_119_transcripts.json', 'utf8'));
console.log(`Aplicando update para ${updates.length} itens...`);

// Para ser eficiente e seguro contra caracteres especiais no SQL:
// Dividimos em batches de 25
const BATCH_SIZE = 25;
for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  const batch = updates.slice(i, i + BATCH_SIZE);
  console.log(`Executando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(updates.length / BATCH_SIZE)}...`);

  const statements = batch.map(u => {
    const cleanText = u.transcricao.replace(/'/g, "''");
    const durVal = (u.duracao && !isNaN(u.duracao)) ? u.duracao : 'NULL';
    return `UPDATE imphq_referencias SET transcricao = '${cleanText}', duracao = COALESCE(duracao, ${durVal}), transcribe_status = 'done', transcribed_at = COALESCE(transcribed_at, now()) WHERE id = '${u.id}';`;
  }).join('\n');

  const sqlFile = `scratch/batch_119_${i}.sql`;
  fs.writeFileSync(sqlFile, statements);
  execSync(`npx supabase db query --linked -f ${sqlFile}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  fs.unlinkSync(sqlFile);
}

console.log("✅ 119 referências atualizadas com sucesso!");
