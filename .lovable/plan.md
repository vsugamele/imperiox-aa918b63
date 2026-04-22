

## Plano: Próximas evoluções estratégicas para o Imperio HQ

Análise do estado atual + 6 frentes de evolução priorizadas por **impacto no negócio × esforço**. Tudo aqui é proposta — você escolhe o que entra na próxima rodada.

---

### Visão geral do que você já tem (forte)
- CRM de leads com scoring + predição IA
- Finanças com atribuição proporcional + projeção mensal
- Ads com Yoshitani 7/5/3 + ROAS real via UTM
- WhatsApp completo (campanhas, IA autônoma, grupos, alertas)
- OpenFlow (automação visual)
- Conteúdo IA + Criativos IA + Roteiros virais
- Dashboard preditivo + alertas inteligentes
- Identidade unificada (briefing + branding)

### O que falta pra virar uma "central de comando" de verdade

---

### 🎯 Frente 1 — Metas & OKRs (ALTO impacto, baixo esforço)

**Problema**: Você tem dados, mas não tem **alvo**. Receita "boa" ou "ruim" depende de meta.

**Proposta**:
- Tabela `imphq_project_goals`: meta mensal de receita, leads, vendas, ROAS por projeto.
- Card "Meta do Mês" no Comando: progresso visual (barra) + projeção se vai bater (verde/amarelo/vermelho) + dias restantes.
- Página `/metas` consolidada com todos os projetos.
- Alerta automático quando ritmo está abaixo do necessário pra bater meta.

---

### 📊 Frente 2 — Cohort & LTV (ALTO impacto, médio esforço)

**Problema**: Você vê receita do mês, mas não sabe **quanto cada cohort de lead retorna ao longo do tempo**.

**Proposta**:
- Análise de cohort por mês de captura: M0, M1, M2, M3 de receita.
- LTV médio por origem (orgânico vs ads vs indicação).
- Payback period: quantos dias pra recuperar CAC.
- Aba nova em Finanças: "Cohort & LTV".

---

### 🤖 Frente 3 — Copilot Estratégico (ALTO impacto, alto esforço)

**Problema**: Dados estão espalhados. Você precisa de um "consultor IA" que olhe tudo e diga **o que fazer agora**.

**Proposta**:
- Chat lateral global (botão flutuante) com contexto do projeto ativo.
- Acessa: vendas, ads, leads, branding, briefing, alertas.
- Comandos sugeridos: "O que tá travando minha conversão?", "Onde investir mais R$ 1.000?", "Qual produto escalar?".
- Resposta com **ação concreta** + link pra tela relevante.

---

### 📅 Frente 4 — Planejamento & Calendário Editorial (MÉDIO impacto)

**Problema**: Conteúdo IA gera, mas não tem **plano de publicação**.

**Proposta**:
- Calendário editorial visual (semana/mês) por projeto.
- Drag-and-drop de roteiros/conteúdos pras datas.
- Integração com lembretes (push/email).
- Status: rascunho → revisão → publicado → métricas.
- Vincular post publicado com KPIs (alcance, leads gerados).

---

### 🔁 Frente 5 — Retenção & Recuperação (ALTO impacto)

**Problema**: Você capta bem, mas **carrinho abandonado / boleto não pago / churn** não tem fluxo automatizado por padrão.

**Proposta**:
- Dashboard "Recuperação" com 4 buckets:
  - PIX gerado e não pago (>2h, >24h)
  - Boleto vencendo
  - Carrinho abandonado (checkout iniciado, sem venda)
  - Reembolso/chargeback
- Templates de mensagens prontas (WhatsApp + email) por bucket.
- Automação: trigger automático no OpenFlow ao entrar no bucket.
- KPI: taxa de recuperação por canal.

---

### 🧪 Frente 6 — A/B Testing & Experimentos (MÉDIO impacto)

**Problema**: Criativos e roteiros são gerados, mas não tem **framework de teste** estruturado.

**Proposta**:
- Tabela `imphq_experiments`: variante A vs B, métrica alvo, status.
- Suporta: criativos de ad, headlines de LP, copies de WhatsApp, assuntos de email.
- Resultado automático: vencedor estatístico (chi-square ou bayesiano).
- Histórico de aprendizados ("o que funciona pro meu avatar").

---

### ⚡ Quick wins (1-2h cada, pode entrar junto)
1. **Modo apresentação** no Dashboard (tela cheia, dados grandes, atualiza sozinho — pra reuniões).
2. **Export PDF/CSV** de qualquer relatório (Finanças, Insights, Leads).
3. **Comparar projetos** lado a lado (selecionar 2-3 e ver KPIs comparativos).
4. **Notas estratégicas** por projeto (markdown + timestamp — diário de bordo do dono).
5. **Atalhos de teclado globais** (Ctrl+K já tem busca, faltam ações: novo lead, nova venda, etc).
6. **Health Score do projeto** (0-100): combina ROAS, conversão, NPS de leads, frequência de conteúdo. Card no topo do Comando.

---

### Minha recomendação de ordem (se fosse priorizar)

**Sprint 1 (semana)**: Frente 1 (Metas) + Quick wins #4 e #6 (Notas + Health Score) — dá direção e foco imediato.

**Sprint 2**: Frente 5 (Recuperação) — recupera dinheiro que tá vazando hoje.

**Sprint 3**: Frente 2 (Cohort/LTV) — entende qual canal vale a pena escalar.

**Sprint 4**: Frente 3 (Copilot) — depois que dados estão maduros, IA tem o que analisar.

---

### Pergunta pra você

Qual dessas frentes faz mais sentido pro seu momento agora? Posso detalhar plano técnico completo da que você escolher.

