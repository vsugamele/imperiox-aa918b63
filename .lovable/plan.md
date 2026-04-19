
## Análise

3 pedidos:
1. **OpenFlow resiliente**: se WhatsApp falhar, o fluxo continua nos próximos passos (especialmente e-mails)
2. **Mapear gatilhos** disponíveis e propor novos
3. **Telegram via número**: viável?

## Investigação rápida (via memória + arquivos conhecidos)

- `openflow-executor` é quem roda os steps. Precisa ver como trata erro de WhatsApp hoje.
- OpenFlow já tem hierarquia de 5 níveis pra resolver provider WhatsApp (pode marcar como "falha" e parar tudo).
- Telegram: **não dá para enviar mensagem só com número de telefone**. Bots do Telegram exigem que o usuário **inicie conversa com o bot primeiro** (envie /start) — limitação dura da API. Só com número não rola.

## Plano

### 1. OpenFlow — Continuidade em caso de falha (resiliente)

**Mudanças em `supabase/functions/openflow-executor/index.ts`:**
- Envolver execução de cada step de WhatsApp (`wa_send`, `wa_template`, etc.) em try/catch isolado
- Em caso de erro: 
  - Logar como `step_failed` no `imphq_openflow_logs` (com motivo)
  - Marcar step como `failed` mas **continuar para o próximo step**
  - Adicionar campo `continue_on_error: true` (default true para canais de comunicação)
- Em `FlowEditor.tsx`: adicionar toggle por step "Continuar em caso de falha" (default ON para WhatsApp/Telegram, OFF para steps críticos como "criar venda")
- Em `ExecutionsPanel.tsx`: badge visual amarelo "Parcial" quando execução completou com steps falhos

### 2. Catálogo de Gatilhos — atual + novos

**Já existem (mapear da UI atual):**
- Lead capturado, Pix gerado, Boleto gerado, Venda aprovada, Venda recusada, Reembolso, Carrinho abandonado, Webhook custom

**Propor novos gatilhos de alto valor:**
- `lead_inativo_X_dias` — lead sem interação há N dias (re-engajamento)
- `cliente_aniversario` — data de nascimento do lead
- `score_atingiu_X` — quando score do lead cruza um patamar (ex: 70+ = hot)
- `tag_adicionada` — quando tag específica é aplicada manualmente ou via automação
- `formulario_respondido` — quando lead responde formulário X
- `webinar_inscrito` / `webinar_assistido` / `webinar_nao_assistiu`
- `produto_visualizado_sem_compra` (via tracker UTM)
- `mensagem_recebida_whatsapp` — gatilho reativo (cliente respondeu palavra-chave)
- `compra_aniversario_X_dias` — N dias após primeira compra (upsell/renovação)
- `status_mudou` — qualquer transição de status do lead

→ Implementação: estender enum/lista de triggers no `FlowEditor` + handler em `openflow-executor` + cron job (`openflow-trigger-scheduler`) para gatilhos baseados em tempo (inativo, aniversário, X dias após).

### 3. Telegram — Realidade técnica

**Limitação dura da API do Telegram:** bots **não conseguem** enviar mensagem para alguém apenas com o número de telefone. O usuário precisa **primeiro abrir conversa com o seu bot** (clicar em link `t.me/seu_bot` ou escanear QR e enviar /start). Só depois disso o bot consegue mandar mensagens.

**O que dá para fazer (caminho viável):**
1. Criar bot no Telegram (BotFather → token)
2. Adicionar step `telegram_send` no OpenFlow
3. Em formulários/landing pages: incluir botão "Receber atualizações no Telegram" → abre `t.me/seu_bot?start=LEAD_ID_ENCODED`
4. Bot recebe `/start` com payload, salva `telegram_chat_id` no `imphq_leads`
5. A partir daí, fluxos podem enviar mensagem no Telegram da pessoa

→ É uma feature legítima, mas **exige opt-in ativo do lead**. Não dá para "puxar pelo número" como WhatsApp/SMS.

**Alternativa por número (se objetivo é ter mais um canal):** SMS via Twilio — esse sim funciona só com o número.

### Pergunta de decisão

Antes de partir pra implementação, preciso confirmar prioridade — são 3 frentes grandes:

## Arquivos previstos
- `supabase/functions/openflow-executor/index.ts` (resiliência + novos triggers)
- `supabase/functions/openflow-trigger-scheduler/index.ts` (novo, cron-based triggers)
- Migration: cron job + colunas `telegram_chat_id` em `imphq_leads`, `continue_on_error` em steps
- `src/components/openflow/FlowEditor.tsx` (toggle + novos triggers + step Telegram)
- `src/components/openflow/ExecutionsPanel.tsx` (badge "Parcial")
- `supabase/functions/telegram-bot/index.ts` (novo, recebe /start + envia mensagens)
