

# Plano: Filtros Expert no Kanban + Contexto de Produto na IA + Melhorias no Painel Expert

## 9 melhorias solicitadas

### 1. Kanban Expert: mostrar apenas tarefas atribuidas

Hoje a aba "experts" agrupa TODOS os cards por nome do expert do projeto — mesmo cards sem atribuicao. Fix: filtrar na aba experts apenas cards que tenham `member_id` preenchido OU que pertencam ao board "experts", excluindo cards sem vinculo ao expert.

### 2. Filtro por Produto no Kanban

Adicionar Select "Produto" nos filtros avancados. Extrair lista de produtos de `projects[].data.produtos[].nome`. Filtrar cards cujo `project_id` pertenca a projetos que contenham aquele produto.

### 3. Enriquecer contexto de IA com dados do produto

No `openflow-ai/index.ts` (linhas 69-84), o contexto NAO inclui `mecanismo`, `contexto`, `copy_arsenal` e `links` dos produtos individuais. Adicionar ao contexto:
- Para cada produto: nome, mecanismo unico, contexto, copy_arsenal (promessa, inimigo_comum, metodo — resumido)
- `d.links` (redes sociais ativas do briefing)

### 4. IA de conteudo: selecionar produto em foco

`handleContentPlan` recebera campo `product_name` no body. O `ProjetoExpertPanel` ganhara um Select de produto antes de gerar plano. O prompt da IA recebera os dados especificos do produto selecionado (mecanismo, contexto, copy_arsenal completo).

### 5. Plataformas ativas baseadas no briefing

Ler `data.links` do briefing para determinar quais plataformas tem URL preenchida (Instagram, YouTube, TikTok, etc). No painel do expert, filtrar `PLATFORMS` e `aiPlatforms` para mostrar apenas as ativas. Fallback: mostrar todas se nenhuma configurada.

### 6. Sugestoes de Stories diarios

Na geracao por IA, instruir o prompt para incluir 1-2 stories por dia (bastidores, enquetes, CTA, quicktips). Tipo "Story" ja existe no `CONTENT_TYPES`.

### 7. Reels = TikTok = YouTube Shorts (cross-platform)

Adicionar campo `cross_platforms?: string[]` ao `ContentItem`. Na geracao por IA, instruir que Reels sao automaticamente multi-plataforma (Instagram Reels, TikTok, YouTube Shorts). Na UI, mostrar badges das plataformas adicionais no card. Evitar duplicar o mesmo conteudo como itens separados.

### 8. Videos longos para YouTube

Adicionar tipo "Video Longo" ao `CONTENT_TYPES`. Na IA, videos longos sao exclusivos para YouTube com roteiro mais detalhado na descricao.

### 9. Calendario visual no painel do Expert

Adicionar mini-calendario (componente `Calendar` do shadcn) com indicadores nos dias que tem conteudo planejado. Ao clicar num dia, scroll/highlight para os cards daquele dia. Incluir tambem no portal publico.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/KanbanPage.tsx` | Filtrar cards na aba experts (so atribuidos), adicionar filtro por Produto, expandir tipo `Filters` |
| `supabase/functions/openflow-ai/index.ts` | Enriquecer contexto com produtos individuais (mecanismo, contexto, copy_arsenal, links), aceitar `product_name` no content plan, instruir stories e cross-platform no prompt |
| `src/components/projeto/ProjetoExpertPanel.tsx` | Select de produto pre-IA, plataformas ativas do briefing, cross-platform badges, tipo "Video Longo", mini-calendario, campo `cross_platforms` no ContentItem |
| `src/pages/ExpertPortal.tsx` | Mini-calendario, cross-platform badges, tipo "Video Longo" |

## Ordem

1. Enriquecer contexto de IA com dados de produto + ajustar prompt (`openflow-ai`)
2. Filtros do Kanban (expert + produto)
3. Melhorias no painel do expert (plataformas ativas, produto em foco, calendario, cross-platform, stories, video longo)
4. Atualizar portal publico com mesmas melhorias visuais

