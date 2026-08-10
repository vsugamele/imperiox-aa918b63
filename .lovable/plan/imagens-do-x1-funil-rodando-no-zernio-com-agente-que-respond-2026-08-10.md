# Imagens do X1 + funil rodando no Zernio com agente que responde e volta pra sequência

Duas entregas: (1) gerar as 7 imagens pendentes do funil, (2) fechar o buraco que hoje impede o X1 de funcionar de verdade no Messenger/Zernio quando o lead responde ou pergunta.

## 1. Gerar as 7 imagens

Gerar em qualidade premium (texto legível), salvar no bucket público `whatsapp-media` em `x1/img/`, e substituir os placeholders nos templates X1 (`src/components/openflow/flow-editor/templates.ts`) pelas URLs reais — mesmo caminho já usado nos 4 áudios.

Imagens: 3 review cards (prova social), ingredientes/mecanismo, comparativo de custo, ritual (30s), selo de garantia 30 dias. Sem claims médicos; "results vary" onde aplicável.

Também entrego os arquivos como download e atualizo a tabela de status do documento bilíngue.

## 2. O funil no Zernio: o que já funciona e o que falta

Verificado no código:

- `messenger-webhook` já cria/atualiza a sessão de canal, salva a mensagem e dispara o `openflow-executor`.
- `openflow-executor` já filtra fluxos pelo canal (`whatsapp` | `messenger` | `webchat`), entrega mensagens, mídia e link de checkout pela sessão de canal, e suporta `delay_sec` (ritmo de digitação).
- `channel-out.ts` descobre a tool de envio no MCP do Zernio dinamicamente.

O que **não** funciona hoje: toda a inteligência de "lead respondeu / lead perguntou" está só no WhatsApp (`wa-ai-reply`). É lá que mora:
- retomar a execução parada em `wait_reply` / `input_capture` (`resume_from_step`);
- o agente de IA que responde dúvidas fora do script;
- reconhecer intenção de compra e mandar o link de checkout.

No Messenger/Webchat, a resposta do lead só re-dispara os triggers de entrada. Resultado: a execução fica parada, o lead que pergunta não recebe resposta, e o funil não fecha.

## 3. Correção: agente de canal com retomada

Criar `supabase/functions/channel-ai-reply` (espelho enxuto do `wa-ai-reply`, sem a parte específica de Evolution API), chamado pelo `messenger-webhook` e pelo `webchat-api` a cada mensagem recebida:

1. Localiza execução ativa daquele `channel_session_id`.
2. Se o step atual é `wait_reply` / `input_capture` → chama `openflow-executor` com `resume_from_step` e segue o script.
3. Se o lead perguntou algo fora do script → responde com IA usando o contexto X1 (mecanismo, objeções, guardrails de palavras proibidas, trial close), envia pela `sendToChannel` e **retoma a sequência no ponto onde parou**.
4. Se detecta intenção de compra ("how do I order", "price", "link") → envia o link de checkout do fluxo (`link_checkout`) e continua a régua de fechamento.
5. Dedupe/debounce para agregar mensagens rápidas do lead e não responder 3 vezes.

Também: preencher `link_checkout` nos templates X1 e mostrar no card do fluxo um aviso quando o canal for Messenger e o Zernio não estiver conectado/sem tool de envio.

## Detalhes técnicos

- Arquivos: nova função `channel-ai-reply/index.ts`; edições em `messenger-webhook/index.ts`, `webchat-api/index.ts`, `flow-editor/templates.ts`; reuso de `_shared/channel-out.ts` e `_shared/ai-call.ts`.
- Nenhuma migração de banco necessária: `imphq_channel_sessions` / `imphq_channel_messages` e as execuções já têm os campos usados.
- Imagens via geração premium + upload por função com `service_role` (RLS bloqueia upload direto).
