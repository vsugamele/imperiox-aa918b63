

# Plano: Link Publico do Expert + IA para Alimentar Painel

## Duas funcionalidades

### 1. Link publico compartilhavel para o Expert
Uma pagina publica (sem login) bonita e read-only onde o expert ve tudo que precisa: agenda, tarefas, plano de conteudo, notas e processos. Voce copia o link e manda pro expert no WhatsApp.

### 2. Botao de IA para gerar plano de conteudo semanal
Um `AIGenerateButton` que usa o contexto do projeto (avatar, expert, briefing, brand) para gerar automaticamente o plano de conteudo da semana com sugestoes de posts por dia/plataforma.

---

## Funcionalidade 1: Pagina Publica do Expert

### Como funciona
- Cada projeto ganha um **token publico** (UUID curto) salvo em `imphq_projects.data.expert_share_token`
- Rota publica: `/expert/:token` (fora do ProtectedRoute)
- Edge function `expert-portal` busca os dados do projeto pelo token (sem autenticacao)
- Pagina bonita, responsiva, read-only com: nome do projeto, logo, agenda, tarefas, plano de conteudo, notas, processos
- No Painel Expert interno, botao "🔗 Copiar Link do Expert" que gera o token (se nao existir) e copia a URL

### Seguranca
- Token aleatorio (UUID) — nao expoe o project_id
- Apenas dados necessarios sao retornados (nao envia financeiro, leads, etc)
- Pode revogar/regenerar o token a qualquer momento

### Visual da pagina publica
- Header com nome do projeto + icone
- Cards com KPIs (eventos, tarefas, posts)
- Agenda da semana
- Plano de conteudo semanal (grid 7 colunas)
- Notas/instrucoes
- Footer discreto "Powered by Imperio HQ"
- Dark theme consistente com o sistema

---

## Funcionalidade 2: IA no Painel Expert

### Botao "Gerar Plano com IA"
- Usa `AIGenerateButton` com action `generate_content_plan`
- Contexto injetado: briefing, expert (tom de voz, temas), avatar (dores, desejos), brand_kit (plataformas ativas)
- Prompt gera 7 dias de conteudo com plataforma + tipo + tema para cada dia
- Resultado preenche o `content_plan` automaticamente

### Botao "Gerar Instrucoes com IA"
- Gera as notas/instrucoes da semana baseado no contexto do projeto e tarefas pendentes

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/expert-portal/index.ts` | **Nova** — Edge function que retorna dados publicos do projeto pelo token |
| `src/pages/ExpertPortal.tsx` | **Nova** — Pagina publica bonita read-only |
| `src/App.tsx` | Adicionar rota `/expert/:token` fora do ProtectedRoute |
| `src/components/projeto/ProjetoExpertPanel.tsx` | Adicionar botao "Copiar Link" + botoes de IA para gerar conteudo/notas |
| `supabase/functions/openflow-ai/index.ts` | Adicionar handler para action `generate_content_plan` e `generate_expert_notes` |

## Ordem

1. Edge function `expert-portal` (busca projeto por token, retorna dados filtrados)
2. Pagina publica `ExpertPortal.tsx` com layout bonito
3. Rota publica no App.tsx
4. Botao "Copiar Link" no ProjetoExpertPanel (gera token se necessario)
5. Handlers de IA para gerar plano de conteudo e instrucoes
6. Botoes de IA no painel interno

