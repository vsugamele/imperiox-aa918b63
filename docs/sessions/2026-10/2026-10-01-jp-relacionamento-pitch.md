# JP — relacionamento e pitch conforme a necessidade

01/10/2026. Story JP1.4. @dev implementação, @qa validação, @devops publicação. Autorização: usuário pediu conversa coerente, relacionamento natural e pitch quando houver espaço e fizer sentido para a necessidade da pessoa.

## Orientação publicada

Responder ao assunto atual e ajudar a pessoa primeiro. Pitch exige necessidade identificada, produto disponível adequado e abertura na conversa. Reação a story, palavra isolada, silêncio ou score de triagem não bastam para uma oferta. Uma dúvida comercial direta recebe informação confirmada sem reiniciar um roteiro de qualificação. Nem toda mensagem precisa terminar em pergunta, CTA ou oferta.

Suporte, reclamação, cobrança e compromisso anterior têm prioridade sobre venda. Pedido de agendamento de cabelo não recebe pitch de curso. Quando houver oportunidade comercial, o convite deve conectar a necessidade ao benefício específico e confirmado, com brevidade e sem pressão.

## Contradições removidas no JP

- WhatsApp mandava acolher assunto pessoal em uma frase e redirecionar imediatamente para produto. A classificação `off_topic` agora orienta acompanhar o assunto naturalmente; a regra geral de redirecionamento foi substituída somente no JP.
- Instrução específica de Master Cuts também abrangia qualquer “imersão presencial” e sugeria cursos online automaticamente. Agora só dispara para menção explícita ao produto; compromisso anterior exige verificação e alternativa online depende de interesse e encaixe.
- Instagram orientava defender o produto como único veículo viável e invalidar alternativas. No JP, passou a orientar benefício concreto e confirmado, conforme necessidade e abertura.
- Segundo toque de follow-up presumia investimento/objeção; terceiro presumiu preço ou falta de tempo e sugeria entrada. No JP, silêncio não prova esses motivos. Alternativa mais barata só é apresentada com necessidade expressa e encaixe; encerramento pode ocorrer sem CTA.

As regras compartilhadas também chegam aos comentários e ao follow-up de Instagram. O agendamento, os limites de tentativa, a recuperação de acesso, o corte temporal de histórico e os controles de voz existentes foram preservados.

## Verificação

Código e dependências locais correspondiam às quatro funções publicadas antes da mudança. Diff revisado: os demais projetos mantêm as instruções anteriores. 528 testes existentes passaram em 78 arquivos; lint sem erros e com dois avisos anteriores de UI; typecheck e Deno check das quatro funções passaram. Não foram criados testes que apenas repetem frases dos prompts.

Commit de implementação: `0ee0554e`, na branch existente `feat/operacao-diaria`. Deploy via CLI autenticada; sem push Git.

| Função | Antes | Publicada e conferida |
|---|---:|---:|
| instagram-webhook | 316 | 317 |
| instagram-followup-scheduler | 279 | 280 |
| wa-ai-reply | 317 | 318 |
| wa-pitch-followup | 148 | 149 |

Todas ACTIVE, cada arquivo e dependência iguais ao local por tamanho e hash de conteúdo normalizado. Autenticação dos endpoints preservada.

## Estado e limites

Nenhuma mensagem de teste a lead, chamada de geração de áudio, migração ou remoção de histórico. Arquivos locais anteriores (`supabase/.temp/cli-latest`, `.claude/launch.json`, `AGENTS.md`, `deno.lock`) ficaram fora dos commits.

Esta etapa ajustou as instruções dos fluxos existentes. Não introduziu um novo classificador nem comprova, por si, qualidade ou conversão de toda resposta futura; uma conversa real posterior permite avaliar o resultado gerado. Não há bloqueador de publicação.
