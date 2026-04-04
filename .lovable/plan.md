

# Diagnóstico: Cruzamento Ads x Vendas + Melhorias Gerais

---

## Resposta: Sim, está cruzando — mas tem um bug nos filtros

O cruzamento Ads x Vendas **funciona** em 3 lugares:
- **KPIs globais** (linha 123): `roas = totalReceita / adsTotal` ✅
- **FinancasOverview**: ROAS Real, CPA Real, gráfico timeline Ads vs Vendas ✅
- **FinancasPerformance**: cruza por produto, distribui ads proporcional à receita ✅

**Bug encontrado**: Os `projectSummaries` (linha 126-135) usam os dados **sem filtro** (`ads`, `vendas`, `projectCosts`) em vez dos filtrados (`fAds`, `fVendas`, `fProjectCosts`). Ou seja, quando você filtra por data ou produto, os cards de Visão Geral por projeto **não mudam**.

---

## Plano de Correções + Melhorias

### 1. Corrigir projectSummaries para respeitar filtros
Linhas 126-135 de `Financas.tsx`: trocar `projectCosts` → `fProjectCosts`, `ads` → `fAds`, `vendas` → `fVendas`, `projectRevenues` → `fProjectRevenues`.

### 2. Melhorias identificadas no projeto

| Area | Problema | Melhoria |
|---|---|---|
| **Financas - KPIs** | ROAS no topo mostra `0.00x` mesmo com dados porque usa receita total (vendas+manual) mas não tem ads | Mostrar ROAS apenas quando `adsTotal > 0`, senão esconder o card |
| **Financas - Ads** | Tabela mostra apenas 100 registros sem paginação | Adicionar paginação real (50 por página) |
| **Dashboard** | `loadAdsGlobal` roda separado do `loadDash` — dados podem ficar dessincronizados | Unificar em um único `useEffect` |
| **Leads - FormBuilder** | Formulários criados mas sem preview de como fica o form renderizado | Adicionar preview ao vivo do formulário no builder |
| **Leads - Insights** | Componente criado mas pode não ter dados reais de `form_responses` | Adicionar estado vazio mais explicativo |
| **Pesquisa Intel** | Depende de edge functions que podem falhar silenciosamente | Adicionar loading states e tratamento de erro visível |
| **Central Conteúdo** | Geração de LP retorna HTML bruto sem sanitização | Usar iframe sandbox para preview seguro (já faz) ✅ |
| **Custos globais** | Não tem filtro de data (são custos fixos mensais) | Adicionar campo "recorrência" (mensal/anual/único) para cálculo correto |
| **WhatsApp** | Página existe mas pode não ter provider configurado | Melhorar onboarding com wizard de configuração |

### 3. Ações imediatas (prioridade alta)

**Arquivo `Financas.tsx`**:
- Fix: `projectSummaries` usar dados filtrados
- Fix: esconder ROAS card quando não há ads

**Arquivo `FinancasAds.tsx`**:
- Adicionar paginação (página atual + total)

**Arquivo `Dashboard.tsx`**:
- Garantir que filtro de projeto aplica a TODAS as seções (verificar se `loadDash` também filtra por `dashProject`)

---

## Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/Financas.tsx` | Fix projectSummaries com filtros, ROAS condicional |
| `src/components/financas/FinancasAds.tsx` | Paginação na tabela |
| `src/pages/Dashboard.tsx` | Verificar/corrigir filtro projeto em todas as seções |

