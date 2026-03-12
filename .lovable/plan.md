

# Plano: Kanban funcional + Tracker/Meta completo + Funis com etapas + Leads com CRUD

Este plano cobre 4 sistemas que estao incompletos ou quebrados.

## 1. Kanban -- CRUD completo com drag-and-drop

**Problema**: A pagina Kanban e read-only. Nao cria cards, nao move entre colunas, nao edita.

**Solucao**: Reescrever `KanbanPage.tsx` com:
- Usar a tabela `imphq_kanban_cards` que ja existe (tem `column_id`, `position`, `title`, `priority`, `due_date`, `tags`, `project_id`)
- Usar `imphq_kanban_columns` que ja existe (tem `title`, `position`, `color`, `project_id`)
- Inicializacao automatica: ao abrir um board, se nao existirem colunas para aquele board, cria as 5 default (backlog, doing, stuck, review, done)
- Botao "+ Card" em cada coluna -> Dialog com titulo, prioridade, due_date
- Click no card -> Dialog de edicao com todos os campos
- Drag-and-drop entre colunas: usar logica simples de botoes "mover para" (setas esquerda/direita) por enquanto, ja que drag-and-drop nativo e complexo sem lib
- Deletar card
- Filtro por board (agentes, humanas, criativos, campanhas) usando metadata ou um campo `board` -- usaremos `project_id` ou o campo `metadata` JSONB para guardar o board name

**Nota sobre tabelas**: `imphq_kanban_cards.id` e auto-gerado (UUID default). `imphq_kanban_columns.id` tambem. Nao precisa migration.

**Abordagem para boards**: Como nao existe campo `board` explicitamente, vamos usar o campo `metadata` JSONB do card e associar colunas por convencao: criaremos um set de colunas por board (com `project_id = null` e um convencao de title como `backlog|agentes`). Alternativa melhor: adicionar coluna `board` nas tabelas de kanban via migration.

**Migration necessaria**: Adicionar coluna `board TEXT DEFAULT 'agentes'` em `imphq_kanban_columns` e `imphq_kanban_cards`.

## 2. Tracker / Meta -- Dashboard financeiro completo

**Problema**: So mostra uma tabela de links sem CRUD. Nao tem dashboard de KPIs, nao cria links, nao compara metricas.

**Solucao**: Reescrever `Tracker.tsx` com:
- **Header com KPIs**: cards mostrando Total Gasto, CPL medio, ROAS, CTR, CPA (calculados a partir de `imphq_clicks` + `imphq_vendas` + `imphq_tracking_links`)
- **CRUD de Links UTM**: Dialog para criar novo link com campos (nome, destino, utm_source, utm_medium, utm_campaign, utm_content, utm_term, project_id)
- **Tabela de Links**: com todas as colunas UTM visiveis, status ativo/inativo toggle, copiar URL final montada, contador de clicks (query count de `imphq_clicks` por link_id)
- **Secao de Metricas por Link**: expandir row para ver clicks, conversoes, taxa de conversao
- A URL final gerada sera: `{destino}?utm_source={}&utm_medium={}&utm_campaign={}&utm_content={}&utm_term={}`

Tabelas ja existem: `imphq_tracking_links` (destino, utm_*, nome, project_id), `imphq_clicks` (link_id, ip, ua, convertido, utm_*). Nao precisa migration.

Note: `imphq_tracking_links.id` requer valor na insercao (TEXT, nao auto-gen). Gerar UUID client-side.

## 3. Funis -- Sistema de etapas com metricas

**Problema**: So mostra cards readonly sem CRUD.

**Solucao**: Reescrever `Funis.tsx` com:
- **CRUD de Funis**: criar, editar nome/tipo/status, deletar
- **Detalhe do Funil**: ao clicar, abre view de etapas dentro do JSONB `data` do funil
- **Etapas visuais**: representacao visual tipo pipeline (Anuncio -> Opt-in -> VSL -> Checkout -> Upsell)
- Cada etapa mostra: nome, visitantes, conversoes, taxa (calculados ou inputados manualmente)
- **Metricas integradas**: mostrar leads associados (query `imphq_leads` por `funil_id`) e vendas (query `imphq_vendas` por `funil_id`)
- O campo `data` JSONB no funil armazena as etapas: `{ etapas: [{ nome, visitantes, conversoes }] }`

`imphq_funis.id` e TEXT nao auto-gen -> gerar UUID client-side.

## 4. Leads -- CRUD completo com tags e qualificacao

**Problema**: Tabela read-only, sem criar, editar ou deletar leads.

**Solucao**: Atualizar `Leads.tsx` com:
- **Criar Lead**: Dialog com nome, email, phone, plataforma, status, funil_id, project_id, tags
- **Editar inline**: click na row abre edicao
- **Tags editaveis**: usar `EditableTagList` existente para o campo `tags` (TEXT[])
- **Score automatico**: baseado em status e total_gasto
- **Deletar lead**
- **Filtro por status** (lead, cliente, vip, inativo)
- **Filtro por projeto** (select com projetos)

`imphq_leads.id` e TEXT nao auto-gen -> gerar UUID client-side.

## Migration SQL necessaria

```sql
ALTER TABLE imphq_kanban_columns ADD COLUMN IF NOT EXISTS board TEXT DEFAULT 'agentes';
ALTER TABLE imphq_kanban_cards ADD COLUMN IF NOT EXISTS board TEXT DEFAULT 'agentes';
```

## Arquivos a criar/editar

- **Editar**: `src/pages/KanbanPage.tsx` (reescrever completo)
- **Editar**: `src/pages/Tracker.tsx` (reescrever completo)
- **Editar**: `src/pages/Funis.tsx` (reescrever completo)
- **Editar**: `src/pages/Leads.tsx` (adicionar CRUD)

## Escopo total

~4 arquivos editados, 1 migration. Todas as tabelas ja existem no Supabase. Foco em tornar tudo funcional com CRUD real.

