import fs from 'fs';

const SOURCES = [
  // 1. SodaTide (Emagrecimento -> slimsoda)
  {
    project_id: 'slimsoda',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22TWR.THEINFO-BRIDGE.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'SodaTide — Funil A (TWR Dr. Oz)'
  },
  {
    project_id: 'slimsoda',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22BAKSLIMAFCL.ONLINE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'SodaTide — Funil B (Bakslim)'
  },

  // 2. JellyPeak (Emagrecimento -> slimsoda)
  {
    project_id: 'slimsoda',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22SALZHACK.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'JellyPeak — Funil Principal (Salzhack)'
  },

  // 3. NeuroMemory (Memória -> memoflow)
  {
    project_id: 'memoflow',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22LP.BENVRAX442.INFO%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'NeuroMemory — Funil A (Benvrax)'
  },

  // 4. Vapo Cept (Memória -> memoflow)
  {
    project_id: 'memoflow',
    tipo: 'pagina',
    valor: '1290481110823477',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'Vapo Cept — Página Oficial'
  },

  // 5. Golden Brain (Memória -> memoflow)
  {
    project_id: 'memoflow',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22ZEATRIVIO.COM%22&search_type=keyword_exact_phrase&sort_data[direction]=desc&sort_data[mode]=total_impressions',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'Golden Brain — Funil A (Zeatrivio)'
  },
  {
    project_id: 'memoflow',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=BLOG.BLOGMARCELADANTAS.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'Golden Brain — Funil B (Marcela Dantas)'
  },

  // 6. MemoHoney (Memória -> memoflow)
  {
    project_id: 'memoflow',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22VITALFLOWCO.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'MemoHoney — Funil Principal (VitalFlow)'
  },

  // 7. Memo Matrix (Memória -> memoflow)
  {
    project_id: 'memoflow',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=JJ.THEFLUFFYJELLO.ONLINE&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'Memo Matrix — Funil FluffyJello'
  },

  // 8. Sugar Balance (Diabetes -> cinna-shield)
  {
    project_id: 'cinna-shield',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22HUB.OFFICIALACCESS.SITE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'Sugar Balance — Funil A (Official Access)'
  },

  // 9. GlycoZen (Diabetes -> cinna-shield)
  {
    project_id: 'cinna-shield',
    tipo: 'pagina',
    valor: '1243696168835214',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'GlycoZen — Página Oficial (Funil A)'
  },
  {
    project_id: 'cinna-shield',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=NEWS.INDEPENDENTUPDATES.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'GlycoZen — Funil B (Independent Updates)'
  },

  // 10. Olivaro (Diabetes -> cinna-shield)
  {
    project_id: 'cinna-shield',
    tipo: 'pagina',
    valor: '105050005724841',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'Olivaro — Página Oficial (Funil A)'
  },
  {
    project_id: 'cinna-shield',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=TRACK.FITNESSFOLKLORE.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'Olivaro — Funil B (Fitness Folklore)'
  },

  // 11. GLPro (Diabetes -> cinna-shield)
  {
    project_id: 'cinna-shield',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22BLOG.ODDLYHEALTHY.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'GLPro — Funil A (Oddly Healthy)'
  },
  {
    project_id: 'cinna-shield',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22NEW.PIXLYNX.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'GLPro — Funil B (PixLynx)'
  },

  // 12. GlycoBarrier (Diabetes -> cinna-shield)
  {
    project_id: 'cinna-shield',
    tipo: 'url',
    valor: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22HEALTHYNEWSLETTERS.SITE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'GlycoBarrier — Funil A (Healthy Newsletters)'
  },
  {
    project_id: 'cinna-shield',
    tipo: 'pagina',
    valor: '104838184611702',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'GlycoBarrier — Página B'
  },
  {
    project_id: 'cinna-shield',
    tipo: 'pagina',
    valor: '318654394664137',
    pais: 'ALL',
    limite: 20,
    min_dias: 14,
    ativo: true,
    label: 'GlycoBarrier — Página C (VSLs C-E)'
  }
];

const sqls = [];

for (const s of SOURCES) {
  const val = s.valor.replace(/'/g, "''");
  sqls.push(`INSERT INTO imphq_mining_sources (id, project_id, tipo, valor, pais, limite, min_dias, ativo, created_by, created_at)
VALUES (
  gen_random_uuid(),
  '${s.project_id}',
  '${s.tipo}',
  '${val}',
  '${s.pais}',
  ${s.limite},
  ${s.min_dias},
  ${s.ativo},
  'WinnerHunter',
  NOW()
)
ON CONFLICT DO NOTHING;`);
}

const finalSql = sqls.join('\n\n');
fs.writeFileSync('C:/Users/vsuga/projects/imperiox/scripts/seed_winner_sources.sql', finalSql, 'utf8');
console.log(`Gerado seed_winner_sources.sql para as ${SOURCES.length} fontes dos 12 concorrentes associadas aos projetos!`);
