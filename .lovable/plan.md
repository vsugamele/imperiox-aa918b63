

# Plano: Fases 3, 4, 5 e 6 do Roadmap

## Fase 3: Templates de Projetos (Playbooks)

### Migration SQL
Nova tabela `imphq_project_templates` com estrutura JSONB para boards/columns/cards:

```sql
CREATE TABLE imphq_project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📋',
  category TEXT DEFAULT 'geral',
  boards_json JSONB NOT NULL DEFAULT '[]',
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_project_templates ENABLE ROW LEVEL SECURITY;
-- RLS policies for authenticated users
```

Seed com 3 templates iniciais (Canal Dark YT, Infoproduto, Expert Onboarding) inseridos via migration com `boards_json` contendo boards, columns e cards pré-definidos.

### Modificações em `src/pages/Projetos.tsx`
- Adicionar botão "📋 Criar de Template" ao lado do "Novo Projeto"
- Dialog de seleção de template com cards visuais (ícone, nome, descrição, preview de boards)
- Ao selecionar: cria o projeto + gera automaticamente as colunas e cards no Kanban baseado no `boards_json`

---

## Fase 4: CRM — Qualificação de Leads

### Modificações em `src/pages/Leads.tsx`
No modal de edição do lead (Dialog `editLead`), adicionar nova aba "📝 Qualificação" nas `TabsList`:

| Campo | Tipo | Opções |
|---|---|---|
| Dor Principal | Textarea | Texto livre |
| Nível de Consciência | Select | Inconsciente, Consciente do Problema, Consciente da Solução, Consciente do Produto, Totalmente Consciente |
| Renda Estimada | Select | Até R$3k, R$3k-R$8k, R$8k-R$15k, R$15k-R$30k, R$30k+ |
| Objeções | EditableTagList | Tags livres |
| Canal Principal | Select | Instagram, YouTube, TikTok, Google, WhatsApp, Indicação |
| Notas do Vendedor | Textarea | Texto livre |

Dados salvos no campo JSONB `data` do lead existente (`data.qualificacao`). Nenhuma migration necessária — usa campo JSONB já existente.

Na função `saveEdit`, incluir merge do `data.qualificacao` no update.

---

## Fase 5: Growth Dashboard

### Migration SQL
```sql
CREATE TABLE imphq_growth_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  category TEXT NOT NULL, -- awareness, engagement, acquisition, conversion, retention, upsell
  metric_name TEXT NOT NULL,
  valor NUMERIC(12,2) DEFAULT 0,
  meta NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, week_start, category, metric_name)
);
ALTER TABLE imphq_growth_metrics ENABLE ROW LEVEL SECURITY;
```

### Nova página ou seção no Dashboard
Opção escolhida: seção expandida no `Dashboard.tsx` (abaixo da saúde financeira).

- **Filtro por Projeto** no topo
- **Visão semanal**: tabela tipo planilha com colunas = semanas, linhas = métricas agrupadas por categoria
- **Semáforo**: célula verde (≥100% da meta), amarela (70-99%), vermelha (<70%)
- **Categorias**: Awareness (Seguidores, Page Views, Público Pixelado), Engagement (Comentários, Taxa Rejeição), Acquisition (Leads, Inscritos Webinar), Conversion (Visitas Checkout, Compras, CPA), Retention (Frequência, Logins, Churn), Upsell (Taxa Upsell, LTV)
- **CRUD inline**: clicar na célula para editar valor e meta

| Arquivo | Ação |
|---|---|
| `src/pages/Dashboard.tsx` | Adicionar seção Growth Dashboard com tabela semanal + semáforo |

---

## Fase 6: API & Webhooks (Integrações IA)

### Migration SQL
```sql
CREATE TABLE imphq_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_preview TEXT NOT NULL, -- últimos 8 chars
  permissions JSONB DEFAULT '["read"]',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_api_keys ENABLE ROW LEVEL SECURITY;
```

### Edge Function `supabase/functions/imperio-api/index.ts`
- Endpoints via query param `action`:
  - `POST` com `action=create_task`: Cria card no Kanban
  - `POST` com `action=create_lead`: Insere lead no CRM
  - `GET` com `action=project_status`: Retorna resumo do projeto (leads, tarefas, receita)
- Autenticação via header `x-api-key` validando contra `imphq_api_keys`

### Modificações em `src/pages/Configuracoes.tsx`
- Nova aba "🔗 API & Webhooks" no TabsList
- Listar chaves existentes (de `imphq_api_keys`) com preview mascarado
- Botão "Gerar Nova Chave" que cria UUID, mostra uma vez, salva hash
- Botão "Revogar" para deletar chave
- Documentação inline dos endpoints disponíveis

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_project_templates`, `imphq_growth_metrics`, `imphq_api_keys` |
| `src/pages/Projetos.tsx` | Botão "Criar de Template" + dialog de seleção + geração automática de Kanban |
| `src/pages/Leads.tsx` | Nova aba "📝 Qualificação" no modal de edição, salva em `data.qualificacao` |
| `src/pages/Dashboard.tsx` | Seção Growth Dashboard com tabela semanal, semáforo, CRUD inline |
| `src/pages/Configuracoes.tsx` | Nova aba "API & Webhooks" com gestão de chaves |
| `supabase/functions/imperio-api/index.ts` | Edge Function com 3 endpoints (tasks, leads, status) |
| `supabase/config.toml` | Registro da nova edge function |

