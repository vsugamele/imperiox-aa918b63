import fs from 'fs';
import { execSync } from 'child_process';

const basePath = 'C:/Users/vsuga/.gemini/antigravity/brain/fb21137e-e8e8-4622-8ba3-6e324270c5ec/.system_generated/steps';
const steps = [
  { step: 2832, title: "The King's Code 2.0" },
  { step: 2840, title: "The Sacred Prayer" },
  { step: 2846, title: "Divine Script (discount)" },
  { step: 2852, title: "Frequency of Angels" },
  { step: 2858, title: "Seed of Faith" },
  { step: 2864, title: "Manuscript of Miracles" }
];

function extractDriveId(url) {
  if (!url) return null;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  const m2 = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

async function fetchGoogleDocText(url) {
  const id = extractDriveId(url);
  if (!id) return null;
  const exportUrl = `https://docs.google.com/document/d/${id}/export?format=txt`;
  try {
    const res = await fetch(exportUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) {
      // Tentar download direto de arquivo texto
      const dlUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download`;
      const res2 = await fetch(dlUrl);
      if (!res2.ok) return null;
      const t = await res2.text();
      return t.length > 20 && !t.includes('<!DOCTYPE html>') ? t : null;
    }
    const txt = await res.text();
    return txt.length > 20 && !txt.includes('<!DOCTYPE html>') ? txt.trim() : null;
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log("=== EXTRAINDO E VINCULANDO TRANSCRIÇÕES REAIS DO GOOGLE DRIVE ===");

  const updates = [];

  for (const s of steps) {
    const p = `${basePath}/${s.step}/output.txt`;
    const raw = fs.readFileSync(p, 'utf8');
    const m = raw.match(/```json\r?\n([\s\S]*?)\r?\n```/);
    const data = JSON.parse(m[1]);

    console.log(`\nProcessando: ${s.title}...`);

    // Procurar pares Criativo / Transcrição
    // Na tabela do Notion, links de criativo e transcrição aparecem em ordem sequencial
    const allLinks = data.links.filter(l => l.href && l.href.includes('drive.google.com'));

    // Agrupar por parentText ou por pares
    for (let i = 0; i < allLinks.length; i++) {
      const link = allLinks[i];
      const isTrans = link.text.includes('Transcrição') || (link.parentText && link.parentText.includes('Transcrição') && !link.text.includes('▶'));
      const isMedia = link.text.includes('▶') || link.text.includes('Abrir criativo') || link.text.includes('Assistir VSL') || link.text.includes('apresentação');

      if (isTrans) {
        console.log(`  Baixando transcrição: "${link.text}" (${link.href})...`);
        const text = await fetchGoogleDocText(link.href);
        if (text) {
          console.log(`  ✅ Baixada com sucesso! (${text.length} caracteres)`);

          // Descobrir qual criativo ou VSL se refere
          let targetMediaUrl = null;
          if (i > 0 && (allLinks[i - 1].text.includes('▶') || allLinks[i - 1].text.includes('Abrir') || allLinks[i - 1].text.includes('Assistir'))) {
            targetMediaUrl = allLinks[i - 1].href;
          }

          updates.push({
            offer: s.title,
            transcriptionUrl: link.href,
            mediaUrl: targetMediaUrl,
            text,
            isVsl: link.text.includes('VSL') || (link.parentText && link.parentText.includes('VSL'))
          });
        } else {
          console.log(`  ⚠️ Não foi possível converter via Google Docs TXT.`);
        }
      }
    }
  }

  console.log(`\nTotal de transcrições reais obtidas: ${updates.length}`);

  // Gerar SQL para atualizar imphq_referencias e imphq_swipes
  const sqlStatements = [];

  for (const u of updates) {
    const escapedText = "'" + u.text.replace(/'/g, "''") + "'";

    // 1. Se tem mediaUrl, atualizar a referência que aponta para esse vídeo
    if (u.mediaUrl) {
      sqlStatements.push(`
        UPDATE imphq_referencias 
        SET transcricao = ${escapedText},
            transcribe_status = 'done',
            transcribed_at = NOW()
        WHERE url = '${u.mediaUrl.replace(/'/g, "''")}';
      `);
    }

    // 2. Também atualizar caso a referência tenha sido gravada com a URL da transcrição
    sqlStatements.push(`
      UPDATE imphq_referencias 
      SET transcricao = ${escapedText},
          transcribe_status = 'done',
          transcribed_at = NOW()
      WHERE url = '${u.transcriptionUrl.replace(/'/g, "''")}';
    `);

    // 3. Se for VSL, injetar a transcrição no swipe correspondente
    if (u.isVsl) {
      sqlStatements.push(`
        UPDATE imphq_swipes 
        SET raw_text = raw_text || E'\\n\\n## 📝 Transcrição da VSL na Íntegra\\n\\n' || ${escapedText}
        WHERE title ILIKE '%${u.offer.replace(/'/g, "''")}%'
          AND raw_text NOT LIKE '%Transcrição da VSL na Íntegra%';
      `);
    }
  }

  const sqlPath = 'C:/Users/vsuga/projects/imperiox/scripts/update_transcriptions.sql';
  fs.writeFileSync(sqlPath, sqlStatements.join('\n\n'), 'utf8');
  console.log(`SQL gerado em ${sqlPath}`);

  console.log("Executando atualização no Supabase...");
  execSync(`npx supabase db query --linked -f ${sqlPath}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  console.log("🎉 Todas as transcrições foram inseridas com sucesso no banco de dados!");
}

run();
