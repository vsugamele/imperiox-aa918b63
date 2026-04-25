
## Análise — sistema de Campanhas + Grupos hoje

**O que já tem (bom):**
- Campanhas com sequência de steps (texto/imagem/áudio/vídeo/doc), agendamento por `days_offset` ou `send_date`, scheduler pg_cron de 1min, automações (welcome, exit DM, anti-hack, @all), distribuidor de grupos com slug + cap por grupo, KPIs e logs.

**Gaps reais que vi no código:**

### 🔴 Bugs / fragilidades
1. **CampaignAutomationPanel** — Switch de welcome/exit só desliga, **nunca liga** (falta `else` no `onCheckedChange` pra setar string vazia editável). Hoje, se a campanha nasceu sem msg, o usuário fica sem como ativar.
2. **Scheduler timezone** — usa `new Date(now - 3h).toISOString()` que **quebra no horário de verão** e em UTC negativo (gambiarra). Deveria usar `Intl.DateTimeFormat` com `America/Sao_Paulo` (já é padrão do projeto, ver memory `tech/localization/timezone-standards`).
3. **Sem janela de envio** — scheduler dispara 24h. Se step tá marcado pra 02:00, dispara 02:00 (risco de ban + má experiência). Precisa respeitar janela permitida (ex: 08h–22h).
4. **Sem jitter humano** — delay fixo de 3s entre grupos é detectável. Real anti-ban usa randomização (3–8s) + pausa maior a cada N grupos.
5. **Sem retry** — se falhar (timeout, 502), loga "failed" e abandona. Deveria tentar 2–3x com backoff.
6. **`exit_message` no form de criação** — o estado `form` não tem `exit_message` mas o JSX seta. Campo morto, nunca persiste.
7. **Distribuidor não respeita `max_per_group`** — vi a tabela `imphq_wa_distributor_clicks` sendo lida só pra stats, mas não há lógica de pular grupo cheio (precisa confirmar na edge `wa-group-distributor`).

### 🟡 Features que faltam (alto valor)
8. **Preview da mensagem renderizada** — ver como vai chegar no celular antes de salvar (com mídia, quebra de linha, emoji).
9. **Variáveis dinâmicas** — `{nome}`, `{grupo}`, `{produto}` nos templates (hoje texto é estático, todo grupo recebe igual).
10. **Duplicar campanha / duplicar step** — replicar sequência testada pra novo lançamento.
11. **Reordenar steps** — `GripVertical` é só decoração, não tem drag-and-drop nem botões ↑↓.
12. **Teste de envio (1 grupo)** — botão "enviar pra mim agora" pra validar copy antes de agendar pra 50 grupos.
13. **Pausar grupo específico** — hoje pausa a campanha inteira, não dá pra remover 1 grupo problemático sem editar tudo.
14. **Métricas reais por step** — KPI cards mostram total agregado; falta ver "step #3 falhou em 12/40 grupos".
15. **A/B de copy** — duas variantes do mesmo step, scheduler escolhe aleatório por grupo.
16. **Distribuidor: grupo cheio → pula automático** — se `count >= max_per_group`, redireciona pro próximo grupo da fila (skip + log).
17. **Distribuidor: rotação ponderada** — distribuir desigual (ex: grupo 1 = 60%, grupo 2 = 40%) pra encher grupos "âncora" primeiro.
18. **Webhook on-failure** — disparar alerta (email/push) se step falhar em >30% dos grupos (sinal de banimento).

### 🟢 Polish
19. Filtro de campanhas por status/projeto na lista.
20. Mostrar próximo step agendado no card (ex: "Próximo: hoje 14:00 — texto").
21. Histórico visual (timeline) da campanha em vez de só logs tabulares.

---

## Proposta de execução — Bloco 6 (priorizado)

Sugiro tocar em **3 ondas**, do mais crítico pro mais nice-to-have. Confirma quais ondas você quer agora.

### Onda 6A — Bugs críticos + anti-ban (essencial, ~1h)
- Fix switch on/off no `CampaignAutomationPanel` (#1)
- Fix `exit_message` morto no form de criar campanha (#6)
- Scheduler usa `Intl.DateTimeFormat` com `America/Sao_Paulo` (#2)
- Janela de envio configurável por campanha (default 08h–22h) — adicionar colunas `send_window_start` / `send_window_end` em `imphq_wa_campaigns` (#3)
- Jitter aleatório 3–8s entre grupos + pausa de 30s a cada 10 grupos (#4)
- Retry 2x com backoff exponencial em falhas de rede (#5)

### Onda 6B — UX produtiva (alto valor, ~1h)
- **Variáveis dinâmicas** `{nome}`, `{grupo_nome}`, `{produto}` no scheduler + helper inline no editor (#9)
- **Botão "Testar agora" por step** — dispara só pra 1 grupo selecionado (#12)
- **Duplicar campanha** + **duplicar step** (#10)
- **Reordenar steps** com setas ↑↓ (drag-and-drop fica pra depois) (#11)
- **Preview do step** — mini-card lateral mostrando como fica no WhatsApp (bubble verde, mídia inline) (#8)
- **Próximo step agendado** no card da campanha (#20)

### Onda 6C — Inteligência + distribuidor (estratégico, ~1h)
- **Métricas por step** no `CampaignKPICards` (sucesso/falha por step, não só total) (#14)
- **Pausar grupo individual** dentro de uma campanha (sem precisar editar a lista) (#13)
- **Distribuidor: skip de grupo cheio** + **rotação ponderada** opcional (#16, #17)
- **Alerta automático** se step falhar >30% (push notification + log em `imphq_events`) (#18)
- **A/B de copy** por step (campo `content_b` opcional, scheduler sorteia 50/50) (#15)

---

**Schema mínimo (Onda 6A + 6B + 6C):**
- `imphq_wa_campaigns`: + `send_window_start TIME DEFAULT '08:00'`, `send_window_end TIME DEFAULT '22:00'`, `paused_groups TEXT[] DEFAULT '{}'`
- `imphq_wa_campaign_steps`: + `content_b TEXT` (A/B opcional)
- `imphq_wa_group_distributors`: + `weights JSONB` (rotação ponderada opcional)

**Sem schema novo se rodar só 6A.**

---

Me diz: **"toca 6A"**, **"toca 6A+6B"** ou **"toca tudo"** que saio do plan mode e mando ver. Se quiser cortar/priorizar item específico, é só falar.
