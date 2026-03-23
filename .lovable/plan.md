

# Plano: Melhorar Referências + Mover Import de Ads para dentro do Projeto

## Problema 1: Referências
A tela de referências está funcional mas visualmente pode melhorar — imagens não carregando bem, cards pouco informativos, e a experiência geral pode ser mais rica.

## Problema 2: Import de Ads no lugar errado
O import de Ads está apenas no dashboard global de Finanças. Faz mais sentido importar dentro da aba "Finanças" de cada projeto (ProjetoFinancas), pois os dados são por projeto. Os dados importados lá automaticamente refletiriam no dashboard consolidado de /financas.

## Alterações

### 1. Expandir `ProjetoFinancas.tsx` com aba de Ads

Adicionar dentro da aba Finanças do projeto:
- Seção/tab "Ads" com tabela de gastos de ads filtrados pelo `project_id`
- Botão "Importar CSV" que abre o `AdsImportDialog` já com o projeto pré-selecionado
- Botão "Novo Gasto" para entrada manual
- KPIs de ads do projeto: Total investido, CPC, CPL, Compras
- Os dados inseridos aqui automaticamente aparecem no dashboard /financas

### 2. Melhorar `ProjetoFinancas.tsx` com vendas reais

Além de custos e receitas manuais, mostrar vendas reais (`imphq_vendas`) do projeto:
- Nova seção "Vendas (automáticas)" com tabela das vendas aprovadas
- KPIs recalculados incluindo vendas reais + receitas manuais + gastos ads

### 3. Melhorar Referências

- Melhorar o card quando não há imagem (placeholder mais visual)
- Adicionar contagem de referências por tipo no header
- Click no card abre o dialog de edição (já funciona)
- Confirmar que o save no Supabase está funcionando corretamente (verificar RLS)

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoFinancas.tsx` | Expandir com seção Ads (import CSV + CRUD + KPIs) + vendas reais |
| `src/pages/Referencias.tsx` | Melhorias visuais nos cards e UX |

## Fluxo de dados

```text
Projeto (aba Finanças)          Dashboard /financas
┌──────────────────────┐        ┌──────────────────────┐
│ Custos do projeto    │───┐    │ Agrega TODOS projetos│
│ Receitas manuais     │   │    │                      │
│ Vendas reais         │   ├───▶│ KPIs consolidados    │
│ ★ Ads (import CSV)   │───┘    │ Gráficos cruzados    │
└──────────────────────┘        └──────────────────────┘
```

O import de Ads dentro do projeto grava em `imphq_ads_spend` com o `project_id`, e o dashboard /financas já lê essa tabela. Sem duplicação de dados.

