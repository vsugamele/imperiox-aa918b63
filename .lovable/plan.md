# Sprint Automação/IA — 7 dias

Foco: deixar mais coisas rodando sozinhas nas 4 áreas. Tudo plugado no Imperius (fila `imphq_ai_actions` → ActionInbox → execução com revert).

## 1. WhatsApp — Atendente IA com escalonamento (P0)
Hoje o chatbot autônomo (Gemini) responde, mas não sabe quando entregar pra humano nem qualifica.
- Nova edge `wa-ai-triage`: classifica cada msg recebida em `{intent, sentiment, urgency, fit_score}` antes do reply.
- Se `urgency=high` ou `intent=compra_quente` → cria ação `notify` + marca lead como Hot Lead + pinga responsável no WhatsApp pessoal.
- Se `sentiment=negativo 2x seguidas` → pausa bot, abre task `[atendimento humano]` no Kanban.
- Painel novo em `/whatsapp` aba "Triagem IA" com fila do dia + acurácia.

## 2. WhatsApp — Auto-resposta de objeções com biblioteca viva
- Tabela `imphq_wa_objections` (objecao, resposta_padrao, contexto_produto, score_uso).
- Quando IA detecta objeção recorrente sem resposta cadastrada, propõe rascunho no Imperius.
- Aprovou → vira resposta padrão; bot usa nas próximas.

## 3. Leads — Nutrição auto-gerada por segmento (P0)
Hoje `nurture-generator` existe mas é manual.
- Cron `nurture-auto-segment` diário: agrupa leads por `(estagio, ultimo_evento, dias_inativo)`, gera sequência de 3-5 toques (e-mail + WhatsApp) e enfileira em `imphq_ai_actions` como `proposed`.
- Quem nunca abriu nada em 14d → sequência "última chance" automática.
- Hot Lead sem contato em 2h → IA dispara mensagem personalizada (já com Avatar + última oferta) direto, sem aprovação (low-risk).

## 4. Ads — Otimização autônoma com regras IA (P0)
`ads-rules-engine` já existe; falta o cérebro.
- Nova edge `ads-ai-optimizer` (roda 3x/dia): lê insights 7d, aplica diagnóstico Yoshitani + detecta anomalias 2σ.
- Ações automáticas (low-risk): pausar adset com CPA > 2x meta por 48h; aumentar 20% budget em adset com ROAS > 3 e frequência < 2.
- Ações propostas (precisa aprovar): duplicar criativo top, matar campanha inteira, mudar pixel.
- Tudo loga em `imphq_ads_actions` + aparece no ActionInbox com botão "Reverter".

## 5. Ads — Gerador de criativos a partir do que está performando
- Botão "Clonar com IA" no Gerenciador → pega criativo Top (CTR > 2%) + Avatar + briefing → gera 3 variações de copy/headline/CTA via Studio.
- Auto-cria task no Kanban com prompt pronto para design.

## 6. Conteúdo — Calendário editorial auto-pilotado
- Cron `content-calendar-ai` semanal (segunda 6h): analisa últimos 30d de vendas + market intel + concorrentes e gera 7 ideias de conteúdo (reel/carrossel/story) por projeto Vendendo.
- Salva em `imphq_kanban_cards` na coluna "Ideias IA" com prompt Studio embutido.
- Botão "Gerar agora" abre Studio com tudo pré-preenchido.

## 7. Imperius — Inbox priorizado + digest diário
- Score de prioridade na fila: `(impacto_estimado_R$ * confianca) / risco`.
- Ordena ActionInbox por esse score, badge "🔥 R$ 12k em jogo".
- Edge `imperius-daily-digest` 8h: e-mail + push "3 ações esperando você + 5 executadas ontem (R$ X recuperados)".

---

## Stack técnica

| Item | Arquivos novos | Edits |
|---|---|---|
| 1 | `supabase/functions/wa-ai-triage/index.ts`, `src/components/whatsapp/TriagemPanel.tsx` | `wa-ai-config`, hook do `whatsapp-api` |
| 2 | migration `imphq_wa_objections`, `src/components/whatsapp/ObjectionsLibrary.tsx` | `wa-ai-triage` |
| 3 | `supabase/functions/nurture-auto-segment/index.ts` + pg_cron | `imperius-scout` |
| 4 | `supabase/functions/ads-ai-optimizer/index.ts` + pg_cron | `imperius-executor` (novos kinds: `pauseAdset`, `bumpBudget`) |
| 5 | botão em `CampanhasTable.tsx` | `studio-generate` recebe contexto ad |
| 6 | `supabase/functions/content-calendar-ai/index.ts` + pg_cron | `KanbanPage.tsx` (coluna "Ideias IA") |
| 7 | `supabase/functions/imperius-daily-digest/index.ts` | `ActionInbox.tsx` (sort + badge), migration coluna `priority_score` em `imphq_ai_actions` |

Modelo padrão: `google/gemini-3-flash-preview` (triagem/digest); `google/gemini-3.1-pro-preview` para otimização de ads e nutrição (decisão financeira).

## Ordem sugerida (1 semana)

```text
Dia 1-2:  #4 Ads optimizer  +  #7 Imperius digest
Dia 3:    #1 WhatsApp triagem
Dia 4:    #3 Nutrição auto
Dia 5:    #6 Calendário editorial
Dia 6:    #2 Objeções  +  #5 Clonar criativo
Dia 7:    QA + ajuste de thresholds
```

Cada item é independente — posso começar por qualquer um ou em qualquer combinação.

## Pergunta

Topa o pacote completo nessa ordem, ou prefere recortar (ex: só os 4 P0 marcados)?