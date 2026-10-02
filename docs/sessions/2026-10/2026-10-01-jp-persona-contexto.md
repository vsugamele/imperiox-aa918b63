# JP — apresentação e contexto incorreto no Direct

Data: 01/10/2026. Story JP1.3. Responsáveis: @dev implementação, @qa validação, @devops publicação. Autorização: usuário pediu o jeito de falar do JP e questionou a referência ao Rio no print.

## Evidência e causa

A mensagem do print foi localizada em `imphq_ig_messages` com `ai_generated=true`, em 01/10 às 17:53 de São Paulo. Identificador da saída: `ae3a1bba-bcb6-4aae-8d3f-4879a7f3db09`. Conversa: `123d3fc2-1a96-4d56-a0f4-32ad06619915`. Não são reproduzidos nome, usuário do Instagram, email ou telefone do contato.

A pergunta atual era “Qual livro?”. A origem verificável de Rio era “Opa que dia no Rio?”, mensagem do mesmo contato em 02/07 às 23:28 de São Paulo (`03/07 02:28Z`). Também havia uma cobrança sobre imersão no salão, de 15/07. O histórico reunia as últimas mensagens por quantidade, sem separar meses diferentes; mensagens consecutivas de entrada eram concatenadas no pedido ao modelo. A resposta retomou assuntos antigos e ignorou a pergunta atual.

A apresentação como assistente tinha duas fontes: a regra mandatória publicada na correção anterior e a saudação genérica cadastrada, “Aqui é o assistente do JP Freitas”. O código agora neutraliza essa saudação no contexto do JP sem modificar o cadastro bruto.

O evento atual estava identificado como resposta a story. O pedido ao modelo continha apenas texto, sem imagem/título do story. Portanto, o modelo não tinha identificação visual confirmada do livro; não deve adivinhar título ou responder sobre imersão.

## Correção publicada

- Tom do JP cadastrado, com fala curta, próxima e direta. Sem apresentação espontânea como assistente/equipe/IA, cargo ou assinatura; cumprimentos sociais também não incluem apresentação. Pergunta direta sobre identidade recebe resposta verdadeira.
- Histórico JP no Direct e follow-up limitado às 24 horas anteriores à mensagem mais recente daquele histórico. Registros antigos continuam armazenados. O intervalo é ancorado na conversa, permitindo que o follow-up retome a sessão correta mesmo quando roda no dia seguinte.
- Mensagem atual prevalece sobre referências históricas, RAG, catálogo e sugestão de triagem. Triagem só é incorporada quando sua mensagem original coincide com a atual; a consulta usa campos existentes no schema real.
- “Qual livro?” em resposta a story sem contexto visual recebe “Me manda um print do story ou da capa pra eu confirmar qual livro é.” Isso impede que a resposta do caso relatado seja reutilizada. Pedidos de recomendação de livro não são confundidos com essa pergunta sobre título.
- Instrução separa venda de nova turma de Master Cuts de cobrança de uma imersão já combinada. Indisponibilidade no catálogo não prova inexistência de compromisso anterior.
- Regras compartilhadas publicadas também nos dois consumidores WhatsApp, preservando os ajustes de voz da JP1.2. O corte temporal de histórico foi aplicado somente ao Instagram JP.

## Validação e publicação

Antes das mudanças, todas as dependências locais das quatro funções foram comparadas às versões publicadas e correspondiam a elas. Isso confirmou que o deploy não substituiria um ajuste de produção ausente no checkout.

O cenário monetário e os testes anteriores continuam passando. O novo teste reproduz a pergunta real e os trechos antigos sem dados pessoais: só “Qual livro?” permanece no contexto recente, e a saída que citava Rio/Master Cuts passa a pedir contexto do livro. Também foram validados contexto de curso do mesmo dia, preservação de outros projetos, perguntas diretas sobre identidade e ausência de título inventado.

- 528 testes passaram em 78 arquivos, incluindo 26 testes da política de conversa.
- Lint: zero erros, dois avisos anteriores em componentes de UI.
- Typecheck da aplicação e Deno check das quatro funções: aprovados.
- Commit de implementação: `d96ec129`, na branch de trabalho existente `feat/operacao-diaria`. Sem push Git.

| Função | Antes | Publicada e conferida |
|---|---:|---:|
| instagram-webhook | 315 | 316 |
| instagram-followup-scheduler | 278 | 279 |
| wa-ai-reply | 316 | 317 |
| wa-pitch-followup | 147 | 148 |

Todas ACTIVE. Conteúdo normalizado de cada arquivo e dependência publicado igual ao local por tamanho e hash. Configuração anterior de autenticação dos endpoints preservada. Publicação via CLI Supabase 2.117.0 já instalada; o problema de cache do npm não exigiu alteração de dependências do projeto.

## Estado e limites

Não houve envio de mensagem ao contato, replay de webhooks reais, geração de áudio de teste, remoção de histórico ou alteração de acesso. A resposta antiga permanece no banco como evidência. Nenhuma migração de banco foi necessária.

Identificação automática do título a partir da imagem do story não foi implementada nesta correção. O fluxo atual pede contexto quando não dispõe dessa informação; os testes e a comparação de publicação comprovam esse comportamento, sem afirmar que uma nova resposta já foi recebida pelo contato.

Arquivos locais anteriores preservados: `supabase/.temp/cli-latest`, `.claude/launch.json`, `AGENTS.md` e `deno.lock`. Próximo atendimento legítimo permite confirmar a resposta gerada em uso; não há bloqueador de publicação.
