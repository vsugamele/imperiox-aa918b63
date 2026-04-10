

# Plano: Próximos Passos de Integração (Itens 3, 4, 7, 8)

Os itens 1 (Painel de Status), 2 (Webhook Log) e 5 (CORS) já foram implementados. Restam 5 itens. Vou agrupar em duas fases por dependência.

---

## Fase 1 — Segurança + Resiliência (itens 3, 7)

### 3. Mover tokens sensíveis do JSONB para tabela segura

Atualmente o `facebook_marketing_token` e a `resend_api_key` ficam dentro de `imphq_projects.data` — qualquer query que retorna `data` expõe esses tokens ao frontend.

**Mudanças:**
- Criar tabela `imphq_integration_credentials` com colunas: `id`, `project_id`, `provider` (facebook, resend, google), `credentials` (JSONB), `expires_at`, `created_at`, `updated_at`
- RLS restritivo: apenas o owner do projeto pode ler, e apenas via service_role nas Edge Functions
- Migrar as Edge Functions `facebook-ads-sync`, `facebook-ads-sync-all` e `send-project-email` para ler tokens dessa tabela em vez do JSONB
- No frontend, os formulários de configuração (Briefing) passam a salvar nessa tabela via Edge Function (nunca expõem o token ao client)

### 7. Rate limiting na Evolution API

**Mudanças:**
- No `whatsapp-api/index.ts`, adicionar delay de 200ms entre chamadas no `fetch_avatars_batch` e no `sync_contacts`
- Limitar batch de sync a 50 contatos por execução
- Retornar `{ partial: true, processed: N }` quando atingir o limite

---

## Fase 2 — Motor de Execução do OpenFlow (itens 4, 6, 8)

### 4. Edge Function `openflow-executor`

O FlowEditor já salva automações com trigger, ações e delays na tabela `imphq_automacoes`. O que falta é um "motor" que execute essas ações quando o trigger dispara.

**Mudanças:**
- Criar tabela `imphq_flow_executions` com: `id`, `automacao_id`, `lead_id`, `current_step`, `status` (pending/running/completed/failed), `step_results` (JSONB), `next_run_at`, `created_at`
- Criar Edge Function `openflow-executor` que:
  1. Recebe `{ trigger_tipo, project_id, lead_data }` (chamado pelo `webhook-pagamento` ou manualmente)
  2. Busca automações ativas para aquele trigger + projeto
  3. Cria um registro em `imphq_flow_executions`
  4. Percorre cada etapa sequencialmente, respeitando `delay_min`
  5. Para ações de WhatsApp: chama `whatsapp-api` com action `send`
  6. Para ações de Email: chama `send-project-email`
  7. Para condições: avalia e pula para o branch correto
  8. Salva resultado de cada etapa em `step_results`

### 6 + 8. Integrar webhook-pagamento ao executor + Resend

**Mudanças:**
- No final do processamento do `webhook-pagamento`, após salvar a venda, chamar `openflow-executor` passando o trigger (`compra_aprovada`, `lead_novo`, etc.) e os dados do lead
- O executor já chamará `send-project-email` para ações de email, completando a integração Resend

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/*` | Criar `imphq_integration_credentials` e `imphq_flow_executions` |
| `supabase/functions/openflow-executor/index.ts` | **Novo** — motor de execução |
| `supabase/functions/webhook-pagamento/index.ts` | Chamar executor após processar venda |
| `supabase/functions/facebook-ads-sync/index.ts` | Ler token da nova tabela |
| `supabase/functions/facebook-ads-sync-all/index.ts` | Ler token da nova tabela |
| `supabase/functions/send-project-email/index.ts` | Ler Resend key da nova tabela |
| `supabase/functions/whatsapp-api/index.ts` | Rate limiting no sync/avatars |
| `src/components/projeto/ProjetoBriefing.tsx` | Salvar tokens via Edge Function |

## Resultado

- Tokens nunca mais expostos ao frontend
- Evolution API protegida contra rate limit
- Automações do OpenFlow executam automaticamente quando um webhook de pagamento chega — enviando WhatsApp e email sem intervenção manual

