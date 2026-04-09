

# Plano: Painel de Usuarios Admin + Tooltips de Ajuda por Secao

## Contexto

Hoje nao existe tabela de usuarios/perfis no projeto — a autenticacao usa apenas `auth.users` do Supabase. A pagina Equipe (`imphq_team_members`) gerencia membros de equipe mas nao usuarios do sistema. Para criar colaboradores com login e definir senhas, precisamos de uma edge function com service_role_key (unica forma de criar usuarios e definir senhas pelo admin no Supabase).

---

## 1. Painel de Usuarios (Admin)

### Banco de dados

Criar tabela `imphq_user_roles` para controle de acesso:

```text
imphq_user_roles
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── role (text: 'admin' | 'editor' | 'viewer')
├── created_at (timestamptz)
└── UNIQUE(user_id, role)
```

RLS: apenas admins podem ler/escrever (via funcao `security definer`).

Inserir voce e o Bruno como admin via seed (pelos auth.users IDs existentes).

### Edge Function `admin-users`

Nova edge function que usa `SUPABASE_SERVICE_ROLE_KEY` para:
- **Listar usuarios**: `supabase.auth.admin.listUsers()`
- **Criar usuario**: `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
- **Definir senha**: `supabase.auth.admin.updateUserById(id, { password })`
- **Desativar usuario**: `supabase.auth.admin.updateUserById(id, { banned: true })`

Todas as acoes validam que o chamador e admin (via `imphq_user_roles`).

### Frontend — Nova pagina ou aba

Adicionar aba "Usuarios" na pagina Configuracoes (ou link na sidebar). Conteudo:
- Lista de usuarios com email, role, status (ativo/banido), ultimo login
- Botao "Criar Usuario" → dialog com email, senha, role
- Botao "Redefinir Senha" por usuario → dialog com campo de senha
- Toggle ativo/inativo
- Select de role (Admin/Editor/Viewer)

### Restricao de acesso

O AuthContext passara a expor `userRole`. Paginas sensiveis (Config, Equipe admin) verificam se role === 'admin'.

---

## 2. Tooltips de Ajuda (icone ℹ️)

### Componente `SectionInfo`

Componente reutilizavel que renderiza um icone ℹ️ ao lado de titulos de secao. Ao clicar/hover, abre um popover com:
- Titulo da secao
- Descricao do que faz
- Como usar (1-2 frases)

```text
<SectionInfo
  title="Arsenal de Copy"
  description="Gere promessas, inimigos comuns e mecanismos unicos para cada produto."
  usage="Clique em 'Gerar com IA' para criar automaticamente baseado no briefing."
/>
```

### Mapa de ajuda

Dicionario centralizado com textos de ajuda para cada secao principal:
- Dashboard, Kanban, Leads, Financas, Mentes IA, OpenFlow, Skills, Docs, WhatsApp, Tracker, Equipe, etc.
- Dentro de Projeto: Briefing, Avatar, Expert, Branding, KPIs, Copy Arsenal, Calendario, Conteudo, etc.

### Onde colocar

Ao lado de cada `<h1>`, `<h2>` ou titulo de aba principal. Nao invasivo — pequeno icone cinza que aparece ao lado do titulo.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/migrations/xxx_user_roles.sql` | Criar tabela `imphq_user_roles` + funcao `has_imphq_role` + RLS |
| `supabase/functions/admin-users/index.ts` | **Novo** — CRUD de usuarios via service_role |
| `src/components/SectionInfo.tsx` | **Novo** — Componente de tooltip de ajuda |
| `src/data/sectionHelpTexts.ts` | **Novo** — Dicionario de textos de ajuda por secao |
| `src/pages/Configuracoes.tsx` | Adicionar aba "Usuarios" com painel admin |
| `src/contexts/AuthContext.tsx` | Expor `userRole` consultando `imphq_user_roles` |
| Paginas principais (Dashboard, Leads, etc.) | Adicionar `<SectionInfo>` nos titulos |

## Ordem

1. Migrar tabela `imphq_user_roles` + seed admins
2. Edge function `admin-users`
3. Aba de usuarios no Configuracoes
4. Role no AuthContext + restricao de acesso
5. Componente `SectionInfo` + dicionario de textos
6. Aplicar tooltips nas paginas principais

