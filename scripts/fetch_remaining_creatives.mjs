import { execSync } from 'child_process';
import fs from 'fs';

const sql = "SELECT id, titulo, produto, pasta, url FROM imphq_referencias WHERE pasta LIKE 'SwipeRadar%' AND tipo = 'criativo' AND (transcribe_status IS NULL OR transcribe_status != 'done') ORDER BY pasta, produto, titulo;";
const out = execSync(`npx supabase db query --linked "${sql}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

const jsonStart = out.indexOf('{');
const jsonEnd = out.lastIndexOf('}');
if (jsonStart !== -1 && jsonEnd !== -1) {
  const parsed = JSON.parse(out.slice(jsonStart, jsonEnd + 1));
  fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scratch/remaining_33_creatives.json', JSON.stringify(parsed.rows, null, 2));
  console.log(`Saved ${parsed.rows.length} creatives to scratch/remaining_33_creatives.json`);
} else {
  console.error('Failed to parse output:', out);
}
