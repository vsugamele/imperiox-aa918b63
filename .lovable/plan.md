

# Plano: Mostrar Formulario de Captura + Filtro por Formulario nos Leads

## Sobre deduplicacao

Sim, os leads sao deduplicados por email. Quando um lead ja existe, o `capture-lead` faz UPDATE em vez de INSERT — merges nome, telefone, tags, e acumula interacoes no campo `data.interacoes`. Cada formulario preenchido adiciona uma nova entrada. Entao quanto mais o lead interage, mais dados ele acumula.

## O que falta na interface

### 1. Coluna "Formulario" na tabela de leads

Os dados ja existem no lead: `data.form_name` e `data.form_id`. Basta extrair e exibir como uma nova coluna apos "Projeto". Mostrara o nome do formulario que capturou o lead (ex: "Teste", "Pesquisa Low Ticket").

### 2. Filtro por Formulario

Adicionar um `Select` de filtro com a lista de formularios existentes (buscar de `imphq_capture_forms`). Filtrar leads cujo `data->form_id` bate com o selecionado. Como o filtro e sobre um campo JSONB, aplicar no frontend (ja temos os leads carregados) ou usar `.filter()` no `contains`.

### 3. Exibir formulario no detalhe do lead

No painel lateral de edicao do lead, mostrar qual formulario o capturou (nome + step) de forma visivel, alem de ja estar na aba Qualificacao.

## Mudancas

| Arquivo | Mudanca |
|---|---|
| `src/pages/Leads.tsx` | Nova coluna "Formulario" na tabela, novo state `formFilter`, buscar `imphq_capture_forms` no load, filtro Select, exibir no detalhe |

## Ordem

1. Buscar lista de formularios no load inicial
2. Adicionar coluna "Formulario" na tabela (extrair de `data.form_name`)
3. Adicionar filtro Select por formulario
4. Mostrar info do formulario no painel de detalhe do lead

