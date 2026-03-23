

# Plano: Exportar Tarefas em PDF + Cofre de Ferramentas

## 1. Exportar tarefas em PDF profissional

O botão "Exportar PDF" atual gera um HTML básico via `window.open` e `window.print`. Vamos substituir por um PDF real gerado com dados completos.

### O que muda:
- Substituir o `window.open/print` por geração de PDF client-side usando a lib `jspdf` + `jspdf-autotable`
- O PDF incluirá:
  - Header com data, filtros aplicados (projeto, responsável)
  - Tabela com colunas: **Tarefa**, **Projeto**, **Responsável**, **Prioridade**, **Prazo**, **Status** (coluna do kanban), **Board**
  - Seções separadas: Atrasadas, Hoje, Próximos 3 dias, Sem prazo
  - Rodapé com total de tarefas e data de geração
- Dropdown no botão com opções: **PDF** e **CSV** (para quem prefere abrir no Excel)

## 2. Cofre de Ferramentas (Sites e Senhas)

Nova página "Cofre" para salvar credenciais de ferramentas que o time usa.

### Database:
Nova tabela `imphq_tools_vault`:
- `id` (uuid), `name` (text - nome da ferramenta), `url` (text), `username` (text), `password_encrypted` (text), `category` (text - ex: "social", "email", "design"), `notes` (text), `project_id` (uuid, opcional), `created_at`, `updated_at`
- RLS: apenas autenticados

### UI:
- Nova página `/cofre` com cards por categoria
- CRUD completo: adicionar, editar, excluir ferramentas
- Campo de senha com toggle mostrar/ocultar
- Botão copiar senha/URL com um clique
- Filtro por categoria e busca por nome
- Link na sidebar no grupo "Ferramentas"

## Arquivos

| Arquivo | Ação |
|---|---|
| `package.json` | Adicionar `jspdf` e `jspdf-autotable` |
| `src/pages/Tarefas.tsx` | Substituir export por PDF/CSV reais |
| Migration SQL | Criar `imphq_tools_vault` com RLS |
| `src/pages/Cofre.tsx` | **Novo** - página do cofre de ferramentas |
| `src/components/AppSidebar.tsx` | Adicionar link "Cofre" no grupo Ferramentas |
| `src/App.tsx` | Adicionar rota `/cofre` |

