import fs from 'fs';
import path from 'path';

const CLAUDE_DIR = 'C:\\Users\\vsuga\\.claude\\skills';
const GEMINI_DIR = 'C:\\Users\\vsuga\\.gemini\\config\\skills';

// Categories in Imperio HQ:
// "Pesquisa & Avatar" | "Copy & Persuasão" | "Inteligência Competitiva" | "Estratégia & Posicionamento" | "Vendas High-Ticket" | "Tráfego & Escala"
// "Código" | "IA" | "Dados" | "Criativo" | "Automação" | "Infra" | "Outro"

function detectCategory(id, desc) {
  const text = (id + ' ' + desc).toLowerCase();
  
  // Marketing & Sales
  if (/avatar|persona|desejo|dossie|problema|clone-mind|arxiv|citation/.test(id)) return 'Pesquisa & Avatar';
  if (/copy|devastador|lp-persuasiva|mecanismo|story|tripwire|weaponized|proof|humanizer|escrita|nsl|invisible|vsl|landing-pages|roteiro|youtube-content/.test(id)) return 'Copy & Persuasão';
  if (/angulos|hook|dtc-control|trafego|niche|reels|ugc|video|viral|ad-factory|ad0|black-belt|analise-criativos|twitter/.test(id)) return 'Tráfego & Escala';
  if (/competit|concorrente|funnel-hacking|market-intel|price-monitor|espiona|lead-research|ops-metrics/.test(id)) return 'Inteligência Competitiva';
  if (/breakthrough|headline|reposicionamento|webinar|course-generation/.test(id)) return 'Estratégia & Posicionamento';
  if (/sales|closer|high-ticket|imperius/.test(id)) return 'Vendas High-Ticket';

  // Tech & Ops
  if (/code|codex|opencode|git|spike|skill-creator|skill-forge|mcp-builder|test-driven|debug|review|simplify|criador-de-projetos|architect-first|enhance-workflow/.test(id)) return 'Código';
  if (/hermes|llm|synapse|estudador|generative_ui|ai-music|songwriting|memory|ralph|squad/.test(id)) return 'IA';
  if (/airtable|workspace|notion|obsidian|box|supabase|postgres|bandeira|boletim|xlsx|docx|pdf|pptx|powerpoint|maps/.test(id)) return 'Dados';
  if (/archify|diagram|infographic|design|gif|manim|p5js|songsee|remotion|popular-web|ascii/.test(id)) return 'Criativo';
  if (/computer-use|email|inbox|himalaya|message|reminder|notes|findmy|schedule|meeting|morning|dogfood|cowork|xurl/.test(id)) return 'Automação';
  if (/recovery|usage|infra|network/.test(id)) return 'Infra';
  
  if (/venda|oferta|anuncio/.test(text)) return 'Copy & Persuasão';
  return 'Outro';
}

function detectIcon(cat) {
  switch (cat) {
    case 'Pesquisa & Avatar': return 'Brain';
    case 'Copy & Persuasão': return 'PenTool';
    case 'Tráfego & Escala': return 'Swords';
    case 'Inteligência Competitiva': return 'Globe';
    case 'Estratégia & Posicionamento': return 'Target';
    case 'Vendas High-Ticket': return 'Shield';
    case 'Código': return 'Code2';
    case 'IA': return 'Bot';
    case 'Dados': return 'Database';
    case 'Criativo': return 'Palette';
    case 'Automação': return 'Zap';
    default: return 'Zap';
  }
}

function detectColor(cat) {
  switch (cat) {
    case 'Pesquisa & Avatar': return '#9b5de5';
    case 'Copy & Persuasão': return '#f15bb5';
    case 'Tráfego & Escala': return '#eab308';
    case 'Inteligência Competitiva': return '#00bbf9';
    case 'Estratégia & Posicionamento': return '#c9922a';
    case 'Vendas High-Ticket': return '#00f5d4';
    case 'Código': return '#3b82f6';
    case 'IA': return '#a855f7';
    case 'Dados': return '#10b981';
    case 'Criativo': return '#ec4899';
    case 'Automação': return '#f59e0b';
    default: return '#64748b';
  }
}

function formatTitle(id) {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/ V(\d+)/g, ' v$1')
    .replace(/Lp /g, 'LP ')
    .replace(/Vsl /g, 'VSL ')
    .replace(/Ia\b/g, 'IA')
    .replace(/Ai\b/g, 'AI')
    .replace(/Dtc/g, 'DTC')
    .replace(/Mcp/g, 'MCP')
    .replace(/Pdf/g, 'PDF')
    .replace(/Xlsx/g, 'XLSX')
    .replace(/Pptx/g, 'PPTX')
    .replace(/Docx/g, 'DOCX');
}

// Fix common mojibake
function cleanMojibake(str) {
  if (!str) return '';
  return str
    .replace(/Ã£/g, 'ã')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã /g, 'à')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã©/g, 'é')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/ÃŠ/g, 'Ê')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ãƒ/g, 'Ã')
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€™/g, "'");
}

export function loadAllClaudeSkills() {
  const skillsMap = new Map();

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const skillMd = path.join(dir, item.name, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          const raw = fs.readFileSync(skillMd, 'utf8');
          const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
          
          let name = item.name;
          let description = '';
          let body = raw;

          if (fmMatch) {
            const frontmatter = fmMatch[1];
            body = fmMatch[2].trim();

            const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
            if (nameMatch) name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');

            const descMatch = frontmatter.match(/^description:\s*(>[-+]?|\|[-+]?)?\s*\n?([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|$)/m);
            if (descMatch) {
              description = descMatch[2].replace(/\n\s+/g, ' ').trim().replace(/^['"]|['"]$/g, '');
            } else {
              const singleDesc = frontmatter.match(/^description:\s*(.+)$/m);
              if (singleDesc) description = singleDesc[1].trim().replace(/^['"]|['"]$/g, '');
            }
          }

          const cat = detectCategory(name, description);
          const icon = detectIcon(cat);
          const color = detectColor(cat);

          skillsMap.set(name, {
            id: name,
            slug: name,
            nome: formatTitle(name),
            descricao: cleanMojibake(description),
            categoria: cat,
            status: 'Ativo',
            icone: icon,
            cor: color,
            versao: 'v2.0',
            gatilho: `/${name}`,
            system_prompt: cleanMojibake(body)
          });
        }
      } else if (item.name.endsWith('.md') && !item.name.toLowerCase().includes('readme')) {
        const skillId = item.name.replace(/\.md$/, '');
        if (!skillsMap.has(skillId)) {
          const raw = fs.readFileSync(path.join(dir, item.name), 'utf8');
          const cat = detectCategory(skillId, '');
          skillsMap.set(skillId, {
            id: skillId,
            slug: skillId,
            nome: formatTitle(skillId),
            descricao: `Workflow e metodologia ${formatTitle(skillId)}`,
            categoria: cat,
            status: 'Ativo',
            icone: detectIcon(cat),
            cor: detectColor(cat),
            versao: 'v1.0',
            gatilho: `/${skillId}`,
            system_prompt: cleanMojibake(raw)
          });
        }
      }
    }
  }

  // Scan primary claude dir first, then gemini config for any missing
  scanDir(CLAUDE_DIR);
  scanDir(GEMINI_DIR);

  return Array.from(skillsMap.values());
}

export async function syncSkillsToSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://tkbivipqiewkfnhktmqq.supabase.co';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0';
  
  const supabase = createClient(url, key);
  const skills = loadAllClaudeSkills();
  console.log(`\n📦 Total de skills locais encontradas: ${skills.length}`);

  // Fetch existing slugs to preserve IDs if already existing
  const { data: existingRows } = await supabase.from('imphq_skills').select('id, slug');
  const existingMap = new Map((existingRows || []).map(r => [r.slug, r.id]));

  let successCount = 0;
  let errorCount = 0;

  // Process in chunks of 10
  const chunkSize = 10;
  for (let i = 0; i < skills.length; i += chunkSize) {
    const chunk = skills.slice(i, i + chunkSize);
    const payload = chunk.map(s => {
      const existingId = existingMap.get(s.slug);
      return {
        ...(existingId ? { id: existingId } : { id: s.id }),
        slug: s.slug,
        nome: s.nome,
        descricao: s.descricao,
        categoria: s.categoria,
        status: s.status,
        icone: s.icone,
        cor: s.cor,
        versao: s.versao,
        gatilho: s.gatilho,
        system_prompt: s.system_prompt,
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('imphq_skills')
      .upsert(payload, { onConflict: 'slug' });

    if (error) {
      console.error(`❌ Erro no lote ${i} - ${i + chunk.length}:`, error.message);
      errorCount += chunk.length;
    } else {
      successCount += chunk.length;
      process.stdout.write(`⚡ Sincronizadas: ${successCount}/${skills.length}\r`);
    }
  }

  console.log(`\n\n🎉 Sincronização finalizada com sucesso!`);
  console.log(`✅ Sucesso: ${successCount}`);
  if (errorCount > 0) console.log(`⚠️ Falhas: ${errorCount}`);
  
  return { total: skills.length, success: successCount, errors: errorCount };
}

if (process.argv[1]?.endsWith('sync-claude-skills.mjs')) {
  syncSkillsToSupabase().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
}
