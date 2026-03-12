

# Plano: Melhorias no Tracker, WhatsApp, Docs, Funis e Market Intel

## 1. Tracker UTM -- Integração com plataformas

**Problema**: O Tracker atual cria links UTM mas nao tem campo para associar a plataforma de origem (Meta Ads, Google, TikTok) nem ao projeto.

**Solucao**:
- Adicionar campo `plataforma` (Meta Ads, Google Ads, TikTok Ads, Orgânico, Afiliado) no formulario de criacao de link
- Adicionar campo `project_id` com select de projetos (`imphq_projects`)
- Na tabela de links, mostrar coluna "Plataforma" com badge colorido por plataforma
- Filtros por plataforma e por projeto na aba Links
- Dashboard filtravel por plataforma: KPIs separados por Meta/Google/TikTok
- Preview da URL final com UTMs montada em tempo real (ja existe, manter)
- Tabela `imphq_tracking_links` ja tem `project_id` -- so precisa usar no form

## 2. WhatsApp -- QR Code por projeto

**Problema**: Pagina WhatsApp e read-only, sem funcionalidade util. Precisa gerar QR codes de WhatsApp por projeto.

**Solucao**:
- Reescrever `WhatsAppPage.tsx` com CRUD de "sessoes WhatsApp" por projeto
- Gerar QR code localmente usando a API `https://api.qrserver.com/v1/create-qr-code/` ou gerar SVG inline via biblioteca JS
- Para cada projeto, o usuario configura: numero de WhatsApp, mensagem padrao, nome do bot
- QR code gerado aponta para `https://wa.me/{numero}?text={mensagem_codificada}`
- Exibir QR code como imagem para download/scan
- Usar a tabela `imphq_wa_conversations` existente (tem `project_id`, `phone`, `session`)
- CRUD: criar nova sessao, listar por projeto, editar, deletar
- Cada sessao mostra: QR code renderizado, link direto, contador de conversas

**Nota**: QR code gerado client-side usando canvas/SVG -- sem dependencia externa. Usaremos a API publica de QR code (`https://api.qrserver.com`) para simplicidade.

## 3. Docs -- CRUD completo com Supabase

**Problema**: Pagina Docs (`src/pages/Docs.tsx`) e read-only. Precisa permitir criar, editar e visualizar docs salvos no Supabase.

**Solucao**:
- Reescrever `Docs.tsx` com:
  - Lista de docs e KB do Supabase (ja funciona)
  - Botao "+ Novo Doc" que cria doc via `imphq_docs` com `crypto.randomUUID()`
  - Click no card abre editor (titulo + textarea de conteudo)
  - Salvar, editar titulo, deletar
  - Filtro por categoria (`cat`) e por projeto (`project_id`)
- Aproveitar a mesma logica de `ProjetoDocs.tsx` mas sem filtro por `project_id` (mostra todos)
- Adicionar visualizacao do conteudo ao clicar (expandir card ou view lateral)

## 4. Funis -- Por projeto + visual estilo canvas

**Problema**: Funis nao filtra por projeto e o visual e basico (cards lineares).

**Solucao**:
- Adicionar select de projeto no topo (filtrar por `project_id`)
- No formulario de criacao, incluir `project_id`
- Redesenhar a view de detalhe do funil com visual "canvas":
  - Fundo com grid pontilhado (estilo canvas/Canva)
  - Etapas como nodes conectados por linhas SVG curvas (bezier)
  - Cada node e um card arredondado com icone, nome, metricas
  - Cores por taxa de conversao: verde (>30%), amarelo (10-30%), vermelho (<10%)
  - Conexoes SVG entre nodes com setas animadas
  - Layout horizontal scrollable com zoom visual
- Manter a edicao inline de visitantes/conversoes em cada node
- Adicionar drag para reordenar etapas (botoes cima/baixo como fallback)

## 5. Market Intel -- Mais colorido e visual

**Problema**: Interface monocromatica, tabelas sem cor. Precisa ser mais visual e atrativo.

**Solucao**:
- **Mapa de Nichos**: Adicionar badges coloridos por nicho (Saude=emerald, Espirit.=purple, Relacionamento=pink, Pets=amber, etc.), score com barra visual colorida, icones por nicho
- **Angulos de Copy**: Cards com borda colorida lateral (gradient), icones por tipo de angulo, destaque visual nos hooks com background colorido
- **Fabrica de Ofertas**: Badges coloridos por plataforma, barra de progresso visual para tempo de criacao
- **Header**: Adicionar stat cards coloridos (Total Ofertas, Media Score, Top Nicho)
- Cores gerais: usar gradients sutis nos cards, badges com cores semanticas, hover effects mais vivos

## Arquivos a editar

- **Editar**: `src/pages/Tracker.tsx` (filtros por plataforma/projeto)
- **Reescrever**: `src/pages/WhatsAppPage.tsx` (QR code por projeto)
- **Reescrever**: `src/pages/Docs.tsx` (CRUD completo)
- **Reescrever**: `src/pages/Funis.tsx` (por projeto + visual canvas)
- **Editar**: `src/pages/MarketIntel.tsx` (cores e visual)

Nenhuma migration necessaria -- todas as tabelas ja existem com os campos necessarios.

