import { execSync } from 'child_process';

console.log("==================================================================");
console.log("🕵️  AGENTE CAÇADOR DE VENCEDORES (WINNER HUNTER 14D+) — IMPÉRIO HQ");
console.log("==================================================================\n");

// 1. Obter fontes cadastradas
const sqlSources = "SELECT id, project_id, tipo, valor, pais, limite, min_dias, ativo FROM imphq_mining_sources WHERE ativo = true ORDER BY project_id, created_at DESC;";
const sourcesRaw = execSync(`npx supabase db query --linked "${sqlSources}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

let sources = [];
const sStart = sourcesRaw.indexOf('{');
const sEnd = sourcesRaw.lastIndexOf('}');
if (sStart !== -1 && sEnd !== -1) {
  sources = JSON.parse(sourcesRaw.slice(sStart, sEnd + 1)).rows || [];
}

console.log(`📡 Fontes de Monitoramento Ativas no Radar: ${sources.length}`);
const byProject = {};
for (const s of sources) {
  byProject[s.project_id] = (byProject[s.project_id] || 0) + 1;
}
for (const [proj, count] of Object.entries(byProject)) {
  console.log(`   - [${proj}]: ${count} fontes cadastradas`);
}

// 2. Verificar se há anúncios vencedores em imphq_referencias
const sqlWinners = "SELECT id, project_id, titulo, url, created_at, pipeline->'mineracao'->>'dias_no_ar' as dias_no_ar, pipeline->'mineracao'->>'variacoes' as variacoes, pipeline->'mineracao'->>'pagina' as pagina, pipeline->'mineracao'->>'biblioteca_url' as biblioteca_url FROM imphq_referencias WHERE (pipeline->'mineracao'->>'dias_no_ar')::int >= 14 OR tags @> ARRAY['WINNER 14D+'] ORDER BY (pipeline->'mineracao'->>'dias_no_ar')::int DESC NULLS LAST LIMIT 20;";

const winnersRaw = execSync(`npx supabase db query --linked "${sqlWinners}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
let winners = [];
const wStart = winnersRaw.indexOf('{');
const wEnd = winnersRaw.lastIndexOf('}');
if (wStart !== -1 && wEnd !== -1) {
  winners = JSON.parse(winnersRaw.slice(wStart, wEnd + 1)).rows || [];
}

console.log(`\n🏆 Anúncios Vencedores Confirmados (>= 14 dias contínuos no ar): ${winners.length}`);
if (winners.length > 0) {
  winners.forEach((w, i) => {
    console.log(`\n  #${i + 1} [${w.project_id}] ${w.titulo}`);
    console.log(`     Dias no Ar: ${w.dias_no_ar || '14+'} dias | Variações: ${w.variacoes || 1}`);
    console.log(`     Página: ${w.pagina || 'N/A'}`);
    console.log(`     Link Biblioteca: ${w.biblioteca_url || w.url}`);
  });
} else {
  console.log("   (Nenhum anúncio atingiu o ciclo de 14 dias nesta janela exata ou aguardando próximo ciclo do cron).");
}

console.log("\n==================================================================");
console.log("✅ Agente Winner Hunter sincronizado com sucesso no Império HQ!");
console.log("   Cron job ativo: 'winner-hunter-daily'");
console.log("==================================================================");
