# Arquitetura CSX1.1

Decisão aprovada pelo usuário: script + IA em interrupções. Inspeção confirma OpenFlow e motores anteriores; não copiar conteúdo do MemoFlow nem modificar handlers compartilhados nesta entrega. Validação técnica independente identificou: channel-out não entrega Instagram; channel-ai-reply avança em perguntas e falhas de envio; retomada não tem proteção suficiente contra concorrência.

## Desenho
CLI/servidor local → motor puro Cinna → configuração versionada das nove etapas.
Motor → classificador IA opcional (apenas intenção e chave de resposta aprovada) → validação de saída → resposta aprovada ou fallback → mesmo cursor.
Simulador é uma interface do servidor local. Não há credenciais no navegador nem conexão com a Meta. Operações de produção continuam desativadas.

Configuração externa YAML compatível com JSON: textos, oferta, respostas aprovadas, relação aos grupos fonte e mídias em revisão. Não executar Code, Set variable ou HTML do arquivo original. A pergunta pendente não é preenchida por dúvidas. Não persistir texto clínico em CRM. Uma mensagem gera uma decisão; transporte deve confirmar envio antes de aplicar nextState.

## Estado
product, stageIndex, status (active/stopped/human/complete), checkoutSent, processedEventIds. Sem histórico clínico ou respostas pessoais no estado durável. Configuração e estado validados na entrada. Eventos duplicados não produzem mensagens. UI só guarda conversa em memória.

## Produção posterior
Adaptador autenticado resolve produto por conta/projeto no servidor, verifica janela/permissões, deduplica mensagem, adquire lock por sessão, calcula decisão, grava outbox, envia pelo canal correto e confirma estado. Não aceitar project_id ou oferta fornecidos pelo visitante. Ordem e idempotência precisam ser transacionais no host persistente. Contrato aqui não afirma exactly-once de rede.

## Interface de revisão
Mesa de atendimento com roteiro à esquerda, conversa no centro e resultado da última decisão abaixo. Azul profundo #183451, azul claro #eaf2fb, branco #ffffff, cinza #edf0f3, texto #18232d. Segoe UI para operação; Georgia apenas no nome do produto. Conteúdo alinhado à esquerda. A sequência numerada representa etapas reais. Em mobile, etapas tornam-se faixa compacta acima da conversa. Sem métricas inventadas.

## Validação
Motor: duplicação, parada, humano, compra, negativa de compra, perguntas no meio da captura, FAQ, fallback IA, injeção, conclusão, configuração inválida e isolamento de produto.
CLI: decisão real via JSON stdin. HTTP: sessão, limites e conflito de versão. Browser: fluxo responsivo e sem erro de console. Gates existentes executados; falhas anteriores separadas do escopo novo.
