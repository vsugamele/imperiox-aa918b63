

# Plano: Chat com Comandos + Dashboard Activity Log

## 1. Chat Interno com Comandos

### Tabelas novas

```sql
-- Mensagens do chat interno
CREATE TABLE imphq_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'command', 'system'
  metadata JSONB DEFAULT '{}', -- dados do comando executado (task criada, evento, etc)
  project_id UUID REFERENCES imphq_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity log para o dashboard
CREATE TABLE imphq_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL, -- 'task_created', 'lead_imported', 'project_updated', etc
  entity_type TEXT, -- 'task', 'lead', 'project', 'routine', 'event'
  entity_id UUID,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: usuario ve apenas suas mensagens e atividades do time (mesmo user_id ou equipe).

### Chat Page (`src/pages/Chat.tsx`)

- Interface estilo Slack/Discord: sidebar com canais (geral, por projeto), area de mensagens, input
- Comandos com `/`:
  - `/tarefa [titulo]` -- cria task em `imphq_tasks`
  - `/evento [titulo] [data]` -- cria evento em `imphq_calendar_events`
  - `/projeto [nome]` -- vincula mensagem a um projeto
  - `/lead [nome] [telefone]` -- cria lead rapido
- Autocomplete ao digitar `/` mostrando comandos disponiveis
- Ao executar comando, mostra card inline com o resultado (ex: "Tarefa criada: X")
- Acoes com mouse: botao "+" ao lado do input com menu de acoes rapidas (mesmas do /)
- Mensagens com markdown (react-markdown)

### Sidebar

- Novo item "Chat" no grupo principal (entre Tarefas e Leads)

---

## 2. Dashboard Activity Log

### Componente `ActivityFeed` no Dashboard

- Card "Atividade Recente" no Dashboard, apos os stats cards
- Lista cronologica das ultimas 15 acoes de todos os usuarios
- Cada item: avatar/nome do usuario, icone da acao, descricao, timestamp relativo
- Ao criar tarefas, leads, eventos, rotinas, etc. via chat ou UI, inserir registro em `imphq_activity_log`

### Trigger automatico (opcional fase 1)

Na fase 1, o log sera inserido manualmente nos pontos de criacao (chat commands). Futuramente, triggers SQL podem automatizar.

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar `imphq_chat_messages` e `imphq_activity_log` com RLS |
| `src/pages/Chat.tsx` | Novo: interface de chat com comandos, autocomplete, cards inline |
| `src/pages/Dashboard.tsx` | Adicionar componente ActivityFeed |
| `src/components/dashboard/ActivityFeed.tsx` | Novo: feed de atividades recentes |
| `src/App.tsx` | Rota `/chat` |
| `src/components/AppSidebar.tsx` | Item "Chat" no menu |

