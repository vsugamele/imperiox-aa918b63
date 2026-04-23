

## Finalizar Sprint 2 + Sprints 3 e 4

Plano dividido em 3 etapas. Aprove e eu executo na ordem.

---

### Etapa A — Fechar Sprint 2 (Recuperação)

Pendências da rodada anterior:

1. **Rota `/recuperacao`** em `src/App.tsx` apontando pra `Recuperacao.tsx`.
2. **Item de menu** "Recuperação" no `AppSidebar.tsx`, grupo CRM & Intel, ícone `LifeBuoy`, cor `text-emerald-400`.
3. **Mini-bloco no Comando**: importar `RecoveryKpiBlock` em `ProjetoComando.tsx` e renderizar ao lado dos demais KPIs.
4. **Seed de templates default** ao abrir `/recuperacao` pela primeira vez (5 templates: pix_2h, pix_24h, boleto, carrinho, reembolso) — cada projeto começa com base pronta editável.

---

### Etapa B — Sprint 3: Cohort & LTV por canal

Objetivo: descobrir qual canal/campanha traz cliente que **fica e recompra**, não só converte.

1. **Nova página `/cohort`** (ou aba dentro de `/financas`):
   - **Tabela cohort por mês de aquisição** × meses subsequentes (% de leads que recompraram).
   - **LTV médio por canal** (utm_source): receita total / leads únicos do canal.
   - **Payback period**: dias até o cliente cobrir o CAC daquele canal.
   - **Top 5 canais por LTV/CAC ratio** (quem dá mais dinheiro por real investido).

2. **Lógica em `src/lib/cohortAnalysis.ts`**:
   - Agrupa leads por `utm_source` + mês de criação.
   - Cruza com `imphq_vendas` pra calcular receita acumulada por cohort.
   - Calcula CAC usando `imphq_ads_spend` proporcional ao canal.

3. **Drill-down**: clicar numa célula abre painel lateral com a lista de leads daquela cohort.

4. **Sem migration nova** — reaproveita `imphq_leads`, `imphq_vendas`, `imphq_ads_spend`.

**Arquivos**: `src/pages/Cohort.tsx`, `src/components/cohort/CohortMatrix.tsx`, `src/components/cohort/LtvByChannelTable.tsx`, `src/components/cohort/PaybackChart.tsx`, `src/lib/cohortAnalysis.ts`. Edita `App.tsx` + `AppSidebar.tsx`.

---

### Etapa C — Sprint 4: Copilot Imperius (chat estratégico)

Objetivo: ChatGPT do seu negócio. Pergunta em linguagem natural, IA responde com dados reais + ação sugerida.

1. **Botão flutuante `<CopilotFab />`** no `AppLayout.tsx` (canto inferior direito, ícone Crown dourado).

2. **Painel lateral `<CopilotPanel />`** abre ao clicar:
   - Sugestões iniciais ("Qual canal tá com pior CPA esta semana?", "Quais leads quentes esfriaram?", "Onde tá vazando dinheiro?").
   - Histórico de conversas persistido em `imphq_copilot_threads`.

3. **Edge Function `copilot-imperius`**:
   - Recebe pergunta + project_id ativo.
   - Roda **3–5 queries paralelas** no Supabase (vendas 30d, leads quentes, ads ativos, recuperação pendente, cohort recente).
   - Monta contexto compacto (~3k tokens) e envia pro Gemini com persona Imperius.
   - Retorna resposta + **ações sugeridas** (botões: "Abrir Recuperação", "Ver lead X", "Pausar campanha Y").

4. **Migration**: tabela `imphq_copilot_threads` (id, user_id, project_id, title, messages jsonb[], created_at) com RLS por user_id.

**Arquivos**: `src/components/copilot/CopilotFab.tsx`, `src/components/copilot/CopilotPanel.tsx`, `src/components/copilot/CopilotMessage.tsx`, `supabase/functions/copilot-imperius/index.ts`. Edita `AppLayout.tsx`. Migration nova.

---

### Ordem de execução

A → B → C, em mensagens separadas. Cada etapa fecha completa antes da próxima.

**Fora de escopo (Sprint 5+)**: voice input no Copilot, exportação PDF de cohort, alertas push proativos do Imperius.

