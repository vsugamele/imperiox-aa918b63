

# Imperio HQ — Command Center de Marketing Digital

Recriação completa do sistema Imperio HQ adaptado para React + Vite + Tailwind, conectado ao Supabase existente com todas as tabelas `imphq_*`.

## Design System: Premium Dark — Imperial Gold
- **Fundo:** `#080607` (preto quente), cards `#0e0b0d`
- **Accent:** `#c9922a` (ouro) com variação clara `#e8b86d`
- **Fontes:** Cormorant Garamond (títulos), DM Sans (UI), JetBrains Mono (números)
- **Paleta auxiliar:** Vermelho `#b91c1c`, Verde `#059669`, Texto `#f5f0e8`, Muted `#7a7170`, Bordas `#1e191c`

## Autenticação
- Tela de login com Supabase Auth (email/senha)
- Proteção de rotas via componente ProtectedRoute
- Redirect automático: não logado → `/login`, logado em `/login` → `/dashboard`

## Layout Principal
- **Sidebar** fixa à esquerda com navegação para todas as seções (ícones + labels)
- **Bottom nav** no mobile
- Todas as páginas dentro de um layout compartilhado com header e breadcrumbs

## Páginas (18 rotas)

### 1. `/dashboard` — Visão Geral
- Cards de stats: projetos ativos, tarefas pendentes, custo mensal, leads totais
- Lista de projetos recentes com progresso do pipeline
- Tarefas urgentes/vencidas
- Top oportunidades de Market Intel

### 2. `/projetos` — Lista de Projetos
- Grid de cards com emoji, nome, categoria, cor, progresso geral
- Botão "Novo Projeto" com modal (nome, emoji, categoria, descrição)
- Filtro por categoria e busca

### 3. `/projetos/:id` — Detalhe do Projeto
- Abas: Briefing, Avatar, Branding, Pipeline
- Pipeline visual com barras de progresso por etapa (avatar, funil, copy, prompts, design, tráfego)
- Edição inline dos campos JSONB `data` e `pipeline`

### 4. `/kanban` — Kanban de Tarefas
- 4 boards (Agentes, Humanas, Criativos, Campanhas)
- 5 colunas por board: Backlog → Doing → Stuck → Review → Done
- Drag-and-drop entre colunas
- Cards com prioridade (cor), prazo, projeto associado

### 5. `/tarefas` — Lista de Tarefas
- Tabela com filtros por status, prioridade, projeto
- Semáforo de prazo (verde/amarelo/vermelho)
- Criação rápida de tarefa

### 6. `/leads` — Base de Leads
- Tabela com busca, filtros por projeto/plataforma/status
- Badges de status (lead, cliente, VIP, inativo)
- Score visual, total gasto, link para WhatsApp

### 7. `/financas` — Custos Mensais
- Lista de custos (ferramentas e APIs)
- Conversão USD→BRL automática
- Total mensal consolidado com gráfico

### 8. `/market-intel` — Oportunidades
- Cards por nicho com score, concorrência, demanda
- Filtros por nicho e ordenação por score
- CRUD de oportunidades

### 9. `/mentes` — Chat com IA
- Interface de chat com personas selecionáveis
- Integração via edge function para cascata de provedores (OpenRouter → OpenAI → Anthropic → Gemini)
- Histórico de conversas salvo em `imphq_ai_chats`

### 10. `/funis` — Gestão de Funis
- Visualização de funis com etapas
- CRUD de funis em `imphq_funis`

### 11. `/openflow` — Gerador de Criativos
- Wizard por passos para gerar copy/VSL com IA
- Leitura/escrita em `imphq_flows`

### 12. `/docs` — Knowledge Base
- Categorias e busca em `imphq_docs` / `imphq_kb`
- Editor de documentos com markdown

### 13. `/whatsapp` — WhatsApp Config
- Templates por nicho
- Histórico de conversas (`imphq_wa_conversations`, `imphq_wa_messages`)

### 14. `/tracker` — UTM Links
- Criação de tracking links com UTM
- Métricas de cliques (`imphq_tracking_links`, `imphq_clicks`)

### 15. `/referencias` — Swipe File
- Galeria de referências de criativos e landing pages
- Upload e categorização

### 16. `/skills` — Inventário de Skills
- Lista de skills/ferramentas disponíveis

### 17. `/equipe` — Membros da Equipe
- Lista de membros com roles e status (`imphq_team_members`)

### 18. `/empresa` — Contas da Operação
- Gestão de contas de email, Instagram, TikTok (`imphq_empresa`)

### 19. `/configuracoes` — Configurações
- API keys (armazenadas em localStorage)
- Configurações de webhook
- Preferências do sistema

## Abordagem de Implementação
Será construído em fases iterativas, começando pelo layout, autenticação e dashboard, depois expandindo para as demais páginas. Todas as páginas farão queries diretas às tabelas `imphq_*` existentes via Supabase client.

