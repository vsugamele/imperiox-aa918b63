import { execSync } from 'child_process';

function queryDb(sql) {
  const cmd = `npx supabase db query --linked "${sql.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
  const res = execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const start = res.indexOf('{');
  const end = res.lastIndexOf('}');
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(res.slice(start, end + 1)).rows || [];
  } catch (e) {
    return [];
  }
}

console.log("==================================================");
console.log("=== AUDITORIA GERAL DO IMPÉRIO HQ ===");
console.log("==================================================");

// 1. imphq_referencias
console.log("\n[1] AUDITANDO TABELA imphq_referencias...");
const refTotals = queryDb(`SELECT count(*) as total FROM imphq_referencias;`)[0]?.total || 0;
console.log(`Total de referências: ${refTotals}`);

const refStatuses = queryDb(`SELECT transcribe_status, count(*) as count FROM imphq_referencias GROUP BY transcribe_status;`);
console.log("Status de transcrição:", refStatuses);

const refTipos = queryDb(`SELECT tipo, count(*) as count FROM imphq_referencias GROUP BY tipo;`);
console.log("Tipos de referências:", refTipos);

const refSemTrans = queryDb(`SELECT count(*) as count FROM imphq_referencias WHERE tipo IN ('video', 'criativo') AND (transcricao IS NULL OR length(trim(transcricao)) = 0);`)[0]?.count || 0;
console.log(`Vídeos/Criativos sem transcrição: ${refSemTrans}`);

const refSemAnalise = queryDb(`SELECT count(*) as count FROM imphq_referencias WHERE analise IS NULL;`)[0]?.count || 0;
console.log(`Referências sem análise/dissecagem (analise IS NULL): ${refSemAnalise}`);

const refSemImagem = queryDb(`SELECT count(*) as count FROM imphq_referencias WHERE tipo = 'landing_page' AND image_url IS NULL;`)[0]?.count || 0;
console.log(`Landing pages sem image_url / thumbnail: ${refSemImagem}`);

// 2. imphq_swipes
console.log("\n[2] AUDITANDO TABELA imphq_swipes...");
const swipeTotals = queryDb(`SELECT count(*) as total FROM imphq_swipes;`)[0]?.total || 0;
console.log(`Total de swipes: ${swipeTotals}`);

const swipeSemRE = queryDb(`SELECT count(*) as count FROM imphq_swipes WHERE reverse_engineering IS NULL OR reverse_engineering = '{}'::jsonb;`)[0]?.count || 0;
console.log(`Swipes sem Engenharia Reversa: ${swipeSemRE}`);

const swipeNichos = queryDb(`SELECT coalesce(nicho, 'Sem nicho') as nicho, count(*) as count FROM imphq_swipes GROUP BY nicho;`);
console.log("Swipes por nicho:", swipeNichos);

// 3. imphq_sites
console.log("\n[3] AUDITANDO TABELA imphq_sites...");
const siteTotals = queryDb(`SELECT count(*) as total FROM imphq_sites;`)[0]?.total || 0;
console.log(`Total de sites salvos: ${siteTotals}`);

const sitesSemThumb = queryDb(`SELECT count(*) as count FROM imphq_sites WHERE thumbnail_url IS NULL;`)[0]?.count || 0;
console.log(`Sites sem thumbnail: ${sitesSemThumb}`);

const sitesNaoRef = queryDb(`
  SELECT count(*) as count 
  FROM imphq_sites s 
  LEFT JOIN imphq_referencias r ON s.url = r.url 
  WHERE r.id IS NULL AND s.url IS NOT NULL;
`)[0]?.count || 0;
console.log(`Sites que NÃO foram espelhados em referências: ${sitesNaoRef}`);

// 4. Detalhes de referências sem transcrição
if (refSemTrans > 0) {
  console.log("\nAmostra de referências sem transcrição:");
  const amostra = queryDb(`
    SELECT id, titulo, tipo, plataforma, pasta, url 
    FROM imphq_referencias 
    WHERE tipo IN ('video', 'criativo') AND (transcricao IS NULL OR length(trim(transcricao)) = 0)
    LIMIT 10;
  `);
  console.log(amostra);
}
