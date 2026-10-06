# KB1.1 — Triagem do acervo do bot com o Jev

**Status:** Done · 06/10/2026

## Contexto
Vinicius: "aprovar isso o tempo todo me deixa maluco, pode aprovar tudo e faz algo pra facilitar". A fila "Dúvidas do Bot" mostrava resumos de livro já aprovados (filtro `aprovada=false OU answered=false`) e escondia 506 respostas humanas do WhatsApp, muitas com dado pessoal (e-mail, link de login com token) ou conversa solta.

## Acceptance Criteria
- [x] Material de livro e feedback já aprovados saem da fila (answered=true): 134 itens.
- [x] `_shared/knowledge-triage.ts`: bloqueio fixo de dado pessoal (CPF, e-mail, telefone, link com token) e pergunta ao Jev (reutilizável? tem dado pessoal?). Aprova ≥0,75 reutilizável e <0,3 pessoal; descarta ≤0,25 ou ≥0,7 pessoal; o meio fica para revisão.
- [x] `jev-classify` modo `knowledge` e dentro do `auto` (cron a cada 6h): respostas humanas e rascunhos novos são triados sozinhos.
- [x] Backfill: 511 itens → 10 aprovados, 408 descartados, 93 em dúvida; as 93 decididas pelo Claude com autorização do Vinicius (14 aprovadas com reutilizável ≥0,6 e pessoal <0,45; 79 descartadas). Custo ~US$ 0,008.
- [x] Fila e badge só mostram item com resposta para aprovar e ainda não decidido; mensagens de lead sem resposta deixam de aparecer como "dúvida".

## Fila sem retrabalho (06/10)
- [x] Os 6 follow-ups "hot lead sem toque" eram de quem já tinha comprado o CCP (5 já com 3–5 mensagens em 3 dias): recusados com o motivo. `imperius-scout` agora pula compradores e leads que receberam mensagem nas últimas 24h.
- [x] `imperius-scout` não pausa anúncio que está em teste de criativos (a Esteira e o corte autorizado decidem).
- [x] Pix travado só vai para a fila quando a régua automática não está cuidando (sem resposta automática ou último envio falhou): `autoRecoveryActive`.

## Pendente
- Sequência de reativação para 2.321 leads: aguarda OK explícito (sugestão: piloto pequeno).
- Modo "a IA resolve e conta depois" (respondi assim, fiz assim, faria diferente?) e liberação de acesso na área de membros pelo bot.

## File List
- supabase/functions/_shared/knowledge-triage.ts
- supabase/functions/jev-classify/index.ts
- supabase/migrations/20261006_imphq_wa_knowledge_triage.sql
- src/test/knowledge-triage.test.ts
- src/hooks/useApprovals.ts
- src/hooks/useSidebarBadges.ts
- supabase/functions/project-mcp/index.ts
- supabase/functions/imperius-scout/index.ts
- supabase/functions/_shared/approval-rows.ts
- src/test/approval-rows-pix.test.ts
