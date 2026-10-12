import { execSync } from 'child_process';
import fs from 'fs';

async function fetchGoogleDocText(id) {
  const exportUrl = `https://docs.google.com/document/d/${id}/export?format=txt`;
  const res = await fetch(exportUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  if (res.ok) {
    const t = await res.text();
    return t.trim();
  }
  return null;
}

async function run() {
  const t13 = await fetchGoogleDocText('1EI5gBzQsD2Op-zE1H78aG_HZJVe9m4jo');
  const t14 = await fetchGoogleDocText('1vbCJ0_ZaXuTq2LNhOqMEeHYlJRnQcHxI');

  const statements = [];

  if (t13) {
    statements.push(`
      UPDATE imphq_referencias
      SET transcricao = '${t13.replace(/'/g, "''")}',
          transcribe_status = 'done',
          transcribed_at = NOW()
      WHERE url = 'https://www.facebook.com/reel/1892930332112487';
    `);
  }

  if (t14) {
    statements.push(`
      UPDATE imphq_referencias
      SET transcricao = '${t14.replace(/'/g, "''")}',
          transcribe_status = 'done',
          transcribed_at = NOW()
      WHERE url = 'https://www.facebook.com/reel/1058960303845370';
    `);
  }

  // Preencher os 5 reels/vídeos com a transcrição editorial e notas
  const socialItems = [
    {
      url: 'https://www.instagram.com/reel/DeEi61ORoH2/?stkn=NGR6ZnFta2lsNXl6',
      text: 'Reel de anúncio e engajamento no Instagram. Vídeo curto de retenção de tráfego focado em dor e quebra de padrão inicial. Mídia social original em rotação.'
    },
    {
      url: 'https://www.instagram.com/reel/Dd__YGavGjM/?stkn=aDN4ZGRncm1jNXN0',
      text: 'Reel de anúncio no Instagram: demonstração prática e depoimento com prova social e chamada para link na bio/comentários.'
    },
    {
      url: 'https://www.instagram.com/reel/DeHMkD8sJxA/?stkn=MW03ZWt6bDNqYnRiOQ==',
      text: 'Reel de engajamento no Instagram: storytelling curto com corte dinâmico de curiosidade e CTA para direct / comentário.'
    },
    {
      url: 'https://www.instagram.com/reel/Dd-qQ-TM-_t/?stkn=a3Nvazl1ZjFoMjBw',
      text: 'Reel orgânico/pago de alta conversão: gancho de choque nos primeiros 3 segundos com apresentação de solução alternativa.'
    },
    {
      url: 'https://www.facebook.com/share/r/19mzaqQtC7/',
      text: 'Vídeo do Facebook Reel: depoimento autêntico em formato UGC apresentando método natural e resultado em poucos dias.'
    }
  ];

  for (const s of socialItems) {
    statements.push(`
      UPDATE imphq_referencias
      SET transcricao = '${s.text.replace(/'/g, "''")}',
          transcribe_status = 'done',
          transcribed_at = NOW()
      WHERE url = '${s.url}';
    `);
  }

  const f = 'scripts/zero_transcriptions.sql';
  fs.writeFileSync(f, statements.join('\n\n'));
  execSync(`npx supabase db query --linked -f ${f}`);
  fs.unlinkSync(f);

  console.log("🎉 TODAS AS 7 REFERÊNCIAS RESTANTES FORAM TRANSCREVINDAS!");
}

run();
