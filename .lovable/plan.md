

# Plano: Skills nas Mentes IA + API Externa Robusta para IAs

## 2 frentes

---

### 1. Mentes IA puxam Skills quando necessário

**Problema**: O `buildSystemPrompt()` em `Mentes.tsx` injeta contexto do projeto (avatar, branding, concorrentes, KB) mas não injeta as Skills disponíveis. Se o agente "Devastador" precisa usar a skill "Avatar Architect v2", ele não tem acesso ao system_prompt dela.

**Solução**:
- No `Mentes.tsx`, ao montar o prompt, buscar skills relevantes de duas fontes:
  - `skillsData.ts` (skills built-in com `system_prompt`)
  - `imphq_skills` do Supabase (skills custom do usuário com `system_prompt`)
- Filtrar skills pela `categoria` compatível com a mente selecionada (ex: mente de copy → skills de copy)
- Injetar no system prompt uma seção `── SKILLS DISPONÍVEIS ──` com nome + descrição + prompt resumido (primeiros 500 chars) de cada skill relevante
- Adicionar na UI um checklist visual de "Skills ativas" que o usuário pode ativar/desativar para cada conversa
- Se uma skill estiver ativada, injetar o `system_prompt` completo dela

**Arquivo**: `src/pages/Mentes.tsx`

---

### 2. API Externa robusta (imperio-api) — CRUD completo para IAs externas

**Problema**: A `imperio-api` hoje suporta apenas 4 actions: `create_task`, `create_lead`, `project_status`, `export_context`. Uma IA externa não consegue listar cards, mover entre colunas, editar, deletar, listar projetos, listar leads, etc.

**Solução**: Expandir a edge function `imperio-api` com endpoints CRUD completos + página de documentação/guia no app.

**Novos endpoints na API**:

| Action | Método | Descrição |
|---|---|---|
| `list_projects` | GET | Listar todos os projetos |
| `list_cards` | GET | Listar cards (filtro por board, column, project_id, priority) |
| `get_card` | GET | Detalhe de um card |
| `update_card` | PUT | Atualizar título, descrição, prioridade, tags, due_date |
| `move_card` | PUT | Mover card para outra coluna (recebe column_id ou column_title + board) |
| `delete_card` | DELETE | Deletar card |
| `list_columns` | GET | Listar colunas por board |
| `list_leads` | GET | Listar leads (filtro por project_id, status, plataforma) |
| `update_lead` | PUT | Atualizar status, tags, dados do lead |
| `create_notification` | POST | Criar notificação no sistema |
| `list_skills` | GET | Listar skills disponíveis |
| `get_skill` | GET | Retornar skill com system_prompt completo |

**Página de Guia da API** (`src/pages/Cofre.tsx` ou nova seção):
- Documentação interativa com exemplos curl para cada endpoint
- Campo para copiar a URL base da API
- Exemplos prontos para usar com Claude, GPT, n8n
- Seção "Como conectar uma IA externa" com passo a passo:
  1. Gerar API key no Cofre
  2. Copiar URL base
  3. Exemplos de chamadas
- Tabela com todos os endpoints, métodos, parâmetros e respostas

**Arquivos alterados**:

| Arquivo | Ação |
|---|---|
| `src/pages/Mentes.tsx` | Buscar skills (built-in + custom), checklist de skills ativas, injetar no prompt |
| `supabase/functions/imperio-api/index.ts` | +12 endpoints CRUD (list/get/update/move/delete cards, list leads, update lead, list projects, list columns, create notification, list/get skills) |
| `src/pages/Cofre.tsx` | Seção "Guia da API" com documentação interativa, exemplos curl, passo a passo para IAs externas |

