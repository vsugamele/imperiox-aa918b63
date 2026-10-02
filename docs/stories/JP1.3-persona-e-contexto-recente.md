# Story JP1.3 — Tom do JP e contexto recente no Direct

Status: Concluída e publicada em 01/10/2026. Autorização: correção do usuário sobre apresentação como assistente e referência indevida ao Rio.
Responsáveis: @dev correção, @qa validação, @devops publicação.

## Causas verificadas

A saída do print foi encontrada com `ai_generated=true`. A mensagem atual era “Qual livro?”, em 01/10 às 17:53 de São Paulo. O histórico continha “Opa que dia no Rio?” em 02/07 às 23:28 e uma cobrança de imersão de 15/07. O prompt reunia mensagens de meses diferentes sem delimitar a sessão. A apresentação como assistente era reforçada pelo código publicado e pela saudação genérica cadastrada.

## Critérios e progresso

- [x] Confirmar autoria e origem de Rio sem expor dados pessoais.
- [x] Conferir código local contra as versões atualmente publicadas antes de editar.
- [x] Usar tom do JP sem apresentação automática como assistente, mantendo resposta verdadeira em pergunta direta sobre identidade.
- [x] Contexto do Instagram limitado à sessão recente; perguntas atuais prevalecem sobre assuntos antigos.
- [x] Resposta a story sem título/imagem compreendida pede contexto em vez de inventar livro, evento ou cidade.
- [x] Não tratar toda cobrança de imersão já combinada como nova oferta de Master Cuts.
- [x] Regressão do caso real, lint, typecheck, testes e Deno check.
- [x] Commit com story ID, deploy sem sobrescrever mudanças de voz, conferência do código publicado e handoff.

## File List

- docs/stories/JP1.3-persona-e-contexto-recente.md
- supabase/functions/_shared/conversation-policy.ts
- supabase/functions/instagram-webhook/index.ts
- supabase/functions/instagram-followup-scheduler/index.ts
- src/test/conversation-policy.test.ts
- docs/sessions/2026-10/2026-10-01-jp-persona-contexto.md

Sem envio de teste ao contato e sem apagar histórico. Mudanças recentes da story de voz JP1.2 serão preservadas.

Validação: 528 testes passaram em 78 arquivos; lint sem erros e com dois avisos anteriores de UI; typecheck e Deno check das quatro funções afetadas passaram. O teste reproduz as mensagens reais sem dados pessoais. Triagem só enriquece a pergunta atual; consulta ajustada aos campos que existem no schema verificado.

Commit de implementação: d96ec129. Publicação confirmada: instagram-webhook v316, instagram-followup-scheduler v279, wa-ai-reply v317, wa-pitch-followup v148; todas ACTIVE, arquivos e dependências iguais aos locais. Handoff: docs/sessions/2026-10/2026-10-01-jp-persona-contexto.md. Histórico preservado; nenhuma resposta foi enviada ao contato como teste.
