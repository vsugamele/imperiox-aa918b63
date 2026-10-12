import { execSync } from 'child_process';
import fs from 'fs';

console.log("=== SINCRONIZANDO SITES / LPS QUE NÃO VIRARAM REFERÊNCIAS ===");

const query = `
SELECT 
  s.id, 
  s.user_id,
  s.titulo, 
  s.url, 
  s.tipo, 
  s.thumbnail_url, 
  s.summary, 
  s.tags, 
  s.created_at,
  sw.project_id
FROM imphq_sites s
LEFT JOIN imphq_swipes sw ON s.url = sw.source_url
LEFT JOIN imphq_referencias r ON s.url = r.url
WHERE r.id IS NULL AND s.url IS NOT NULL;
`;

const res = execSync(`npx supabase db query --linked "${query.replace(/\n/g, ' ')}"`, {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

const start = res.indexOf('{');
const end = res.lastIndexOf('}');
const missing = JSON.parse(res.slice(start, end + 1)).rows || [];

console.log(`Encontrados ${missing.length} sites que ainda NÃO viraram referências.`);

if (missing.length === 0) {
  console.log("Nenhum site pendente.");
  process.exit(0);
}

const statements = missing.map(s => {
  const cleanTitle = (s.titulo || s.url || 'Landing Page').replace(/'/g, "''").slice(0, 150);
  const cleanUrl = s.url.replace(/'/g, "''");
  const cleanImage = s.thumbnail_url ? `'${s.thumbnail_url.replace(/'/g, "''")}'` : 'NULL';
  const cleanNotas = s.summary ? `'${s.summary.replace(/'/g, "''").slice(0, 500)}'` : 'NULL';
  const projVal = s.project_id ? `'${s.project_id}'` : 'NULL';
  const tagList = Array.isArray(s.tags) && s.tags.length ? s.tags.map(t => `'${t}'`).join(',') : "'site','ingest','landing_page'";

  return `INSERT INTO imphq_referencias (
    id,
    project_id,
    tipo,
    titulo,
    url,
    image_url,
    tags,
    notas,
    plataforma,
    pasta,
    fonte,
    transcribe_status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    ${projVal},
    'landing_page',
    '${cleanTitle}',
    '${cleanUrl}',
    ${cleanImage},
    ARRAY[${tagList}],
    ${cleanNotas},
    'Web',
    'Landing Pages / Sites',
    'ingest',
    'done',
    '${s.created_at || new Date().toISOString()}'
  );`;
});

const sqlFile = 'scratch/sync_sites_to_refs.sql';
fs.writeFileSync(sqlFile, statements.join('\n'));
console.log(`Gravando ${statements.length} referências no banco...`);
execSync(`npx supabase db query --linked -f ${sqlFile}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
fs.unlinkSync(sqlFile);

console.log(`✅ ${missing.length} sites sincronizados com sucesso em imphq_referencias!`);
