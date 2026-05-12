# Roadmap 30 dias — Império Autônomo

Objetivo: transformar o sistema de "painel de leitura" em **operador autônomo** que diagnostica, propõe e executa nas 4 frentes (IA decisória, receita, conteúdo, tráfego+CRM), com regra **híbrida**: low-risk roda sozinho, high-risk vai pra fila de aprovação com 1 clique.

## Princípio de Autonomia (aplicado a tudo)

Toda ação da IA tem `risk_level` e roteamento automático:

| Risco | Exemplos | Comportamento |
|---|---|---|
| **low** | Pausar criativo com CPA 3x acima da meta, follow-up de hot lead, criar tarefa, gerar conteúdo no Studio, marcar lead como frio | **Auto-executa** + log + notificação |
| **medium** | Subir budget até +20%, disparar broadcast <50 pessoas, mudar oferta de step | Auto se confiança >85%, senão fila |
| **high** | Pausar campanha inteira, broadcast >50, alterar preço, deletar dados | **Sempre fila** (botão Aprovar/Rejeitar) |

Nova tabela `imphq_ai_actions` (proposed/approved/rejected/executed/reverted) + componente `ActionInbox` no header (sino dourado com badge).

---

## Semana 1 — Fundação: Imperius Autônomo

**Entregas:**
1. **Tabela `imphq_ai_actions`** com `risk_level`, `confidence`, `payload`, `revert_payload`, `auto_executed`, `executed_at`.
2. **Edge Function `imperius-executor`**: recebe action, valida risco, executa via tool calling (Vercel AI SDK + Gemini 3 Pro). Tools: `pauseAd`, `sendWhatsApp`, `createTask`, `updateLead`, `runStudio`, `adjustBudget`.
3. **`ActionInbox`** no AppLayout (sino + drawer): mostra ações pendentes, executadas (últimas 24h) e botão "Reverter".
4. **Cron `imperius-scout`** (15min): varre projetos `vendendo`, gera diagnóstico, propõe ações. Usa `healthScore.ts` + `intelligent-alerts` existentes.
5. **Página `/imperius`**: feed de decisões + métricas (ações/dia, % auto, receita influenciada).

**Resultado esperado:** 20-40 micro-decisões/dia rodando sozinhas + fila visível.

---

## Semana 2 — Receita Autônoma

**Entregas:**
1. **Recuperador Pix/Boleto turbinado**: `payment-recovery` já existe — adicionar **3 toques escalonados** (15min, 2h, 24h) com copy A/B testada por IA (variação vencedora vira default).
2. **Hot Lead Auto-Responder**: lead com `score >70` + ação Pix nos últimos 30min → IA dispara mensagem personalizada (usa avatar + branding) **sem aprovação**. Log completo em `imphq_ai_actions`.
3. **Nutrição preditiva**: `lead-predict` já roda; agora a IA **escolhe automaticamente** qual sequência enrollar baseado no score+intent (low risk).
4. **Dashboard "Receita Recuperada pela IA"** em `/dashboard`: mostra R$ atribuído às ações automáticas (vendas em até 48h após toque IA).

**Resultado esperado:** +15-30% taxa de recuperação, zero hot lead esquecido.

---

## Semana 3 — Studio em Escala + Tráfego Autônomo

**Studio (lote diário automático):**
1. **`studio-batch-cron`** (diário 6h): para projetos `vendendo`, gera **N criativos/dia** usando templates aprovados (avatar falante, hook+gancho, prova social). Usa Avatar Intelligence + Branding existentes.
2. **Auto-publish para `imphq_creatives`** marcado como `ai_generated=true`, status `pendente_aprovacao` (high risk, sempre fila).
3. **Aprendizado**: criativos com CTR top viram **referência automática** no próximo prompt (loop fechado).

**Tráfego (Gerenciador autônomo):**
1. **Regras Yoshitani automatizadas** (`facebook-ads-toggle` já existe):
   - CPA > 1.5x meta + >50 cliques → **auto-pausa** (low)
   - CTR <0.8% após 3 dias → **auto-pausa** (low)
   - ROAS >2.5x + budget <R$500 → **propõe escala +20%** (medium)
2. **Diário em `imphq_ads_actions`** com motivo IA + 1-clique reverter.
3. **Alerta proativo** no WhatsApp do dono se >5 ações high-risk pendentes.

**Resultado esperado:** -30% gasto em criativo ruim, +N criativos novos/semana sem operador.

---

## Semana 4 — CRM Preditivo + Closing Loop

**Entregas:**
1. **Chatbot WhatsApp upgrade**: hoje é reativo (`autonomous-ai-chatbot`). Tornar **proativo** — dispara primeira mensagem quando `lead-predict` detecta janela ótima (ex.: 19h-21h, alto score).
2. **Auto-qualificação**: IA conversa, extrai objeções, atualiza `imphq_leads.objecao` e `score`, move no kanban (low risk).
3. **Handoff inteligente**: quando lead pede preço/link de pagamento → IA envia checkout + notifica humano (medium).
4. **Relatório Imperador semanal** (segunda 7h, e-mail): "Esta semana a IA executou X ações, recuperou R$Y, gerou Z criativos, qualificou W leads. Fila precisa de sua atenção: N itens."
5. **Métricas de autonomia** em `/imperius`: % ações auto vs aprovadas, taxa de reversão (qualidade), ROI por categoria.

---

## Detalhes técnicos

- **Stack IA**: Vercel AI SDK + Lovable AI Gateway (`google/gemini-3-pro-preview` para decisões críticas, `flash` para classificação rápida).
- **Tool calling**: `stopWhen: stepCountIs(50)`, `needsApproval` automático para risk=high.
- **Tabelas novas**: `imphq_ai_actions`, `imphq_ai_action_logs` (auditoria).
- **Edge functions novas**: `imperius-executor`, `imperius-scout` (cron), `studio-batch-cron`, `ads-rules-engine` (cron).
- **Reaproveitar**: `healthScore`, `intelligent-alerts`, `lead-predict`, `payment-recovery`, `facebook-ads-toggle`, `studio-generate`, `autonomous-ai-chatbot`, `whatsapp-api`.
- **Reversibilidade**: toda ação salva `revert_payload` (estado anterior) por 7 dias.

## Fora de escopo

- Reescrever sistemas existentes (apenas conectar via tools).
- Autonomia em `Vendas`/`Finanças` (apenas leitura).
- Integração com plataformas novas (Telegram, Instagram DM).

## Marcos de validação

| Semana | KPI |
|---|---|
| 1 | Imperius propõe ≥10 ações/dia, executa ≥3 low-risk |
| 2 | ≥1 venda recuperada/dia atribuída à IA |
| 3 | ≥5 criativos/semana auto-gerados aprovados; ≥3 ads pausados pela IA |
| 4 | Chatbot fecha ≥1 venda autonomamente; reversão <10% (qualidade) |
