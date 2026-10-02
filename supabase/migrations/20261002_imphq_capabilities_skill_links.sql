-- Primeiras ligações ferramenta → skill (aprovadas pelo Vinicius em 02/10/2026). Só skills que produzem peça (vídeo, imagem, página).
-- Idempotente: acrescenta a skill sem duplicar e sem tirar ligações feitas na aba Ferramentas.
with links(skill, cap) as (values
 ('angulos-criativos','satori'),('angulos-criativos','resvg-js'),('angulos-criativos','sharp'),('angulos-criativos','fontsource'),
 ('skill-black-belt','ffmpeg'),('skill-black-belt','remotion'),('skill-black-belt','fontsource'),
 ('organic-reels-factory','ffmpeg'),('organic-reels-factory','remotion'),('organic-reels-factory','freesound'),('organic-reels-factory','fontsource'),
 ('pipeline-video-viral','ffmpeg'),('pipeline-video-viral','remotion'),('pipeline-video-viral','satori'),
 ('video-roleta-sorteio','remotion'),('video-roleta-sorteio','ffmpeg'),('video-roleta-sorteio','fontsource'),
 ('vsl-filemon','motion-canvas'),('vsl-filemon','remotion'),('vsl-filemon','ffmpeg'),
 ('lp-persuasiva-v2','magic-ui'),('lp-persuasiva-v2','aceternity-ui'),('lp-persuasiva-v2','lottie-web'),('lp-persuasiva-v2','splittype'),
 ('analise-criativos-escalados','ffmpeg'),('analise-criativos-escalados','playwright')),
agg as (select cap, array_agg(skill) novas from links group by cap)
update imphq_capabilities c set skills = array(select distinct s from unnest(c.skills || agg.novas) s order by s), updated_at = now()
from agg where c.id = agg.cap;
