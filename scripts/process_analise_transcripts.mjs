import { execSync } from 'child_process';
import fs from 'fs';

console.log("=== PROCESSANDO 119 ITENS COM TRANSCRIPT NO ANALISE ===");

const query = `
SELECT 
  id, 
  titulo,
  duracao,
  analise->'transcript' as transcript,
  analise->'transcricao' as transcricao_obj
FROM imphq_referencias
WHERE transcribe_status = 'idle' 
  AND (analise->'transcript' IS NOT NULL OR analise->'transcricao' IS NOT NULL);
`;

const res = execSync(`npx supabase db query --linked "${query.replace(/\n/g, ' ')}"`, {
  encoding: 'utf8',
  maxBuffer: 30 * 1024 * 1024
});

const s = res.indexOf('{');
const e = res.lastIndexOf('}');
const rows = JSON.parse(res.slice(s, e + 1)).rows || [];
console.log(`Carregados ${rows.length} registros com transcript no analise.`);

const updates = [];
for (const r of rows) {
  let fullText = "";
  let duration = r.duracao ? parseFloat(r.duracao) : 0;

  if (Array.isArray(r.transcript) && r.transcript.length > 0) {
    fullText = r.transcript.map(t => (t.text || "").trim()).filter(Boolean).join(" ");
    if (!duration) {
      const last = r.transcript[r.transcript.length - 1];
      if (last && typeof last.end === 'number') {
        duration = Math.round(last.end * 10) / 10;
      }
    }
  } else if (typeof r.transcricao_obj === 'string') {
    fullText = r.transcricao_obj;
  } else if (r.transcript && typeof r.transcript === 'object') {
    fullText = JSON.stringify(r.transcript);
  }

  if (fullText.length > 0) {
    updates.push({
      id: r.id,
      transcricao: fullText,
      duracao: duration,
      transcribe_status: 'done'
    });
  }
}

console.log(`Total elegíveis para update imediato: ${updates.length}`);
fs.writeFileSync('scratch/updates_119_transcripts.json', JSON.stringify(updates, null, 2));
console.log("Salvo em scratch/updates_119_transcripts.json");
