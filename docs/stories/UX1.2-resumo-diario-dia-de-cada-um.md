# Story UX1.2 — "Dia de cada um" no resumo diário do WhatsApp

Pedido (02/10/2026): o Bruno deve operar sem precisar abrir o sistema.

Decisões do Vinicius:
- O resumo vai no grupo Imperio X.
- Antes de agendar, sai um envio de teste.
- Os donos são atribuídos por regra de tipo, com a lista mostrada antes de gravar.

Achado: o grupo já recebe o `daily-briefing-wa` às 9h e às 21h BRT (vendas, recuperação, fila do WhatsApp, anúncios). Por isso **estendi esse envio, sem criar outro**. O grupo continua recebendo uma mensagem só.

## Feito (02/10/2026)
- [x] O quadro de Hoje foi movido para `_shared/today-board.ts`. `src/lib/today-board.ts` só reexporta, então a tela e o resumo usam a mesma regra.
- [x] `_shared/team-day.ts`, função `buildTeamDaySection`:
  - mostra cada pessoa com até 4 etapas, por prioridade: atrasada, vence hoje, revisar, em andamento, confirmar, com prazo, resto;
  - informa quantas etapas estão atrasadas e quantas do time estão sem dono;
  - mostra o que está para revisar, o que a IA pode executar e o link para /hoje.
- [x] `daily-briefing-wa`:
  - a seção entra no fim do briefing;
  - o dia é o de Brasília, porque o envio das 21h já cai no dia seguinte em UTC;
  - se a seção falhar, ela só fica de fora e o briefing sai normal;
  - parâmetro novo `dry_run=true`: monta a mensagem e não envia nada.
- [x] O `deno check` da função continua com os mesmos 13 erros antigos.
- [x] Teste em `src/test/team-day.test.ts`.

## Pendente (aguardando o Vinicius)
- [ ] Aprovar a lista de donos e gravar: Vinicius 6, Bruno 18, 27 de IA ou automação sem dono.
- [ ] Publicar o `daily-briefing-wa` e fazer um envio de teste ao grupo. Depois disso, os horários de sempre (9h e 21h) já levam a seção.

## File List
- supabase/functions/_shared/today-board.ts (movido de src/lib)
- src/lib/today-board.ts
- supabase/functions/_shared/team-day.ts
- supabase/functions/daily-briefing-wa/index.ts
- src/test/team-day.test.ts
