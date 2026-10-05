# Story TST1.1 — Ordem de teste de criativos (Fase 1 do sistema de testes)

Pedido (05/10/2026): um sistema que, quando precisar, cria o criativo, usa um tipo de oferta (VSL, PDP, página de venda, captura), testa, roda a estratégia, mede e executa.

O Vinicius escolheu começar pela Fase 1: a ordem de teste e o lançamento padronizado. A base é o ciclo feito à mão no mesmo dia: 10 ângulos do Código dos Cortes Perfeitos minerados pelo Grok e subidos via MCP da Meta.

## Feito (05/10/2026)

### Banco
- [x] Tabelas `imphq_test_orders` e `imphq_test_variants`, migração `20261005_imphq_test_orders.sql`, aplicada.
  - A ordem guarda: projeto, oferta, tipo de página, página, conta, página do Facebook, pixel, verba por conjunto, payout, CPA alvo, UTM da campanha, status (rascunho → pronto → no ar → encerrado), ids da Meta, data de ativação, corte autorizado (por quem e até quando), rodada da Esteira e última avaliação.
  - Cada variante guarda: ângulo, hipótese, referência ou arte, texto, UTM e link, ids da Meta, última leitura e veredito.
  - RLS para usuários logados.
- [x] Diário: status do teste e variante pausada, morta ou vencedora entram no diário do projeto, pelo mesmo padrão de gatilho da IA1.1.

### Regra (`_shared/test-order.ts`)
- [x] `planTestOrder`: valida a página https, de 2 a 20 variantes, arte e texto; monta UTM por variante, link com `utm_term={{ad.id}}`, nomes, verba total e a referência da Esteira; separa problemas de avisos.
- [x] `launchSteps`: passos de lançamento para o operador, tudo pausado e ativação só com OK.
- [x] `evaluateTestOrder`:
  - aplica o veredito da Esteira P1 por variante;
  - considera como vendas o maior valor entre pixel e Império (UTM);
  - **só decide pausar a partir do fim do dia 2**;
  - devolve vencedores e o placar de hipóteses.
- [x] `cutAllowed`: o corte automático só vale com autorização e dentro do prazo.

### MCP (`project-mcp`)
- [x] `create_test_order`: plano, ou grava com `confirmar=true`. Aceita variantes vindas de `referencias_lote`.
- [x] `get_test_order` e `list_test_orders`.
- [x] `record_test_launch`: grava os ids da Meta. Ligar exige `confirmado_por`; dá para registrar a autorização de corte.
- [x] `evaluate_test_order`: soma as vendas do Império por UTM, avalia, grava leitura, veredito e rodada P1, e aplica o corte quando autorizado.
- [x] Autonomia, três ações novas:

| Ação | Nível |
|---|---|
| `teste:criar` | IA faz sozinha |
| `teste:ativar` | precisa de OK |
| `teste:pausar_variante` | precisa de OK; vale o corte autorizado no teste |

### Dado real
- [x] O teste do CCP ativado em 05/10 foi registrado como primeira ordem (`40a7d97d…`): 10 variantes ligadas às referências do Grok e aos ids da Meta, no ar, com corte autorizado pelo Vinicius até 14/10.
- [x] O índice único de UTM barrou uma inserção repetida.

### Documentação e testes
- [x] Roteiro de operação em `docs/runbooks/teste-de-criativos.md`.
- [x] Testes:
  - `test-order.test.ts` (7);
  - `mcp-approvals-briefing.test.ts`: planejar e gravar, avaliar e cortar, ligar só com OK.

## Pendente / próximas fases
- [ ] A rotina agendada do CCP (`jp-ccp-teste-angulos-corte`) ainda usa a regra própria, que é mais tolerante que a Esteira, e não grava as leituras no Império. As próximas rotinas devem seguir o `evaluate_test_order`, quando a rotina tiver acesso ao MCP do Império.
- [ ] Tela de testes (lista, placar por ângulo, decisão) dentro do projeto.
- [ ] Fase 2: fábrica de criativos. Do ângulo para o lote de artes (`creative-factory` / Studio) direto numa ordem de teste. Corrigir a entrada pelo WhatsApp, que hoje grava em base64 e sem projeto.
- [ ] Fase 3: fábrica de páginas (VSL, PDP, venda, captura). Gerar, publicar e auditar pixel, UTM e checkout antes de liberar o teste.
- [ ] Fase 4: aprendizado. O vencedor gera variações (Esteira P2) e o placar orienta a próxima rodada.

## File List
- supabase/migrations/20261005_imphq_test_orders.sql
- supabase/functions/_shared/test-order.ts
- supabase/functions/_shared/autonomy.ts
- supabase/functions/project-mcp/index.ts
- src/test/test-order.test.ts
- src/test/mcp-approvals-briefing.test.ts
- docs/runbooks/teste-de-criativos.md
