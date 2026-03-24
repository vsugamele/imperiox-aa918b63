

# Plano: Rotinas Diarias do Time + Tarefas Pessoais (estilo ClickUp)

## Problema

Hoje a pagina "Meu Dia" (Tarefas) mostra apenas cards do Kanban agrupados por prazo. Nao existe conceito de **rotinas recorrentes** (tarefas que o time precisa verificar todos os dias) nem separacao entre **tarefas do time** e **tarefas pessoais**.

## O que sera feito

### 1. Nova tabela `imphq_daily_routines`

Tabela dedicada para rotinas diarias (nao sao cards do Kanban — sao checklists permanentes):

```sql
CREATE TABLE imphq_daily_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'team', -- 'team' ou 'personal'
  member_id UUID REFERENCES imphq_team_members(id) ON DELETE SET NULL,
  project_id UUID REFERENCES imphq_projects(id) ON DELETE SET NULL,
  icon TEXT DEFAULT '✅',
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE imphq_routine_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES imphq_daily_routines(id) ON DELETE CASCADE NOT NULL,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(routine_id, check_date)
);
```

- `imphq_daily_routines`: lista de rotinas permanentes (ex: "Verificar Comunidade Clube das Brabas")
- `imphq_routine_checks`: registro de conclusao por dia (permite saber se foi feito hoje)
- `category = 'team'` = visivel para todos; `'personal'` = so para o criador

### 2. Redesign da pagina Tarefas com 2 abas visuais

**Aba "Rotinas do Dia"** (nova, padrao):
- Secao **"Rotinas do Time"**: lista visual com checkbox, icone/emoji, titulo, responsavel (avatar), projeto vinculado. Estilo card colorido tipo ClickUp
- Secao **"Minhas Rotinas"**: mesma UI, mas filtrada por `category = 'personal'`
- Barra de progresso no topo: "7/10 rotinas concluidas hoje"
- Botao "Nova Rotina" abre dialog com: titulo, emoji, categoria (time/pessoal), responsavel, projeto
- Ao marcar checkbox, insere em `imphq_routine_checks` para a data de hoje
- Ao desmarcar, deleta o check daquele dia
- Menu "..." em cada rotina: editar, excluir, mover para pessoal/time
- Visual: cards com fundo colorido sutil, icone grande a esquerda, checkbox a direita, agrupados por categoria

**Aba "Tarefas"** (conteudo atual):
- Mantem toda a funcionalidade existente do "Meu Dia" (overdue, hoje, proximos 3 dias, sem prazo, concluidas)

### 3. Visual inspirado no ClickUp

- Cards de rotina com bordas coloridas por categoria (azul = time, roxo = pessoal)
- Icones/emojis grandes no card
- Progress ring ou barra no header mostrando % concluido
- Animacao suave ao marcar/desmarcar (check com fade)
- Grid responsivo: 1 coluna mobile, 2 colunas desktop

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar `imphq_daily_routines` e `imphq_routine_checks` com RLS |
| `src/pages/Tarefas.tsx` | Adicionar tabs "Rotinas do Dia" / "Tarefas", componente de rotinas com CRUD, progress bar |

