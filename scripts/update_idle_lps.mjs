import { execSync } from 'child_process';
import fs from 'fs';

console.log("=== ATUALIZANDO STATUS DAS 53 LANDING PAGES ===");

const lps = JSON.parse(fs.readFileSync('scratch/idle_lps.json', 'utf8'));
const ids = lps.map(l => `'${l.id}'`).join(',');

const sql = `
UPDATE imphq_referencias
SET 
  transcribe_status = 'done',
  transcribed_at = COALESCE(transcribed_at, now()),
  transcricao = COALESCE(transcricao, 'Página de Vendas / Advertorial Web (Formato Landing Page — leitura de layout e copy web)'),
  duracao = COALESCE(duracao, 0.0)
WHERE id IN (${ids});
`;

fs.writeFileSync('scratch/update_53_lps.sql', sql);
execSync(`npx supabase db query --linked -f scratch/update_53_lps.sql`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
fs.unlinkSync('scratch/update_53_lps.sql');

console.log(`✅ 53 landing pages atualizadas com status 'done'!`);
