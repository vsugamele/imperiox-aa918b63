

# Plano: Corrigir 4 problemas de UX

---

## Problemas identificados

1. **Formulários de captura nunca foram adicionados na UI** — os arquivos `FormBuilder.tsx` e `FormInsights.tsx` foram criados mas nunca importados no `Leads.tsx`. As abas "Formularios" e "Insights" nao existem.
2. **Analytics de leads nao filtra por projeto** — a aba Analytics em Leads mostra dados globais, sem Select de projeto.
3. **Duas abas de pesquisa duplicadas no projeto** — "Pesquisa" (scraping de URL do expert) e "Pesquisa Intel" (concorrentes/produtos/experts via IA) fazem coisas similares. Unificar em uma so aba.
4. **Dashboard sem filtro de projeto** — o `dashPeriod` filtra por periodo mas nao por projeto.

---

## Solucoes

### 1. Adicionar abas Formularios + Insights em Leads.tsx

- Importar `FormBuilder` e `FormInsights` de `src/components/leads/`
- Adicionar 2 TabsTrigger: "📝 Formularios" e "💡 Insights"
- Adicionar os respectivos TabsContent com os componentes

### 2. Filtro por projeto no Analytics de Leads

- Na aba Analytics, adicionar um Select com todos os projetos (ja temos `projects` carregados)
- Filtrar os dados de analytics (`leads`) pelo `project_id` selecionado
- Default: "Todos os projetos"

### 3. Unificar Pesquisa + Pesquisa Intel em uma aba

- Remover a aba "Pesquisa" (`ProjetoPesquisa`) separada
- Integrar a funcionalidade de scraping de URL do expert (que `ProjetoPesquisa` faz) dentro de `ProjetoPesquisaInteligente` como uma 4a sub-aba "Expert URL"
- Renomear a aba para "🔍 Pesquisa" (unica)
- Mover o historico de pesquisas do `ProjetoPesquisa` para dentro do componente unificado

### 4. Filtro de projeto no Dashboard

- Adicionar um Select de projeto ao lado do Select de periodo existente
- Carregar lista de projetos e filtrar todos os dados (stats, leads trend, receita, ads) pelo projeto selecionado
- Default: "Todos"

---

## Arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `src/pages/Leads.tsx` | Importar FormBuilder/FormInsights, adicionar 2 abas, filtro projeto no analytics |
| `src/pages/ProjetoDetalhe.tsx` | Remover aba "Pesquisa" separada, renomear "Pesquisa Intel" para "Pesquisa" |
| `src/components/projeto/ProjetoPesquisaInteligente.tsx` | Absorver funcionalidade de scraping de URL do ProjetoPesquisa |
| `src/pages/Dashboard.tsx` | Adicionar Select de projeto, filtrar dados por project_id |

