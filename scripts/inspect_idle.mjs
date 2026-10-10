import { execSync } from 'child_process';
import fs from 'fs';

const query = `
SELECT 
  id, 
  tipo, 
  titulo, 
  url, 
  (transcricao IS NOT NULL AND length(transcricao) > 0) as tem_transcricao,
  (analise->'transcript' IS NOT NULL) as tem_analise_transcript,
  (analise->'transcricao' IS NOT NULL) as tem_analise_transcricao
FROM imphq_referencias 
WHERE transcribe_status = 'idle';
`;

const res = execSync(`npx supabase db query --linked "${query.replace(/\n/g, ' ')}"`, {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

const s = res.indexOf('{');
const e = res.lastIndexOf('}');
const rows = JSON.parse(res.slice(s, e + 1)).rows || [];

const lp = rows.filter(r => r.tipo === 'landing_page');
const temAnaliseTrans = rows.filter(r => (r.tem_analise_transcript || r.tem_analise_transcricao));
const precisaProcessar = rows.filter(r => r.tipo !== 'landing_page' && !r.tem_analise_transcript && !r.tem_analise_transcricao);

console.log({
  totalIdle: rows.length,
  temAnaliseTrans: temAnaliseTrans.length,
  landingPages: lp.length,
  precisaProcessarAudioVideo: precisaProcessar.length
});

fs.writeFileSync('scratch/idle_tem_analise.json', JSON.stringify(temAnaliseTrans, null, 2));
fs.writeFileSync('scratch/idle_lps.json', JSON.stringify(lp, null, 2));
fs.writeFileSync('scratch/idle_precisa_processar.json', JSON.stringify(precisaProcessar, null, 2));
console.log('Arquivos salvos em scratch/');
