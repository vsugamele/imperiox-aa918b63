

# Plano: Leads por Projeto, Tracker UTM Templates, Script de Tracking, Funil Canvas Real e Facebook CAPI

## 1. Leads -- Realtime por Projeto

**O que muda**: Leads ja filtra por projeto, mas falta subscription realtime para ver leads entrando ao vivo.

- Adicionar `supabase.channel("leads").on("postgres_changes", ...)` para INSERT na tabela `imphq_leads`
- Quando chega novo lead, adicionar ao state sem reload completo
- Mostrar indicador visual (pulse/flash) no lead recem-chegado
- Toast automatico "Novo lead: {nome}" quando entra um lead no projeto filtrado

## 2. Tracker -- Botao UTM Template Meta Ads

**O que muda**: Adicionar botao "Preencher Meta Ads" no formulario de novo link que auto-preenche os campos UTM com macros do Meta:

```
utm_source={{site_source_name}}
utm_medium={{placement}}
utm_campaign={{campaign.name}}
utm_content={{adset.name}}
utm_term={{ad.name}}
```

- Botao ao lado do select de plataforma
- Ao selecionar Meta Ads, sugerir auto-preenchimento
- Templates prontos para Google Ads e TikTok tambem

## 3. Script de Tracking (imptrack.js)

**O que muda**: Criar `public/js/imptrack.js` -- script que o usuario coloca na landing page para capturar UTMs e enviar ao Supabase.

O script vai:
- Ler UTM params da URL (`utm_source`, `utm_medium`, etc.)
- Salvar em localStorage para persistir entre paginas
- No submit de formulario (ou evento custom), enviar click para `imphq_clicks` via Supabase REST API
- Na aba Tracker, mostrar snippet copiavel: `<script src="https://{supabase-url}/storage/v1/object/public/scripts/imptrack.js" async defer></script>`

**Alternativa mais simples**: Gerar o script inline como texto copiavel na interface, sem depender de storage. O usuario cola no site.

## 4. Funil Canvas -- Redesign Visual Completo

**O que muda**: Transformar o funil de uma lista horizontal em um canvas real inspirado na imagem de referencia (estilo Miro/board).

- **Grid 2D**: Etapas posicionadas em grid (nao so horizontal), com posicao x/y salvos no JSONB
- **Cards maiores**: Cada card mostra thumbnail grande (imagem ou screenshot da URL), nome, metricas, URL clicavel
- **Conectores curvos**: SVG paths curvos entre cards baseados nas posicoes
- **Tipos de card**: Criativo (imagem), Pagina (URL com preview), Checkout, Upsell -- cada um com visual proprio
- **Zoom e pan**: Container com scroll livre (overflow auto em ambas direcoes)
- **Drag simples**: Botoes para mover cards na grid (cima/baixo/esquerda/direita) -- sem lib de drag
- **Cores por tipo**: Criativo=rose, LP=blue, VSL=violet, Checkout=emerald, Upsell=amber

Dados da etapa (JSONB): `{ nome, tipo, visitantes, conversoes, url, image_url, pos_x, pos_y }`

## 5. Facebook CAPI -- Config por Projeto (Referencia da imagem)

**O que muda**: Adicionar configuracao de Facebook Pixel + CAPI por projeto, como mostra a segunda imagem.

- Salvar no JSONB `data` do `imphq_projects`: `{ facebook_pixel_id, facebook_access_token, facebook_test_event_code }`
- Dialog de configuracao acessivel na pagina do projeto (aba Briefing ou nova aba "Pixel")
- Opcao "Global" (fallback) salva em localStorage ou tabela de config
- Campos: Pixel ID, Access Token, Test Event Code (opcional)
- O `imptrack.js` lera o pixel_id para disparar eventos

## Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| `src/pages/Leads.tsx` | Adicionar realtime subscription |
| `src/pages/Tracker.tsx` | Botao UTM templates + snippet do script |
| `public/js/imptrack.js` | Script de tracking para landing pages |
| `src/pages/Funis.tsx` | Redesign canvas 2D com posicoes |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar config Facebook CAPI |

Nenhuma migration necessaria -- tudo usa campos JSONB existentes.

