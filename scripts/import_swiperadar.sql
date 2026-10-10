-- Limpeza de swipes anteriores do SwipeRadar (idempotência)
DELETE FROM imphq_swipes WHERE tags @> ARRAY['swiperadar']::text[];
DELETE FROM imphq_referencias WHERE fonte = 'SwipeRadar';

INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] SodaTide (Emagrecimento)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica',
    'Emagrecimento',
    ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"O \"truque do bicarbonato de sódio\" testado pelo Dr. Oz que ativa a perda acelerada de peso.","participacao_ativa":"Público que já tentou dietas restritivas e esteve acima do peso sem conseguir manter o resultado.","narrativa":"Página no estilo portal TODAY com reportagem investigativa. Dois funis simultâneos: Funil A rodando VSL com corte do Dr. Oz via cloaker TWR; Funil B com LP direta e VSL nativa.","reframe":"A causa real do ganho de peso não é a falta de exercício, mas a acidez crônica do organismo que bloqueia as células adiposas. O bicarbonato alkaliza e desbloqueia.","cta_engajamento":"Criativos (2) e VSLs (2) disponíveis no Google Drive.","cta_venda":"LPs ativas: https://twr.theinfo-bridge.com/lxnl391ry9/ | http://twr.theinfo-bridge.com/lxnl391ry9. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/SodaTide-3f10ddb38913811cb797d1022539a030',
    'https://drive.google.com/file/d/1lSMW23c-XFta_LqYEYlN2Bu26Wpwfous/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1NG4BzwH_6yWUEFMxymN37Jyo2PDzER4m/view?usp=sharing', 'https://drive.google.com/file/d/1kArqvHNOuFdIVbp9OkR7vHLYYTe4GECI/view?usp=sharing', 'https://drive.google.com/file/d/1lSMW23c-XFta_LqYEYlN2Bu26Wpwfous/view?usp=sharing', 'https://drive.google.com/file/d/1NnnFQqhouokSQaCFRCX3XXtBXgpd5Ejq/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: SodaTide

**Nicho:** Emagrecimento
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/SodaTide-3f10ddb38913811cb797d1022539a030)
**Mecanismo Único:** Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Emagrecimento
/
SodaTide
Crie sua conta gratuita
SodaTide
Truque do bicarbonato com página no estilo TODAY. Dois funis rodando: A com a VSL do Dr. Oz (entrada pelo cloaker TWR) e B com outra LP e outra VSL.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Emagrecimento
	
2
	
9k views
	
2
	
2
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01 · Funil A
	
7k
	
21/09
	
▶ Abrir criativo


Criativo 02 · Funil B
	
9k
	
17/09
	
▶ Abrir criativo
 Páginas
LANDING PAGE A · DR. OZ
Abrir LP A ​
twr.theinfo-bridge.com/lxnl391ry9
Topo da LP A com a VSL do Dr. Oz
LANDING PAGE B
Abrir LP B ​
bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12
Topo da LP B
HTML para baixar: ainda não disponível
 VSLs
▶ Assistir VSL A · Dr. Oz · 21/09 · Funil A
▶ Assistir VSL B · 17/09 · Funil B
 Biblioteca de Anúncios
Ver anúncios ativos · Funil A (Dr. Oz) ​
Ver anúncios ativos · Funil B ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** O "truque do bicarbonato de sódio" testado pelo Dr. Oz que ativa a perda acelerada de peso.
- **Público & Dor:** Público que já tentou dietas restritivas e esteve acima do peso sem conseguir manter o resultado.
- **Linha Narrativa:** Página no estilo portal TODAY com reportagem investigativa. Dois funis simultâneos: Funil A rodando VSL com corte do Dr. Oz via cloaker TWR; Funil B com LP direta e VSL nativa.
- **Virada de Crença / Mecanismo:** A causa real do ganho de peso não é a falta de exercício, mas a acidez crônica do organismo que bloqueia as células adiposas. O bicarbonato alkaliza e desbloqueia.
- **Construção da Oferta:** Suplemento líquido / gotas aceleradoras baseadas no princípio do bicarbonato ativo com frete grátis e kits promocionais.

## 🎬 Criativos Escalados (2 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1NG4BzwH_6yWUEFMxymN37Jyo2PDzER4m/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1kArqvHNOuFdIVbp9OkR7vHLYYTe4GECI/view?usp=sharing)

## 🌐 Páginas & Funis (4 links)
- [Abrir LP A](https://twr.theinfo-bridge.com/lxnl391ry9/)
- [twr.theinfo-bridge.com/lxnl391ry9](http://twr.theinfo-bridge.com/lxnl391ry9)
- [Abrir LP B](https://bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12/)
- [bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12](http://bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12)

## 📽️ VSLs na Íntegra (2 vídeos)
- ▶️ [▶ Assistir VSL A · Dr. Oz · 21/09 · Funil A](https://drive.google.com/file/d/1lSMW23c-XFta_LqYEYlN2Bu26Wpwfous/view?usp=sharing)
- ▶️ [▶ Assistir VSL B · 17/09 · Funil B](https://drive.google.com/file/d/1NnnFQqhouokSQaCFRCX3XXtBXgpd5Ejq/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos · Funil A (Dr. Oz)](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22TWR.THEINFO-BRIDGE.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)
- 🔎 [Ver anúncios ativos · Funil B](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22BAKSLIMAFCL.ONLINE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Ideal para modelagem no **LinfaFlow** ou **SlimSoda**: utilize o ângulo da quebra de expectativa rápida (truque do ingrediente natural) e a validação social em páginas advertorial.
',
    '{"oferta":"SodaTide","nicho":"Emagrecimento","notion_url":"https://swiperadar.notion.site/SodaTide-3f10ddb38913811cb797d1022539a030","mecanismo":"Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica","total_criativos":2,"total_vsls":2,"total_lps":4,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1NG4BzwH_6yWUEFMxymN37Jyo2PDzER4m/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1kArqvHNOuFdIVbp9OkR7vHLYYTe4GECI/view?usp=sharing"}],"paginas":[{"text":"Abrir LP A","url":"https://twr.theinfo-bridge.com/lxnl391ry9/","parent":"Abrir LP A ​"},{"text":"twr.theinfo-bridge.com/lxnl391ry9","url":"http://twr.theinfo-bridge.com/lxnl391ry9","parent":"twr.theinfo-bridge.com/lxnl391ry9"},{"text":"Abrir LP B","url":"https://bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12/","parent":"Abrir LP B ​"},{"text":"bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12","url":"http://bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12","parent":"bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12"}],"vsls":[{"text":"▶ Assistir VSL A · Dr. Oz · 21/09 · Funil A","url":"https://drive.google.com/file/d/1lSMW23c-XFta_LqYEYlN2Bu26Wpwfous/view?usp=sharing"},{"text":"▶ Assistir VSL B · 17/09 · Funil B","url":"https://drive.google.com/file/d/1NnnFQqhouokSQaCFRCX3XXtBXgpd5Ejq/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos · Funil A (Dr. Oz)","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22TWR.THEINFO-BRIDGE.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"},{"text":"Ver anúncios ativos · Funil B","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22BAKSLIMAFCL.ONLINE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[],"prints":["https://swiperadar.notion.site/image/attachment%3A388da1a5-05f5-44de-898e-3630301c42f2%3Asodatide-lp-a.png?table=block&id=da844f11-4a3f-4a9c-a64c-18ed57bd98a4&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A4a203bb3-3c39-4abc-a702-41a36a152823%3Asodatide-lp-b.png?table=block&id=aa6b6123-6d4a-4d39-8df3-a8d97d688351&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'SodaTide — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1NG4BzwH_6yWUEFMxymN37Jyo2PDzER4m/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A388da1a5-05f5-44de-898e-3630301c42f2%3Asodatide-lp-a.png?table=block&id=da844f11-4a3f-4a9c-a64c-18ed57bd98a4&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'criativo']::text[],
      'Criativo da oferta escalada SodaTide (Emagrecimento). Mecanismo: Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica',
      9,
      'Meta Ads',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'SodaTide — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1kArqvHNOuFdIVbp9OkR7vHLYYTe4GECI/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A388da1a5-05f5-44de-898e-3630301c42f2%3Asodatide-lp-a.png?table=block&id=da844f11-4a3f-4a9c-a64c-18ed57bd98a4&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'criativo']::text[],
      'Criativo da oferta escalada SodaTide (Emagrecimento). Mecanismo: Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica',
      9,
      'Meta Ads',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'SodaTide — Assistir VSL A · Dr. Oz · 21/09 · Funil A',
      'https://drive.google.com/file/d/1lSMW23c-XFta_LqYEYlN2Bu26Wpwfous/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A388da1a5-05f5-44de-898e-3630301c42f2%3Asodatide-lp-a.png?table=block&id=da844f11-4a3f-4a9c-a64c-18ed57bd98a4&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'vsl']::text[],
      'VSL completa da oferta SodaTide (Emagrecimento). Mecanismo: Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica',
      10,
      'Drive / VSL',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'SodaTide — Assistir VSL B · 17/09 · Funil B',
      'https://drive.google.com/file/d/1NnnFQqhouokSQaCFRCX3XXtBXgpd5Ejq/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A388da1a5-05f5-44de-898e-3630301c42f2%3Asodatide-lp-a.png?table=block&id=da844f11-4a3f-4a9c-a64c-18ed57bd98a4&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'vsl']::text[],
      'VSL completa da oferta SodaTide (Emagrecimento). Mecanismo: Truque do bicarbonato matinal (Baking soda ritual) para dissolver gordura e acelerar queima metabólica',
      10,
      'Drive / VSL',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'SodaTide — LP Abrir LP A',
      'https://twr.theinfo-bridge.com/lxnl391ry9/',
      'https://swiperadar.notion.site/image/attachment%3A388da1a5-05f5-44de-898e-3630301c42f2%3Asodatide-lp-a.png?table=block&id=da844f11-4a3f-4a9c-a64c-18ed57bd98a4&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'landing_page']::text[],
      'Landing page da oferta SodaTide (Emagrecimento).',
      9,
      'Web',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'SodaTide — LP twr.theinfo-bridge.com/lxnl391ry9',
      'http://twr.theinfo-bridge.com/lxnl391ry9',
      'https://swiperadar.notion.site/image/attachment%3A4a203bb3-3c39-4abc-a702-41a36a152823%3Asodatide-lp-b.png?table=block&id=aa6b6123-6d4a-4d39-8df3-a8d97d688351&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'landing_page']::text[],
      'Landing page da oferta SodaTide (Emagrecimento).',
      9,
      'Web',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'SodaTide — LP Abrir LP B',
      'https://bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12/',
      'https://swiperadar.notion.site/image/attachment%3A388da1a5-05f5-44de-898e-3630301c42f2%3Asodatide-lp-a.png?table=block&id=da844f11-4a3f-4a9c-a64c-18ed57bd98a4&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'landing_page']::text[],
      'Landing page da oferta SodaTide (Emagrecimento).',
      9,
      'Web',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'SodaTide — LP bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12',
      'http://bakslimaffr.online/redtra-bugod-leand-baksda-sdtide-pitchnovo-page12',
      'https://swiperadar.notion.site/image/attachment%3A4a203bb3-3c39-4abc-a702-41a36a152823%3Asodatide-lp-b.png?table=block&id=aa6b6123-6d4a-4d39-8df3-a8d97d688351&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'sodatide', 'landing_page']::text[],
      'Landing page da oferta SodaTide (Emagrecimento).',
      9,
      'Web',
      'SwipeRadar — Emagrecimento',
      'SodaTide',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] JellyPeak (Emagrecimento)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Chia Jelly Trick (Gelatina caseira de semente de chia para queima acelerada de gordura e firmeza da pele)',
    'Emagrecimento',
    ARRAY['swiperadar', 'emagrecimento', 'jellypeak', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"“Try the Chia Jelly Trick, if you want to wave goodbye to your bat wings!”","participacao_ativa":"Mulheres com mais de 50 anos incomodadas com flacidez nos braços (\"asinhas de morcego\") e barriga.","narrativa":"Imagem estática de alto contraste → Pré-sell advertorial de depoimento emocional (“At 57, I wear smaller jeans…”) → Página da VSL formatada como post do Dr. Oz no Facebook com centenas de comentários sociais.","reframe":"A flacidez e o acúmulo de gordura nessa idade decorrem da perda de viscosidade gástrica e colágeno enzimático. A gelatina de chia retarda a absorção de glicose e firma a derme.","cta_engajamento":"Criativos (1) e VSLs (1) disponíveis no Google Drive.","cta_venda":"LPs ativas: https://mybestvibes.com/smaller-jeans | http://mybestvibes.com/smaller-jeans. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/JellyPeak-3f10ddb3891381a889d0cde1764bc315',
    'https://drive.google.com/file/d/1H2aMNolSD1zSujqVUCGLIM6cR56ThZ9N/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1Z16aMiyPlcpx1HxrgGWmUr6bZkAjXpvx/view?usp=sharing', 'https://drive.google.com/file/d/1H2aMNolSD1zSujqVUCGLIM6cR56ThZ9N/view?usp=sharing', 'https://drive.google.com/file/d/1a_IHevjgBeWYfa7KbEwwui4E10SOBAhE/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: JellyPeak

**Nicho:** Emagrecimento
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/JellyPeak-3f10ddb3891381a889d0cde1764bc315)
**Mecanismo Único:** Chia Jelly Trick (Gelatina caseira de semente de chia para queima acelerada de gordura e firmeza da pele)

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Emagrecimento
/
JellyPeak
Crie sua conta gratuita
JellyPeak
“Chia Jelly Trick”: criativo de imagem com gancho de flacidez nos braços (“bat wings”) → pré-sell em formato de depoimento (“At 57, I wear smaller jeans…”) → página da VSL com post falso do Dr. Oz.
Nicho
	
Criativos
	
Formato do criativo
	
Páginas
	
VSLs


Emagrecimento
	
1
	
Imagem estática
	
Pré-sell + página da VSL
	
1
 Criativos
Criativo
	
Formato
	
Gancho
	
Arquivo


Criativo 01
	
Imagem
	
“Try the Chia Jelly Trick, if you want to wave goodbye to your bat wings!”
	
▶ Abrir criativo
 Páginas
PRÉ-SELL
Abrir pré-sell ​
mybestvibes.com/smaller-jeans
HTML DA PÁGINA
 Baixar HTML da pré-sell (.zip)
Pré-sell · topo
Pré-sell · meio
Pré-sell · final
PÁGINA DA VSL
Domínio: strongerwellness.shop
Post falso do Dr. Oz no Facebook com a VSL e comentários.
Página da VSL · topo
Página da VSL · comentários
 VSLs
▶ Assistir VSL A
 Biblioteca de Anúncios
Ver anúncios ativos ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** “Try the Chia Jelly Trick, if you want to wave goodbye to your bat wings!”
- **Público & Dor:** Mulheres com mais de 50 anos incomodadas com flacidez nos braços ("asinhas de morcego") e barriga.
- **Linha Narrativa:** Imagem estática de alto contraste → Pré-sell advertorial de depoimento emocional (“At 57, I wear smaller jeans…”) → Página da VSL formatada como post do Dr. Oz no Facebook com centenas de comentários sociais.
- **Virada de Crença / Mecanismo:** A flacidez e o acúmulo de gordura nessa idade decorrem da perda de viscosidade gástrica e colágeno enzimático. A gelatina de chia retarda a absorção de glicose e firma a derme.
- **Construção da Oferta:** Fórmula concentrada de sementes e botânicos em gotas com garantia de devolução.

## 🎬 Criativos Escalados (1 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1Z16aMiyPlcpx1HxrgGWmUr6bZkAjXpvx/view?usp=sharing)

## 🌐 Páginas & Funis (3 links)
- [Abrir pré-sell](https://mybestvibes.com/smaller-jeans)
- [mybestvibes.com/smaller-jeans](http://mybestvibes.com/smaller-jeans)
- [strongerwellness.shop](http://strongerwellness.shop/)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da pré-sell (.zip)](https://drive.google.com/file/d/1a_IHevjgBeWYfa7KbEwwui4E10SOBAhE/view?usp=sharing)

## 📽️ VSLs na Íntegra (1 vídeos)
- ▶️ [▶ Assistir VSL A](https://drive.google.com/file/d/1H2aMNolSD1zSujqVUCGLIM6cR56ThZ9N/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&is_targeted_country=false&media_type=all&q=%22SALZHACK.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc)

## 🎯 Como Modelar para o Império HQ
Ideal para modelagem no **LinfaFlow** ou **SlimSoda**: utilize o ângulo da quebra de expectativa rápida (truque do ingrediente natural) e a validação social em páginas advertorial.
',
    '{"oferta":"JellyPeak","nicho":"Emagrecimento","notion_url":"https://swiperadar.notion.site/JellyPeak-3f10ddb3891381a889d0cde1764bc315","mecanismo":"Chia Jelly Trick (Gelatina caseira de semente de chia para queima acelerada de gordura e firmeza da pele)","total_criativos":1,"total_vsls":1,"total_lps":3,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1Z16aMiyPlcpx1HxrgGWmUr6bZkAjXpvx/view?usp=sharing"}],"paginas":[{"text":"Abrir pré-sell","url":"https://mybestvibes.com/smaller-jeans","parent":"Abrir pré-sell ​"},{"text":"mybestvibes.com/smaller-jeans","url":"http://mybestvibes.com/smaller-jeans","parent":"mybestvibes.com/smaller-jeans"},{"text":"strongerwellness.shop","url":"http://strongerwellness.shop/","parent":"Domínio: strongerwellness.shop"}],"vsls":[{"text":"▶ Assistir VSL A","url":"https://drive.google.com/file/d/1H2aMNolSD1zSujqVUCGLIM6cR56ThZ9N/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&is_targeted_country=false&media_type=all&q=%22SALZHACK.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc"}],"zips":[{"text":"Baixar HTML da pré-sell (.zip)","url":"https://drive.google.com/file/d/1a_IHevjgBeWYfa7KbEwwui4E10SOBAhE/view?usp=sharing","parent":"Baixar HTML da pré-sell (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3A62fb2c59-dd16-45f9-b1e3-d585824d433e%3Ajellypeak-presell-1.png?table=block&id=c2ec33d4-bd76-4e8f-b6ba-5a9751d20361&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A94fa22da-6efa-4e34-83b7-8219962be940%3Ajellypeak-presell-2.png?table=block&id=a69dde76-58f9-45b8-b1ee-47e1cb33885b&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A9cf81b6a-c1fd-4f0b-926a-91f455aebdfa%3Ajellypeak-presell-3.png?table=block&id=646d35ef-c372-408e-959d-74331cb15186&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A1d2c5e72-178d-48a0-b225-e7191fa08521%3Ajellypeak-vsl-1.png?table=block&id=a86d71cf-4bf7-4868-91bd-a18e98b6c752&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3Ad8e4fb04-fafe-4431-b11a-57accd75b638%3Ajellypeak-vsl-2.png?table=block&id=6f36ee1d-fd4e-4a3e-9fbb-2edde2d76c84&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'JellyPeak — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1Z16aMiyPlcpx1HxrgGWmUr6bZkAjXpvx/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A62fb2c59-dd16-45f9-b1e3-d585824d433e%3Ajellypeak-presell-1.png?table=block&id=c2ec33d4-bd76-4e8f-b6ba-5a9751d20361&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'jellypeak', 'criativo']::text[],
      'Criativo da oferta escalada JellyPeak (Emagrecimento). Mecanismo: Chia Jelly Trick (Gelatina caseira de semente de chia para queima acelerada de gordura e firmeza da pele)',
      9,
      'Meta Ads',
      'SwipeRadar — Emagrecimento',
      'JellyPeak',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'JellyPeak — Assistir VSL A',
      'https://drive.google.com/file/d/1H2aMNolSD1zSujqVUCGLIM6cR56ThZ9N/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A62fb2c59-dd16-45f9-b1e3-d585824d433e%3Ajellypeak-presell-1.png?table=block&id=c2ec33d4-bd76-4e8f-b6ba-5a9751d20361&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'jellypeak', 'vsl']::text[],
      'VSL completa da oferta JellyPeak (Emagrecimento). Mecanismo: Chia Jelly Trick (Gelatina caseira de semente de chia para queima acelerada de gordura e firmeza da pele)',
      10,
      'Drive / VSL',
      'SwipeRadar — Emagrecimento',
      'JellyPeak',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'JellyPeak — LP Abrir pré-sell',
      'https://mybestvibes.com/smaller-jeans',
      'https://swiperadar.notion.site/image/attachment%3A62fb2c59-dd16-45f9-b1e3-d585824d433e%3Ajellypeak-presell-1.png?table=block&id=c2ec33d4-bd76-4e8f-b6ba-5a9751d20361&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'jellypeak', 'landing_page']::text[],
      'Landing page da oferta JellyPeak (Emagrecimento). | ZIP com HTML: https://drive.google.com/file/d/1a_IHevjgBeWYfa7KbEwwui4E10SOBAhE/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Emagrecimento',
      'JellyPeak',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'JellyPeak — LP mybestvibes.com/smaller-jeans',
      'http://mybestvibes.com/smaller-jeans',
      'https://swiperadar.notion.site/image/attachment%3A94fa22da-6efa-4e34-83b7-8219962be940%3Ajellypeak-presell-2.png?table=block&id=a69dde76-58f9-45b8-b1ee-47e1cb33885b&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'jellypeak', 'landing_page']::text[],
      'Landing page da oferta JellyPeak (Emagrecimento).',
      9,
      'Web',
      'SwipeRadar — Emagrecimento',
      'JellyPeak',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'JellyPeak — LP strongerwellness.shop',
      'http://strongerwellness.shop/',
      'https://swiperadar.notion.site/image/attachment%3A9cf81b6a-c1fd-4f0b-926a-91f455aebdfa%3Ajellypeak-presell-3.png?table=block&id=646d35ef-c372-408e-959d-74331cb15186&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'emagrecimento', 'jellypeak', 'landing_page']::text[],
      'Landing page da oferta JellyPeak (Emagrecimento).',
      9,
      'Web',
      'SwipeRadar — Emagrecimento',
      'JellyPeak',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] NeuroMemory (Memória)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
    'Memória',
    ARRAY['swiperadar', 'memória', 'neuromemory', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"\"Alerta urgente de saúde neurológica: como manter a mente afiada aos 67 anos sem remédios tarja preta.\"","participacao_ativa":"Adultos 60+ e filhos de idosos preocupados com lapsos frequentes de memória e risco de demência.","narrativa":"VSL no formato do clássico telejornal investigativo americano 60 Minutes, embutida em página com contador dinâmico de visualizadores (\"1.482 pessoas assistindo agora\") e selo de Urgência Médica. Teste A/B com 7 versões de VSL (a VSL C lidera).","reframe":"A perda de memória não é envelhecimento natural: é um bloqueio nas sinapses causado pela oxidação acelerada das bainhas neurais.","cta_engajamento":"Criativos (4) e VSLs (7) disponíveis no Google Drive.","cta_venda":"LPs ativas: https://www.facebook.com/reel/1496112178946578 | https://tryneuromemory.com/new-bottle-vsl-06. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/NeuroMemory-3f20ddb38913812ca787c05eada9fffe',
    'https://drive.google.com/file/d/13gyzfHKwoRJbXwLSYFzjP_MVfdQpegx6/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1Dzto3mktR_zeVXScEy-9bA2W5v65XWks/view?usp=sharing', 'https://drive.google.com/file/d/1wGJs07OGSdppkqi1bYl2-tJ1kpKJKbCm/view?usp=sharing', 'https://drive.google.com/file/d/1A2EOy1Dl_A91BW8Qy3hOCpSyNJMhW3qZ/view?usp=sharing', 'https://drive.google.com/file/d/1ZryttxGcr8wSULad8-ABbANvXsWBxUOA/view?usp=sharing', 'https://drive.google.com/file/d/13gyzfHKwoRJbXwLSYFzjP_MVfdQpegx6/view?usp=sharing', 'https://drive.google.com/file/d/1qzgZwYuNZo5571GldeOTU7vVg_wo2GC9/view?usp=sharing', 'https://drive.google.com/file/d/1KfWGn66RWbNUl0tcvOAS7RwN9C-vj8pY/view?usp=sharing', 'https://drive.google.com/file/d/1tEp0aXmB2jYABVYlVnZaod4PR7cB8zg3/view?usp=sharing', 'https://drive.google.com/file/d/1qa4RvmePcMCGecNpmlB2QRxFMOHUzZ0f/view?usp=sharing', 'https://drive.google.com/file/d/1uRxgOPI_i4D4mVxaqBFx3o5_cR_BL1n4/view?usp=sharing', 'https://drive.google.com/file/d/1JYiz4i5qafV9C0B4FF6idSYTGfq0J9K7/view?usp=sharing', 'https://drive.google.com/file/d/10H69jeSuNmIGYAMUArpNNl83hp0TfX0d/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: NeuroMemory

**Nicho:** Memória
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/NeuroMemory-3f20ddb38913812ca787c05eada9fffe)
**Mecanismo Único:** Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Memória
/
NeuroMemory
Crie sua conta gratuita
NeuroMemory
VSL direto na página no formato de reportagem do 60 Minutes ("Sharp Mind at 67"), com contador de pessoas assistindo e alerta de "Important Health Update". São 7 VSLs em teste, e a VSL C aparece com mais frequência, provavelmente performando melhor.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Memória
	
5
	
8k views
	
1
	
7
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01
	
4k
	
29/09
	
▶ Abrir criativo


Criativo 02
	
4k
	
30/09
	
▶ Abrir criativo


Criativo 03
	
5k
	
01/10
	
▶ Abrir criativo


Criativo 04
	
5k
	
02/10
	
▶ Abrir criativo


Criativo 05
	
8k
	
06/10
	
▶ Abrir post
 Páginas
LANDING PAGE
Abrir LP ​
tryneuromemory.com/new-bottle-vsl-06
HTML DA PÁGINA
 Baixar HTML da página (.zip)
 VSLs
▶ Assistir VSL A
▶ Assistir VSL B
▶ Assistir VSL C · aparece mais
▶ Assistir VSL D
▶ Assistir VSL E
▶ Assistir VSL F
▶ Assistir VSL G
 Biblioteca de Anúncios
Ver anúncios ativos ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** "Alerta urgente de saúde neurológica: como manter a mente afiada aos 67 anos sem remédios tarja preta."
- **Público & Dor:** Adultos 60+ e filhos de idosos preocupados com lapsos frequentes de memória e risco de demência.
- **Linha Narrativa:** VSL no formato do clássico telejornal investigativo americano 60 Minutes, embutida em página com contador dinâmico de visualizadores ("1.482 pessoas assistindo agora") e selo de Urgência Médica. Teste A/B com 7 versões de VSL (a VSL C lidera).
- **Virada de Crença / Mecanismo:** A perda de memória não é envelhecimento natural: é um bloqueio nas sinapses causado pela oxidação acelerada das bainhas neurais.
- **Construção da Oferta:** NeuroMemory suplemento nootrópico em cápsulas, kits de 3 e 6 potes com frete rápido.

## 🎬 Criativos Escalados (4 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1Dzto3mktR_zeVXScEy-9bA2W5v65XWks/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1wGJs07OGSdppkqi1bYl2-tJ1kpKJKbCm/view?usp=sharing)
3. [▶ Abrir criativo](https://drive.google.com/file/d/1A2EOy1Dl_A91BW8Qy3hOCpSyNJMhW3qZ/view?usp=sharing)
4. [▶ Abrir criativo](https://drive.google.com/file/d/1ZryttxGcr8wSULad8-ABbANvXsWBxUOA/view?usp=sharing)

## 🌐 Páginas & Funis (2 links)
- [▶ Abrir post](https://www.facebook.com/reel/1496112178946578)
- [Abrir LP](https://tryneuromemory.com/new-bottle-vsl-06)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/10H69jeSuNmIGYAMUArpNNl83hp0TfX0d/view?usp=sharing)

## 📽️ VSLs na Íntegra (7 vídeos)
- ▶️ [▶ Assistir VSL A](https://drive.google.com/file/d/13gyzfHKwoRJbXwLSYFzjP_MVfdQpegx6/view?usp=sharing)
- ▶️ [▶ Assistir VSL B](https://drive.google.com/file/d/1qzgZwYuNZo5571GldeOTU7vVg_wo2GC9/view?usp=sharing)
- ▶️ [▶ Assistir VSL C · aparece mais](https://drive.google.com/file/d/1KfWGn66RWbNUl0tcvOAS7RwN9C-vj8pY/view?usp=sharing)
- ▶️ [▶ Assistir VSL D](https://drive.google.com/file/d/1tEp0aXmB2jYABVYlVnZaod4PR7cB8zg3/view?usp=sharing)
- ▶️ [▶ Assistir VSL E](https://drive.google.com/file/d/1qa4RvmePcMCGecNpmlB2QRxFMOHUzZ0f/view?usp=sharing)
- ▶️ [▶ Assistir VSL F](https://drive.google.com/file/d/1uRxgOPI_i4D4mVxaqBFx3o5_cR_BL1n4/view?usp=sharing)
- ▶️ [▶ Assistir VSL G](https://drive.google.com/file/d/1JYiz4i5qafV9C0B4FF6idSYTGfq0J9K7/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22LP.BENVRAX442.INFO%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Excelente para ofertas cognitivas como **MemoFlow**: aproveite a estrutura "60 Minutes" de jornalismo investigativo e o enquadramento de neuro-proteção com mel e canela.
',
    '{"oferta":"NeuroMemory","nicho":"Memória","notion_url":"https://swiperadar.notion.site/NeuroMemory-3f20ddb38913812ca787c05eada9fffe","mecanismo":"Reportagem investigativa formato 60 Minutes (\"Sharp Mind at 67\") / Alerta de Saúde Urgente para memória","total_criativos":4,"total_vsls":7,"total_lps":2,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1Dzto3mktR_zeVXScEy-9bA2W5v65XWks/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1wGJs07OGSdppkqi1bYl2-tJ1kpKJKbCm/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1A2EOy1Dl_A91BW8Qy3hOCpSyNJMhW3qZ/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1ZryttxGcr8wSULad8-ABbANvXsWBxUOA/view?usp=sharing"}],"paginas":[{"text":"▶ Abrir post","url":"https://www.facebook.com/reel/1496112178946578","parent":"▶ Abrir post"},{"text":"Abrir LP","url":"https://tryneuromemory.com/new-bottle-vsl-06","parent":"Abrir LP ​"}],"vsls":[{"text":"▶ Assistir VSL A","url":"https://drive.google.com/file/d/13gyzfHKwoRJbXwLSYFzjP_MVfdQpegx6/view?usp=sharing"},{"text":"▶ Assistir VSL B","url":"https://drive.google.com/file/d/1qzgZwYuNZo5571GldeOTU7vVg_wo2GC9/view?usp=sharing"},{"text":"▶ Assistir VSL C · aparece mais","url":"https://drive.google.com/file/d/1KfWGn66RWbNUl0tcvOAS7RwN9C-vj8pY/view?usp=sharing"},{"text":"▶ Assistir VSL D","url":"https://drive.google.com/file/d/1tEp0aXmB2jYABVYlVnZaod4PR7cB8zg3/view?usp=sharing"},{"text":"▶ Assistir VSL E","url":"https://drive.google.com/file/d/1qa4RvmePcMCGecNpmlB2QRxFMOHUzZ0f/view?usp=sharing"},{"text":"▶ Assistir VSL F","url":"https://drive.google.com/file/d/1uRxgOPI_i4D4mVxaqBFx3o5_cR_BL1n4/view?usp=sharing"},{"text":"▶ Assistir VSL G","url":"https://drive.google.com/file/d/1JYiz4i5qafV9C0B4FF6idSYTGfq0J9K7/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22LP.BENVRAX442.INFO%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/10H69jeSuNmIGYAMUArpNNl83hp0TfX0d/view?usp=sharing","parent":"Baixar HTML da página (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'NeuroMemory — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1Dzto3mktR_zeVXScEy-9bA2W5v65XWks/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'criativo']::text[],
      'Criativo da oferta escalada NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'NeuroMemory — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1wGJs07OGSdppkqi1bYl2-tJ1kpKJKbCm/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'criativo']::text[],
      'Criativo da oferta escalada NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'NeuroMemory — Criativo 3 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1A2EOy1Dl_A91BW8Qy3hOCpSyNJMhW3qZ/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'criativo']::text[],
      'Criativo da oferta escalada NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'NeuroMemory — Criativo 4 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1ZryttxGcr8wSULad8-ABbANvXsWBxUOA/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'criativo']::text[],
      'Criativo da oferta escalada NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'NeuroMemory — Assistir VSL A',
      'https://drive.google.com/file/d/13gyzfHKwoRJbXwLSYFzjP_MVfdQpegx6/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'vsl']::text[],
      'VSL completa da oferta NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'NeuroMemory — Assistir VSL B',
      'https://drive.google.com/file/d/1qzgZwYuNZo5571GldeOTU7vVg_wo2GC9/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'vsl']::text[],
      'VSL completa da oferta NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'NeuroMemory — Assistir VSL C · aparece mais',
      'https://drive.google.com/file/d/1KfWGn66RWbNUl0tcvOAS7RwN9C-vj8pY/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'vsl']::text[],
      'VSL completa da oferta NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'NeuroMemory — Assistir VSL D',
      'https://drive.google.com/file/d/1tEp0aXmB2jYABVYlVnZaod4PR7cB8zg3/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'vsl']::text[],
      'VSL completa da oferta NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'NeuroMemory — Assistir VSL E',
      'https://drive.google.com/file/d/1qa4RvmePcMCGecNpmlB2QRxFMOHUzZ0f/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'vsl']::text[],
      'VSL completa da oferta NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'NeuroMemory — Assistir VSL F',
      'https://drive.google.com/file/d/1uRxgOPI_i4D4mVxaqBFx3o5_cR_BL1n4/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'vsl']::text[],
      'VSL completa da oferta NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'NeuroMemory — Assistir VSL G',
      'https://drive.google.com/file/d/1JYiz4i5qafV9C0B4FF6idSYTGfq0J9K7/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'vsl']::text[],
      'VSL completa da oferta NeuroMemory (Memória). Mecanismo: Reportagem investigativa formato 60 Minutes ("Sharp Mind at 67") / Alerta de Saúde Urgente para memória',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'NeuroMemory — LP ▶ Abrir post',
      'https://www.facebook.com/reel/1496112178946578',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'landing_page']::text[],
      'Landing page da oferta NeuroMemory (Memória). | ZIP com HTML: https://drive.google.com/file/d/10H69jeSuNmIGYAMUArpNNl83hp0TfX0d/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'NeuroMemory — LP Abrir LP',
      'https://tryneuromemory.com/new-bottle-vsl-06',
      'https://swiperadar.notion.site/image/attachment%3A491c7d2c-cfff-4715-a011-9b2434ebbe6e%3Aneuro-memory-lp-1.png?table=block&id=44943cb9-f1aa-42e1-a8ea-f9c716f27956&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'neuromemory', 'landing_page']::text[],
      'Landing page da oferta NeuroMemory (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'NeuroMemory',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] Vapo Cept (Memória)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Inalação aromaterápica cognitiva via vapor ("Vapo Ritual") para desobstrução das vias olfativo-cerebrais',
    'Memória',
    ARRAY['swiperadar', 'memória', 'vapo-cept', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"\"Por que inalar este vapor botânico por 15 segundos antes de dormir restaura a clareza mental?\"","participacao_ativa":"Homens e mulheres 55+ sentindo névoa mental matinal e esquecimento de nomes e compromissos.","narrativa":"Página no estilo portal de notícias de saúde independente com player de VSL no estilo “60 Minutes” (botão chamativo “Play 60 Minutes”) seguido por seção densa de depoimentos com foto.","reframe":"Os remédios para memória falham porque passam pelo fígado e estômago. O nervo olfativo é a única rota direta para o hipocampo sem barreira hematoencefálica.","cta_engajamento":"Criativos (2) e VSLs (1) disponíveis no Google Drive.","cta_venda":"LPs ativas: https://myworldjournal.org/vpc-pv-vsl01/ | http://myworldjournal.org/vpc-pv-vsl01. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/Vapo-Cept-3f20ddb3891381589880d6156db2ebeb',
    'https://drive.google.com/file/d/1PX1dFgZ-JSsvPh5YWnWMFNBmkkixwvGV/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1ipCc4EkXrRImjSCCW68cavkGKBTbV8Wv/view?usp=sharing', 'https://drive.google.com/file/d/11yRSz6zKzNuhgSbRMs8xwMowwuwtK8Bf/view?usp=sharing', 'https://drive.google.com/file/d/1PX1dFgZ-JSsvPh5YWnWMFNBmkkixwvGV/view?usp=sharing', 'https://drive.google.com/file/d/1UcmkV6sXCt4d5B__7vJJxN5BJLZSeCpH/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: Vapo Cept

**Nicho:** Memória
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/Vapo-Cept-3f20ddb3891381589880d6156db2ebeb)
**Mecanismo Único:** Inalação aromaterápica cognitiva via vapor ("Vapo Ritual") para desobstrução das vias olfativo-cerebrais

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Memória
/
Vapo Cept
Crie sua conta gratuita
Vapo Cept
Página de notícias de saúde com a VSL no formato “60 Minutes” (botão “Play 60 Minutes”) direto na página, seguida de comentários.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Memória
	
2
	
11k views
	
1
	
1
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01
	
11k
	
30/09
	
▶ Abrir criativo


Criativo 02
	
10k
	
02/10
	
▶ Abrir criativo
 Páginas
LANDING PAGE
Abrir LP ​
myworldjournal.org/vpc-pv-vsl01
HTML DA PÁGINA
 Baixar HTML da página (.zip)
 VSLs
▶ Assistir VSL A
 Biblioteca de Anúncios
Ver anúncios ativos ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** "Por que inalar este vapor botânico por 15 segundos antes de dormir restaura a clareza mental?"
- **Público & Dor:** Homens e mulheres 55+ sentindo névoa mental matinal e esquecimento de nomes e compromissos.
- **Linha Narrativa:** Página no estilo portal de notícias de saúde independente com player de VSL no estilo “60 Minutes” (botão chamativo “Play 60 Minutes”) seguido por seção densa de depoimentos com foto.
- **Virada de Crença / Mecanismo:** Os remédios para memória falham porque passam pelo fígado e estômago. O nervo olfativo é a única rota direta para o hipocampo sem barreira hematoencefálica.
- **Construção da Oferta:** Aparelho inalador + blend concentrado de óleos essenciais terapêuticos.

## 🎬 Criativos Escalados (2 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1ipCc4EkXrRImjSCCW68cavkGKBTbV8Wv/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/11yRSz6zKzNuhgSbRMs8xwMowwuwtK8Bf/view?usp=sharing)

## 🌐 Páginas & Funis (2 links)
- [Abrir LP](https://myworldjournal.org/vpc-pv-vsl01/)
- [myworldjournal.org/vpc-pv-vsl01](http://myworldjournal.org/vpc-pv-vsl01)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1UcmkV6sXCt4d5B__7vJJxN5BJLZSeCpH/view?usp=sharing)

## 📽️ VSLs na Íntegra (1 vídeos)
- ▶️ [▶ Assistir VSL A](https://drive.google.com/file/d/1PX1dFgZ-JSsvPh5YWnWMFNBmkkixwvGV/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=1290481110823477)

## 🎯 Como Modelar para o Império HQ
Excelente para ofertas cognitivas como **MemoFlow**: aproveite a estrutura "60 Minutes" de jornalismo investigativo e o enquadramento de neuro-proteção com mel e canela.
',
    '{"oferta":"Vapo Cept","nicho":"Memória","notion_url":"https://swiperadar.notion.site/Vapo-Cept-3f20ddb3891381589880d6156db2ebeb","mecanismo":"Inalação aromaterápica cognitiva via vapor (\"Vapo Ritual\") para desobstrução das vias olfativo-cerebrais","total_criativos":2,"total_vsls":1,"total_lps":2,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1ipCc4EkXrRImjSCCW68cavkGKBTbV8Wv/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/11yRSz6zKzNuhgSbRMs8xwMowwuwtK8Bf/view?usp=sharing"}],"paginas":[{"text":"Abrir LP","url":"https://myworldjournal.org/vpc-pv-vsl01/","parent":"Abrir LP ​"},{"text":"myworldjournal.org/vpc-pv-vsl01","url":"http://myworldjournal.org/vpc-pv-vsl01","parent":"myworldjournal.org/vpc-pv-vsl01"}],"vsls":[{"text":"▶ Assistir VSL A","url":"https://drive.google.com/file/d/1PX1dFgZ-JSsvPh5YWnWMFNBmkkixwvGV/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=1290481110823477"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1UcmkV6sXCt4d5B__7vJJxN5BJLZSeCpH/view?usp=sharing","parent":"Baixar HTML da página (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3A7d9bd0d8-400e-4023-8568-735ddc943042%3Avapocept-lp-1.png?table=block&id=25791c26-284f-4a2f-b083-7575e09a49e2&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A3d5d2828-f079-41c0-a2c5-d792ebc5e944%3Avapocept-lp-2.png?table=block&id=89fdd187-f862-42d0-b09e-740042b737eb&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Vapo Cept — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1ipCc4EkXrRImjSCCW68cavkGKBTbV8Wv/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A7d9bd0d8-400e-4023-8568-735ddc943042%3Avapocept-lp-1.png?table=block&id=25791c26-284f-4a2f-b083-7575e09a49e2&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'vapo-cept', 'criativo']::text[],
      'Criativo da oferta escalada Vapo Cept (Memória). Mecanismo: Inalação aromaterápica cognitiva via vapor ("Vapo Ritual") para desobstrução das vias olfativo-cerebrais',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Vapo Cept',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Vapo Cept — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/11yRSz6zKzNuhgSbRMs8xwMowwuwtK8Bf/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A7d9bd0d8-400e-4023-8568-735ddc943042%3Avapocept-lp-1.png?table=block&id=25791c26-284f-4a2f-b083-7575e09a49e2&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'vapo-cept', 'criativo']::text[],
      'Criativo da oferta escalada Vapo Cept (Memória). Mecanismo: Inalação aromaterápica cognitiva via vapor ("Vapo Ritual") para desobstrução das vias olfativo-cerebrais',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Vapo Cept',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Vapo Cept — Assistir VSL A',
      'https://drive.google.com/file/d/1PX1dFgZ-JSsvPh5YWnWMFNBmkkixwvGV/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A7d9bd0d8-400e-4023-8568-735ddc943042%3Avapocept-lp-1.png?table=block&id=25791c26-284f-4a2f-b083-7575e09a49e2&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'vapo-cept', 'vsl']::text[],
      'VSL completa da oferta Vapo Cept (Memória). Mecanismo: Inalação aromaterápica cognitiva via vapor ("Vapo Ritual") para desobstrução das vias olfativo-cerebrais',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'Vapo Cept',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Vapo Cept — LP Abrir LP',
      'https://myworldjournal.org/vpc-pv-vsl01/',
      'https://swiperadar.notion.site/image/attachment%3A7d9bd0d8-400e-4023-8568-735ddc943042%3Avapocept-lp-1.png?table=block&id=25791c26-284f-4a2f-b083-7575e09a49e2&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'vapo-cept', 'landing_page']::text[],
      'Landing page da oferta Vapo Cept (Memória). | ZIP com HTML: https://drive.google.com/file/d/1UcmkV6sXCt4d5B__7vJJxN5BJLZSeCpH/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Vapo Cept',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Vapo Cept — LP myworldjournal.org/vpc-pv-vsl01',
      'http://myworldjournal.org/vpc-pv-vsl01',
      'https://swiperadar.notion.site/image/attachment%3A3d5d2828-f079-41c0-a2c5-d792ebc5e944%3Avapocept-lp-2.png?table=block&id=89fdd187-f862-42d0-b09e-740042b737eb&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'vapo-cept', 'landing_page']::text[],
      'Landing page da oferta Vapo Cept (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Vapo Cept',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] Golden Brain (Memória)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
    'Memória',
    ARRAY['swiperadar', 'memória', 'golden-brain', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"“Top US Neurologist confirms: Alzheimer’s can be reversed in 45 days with this cinnamon and honey ritual”","participacao_ativa":"Pessoas com histórico familiar de declínio cognitivo e sinais iniciais de esquecimento.","narrativa":"Funil multi-etapa de alta conformidade: Pré-sell de qualificação com pergunta de retenção (“Este vídeo pode sair do ar a qualquer momento. Você concorda em assistir até o fim? Sim/Não”) → Redirecionamento para página CNN Health (Funil A) ou AP News (Funil C).","reframe":"As placas de proteína beta-amiloide acumulam-se no cérebro por deficiência de antioxidantes lipofílicos específicos presentes apenas no mel bruto e na canela do Ceilão.","cta_engajamento":"Criativos (6) e VSLs (3) disponíveis no Google Drive.","cta_venda":"LPs ativas: http://usadailyinsight.com/ | https://zeatrivio.com/enbhlp2/bg/. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/Golden-Brain-3f20ddb3891381b4afd0cfbbe6041d0d',
    'https://drive.google.com/file/d/1tAo01P7KvYWa7QBL6tAkf3MtFTjmDS0c/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1tRKHQZnS75KAv2-rb_C0lnZyBA8rwFUl/view?usp=sharing', 'https://drive.google.com/file/d/1Qmp-d8yR_1h3WMWuMbnbL3vTI0w-eTy9/view?usp=sharing', 'https://drive.google.com/file/d/1qPzmTBcp0SpG_26ehzYJqerv7DezXafW/view?usp=sharing', 'https://drive.google.com/file/d/1HzSGQsZsMXoxxwKpQfq-PG2oJvuOVL_J/view?usp=sharing', 'https://drive.google.com/file/d/1Bc5reIpXTpdB75APQgmyPPa8rvdlweee/view?usp=sharing', 'https://drive.google.com/file/d/1JgghdWAFHUn0a0prt7DEdJLDDb_eGh9e/view?usp=sharing', 'https://drive.google.com/file/d/1tAo01P7KvYWa7QBL6tAkf3MtFTjmDS0c/view?usp=sharing', 'https://drive.google.com/file/d/1IjWAp50cZbKHaDeskVdZREweFFbkfJro/view?usp=sharing', 'https://drive.google.com/file/d/1E7Hnazpfhd6LxtBoLRyskicgbhev68LP/view?usp=sharing', 'https://drive.google.com/file/d/1FLhcRo_Wmw-LNSaRx0N84XTvV1-Zz4Ns/view?usp=sharing', 'https://drive.google.com/file/d/1ijZr3GoINhBir8eh1wtfvxg6p1dB-9iB/view?usp=sharing', 'https://drive.google.com/file/d/1jlMOxwGKwAJKpJBu1Zx3TqTusTCoDwB7/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: Golden Brain

**Nicho:** Memória
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/Golden-Brain-3f20ddb3891381b4afd0cfbbe6041d0d)
**Mecanismo Único:** Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Memória
/
Golden Brain
Crie sua conta gratuita
Golden Brain
Funil com pré-sell de qualificação (“este vídeo pode sair do ar a qualquer momento — Yes/No”) levando à página no estilo CNN Health: “Top US Neurologist confirms: Alzheimer’s can be reversed in 45 days with this cinnamon and honey ritual”, com a VSL direto na página (Funil A). Funil B usa a mesma headline, sem pré-sell, com outra VSL na usadailyinsight.com. Funil C: mesma headline numa página no estilo AP News, com uma terceira VSL.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Memória
	
6
	
17k views
	
Pré-sell + 3 LPs
	
3
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01 · Funil A
	
14k
	
02/10
	
▶ Abrir criativo


Criativo 02 · Funil A
	
17k
	
04/10
	
▶ Abrir criativo


Criativo 03 · Funil B
	
9,2k
	
01/10
	
▶ Abrir criativo


Criativo 04 · Funil B
	
10k
	
01/10
	
▶ Abrir criativo


Criativo 05 · Funil B
	
15k
	
02/10
	
▶ Abrir criativo


Criativo 06 · Funil B
	
5k
	
02/10
	
▶ Abrir criativo
 Páginas
PRÉ-SELL · FUNIL A
Abrir pré-sell ​
zeatrivio.com/enbhlp2/bg
PÁGINA DA VSL · FUNIL A
Abrir página da VSL ​
zeatrivio.com/enbhlp2/bg/lp6.php
HTML DA PÁGINA
 Baixar HTML da página (.zip)
PÁGINA DA VSL · FUNIL B
Abrir página da VSL ​
usadailyinsight.com/mmlow-gol01
HTML DA PÁGINA
 Baixar HTML da página (.zip)
PÁGINA DA VSL · FUNIL C
Domínio: wellness-evidence.com (URL completa ainda não informada)
HTML DA PÁGINA
 Baixar HTML da página (.zip)
 VSLs
▶ Assistir VSL A · Funil A
▶ Assistir VSL B · Funil B
▶ Assistir VSL C · Funil C
 Biblioteca de Anúncios
Ver anúncios ativos · Funil A ​
Ver anúncios ativos · Funil B ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** “Top US Neurologist confirms: Alzheimer’s can be reversed in 45 days with this cinnamon and honey ritual”
- **Público & Dor:** Pessoas com histórico familiar de declínio cognitivo e sinais iniciais de esquecimento.
- **Linha Narrativa:** Funil multi-etapa de alta conformidade: Pré-sell de qualificação com pergunta de retenção (“Este vídeo pode sair do ar a qualquer momento. Você concorda em assistir até o fim? Sim/Não”) → Redirecionamento para página CNN Health (Funil A) ou AP News (Funil C).
- **Virada de Crença / Mecanismo:** As placas de proteína beta-amiloide acumulam-se no cérebro por deficiência de antioxidantes lipofílicos específicos presentes apenas no mel bruto e na canela do Ceilão.
- **Construção da Oferta:** Composto solúvel Golden Brain Elixir com garantia blindada de reembolso.

## 🎬 Criativos Escalados (6 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1tRKHQZnS75KAv2-rb_C0lnZyBA8rwFUl/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1Qmp-d8yR_1h3WMWuMbnbL3vTI0w-eTy9/view?usp=sharing)
3. [▶ Abrir criativo](https://drive.google.com/file/d/1qPzmTBcp0SpG_26ehzYJqerv7DezXafW/view?usp=sharing)
4. [▶ Abrir criativo](https://drive.google.com/file/d/1HzSGQsZsMXoxxwKpQfq-PG2oJvuOVL_J/view?usp=sharing)
5. [▶ Abrir criativo](https://drive.google.com/file/d/1Bc5reIpXTpdB75APQgmyPPa8rvdlweee/view?usp=sharing)
6. [▶ Abrir criativo](https://drive.google.com/file/d/1JgghdWAFHUn0a0prt7DEdJLDDb_eGh9e/view?usp=sharing)

## 🌐 Páginas & Funis (8 links)
- [usadailyinsight.com](http://usadailyinsight.com/)
- [Abrir pré-sell](https://zeatrivio.com/enbhlp2/bg/)
- [zeatrivio.com/enbhlp2/bg](http://zeatrivio.com/enbhlp2/bg)
- [Abrir página da VSL](https://zeatrivio.com/enbhlp2/bg/lp6.php)
- [zeatrivio.com/enbhlp2/bg/lp6.php](http://zeatrivio.com/enbhlp2/bg/lp6.php)
- [Abrir página da VSL](https://usadailyinsight.com/mmlow-gol01/)
- [usadailyinsight.com/mmlow-gol01](http://usadailyinsight.com/mmlow-gol01)
- [wellness-evidence.com](http://wellness-evidence.com/)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1FLhcRo_Wmw-LNSaRx0N84XTvV1-Zz4Ns/view?usp=sharing)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1ijZr3GoINhBir8eh1wtfvxg6p1dB-9iB/view?usp=sharing)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1jlMOxwGKwAJKpJBu1Zx3TqTusTCoDwB7/view?usp=sharing)

## 📽️ VSLs na Íntegra (3 vídeos)
- ▶️ [▶ Assistir VSL A · Funil A](https://drive.google.com/file/d/1tAo01P7KvYWa7QBL6tAkf3MtFTjmDS0c/view?usp=sharing)
- ▶️ [▶ Assistir VSL B · Funil B](https://drive.google.com/file/d/1IjWAp50cZbKHaDeskVdZREweFFbkfJro/view?usp=sharing)
- ▶️ [▶ Assistir VSL C · Funil C](https://drive.google.com/file/d/1E7Hnazpfhd6LxtBoLRyskicgbhev68LP/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos · Funil A](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22ZEATRIVIO.COM%22&search_type=keyword_exact_phrase&sort_data[direction]=desc&sort_data[mode]=total_impressions&source=page-transparency-widget)
- 🔎 [Ver anúncios ativos · Funil B](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=BLOG.BLOGMARCELADANTAS.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Excelente para ofertas cognitivas como **MemoFlow**: aproveite a estrutura "60 Minutes" de jornalismo investigativo e o enquadramento de neuro-proteção com mel e canela.
',
    '{"oferta":"Golden Brain","nicho":"Memória","notion_url":"https://swiperadar.notion.site/Golden-Brain-3f20ddb3891381b4afd0cfbbe6041d0d","mecanismo":"Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No","total_criativos":6,"total_vsls":3,"total_lps":8,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1tRKHQZnS75KAv2-rb_C0lnZyBA8rwFUl/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1Qmp-d8yR_1h3WMWuMbnbL3vTI0w-eTy9/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1qPzmTBcp0SpG_26ehzYJqerv7DezXafW/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1HzSGQsZsMXoxxwKpQfq-PG2oJvuOVL_J/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1Bc5reIpXTpdB75APQgmyPPa8rvdlweee/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1JgghdWAFHUn0a0prt7DEdJLDDb_eGh9e/view?usp=sharing"}],"paginas":[{"text":"usadailyinsight.com","url":"http://usadailyinsight.com/","parent":"Funil com pré-sell de qualificação (“este vídeo pode sair do ar a qualquer momento — Yes/No”) levando à página no estilo CNN Health: “Top US Neurologist confirms: Alzheimer’s can be reversed in 45 days with this cinnamon and honey ritual”, com a VSL direto na página (Funil A). Funil B usa a mesma headline, sem pré-sell, com outra VSL na usadailyinsight.com. Funil C: mesma headline numa página no estilo AP News, com uma terceira VSL."},{"text":"Abrir pré-sell","url":"https://zeatrivio.com/enbhlp2/bg/","parent":"Abrir pré-sell ​"},{"text":"zeatrivio.com/enbhlp2/bg","url":"http://zeatrivio.com/enbhlp2/bg","parent":"zeatrivio.com/enbhlp2/bg"},{"text":"Abrir página da VSL","url":"https://zeatrivio.com/enbhlp2/bg/lp6.php","parent":"Abrir página da VSL ​"},{"text":"zeatrivio.com/enbhlp2/bg/lp6.php","url":"http://zeatrivio.com/enbhlp2/bg/lp6.php","parent":"zeatrivio.com/enbhlp2/bg/lp6.php"},{"text":"Abrir página da VSL","url":"https://usadailyinsight.com/mmlow-gol01/","parent":"Abrir página da VSL ​"},{"text":"usadailyinsight.com/mmlow-gol01","url":"http://usadailyinsight.com/mmlow-gol01","parent":"usadailyinsight.com/mmlow-gol01"},{"text":"wellness-evidence.com","url":"http://wellness-evidence.com/","parent":"Domínio: wellness-evidence.com (URL completa ainda não informada)"}],"vsls":[{"text":"▶ Assistir VSL A · Funil A","url":"https://drive.google.com/file/d/1tAo01P7KvYWa7QBL6tAkf3MtFTjmDS0c/view?usp=sharing"},{"text":"▶ Assistir VSL B · Funil B","url":"https://drive.google.com/file/d/1IjWAp50cZbKHaDeskVdZREweFFbkfJro/view?usp=sharing"},{"text":"▶ Assistir VSL C · Funil C","url":"https://drive.google.com/file/d/1E7Hnazpfhd6LxtBoLRyskicgbhev68LP/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos · Funil A","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22ZEATRIVIO.COM%22&search_type=keyword_exact_phrase&sort_data[direction]=desc&sort_data[mode]=total_impressions&source=page-transparency-widget"},{"text":"Ver anúncios ativos · Funil B","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=BLOG.BLOGMARCELADANTAS.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1FLhcRo_Wmw-LNSaRx0N84XTvV1-Zz4Ns/view?usp=sharing","parent":"Baixar HTML da página (.zip)"},{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1ijZr3GoINhBir8eh1wtfvxg6p1dB-9iB/view?usp=sharing","parent":"Baixar HTML da página (.zip)"},{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1jlMOxwGKwAJKpJBu1Zx3TqTusTCoDwB7/view?usp=sharing","parent":"Baixar HTML da página (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A6af198e6-15d9-49c6-951a-c619fccfed2b%3Agoldenbrain-lp-1.png?table=block&id=6ea740b4-22cb-402f-b2be-5b7c0fbd1b67&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A4038f3a1-07e9-4a47-ad70-e6f8a4e4cf54%3Agoldenbrain-lp-2.png?table=block&id=bf515de6-e66b-4a9f-8d6e-66673890fa21&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3Ace1cf8c4-e8d4-4be1-a35a-03ebc5687f35%3Agoldenbrain-lp-b-1.png?table=block&id=f9822c8c-4b75-4258-bf22-e3eaae99fd6b&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A6002ec2a-8ac2-4a3c-a04b-a805b2dd6c7e%3Agoldenbrain-lp-b-2.png?table=block&id=d0d3c2a6-6779-43d5-bb17-82ddfdc0f74c&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A229a8541-8f18-4089-8d7b-85411f7832e0%3Agoldenbrain-lp-c-1.png?table=block&id=905820cd-d44e-4816-884c-095b6aceede8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A8052e873-d0fd-41a4-b3e1-2ac2ec4c1049%3Agoldenbrain-lp-c-2.png?table=block&id=bd9090a9-9715-400a-88c5-3a9f5e0c733f&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Golden Brain — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1tRKHQZnS75KAv2-rb_C0lnZyBA8rwFUl/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'criativo']::text[],
      'Criativo da oferta escalada Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Golden Brain — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1Qmp-d8yR_1h3WMWuMbnbL3vTI0w-eTy9/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'criativo']::text[],
      'Criativo da oferta escalada Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Golden Brain — Criativo 3 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1qPzmTBcp0SpG_26ehzYJqerv7DezXafW/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'criativo']::text[],
      'Criativo da oferta escalada Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Golden Brain — Criativo 4 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1HzSGQsZsMXoxxwKpQfq-PG2oJvuOVL_J/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'criativo']::text[],
      'Criativo da oferta escalada Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Golden Brain — Criativo 5 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1Bc5reIpXTpdB75APQgmyPPa8rvdlweee/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'criativo']::text[],
      'Criativo da oferta escalada Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Golden Brain — Criativo 6 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1JgghdWAFHUn0a0prt7DEdJLDDb_eGh9e/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'criativo']::text[],
      'Criativo da oferta escalada Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Golden Brain — Assistir VSL A · Funil A',
      'https://drive.google.com/file/d/1tAo01P7KvYWa7QBL6tAkf3MtFTjmDS0c/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'vsl']::text[],
      'VSL completa da oferta Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Golden Brain — Assistir VSL B · Funil B',
      'https://drive.google.com/file/d/1IjWAp50cZbKHaDeskVdZREweFFbkfJro/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'vsl']::text[],
      'VSL completa da oferta Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Golden Brain — Assistir VSL C · Funil C',
      'https://drive.google.com/file/d/1E7Hnazpfhd6LxtBoLRyskicgbhev68LP/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'vsl']::text[],
      'VSL completa da oferta Golden Brain (Memória). Mecanismo: Ritual matinal de canela e mel em 45 dias / Reversão cognitiva / Pré-sell de conformidade Yes-No',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP usadailyinsight.com',
      'http://usadailyinsight.com/',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória). | ZIP com HTML: https://drive.google.com/file/d/1FLhcRo_Wmw-LNSaRx0N84XTvV1-Zz4Ns/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP Abrir pré-sell',
      'https://zeatrivio.com/enbhlp2/bg/',
      'https://swiperadar.notion.site/image/attachment%3A6af198e6-15d9-49c6-951a-c619fccfed2b%3Agoldenbrain-lp-1.png?table=block&id=6ea740b4-22cb-402f-b2be-5b7c0fbd1b67&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória). | ZIP com HTML: https://drive.google.com/file/d/1ijZr3GoINhBir8eh1wtfvxg6p1dB-9iB/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP zeatrivio.com/enbhlp2/bg',
      'http://zeatrivio.com/enbhlp2/bg',
      'https://swiperadar.notion.site/image/attachment%3A4038f3a1-07e9-4a47-ad70-e6f8a4e4cf54%3Agoldenbrain-lp-2.png?table=block&id=bf515de6-e66b-4a9f-8d6e-66673890fa21&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória). | ZIP com HTML: https://drive.google.com/file/d/1jlMOxwGKwAJKpJBu1Zx3TqTusTCoDwB7/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP Abrir página da VSL',
      'https://zeatrivio.com/enbhlp2/bg/lp6.php',
      'https://swiperadar.notion.site/image/attachment%3Ace1cf8c4-e8d4-4be1-a35a-03ebc5687f35%3Agoldenbrain-lp-b-1.png?table=block&id=f9822c8c-4b75-4258-bf22-e3eaae99fd6b&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP zeatrivio.com/enbhlp2/bg/lp6.php',
      'http://zeatrivio.com/enbhlp2/bg/lp6.php',
      'https://swiperadar.notion.site/image/attachment%3A6002ec2a-8ac2-4a3c-a04b-a805b2dd6c7e%3Agoldenbrain-lp-b-2.png?table=block&id=d0d3c2a6-6779-43d5-bb17-82ddfdc0f74c&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP Abrir página da VSL',
      'https://usadailyinsight.com/mmlow-gol01/',
      'https://swiperadar.notion.site/image/attachment%3A229a8541-8f18-4089-8d7b-85411f7832e0%3Agoldenbrain-lp-c-1.png?table=block&id=905820cd-d44e-4816-884c-095b6aceede8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP usadailyinsight.com/mmlow-gol01',
      'http://usadailyinsight.com/mmlow-gol01',
      'https://swiperadar.notion.site/image/attachment%3A8052e873-d0fd-41a4-b3e1-2ac2ec4c1049%3Agoldenbrain-lp-c-2.png?table=block&id=bd9090a9-9715-400a-88c5-3a9f5e0c733f&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Golden Brain — LP wellness-evidence.com',
      'http://wellness-evidence.com/',
      'https://swiperadar.notion.site/image/attachment%3Af3493403-8d5e-4bb7-a606-0cde44a19dd5%3Agoldenbrain-presell.png?table=block&id=c5660ab1-182b-4dd8-8221-83b89a8539f9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'golden-brain', 'landing_page']::text[],
      'Landing page da oferta Golden Brain (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Golden Brain',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] MemoHoney (Memória)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
    'Memória',
    ARRAY['swiperadar', 'memória', 'memohoney', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"“Elon Musk revela o truque do mel com Vicks para perda de memória e demência”","participacao_ativa":"Consumidores de notícias e entusiastas de biohacking e soluções alternativas fora da Big Pharma.","narrativa":"Página layout CNN Health com matéria bombástica ligando celebridades e tecnologia a um remédio caseiro esquecido. Player direto com contador de urgência (“vídeo disponível apenas pelas próximas 3 horas”). Criativo de 131k views no Funil B.","reframe":"A inflamação crônica cerebral desidrata os neurônios; o mentol abre os microvasos enquanto o mel carrega nutrientes reparadores para o córtex.","cta_engajamento":"Criativos (5) e VSLs (2) disponíveis no Google Drive.","cta_venda":"LPs ativas: http://mymemohoney.com/ | https://wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct/. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/MemoHoney-3f10ddb389138109bc0cd0f7af437c43',
    'https://drive.google.com/file/d/1KDpEi9EeBsWGLupKsHYMtX5i3dk8ofrW/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1R4uOLBpLl3NdqMr03NKB4WFA0j9uxaeV/view?usp=sharing', 'https://drive.google.com/file/d/1iYtsSQ21ZYfNzkW4q4SxJV52jIOpkQ1_/view?usp=sharing', 'https://drive.google.com/file/d/1R359h_JJyF4NG5BvQhuRkhLeER4kCDmU/view?usp=sharing', 'https://drive.google.com/file/d/1qF_dGZI5zDPJZBCqM-7sqShTv4xAsEvx/view?usp=sharing', 'https://drive.google.com/file/d/17L5v8wYD26Zex9An8lKk54BQdtsLgkOr/view?usp=sharing', 'https://drive.google.com/file/d/1KDpEi9EeBsWGLupKsHYMtX5i3dk8ofrW/view?usp=sharing', 'https://drive.google.com/file/d/1E7Lqh2wU2k5a9VyRrEHArI9JoMWMQXdi/view?usp=sharing', 'https://drive.google.com/file/d/1nxQQKamR_VspKkThNu0f30t4LfKw8kze/view?usp=sharing', 'https://drive.google.com/file/d/1eYebc_LAPbQurVWE0XOhsMdyfG0KQbpS/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: MemoHoney

**Nicho:** Memória
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/MemoHoney-3f10ddb389138109bc0cd0f7af437c43)
**Mecanismo Único:** Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Memória
/
MemoHoney
Crie sua conta gratuita
MemoHoney
Página no estilo CNN Health: “Elon Musk revela o truque do mel com Vicks para perda de memória e demência”, com a VSL direto na página e aviso de urgência (“vídeo disponível só até…”). Funil B: VSL “Top US Neurologist Confirms: Alzheimer’s can be reversed in 45 days” na mymemohoney.com.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Memória
	
5
	
131k views
	
2
	
2
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01
	
5k
	
02/10
	
▶ Abrir criativo


Criativo 02
	
7k
	
05/10
	
▶ Abrir criativo


Criativo 03
	
33k
	
05/10
	
▶ Abrir criativo


Criativo 04
	
92k
	
06/10
	
▶ Abrir criativo


Criativo 05 · Funil B
	
131k
	
—
	
▶ Abrir criativo
 Páginas
LANDING PAGE A
Abrir LP A ​
wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct
HTML DA PÁGINA
 Baixar HTML da página (.zip)
LANDING PAGE B
Abrir LP B ​
mymemohoney.com/mmh-pv-buy-aff-dep
 Baixar HTML da página B (.zip)
 VSLs
▶ Assistir VSL A · LP A
▶ Assistir VSL B · LP B
 Biblioteca de Anúncios
Ver anúncios ativos ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** “Elon Musk revela o truque do mel com Vicks para perda de memória e demência”
- **Público & Dor:** Consumidores de notícias e entusiastas de biohacking e soluções alternativas fora da Big Pharma.
- **Linha Narrativa:** Página layout CNN Health com matéria bombástica ligando celebridades e tecnologia a um remédio caseiro esquecido. Player direto com contador de urgência (“vídeo disponível apenas pelas próximas 3 horas”). Criativo de 131k views no Funil B.
- **Virada de Crença / Mecanismo:** A inflamação crônica cerebral desidrata os neurônios; o mentol abre os microvasos enquanto o mel carrega nutrientes reparadores para o córtex.
- **Construção da Oferta:** Extrato líquido MemoHoney concentrado para gotejamento diário.

## 🎬 Criativos Escalados (5 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1R4uOLBpLl3NdqMr03NKB4WFA0j9uxaeV/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1iYtsSQ21ZYfNzkW4q4SxJV52jIOpkQ1_/view?usp=sharing)
3. [▶ Abrir criativo](https://drive.google.com/file/d/1R359h_JJyF4NG5BvQhuRkhLeER4kCDmU/view?usp=sharing)
4. [▶ Abrir criativo](https://drive.google.com/file/d/1qF_dGZI5zDPJZBCqM-7sqShTv4xAsEvx/view?usp=sharing)
5. [▶ Abrir criativo](https://drive.google.com/file/d/17L5v8wYD26Zex9An8lKk54BQdtsLgkOr/view?usp=sharing)

## 🌐 Páginas & Funis (5 links)
- [mymemohoney.com](http://mymemohoney.com/)
- [Abrir LP A](https://wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct/)
- [wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct](http://wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct)
- [Abrir LP B](https://mymemohoney.com/mmh-pv-buy-aff-dep/)
- [mymemohoney.com/mmh-pv-buy-aff-dep](http://mymemohoney.com/mmh-pv-buy-aff-dep)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1nxQQKamR_VspKkThNu0f30t4LfKw8kze/view?usp=sharing)
- 📥 [Baixar HTML da página B (.zip)](https://drive.google.com/file/d/1eYebc_LAPbQurVWE0XOhsMdyfG0KQbpS/view?usp=sharing)

## 📽️ VSLs na Íntegra (2 vídeos)
- ▶️ [▶ Assistir VSL A · LP A](https://drive.google.com/file/d/1KDpEi9EeBsWGLupKsHYMtX5i3dk8ofrW/view?usp=sharing)
- ▶️ [▶ Assistir VSL B · LP B](https://drive.google.com/file/d/1E7Lqh2wU2k5a9VyRrEHArI9JoMWMQXdi/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22VITALFLOWCO.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Excelente para ofertas cognitivas como **MemoFlow**: aproveite a estrutura "60 Minutes" de jornalismo investigativo e o enquadramento de neuro-proteção com mel e canela.
',
    '{"oferta":"MemoHoney","nicho":"Memória","notion_url":"https://swiperadar.notion.site/MemoHoney-3f10ddb389138109bc0cd0f7af437c43","mecanismo":"Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios","total_criativos":5,"total_vsls":2,"total_lps":5,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1R4uOLBpLl3NdqMr03NKB4WFA0j9uxaeV/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1iYtsSQ21ZYfNzkW4q4SxJV52jIOpkQ1_/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1R359h_JJyF4NG5BvQhuRkhLeER4kCDmU/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1qF_dGZI5zDPJZBCqM-7sqShTv4xAsEvx/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/17L5v8wYD26Zex9An8lKk54BQdtsLgkOr/view?usp=sharing"}],"paginas":[{"text":"mymemohoney.com","url":"http://mymemohoney.com/","parent":"Página no estilo CNN Health: “Elon Musk revela o truque do mel com Vicks para perda de memória e demência”, com a VSL direto na página e aviso de urgência (“vídeo disponível só até…”). Funil B: VSL “Top US Neurologist Confirms: Alzheimer’s can be reversed in 45 days” na mymemohoney.com."},{"text":"Abrir LP A","url":"https://wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct/","parent":"Abrir LP A ​"},{"text":"wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct","url":"http://wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct","parent":"wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct"},{"text":"Abrir LP B","url":"https://mymemohoney.com/mmh-pv-buy-aff-dep/","parent":"Abrir LP B ​"},{"text":"mymemohoney.com/mmh-pv-buy-aff-dep","url":"http://mymemohoney.com/mmh-pv-buy-aff-dep","parent":"mymemohoney.com/mmh-pv-buy-aff-dep"}],"vsls":[{"text":"▶ Assistir VSL A · LP A","url":"https://drive.google.com/file/d/1KDpEi9EeBsWGLupKsHYMtX5i3dk8ofrW/view?usp=sharing"},{"text":"▶ Assistir VSL B · LP B","url":"https://drive.google.com/file/d/1E7Lqh2wU2k5a9VyRrEHArI9JoMWMQXdi/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22VITALFLOWCO.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1nxQQKamR_VspKkThNu0f30t4LfKw8kze/view?usp=sharing","parent":"Baixar HTML da página (.zip)"},{"text":"Baixar HTML da página B (.zip)","url":"https://drive.google.com/file/d/1eYebc_LAPbQurVWE0XOhsMdyfG0KQbpS/view?usp=sharing","parent":"Baixar HTML da página B (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A121b4f64-7ec7-48f4-8ef2-92fd2e7cdddc%3Amemohoney-lp-2.png?table=block&id=599a0d4f-f2b0-407c-afe0-dd1ab7462beb&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'MemoHoney — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1R4uOLBpLl3NdqMr03NKB4WFA0j9uxaeV/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'criativo']::text[],
      'Criativo da oferta escalada MemoHoney (Memória). Mecanismo: Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'MemoHoney — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1iYtsSQ21ZYfNzkW4q4SxJV52jIOpkQ1_/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'criativo']::text[],
      'Criativo da oferta escalada MemoHoney (Memória). Mecanismo: Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'MemoHoney — Criativo 3 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1R359h_JJyF4NG5BvQhuRkhLeER4kCDmU/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'criativo']::text[],
      'Criativo da oferta escalada MemoHoney (Memória). Mecanismo: Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'MemoHoney — Criativo 4 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1qF_dGZI5zDPJZBCqM-7sqShTv4xAsEvx/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'criativo']::text[],
      'Criativo da oferta escalada MemoHoney (Memória). Mecanismo: Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'MemoHoney — Criativo 5 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/17L5v8wYD26Zex9An8lKk54BQdtsLgkOr/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'criativo']::text[],
      'Criativo da oferta escalada MemoHoney (Memória). Mecanismo: Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'MemoHoney — Assistir VSL A · LP A',
      'https://drive.google.com/file/d/1KDpEi9EeBsWGLupKsHYMtX5i3dk8ofrW/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'vsl']::text[],
      'VSL completa da oferta MemoHoney (Memória). Mecanismo: Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'MemoHoney — Assistir VSL B · LP B',
      'https://drive.google.com/file/d/1E7Lqh2wU2k5a9VyRrEHArI9JoMWMQXdi/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'vsl']::text[],
      'VSL completa da oferta MemoHoney (Memória). Mecanismo: Truque do Mel com Vicks / Elon Musk angle / Ritual de Canela e Mel para regeneração de neurônios',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'MemoHoney — LP mymemohoney.com',
      'http://mymemohoney.com/',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'landing_page']::text[],
      'Landing page da oferta MemoHoney (Memória). | ZIP com HTML: https://drive.google.com/file/d/1nxQQKamR_VspKkThNu0f30t4LfKw8kze/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'MemoHoney — LP Abrir LP A',
      'https://wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct/',
      'https://swiperadar.notion.site/image/attachment%3A121b4f64-7ec7-48f4-8ef2-92fd2e7cdddc%3Amemohoney-lp-2.png?table=block&id=599a0d4f-f2b0-407c-afe0-dd1ab7462beb&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'landing_page']::text[],
      'Landing page da oferta MemoHoney (Memória). | ZIP com HTML: https://drive.google.com/file/d/1eYebc_LAPbQurVWE0XOhsMdyfG0KQbpS/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'MemoHoney — LP wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct',
      'http://wellnessjourneyactive.online/mmh-pv-buy-fb-f308-ml3-ct',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'landing_page']::text[],
      'Landing page da oferta MemoHoney (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'MemoHoney — LP Abrir LP B',
      'https://mymemohoney.com/mmh-pv-buy-aff-dep/',
      'https://swiperadar.notion.site/image/attachment%3A121b4f64-7ec7-48f4-8ef2-92fd2e7cdddc%3Amemohoney-lp-2.png?table=block&id=599a0d4f-f2b0-407c-afe0-dd1ab7462beb&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'landing_page']::text[],
      'Landing page da oferta MemoHoney (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'MemoHoney — LP mymemohoney.com/mmh-pv-buy-aff-dep',
      'http://mymemohoney.com/mmh-pv-buy-aff-dep',
      'https://swiperadar.notion.site/image/attachment%3A4cd3a277-e855-4179-8645-68a68b67bbf1%3Amemohoney-lp-1.png?table=block&id=f7ae48bb-7a31-4ea1-ae4e-fd9bad434392&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memohoney', 'landing_page']::text[],
      'Landing page da oferta MemoHoney (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'MemoHoney',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] Memo Matrix (Memória)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã',
    'Memória',
    ARRAY['swiperadar', 'memória', 'memo-matrix', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"\"Dois itens inocentes que você come no café da manhã estão destruindo a sua memória sem você perceber.\"","participacao_ativa":"Pessoas maduras que tomam café tradicional e sentem cansaço mental e esquecimento durante o dia.","narrativa":"Página estilo CNN Health explorando a zona azul da Sardenha (onde centenários mantêm memória fotográfica). Três LPs e 3 VSLs distintas testadas na mesma campanha.","reframe":"Alimentos industrializados oxidam o hipocampo, mas o néctar das abelhas da Sardenha contém compostos fenólicos raros que revertem os danos em 45 dias.","cta_engajamento":"Criativos (1) e VSLs (3) disponíveis no Google Drive.","cta_venda":"LPs ativas: https://fluffyjello.online/sardinianhoneyfb/ | http://fluffyjello.online/sardinianhoneyfb. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/Memo-Matrix-3f10ddb389138182ac18f5ace4a7bb52',
    'https://drive.google.com/file/d/1Cx6Qct5Ktxo0_1Qkq5ViaseEqoAju406/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1fY9oueDiInKRmVLSdTq-tKYn2cTbW1hv/view?usp=sharing', 'https://drive.google.com/file/d/1Cx6Qct5Ktxo0_1Qkq5ViaseEqoAju406/view?usp=sharing', 'https://drive.google.com/file/d/1oVS_-S0HmxSwc_t5qaNF0KPU2_x24E3f/view?usp=sharing', 'https://drive.google.com/file/d/1lCUXaMOBFw36RBFE-TbXwK4cu4i18Xks/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: Memo Matrix

**Nicho:** Memória
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/Memo-Matrix-3f10ddb389138182ac18f5ace4a7bb52)
**Mecanismo Único:** Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Memória
/
Memo Matrix
Crie sua conta gratuita
Memo Matrix
Páginas no estilo CNN Health com mecanismo de mel ("sardinian honey"). Três LPs testadas na mesma campanha, cada uma com sua VSL: A ("dois itens do café da manhã ligados à perda de memória"), B e C (mesma headline: "Alzheimer revertido em 45 dias com ritual de canela e mel").
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Memória
	
1
	
1,6k views
	
3
	
3
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01
	
1,6k
	
05/10
	
▶ Abrir criativo
 Páginas
LANDING PAGE A
Abrir LP A ​
fluffyjello.online/sardinianhoneyfb · VSL A
HTML DA PÁGINA
Ainda não disponível
LANDING PAGE B
Abrir LP B ​
fluffyjello.online/vhci-l2 · VSL B
HTML DA PÁGINA
Ainda não disponível
LANDING PAGE C
Abrir LP C ​
fluffyjello.online/vhci-l3 · VSL C · mesma headline da LP B (ver prints acima)
 VSLs
▶ Assistir VSL A · LP A
▶ Assistir VSL B · LP B
▶ Assistir VSL C · LP C
 Biblioteca de Anúncios
Ver anúncios ativos ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** "Dois itens inocentes que você come no café da manhã estão destruindo a sua memória sem você perceber."
- **Público & Dor:** Pessoas maduras que tomam café tradicional e sentem cansaço mental e esquecimento durante o dia.
- **Linha Narrativa:** Página estilo CNN Health explorando a zona azul da Sardenha (onde centenários mantêm memória fotográfica). Três LPs e 3 VSLs distintas testadas na mesma campanha.
- **Virada de Crença / Mecanismo:** Alimentos industrializados oxidam o hipocampo, mas o néctar das abelhas da Sardenha contém compostos fenólicos raros que revertem os danos em 45 dias.
- **Construção da Oferta:** Suplemento em gotas Memo Matrix com desconto progressivo por quantidade.

## 🎬 Criativos Escalados (1 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1fY9oueDiInKRmVLSdTq-tKYn2cTbW1hv/view?usp=sharing)

## 🌐 Páginas & Funis (6 links)
- [Abrir LP A](https://fluffyjello.online/sardinianhoneyfb/)
- [fluffyjello.online/sardinianhoneyfb](http://fluffyjello.online/sardinianhoneyfb)
- [Abrir LP B](https://fluffyjello.online/vhci-l2/)
- [fluffyjello.online/vhci-l2](http://fluffyjello.online/vhci-l2)
- [Abrir LP C](https://fluffyjello.online/vhci-l3/)
- [fluffyjello.online/vhci-l3](http://fluffyjello.online/vhci-l3)

## 📽️ VSLs na Íntegra (3 vídeos)
- ▶️ [▶ Assistir VSL A · LP A](https://drive.google.com/file/d/1Cx6Qct5Ktxo0_1Qkq5ViaseEqoAju406/view?usp=sharing)
- ▶️ [▶ Assistir VSL B · LP B](https://drive.google.com/file/d/1oVS_-S0HmxSwc_t5qaNF0KPU2_x24E3f/view?usp=sharing)
- ▶️ [▶ Assistir VSL C · LP C](https://drive.google.com/file/d/1lCUXaMOBFw36RBFE-TbXwK4cu4i18Xks/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=JJ.THEFLUFFYJELLO.ONLINE&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Excelente para ofertas cognitivas como **MemoFlow**: aproveite a estrutura "60 Minutes" de jornalismo investigativo e o enquadramento de neuro-proteção com mel e canela.
',
    '{"oferta":"Memo Matrix","nicho":"Memória","notion_url":"https://swiperadar.notion.site/Memo-Matrix-3f10ddb389138182ac18f5ace4a7bb52","mecanismo":"Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã","total_criativos":1,"total_vsls":3,"total_lps":6,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1fY9oueDiInKRmVLSdTq-tKYn2cTbW1hv/view?usp=sharing"}],"paginas":[{"text":"Abrir LP A","url":"https://fluffyjello.online/sardinianhoneyfb/","parent":"Abrir LP A ​"},{"text":"fluffyjello.online/sardinianhoneyfb","url":"http://fluffyjello.online/sardinianhoneyfb","parent":"fluffyjello.online/sardinianhoneyfb · VSL A"},{"text":"Abrir LP B","url":"https://fluffyjello.online/vhci-l2/","parent":"Abrir LP B ​"},{"text":"fluffyjello.online/vhci-l2","url":"http://fluffyjello.online/vhci-l2","parent":"fluffyjello.online/vhci-l2 · VSL B"},{"text":"Abrir LP C","url":"https://fluffyjello.online/vhci-l3/","parent":"Abrir LP C ​"},{"text":"fluffyjello.online/vhci-l3","url":"http://fluffyjello.online/vhci-l3","parent":"fluffyjello.online/vhci-l3 · VSL C · mesma headline da LP B (ver prints acima)"}],"vsls":[{"text":"▶ Assistir VSL A · LP A","url":"https://drive.google.com/file/d/1Cx6Qct5Ktxo0_1Qkq5ViaseEqoAju406/view?usp=sharing"},{"text":"▶ Assistir VSL B · LP B","url":"https://drive.google.com/file/d/1oVS_-S0HmxSwc_t5qaNF0KPU2_x24E3f/view?usp=sharing"},{"text":"▶ Assistir VSL C · LP C","url":"https://drive.google.com/file/d/1lCUXaMOBFw36RBFE-TbXwK4cu4i18Xks/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=JJ.THEFLUFFYJELLO.ONLINE&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[],"prints":["https://swiperadar.notion.site/image/attachment%3Aa9884e54-2079-4fda-b83c-9d5fb3f7adc1%3Amemomatrix-lp-a-1.png?table=block&id=032d1999-116d-4904-a65e-70ded700ca57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A29610a0a-ce6b-4edc-8302-4316afdc1f5e%3Amemomatrix-lp-a-2.png?table=block&id=769bb7ed-9732-4833-bdd5-548856c89b57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A6ffe437a-3c13-48d9-8b16-7f1946e18e94%3Amemomatrix-lp-b-1.png?table=block&id=d99b8aa7-7b0f-4cae-93bb-525297cfdf01&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A93f826d0-fbd9-4bef-840b-186a9fb1d695%3Amemomatrix-lp-b-2.png?table=block&id=1bf02476-477b-4a6d-832e-fc9802d008e9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Memo Matrix — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1fY9oueDiInKRmVLSdTq-tKYn2cTbW1hv/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Aa9884e54-2079-4fda-b83c-9d5fb3f7adc1%3Amemomatrix-lp-a-1.png?table=block&id=032d1999-116d-4904-a65e-70ded700ca57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'criativo']::text[],
      'Criativo da oferta escalada Memo Matrix (Memória). Mecanismo: Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã',
      9,
      'Meta Ads',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Memo Matrix — Assistir VSL A · LP A',
      'https://drive.google.com/file/d/1Cx6Qct5Ktxo0_1Qkq5ViaseEqoAju406/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Aa9884e54-2079-4fda-b83c-9d5fb3f7adc1%3Amemomatrix-lp-a-1.png?table=block&id=032d1999-116d-4904-a65e-70ded700ca57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'vsl']::text[],
      'VSL completa da oferta Memo Matrix (Memória). Mecanismo: Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Memo Matrix — Assistir VSL B · LP B',
      'https://drive.google.com/file/d/1oVS_-S0HmxSwc_t5qaNF0KPU2_x24E3f/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Aa9884e54-2079-4fda-b83c-9d5fb3f7adc1%3Amemomatrix-lp-a-1.png?table=block&id=032d1999-116d-4904-a65e-70ded700ca57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'vsl']::text[],
      'VSL completa da oferta Memo Matrix (Memória). Mecanismo: Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Memo Matrix — Assistir VSL C · LP C',
      'https://drive.google.com/file/d/1lCUXaMOBFw36RBFE-TbXwK4cu4i18Xks/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Aa9884e54-2079-4fda-b83c-9d5fb3f7adc1%3Amemomatrix-lp-a-1.png?table=block&id=032d1999-116d-4904-a65e-70ded700ca57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'vsl']::text[],
      'VSL completa da oferta Memo Matrix (Memória). Mecanismo: Mel Raro da Sardenha (Sardinian Honey Secret) / Revelação dos 2 vilões do café da manhã',
      10,
      'Drive / VSL',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Memo Matrix — LP Abrir LP A',
      'https://fluffyjello.online/sardinianhoneyfb/',
      'https://swiperadar.notion.site/image/attachment%3Aa9884e54-2079-4fda-b83c-9d5fb3f7adc1%3Amemomatrix-lp-a-1.png?table=block&id=032d1999-116d-4904-a65e-70ded700ca57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'landing_page']::text[],
      'Landing page da oferta Memo Matrix (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Memo Matrix — LP fluffyjello.online/sardinianhoneyfb',
      'http://fluffyjello.online/sardinianhoneyfb',
      'https://swiperadar.notion.site/image/attachment%3A29610a0a-ce6b-4edc-8302-4316afdc1f5e%3Amemomatrix-lp-a-2.png?table=block&id=769bb7ed-9732-4833-bdd5-548856c89b57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'landing_page']::text[],
      'Landing page da oferta Memo Matrix (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Memo Matrix — LP Abrir LP B',
      'https://fluffyjello.online/vhci-l2/',
      'https://swiperadar.notion.site/image/attachment%3A6ffe437a-3c13-48d9-8b16-7f1946e18e94%3Amemomatrix-lp-b-1.png?table=block&id=d99b8aa7-7b0f-4cae-93bb-525297cfdf01&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'landing_page']::text[],
      'Landing page da oferta Memo Matrix (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Memo Matrix — LP fluffyjello.online/vhci-l2',
      'http://fluffyjello.online/vhci-l2',
      'https://swiperadar.notion.site/image/attachment%3A93f826d0-fbd9-4bef-840b-186a9fb1d695%3Amemomatrix-lp-b-2.png?table=block&id=1bf02476-477b-4a6d-832e-fc9802d008e9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'landing_page']::text[],
      'Landing page da oferta Memo Matrix (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Memo Matrix — LP Abrir LP C',
      'https://fluffyjello.online/vhci-l3/',
      'https://swiperadar.notion.site/image/attachment%3Aa9884e54-2079-4fda-b83c-9d5fb3f7adc1%3Amemomatrix-lp-a-1.png?table=block&id=032d1999-116d-4904-a65e-70ded700ca57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'landing_page']::text[],
      'Landing page da oferta Memo Matrix (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Memo Matrix — LP fluffyjello.online/vhci-l3',
      'http://fluffyjello.online/vhci-l3',
      'https://swiperadar.notion.site/image/attachment%3A29610a0a-ce6b-4edc-8302-4316afdc1f5e%3Amemomatrix-lp-a-2.png?table=block&id=769bb7ed-9732-4833-bdd5-548856c89b57&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'memória', 'memo-matrix', 'landing_page']::text[],
      'Landing page da oferta Memo Matrix (Memória).',
      9,
      'Web',
      'SwipeRadar — Memória',
      'Memo Matrix',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] Sugar Balance (Diabetes)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Pancreatic Sludge (Lodo Pancreático) / Fórmula rara com mel para dissolver acúmulo tóxico no pâncreas',
    'Diabetes',
    ARRAY['swiperadar', 'diabetes', 'sugar-balance', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"“Médicos achavam que o tipo 2 era permanente… até a descoberta do ‘Pancreatic Sludge’!”","participacao_ativa":"Diabéticos tipo 2 e pré-diabéticos cansados de picadas diárias, metformina e restrições alimentares severas.","narrativa":"Página com VSL direta revelando que o diabetes tipo 2 não é um problema hereditário, mas mecânico: o canal pancreático fica entupido com \"lodo glicêmico\". Criativos escalados com mais de 97k views no Meta Ads.","reframe":"Quando você dissolve o lodo pancreático com nutrientes específicos, o pâncreas volta a secretar insulina natural em questão de semanas.","cta_engajamento":"Criativos (2) e VSLs (1) disponíveis no Google Drive.","cta_venda":"LPs ativas: https://hub.officialaccess.site/d24-sb-en-11 | http://hub.officialaccess.site/d24-sb-en-11. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/Sugar-Balance-3f20ddb38913818e9f7ef7e88a7fc40c',
    'https://drive.google.com/file/d/1jcbRgenErjLDM4iJcwsYvzJoS3y_6Uw1/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/11AisISSu8RmIvfLjnpBXUs31yOP7aKWh/view?usp=sharing', 'https://drive.google.com/file/d/1owIkSjh7nQbdlYU-i1rSGSkBkCUB9SVT/view?usp=sharing', 'https://drive.google.com/file/d/1jcbRgenErjLDM4iJcwsYvzJoS3y_6Uw1/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: Sugar Balance

**Nicho:** Diabetes
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/Sugar-Balance-3f20ddb38913818e9f7ef7e88a7fc40c)
**Mecanismo Único:** Pancreatic Sludge (Lodo Pancreático) / Fórmula rara com mel para dissolver acúmulo tóxico no pâncreas

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Diabetes
/
Sugar Balance
Crie sua conta gratuita
Sugar Balance
“Médicos achavam que o tipo 2 era permanente… até a descoberta do ‘Pancreatic Sludge’”: fórmula rara com mel para equilibrar o açúcar no sangue, com a VSL direto na página. Criativos com até 97k views.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Diabetes
	
2
	
97k views
	
1
	
1
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01 · Funil A
	
97k
	
25/09
	
▶ Abrir criativo


Criativo 02 · Funil A
	
22k
	
06/10
	
▶ Abrir criativo
 Páginas
LANDING PAGE A
Abrir LP A ​
hub.officialaccess.site/d24-sb-en-11
HTML DA PÁGINA
Ainda não disponível
Topo da LP A com a VSL
Parte de baixo da LP A
 VSLs
▶ Assistir VSL A · Funil A
 Biblioteca de Anúncios
Ver anúncios ativos · Funil A ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** “Médicos achavam que o tipo 2 era permanente… até a descoberta do ‘Pancreatic Sludge’!”
- **Público & Dor:** Diabéticos tipo 2 e pré-diabéticos cansados de picadas diárias, metformina e restrições alimentares severas.
- **Linha Narrativa:** Página com VSL direta revelando que o diabetes tipo 2 não é um problema hereditário, mas mecânico: o canal pancreático fica entupido com "lodo glicêmico". Criativos escalados com mais de 97k views no Meta Ads.
- **Virada de Crença / Mecanismo:** Quando você dissolve o lodo pancreático com nutrientes específicos, o pâncreas volta a secretar insulina natural em questão de semanas.
- **Construção da Oferta:** Sugar Balance frascos com fórmula líquida de absorção sublingual rápida.

## 🎬 Criativos Escalados (2 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/11AisISSu8RmIvfLjnpBXUs31yOP7aKWh/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1owIkSjh7nQbdlYU-i1rSGSkBkCUB9SVT/view?usp=sharing)

## 🌐 Páginas & Funis (2 links)
- [Abrir LP A](https://hub.officialaccess.site/d24-sb-en-11)
- [hub.officialaccess.site/d24-sb-en-11](http://hub.officialaccess.site/d24-sb-en-11)

## 📽️ VSLs na Íntegra (1 vídeos)
- ▶️ [▶ Assistir VSL A · Funil A](https://drive.google.com/file/d/1jcbRgenErjLDM4iJcwsYvzJoS3y_6Uw1/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos · Funil A](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22HUB.OFFICIALACCESS.SITE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Perfeito para ofertas de metabolismo e glicemia como **CardioFlush / Cinna-Shield**: o mecanismo do lodo/parasita é altamente persuasivo e transfere a culpa da fraqueza para um agente invasor palpável.
',
    '{"oferta":"Sugar Balance","nicho":"Diabetes","notion_url":"https://swiperadar.notion.site/Sugar-Balance-3f20ddb38913818e9f7ef7e88a7fc40c","mecanismo":"Pancreatic Sludge (Lodo Pancreático) / Fórmula rara com mel para dissolver acúmulo tóxico no pâncreas","total_criativos":2,"total_vsls":1,"total_lps":2,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/11AisISSu8RmIvfLjnpBXUs31yOP7aKWh/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1owIkSjh7nQbdlYU-i1rSGSkBkCUB9SVT/view?usp=sharing"}],"paginas":[{"text":"Abrir LP A","url":"https://hub.officialaccess.site/d24-sb-en-11","parent":"Abrir LP A ​"},{"text":"hub.officialaccess.site/d24-sb-en-11","url":"http://hub.officialaccess.site/d24-sb-en-11","parent":"hub.officialaccess.site/d24-sb-en-11"}],"vsls":[{"text":"▶ Assistir VSL A · Funil A","url":"https://drive.google.com/file/d/1jcbRgenErjLDM4iJcwsYvzJoS3y_6Uw1/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos · Funil A","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22HUB.OFFICIALACCESS.SITE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[],"prints":["https://swiperadar.notion.site/image/attachment%3A2eca539c-3120-430a-9058-f8b2a33a2b7e%3Asugarbalance-lp-a-1.png?table=block&id=d188e0c3-9588-4c20-b8bb-c70deaa38111&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A378ce89e-0d8a-4459-b6b0-91a97f9851af%3Asugarbalance-lp-a-2.png?table=block&id=bc6b4ecb-2539-4966-b07e-26b9d168c5b9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Sugar Balance — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/11AisISSu8RmIvfLjnpBXUs31yOP7aKWh/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A2eca539c-3120-430a-9058-f8b2a33a2b7e%3Asugarbalance-lp-a-1.png?table=block&id=d188e0c3-9588-4c20-b8bb-c70deaa38111&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'sugar-balance', 'criativo']::text[],
      'Criativo da oferta escalada Sugar Balance (Diabetes). Mecanismo: Pancreatic Sludge (Lodo Pancreático) / Fórmula rara com mel para dissolver acúmulo tóxico no pâncreas',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'Sugar Balance',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Sugar Balance — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1owIkSjh7nQbdlYU-i1rSGSkBkCUB9SVT/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A2eca539c-3120-430a-9058-f8b2a33a2b7e%3Asugarbalance-lp-a-1.png?table=block&id=d188e0c3-9588-4c20-b8bb-c70deaa38111&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'sugar-balance', 'criativo']::text[],
      'Criativo da oferta escalada Sugar Balance (Diabetes). Mecanismo: Pancreatic Sludge (Lodo Pancreático) / Fórmula rara com mel para dissolver acúmulo tóxico no pâncreas',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'Sugar Balance',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Sugar Balance — Assistir VSL A · Funil A',
      'https://drive.google.com/file/d/1jcbRgenErjLDM4iJcwsYvzJoS3y_6Uw1/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A2eca539c-3120-430a-9058-f8b2a33a2b7e%3Asugarbalance-lp-a-1.png?table=block&id=d188e0c3-9588-4c20-b8bb-c70deaa38111&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'sugar-balance', 'vsl']::text[],
      'VSL completa da oferta Sugar Balance (Diabetes). Mecanismo: Pancreatic Sludge (Lodo Pancreático) / Fórmula rara com mel para dissolver acúmulo tóxico no pâncreas',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'Sugar Balance',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Sugar Balance — LP Abrir LP A',
      'https://hub.officialaccess.site/d24-sb-en-11',
      'https://swiperadar.notion.site/image/attachment%3A2eca539c-3120-430a-9058-f8b2a33a2b7e%3Asugarbalance-lp-a-1.png?table=block&id=d188e0c3-9588-4c20-b8bb-c70deaa38111&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'sugar-balance', 'landing_page']::text[],
      'Landing page da oferta Sugar Balance (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'Sugar Balance',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Sugar Balance — LP hub.officialaccess.site/d24-sb-en-11',
      'http://hub.officialaccess.site/d24-sb-en-11',
      'https://swiperadar.notion.site/image/attachment%3A378ce89e-0d8a-4459-b6b0-91a97f9851af%3Asugarbalance-lp-a-2.png?table=block&id=bc6b4ecb-2539-4966-b07e-26b9d168c5b9&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'sugar-balance', 'landing_page']::text[],
      'Landing page da oferta Sugar Balance (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'Sugar Balance',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] GlycoZen (Diabetes)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada',
    'Diabetes',
    ARRAY['swiperadar', 'diabetes', 'glycozen', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"“Esse ritual matinal de 20 segundos elimina o parasita que destrói o pâncreas e reverte o tipo 2 em 21 dias?”","participacao_ativa":"Homens e mulheres com glicemia acima de 140 que sentem cansaço crônico, visão turva e formigamento nos pés.","narrativa":"Dois funis testados em grande escala: Funil A com assinatura de autoridade médica (Dr. Sanjay Gupta em estilo CNN Health); Funil B no estilo CBS News ligando o mecanismo a uma \"bebida milenar mencionada na Bíblia\".","reframe":"A causa oculta do diabetes é um parasita microscópico que se aloja nos tecidos pancreáticos e consome a insulina antes de chegar ao sangue.","cta_engajamento":"Criativos (3) e VSLs (1) disponíveis no Google Drive.","cta_venda":"LPs ativas: http://firstminutejournal.com/ | https://wellness-evidence.com/glycozen_bg/vsl01_l3_236/. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/GlycoZen-3f20ddb3891381bda9d9e27661306080',
    'https://drive.google.com/file/d/1kXgv30EQCsbjfzXk3KTh1XnhMBmsj90b/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1Ls797vhZ0-inkRDXqk0hMbB_vPdZqala/view?usp=sharing', 'https://drive.google.com/file/d/1bpdLV_HD4mkhv1Qr4xiXAf1QbU6OoD3Z/view?usp=sharing', 'https://drive.google.com/file/d/1jc27gu_GZN0pJ6b4xCULwmx_W66ynR5U/view?usp=sharing', 'https://drive.google.com/file/d/1kXgv30EQCsbjfzXk3KTh1XnhMBmsj90b/view?usp=sharing', 'https://drive.google.com/file/d/1muWWWMYVI8WrQoYzNb44taL83mdjeSZv/view?usp=sharing', 'https://drive.google.com/file/d/1Hqw8MYtMxHLtJ73s2bstTWyzMfE7aFZz/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: GlycoZen

**Nicho:** Diabetes
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/GlycoZen-3f20ddb3891381bda9d9e27661306080)
**Mecanismo Único:** Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Diabetes
/
GlycoZen
Crie sua conta gratuita
GlycoZen
Página no estilo CNN Health assinada pelo “Dr. Sanjay Gupta”: “esse ritual matinal de 20 segundos elimina o parasita que destrói o pâncreas e reverte o tipo 2 em 21 dias?”, com a VSL logo abaixo. Funil B usa a mesma VSL numa página diferente (estilo CBS News, “bebida bíblica”) na firstminutejournal.com.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Diabetes
	
3
	
21k views
	
2
	
1 (mesma nos 2 funis)
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01 · Funil A
	
3k
	
30/09
	
▶ Abrir criativo


Criativo 02 · Funis A e B
	
21k
	
01/10
	
▶ Abrir criativo


Criativo 03 · Funil A
	
5k
	
02/10
	
▶ Abrir criativo
 Páginas
LANDING PAGE A
Abrir LP A ​
wellness-evidence.com/glycozen_bg/vsl01_l3_236
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP A
Comentários da LP A
LANDING PAGE B
Abrir LP B ​
firstminutejournal.com/db-bh-ml1G · mesma VSL do Funil A
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP B
Comentários da LP B
 VSLs
▶ Assistir VSL A · mesma VSL nos Funis A e B
 Biblioteca de Anúncios
Ver anúncios ativos · Funil A ​
Ver anúncios ativos · Funil B ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** “Esse ritual matinal de 20 segundos elimina o parasita que destrói o pâncreas e reverte o tipo 2 em 21 dias?”
- **Público & Dor:** Homens e mulheres com glicemia acima de 140 que sentem cansaço crônico, visão turva e formigamento nos pés.
- **Linha Narrativa:** Dois funis testados em grande escala: Funil A com assinatura de autoridade médica (Dr. Sanjay Gupta em estilo CNN Health); Funil B no estilo CBS News ligando o mecanismo a uma "bebida milenar mencionada na Bíblia".
- **Virada de Crença / Mecanismo:** A causa oculta do diabetes é um parasita microscópico que se aloja nos tecidos pancreáticos e consome a insulina antes de chegar ao sangue.
- **Construção da Oferta:** GlycoZen kits de 2, 3 e 6 potes com bônus digitais exclusivos de receitas anti-glicêmicas.

## 🎬 Criativos Escalados (3 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1Ls797vhZ0-inkRDXqk0hMbB_vPdZqala/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1bpdLV_HD4mkhv1Qr4xiXAf1QbU6OoD3Z/view?usp=sharing)
3. [▶ Abrir criativo](https://drive.google.com/file/d/1jc27gu_GZN0pJ6b4xCULwmx_W66ynR5U/view?usp=sharing)

## 🌐 Páginas & Funis (5 links)
- [firstminutejournal.com](http://firstminutejournal.com/)
- [Abrir LP A](https://wellness-evidence.com/glycozen_bg/vsl01_l3_236/)
- [wellness-evidence.com/glycozen_bg/vsl01_l3_236](http://wellness-evidence.com/glycozen_bg/vsl01_l3_236)
- [Abrir LP B](https://firstminutejournal.com/db-bh-ml1G/)
- [firstminutejournal.com/db-bh-ml1G](http://firstminutejournal.com/db-bh-ml1G)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1muWWWMYVI8WrQoYzNb44taL83mdjeSZv/view?usp=sharing)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1Hqw8MYtMxHLtJ73s2bstTWyzMfE7aFZz/view?usp=sharing)

## 📽️ VSLs na Íntegra (1 vídeos)
- ▶️ [▶ Assistir VSL A · mesma VSL nos Funis A e B](https://drive.google.com/file/d/1kXgv30EQCsbjfzXk3KTh1XnhMBmsj90b/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos · Funil A](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=1243696168835214)
- 🔎 [Ver anúncios ativos · Funil B](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=NEWS.INDEPENDENTUPDATES.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Perfeito para ofertas de metabolismo e glicemia como **CardioFlush / Cinna-Shield**: o mecanismo do lodo/parasita é altamente persuasivo e transfere a culpa da fraqueza para um agente invasor palpável.
',
    '{"oferta":"GlycoZen","nicho":"Diabetes","notion_url":"https://swiperadar.notion.site/GlycoZen-3f20ddb3891381bda9d9e27661306080","mecanismo":"Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada","total_criativos":3,"total_vsls":1,"total_lps":5,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1Ls797vhZ0-inkRDXqk0hMbB_vPdZqala/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1bpdLV_HD4mkhv1Qr4xiXAf1QbU6OoD3Z/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1jc27gu_GZN0pJ6b4xCULwmx_W66ynR5U/view?usp=sharing"}],"paginas":[{"text":"firstminutejournal.com","url":"http://firstminutejournal.com/","parent":"Página no estilo CNN Health assinada pelo “Dr. Sanjay Gupta”: “esse ritual matinal de 20 segundos elimina o parasita que destrói o pâncreas e reverte o tipo 2 em 21 dias?”, com a VSL logo abaixo. Funil B usa a mesma VSL numa página diferente (estilo CBS News, “bebida bíblica”) na firstminutejournal.com."},{"text":"Abrir LP A","url":"https://wellness-evidence.com/glycozen_bg/vsl01_l3_236/","parent":"Abrir LP A ​"},{"text":"wellness-evidence.com/glycozen_bg/vsl01_l3_236","url":"http://wellness-evidence.com/glycozen_bg/vsl01_l3_236","parent":"wellness-evidence.com/glycozen_bg/vsl01_l3_236"},{"text":"Abrir LP B","url":"https://firstminutejournal.com/db-bh-ml1G/","parent":"Abrir LP B ​"},{"text":"firstminutejournal.com/db-bh-ml1G","url":"http://firstminutejournal.com/db-bh-ml1G","parent":"firstminutejournal.com/db-bh-ml1G · mesma VSL do Funil A"}],"vsls":[{"text":"▶ Assistir VSL A · mesma VSL nos Funis A e B","url":"https://drive.google.com/file/d/1kXgv30EQCsbjfzXk3KTh1XnhMBmsj90b/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos · Funil A","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=1243696168835214"},{"text":"Ver anúncios ativos · Funil B","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=NEWS.INDEPENDENTUPDATES.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1muWWWMYVI8WrQoYzNb44taL83mdjeSZv/view?usp=sharing","parent":"Baixar HTML da página (.zip)"},{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1Hqw8MYtMxHLtJ73s2bstTWyzMfE7aFZz/view?usp=sharing","parent":"Baixar HTML da página (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3A57aa80b2-64fb-473e-bcdb-177bbc400cf8%3Aglycozen-lp-a-1.png?table=block&id=2f9dfc7e-2f21-42a9-b780-b1b340b2f820&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A46d9ae75-6841-460b-84f3-590335158d29%3Aglycozen-lp-a-2.png?table=block&id=4ddce463-131a-4634-9037-b399052cfbba&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A62bb7511-546e-48d9-911b-4441abef5233%3Aglycozen-lp-b-1.png?table=block&id=1ac3cc1c-04e3-4dfc-bac0-93278a507ea1&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3Adf243b7d-48cd-44b0-b4e6-c36b73d875a5%3Aglycozen-lp-b-2.png?table=block&id=eed98cc3-8cef-4683-b2ed-5d5d7649502a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GlycoZen — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1Ls797vhZ0-inkRDXqk0hMbB_vPdZqala/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A57aa80b2-64fb-473e-bcdb-177bbc400cf8%3Aglycozen-lp-a-1.png?table=block&id=2f9dfc7e-2f21-42a9-b780-b1b340b2f820&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'criativo']::text[],
      'Criativo da oferta escalada GlycoZen (Diabetes). Mecanismo: Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GlycoZen — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1bpdLV_HD4mkhv1Qr4xiXAf1QbU6OoD3Z/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A57aa80b2-64fb-473e-bcdb-177bbc400cf8%3Aglycozen-lp-a-1.png?table=block&id=2f9dfc7e-2f21-42a9-b780-b1b340b2f820&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'criativo']::text[],
      'Criativo da oferta escalada GlycoZen (Diabetes). Mecanismo: Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GlycoZen — Criativo 3 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1jc27gu_GZN0pJ6b4xCULwmx_W66ynR5U/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A57aa80b2-64fb-473e-bcdb-177bbc400cf8%3Aglycozen-lp-a-1.png?table=block&id=2f9dfc7e-2f21-42a9-b780-b1b340b2f820&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'criativo']::text[],
      'Criativo da oferta escalada GlycoZen (Diabetes). Mecanismo: Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GlycoZen — Assistir VSL A · mesma VSL nos Funis A e B',
      'https://drive.google.com/file/d/1kXgv30EQCsbjfzXk3KTh1XnhMBmsj90b/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3A57aa80b2-64fb-473e-bcdb-177bbc400cf8%3Aglycozen-lp-a-1.png?table=block&id=2f9dfc7e-2f21-42a9-b780-b1b340b2f820&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'vsl']::text[],
      'VSL completa da oferta GlycoZen (Diabetes). Mecanismo: Parasita destruidor do pâncreas / Ritual matinal de 20 segundos / Bebida bíblica revelada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoZen — LP firstminutejournal.com',
      'http://firstminutejournal.com/',
      'https://swiperadar.notion.site/image/attachment%3A57aa80b2-64fb-473e-bcdb-177bbc400cf8%3Aglycozen-lp-a-1.png?table=block&id=2f9dfc7e-2f21-42a9-b780-b1b340b2f820&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'landing_page']::text[],
      'Landing page da oferta GlycoZen (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/1muWWWMYVI8WrQoYzNb44taL83mdjeSZv/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoZen — LP Abrir LP A',
      'https://wellness-evidence.com/glycozen_bg/vsl01_l3_236/',
      'https://swiperadar.notion.site/image/attachment%3A46d9ae75-6841-460b-84f3-590335158d29%3Aglycozen-lp-a-2.png?table=block&id=4ddce463-131a-4634-9037-b399052cfbba&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'landing_page']::text[],
      'Landing page da oferta GlycoZen (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/1Hqw8MYtMxHLtJ73s2bstTWyzMfE7aFZz/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoZen — LP wellness-evidence.com/glycozen_bg/vsl01_l3_236',
      'http://wellness-evidence.com/glycozen_bg/vsl01_l3_236',
      'https://swiperadar.notion.site/image/attachment%3A62bb7511-546e-48d9-911b-4441abef5233%3Aglycozen-lp-b-1.png?table=block&id=1ac3cc1c-04e3-4dfc-bac0-93278a507ea1&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'landing_page']::text[],
      'Landing page da oferta GlycoZen (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoZen — LP Abrir LP B',
      'https://firstminutejournal.com/db-bh-ml1G/',
      'https://swiperadar.notion.site/image/attachment%3Adf243b7d-48cd-44b0-b4e6-c36b73d875a5%3Aglycozen-lp-b-2.png?table=block&id=eed98cc3-8cef-4683-b2ed-5d5d7649502a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'landing_page']::text[],
      'Landing page da oferta GlycoZen (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoZen — LP firstminutejournal.com/db-bh-ml1G',
      'http://firstminutejournal.com/db-bh-ml1G',
      'https://swiperadar.notion.site/image/attachment%3A57aa80b2-64fb-473e-bcdb-177bbc400cf8%3Aglycozen-lp-a-1.png?table=block&id=2f9dfc7e-2f21-42a9-b780-b1b340b2f820&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycozen', 'landing_page']::text[],
      'Landing page da oferta GlycoZen (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoZen',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] Olivaro (Diabetes)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)',
    'Diabetes',
    ARRAY['swiperadar', 'diabetes', 'olivaro', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"“Esta bebida mencionada 33 vezes na Bíblia reconstrói o pâncreas e reverte o diabetes tipo 2 em 21 dias”","participacao_ativa":"Público americano 45+ conservador e religioso que valoriza soluções naturais com respaldo bíblico e histórico.","narrativa":"Dois funis sofisticados: Funil A em portal jornalístico CBS News; Funil B com simulação hiper-realista de um post viral da CBS News no feed do Facebook com comentários engajados e prova social massiva.","reframe":"O ácido oleico polifenólico em sua forma pura cria uma película protetora nas células beta pancreáticas, restabelecendo a sensibilidade à insulina.","cta_engajamento":"Criativos (3) e VSLs (2) disponíveis no Google Drive.","cta_venda":"LPs ativas: http://designurlifestyle.com/ | https://vitalhealthweekly.com/Olivaro/. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/Olivaro-3f20ddb38913811db2edcaf0c5be0990',
    'https://drive.google.com/file/d/15gfxOhKQ8bwFjORBDQ2Qw-opWuskEulv/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1m7Oas94K1Aik8T0E4cFghesLl0hjwuts/view?usp=sharing', 'https://drive.google.com/file/d/1d9qAJOtETzPacj07S9x9XtBcVjEAOnYr/view?usp=sharing', 'https://drive.google.com/file/d/1-ruwxYoVjfr2DJ_RZ2fOc4rGTC0Du2_y/view?usp=sharing', 'https://drive.google.com/file/d/15gfxOhKQ8bwFjORBDQ2Qw-opWuskEulv/view?usp=sharing', 'https://drive.google.com/file/d/1Ff9zasGvVYgBzl0Q3W9rKbnYEpH_tSzQ/view?usp=sharing', 'https://drive.google.com/file/d/11jiUDIlhW9QJj8Q7M2eYmto4TBbMRyTh/view?usp=sharing', 'https://drive.google.com/file/d/1N6pxrpGSx3GusMeqR0af0tisYYZAKc1I/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: Olivaro

**Nicho:** Diabetes
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/Olivaro-3f20ddb38913811db2edcaf0c5be0990)
**Mecanismo Único:** Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Diabetes
/
Olivaro
Crie sua conta gratuita
Olivaro
Página no estilo CBS News: “esta bebida bíblica mencionada 33 vezes na Bíblia reconstrói o pâncreas e reverte o diabetes tipo 2 em 21 dias” (mecanismo de azeite de oliva extravirgem). Campanha aberta nos EUA para público 45+. Dois funis: A (página CBS News na vitalhealthweekly) e B (post falso da CBS News no Facebook, designurlifestyle.com).
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Diabetes
	
3
	
23k views
	
2
	
2
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01 · Funil A
	
11k
	
01/10
	
▶ Abrir criativo


Criativo 02 · Funil A
	
5k
	
02/10
	
▶ Abrir criativo


Criativo 03 · Funil B
	
23k
	
—
	
▶ Abrir criativo
 Páginas
LANDING PAGE A
Abrir LP A ​
vitalhealthweekly.com/Olivaro
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP A
Comentários da LP A
LANDING PAGE B
Abrir LP B ​
designurlifestyle.com/fb-cbs
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP B · post da CBS News
Comentários da LP B
 VSLs
▶ Assistir VSL A · Funil A
▶ Assistir VSL · Funil B · Funil B
 Biblioteca de Anúncios
Ver anúncios ativos · Funil A ​
Ver anúncios ativos · Funil B ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** “Esta bebida mencionada 33 vezes na Bíblia reconstrói o pâncreas e reverte o diabetes tipo 2 em 21 dias”
- **Público & Dor:** Público americano 45+ conservador e religioso que valoriza soluções naturais com respaldo bíblico e histórico.
- **Linha Narrativa:** Dois funis sofisticados: Funil A em portal jornalístico CBS News; Funil B com simulação hiper-realista de um post viral da CBS News no feed do Facebook com comentários engajados e prova social massiva.
- **Virada de Crença / Mecanismo:** O ácido oleico polifenólico em sua forma pura cria uma película protetora nas células beta pancreáticas, restabelecendo a sensibilidade à insulina.
- **Construção da Oferta:** Gotas de extrato botânico de oliva e ervas bíblicas purificadas.

## 🎬 Criativos Escalados (3 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1m7Oas94K1Aik8T0E4cFghesLl0hjwuts/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1d9qAJOtETzPacj07S9x9XtBcVjEAOnYr/view?usp=sharing)
3. [▶ Abrir criativo](https://drive.google.com/file/d/1-ruwxYoVjfr2DJ_RZ2fOc4rGTC0Du2_y/view?usp=sharing)

## 🌐 Páginas & Funis (5 links)
- [designurlifestyle.com](http://designurlifestyle.com/)
- [Abrir LP A](https://vitalhealthweekly.com/Olivaro/)
- [vitalhealthweekly.com/Olivaro](http://vitalhealthweekly.com/Olivaro)
- [Abrir LP B](https://designurlifestyle.com/fb-cbs/)
- [designurlifestyle.com/fb-cbs](http://designurlifestyle.com/fb-cbs)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/11jiUDIlhW9QJj8Q7M2eYmto4TBbMRyTh/view?usp=sharing)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1N6pxrpGSx3GusMeqR0af0tisYYZAKc1I/view?usp=sharing)

## 📽️ VSLs na Íntegra (2 vídeos)
- ▶️ [▶ Assistir VSL A · Funil A](https://drive.google.com/file/d/15gfxOhKQ8bwFjORBDQ2Qw-opWuskEulv/view?usp=sharing)
- ▶️ [▶ Assistir VSL · Funil B · Funil B](https://drive.google.com/file/d/1Ff9zasGvVYgBzl0Q3W9rKbnYEpH_tSzQ/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos · Funil A](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=105050005724841)
- 🔎 [Ver anúncios ativos · Funil B](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=TRACK.FITNESSFOLKLORE.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Perfeito para ofertas de metabolismo e glicemia como **CardioFlush / Cinna-Shield**: o mecanismo do lodo/parasita é altamente persuasivo e transfere a culpa da fraqueza para um agente invasor palpável.
',
    '{"oferta":"Olivaro","nicho":"Diabetes","notion_url":"https://swiperadar.notion.site/Olivaro-3f20ddb38913811db2edcaf0c5be0990","mecanismo":"Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)","total_criativos":3,"total_vsls":2,"total_lps":5,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1m7Oas94K1Aik8T0E4cFghesLl0hjwuts/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1d9qAJOtETzPacj07S9x9XtBcVjEAOnYr/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1-ruwxYoVjfr2DJ_RZ2fOc4rGTC0Du2_y/view?usp=sharing"}],"paginas":[{"text":"designurlifestyle.com","url":"http://designurlifestyle.com/","parent":"Página no estilo CBS News: “esta bebida bíblica mencionada 33 vezes na Bíblia reconstrói o pâncreas e reverte o diabetes tipo 2 em 21 dias” (mecanismo de azeite de oliva extravirgem). Campanha aberta nos EUA para público 45+. Dois funis: A (página CBS News na vitalhealthweekly) e B (post falso da CBS News no Facebook, designurlifestyle.com)."},{"text":"Abrir LP A","url":"https://vitalhealthweekly.com/Olivaro/","parent":"Abrir LP A ​"},{"text":"vitalhealthweekly.com/Olivaro","url":"http://vitalhealthweekly.com/Olivaro","parent":"vitalhealthweekly.com/Olivaro"},{"text":"Abrir LP B","url":"https://designurlifestyle.com/fb-cbs/","parent":"Abrir LP B ​"},{"text":"designurlifestyle.com/fb-cbs","url":"http://designurlifestyle.com/fb-cbs","parent":"designurlifestyle.com/fb-cbs"}],"vsls":[{"text":"▶ Assistir VSL A · Funil A","url":"https://drive.google.com/file/d/15gfxOhKQ8bwFjORBDQ2Qw-opWuskEulv/view?usp=sharing"},{"text":"▶ Assistir VSL · Funil B · Funil B","url":"https://drive.google.com/file/d/1Ff9zasGvVYgBzl0Q3W9rKbnYEpH_tSzQ/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos · Funil A","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=105050005724841"},{"text":"Ver anúncios ativos · Funil B","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=TRACK.FITNESSFOLKLORE.COM&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/11jiUDIlhW9QJj8Q7M2eYmto4TBbMRyTh/view?usp=sharing","parent":"Baixar HTML da página (.zip)"},{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1N6pxrpGSx3GusMeqR0af0tisYYZAKc1I/view?usp=sharing","parent":"Baixar HTML da página (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A17fb658e-9563-4286-bff6-3cf099fed190%3Aolivaro-lp-a-2.png?table=block&id=0e46d287-ff29-43de-98c1-0dad3d3e6c6d&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A66e813ec-5f5c-4249-99ef-7f206ff27773%3Aolivaro-lp-b-1.png?table=block&id=54cc44c8-2575-40c2-807e-09596adc7685&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A0f09f889-6b23-460f-9ad1-bdf8cf9bbbe8%3Aolivaro-lp-b-2.png?table=block&id=aeb23849-aefa-40de-8b5d-47598c6af50b&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Olivaro — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1m7Oas94K1Aik8T0E4cFghesLl0hjwuts/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'criativo']::text[],
      'Criativo da oferta escalada Olivaro (Diabetes). Mecanismo: Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Olivaro — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1d9qAJOtETzPacj07S9x9XtBcVjEAOnYr/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'criativo']::text[],
      'Criativo da oferta escalada Olivaro (Diabetes). Mecanismo: Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'Olivaro — Criativo 3 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1-ruwxYoVjfr2DJ_RZ2fOc4rGTC0Du2_y/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'criativo']::text[],
      'Criativo da oferta escalada Olivaro (Diabetes). Mecanismo: Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Olivaro — Assistir VSL A · Funil A',
      'https://drive.google.com/file/d/15gfxOhKQ8bwFjORBDQ2Qw-opWuskEulv/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'vsl']::text[],
      'VSL completa da oferta Olivaro (Diabetes). Mecanismo: Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'Olivaro — Assistir VSL · Funil B · Funil B',
      'https://drive.google.com/file/d/1Ff9zasGvVYgBzl0Q3W9rKbnYEpH_tSzQ/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'vsl']::text[],
      'VSL completa da oferta Olivaro (Diabetes). Mecanismo: Bebida Bíblica (mencionada 33 vezes na Bíblia / Azeite de oliva extravirgem prensado a frio reconstrutor do pâncreas)',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Olivaro — LP designurlifestyle.com',
      'http://designurlifestyle.com/',
      'https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'landing_page']::text[],
      'Landing page da oferta Olivaro (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/11jiUDIlhW9QJj8Q7M2eYmto4TBbMRyTh/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Olivaro — LP Abrir LP A',
      'https://vitalhealthweekly.com/Olivaro/',
      'https://swiperadar.notion.site/image/attachment%3A17fb658e-9563-4286-bff6-3cf099fed190%3Aolivaro-lp-a-2.png?table=block&id=0e46d287-ff29-43de-98c1-0dad3d3e6c6d&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'landing_page']::text[],
      'Landing page da oferta Olivaro (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/1N6pxrpGSx3GusMeqR0af0tisYYZAKc1I/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Olivaro — LP vitalhealthweekly.com/Olivaro',
      'http://vitalhealthweekly.com/Olivaro',
      'https://swiperadar.notion.site/image/attachment%3A66e813ec-5f5c-4249-99ef-7f206ff27773%3Aolivaro-lp-b-1.png?table=block&id=54cc44c8-2575-40c2-807e-09596adc7685&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'landing_page']::text[],
      'Landing page da oferta Olivaro (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Olivaro — LP Abrir LP B',
      'https://designurlifestyle.com/fb-cbs/',
      'https://swiperadar.notion.site/image/attachment%3A0f09f889-6b23-460f-9ad1-bdf8cf9bbbe8%3Aolivaro-lp-b-2.png?table=block&id=aeb23849-aefa-40de-8b5d-47598c6af50b&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'landing_page']::text[],
      'Landing page da oferta Olivaro (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'Olivaro — LP designurlifestyle.com/fb-cbs',
      'http://designurlifestyle.com/fb-cbs',
      'https://swiperadar.notion.site/image/attachment%3Af5bed243-4f6f-42fb-9f6a-48e3767eea4f%3Aolivaro-lp-a-1.png?table=block&id=8e93296c-f20b-46cc-9eb3-0134451f38aa&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'olivaro', 'landing_page']::text[],
      'Landing page da oferta Olivaro (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'Olivaro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] GLPro (Diabetes)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
    'Diabetes',
    ARRAY['swiperadar', 'diabetes', 'glpro', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"“Forget insulin and metformin — this simple trick is clinically proven to reverse type 2!”","participacao_ativa":"Diabéticos insatisfeitos com os efeitos colaterais da metformina (náusea, diarreia) e custo da insulina.","narrativa":"Sete criativos diferentes rodando com até 52k views. O médico apresenta na VSL um estudo clínico que comprova a ativação dos receptores GLUT-4 antes de dormir. Dois funis com 8 VSLs no total.","reframe":"O corpo já sabe como queimar açúcar; os receptores celulares apenas adormecem por causa da toxicidade lipídica noturna. O ritual reativa esses receptores enquanto você dorme.","cta_engajamento":"Criativos (7) e VSLs (8) disponíveis no Google Drive.","cta_venda":"LPs ativas: https://vitalscienceblog.info/vsl-02-fechamento-02-lead-09 | http://vitalscienceblog.info/vsl-02-fechamento-02-lead-09. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/GLPro-3f20ddb3891381bb9917d542e02ffcfa',
    'https://drive.google.com/file/d/18Zk8UMVJlCnpmw087BvAHaxyUuJysq9e/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1ZtbOXaY3c0rF1wvg-NWLirE7f8MMQDB8/view?usp=sharing', 'https://drive.google.com/file/d/18sNCydbq9Cdm7q--8LkYMSl3Gc7kuloj/view?usp=sharing', 'https://drive.google.com/file/d/15ywFODOXRPsXtdfxtzD5LeuTvcctppWJ/view?usp=sharing', 'https://drive.google.com/file/d/1CvhpegwTjTVNSeBpP1o9RRdmfu48At3j/view?usp=sharing', 'https://drive.google.com/file/d/1VoE7YEaWSnHz3TR_hKiiIAIBJ3Icae4N/view?usp=sharing', 'https://drive.google.com/file/d/1nKeH-4ydE0s35scDbsepCUs6cBJoSHNN/view?usp=sharing', 'https://drive.google.com/file/d/1hC-icVQVi8h1WA72Lv_RAopG8_OAKEDM/view?usp=sharing', 'https://drive.google.com/file/d/18Zk8UMVJlCnpmw087BvAHaxyUuJysq9e/view?usp=sharing', 'https://drive.google.com/file/d/1SW_O7UGn9lbVsKcCpahFDfzKFILaOnI5/view?usp=sharing', 'https://drive.google.com/file/d/1M3b5A3o0IQzWN3SKtRUmQG3nASsgp6NO/view?usp=sharing', 'https://drive.google.com/file/d/1LEnQzQdRmMxtHdrSW-rDiBnhkLa4cgu8/view?usp=sharing', 'https://drive.google.com/file/d/1vx-9qN-9dPc5TrcQRUWQDyM3DgvuC1bA/view?usp=sharing', 'https://drive.google.com/file/d/1CExEfswe6XMod_gNInHIYWLS59UWFxu7/view?usp=sharing', 'https://drive.google.com/file/d/1c0AHm1PR3nTxOPDs2o60XhLwDJipbTsd/view?usp=sharing', 'https://drive.google.com/file/d/1EicN3pDtBwUdwCzR3xSDNkiITr5QNViB/view?usp=sharing', 'https://drive.google.com/file/d/154tLrtvbZtS40xdt4IHRPTxy31k8qLQr/view?usp=sharing', 'https://drive.google.com/file/d/1iZeqwx7xGamk_u9p60VsbkvgIB_Ha0IG/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: GLPro

**Nicho:** Diabetes
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/GLPro-3f20ddb3891381bb9917d542e02ffcfa)
**Mecanismo Único:** Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Diabetes
/
GLPro
Crie sua conta gratuita
GLPro
Gancho “Forget insulin and metformin — this simple trick is clinically proven to reverse type 2”, com mecanismo de canela e ritual caseiro antes de dormir. VSL do médico direto na página. Dois funis: A (vitalscienceblog, 6 VSLs em teste) e B (vitalhealthweekly/GLP9, 2 VSLs — a A aparece mais, provavelmente performando melhor).
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Diabetes
	
7
	
52k views
	
2
	
8
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01 · Funil A
	
32k
	
02/10
	
▶ Abrir criativo


Criativo 02 · Funil A
	
51k
	
05/10
	
▶ Abrir criativo


Criativo 03 · Funil A
	
52k
	
06/10
	
▶ Abrir criativo


Criativo 04 · Funil A
	
29k
	
06/10
	
▶ Abrir criativo


Criativo 05 · Funil B
	
44k
	
30/09
	
▶ Abrir criativo


Criativo 06 · Funil B
	
29k
	
01/10
	
▶ Abrir criativo


Criativo 07 · Funil B
	
15k
	
02/10
	
▶ Abrir criativo
 Páginas
LANDING PAGE A
Abrir LP A ​
vitalscienceblog.info/vsl-02-fechamento-02-lead-09
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP A com a VSL
Parte de baixo da LP A
LANDING PAGE B
Abrir LP B ​
vitalhealthweekly.com/GLP9
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP B com a VSL
Comentários da LP B
 VSLs
▶ Assistir VSL A · Funil A
▶ Assistir VSL B · Funil A
▶ Assistir VSL C · Funil A
▶ Assistir VSL D · Funil A
▶ Assistir VSL E · Funil A
▶ Assistir VSL F · Funil A
▶ Assistir VSL A · Funil B · aparece mais que a B
▶ Assistir VSL B · Funil B
 Biblioteca de Anúncios
Ver anúncios ativos · Funil A ​
Ver anúncios ativos · Funil B ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** “Forget insulin and metformin — this simple trick is clinically proven to reverse type 2!”
- **Público & Dor:** Diabéticos insatisfeitos com os efeitos colaterais da metformina (náusea, diarreia) e custo da insulina.
- **Linha Narrativa:** Sete criativos diferentes rodando com até 52k views. O médico apresenta na VSL um estudo clínico que comprova a ativação dos receptores GLUT-4 antes de dormir. Dois funis com 8 VSLs no total.
- **Virada de Crença / Mecanismo:** O corpo já sabe como queimar açúcar; os receptores celulares apenas adormecem por causa da toxicidade lipídica noturna. O ritual reativa esses receptores enquanto você dorme.
- **Construção da Oferta:** GLPro cápsulas noturnas com frete grátis e garantia incondicional de 90 dias.

## 🎬 Criativos Escalados (7 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1ZtbOXaY3c0rF1wvg-NWLirE7f8MMQDB8/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/18sNCydbq9Cdm7q--8LkYMSl3Gc7kuloj/view?usp=sharing)
3. [▶ Abrir criativo](https://drive.google.com/file/d/15ywFODOXRPsXtdfxtzD5LeuTvcctppWJ/view?usp=sharing)
4. [▶ Abrir criativo](https://drive.google.com/file/d/1CvhpegwTjTVNSeBpP1o9RRdmfu48At3j/view?usp=sharing)
5. [▶ Abrir criativo](https://drive.google.com/file/d/1VoE7YEaWSnHz3TR_hKiiIAIBJ3Icae4N/view?usp=sharing)
6. [▶ Abrir criativo](https://drive.google.com/file/d/1nKeH-4ydE0s35scDbsepCUs6cBJoSHNN/view?usp=sharing)
7. [▶ Abrir criativo](https://drive.google.com/file/d/1hC-icVQVi8h1WA72Lv_RAopG8_OAKEDM/view?usp=sharing)

## 🌐 Páginas & Funis (4 links)
- [Abrir LP A](https://vitalscienceblog.info/vsl-02-fechamento-02-lead-09)
- [vitalscienceblog.info/vsl-02-fechamento-02-lead-09](http://vitalscienceblog.info/vsl-02-fechamento-02-lead-09)
- [Abrir LP B](https://vitalhealthweekly.com/GLP9/)
- [vitalhealthweekly.com/GLP9](http://vitalhealthweekly.com/GLP9)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/154tLrtvbZtS40xdt4IHRPTxy31k8qLQr/view?usp=sharing)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1iZeqwx7xGamk_u9p60VsbkvgIB_Ha0IG/view?usp=sharing)

## 📽️ VSLs na Íntegra (8 vídeos)
- ▶️ [▶ Assistir VSL A · Funil A](https://drive.google.com/file/d/18Zk8UMVJlCnpmw087BvAHaxyUuJysq9e/view?usp=sharing)
- ▶️ [▶ Assistir VSL B · Funil A](https://drive.google.com/file/d/1SW_O7UGn9lbVsKcCpahFDfzKFILaOnI5/view?usp=sharing)
- ▶️ [▶ Assistir VSL C · Funil A](https://drive.google.com/file/d/1M3b5A3o0IQzWN3SKtRUmQG3nASsgp6NO/view?usp=sharing)
- ▶️ [▶ Assistir VSL D · Funil A](https://drive.google.com/file/d/1LEnQzQdRmMxtHdrSW-rDiBnhkLa4cgu8/view?usp=sharing)
- ▶️ [▶ Assistir VSL E · Funil A](https://drive.google.com/file/d/1vx-9qN-9dPc5TrcQRUWQDyM3DgvuC1bA/view?usp=sharing)
- ▶️ [▶ Assistir VSL F · Funil A](https://drive.google.com/file/d/1CExEfswe6XMod_gNInHIYWLS59UWFxu7/view?usp=sharing)
- ▶️ [▶ Assistir VSL A · Funil B · aparece mais que a B](https://drive.google.com/file/d/1c0AHm1PR3nTxOPDs2o60XhLwDJipbTsd/view?usp=sharing)
- ▶️ [▶ Assistir VSL B · Funil B](https://drive.google.com/file/d/1EicN3pDtBwUdwCzR3xSDNkiITr5QNViB/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos · Funil A](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22BLOG.ODDLYHEALTHY.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)
- 🔎 [Ver anúncios ativos · Funil B](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22NEW.PIXLYNX.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)

## 🎯 Como Modelar para o Império HQ
Perfeito para ofertas de metabolismo e glicemia como **CardioFlush / Cinna-Shield**: o mecanismo do lodo/parasita é altamente persuasivo e transfere a culpa da fraqueza para um agente invasor palpável.
',
    '{"oferta":"GLPro","nicho":"Diabetes","notion_url":"https://swiperadar.notion.site/GLPro-3f20ddb3891381bb9917d542e02ffcfa","mecanismo":"Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada","total_criativos":7,"total_vsls":8,"total_lps":4,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1ZtbOXaY3c0rF1wvg-NWLirE7f8MMQDB8/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/18sNCydbq9Cdm7q--8LkYMSl3Gc7kuloj/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/15ywFODOXRPsXtdfxtzD5LeuTvcctppWJ/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1CvhpegwTjTVNSeBpP1o9RRdmfu48At3j/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1VoE7YEaWSnHz3TR_hKiiIAIBJ3Icae4N/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1nKeH-4ydE0s35scDbsepCUs6cBJoSHNN/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1hC-icVQVi8h1WA72Lv_RAopG8_OAKEDM/view?usp=sharing"}],"paginas":[{"text":"Abrir LP A","url":"https://vitalscienceblog.info/vsl-02-fechamento-02-lead-09","parent":"Abrir LP A ​"},{"text":"vitalscienceblog.info/vsl-02-fechamento-02-lead-09","url":"http://vitalscienceblog.info/vsl-02-fechamento-02-lead-09","parent":"vitalscienceblog.info/vsl-02-fechamento-02-lead-09"},{"text":"Abrir LP B","url":"https://vitalhealthweekly.com/GLP9/","parent":"Abrir LP B ​"},{"text":"vitalhealthweekly.com/GLP9","url":"http://vitalhealthweekly.com/GLP9","parent":"vitalhealthweekly.com/GLP9"}],"vsls":[{"text":"▶ Assistir VSL A · Funil A","url":"https://drive.google.com/file/d/18Zk8UMVJlCnpmw087BvAHaxyUuJysq9e/view?usp=sharing"},{"text":"▶ Assistir VSL B · Funil A","url":"https://drive.google.com/file/d/1SW_O7UGn9lbVsKcCpahFDfzKFILaOnI5/view?usp=sharing"},{"text":"▶ Assistir VSL C · Funil A","url":"https://drive.google.com/file/d/1M3b5A3o0IQzWN3SKtRUmQG3nASsgp6NO/view?usp=sharing"},{"text":"▶ Assistir VSL D · Funil A","url":"https://drive.google.com/file/d/1LEnQzQdRmMxtHdrSW-rDiBnhkLa4cgu8/view?usp=sharing"},{"text":"▶ Assistir VSL E · Funil A","url":"https://drive.google.com/file/d/1vx-9qN-9dPc5TrcQRUWQDyM3DgvuC1bA/view?usp=sharing"},{"text":"▶ Assistir VSL F · Funil A","url":"https://drive.google.com/file/d/1CExEfswe6XMod_gNInHIYWLS59UWFxu7/view?usp=sharing"},{"text":"▶ Assistir VSL A · Funil B · aparece mais que a B","url":"https://drive.google.com/file/d/1c0AHm1PR3nTxOPDs2o60XhLwDJipbTsd/view?usp=sharing"},{"text":"▶ Assistir VSL B · Funil B","url":"https://drive.google.com/file/d/1EicN3pDtBwUdwCzR3xSDNkiITr5QNViB/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos · Funil A","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22BLOG.ODDLYHEALTHY.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"},{"text":"Ver anúncios ativos · Funil B","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22NEW.PIXLYNX.COM%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/154tLrtvbZtS40xdt4IHRPTxy31k8qLQr/view?usp=sharing","parent":"Baixar HTML da página (.zip)"},{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1iZeqwx7xGamk_u9p60VsbkvgIB_Ha0IG/view?usp=sharing","parent":"Baixar HTML da página (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A2ebdd2d1-cd75-4cfb-b7a2-6e9f79b59218%3Aglpro-lp-a-2.png?table=block&id=eeb1da66-4b59-4b3a-a26f-ec8c65d5a5a1&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A35005491-defb-43a5-a40c-7a0aea202883%3Aglpro-lp-b-1.png?table=block&id=f4edccd0-4c79-4080-9b51-e62ff7e1a8a5&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A91d4b756-8859-4a4f-a2a0-e8dd052879e7%3Aglpro-lp-b-2.png?table=block&id=2419b9c9-3598-4d81-bd04-f811ddd0f3dc&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GLPro — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1ZtbOXaY3c0rF1wvg-NWLirE7f8MMQDB8/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'criativo']::text[],
      'Criativo da oferta escalada GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GLPro — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/18sNCydbq9Cdm7q--8LkYMSl3Gc7kuloj/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'criativo']::text[],
      'Criativo da oferta escalada GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GLPro — Criativo 3 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/15ywFODOXRPsXtdfxtzD5LeuTvcctppWJ/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'criativo']::text[],
      'Criativo da oferta escalada GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GLPro — Criativo 4 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1CvhpegwTjTVNSeBpP1o9RRdmfu48At3j/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'criativo']::text[],
      'Criativo da oferta escalada GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GLPro — Criativo 5 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1VoE7YEaWSnHz3TR_hKiiIAIBJ3Icae4N/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'criativo']::text[],
      'Criativo da oferta escalada GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GLPro — Criativo 6 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1nKeH-4ydE0s35scDbsepCUs6cBJoSHNN/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'criativo']::text[],
      'Criativo da oferta escalada GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GLPro — Criativo 7 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1hC-icVQVi8h1WA72Lv_RAopG8_OAKEDM/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'criativo']::text[],
      'Criativo da oferta escalada GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL A · Funil A',
      'https://drive.google.com/file/d/18Zk8UMVJlCnpmw087BvAHaxyUuJysq9e/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL B · Funil A',
      'https://drive.google.com/file/d/1SW_O7UGn9lbVsKcCpahFDfzKFILaOnI5/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL C · Funil A',
      'https://drive.google.com/file/d/1M3b5A3o0IQzWN3SKtRUmQG3nASsgp6NO/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL D · Funil A',
      'https://drive.google.com/file/d/1LEnQzQdRmMxtHdrSW-rDiBnhkLa4cgu8/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL E · Funil A',
      'https://drive.google.com/file/d/1vx-9qN-9dPc5TrcQRUWQDyM3DgvuC1bA/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL F · Funil A',
      'https://drive.google.com/file/d/1CExEfswe6XMod_gNInHIYWLS59UWFxu7/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL A · Funil B · aparece mais que a B',
      'https://drive.google.com/file/d/1c0AHm1PR3nTxOPDs2o60XhLwDJipbTsd/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GLPro — Assistir VSL B · Funil B',
      'https://drive.google.com/file/d/1EicN3pDtBwUdwCzR3xSDNkiITr5QNViB/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'vsl']::text[],
      'VSL completa da oferta GLPro (Diabetes). Mecanismo: Truque da Canela Noturna / Substituição de insulina e metformina clinicamente comprovada',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GLPro — LP Abrir LP A',
      'https://vitalscienceblog.info/vsl-02-fechamento-02-lead-09',
      'https://swiperadar.notion.site/image/attachment%3Ac06058af-ff1a-4702-a524-e08ff8641f47%3Aglpro-lp-a-1.png?table=block&id=62a08c85-d7eb-4b71-8ede-a48df4cf260a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'landing_page']::text[],
      'Landing page da oferta GLPro (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/154tLrtvbZtS40xdt4IHRPTxy31k8qLQr/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GLPro — LP vitalscienceblog.info/vsl-02-fechamento-02-lead-09',
      'http://vitalscienceblog.info/vsl-02-fechamento-02-lead-09',
      'https://swiperadar.notion.site/image/attachment%3A2ebdd2d1-cd75-4cfb-b7a2-6e9f79b59218%3Aglpro-lp-a-2.png?table=block&id=eeb1da66-4b59-4b3a-a26f-ec8c65d5a5a1&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'landing_page']::text[],
      'Landing page da oferta GLPro (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/1iZeqwx7xGamk_u9p60VsbkvgIB_Ha0IG/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GLPro — LP Abrir LP B',
      'https://vitalhealthweekly.com/GLP9/',
      'https://swiperadar.notion.site/image/attachment%3A35005491-defb-43a5-a40c-7a0aea202883%3Aglpro-lp-b-1.png?table=block&id=f4edccd0-4c79-4080-9b51-e62ff7e1a8a5&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'landing_page']::text[],
      'Landing page da oferta GLPro (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GLPro — LP vitalhealthweekly.com/GLP9',
      'http://vitalhealthweekly.com/GLP9',
      'https://swiperadar.notion.site/image/attachment%3A91d4b756-8859-4a4f-a2a0-e8dd052879e7%3Aglpro-lp-b-2.png?table=block&id=2419b9c9-3598-4d81-bd04-f811ddd0f3dc&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glpro', 'landing_page']::text[],
      'Landing page da oferta GLPro (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GLPro',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_swipes (
    user_id,
    title,
    criador,
    plataforma,
    formato,
    mecanismo,
    nicho,
    tags,
    rating,
    status,
    blocks,
    source_url,
    video_url,
    media_urls,
    raw_text,
    resultado,
    favorito
  ) VALUES (
    'bded734b-15c0-4db3-851b-5ad763ee33c8',
    '[SwipeRadar] GlycoBarrier (Diabetes)',
    'SwipeRadar',
    'Meta Ads / Web',
    'vsl',
    'Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
    'Diabetes',
    ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'escalado', 'meta_ads']::text[],
    5,
    'ativo',
    '{"gancho":"\"Como criar uma barreira natural contra picos de glicose após as refeições sem abrir mão da comida.\"","participacao_ativa":"Diabéticos que sofrem com compulsão por doces e carboidratos e sentem culpa após comer.","narrativa":"Três funis completos rodando simultaneamente: Funil A na healthynewsletters.site com oferta direta abaixo da VSL (US$ 79 / 69 / 49 por pote, frete grátis, 180 dias de garantia); Funil B com post da CBS News no Facebook; Funil C alimentando 3 variações de VSL.","reframe":"Em vez de tentar produzir mais insulina com remédios pesados, o segredo é neutralizar as enzimas amilase e glucosidase no intestino, impedindo o pico glicêmico na fonte.","cta_engajamento":"Criativos (2) e VSLs (5) disponíveis no Google Drive.","cta_venda":"LPs ativas: http://healthynewsletters.site/ | http://healthandwelnesss.online/. Links Meta Ads Library ativos."}'::jsonb,
    'https://swiperadar.notion.site/GlycoBarrier-3f20ddb389138109b37aeb1095c735bf',
    'https://drive.google.com/file/d/1iucDTuDI0hQExf5Zmt4xlcQPm4QWdTvF/view?usp=sharing',
    ARRAY['https://drive.google.com/file/d/1hNHHB-Hhwo99L1n1dipArrN_U-q-wxJI/view?usp=sharing', 'https://drive.google.com/file/d/1yEeqYAtVqYcmN31Tu-mWVkaBKhsfJ-6C/view?usp=sharing', 'https://drive.google.com/file/d/1iucDTuDI0hQExf5Zmt4xlcQPm4QWdTvF/view?usp=sharing', 'https://drive.google.com/file/d/1AG-0zzeTsaJwpjUActgAS6JizxPcf14c/view?usp=sharing', 'https://drive.google.com/file/d/1aU-rycBxh2I48H1FybOyJzs_xgxXgRUe/view?usp=sharing', 'https://drive.google.com/file/d/1RSXssgdqMTiD4flHEMa7DBPMKODHHlSi/view?usp=sharing', 'https://drive.google.com/file/d/12BWFyd7CFGZxkt6RHNhweE8wsgga6c7V/view?usp=sharing', 'https://drive.google.com/file/d/1_45nOVgowPcchb2r8k7WMXRd_iow7Y8t/view?usp=sharing', 'https://drive.google.com/file/d/1r0BPO7Rca0tpUZ5VgwqwHuKx8qy-7y0C/view?usp=sharing']::text[],
    '# 📁 Dossiê de Inteligência: GlycoBarrier

**Nicho:** Diabetes
**Fonte:** [SwipeRadar Notion](https://swiperadar.notion.site/GlycoBarrier-3f20ddb389138109b37aeb1095c735bf)
**Mecanismo Único:** Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News

## 💡 Resumo do Funil e Estratégia
Pular para o conteúdo
Swipe Radar
/
Diabetes
/
GlycoBarrier
Crie sua conta gratuita
GlycoBarrier
Três funis rodando. A: VSL na healthynewsletters.site com a oferta logo abaixo (kits de 2, 3 e 6 potes, US$ 79 / 69 / 49 por pote, frete grátis, garantia de 180 dias). B: post falso da CBS News no Facebook com a VSL. C: página na healthandwelnesss.online que alimenta as VSLs C, D e E.
Nicho
	
Criativos
	
Criativo mais visto
	
Páginas
	
VSLs


Diabetes
	
2
	
5k views
	
3
	
5
 Criativos
Criativo
	
Views
	
Data
	
Arquivo


Criativo 01 · Funil B
	
5k
	
26/09
	
▶ Abrir criativo


Criativo 02 · Funil C (VSLs C–E)
	
—
	
—
	
▶ Abrir criativo
Criativo do Funil A ainda não adicionado na pasta.
 Páginas
LANDING PAGE A
Abrir LP A ​
healthynewsletters.site/arock
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP A com a VSL
Comentários da LP A
LANDING PAGE B
Abrir LP B ​
gb.dailyhealthtotal.com/ofer
HTML DA PÁGINA
Ainda não disponível
Topo da LP B · post da CBS News
Comentários da LP B
LANDING PAGE C
Abrir LP C ​
Leva para as VSLs C, D e E
HTML DA PÁGINA
 Baixar HTML da página (.zip)
Topo da LP C com a VSL
Comentários da LP C
 VSLs
▶ Assistir VSL A · 06/10 · Funil A
▶ Assistir VSL B · 26/09 · Funil B
▶ Assistir VSL C · Funil C
▶ Assistir VSL D · Funil C
▶ Assistir VSL E · Funil C
 Biblioteca de Anúncios
Ver anúncios ativos · Funil A ​
Ver anúncios ativos · Funil B ​
Ver anúncios ativos · Funil C (VSLs C–E) ​

## 🧬 Anatomia Persuasiva
- **Gancho Principal:** "Como criar uma barreira natural contra picos de glicose após as refeições sem abrir mão da comida."
- **Público & Dor:** Diabéticos que sofrem com compulsão por doces e carboidratos e sentem culpa após comer.
- **Linha Narrativa:** Três funis completos rodando simultaneamente: Funil A na healthynewsletters.site com oferta direta abaixo da VSL (US$ 79 / 69 / 49 por pote, frete grátis, 180 dias de garantia); Funil B com post da CBS News no Facebook; Funil C alimentando 3 variações de VSL.
- **Virada de Crença / Mecanismo:** Em vez de tentar produzir mais insulina com remédios pesados, o segredo é neutralizar as enzimas amilase e glucosidase no intestino, impedindo o pico glicêmico na fonte.
- **Construção da Oferta:** GlycoBarrier kits de 2, 3 e 6 potes com US$ 79 / 69 / 49 por frasco e garantia estendida de 180 dias.

## 🎬 Criativos Escalados (2 disponíveis)
1. [▶ Abrir criativo](https://drive.google.com/file/d/1hNHHB-Hhwo99L1n1dipArrN_U-q-wxJI/view?usp=sharing)
2. [▶ Abrir criativo](https://drive.google.com/file/d/1yEeqYAtVqYcmN31Tu-mWVkaBKhsfJ-6C/view?usp=sharing)

## 🌐 Páginas & Funis (7 links)
- [healthynewsletters.site](http://healthynewsletters.site/)
- [healthandwelnesss.online](http://healthandwelnesss.online/)
- [Abrir LP A](https://www.healthynewsletters.site/arock/)
- [healthynewsletters.site/arock](http://healthynewsletters.site/arock)
- [Abrir LP B](https://gb.dailyhealthtotal.com/ofer/)
- [gb.dailyhealthtotal.com/ofer](http://gb.dailyhealthtotal.com/ofer)
- [Abrir LP C](https://www.healthandwelnesss.online/hslfssoighodsgosh2/)

### 📦 Downloads de Código HTML (.zip)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1_45nOVgowPcchb2r8k7WMXRd_iow7Y8t/view?usp=sharing)
- 📥 [Baixar HTML da página (.zip)](https://drive.google.com/file/d/1r0BPO7Rca0tpUZ5VgwqwHuKx8qy-7y0C/view?usp=sharing)

## 📽️ VSLs na Íntegra (5 vídeos)
- ▶️ [▶ Assistir VSL A · 06/10 · Funil A](https://drive.google.com/file/d/1iucDTuDI0hQExf5Zmt4xlcQPm4QWdTvF/view?usp=sharing)
- ▶️ [▶ Assistir VSL B · 26/09 · Funil B](https://drive.google.com/file/d/1AG-0zzeTsaJwpjUActgAS6JizxPcf14c/view?usp=sharing)
- ▶️ [▶ Assistir VSL C · Funil C](https://drive.google.com/file/d/1aU-rycBxh2I48H1FybOyJzs_xgxXgRUe/view?usp=sharing)
- ▶️ [▶ Assistir VSL D · Funil C](https://drive.google.com/file/d/1RSXssgdqMTiD4flHEMa7DBPMKODHHlSi/view?usp=sharing)
- ▶️ [▶ Assistir VSL E · Funil C](https://drive.google.com/file/d/12BWFyd7CFGZxkt6RHNhweE8wsgga6c7V/view?usp=sharing)

## 🔍 Meta Ads Library (Concorrente ao Vivo)
- 🔎 [Ver anúncios ativos · Funil A](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22HEALTHYNEWSLETTERS.SITE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget)
- 🔎 [Ver anúncios ativos · Funil B](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=104838184611702)
- 🔎 [Ver anúncios ativos · Funil C (VSLs C–E)](https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=318654394664137)

## 🎯 Como Modelar para o Império HQ
Perfeito para ofertas de metabolismo e glicemia como **CardioFlush / Cinna-Shield**: o mecanismo do lodo/parasita é altamente persuasivo e transfere a culpa da fraqueza para um agente invasor palpável.
',
    '{"oferta":"GlycoBarrier","nicho":"Diabetes","notion_url":"https://swiperadar.notion.site/GlycoBarrier-3f20ddb389138109b37aeb1095c735bf","mecanismo":"Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News","total_criativos":2,"total_vsls":5,"total_lps":7,"criativos":[{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1hNHHB-Hhwo99L1n1dipArrN_U-q-wxJI/view?usp=sharing"},{"text":"▶ Abrir criativo","url":"https://drive.google.com/file/d/1yEeqYAtVqYcmN31Tu-mWVkaBKhsfJ-6C/view?usp=sharing"}],"paginas":[{"text":"healthynewsletters.site","url":"http://healthynewsletters.site/","parent":"Três funis rodando. A: VSL na healthynewsletters.site com a oferta logo abaixo (kits de 2, 3 e 6 potes, US$ 79 / 69 / 49 por pote, frete grátis, garantia de 180 dias). B: post falso da CBS News no Facebook com a VSL. C: página na healthandwelnesss.online que alimenta as VSLs C, D e E."},{"text":"healthandwelnesss.online","url":"http://healthandwelnesss.online/","parent":"Três funis rodando. A: VSL na healthynewsletters.site com a oferta logo abaixo (kits de 2, 3 e 6 potes, US$ 79 / 69 / 49 por pote, frete grátis, garantia de 180 dias). B: post falso da CBS News no Facebook com a VSL. C: página na healthandwelnesss.online que alimenta as VSLs C, D e E."},{"text":"Abrir LP A","url":"https://www.healthynewsletters.site/arock/","parent":"Abrir LP A ​"},{"text":"healthynewsletters.site/arock","url":"http://healthynewsletters.site/arock","parent":"healthynewsletters.site/arock"},{"text":"Abrir LP B","url":"https://gb.dailyhealthtotal.com/ofer/","parent":"Abrir LP B ​"},{"text":"gb.dailyhealthtotal.com/ofer","url":"http://gb.dailyhealthtotal.com/ofer","parent":"gb.dailyhealthtotal.com/ofer"},{"text":"Abrir LP C","url":"https://www.healthandwelnesss.online/hslfssoighodsgosh2/","parent":"Abrir LP C ​"}],"vsls":[{"text":"▶ Assistir VSL A · 06/10 · Funil A","url":"https://drive.google.com/file/d/1iucDTuDI0hQExf5Zmt4xlcQPm4QWdTvF/view?usp=sharing"},{"text":"▶ Assistir VSL B · 26/09 · Funil B","url":"https://drive.google.com/file/d/1AG-0zzeTsaJwpjUActgAS6JizxPcf14c/view?usp=sharing"},{"text":"▶ Assistir VSL C · Funil C","url":"https://drive.google.com/file/d/1aU-rycBxh2I48H1FybOyJzs_xgxXgRUe/view?usp=sharing"},{"text":"▶ Assistir VSL D · Funil C","url":"https://drive.google.com/file/d/1RSXssgdqMTiD4flHEMa7DBPMKODHHlSi/view?usp=sharing"},{"text":"▶ Assistir VSL E · Funil C","url":"https://drive.google.com/file/d/12BWFyd7CFGZxkt6RHNhweE8wsgga6c7V/view?usp=sharing"}],"meta_ads":[{"text":"Ver anúncios ativos · Funil A","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=%22HEALTHYNEWSLETTERS.SITE%22&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget"},{"text":"Ver anúncios ativos · Funil B","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=104838184611702"},{"text":"Ver anúncios ativos · Funil C (VSLs C–E)","url":"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=total_impressions&sort_data[direction]=desc&source=page-transparency-widget&view_all_page_id=318654394664137"}],"zips":[{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1_45nOVgowPcchb2r8k7WMXRd_iow7Y8t/view?usp=sharing","parent":"Baixar HTML da página (.zip)"},{"text":"Baixar HTML da página (.zip)","url":"https://drive.google.com/file/d/1r0BPO7Rca0tpUZ5VgwqwHuKx8qy-7y0C/view?usp=sharing","parent":"Baixar HTML da página (.zip)"}],"prints":["https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3Ab12d3536-7df9-45ee-b980-f79b9fe71302%3Aglycobarrier-lp-a-2.png?table=block&id=8999ae9c-0be8-4be6-9e6c-25e40efaebe0&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A7b74ec7b-7fd7-4bff-9a48-f1e32d7eca7e%3Aglycobarrier-lp-b-1.png?table=block&id=ced5bbaf-420b-4f23-9528-32d35208e861&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A2404f097-79bf-4818-a6c7-cdb0179a001b%3Aglycobarrier-lp-b-2.png?table=block&id=215e30df-d080-44b0-a748-1464c11d7cf5&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3Af5729cfd-6924-49ee-9249-bf6e1847adb8%3Aglycobarrier-lp-c-1.png?table=block&id=b62b3d59-7647-450e-9a95-1e21a7c0ee20&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl","https://swiperadar.notion.site/image/attachment%3A52ae8bf9-bc7f-4565-b974-f7196f5be421%3Aglycobarrier-lp-c-2.png?table=block&id=508493d2-227e-4ef4-9926-c24a9c6ec67a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl"]}'::jsonb,
    true
  );

INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GlycoBarrier — Criativo 1 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1hNHHB-Hhwo99L1n1dipArrN_U-q-wxJI/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'criativo']::text[],
      'Criativo da oferta escalada GlycoBarrier (Diabetes). Mecanismo: Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'criativo',
      'GlycoBarrier — Criativo 2 (▶ Abrir criativo)',
      'https://drive.google.com/file/d/1yEeqYAtVqYcmN31Tu-mWVkaBKhsfJ-6C/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'criativo']::text[],
      'Criativo da oferta escalada GlycoBarrier (Diabetes). Mecanismo: Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
      9,
      'Meta Ads',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'video'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GlycoBarrier — Assistir VSL A · 06/10 · Funil A',
      'https://drive.google.com/file/d/1iucDTuDI0hQExf5Zmt4xlcQPm4QWdTvF/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'vsl']::text[],
      'VSL completa da oferta GlycoBarrier (Diabetes). Mecanismo: Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GlycoBarrier — Assistir VSL B · 26/09 · Funil B',
      'https://drive.google.com/file/d/1AG-0zzeTsaJwpjUActgAS6JizxPcf14c/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'vsl']::text[],
      'VSL completa da oferta GlycoBarrier (Diabetes). Mecanismo: Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GlycoBarrier — Assistir VSL C · Funil C',
      'https://drive.google.com/file/d/1aU-rycBxh2I48H1FybOyJzs_xgxXgRUe/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'vsl']::text[],
      'VSL completa da oferta GlycoBarrier (Diabetes). Mecanismo: Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GlycoBarrier — Assistir VSL D · Funil C',
      'https://drive.google.com/file/d/1RSXssgdqMTiD4flHEMa7DBPMKODHHlSi/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'vsl']::text[],
      'VSL completa da oferta GlycoBarrier (Diabetes). Mecanismo: Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'video',
      'GlycoBarrier — Assistir VSL E · Funil C',
      'https://drive.google.com/file/d/12BWFyd7CFGZxkt6RHNhweE8wsgga6c7V/view?usp=sharing',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'vsl']::text[],
      'VSL completa da oferta GlycoBarrier (Diabetes). Mecanismo: Barreira de Proteção Glicêmica / Bloqueio enzimático de carboidratos / Post CBS News',
      10,
      'Drive / VSL',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'vsl'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoBarrier — LP healthynewsletters.site',
      'http://healthynewsletters.site/',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'landing_page']::text[],
      'Landing page da oferta GlycoBarrier (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/1_45nOVgowPcchb2r8k7WMXRd_iow7Y8t/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoBarrier — LP healthandwelnesss.online',
      'http://healthandwelnesss.online/',
      'https://swiperadar.notion.site/image/attachment%3Ab12d3536-7df9-45ee-b980-f79b9fe71302%3Aglycobarrier-lp-a-2.png?table=block&id=8999ae9c-0be8-4be6-9e6c-25e40efaebe0&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'landing_page']::text[],
      'Landing page da oferta GlycoBarrier (Diabetes). | ZIP com HTML: https://drive.google.com/file/d/1r0BPO7Rca0tpUZ5VgwqwHuKx8qy-7y0C/view?usp=sharing',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoBarrier — LP Abrir LP A',
      'https://www.healthynewsletters.site/arock/',
      'https://swiperadar.notion.site/image/attachment%3A7b74ec7b-7fd7-4bff-9a48-f1e32d7eca7e%3Aglycobarrier-lp-b-1.png?table=block&id=ced5bbaf-420b-4f23-9528-32d35208e861&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'landing_page']::text[],
      'Landing page da oferta GlycoBarrier (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoBarrier — LP healthynewsletters.site/arock',
      'http://healthynewsletters.site/arock',
      'https://swiperadar.notion.site/image/attachment%3A2404f097-79bf-4818-a6c7-cdb0179a001b%3Aglycobarrier-lp-b-2.png?table=block&id=215e30df-d080-44b0-a748-1464c11d7cf5&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'landing_page']::text[],
      'Landing page da oferta GlycoBarrier (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoBarrier — LP Abrir LP B',
      'https://gb.dailyhealthtotal.com/ofer/',
      'https://swiperadar.notion.site/image/attachment%3Af5729cfd-6924-49ee-9249-bf6e1847adb8%3Aglycobarrier-lp-c-1.png?table=block&id=b62b3d59-7647-450e-9a95-1e21a7c0ee20&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'landing_page']::text[],
      'Landing page da oferta GlycoBarrier (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoBarrier — LP gb.dailyhealthtotal.com/ofer',
      'http://gb.dailyhealthtotal.com/ofer',
      'https://swiperadar.notion.site/image/attachment%3A52ae8bf9-bc7f-4565-b974-f7196f5be421%3Aglycobarrier-lp-c-2.png?table=block&id=508493d2-227e-4ef4-9926-c24a9c6ec67a&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'landing_page']::text[],
      'Landing page da oferta GlycoBarrier (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'lp'
    );
INSERT INTO imphq_referencias (
      id,
      tipo,
      titulo,
      url,
      image_url,
      tags,
      notas,
      score,
      plataforma,
      pasta,
      produto,
      fonte,
      formato
    ) VALUES (
      gen_random_uuid()::text,
      'landing_page',
      'GlycoBarrier — LP Abrir LP C',
      'https://www.healthandwelnesss.online/hslfssoighodsgosh2/',
      'https://swiperadar.notion.site/image/attachment%3Ac3999436-ef19-4193-b15e-62aca60b24ae%3Aglycobarrier-lp-a-1.png?table=block&id=4d67f4a9-8e58-45b0-86e3-e631e6d3f7e8&spaceId=2950ddb3-8913-815e-9114-00037db8cb39&width=2000&userId=&cache=v2&imgBuildSrc=requestProxiedImageUrl',
      ARRAY['swiperadar', 'diabetes', 'glycobarrier', 'landing_page']::text[],
      'Landing page da oferta GlycoBarrier (Diabetes).',
      9,
      'Web',
      'SwipeRadar — Diabetes',
      'GlycoBarrier',
      'SwipeRadar',
      'lp'
    );