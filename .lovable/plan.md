

# Plano: PWA Completa + Notificações + Jornada do Lead Enriquecida

3 grandes blocos de evolução.

---

## Bloco 1: PWA com Notificações Push

### O que falta hoje
- Manifest e meta tags existem, mas **não há service worker** nem `vite-plugin-pwa`
- Notificações usam `Notification.requestPermission()` mas só funcionam com a aba aberta (browser notification, não push)
- Não há registro de push subscription nem envio server-side

### Plano
1. **Instalar `vite-plugin-pwa`** com `registerType: "autoUpdate"`, `devOptions: { enabled: false }`, `navigateFallbackDenylist: [/^\/~oauth/]`
2. **Guard de registro** em `main.tsx`: não registrar SW se estiver em iframe ou domínio de preview
3. **Workbox config**: cache de assets estáticos + runtime cache para fontes/imagens
4. **Push notifications**: Criar tabela `imphq_push_subscriptions` (user_id, endpoint, keys_p256dh, keys_auth) para persistir subscriptions
5. **Edge function `send-push`**: recebe user_id + título/mensagem, busca subscriptions e envia via Web Push (precisa de VAPID keys como secret)
6. **Integrar no `notify-scheduler`**: além de salvar em `imphq_notifications`, chamar `send-push` para notificar mesmo com app fechado
7. **Componente de opt-in**: botão no header/configurações para ativar notificações push

### Arquivos
| Arquivo | Mudança |
|---|---|
| `vite.config.ts` | Adicionar VitePWA plugin |
| `src/main.tsx` | Guard de iframe/preview + unregister |
| Migration SQL | Tabela `imphq_push_subscriptions` |
| `supabase/functions/send-push/index.ts` | Nova edge function Web Push |
| `supabase/functions/notify-scheduler/index.ts` | Chamar send-push |
| `src/components/PushOptIn.tsx` | Novo componente opt-in |

---

## Bloco 2: Sistema de Dados Mais Interligado

### Gaps atuais
- Webhook não identifica **order bump vs upsell vs produto principal** — tudo vira uma venda genérica
- Não há campo `tipo_venda` (principal, orderbump, upsell, downsell) na tabela `imphq_vendas`
- Lead não guarda histórico de **lançamentos participados**
- Sem cruzamento entre formulários preenchidos e conversão posterior
- Automações (OpenFlow) não recebem dados de qualificação do lead

### Plano

#### 2.1 Enriquecer `imphq_vendas` com tipo de produto
- Migration: adicionar coluna `tipo_venda TEXT DEFAULT 'principal'` (valores: principal, orderbump, upsell, downsell)
- No `webhook-pagamento`: detectar order bump/upsell dos payloads:
  - **Hotmart**: `body.data.purchase.is_order_bump`, `body.data.product.has_co_production`
  - **Kiwify**: `body.is_bump`, `body.bump_id`
  - **Ticto**: `body.item.is_bump`, `body.item.is_upsell`
- Na timeline e na ficha do lead, exibir badge "Order Bump", "Upsell" etc.

#### 2.2 Score de qualificação baseado em ações
- O lead já tem `score` (0-100). Hoje é calculado no frontend de forma estática
- Migration: adicionar `imphq_lead_scores_log` (lead_id, acao, pontos, created_at) para rastrear cada ponto ganho
- Criar regras no webhook e capture-lead:
  - +10 lead capturado, +5 form preenchido, +15 checkout iniciado, +20 pix gerado, +50 compra, +30 upsell aceito, +5 por pageview (max 3x)
- Edge function ou trigger que soma e atualiza `imphq_leads.score`

#### 2.3 Perfil de qualificação do lead
- No painel do lead (Leads.tsx), nova aba **"Qualificação"** que mostra:
  - Em quais formulários respondeu e respostas
  - Quais lançamentos/eventos participou (baseado em tags ou eventos)
  - Histórico de compras com tipo (bump/upsell/principal)
  - Score detalhado com breakdown de pontos
  - Quantidade de visitas e páginas vistas

#### 2.4 Webhook enriquecido: gravar UTMs e dados extras do lead
- Hoje o webhook grava `data.ultimo_evento` mas não acumula UTMs de múltiplas interações
- Passar a gravar no lead.data: `{ interacoes: [{ evento, data, produto, utms, plataforma }] }` — um array append-only

### Arquivos
| Arquivo | Mudança |
|---|---|
| Migration SQL | `tipo_venda` em imphq_vendas, tabela `imphq_lead_scores_log` |
| `supabase/functions/webhook-pagamento/index.ts` | Detectar bump/upsell, scoring, acumular interações |
| `supabase/functions/capture-lead/index.ts` | Scoring ao capturar, acumular interações |
| `src/pages/Leads.tsx` | Aba Qualificação, badges tipo_venda na timeline |

---

## Bloco 3: Dados de Formulário Não Aparecendo

### Bug atual
- O `capture-lead` salva respostas em `imphq_lead_responses` com `field_key` como o nome do campo HTML
- No frontend, a timeline busca corretamente por `lead_id` e agrupa por form_id
- **Problema provável**: os campos do formulário não estão sendo mapeados para `question` legível — o campo `question` recebe o mesmo valor de `field_key` (ex: "campo_1" em vez de "Qual seu maior desafio?")

### Plano
- No `capture-lead`: buscar os campos do formulário (`imphq_capture_forms.campos`) para mapear `field_key` → label/question real
- Gravar `question` com o label do campo e `field_key` com o ID técnico
- Na ficha do lead, exibir as respostas com os labels corretos

### Arquivos
| Arquivo | Mudança |
|---|---|
| `supabase/functions/capture-lead/index.ts` | Mapear field_key → question usando campos do form |

---

## Ordem de Execução

1. **Bloco 3** (fix formulários — quick win)
2. **Bloco 2.1** (tipo_venda na tabela + detecção no webhook)
3. **Bloco 2.2** (scoring log + cálculo)
4. **Bloco 2.4** (interações acumuladas no lead.data)
5. **Bloco 2.3** (aba Qualificação no frontend)
6. **Bloco 1** (PWA + Push — mais complexo, precisa VAPID keys)

---

## Resumo

- **9 arquivos** modificados/criados
- **2 migrações SQL** (push_subscriptions, tipo_venda, lead_scores_log)
- **1 nova edge function** (send-push)
- **1 novo componente** (PushOptIn)

Sugiro implementar em 2-3 rodadas para manter o controle.

