# Story IA1.1 — IA operando: autonomia por nível, diário do projeto e fila completa no MCP

Pedido (05/10/2026): a IA operando de verdade. Escopo:
- resumo do projeto em uma chamada;
- ver e decidir a fila de aprovação;
- diário do projeto;
- níveis de autonomia.

A MCP2.1 (02/10) já tinha `get_approvals`, `decide_approval` e `get_briefing`. Esta story completa o que ela deixou de fora: aprovar ação da IA "quando houver autonomia por nível", os tipos novos da fila e o diário.

Decisões do Vinicius (05/10) sobre as fontes de dados:
- o gasto de anúncio vem do Zernio ou do MCP de anúncios, sem token direto da Meta;
- H&W sem venda, com o postback correto;
- SlimSoda ainda sem conta de anúncio.

## Feito (05/10/2026)

### Autonomia
- [x] `_shared/autonomy.ts`: 17 ações, cada uma com padrão, teto e motivo. Os três níveis:

| Nível | O que significa |
|---|---|
| auto | A IA faz sozinha |
| aprovar | A IA só faz com `confirmado_por`, o nome de alguém do time, que vai para o diário |
| nunca | A IA não faz |

- [x] O banco (`imphq_ai_policy.autonomy`, scope `mcp`) ajusta o nível, sem passar do teto.
- [x] Ação desconhecida é tratada como "nunca".
- [x] Nunca, por regra:
  - registrar recuperação de pix como enviada, porque o envio é um clique humano no WhatsApp;
  - responder cliente, o que acontece em /rascunhos.

### Fila Aprovar compartilhada
- [x] Regra compartilhada da fila:
  - `_shared/approval-rows.ts` monta a fila (pix, semáforo, dúvidas do bot);
  - `_shared/approval-decide.ts` decide;
  - a tela `/aprovar` passou a usar os dois, sem mudar o comportamento, e os `any` do hook saíram.

### MCP
- [x] Fila com as mesmas origens da tela, mais as etapas para revisar. Cada item traz `precisa_ok_de_alguem`.
- [x] `decide_approval` com níveis de autonomia: decide `approve`, `reject` e `mark_paid`, aceita `confirmado_por` e `resposta`, e confere se o item ainda está esperando.
- [x] Ação da IA aprovada com OK é executada pelo `imperius-executor`.
- [x] Ferramentas novas:
  - `get_autonomy`;
  - `get_journal`.
- [x] `get_briefing` ganhou:
  - alertas (prazo vencido, decisão parada há mais de 24 h, aviso de pagamento sumido, sync de anúncios);
  - fontes de dados (avisos de pagamento por plataforma, saúde do sync de anúncios);
  - as últimas 10 entradas do diário.
- [x] `imperius-executor` aceita a chamada interna com a chave de serviço. Sem token e com token falso continua respondendo 401, e o MCP sem chave também.

### Diário
- [x] `imphq_activity_log` ganhou `project_id`, `actor` e `source`; `user_id` virou opcional. Migração `20261005_imphq_project_journal_autonomy.sql`, aplicada.
- [x] Seis gatilhos alimentam o diário:
  - etapa: status, responsável e prazo;
  - ação da IA;
  - venda aprovada e recuperação descartada;
  - estratégia aplicada;
  - conteúdo;
  - resposta do bot.
- [x] Autor de cada registro: o cabeçalho `x-imperio-actor` (o MCP manda "ia (OK de X) via mcp"); senão o e-mail do login; senão "sistema".
- [x] Os gatilhos engolem os próprios erros e nunca travam a operação. Testado em produção: mudança de prazo registrada com "de/para" e projeto; o teste foi revertido.
- [x] Tela Hoje: bloco "Últimas mudanças" em cada projeto, com quem fez cada coisa (`_shared/journal.ts`).

### Texto do sync de anúncios
- [x] Com o token da Meta expirado, o sistema agora orienta "o gasto vem do Zernio ou do MCP de anúncios". Antes pedia para gerar token novo.

### Qualidade
- [x] Testes: `autonomy.test.ts`, `mcp-approvals-briefing.test.ts` (atualizado para o modelo novo) e `hoje.test.tsx`.
- [x] 743 testes passando, build ok.
- [x] `deno check` do `project-mcp` na linha de base: 9 erros antigos.

## Observações
- Outra sessão tirou as "Etapas para revisar" da tela `/aprovar` (`steps: []`). No MCP elas continuam aparecendo.
- O sync de anúncios via Zernio gravou gasto R$ 0 hoje e dá erro de formato (`invalid_union`). Ainda não foi investigado.

## File List
- supabase/migrations/20261005_imphq_project_journal_autonomy.sql
- supabase/functions/_shared/autonomy.ts
- supabase/functions/_shared/approval-rows.ts
- supabase/functions/_shared/approval-decide.ts
- supabase/functions/_shared/journal.ts
- supabase/functions/_shared/project-briefing.ts
- supabase/functions/_shared/live-panel.ts
- supabase/functions/project-mcp/index.ts
- supabase/functions/imperius-executor/index.ts
- src/hooks/useApprovals.ts
- src/hooks/useProjectJournal.ts
- src/pages/Hoje.tsx
- src/integrations/supabase/types.ts
- src/test/autonomy.test.ts
- src/test/mcp-approvals-briefing.test.ts
- src/test/hoje.test.tsx
- src/test/live-panel.test.tsx
