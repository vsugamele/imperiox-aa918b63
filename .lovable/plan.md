# Diagnóstico Estratégico — Império HQ

Análise das áreas que você pediu, com foco em **ROI real** (mais venda, menos atrito). Ordenado por impacto/esforço.

---

## 🔥 P0 — Quick wins de alto impacto (1-3 dias cada)

### 1. **SDR/Conversão WhatsApp — Closer Mode**
Hoje o `wa-ai-reply` responde, mas não **fecha**. Falta:
- **Detector de intenção de compra** ("quanto custa", "como pago", "tem garantia") → dispara fluxo de fechamento agressivo com link de pagamento direto, não mais "vou te passar mais infos".
- **Handoff inteligente humano↔IA**: quando lead esfria 2h+ sem resposta, IA reativa com quebra de objeção contextual (puxando do `ObjectionsLibrary`).
- **Score de temperatura ao vivo** no `ChatView` (badge 🔥/🟡/🔵) usando últimos 5 msgs + sinais (Pix gerado, link clicado).
- **Sugestão de próxima msg** inline no composer (3 opções: empática, técnica, fechamento).

### 2. **Dashboard — De painel para Cockpit de Guerra**
Tem 15+ componentes (`DashboardHero`, `Predictive`, `Growth`, `LiveFunnel`...) que competem por atenção. Refatorar para:
- **Modo "O que importa agora"**: 1 tela única com (a) números-chave do dia, (b) **3 ações prioritárias** que o Imperius detectou, (c) o que está quebrado (chips vermelhos clicáveis).
- Mover Predictive/Cohort/Growth para sub-abas — não na raiz.
- **Comando rápido** (Cmd+K) para "criar campanha WA", "ver leads quentes", "pausar ad ruim".

### 3. **Skills — Discovery + Composição**
Hoje 17 skills isoladas em `/skills`. Problemas:
- Usuário não sabe qual usar pra qual situação.
- Não conversam entre si (Avatar → Devastador → LP deveria ser **pipeline**).

Melhorias:
- **Skill Recommender**: ao abrir um Projeto, IA sugere "rode Avatar Architect primeiro, vc ainda não tem dossiê".
- **Pipelines pré-montadas**: "Lançamento Zero→LP" roda Avatar→Mecanismo→LP→Tripwire em sequência, passando output de um como input do outro.
- **Output persistente por projeto**: hoje cada execução é stateless. Salvar em `imphq_skill_outputs` linkado ao projeto pra reaproveitar.

---

## ⚡ P1 — Inteligência que falta (3-7 dias cada)

### 4. **Instagram — Sair do modo "visualizador"**
A `InstagramPage` mostra dados; não age. Adicionar:
- **DM auto-responder** com mesmo motor do WA (`wa-ai-reply` reutilizável).
- **Detector de comentário com intenção** ("preço?", "link?") → resposta automática + DM follow-up.
- **Cross-poster**: criativo aprovado no Studio → publica IG + agenda Reels.
- **Insights → Ação**: quando reel viraliza (>X views/h), Imperius sugere boost no Gerenciador.

### 5. **Docs/Guia — Reposicionar como Coach**
`Docs.tsx` e `Guia.tsx` parecem estáticos. Transformar em:
- **Onboarding adaptativo**: detecta o que o user já fez vs não fez, mostra próximos passos.
- **Tooltips contextuais por página** (já tem `SectionInfo` — expandir).
- **Vídeo-loops curtos** (gerados via VslLab?) explicando cada módulo.

### 6. **Imperius — De reativo para proativo**
Já tem fila `imphq_ai_actions` + ActionInbox. Falta:
- **Alertas push reais** (PWA já configurado) quando ação crítica entra na fila.
- **Auto-execução escalada**: low-risk hoje já roda; criar tier "medium-risk com confirmação 1-clique" via notificação.
- **Briefing matinal por WA** (já tem `daily-briefing` function): enviar resumo + 3 ações pro dono.

---

## 🎯 P2 — Polimento estratégico (1-2 semanas)

### 7. **Unificar Avatar como fonte de verdade**
Avatar Architect gera dossiê → mas WA-AI, Copy, LP, Skills cada um tem seu próprio contexto. Centralizar em `imphq_avatares` consumido por TODO motor de IA (já existe parcial via `avatars_por_produto`, expandir).

### 8. **Funil de Conversão visual end-to-end**
Hoje tem `Funis`, `ConversionFunnel`, `LiveFunnel`, `GrowthDashboard`, `AcquisitionFunnel` — fragmentado. Unificar em **1 funil ao vivo** Ad→LP→Checkout→Pix→Pago→Recuperação, com gargalo destacado e botão "consertar isso".

### 9. **Lead Inbox priorizado tipo email**
`Leads.tsx` é tabela. Virar **inbox estilo Superhuman**: leads quentes no topo, atalhos de teclado (E=enviar WA, R=responder, A=arquivar), bulk actions.

### 10. **Métricas de SDR/IA**
Criar painel "Performance da IA": % msgs IA, taxa de conversão IA vs humano, ROI por skill executada, custo OpenRouter vs receita atribuída.

---

## 🛠️ Higiene técnica (paralelo)

- **Consolidar guides WhatsApp** (`EvolutionGuide`, `HubGuide`, `MetaCloudGuide`, `WebhookGuide`) → 1 wizard único que detecta provider.
- **Dashboard splits**: hoje carrega tudo. Lazy-load por aba (já flagado em memória como egress concern).
- **Edge functions duplicadas**: `wa-ai-reply` vs `wa-ai-refine` vs `wa-learn-from-human` — revisar overlap.

---

## ❓ O que eu preciso de você

Qual desses **3** atacar primeiro? Cada um vira um plano executável detalhado:
- (A) **Closer Mode WhatsApp** (P0.1) — mais ROI direto
- (B) **Cockpit Dashboard** (P0.2) — mais clareza diária
- (C) **Skills em Pipeline** (P0.3) — mais alavancagem de IA

Ou quer que eu detalhe **outro** dos itens?
