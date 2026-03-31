

# Plano: Funis Integrados ao Projeto, Upload Múltiplo, Clareza nas Receitas

---

## 1. Funis — Puxar produtos, ofertas e URLs do projeto selecionado

**Problema**: Ao criar/editar um funil vinculado a um projeto, os produtos do briefing já são carregados (linha 120-134), mas não são usados de forma prática. O editor não sugere etapas baseadas nos produtos, nem preenche URLs ou ofertas automaticamente.

**Melhorias**:

- **Painel lateral "Dados do Projeto"** no editor do funil: quando `project_id` está definido, exibir uma sidebar colapsável com:
  - Lista de produtos com nome, preço, tipo e URL de checkout (do briefing `produtos[].ofertas[].link`)
  - Botão "Adicionar como etapa" que cria um card no canvas com nome do produto, tipo correto (checkout/upsell) e URL já preenchida
  - Links do projeto (`data.links`) para referência rápida
  - Webhooks configurados (plataforma detectada)

- **Auto-preencher URL na etapa**: Quando o usuário seleciona um produto do briefing para uma etapa, a URL de checkout preenche automaticamente o campo `url` da etapa.

- **Badge de produto na etapa**: Se a etapa tem um produto associado, exibir badge com o nome/preço dentro do card no canvas.

**Arquivo**: `src/pages/Funis.tsx`

---

## 2. Upload múltiplo de arquivos (tarefas e projeto)

**Problema**: O componente `FileUpload` aceita apenas 1 arquivo por vez (`e.target.files?.[0]`). Para anexar 5 fotos, precisa clicar 5 vezes.

**Solução**:
- Adicionar prop `multiple?: boolean` ao `FileUpload`
- Quando `multiple=true`, usar `input.multiple = true` e iterar sobre `e.target.files` fazendo upload de cada um
- Callback `onUpload` chamado para cada arquivo (ou nova callback `onUploadMultiple` com array de URLs)
- Aplicar `multiple` no `CardDetailPanel.tsx` (anexos de tarefas) e em `ProjetoMidia.tsx` (mídia do projeto)

**Arquivos**: `src/components/FileUpload.tsx`, `src/components/kanban/CardDetailPanel.tsx`, `src/components/projeto/ProjetoMidia.tsx`

---

## 3. Receitas na Dashboard e Tracker — clareza sobre origem dos dados

**Problema**: Na Dashboard, `totalReceita` soma `imphq_vendas` (status aprovado) + `imphq_project_revenue` — sem filtro de período nem indicação de projeto/produto. No Tracker, `totalReceita` vem de `imphq_vendas` filtrada por plataforma/projeto dos links, mas o campo `custo` vem de `imphq_clicks.custo` que provavelmente está vazio.

**Melhorias na Dashboard**:
- Adicionar tooltip ou subtítulo explicando a composição: "Vendas (webhook) + Receitas manuais"
- No card de receita, mostrar breakdown: `R$ X (vendas) + R$ Y (manual)`
- Adicionar filtro de período (7d, 30d, mês atual) nos KPIs financeiros
- No gráfico Receita vs Custo, exibir legenda clara com as fontes

**Melhorias no Tracker**:
- Exibir de qual tabela vem cada número — a Receita vem de `imphq_vendas` filtradas
- Mostrar filtro de período (hoje, 7d, 30d) nos KPIs do dashboard do Tracker
- Quando filtrado por projeto, exibir nome do projeto nos KPIs
- Se `totalGasto` = 0 (porque `imphq_clicks.custo` está vazio), exibir aviso: "Sem dados de gasto. Integre via imphq_ads_spend ou configure custos nos links"
- Considerar puxar gastos de `imphq_ads_spend` (filtrado por projeto/período) como fallback para o gasto

**Arquivos**: `src/pages/Dashboard.tsx`, `src/pages/Tracker.tsx`

---

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Funis.tsx` | Painel lateral com produtos/ofertas/URLs do projeto, botão "adicionar como etapa", auto-preencher URL |
| `src/components/FileUpload.tsx` | Suporte a `multiple`, iterar sobre todos os arquivos |
| `src/components/kanban/CardDetailPanel.tsx` | Usar `multiple` no FileUpload de anexos |
| `src/components/projeto/ProjetoMidia.tsx` | Usar `multiple` no FileUpload de mídia |
| `src/pages/Dashboard.tsx` | Breakdown de receita (vendas vs manual), filtro de período, tooltips explicativos |
| `src/pages/Tracker.tsx` | Filtro de período, fallback para gastos via `imphq_ads_spend`, avisos quando dados estão vazios |

