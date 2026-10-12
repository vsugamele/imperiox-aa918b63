import { execSync } from 'child_process';

function queryDb(sql) {
  const cmd = `npx supabase db query --linked "${sql.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
  const res = execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const start = res.indexOf('{');
  const end = res.lastIndexOf('}');
  if (start === -1 || end === -1) return [];
  return JSON.parse(res.slice(start, end + 1)).rows || [];
}

const rows = queryDb(`
  SELECT id, title, criador, formato, nicho, raw_text, blocks
  FROM imphq_swipes 
  WHERE reverse_engineering IS NULL OR reverse_engineering = '{}'::jsonb
  ORDER BY title;
`);

console.log(`Total: ${rows.length}`);
rows.forEach((r, i) => {
  const rawPreview = (r.raw_text || '').slice(0, 100).replace(/\n/g, ' ');
  console.log(`${i + 1}. [${r.criador || 'Sem criador'}] ${r.title} | Nicho: ${r.nicho} | Formato: ${r.formato} | Preview: ${rawPreview}`);
});
