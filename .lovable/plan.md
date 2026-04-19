
## Análise

Duas frentes:
1. **Mais notificações push (PWA)** — que eventos podemos disparar
2. **Melhorias no Portal do Expert**

Já temos: `send-push` edge function, `PushOptIn`, `imphq_push_subscriptions`, `imphq_notification_preferences` (com 5 tipos: novo_lead, grupo_capacidade, disparo_concluido, erro_conexao, resposta_ia).

Já existe Portal do Expert com: avatar resumido, content_plan, eventos da semana, tasks, processos, status operacional, docs compartilhados, logs (mark_done, video/audio upload).

---

## Parte 1 — Novas notificações push

Adicionar ao `imphq_notification_preferences` + disparar via `send-push` nos pontos certos:

**Vendas e dinheiro (alta prioridade):**
- `venda_aprovada` — toda venda aprovada (com valor)
- `venda_recusada` — quando uma venda falha (cartão recusado/Pix expirado)
- `reembolso_solicitado` — refund/chargeback
- `meta_diaria_atingida` — quando bate meta de receita do dia

**Leads quentes:**
- `hot_lead` — lead com score ≥ 70 ou Pix gerado
- `lead_respondeu_whatsapp` — cliente respondeu campanha
- `lead_inativo_voltou` — lead inativo voltou a interagir

**Operacional:**
- `ads_anomalia` — CPA subiu 2σ ou CTR despencou (já temos detecção)
- `ads_pausado_automaticamente` — quando regra pausa anúncio
- `webhook_falhou` — pagamento webhook com erro
- `instancia_desconectou` — já existe `erro_conexao`, mas separar por instância

**Expert / equipe:**
- `expert_marcou_done` — expert marcou conteúdo como feito (no portal)
- `expert_subiu_video` — expert subiu vídeo/áudio
- `tarefa_atribuida` — alguém te atribuiu uma task no Kanban
- `mencao_chat` — alguém te mencionou no chat da equipe

**Calendário:**
- `evento_em_1h` — lembrete 1h antes de evento/live
- `live_comecando` — 5 min antes da live

→ Implementação: estender `Prefs` interface + adicionar disparos nos handlers existentes (`webhook-pagamento`, `lead-predict`, `expert-portal`, `notify-scheduler`).

---

## Parte 2 — Melhorias no Portal do Expert

Hoje o portal mostra dados, mas é mais "leitura". Propor:

**Comunicação bidirecional:**
- **Chat direto com você** dentro do portal (sem precisar WhatsApp) — usa `imphq_expert_logs` com action=`message`
- **Comentários por conteúdo** — expert pode deixar dúvida em cada item do plano
- **Sistema de aprovação** — você sobe roteiro, expert aprova/pede ajuste

**Ferramentas de gravação:**
- **Teleprompter integrado** — exibe roteiro em tela cheia com scroll auto-ajustável
- **Gravação direta no navegador** — usa MediaRecorder API, sem precisar app externo
- **Marcação de takes** — expert marca "este é o melhor" entre múltiplas gravações

**Briefing visual rico:**
- **Mini-player de referências** — vídeos exemplo embutidos por conteúdo
- **Moodboard** — imagens de referência por tema
- **Hooks sugeridos pela IA** — 3 ganchos de abertura por roteiro

**Performance e gamificação:**
- **Dashboard "como meus conteúdos performaram"** — views, leads gerados, vendas atribuídas
- **Streak de gravação** — X dias consecutivos cumprindo plano
- **Ranking semanal** — quanto do plano foi entregue (ex: 8/10 vídeos)

**Operacional:**
- **Lembretes push** — expert também ativa PWA e recebe notificação dos próximos conteúdos
- **Calendário próprio do expert** — só o que ele precisa gravar, com horários
- **Modo offline** — PWA do portal pra ele revisar roteiros sem internet
- **QR code de acesso** — gerar QR pro expert escanear e abrir o portal direto no celular

**Segurança:**
- **Token com expiração** — hoje token é eterno, adicionar `expires_at`
- **Revogar/regenerar token** com 1 clique
- **Log de acessos** — IP, device, horários

---

## Pergunta de decisão

São muitas opções. Pra não fazer um plano gigante de tudo, sugiro escolher por bloco:

## Arquivos previstos (depende da escolha)
- Notificações: `imphq_notification_preferences` (migration), `send-push` (sem mudança), handlers em `webhook-pagamento`, `lead-predict`, `expert-portal`, `notify-scheduler`, `NotificationPreferencesTab.tsx`
- Portal Expert: `supabase/functions/expert-portal/index.ts`, novo componente `ExpertChat.tsx`, `ExpertTeleprompter.tsx`, `ExpertRecorder.tsx`, `ExpertPerformance.tsx` na página `ExpertPortal.tsx`
