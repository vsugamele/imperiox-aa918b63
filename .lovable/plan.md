

# Plano: 3 Melhorias — Usuário no Instagram, Processos em Tarefas, Gráficos de Receita

---

## 1. Campo "Usuário" no dialog de Instagram/TikTok (Empresa)

**Problema**: O dialog de adicionar Instagram (imagem enviada) não tem campo de "Usuário" (login/email da conta). Só tem Perfil, Senha, Seguidores, Bio e Status.

**Solução**: Adicionar campo `valor` como "Usuário / Email de Login" no formulário de Instagram e TikTok (bloco `else` do dialog, linha 281). O campo `valor` já existe no schema (`ContaEmpresa.valor`) mas não é usado no formulário de redes sociais — só no email ("Em Uso"). Reaproveitar esse campo como "Usuário de Login" para Instagram/TikTok.

- No formulário: adicionar `<Input>` para "Usuário / Email" entre Perfil e Senha
- Na tabela: adicionar coluna "Usuário" após "Perfil"

**Arquivo**: `src/pages/Empresa.tsx`

---

## 2. Aba "Processos" em Tarefas

**Problema**: Não existe um local para documentar processos/SOPs por função ou pessoa. As rotinas diárias são checklists simples, não procedimentos detalhados.

**Solução**: Adicionar uma nova aba **"Processos"** no Tabs de Tarefas (ao lado de Rotinas, Tarefas e Calendário). Funcionalidades:

- **Lista de processos**: cada processo tem título, descrição/passos (textarea), responsável (membro), projeto vinculado e categoria (ex: "Tráfego", "Conteúdo", "Atendimento", "Financeiro")
- **Etapas do processo**: lista ordenada de passos com checkbox de conclusão
- **Filtro por membro e categoria**: para cada pessoa ver só seus processos
- **CRUD completo**: criar, editar, excluir processos
- Armazenamento na tabela existente — usar `imphq_daily_routines` com `category: "processo"` e guardar os passos no campo `extra` (JSON), ou criar uma nova tabela `imphq_processes` com migration

Recomendo usar uma **migration** para criar `imphq_processes` com: `id, title, description, steps (jsonb), member_id, project_id, category, position, is_active, created_at, user_id`. Mais limpo que sobrecarregar rotinas.

**Arquivos**: `src/pages/Tarefas.tsx` (nova aba), migration SQL

---

## 3. Dashboard — mais gráficos e filtros de receita

**Problema**: Os gráficos atuais (Leads 30d, Receita vs Custo 6 meses, Funil) não permitem filtrar por período nem mostram breakdown por produto/projeto.

**Melhorias**:

- **Filtro de período global** nos gráficos: botões "7d / 30d / 90d / 6m" que recarregam os dados dos charts
- **Gráfico de Receita por Projeto** (barras horizontais): usando dados de `imphq_vendas` + `imphq_project_revenue` agrupados por `project_id`
- **Gráfico de Receita por Produto** (pizza/donut): usando `imphq_vendas.produto` para agrupar
- **Gráfico de ROAS por mês**: receita / (custo + ads) para cada mês
- **Tooltip melhorado** nos gráficos existentes com fonte dos dados

Layout: os gráficos novos ficam numa row abaixo dos existentes (grid 2 ou 3 cols). O filtro de período fica acima dos gráficos como botões.

**Arquivo**: `src/pages/Dashboard.tsx`

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `src/pages/Empresa.tsx` | Campo "Usuário/Email" no dialog e tabela de Instagram/TikTok |
| `src/pages/Tarefas.tsx` | Nova aba "Processos" com CRUD de SOPs por função/pessoa |
| `src/pages/Dashboard.tsx` | Filtro de período, gráfico receita por projeto, por produto, ROAS |
| SQL migration | Criar tabela `imphq_processes` |

