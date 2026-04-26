## 🎯 Objetivo
Transformar dado **já existente** (cliques, eventos, vendas) em duas alavancas de decisão diária:
1. **Atribuição multi-touch** — entender o caminho completo do lead até a venda.
2. **Inbox de leads quentes** — feed único de oportunidades com sinal forte para o time agir agora.

Sem nova tabela, sem novo webhook. Tudo construído sobre `imphq_clicks`, `imphq_events`, `imphq_leads`, `imphq_vendas`.

---

## Parte 1 — Jornada Multi-Touch no Lead

### 1.1 Novo componente `LeadJourneyTimeline.tsx`
Painel dentro do detalhe do lead (abaixo do `LeadUtmsPanel` já criado), mostrando **linha do tempo unificada** com todos os touchpoints, em ordem cronológica:

- 🖱️ **Cliques** (`imphq_clicks` por `visitor_id` + por email): UTM source/campaign + página
- 👁️ **Eventos** (`imphq_events`): PageView, ViewContent, AddToCart, ButtonClick, FormSubmit
- 💰 **Vendas** (`imphq_vendas`): aprovada / pix gerado / recusada / reembolso
- 📧 **Captura** (lead criado): origem + UTMs

Cada item mostra: ícone + ação + timestamp relativo ("há 2h") + UTM source/campaign quando relevante. Filtro por tipo (toggle chips: Cliques · Eventos · Vendas).

### 1.2 Resumo de atribuição (header do timeline)
Card compacto no topo com 3 métricas:
- **Tempo até conversão**: dias entre 1º clique e 1ª venda
- **Touchpoints totais**: count de eventos/cliques antes da venda
- **Caminho dominante**: campanha mais frequente na jornada (ex: `meta|criativo-x | 7 toques`)

### 1.3 Integração
- Inserir `<LeadJourneyTimeline lead={editLead} />` em `src/pages/Leads.tsx` logo abaixo do `LeadUtmsPanel`.
- Reutilizar a query de `imphq_clicks` já feita no `LeadUtmsPanel` (passar via prop ou hook compartilhado `useLeadJourney`).

---

## Parte 2 — Inbox de Leads Quentes (página dedicada)

Hoje o `HotLeadAlerts` no Dashboard mostra só PIX/Boleto das últimas 2h. **Limitado.** Vou expandir para uma **caixa de entrada operacional** completa.

### 2.1 Nova rota `/leads-quentes` (ou aba dentro de `/leads`)
Decisão sugerida: **aba "🔥 Quentes"** dentro de `/leads` (menos fricção, contexto preservado). Confirmar na execução.

### 2.2 Score de "calor" (calculado no front, sem nova tabela)
Cada lead recebe um **score de urgência (0-100)** somando sinais:
- PIX/Boleto gerado < 2h: **+40**
- PIX/Boleto < 24h sem pagar: **+25**
- Pagamento recusado < 24h: **+30**
- Clicou link WhatsApp < 1h (`imphq_clicks` com utm_medium=whatsapp): **+20**
- Abriu email < 30min (`imphq_events` event_type=email_open): **+15**
- Score do lead `imphq_leads.score` > 70: **+15**
- Predição IA (`imphq_lead_predictions.probability`) > 0.7: **+20**
- Cliente recorrente sem compra há 30d (winback): **+10**

Ordenado desc por calor. Top 50.

### 2.3 UI da inbox
Cada linha:
- 🔥 Badge de calor (vermelho >70, laranja 40-70, amarelo <40)
- Nome + telefone + email (com botões copy/WhatsApp)
- **Razões do calor** (chips): "PIX 1h", "Clicou WA", "Predição 85%"
- Produto envolvido + valor
- Ações rápidas inline: **Abrir WhatsApp** · **Marcar contatado** · **Ver lead**

### 2.4 Filtros
- Por projeto
- Por razão (PIX, clicou WA, predição alta)
- "Ainda não contatado" (sem entrada em `imphq_activity_logs` últimas 24h)

### 2.5 Notificação
Aproveitar push já existente — adicionar contagem de quentes não contatados como badge no menu lateral (`AppSidebar`).

---

## Arquivos

**Novos:**
- `src/components/leads/LeadJourneyTimeline.tsx`
- `src/components/leads/HotLeadsInbox.tsx`
- `src/hooks/useLeadJourney.ts` (compartilhado timeline + atribuição)
- `src/lib/hotLeadScore.ts` (cálculo do score de calor)

**Editados:**
- `src/pages/Leads.tsx` (insere timeline no detalhe + nova aba "🔥 Quentes")
- `src/components/dashboard/HotLeadAlerts.tsx` (link "Ver todos" → aba quentes)
- `src/components/AppSidebar.tsx` (badge de contagem opcional)

---

## Fora de escopo (próximas ondas)
- Persistir score de calor no banco (hoje calcula no client = simples e suficiente).
- "Marcado contatado" persistente — pode entrar numa segunda iteração via `imphq_activity_logs`.
- Atribuição multi-touch *agregada* (nível dashboard, não lead) — fica pra Onda 7B.

---

**Pronto para executar.** Aprova que toco. Se quiser cortar (ex: só Parte 1, ou só Parte 2), só falar.