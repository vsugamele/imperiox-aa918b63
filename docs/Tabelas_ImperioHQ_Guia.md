# Guia de Tabelas do Banco de Dados (Imperio HQ)

Este guia documenta as principais tabelas relacionais do sistema **Imperio HQ**, identificadas pelo prefixo `imphq_`. Elas dão suporte aos variados módulos do painel, desde a gestão de tarefas e automações até análise de inteligência de mercado, CRM, anúncios e área de membros.

> Atualizado: 2026-04 — Reflete arquitetura atual (Edge Functions, OpenFlow, Predictive CRM, Health Monitor, Webhook de Membros, etc).

## 1. Núcleo e Projetos
* **`imphq_projects`** — Projetos/produtos gerenciados. Chave-mestra (`project_id`) referenciada pela maioria das demais tabelas. Projetos com status `vendendo` têm prioridade máxima nas análises da IA.
* **`imphq_team_members`** — Cadastro da equipe (nome, avatar, função). Sincronizado com `imphq_user_roles` para aprovação automática de e-mails convidados.
* **`imphq_user_roles`** — Papéis de acesso (admin, editor, viewer). Consolidado no painel `/configuracoes` (Gestão de Usuários).
* **`imphq_integration_credentials`** — **Cofre seguro** para tokens sensíveis (Facebook, Resend, Google, Evolution API). Acessado exclusivamente via Edge Functions; nunca expor no client.

## 2. Tarefas, Kanban e Calendário
* **`imphq_tasks`** — Tarefas avulsas (to-do).
* **`imphq_kanban_columns`** / **`imphq_kanban_cards`** — Quadros Kanban com colunas e cartões; cards podem ser sincronizados com Google Calendar via marcador `[kanban:card_id]` e `google_event_id`.
* **`imphq_calendar_events`** — Eventos do painel (reuniões, publicações, vistorias).

## 3. Tracker, Eventos e Vendas
* **`imphq_tracking_links`** — Links UTM com macros do Meta Ads (separador `%7C`, ex: `{{adset.name}}%7C{{adset.id}}`).
* **`imphq_clicks`** — Log de cliques (IP, UA, geo).
* **`imphq_events`** — Eventos analíticos unificados (`PageView`, `LeadCapture`, `ViewContent`, `AddToCart`, `ButtonClick`) capturados via `imptrack.js` com `visitor_id`. Também recebe logs de **observabilidade** (Health Monitor, falhas de provedores).
* **`imphq_vendas`** — Conversões. Categoriza produtos em `principal`, `orderbump`, `upsell`, `downsell`. Usa `item.price` para evitar inflação de receita. Suporta status `aprovada`, `pendente`, `recusada`, `cancelada`, `chargeback`, `reembolsada`.

## 4. OpenFlow (Automações)
* **`imphq_automacoes`** — Fluxos visuais (e-mail, WhatsApp e híbridos). Normaliza campos (ex: `to`/`para`).
* **`imphq_webhooks`** — Logs de webhooks recebidos/enviados. Central de observabilidade exibe os 100 últimos com botão **Reprocessar** para PIX perdidos.
* **`imphq_flow_executions`** — Execuções com status `running`, `waiting`, `done`, `error`. Cron `openflow-resume` (a cada 2 min) retoma execuções travadas (`waiting` + `next_run_at <= now()`).

## 5. CRM, Leads e Atendimento
* **`imphq_leads`** — Base de contatos. Status: `lead`, `cliente`, `vip`, `inativo`, `cancelado`, `chargeback`. Score com teto de 100 (recalculado por `trg_recalc_lead_score`). Persiste `ultimo_produto`/`ultimo_evento`. Ver detalhes em `Detalhes_Imphq_Leads.md`.
* **`imphq_lead_responses`** — Respostas de formulários. Mapeamento manual entre `form_id` (TEXT) e `imphq_capture_forms.id` (UUID).
* **`imphq_capture_forms`** — Formulários de captura.
* **`imphq_lead_predictions`** — **CRM Preditivo**. TTL de 7 dias. IA estima probabilidade de conversão a partir do histórico.
* **`imphq_lead_scores_log`** — Histórico granular de pontuação (origem, evento, pontos atribuídos).
* **`imphq_activity_logs`** — Linha do tempo manual unificada com automações na aba **Jornada**.

## 6. WhatsApp (Evolution API)
* **`imphq_wa_conversations`** / **`imphq_wa_messages`** — Conversas e mensagens. Mídia volátil persistida no bucket `whatsapp-media`.
* **`imphq_wa_instances`** — Instâncias (resolução em hierarquia de 5 níveis: step → auto → lead → projeto ativo → fallback global).
* **`imphq_wa_campaigns`** / **`imphq_wa_campaign_steps`** — Campanhas em sequência. Geração de copy por IA usa `produto`, briefing e branding. Cron `wa-campaign-scheduler` agenda disparos (`pg_cron` + `net.http_post`).
* **`imphq_wa_ai_config`** — Chatbot autônomo (Gemini) com horários comerciais e personalidade.
* **`imphq_wa_group_links`** — Links inteligentes de distribuição (sequencial/balanceada) com log de cliques.
* **Health Monitor** (`wa-health-monitor`, cron */5min) — Pinga instâncias e alerta por e-mail em falhas.

## 7. Mentes IA / Skills
* **`imphq_ai_chats`** — Histórico de chats com agentes especialistas. Suporta comando `/ia` que agrega contexto do projeto em `ai_response`.
* **`imphq_kb`** — Base de conhecimento (diretrizes para IAs).
* **`imphq_skills`** — Catálogo de habilidades. Usa coluna `slug` para matching exato em Edge Functions (ex: `avatar-architect`, `funnel-hacker`).

## 8. Market Intel, Concorrentes e Avatar
* **`imphq_mi_opportunities`** — Curadoria de oportunidades (nicho, dor, ângulo, estrutura).
* **`imphq_competitors`** — Análise de concorrentes (stack, páginas, ofertas, score).
* **`imphq_avatars`** — Sistema de inteligência do avatar. Suporta `data.avatars_por_produto` (múltiplos contextos por projeto). Mapeia psique, voyerismo e Copy Arsenal.

## 9. Conteúdo, Mídia e Referências
* **`imphq_referencias`** — Swipe File (links, criativos, ideias).
* **`imphq_content_library`** — Repositório de assets. **Pastas virtuais** emuladas via prefixo em `content_category` (ex: `reels/pasta-1`).
* **`imphq_growth_metrics`** — Funil de aquisição→retenção→upsell (Growth Dashboard).

## 10. Anúncios e Finanças
* **`imphq_ads_accounts`** / **`imphq_ads_campaigns`** / **`imphq_ads_insights`** — Sincronização Facebook Ads. Tratamento de erros estruturado (#200, #190).
* **Atribuição proporcional** — Ads rateados por share de receita do produto; custos fixos por data.
* **ROAS Real** — Cruzamento de UTM com `imphq_vendas` (bypassa falhas do Pixel).
* **Diagnóstico Yoshitani 7/5/3** — CPA/Checkout, taxa de LP, taxa de Checkout.

## 11. Área de Membros (novo)
* **Edge Function `membros-webhook`** (público, `verify_jwt = false`) — Recebe eventos da área de membros externa.
* **Eventos suportados**: `membro_cadastrado`, `webinar_assistido`, `pesquisa_respondida`, `prova_enviada`, `aula_concluida`.
* **Segregação de dados**:
  * Upsert em `imphq_leads` (chave: e-mail) com tag `area-membros`.
  * Respostas → `imphq_lead_responses` (1 linha por pergunta/resposta).
  * Interações + UTMs → `imphq_events`.
  * Pontuação automática → `imphq_lead_scores_log` (ex: webinar +25, prova +20).

## 12. Expert Portal
* **`imphq_expert_logs`** — RLS público para interações sem autenticação no Portal do Expert.

## 13. Pagamentos e Webhooks
* **`webhook-pagamento`** (Edge Function) — Recebe Hotmart, Kiwify, Ticto. Detecta plataforma pelo formato. Cria lead + venda + dispara CAPI (com `event_id` para deduplicação) + automações.
* **Cancelamentos & Chargebacks** — Atualizam `imphq_vendas.status` e `imphq_leads.status` para `cancelado`/`chargeback`, refletindo no estágio do funil em /leads.

---

## Edge Functions ativas (resumo)

| Função | Propósito |
|---|---|
| `webhook-pagamento` | Ingestão Hotmart/Kiwify/Ticto |
| `membros-webhook` | Ingestão da área de membros |
| `whatsapp-api` | Proxy CORS Evolution + normalização de eventos |
| `wa-campaign-scheduler` | Cron de disparos |
| `wa-health-monitor` | Health-check de instâncias |
| `wa-group-distributor` | Distribuição em grupos |
| `openflow-executor` / `openflow-resume` / `openflow-ai` | Motor de automações + IA |
| `facebook-ads-sync` / `facebook-ads-sync-all` | Sync de anúncios |
| `lead-predict` | CRM Preditivo |
| `daily-briefing` | Briefing diário por e-mail |
| `notify-scheduler` | Push e e-mail agendados |
| `payment-recovery` | Recuperação de PIX/Boleto |
| `expert-portal` / `expert-research` | Portal do Expert + pesquisa |
| `google-calendar-sync` | Sync com Google Calendar |
| `send-project-email` / `send-push` | Envio transacional |
| `capture-lead` | Captura via formulário |
| `admin-users` | Gestão de usuários/roles |
| `imperio-api` | API genérica para integrações externas |

---

> [!TIP]
> Histórico completo em `supabase/migrations`. Para qualquer alteração de schema, crie uma migração — não edite o banco diretamente. IDs: **TEXT** para `projects`/`leads`/`vendas`; **UUID** para os demais.
