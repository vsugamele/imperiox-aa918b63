# Correções gerais + mapeamento de gastos de IA

## 1. A venda de hoje não entrou (causa confirmada)

A compra aprovada de hoje (Vanessa, JP Hair Education, R$ 797, cartão 10x, 13/09 10:05) **chegou** da Ticto, mas foi rejeitada na porta de entrada e ficou guardada na fila de erros — por isso não virou venda nem atualizou o lead (ele consta só como "carrinho abandonado").

Motivo: a Ticto envia o número do pedido como número (`4639268`) e a validação do recebimento exige texto. Qualquer compra com esse formato é recusada inteira.

Impacto real medido: **35 eventos perdidos** na fila de erros desde julho, nenhum reprocessado — inclui vendas aprovadas, order bumps e upsells. Ou seja, faturamento e leads-clientes estão subnotificados.

O que será feito:
- Aceitar número ou texto nesses campos de pedido/oferta (converter para texto internamente), para nenhuma compra ser recusada por formato.
- Reprocessar automaticamente os 35 eventos guardados, criando as vendas/leads que faltaram e recalculando o total gasto de cada cliente.
- Botão "Reprocessar tudo" na tela de erros de webhook, com aviso visível quando existir evento parado.
- Alerta por e-mail/WhatsApp quando um evento de pagamento cair em erro, para nunca mais passar dias sem alguém ver.

## 2. Conexão do WhatsApp registrando erro

Toda atualização de conexão do chip (`suportejpoficial`) falha ao salvar porque grava um campo de status que não existe na tabela de provedores. Efeito: o painel não mostra o estado real (conectado / lendo QR / recusado) e o monitor de saúde fica cego.

Correção: criar o campo de status e horário da última mudança, e passar a exibir esse estado no painel de WhatsApp.

## 3. Datas de lead no futuro

Dois leads da Ticto estão com data de criação em 06/12/2026 (futuro), o que distorce relatórios e o funil de 30 dias. Vamos normalizar a leitura de datas no recebimento (formato brasileiro dd/mm) e corrigir os dois registros existentes.

## 4. Mapear gastos do OpenRouter por projeto

Hoje o sistema usa uma única chave OpenRouter compartilhada por dezenas de funções (chat, copy, Instagram, Cinna, SDR, embeddings), sem registro de consumo — por isso a fatura vira um bolo único e não dá para saber o que é de cada projeto.

Plano:
- Passar a identificar cada chamada com projeto/função de origem (cabeçalhos de identificação do OpenRouter), o que já separa o gasto no painel deles.
- Registrar cada chamada numa tabela própria de consumo: projeto, função, modelo, tokens de entrada/saída, custo e data.
- Sincronizar diariamente com a API do OpenRouter para trazer o custo oficial e o saldo restante da chave.
- Nova tela "Custos de IA": gasto por projeto, por função e por modelo, com comparativo mês atual x anterior e alerta de estouro.

Observação: só conseguimos separar por projeto o consumo **a partir da implantação**. O histórico anterior fica disponível apenas como total por dia/modelo (o que a API do OpenRouter devolve), sem rateio por projeto.

## Ordem de execução

1. Correção do recebimento de pagamentos + reprocessamento dos 35 eventos (urgente, é dinheiro).
2. Alertas de webhook em erro.
3. Status do WhatsApp e datas de lead.
4. Rastreio e painel de custos de IA.

## Detalhes técnicos

- `supabase/functions/webhook-pagamento/index.ts`: no schema Zod, campos `order.id`, `order.code`, `bumps[].id/hash` e equivalentes passam a `z.union([z.string(), z.number()]).transform(String).nullish()` (helper `looseId`); mantido `passthrough()`.
- Reprocesso: reutilizar o caminho existente de `imphq_webhook_errors` (`reprocessado`/`reprocessado_at`) via função de reprocesso em lote; idempotência por `external_transaction_id` para não duplicar vendas.
- Migração: `imphq_wa_providers` recebe `status text` e `status_updated_at timestamptz`; `whatsapp-api` volta a gravar sem quebrar.
- Nova tabela `imphq_ai_usage` (project_id, function_name, provider, model, prompt_tokens, completion_tokens, cost_usd, created_at) + GRANTs e RLS; escrita centralizada em `_shared/ai-call.ts` lendo `usage` da resposta.
- Headers `HTTP-Referer` e `X-Title` (`imperiohq/<project>/<function>`) em todas as chamadas OpenRouter.
- Cron diário `ai-cost-sync` consultando `/api/v1/credits` e activity do OpenRouter (requer `OPENROUTER_API_KEY` já existente; se a leitura de activity exigir chave de provisionamento, será solicitada).
