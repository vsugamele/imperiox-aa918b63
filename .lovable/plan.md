

# Redesign da Página de Detalhe do Projeto (`/projetos/:id`)

Baseado nas screenshots de referência, a página atual tem apenas 3 abas simples. O objetivo e reconstruir com 9 abas completas, formulários editáveis inline, e layout fiel ao design original.

## Estrutura de Dados

O `imphq_projects` já possui campos JSONB que comportam tudo:
- `data` -- armazena briefing (nome, categoria, orçamento, status, links, produtos), expert, avatar (desejos, dores, medos, objeções, posicionamento psicológico, sub-avatares, storyboard), KPIs
- `avatar` -- campo JSONB dedicado ao avatar
- `brand_kit` -- campo JSONB dedicado ao branding
- `pipeline` -- campo JSONB dedicado ao pipeline (copy, funil, avatar, design, prompts, trafego)

Nao serao necessarias migracoes de banco. Todos os dados serao lidos/escritos via update no JSONB.

## Abas a Implementar (9 tabs)

### 1. Header do Projeto
- Nome do projeto + botao editar, descricao, badges (categoria + status), porcentagem geral do pipeline no canto direito
- Botoes "Ver Pipeline" e "+ Sub"

### 2. Tab: Briefing
- **Dados do Projeto**: nome, categoria, orcamento trafego, status geral (select)
- **Pipeline Rapido**: barras de progresso lado a lado (copy, funil, avatar, design, prompts, trafego)
- **Links do Projeto**: campos editaveis site, whatsapp, instagram
- **Produtos do Projeto**: lista de produtos com CRUD (nome, tipo, preco, status, objetivo, contexto, mecanismo unico)

### 3. Tab: Expert
- **Dados Pessoais**: nome completo, URL foto, area de atuacao, bio curta, anos experiencia, alunos/clientes, certificacoes
- **Como Ele Fala**: tom de voz, palavras que usa, palavras que evita
- **O que Ele Ensina**: metodo/framework, pilares do ensino, transformacao prometida, temas/conteudos

### 4. Tab: Avatar
- **Desejos & Motivacao**: desejo externo, desejo interno core
- **Dores & Medos**: dores superficiais (tags), dores profundas (tags), medos especificos (tags), objecoes reais (tags)
- **Posicionamento Psicologico**: inimigo, resultado sonhado, trigger event, fase de consciencia
- **Sub-Avatares**: cards com nome, descricao, urgencia/dinheiro scores (dots)
- **Storyboard Narrativo**: secoes Antes, Trigger, Busca, Objecao, Decisao com bordas coloridas

### 5. Tab: Branding
- Paleta de cores, tipografia, tom visual, referencias visuais (lido de `brand_kit`)

### 6. Tab: KPIs
- Metricas do projeto (custo por lead, CAC, ROI, etc.) armazenadas em `data.kpis`

### 7. Tab: Pipeline
- Visualizacao detalhada do pipeline com barras de progresso editaveis (sliders)
- Cada etapa com notas/checklist

### 8. Tab: Midia
- Galeria de midias organizadas: Fotos do Expert, Fotos dos Produtos, Imagens Complementares
- Upload de imagens (via URL por agora)

### 9. Tab: Docs
- Lista de documentos do projeto (query `imphq_docs` filtrado por `project_id`)
- Botao "+ Novo Doc", editor inline

## Implementacao Tecnica

- **Arquivo principal**: `src/pages/ProjetoDetalhe.tsx` -- sera reescrito completamente
- **Componentes auxiliares**: criar pasta `src/components/projeto/` com componentes por aba:
  - `ProjetoBriefing.tsx`
  - `ProjetoExpert.tsx`
  - `ProjetoAvatar.tsx`
  - `ProjetoBranding.tsx`
  - `ProjetoKPIs.tsx`
  - `ProjetoPipeline.tsx`
  - `ProjetoMidia.tsx`
  - `ProjetoDocs.tsx`
- **Auto-save**: cada campo faz debounced update ao `imphq_projects` via Supabase
- **Tags editaveis**: componente reutilizavel de tags com "+ add" para dores, medos, objecoes
- **Sub-avatares**: cards em grid com modal de criacao/edicao
- **Storyboard**: secoes com borda lateral colorida (verde, amarelo, laranja, vermelho, azul)

## Design
- Fundo escuro `#080607`, cards `#0e0b0d` com borda `#1e191c`
- Labels em uppercase dourado `#c9922a`
- Inputs com fundo `bg-secondary` e borda sutil
- Tabs com emojis coloridos conforme screenshots

