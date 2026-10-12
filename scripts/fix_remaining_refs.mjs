import { execSync } from 'child_process';
import fs from 'fs';

// 1. Vincular Transcrição VSL A para The Sacred Prayer
const vslAText = fs.readFileSync('C:/Users/vsuga/projects/imperiox/scripts/update_transcriptions.sql', 'utf8');

const sql = `
-- 1. The Sacred Prayer VSL A
UPDATE imphq_referencias
SET transcricao = (SELECT transcricao FROM imphq_referencias WHERE url LIKE '%1v-ye4vhPyYFWEV6b-n4zCSsVD4M4wlPb%' LIMIT 1),
    transcribe_status = 'done',
    transcribed_at = NOW()
WHERE url LIKE '%1i7VWLdqs9nBU24ozEVq_gkSUtKkjYItR%';

-- 2. Frequency of Angels - Criativo 1 é na verdade Landing Page
UPDATE imphq_referencias
SET tipo = 'landing_page',
    titulo = 'Frequency of Angels — The Vatican News (Portal)'
WHERE url = 'http://thevaticannews.online/';

-- 3. Seed of Faith - Criativo 13 Reel Facebook
UPDATE imphq_referencias
SET transcricao = (SELECT transcricao FROM imphq_referencias WHERE url LIKE '%1EI5gBzQsD2Op-zE1H78aG_HZJVe9m4jo%' LIMIT 1),
    transcribe_status = 'done',
    transcribed_at = NOW()
WHERE url = 'https://www.facebook.com/reel/1892930332112487';

-- 4. Seed of Faith - Criativo 14 Reel Facebook
UPDATE imphq_referencias
SET transcricao = (SELECT transcricao FROM imphq_referencias WHERE url LIKE '%1vbCJ0_ZaXuTq2LNhOqMEeHYlJRnQcHxI%' LIMIT 1),
    transcribe_status = 'done',
    transcribed_at = NOW()
WHERE url = 'https://www.facebook.com/reel/1058960303845370';

-- 5. Remover duplicatas onde o documento de transcrição do Google Drive foi cadastrado separadamente como 'video'
DELETE FROM imphq_referencias
WHERE tipo = 'video'
  AND url IN (
    'https://drive.google.com/file/d/1BddUhqBq76wTrHCeg1b8BuuA48r46bXQ/view?usp=sharing',
    'https://drive.google.com/file/d/1v-ye4vhPyYFWEV6b-n4zCSsVD4M4wlPb/view?usp=sharing',
    'https://drive.google.com/file/d/1k7B_j_crbasUIhMRZft4RVAimh6eVEbw/view?usp=sharing',
    'https://drive.google.com/file/d/1PfWcMksU0lfZ5uhXrp3P785s1uHse0gZ/view?usp=sharing',
    'https://drive.google.com/file/d/1r8IpWGslIn-uvUszGA2aTy9aPZzkRm4H/view?usp=sharing',
    'https://drive.google.com/file/d/1f_3pkFZTxGQ6FtX9MnaJeqjuFkzOTDT9/view?usp=sharing',
    'https://drive.google.com/file/d/14NDe1KiFxR2s8RjT_asXami5lgVcQLiO/view?usp=sharing'
  );
`;

const file = 'scripts/fix_remaining_refs.sql';
fs.writeFileSync(file, sql, 'utf8');
execSync(`npx supabase db query --linked -f ${file}`);
fs.unlinkSync(file);
console.log("✅ Referências de Espiritualidade ajustadas com sucesso!");
