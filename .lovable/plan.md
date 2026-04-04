

# Plano: Forms com Projeto + Custos Operacionais + Projeção Mensal

---

## 3 Problemas Identificados

### 1. Formulários sem contexto de projeto e sem salvar na jornada do lead
O FormBuilder salva `project_id` no formulário, e o `capture-lead` usa isso. **Mas**: a lista de formulários não mostra claramente o projeto/produto associado, e as respostas do formulário (`imphq_lead_responses`) **nunca aparecem na timeline do lead** em Leads.tsx — não há nenhuma query a `imphq_lead_responses` na timeline.

**Correções**:
- **Leads.tsx (timeline)**: Ao abrir um lead, buscar `imphq_lead_responses` pelo `lead_id` e exibir como eventos na timeline (tipo "FormResponse") com as respostas formatadas
- **FormBuilder.tsx**: Na listagem, mostrar badge do projeto e produto de forma mais visível. Adicionar filtro por projeto na lista de formulários

### 2. Finanças sem visão mensal, projeção e progressão
Hoje os KPIs mostram totais do período filtrado mas sem contexto de: quanto já faturou no mês, quanto falta, projeção baseada no ritmo atual, comparação com mês anterior.

**Correções no FinancasOverview.tsx**:
- Adicionar seção "Resumo do Mês" com:
  - Dias passados / dias totais do mês
  - Receita até agora + Projeção para fim do mês (receita_atual / dias_passados * dias_totais)
  - Comparação com mês anterior (% crescimento)
  - ROAS do mês + tendência
  - Lucro projetado (receita projetada - custos projetados)
- Gráfico de progressão acumulada do mês (receita acumulada dia a dia vs meta/mês anterior)

### 3. Custos sem categorização de salários, pró-labore, tipo de recorrência
A tabela `imphq_project_costs` tem campo `recorrente` (boolean) e `categoria`, mas falta: para quem é o custo (beneficiário), se é mensal/pontual, tipo específico (salário, pró-labore, freelancer, ferramenta).

**Correções**:
- **Migração SQL**: Adicionar colunas `beneficiario` (text), `tipo_recorrencia` (text: 'mensal', 'pontual', 'trimestral', 'anual') na tabela `imphq_project_costs`
- **Financas.tsx (aba Custos)**: Adicionar seção "Custos Fixos / Equipe" separada dos custos de projeto, com campos para beneficiário e tipo de recorrência
- **ProjetoFinancas.tsx**: Formulário de custo com campos de beneficiário e tipo de recorrência
- **FinancasOverview.tsx**: Incluir custos fixos (salários/pró-labore) no cálculo de lucro líquido mensal

---

## Detalhes Técnicos

### Migração SQL
```sql
ALTER TABLE imphq_project_costs
  ADD COLUMN IF NOT EXISTS beneficiario text,
  ADD COLUMN IF NOT EXISTS tipo_recorrencia text DEFAULT 'mensal';
```

### Timeline com respostas de formulário (Leads.tsx)
- Query: `supabase.from("imphq_lead_responses").select("*, imphq_capture_forms(nome)").eq("lead_id", leadId)`
- Renderizar como evento com ícone de formulário, nome do form, e lista de respostas key/value

### Projeção mensal (FinancasOverview.tsx)
- Calcular `diasPassados` e `diasTotais` do mês atual
- `projecaoReceita = (totalReceita / diasPassados) * diasTotais`
- Buscar dados do mês anterior para comparação (% variação)
- Card visual com barra de progresso do mês

---

## Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| **Migração SQL** | `beneficiario`, `tipo_recorrencia` em `imphq_project_costs` |
| `src/pages/Leads.tsx` | Timeline carregando respostas de formulários como eventos |
| `src/components/leads/FormBuilder.tsx` | Filtro por projeto na listagem, badges mais visíveis |
| `src/components/financas/FinancasOverview.tsx` | Seção "Resumo do Mês" com projeção, progressão, comparação |
| `src/pages/Financas.tsx` | Custos com beneficiário e tipo recorrência no form e tabela |
| `src/components/projeto/ProjetoFinancas.tsx` | Campos beneficiário/recorrência no form de custos |

---

## Ordem de Execução

1. Migração SQL (2 colunas)
2. Timeline do lead com respostas de formulário
3. FormBuilder com filtro por projeto
4. Custos com beneficiário e tipo de recorrência
5. Projeção mensal no FinancasOverview

