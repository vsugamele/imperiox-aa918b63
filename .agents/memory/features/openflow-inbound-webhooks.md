---
name: OpenFlow Inbound Webhooks
description: Gatilho webhook_externo com tabela imphq_flow_webhooks e edge openflow-webhook (URL por token) para Zernio/n8n/Make
type: feature
---
- Gatilho `webhook_externo` disponível em OpenFlow.tsx e FlowEditor.tsx.
- Tabela `imphq_flow_webhooks`: token único na URL, project_id, automacao_id opcional, `field_map` (nome/email/telefone/produto/valor/mensagem → path do payload), ativo, total_recebidos, last_payload, last_event_id (dedupe).
- Edge `openflow-webhook` (verify_jwt=false): URL `/functions/v1/openflow-webhook/{token}`; GET responde ping/hub.challenge; POST normaliza payload (auto-detect + field_map), inclui query params, e chama `openflow-executor` com trigger_tipo `webhook_externo`. Sempre retorna 200 para não travar retries.
- UI: aba "Webhooks de Entrada" em /openflow (InboundWebhooks.tsx) com copiar URL, rotacionar token, disparo de teste e visualização do último payload.
