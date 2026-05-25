
# Assistente Builder (Campanhas · Lançamento · Nutrição)

Sistema unificado de **guia + diagnóstico + IA construtora** para acelerar a montagem dessas 3 áreas. Combina drawer contextual, wizard de 1 clique e página central.

---

## 1. Camada central — `/assistente`

Nova página com 3 abas (Campanhas WhatsApp, Lançamentos, Nutrição). Cada aba mostra:

- **Health score** por projeto Vendendo (0-100) com semáforo.
- **Checklist estrutural** (boas práticas fixas — ver §4).
- **Diagnóstico por métricas reais** (gargalos detectados em vendas/leads/aberturas).
- **Próxima ação recomendada** com botão "Construir com IA".

Layout: lista de projetos à esquerda, painel de diagnóstico à direita.

---

## 2. Drawer contextual "Guia + IA"

Botão flutuante (ícone Sparkles + Compass) presente em:
- `/whatsapp` (Campanhas)
- `/lancamentos`
- `/nutricao`
- `ProjetoDetalhe` aba Comando

Abre `Sheet` lateral com 3 seções colapsáveis:
1. **O que falta** — checklist do framework da área atual.
2. **O que melhorar** — top 3 gargalos por métrica.
3. **Acelerar com IA** — botões de ação que disparam o wizard.

Reaproveita `sectionHelpTexts.ts` para textos longos.

---

## 3. Wizard "Construir com IA"

Modal único parametrizado por tipo (`campanha | lancamento | nutricao`):

```text
Passo 1: Briefing curto (objetivo, tom, prazo)
Passo 2: IA gera PLANO (estrutura + cronograma + copy resumo)
Passo 3: Preview editável (usuário ajusta)
Passo 4: Apply → cria registros no banco (sequência+passos, campanha+mensagens, lançamento+fases)
```

Reaproveita `wa-campaign-ai-generate` (já existe) e cria 2 irmãos: `nurture-ai-generate` e `lancamento-ai-generate`.

---

## 4. Frameworks de checklist (boas práticas)

**Campanhas WhatsApp** (8 itens):
- Welcome message · Aquecimento (3+ msgs) · CTA checkout · Recovery PIX/boleto · Upsell pós-compra · Anti-spam (delays) · Provider configurado · Variações A/B

**Lançamento** (10 itens):
- Avatar definido · Mecanismo único · Página de captura · Sequência aquecimento · CPL/Webinar · Carta de vendas · Sequência carrinho · Recovery · Pós-venda · Métricas de meta

**Nutrição** (7 itens):
- Sequência ativa · Cadência definida · Mínimo 12 e-mails · Tags de filtro · Templates por estágio · Tracking de conversão · Reativação 90d

---

## 5. Diagnóstico por métricas

Edge function `assistente-diagnose` lê:
- `imphq_vendas` (últimos 30d) · `imphq_leads` · `imphq_wa_campaigns` · `imphq_nurture_sequences` · `imphq_lancamentos`

Retorna por área: gargalos priorizados por ROI estimado + score 0-100.

Cacheado em `imphq_assistente_diagnostics` (TTL 6h).

---

## Detalhes técnicos

### Arquivos novos
- `src/pages/Assistente.tsx` — página central com 3 abas
- `src/components/assistente/GuideDrawer.tsx` — Sheet contextual reutilizável
- `src/components/assistente/BuilderWizard.tsx` — modal de 4 passos
- `src/components/assistente/HealthCard.tsx` · `ChecklistPanel.tsx` · `DiagnosticPanel.tsx`
- `src/lib/assistenteFrameworks.ts` — checklists hardcoded por área
- `src/lib/assistenteDiagnose.ts` — helpers de score client-side
- `supabase/functions/assistente-diagnose/index.ts`
- `supabase/functions/nurture-ai-generate/index.ts`
- `supabase/functions/lancamento-ai-generate/index.ts`

### Arquivos editados
- `src/App.tsx` — rota `/assistente`
- `src/components/AppSidebar.tsx` — item "Assistente" (ícone Compass)
- `src/pages/WhatsAppPage.tsx`, `Lancamentos.tsx`, `Nutricao.tsx` — botão de abrir GuideDrawer

### Tabela nova (migration)
- `imphq_assistente_diagnostics` (project_id, area, score, checklist jsonb, gargalos jsonb, calculated_at) — TTL 6h, RLS por usuário do projeto.

### IA
- Lovable AI Gateway · modelo `google/gemini-3-flash-preview`
- Tool calling para output estruturado (plano + passos)
- Reaproveita branding/avatar/vendas como contexto (padrão do projeto)

### Fora de escopo
- Execução automática (Imperius já cobre)
- Editor visual de fluxo
- Importação de templates externos
