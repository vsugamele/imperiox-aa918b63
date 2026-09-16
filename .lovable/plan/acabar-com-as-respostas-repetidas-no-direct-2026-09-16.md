# Acabar com as respostas repetidas no direct

## Situação confirmada
A IA está respondendo hoje normalmente (mensagens recebidas e respondidas até agora mesmo). O problema é só de registro: cada resposta enviada aparece **3 vezes** no histórico da conversa.

Confirmei na conversa de hoje das 14:12 e 14:18: os três registros têm exatamente o mesmo texto, gravados dentro do mesmo segundo, por três caminhos diferentes:

1. o registro da própria IA (marcado como "gerado por IA", sem código da mensagem);
2. o registro do envio (com o código do provedor de envio);
3. o eco que o Instagram devolve pelo aviso de mensagem enviada.

Isso polui o histórico e, pior, entra no contexto que a IA lê antes de responder — ela vê a própria fala repetida três vezes.

## O que vou fazer

**1. Um único registro por envio.**
- Deixar o envio como o único responsável por gravar a mensagem, marcando ali mesmo se foi gerada por IA — em vez de gravar duas vezes.
- No eco do Instagram, quando a mensagem for de saída, atualizar o registro que já existe (preenchendo o código oficial da mensagem) em vez de criar um novo.

**2. Limpar o que já está duplicado.**
- Apagar as cópias extras já existentes, mantendo em cada grupo o registro mais completo (com marcação de IA e código da mensagem consolidados).

**3. Verificar.**
- Conferir na tela de conversas que o histórico de hoje aparece sem repetições e que uma nova resposta gera apenas uma linha.

## Detalhes técnicos
- Escritas em `imphq_ig_messages` hoje: `instagram-webhook` (eco, linha ~274), `instagram-api` action `send_text` (linha ~415), bloco de autoresposta da IA em `instagram-webhook` (linha ~694), além de `zernio-webhook` (já protegido por checagem de `mid`).
- Mudanças: remover o insert do bloco de IA e passar `ai_generated` no corpo da chamada `instagram-api/send_text`; no eco de `instagram-webhook`, para `direction = "out"`, procurar registro recente da mesma conversa com o mesmo `content` e `mid` nulo/diferente e fazer `update` do `mid`/`status`, inserindo só se não houver correspondência.
- Limpeza via SQL de dados: agrupar por `conversation_id`, `content`, janela de 10s em `created_at`; manter o `min(id)` consolidado e apagar o resto. Índice auxiliar não é necessário (volume baixo).
- Sem mudança de schema.
