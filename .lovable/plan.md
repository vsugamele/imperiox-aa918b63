
Objetivo

Fazer o OpenFlow realmente disparar mensagens, permitir envio de WhatsApp a partir de Leads e deixar o registro de trigger/erro/reenvio confiável.

Diagnóstico que encontrei

- O problema principal está no motor: o editor salva as automações em `imphq_automacoes.acoes`, mas o `openflow-executor` executa `auto.etapas`. Resultado: a automação é “encontrada”, cria execução/log, mas roda 0 etapas e não envia nada.
- O schema também não bate:
  - editor usa `template`, `delay_min` e `tipo: "aguardar"`;
  - executor espera `mensagem|texto` e `delay|espera`.
- Em Leads, o disparo manual ainda usa fluxo legado (`auto.data?.actions`) e chama `whatsapp-api` num formato incompatível com o restante do sistema.
- `LeadWhatsAppDialog` manda `conversation_id` com o telefone; isso não é um id real de conversa e pode impedir o envio interno.
- `webhook-pagamento` grava `imphq_webhooks.processado = false` e não marca `true` no final, então os logs de trigger ficam enganosos.
- O executor pode terminar como `success/completed` mesmo quando uma etapa falha.
- A autoescolha de provider não é segura para múltiplos números/projetos.
- Execuções com `next_run_at` entram em `waiting`, mas hoje não há retomada automática visível no código.

Plano de implementação

1. Corrigir o núcleo do OpenFlow
- Ajustar `openflow-executor` para ler `auto.acoes` como fonte principal e manter fallback para `auto.etapas` legado.
- Normalizar os tipos/campos que o executor entende:
  - `whatsapp` usa `template` como mensagem;
  - `aguardar` usa `delay_min`;
  - `condicao` continua compatível;
  - manter leitura de chaves antigas (`mensagem`, `texto`, `delay`, `espera`) para não quebrar dados já salvos.
- Corrigir o status final da execução:
  - falha real de etapa => `failed`;
  - delay futuro => `waiting`;
  - nunca marcar “sucesso” quando nenhuma mensagem foi enviada de fato.
- Padronizar ids de trigger entre UI e functions para evitar mismatch silencioso.

2. Consertar envio pelo módulo Leads
- Trocar o disparo manual de automação em `Leads.tsx` para chamar o `openflow-executor`, em vez do código legado.
- Fazer o botão de WhatsApp do lead abrir o envio interno do sistema (e deixar `wa.me` como ação secundária, se fizer sentido).
- Corrigir `LeadWhatsAppDialog` para:
  - não enviar `conversation_id` inválido;
  - enviar `content`, `project_id` e `provider_id` no formato esperado;
  - pré-selecionar provider quando houver um único ativo ou um provider do projeto do lead;
  - mostrar erro claro quando não houver provider disponível.
- Alinhar a UI com o backend para não exibir opções de provider que o `whatsapp-api` não consegue resolver.

3. Melhorar a resolução do provider WhatsApp
- Manter a hierarquia, mas torná-la segura para multi-instância:
  1. `step.provider_id`
  2. `auto.provider_id`
  3. `lead_data.provider_id`
  4. provider ativo do mesmo projeto
  5. fallback global
- Registrar em cada etapa qual provider foi escolhido/tentado.
- Se não houver provider válido, falhar explicitamente no teste, na execução e no log.

4. Melhorar logs, triggers e reenvio
- Em `webhook-pagamento`, salvar o webhook, processar e depois atualizar `processado=true` quando o fluxo concluir sem erro.
- Garantir que erro de processamento seja ligado ao webhook correto e apareça de forma legível.
- Corrigir o reprocesso do OpenFlow para reenviar o contexto original, inclusive `project_id`.
- Enriquecer `imphq_automacao_logs`/`imphq_flow_executions` com dados úteis no JSON já existente:
  - trigger recebido,
  - telefone,
  - provider usado,
  - preview da mensagem,
  - resposta resumida da API,
  - motivo do erro.
- Adicionar ação de “reenviar execução” usando o `trigger_data` já salvo no log da automação.

5. Resolver execuções em espera
- Implementar a retomada das execuções com `status = waiting` e `next_run_at <= now()`.
- Isso pode ser por uma função/scheduler simples reaproveitando `imphq_flow_executions`, sem inventar outro fluxo paralelo.

6. Melhorar a experiência de teste no OpenFlow
- O modal de teste deve mostrar o resultado por etapa, não só “X execuções”.
- Exibir claramente:
  - automação encontrada,
  - provider resolvido,
  - etapa executada,
  - etapa que falhou,
  - resposta do `whatsapp-api`.

Detalhes técnicos

- Arquivos principais:
  - `supabase/functions/openflow-executor/index.ts`
  - `supabase/functions/webhook-pagamento/index.ts`
  - `src/pages/Leads.tsx`
  - `src/components/leads/LeadWhatsAppDialog.tsx`
  - `src/pages/OpenFlow.tsx`
  - `src/components/openflow/ExecutionsPanel.tsx`
  - `src/components/openflow/AutomacaoLogs.tsx`
- A prioridade é corrigir usando o schema atual e reaproveitando:
  - `imphq_webhooks`
  - `imphq_webhook_errors`
  - `imphq_flow_executions`
  - `imphq_automacao_logs`
- Só faria migração se faltar um vínculo mínimo para rastreabilidade/reenvio.

Validação que vou fazer depois da aprovação

- Teste 1: automação manual com 1 etapa WhatsApp no OpenFlow.
- Teste 2: clique no WhatsApp de um lead enviando mensagem real.
- Teste 3: trigger por webhook de `pix/aguardando_pagamento` criando webhook + execução + log.
- Teste 4: falha proposital sem provider para validar erro visível.
- Teste 5: delay curto e delay longo para confirmar retomada.
- Teste 6: cenário com mais de um provider ativo para garantir escolha correta por projeto.

Resultado esperado

- O teste da automação deixa de “passar sem enviar”.
- O botão de WhatsApp em Leads passa a enviar pelo sistema.
- Cada trigger fica rastreável.
- Quando falhar, fica claro onde falhou e existe caminho de reenvio.
