# Story JP1.4 — Relacionamento natural e pitch pelo contexto

Status: Concluída e publicada em 01/10/2026. Autorização: usuário pediu coerência com o assunto, relacionamento natural e pitch quando houver espaço e necessidade.
Responsáveis: @dev implementação, @qa validação, @devops publicação.

## Critérios

- [x] Conferir versões publicadas e dependências contra o código local.
- [x] Responder à necessidade atual, com conversa natural e sem puxar oferta automaticamente.
- [x] Remover redirecionamento obrigatório de assunto pessoal para venda somente no JP.
- [x] Pitch exige necessidade identificada, produto adequado e abertura; dúvida comercial direta não exige roteiro de qualificação repetido.
- [x] Suporte, cobrança e agendamento não viram venda de curso; silêncio não prova objeção de preço.
- [x] Validar lint, typecheck, testes existentes e Deno check.
- [x] Commit com story ID, publicação e conferência do código publicado; handoff.

## File List

- docs/stories/JP1.4-relacionamento-pitch-contextual.md
- supabase/functions/_shared/conversation-policy.ts
- supabase/functions/wa-ai-reply/index.ts
- supabase/functions/instagram-webhook/index.ts
- supabase/functions/wa-pitch-followup/index.ts
- docs/sessions/2026-10/2026-10-01-jp-relacionamento-pitch.md

Escopo: orientação nos fluxos existentes. Sem novo classificador, mudança de banco, geração de áudio ou envio de teste a leads. Mudanças de voz e histórico da JP1.2/JP1.3 preservadas.

Validação: 528 testes passaram em 78 arquivos; lint sem erros (dois avisos anteriores de UI), typecheck e Deno check das quatro funções aprovados. Diff revisado: mudanças de comportamento limitadas ao JP; não foram adicionados testes que apenas repetem texto de prompt.

Implementação: 0ee0554e. Publicação confirmada por comparação de cada arquivo e dependência com o local: instagram-webhook v317, instagram-followup-scheduler v280, wa-ai-reply v318, wa-pitch-followup v149, todas ACTIVE. Handoff: docs/sessions/2026-10/2026-10-01-jp-relacionamento-pitch.md.
