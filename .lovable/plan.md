

# Plano: Correção de Bugs + Roadmap de Gestão, Processos e CRM

## Bugs Identificados (Correção Imediata)

### Bug 1: Concorrentes não salvam
**Causa raiz**: A coluna `score_escala` e `score_max` no banco são do tipo `INTEGER`, mas o parser envia valores `float` (ex: `8.5`). O Supabase rejeita o insert silenciosamente — o erro é engolido no código (linha 155: `if (!error && data)`).

**Fix**: No `useConcorrentes.ts`, arredondar `score_escala` e `score_max` com `Math.round()` antes do insert. Também adicionar `console.error` quando o insert falha para facilitar debug futuro.

### Bug 2: Aba "Analytics" duplicada
**Causa raiz**: Linha 143-144 de `ProjetoDetalhe.tsx` — há dois `<TabsTrigger value="analytics">` idênticos.

**Fix**: Remover a linha duplicada (linha 144).

---

## Roadmap Completo (Fases)

O plano de implementação que você enviou é extenso e muito bem estruturado. Vou organizá-lo em fases executáveis, começando pelo que dá resultado imediato.

### Fase 1: Fundação — Correções + Filtro Global de Projeto

| Arquivo | Ação |
|---|---|
| `src/components/projeto/concorrentes/useConcorrentes.ts` | Fix: `Math.round()` nos scores antes do insert |
| `src/pages/ProjetoDetalhe.tsx` | Fix: Remover TabsTrigger duplicada |

### Fase 2: Unificação de Tarefas → "Meu Dia"

Transformar `Tarefas.tsx` num Daily Planner que puxa de `imphq_kanban_cards`:

- **Painel "Hoje"**: Cards atribuídos ao usuário logado com `due_date = today`
- **Seção "Atrasadas"**: Cards com `due_date < today` e status != done
- **Seção "Próximos Dias"**: Cards dos próximos 3 dias
- **Quick-add**: Adicionar tarefa que cria card automaticamente no Kanban (coluna Backlog)
- **Check-off rápido**: Marcar como done direto da lista

| Arquivo | Ação |
|---|---|
| `src/pages/Tarefas.tsx` | Refatorar completamente → Daily Planner |

### Fase 3: Templates de Projetos (Playbooks)

- Nova tabela `imphq_project_templates` com colunas: `id`, `name`, `description`, `icon`, `boards_json` (JSONB com quadros + colunas + cards pré-definidos)
- No `Projetos.tsx`, botão "Criar a partir de Template" que gera automaticamente quadros Kanban com cards estruturados
- Templates iniciais: "Canal Dark YT", "Infoproduto", "Expert Onboarding"

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_project_templates` |
| `src/pages/Projetos.tsx` | Adicionar botão "Criar de Template" + dialog de seleção |

### Fase 4: CRM — Qualificação de Leads

- Nova aba "📝 Qualificação" no modal de edição do Lead
- Formulário interno: dor principal, nível de consciência, renda estimada, objeções, canal de origem
- Dados salvos no campo JSONB `data` do lead existente

| Arquivo | Ação |
|---|---|
| `src/pages/Leads.tsx` | Adicionar aba Qualificação no modal de lead |

### Fase 5: Growth Dashboard (Indicadores de Crescimento)

- Nova tabela `imphq_growth_metrics` vinculada a `project_id` com colunas por categoria do funil (awareness, engagement, acquisition, conversion, retention, upsell)
- Nova página ou seção no Dashboard com tabela semanal/mensal tipo planilha
- Semáforo visual (verde/amarelo/vermelho) contra metas
- Filtro por projeto

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_growth_metrics` |
| `src/pages/Dashboard.tsx` ou nova página | Growth Dashboard com tabela + semáforo |

### Fase 6: API & Webhooks (Integrações IA)

- Edge Functions: `POST /tasks`, `POST /leads`, `GET /projects/:id/status`
- Nova tabela `imphq_api_keys` para tokens de acesso
- Nova aba "API & Webhooks" em `Configuracoes.tsx`

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_api_keys` |
| `supabase/functions/imperio-api/index.ts` | Edge Function com endpoints |
| `src/pages/Configuracoes.tsx` | Aba API & Webhooks |

---

## Estratégia de Execução

Recomendo implementar na ordem: **Fase 1 → 2 → 4 → 3 → 5 → 6**. 

A Fase 1 (bugs) é imediata. A Fase 2 (Daily Planner) e 4 (CRM) trazem valor operacional rápido. Fases 3, 5 e 6 são estruturais e podem ser iteradas.

Devo começar pela **Fase 1 (correção dos bugs) + Fase 2 (Daily Planner)**?

