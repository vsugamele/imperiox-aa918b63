# Story UX1.4 — Vida com significado (animações com dado real)

Pedido (02/10/2026): o sistema deve ter mais vida, mas o movimento tem que significar algo.

## Feito (02/10/2026)

### Fluxo vivo nas setas
- [x] `_shared/flow-volume.ts` define a métrica de cada etapa:

| Etapa | Métrica |
|---|---|
| Página com URL | sessões distintas na URL, em `imphq_funnel_events`, sem heartbeat |
| Checkout ou compra | vendas aprovadas |
| WhatsApp ou DM | conversas novas |
| Captura ou lead | leads |

- [x] A seta usa o volume do destino; se o destino não mede nada, usa o da origem.
- [x] O movimento é proporcional ao volume. Sem volume, a seta fica parada.
- [x] `FlowEdge`: partículas que andam pelo caminho da seta. O tooltip mostra "N sessões nos últimos 7 dias", e quem pediu menos movimento no sistema não vê partículas.
- [x] O canvas usa o tipo de seta `flow` e só reescreve as setas cujo volume mudou.
- [x] Dados reais nesta data:
  - SlimSoda: só os advertoriais têm fluxo (2 sessões). PDP, quiz e checkout estão parados, sem venda em 7 dias.
  - JP: captura com 7 leads e X1 com 4 conversas.

### Etapa atrasada
- [x] No mapa, a etapa atrasada ganha uma borda vermelha pulsando.

### Venda nova
- [x] `SaleWatcher`, no cabeçalho: consulta as vendas aprovadas a cada minuto e mostra um aviso com projeto, produto e valor.
  - Nunca repete um aviso.
  - Abrir o sistema não dispara avisos antigos.
  - Atualiza Hoje e o mapa.
- [x] Usa consulta periódica, não realtime, de propósito: `imphq_vendas` está sem RLS, e liberar realtime abriria mais um canal de leitura pela chave pública.

### Números e carregamento
- [x] Os números de `Stat` contam até o valor novo e dão um pulo quando sobem (`AnimatedNumber`).
- [x] Skeletons no formato do conteúdo em Hoje, Aprovar e Estratégias.

### Testes
- [x] `src/test/flow-volume.test.ts`.

## Achado de segurança (registrado, sem alteração)
- `imphq_vendas` e `imphq_leads` estão com a RLS desligada e com todos os privilégios para `anon`. Quem tiver a chave pública lê, altera e apaga vendas e leads.
- Quem usa essas tabelas hoje:
  - o app, com usuário logado;
  - as edge functions, com service role ou repassando o login do usuário;
  - os scripts públicos (`funnel.js`, `webchat.js`), que passam por edge functions.
- Correção proposta: ver a resposta ao Vinicius de 02/10.

## File List
- supabase/functions/_shared/flow-volume.ts
- src/components/funis/FlowEdge.tsx
- src/hooks/useMapFlowVolume.ts
- src/components/funis/CompanyMapCanvas.tsx
- src/components/funis/MapNodeCard.tsx
- src/lib/sale-watch.ts
- src/components/SaleWatcher.tsx
- src/components/AnimatedNumber.tsx
- src/components/mapa/Stat.tsx
- src/components/AppLayout.tsx
- src/components/PageSkeleton.tsx
- src/pages/Hoje.tsx
- src/pages/Aprovar.tsx
- src/pages/Estrategias.tsx
- src/test/flow-volume.test.ts
