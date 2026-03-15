

# Plano: Atividades e Documentos por Membro da Equipe

## O que muda

Ao clicar num membro, em vez do dialog simples de edição, o usuário acessa uma **página de perfil expandida** com 3 abas:
1. **Perfil** — dados atuais (nome, email, cargo, departamento)
2. **Atividades** — lista de tarefas atribuídas ao membro (puxando do Kanban existente)
3. **Documentos** — documentos internos vinculados ao membro (o que ele precisa fazer/ler)

## Banco de Dados

### Nova tabela: `imphq_team_docs`
Documentos vinculados a membros específicos da equipe.

```sql
CREATE TABLE imphq_team_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES imphq_team_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Novo Documento',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Alteração: `imphq_kanban_cards`
Adicionar coluna `assigned_to UUID` referenciando `imphq_team_members(id)` — permite atribuir tarefas do Kanban a membros.

*(Nota: verificar se essa coluna já existe; se já existir, apenas usar.)*

## Frontend

### 1. Novo componente: `MemberDetailPanel.tsx`
Substitui o dialog de edição atual. Quando o usuário clica num membro, abre um **Sheet** (painel lateral largo) ou dialog expandido com Tabs:

**Aba Perfil**: Formulário de edição existente (nome, email, cargo, dept) + botão salvar/remover.

**Aba Atividades**:
- Lista cards do Kanban onde `assigned_to = member.id`
- Agrupados por status (A Fazer, Em Progresso, Feito)
- Quick-assign: botão para atribuir novas tarefas do Kanban ao membro
- Check-off rápido direto da lista

**Aba Documentos**:
- CRUD de documentos vinculados ao membro (`imphq_team_docs`)
- Botão "Novo Doc" → editor inline (título + textarea)
- Lista de docs existentes com preview do título
- Editar/excluir docs

### 2. Alteração em `Equipe.tsx`
- Trocar o dialog de edição por abertura do `MemberDetailPanel`
- No grid de cards, mostrar contagem de atividades pendentes e docs por membro

### 3. Alteração em `KanbanPage.tsx` (opcional)
- No card do Kanban, adicionar campo "Atribuir a" com dropdown dos membros da equipe

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_team_docs`, adicionar `assigned_to` em `imphq_kanban_cards` |
| `src/components/equipe/MemberDetailPanel.tsx` | Novo — painel com abas Perfil/Atividades/Documentos |
| `src/pages/Equipe.tsx` | Trocar dialog de edição pelo MemberDetailPanel |

