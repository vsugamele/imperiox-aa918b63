# Plano — Painel de Lançamentos + Diagnóstico de E-mails

## Diagnóstico do que está quebrado hoje

**Bug em `/campanhas`:** `src/pages/Campanhas.tsx` faz `select("id,nome")` em `imphq_projects`, mas a coluna real é `name` (sem "nome"). O Supabase devolve erro silencioso → lista de projetos, produtos e sequências vem vazia no modal e nos filtros. Por isso "não puxa projetos, tags, produtos".

Além disso, hoje **existem 0 campanhas cadastradas** (646 leads, mas nenhum agrupado em campanha), então mesmo após o fix a tela continuaria vazia — precisa de uma forma rápida de criar/auto-popular lançamentos.

Sobre e-mails: o projeto `jp_freitas` (Jonathan) tem 440 leads. Existem as tabelas `imphq_nurture_sequences`, `imphq_nurture_emails`, `imphq_lead_sequence_enrollments`. Hoje **não há tela que mostre, por lançamento, quantos leads entraram em sequência e quantos e-mails foram enviados** — é isso que vamos construir.

---

## O que vou entregar

### 1. Fix do `/campanhas` (rápido)
- Trocar `select("id,nome")` por `select("id,name")` em `imphq_projects` e ajustar `projects` para `{id, name}`.
- Adicionar campo **Tags** no editor de campanha (multi-select usando tags existentes do projeto).
- Adicionar autocomplete de **Produto** baseado em `imphq_vendas.produto_nome` distinct por projeto.

### 2. Nova página `/lancamentos` — Painel de Leads por Lançamento
Visão executiva pra responder "quantos leads em cada lançamento":

- **Cards de KPI por lançamento** (campanha OU projeto se sem campanha):
  - Leads totais, leads 24h / 7d / 30d, ritmo (leads/dia), origem top (utm_source)
  - Status de nutrição: **% enrolados em sequência**, **e-mails enviados**, **taxa de abertura** (se houver dados)
- **Filtro** por projeto, status, período.
- **Tabela detalhada** com drill: clique abre painel lateral com últimos 20 leads do lançamento + timeline da sequência.
- **Botão "Criar lançamento a partir deste projeto"** que cria uma `imphq_campaign` pré-preenchida quando ainda não existe.

### 3. Diagnóstico de e-mails do projeto Jonathan
Card destacado no topo de `/lancamentos` quando o projeto selecionado for `jp_freitas`:

- **"X de 440 leads estão recebendo e-mails"** (conta enrollments ativos).
- Lista os leads **sem sequência** com botão **"Inscrever em massa"** (abre `BulkEnrollDialog` que já existe em `src/components/nurture/BulkEnrollDialog.tsx`).
- Mostra qual sequência está configurada como **default da campanha** (campo `data.default_sequence_id` já suportado no editor).
- Link direto para `/nutricao` para editar a sequência.

### 4. Configuração de e-mail por campanha
Reaproveita o que já existe (campo `default_sequence_id` no editor de campanha) + adiciona:
- Toggle **"Auto-enroll novos leads"** explícito.
- Aviso visual quando a campanha tem leads mas nenhuma sequência default definida.

---

## Detalhes técnicos

**Arquivos a alterar:**
- `src/pages/Campanhas.tsx` — fix `nome`→`name`, adicionar tags/produto.
- `src/pages/Lancamentos.tsx` (novo) — página painel.
- `src/components/lancamentos/LancamentoCard.tsx` (novo) — card KPI.
- `src/components/lancamentos/LeadsNurtureDiagnostic.tsx` (novo) — card de diagnóstico de e-mails.
- `src/App.tsx` + `src/components/AppSidebar.tsx` — rota e link no menu.

**Sem mudanças de schema necessárias.** Tudo já existe:
- Campanha ↔ leads: `imphq_leads.data->>'campaign_id'`
- Campanha ↔ sequência: `imphq_campaigns.data->>'default_sequence_id'`
- Enrollments: `imphq_lead_sequence_enrollments`
- E-mails enviados: `imphq_nurture_emails` + logs existentes

**Fora de escopo (posso fazer depois se quiser):**
- Criar novo provedor de envio de e-mail (você já usa o sistema de nutrição interno).
- Mudar a engine de envio para Lovable Emails / Resend.

---

```text
/lancamentos
┌─────────────────────────────────────────────────┐
│ [Projeto: Jonathan ▾] [Período: 30d ▾]          │
├─────────────────────────────────────────────────┤
│ ⚠ Diagnóstico Jonathan                          │
│ 312/440 leads recebendo e-mails  [Inscrever 128]│
├─────────────────────────────────────────────────┤
│ Lançamento A   210 leads  ▲ +18/d   85% nutrid. │
│ Lançamento B   104 leads  ▲ +6/d    12% nutrid. │
└─────────────────────────────────────────────────┘
```

Confirma que faz sentido e eu implemento.
