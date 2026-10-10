import { execSync } from 'child_process';

const query = `SELECT title, blocks, reverse_engineering, raw_text FROM imphq_swipes WHERE title ILIKE '%SodaTide%';`;
const res = execSync(`npx supabase db query --linked "${query}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const s = res.indexOf('{');
const e = res.lastIndexOf('}');
const rows = JSON.parse(res.slice(s, e + 1)).rows || [];
console.log("Title:", rows[0]?.title);
console.log("Blocks:", rows[0]?.blocks);
console.log("Reverse engineering:", rows[0]?.reverse_engineering);
console.log("Raw text length:", rows[0]?.raw_text?.length);
