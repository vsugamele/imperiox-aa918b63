# Gatilho por Webhook no OpenFlow

## Situação atual (verificada)

O OpenFlow **não tem** um gatilho genérico por webhook. Os gatilhos existentes (`src/pages/OpenFlow.tsx`, `FlowEditor.tsx`) são todos internos: pagamento (Hotmart/Kiwify/Ticto/Perfect Pay via `webhook-pagamento`), lead novo, tag, WhatsApp, Messenger e Webchat. O `openflow-executor` já aceita qualquer `trigger_tipo` no body, mas só pode ser chamado com a service key — não existe endpoint público que o Zernio (ou qualquer ferramenta) possa chamar.

## O que será feito

1. **Novo gatilho `webhook_externo`** na lista de gatilhos do OpenFlow (grupo "Outros canais"), com campo de palavra-chave/evento opcional para filtrar qual fluxo dispara.

2. **Nova Edge Function pública `openflow-webhook`**:
   - URL: `.../functions/v1/openflow-webhook/{token}`
   - Valida o token, resolve projeto + fluxo, registra o payload em log e chama `openflow-executor` com `trigger_tipo: "webhook_externo"`.
   - Aceita mapeamento simples de campos do payload (nome, email, telefone, produto, valor, mensagem) por caminho JSON, com detecção automática para os nomes mais comuns.
   - Sempre responde 200 (erros ficam em log) para não travar retries do Zernio.

3. **Tabela `imphq_flow_webhooks`**: token, project_id, automacao_id (opcional), nome, mapeamento de campos, contadores e último payload recebido. Com GRANTs e RLS por projeto.

4. **Aba "Webhooks de Entrada" no OpenFlow**: criar/rotacionar token, copiar URL, ver últimos payloads recebidos e um botão "Testar" que dispara o fluxo com um payload de exemplo.

## Detalhes técnicos

- `supabase/functions/openflow-webhook/index.ts` com `verify_jwt = false` em `supabase/config.toml`.
- O payload bruto entra em `lead_data` completo, então os passos do fluxo podem usar `{{qualquer.campo}}` do JSON via o mecanismo de variáveis já existente.
- Deduplicação opcional por `event_id`/`id` do payload para evitar disparo duplo em retry.
- Nada muda nos fluxos atuais; o gatilho novo é aditivo.
