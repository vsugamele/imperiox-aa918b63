import { execSync } from 'child_process';
import fs from 'fs';

const items = JSON.parse(fs.readFileSync('scratch/idle_tem_analise.json', 'utf8'));
const sampleIds = items.slice(0, 3).map(i => `'${i.id}'`).join(',');

const query = `
SELECT id, titulo, analise->'transcript' as transcript, analise->'transcricao' as transcricao
FROM imphq_referencias
WHERE id IN (${sampleIds});
`;

const res = execSync(`npx supabase db query --linked "${query.replace(/\n/g, ' ')}"`, {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

const s = res.indexOf('{');
const e = res.lastIndexOf('}');
const rows = JSON.parse(res.slice(s, e + 1)).rows || [];
console.log(JSON.stringify(rows, null, 2));
