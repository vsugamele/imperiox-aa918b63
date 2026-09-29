import fs from 'fs';
import path from 'path';

const dossiers = JSON.parse(fs.readFileSync('scripts/bifi_all_dossiers.json', 'utf8'));

for (const [key, p] of Object.entries(dossiers)) {
  const dataPayload = {
    publico_alvo: p.publico_alvo,
    mecanismo_unico: p.mecanismo_unico,
    dores: p.dores,
    desejos: p.desejos,
    produtos: p.produtos,
    links: p.links,
    vsl: p.vsl
  };

  const avatarJson = JSON.stringify(p.avatar);
  const dataJson = JSON.stringify(dataPayload);
  const desc = p.description.replace(/'/g, "''");
  const cat = (p.category || 'Direct Response').replace(/'/g, "''");
  const color = (p.color || '#F59E0B').replace(/'/g, "''");
  const icon = (p.icon || 'Sparkles').replace(/'/g, "''");

  const sql = `UPDATE imphq_projects
SET 
  avatar = $avatar$${avatarJson}$avatar$::jsonb,
  data = $data$${dataJson}$data$::jsonb,
  description = '${desc}',
  category = '${cat}',
  color = '${color}',
  icon = '${icon}',
  updated_at = NOW()
WHERE id = '${p.id}';`;

  fs.writeFileSync(`scripts/update_${p.id}.sql`, sql, 'utf8');
  console.log(`Generated scripts/update_${p.id}.sql (avatar size: ${avatarJson.length}, data size: ${dataJson.length})`);
}
