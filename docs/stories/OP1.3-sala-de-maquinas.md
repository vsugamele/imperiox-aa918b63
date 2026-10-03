# Story OP1.3 — Sala de máquinas

Pedido (03/10/2026): transformar o Império em estrutura de automação com visão. Decisão do Vinicius: começar pela sala de máquinas (saúde de fontes, credenciais, rotinas e créditos, na tela e na CLI) e pelo custo por automação.

## Feito (03/10/2026)
- [x] Função `imphq_machine_room()` (migração `20261003_imphq_machine_room.sql`, aplicada; SECURITY DEFINER só para ler o pg_cron; devolve status e datas, nunca comando, token ou payload): rotinas ativas (última execução, falhas 24 h, último erro), ações automáticas por origem (falhas, expiradas, abertas), webhooks por plataforma (último aviso, erros 24 h), saúde do sync de anúncios, chips de WhatsApp, Instagram/Zernio, voz, custo de IA medido, frescor das fontes por projeto e tamanho do banco.
  - O histórico do pg_cron não é indexado por data: a leitura usa as ~30 mil execuções mais recentes pela chave.
- [x] Regra `_shared/machine-room.ts` (alertas erro/atenção/info com ação; reaproveita `adsSyncHealth`); queda isolada de conexão não alerta; plataforma calada há mais de 45 dias vira info. Testes: `src/test/machine-room.test.ts`.
- [x] CLI `scripts/health.mjs` (`--erros`, `--json`).
- [x] Tela `/sala-de-maquinas` no grupo Configurar, filtro por gravidade. Teste: `src/test/sala-maquinas.test.tsx`.

## Retrato real em 03/10
- Erros: rotina `job 1` (limpeza de recibos) falha todo dia (`storage.delete(text)` não existe); token da Meta vencido no JP e no tatuagem desde 26/06.
- Atenção: H&W (05/09), Hotmart (13/09) e ClickFlare (31/08) pararam de mandar avisos; tracker parado em LinfaFlow (22 dias), Tatuagem (20), Leaftide e Vigor Boost (12), HorseJello (8); histórico do pg_cron ocupa 1.233 MB de 3.089 MB do banco.
- Info: 20 propostas do `wa-ai-triage` esperando decisão; 2 instâncias de WhatsApp "default" que nunca conectaram; 5 projetos sem nenhum dado; custo de IA medido só no `wa-ai-reply` (US$ 0,20 em 283 chamadas em 7 dias).
- Voz: 2 áudios enviados em 03/10 (ElevenLabs voltou a ter saldo).

## Pendente
- [ ] Aprovação do Vinicius: limpar o histórico do pg_cron (> 7 dias) e agendar limpeza diária; desativar o `job 1` quebrado; remover as 2 instâncias "default".
- [ ] Custo por automação (story própria): 97 de 101 functions que chamam IA não registram custo.
- [ ] Conferência visual logado.
- [ ] MCP `get_machine_room` para a IA ler a mesma saúde.

## File List
- supabase/migrations/20261003_imphq_machine_room.sql
- supabase/functions/_shared/machine-room.ts
- scripts/health.mjs
- src/pages/SalaMaquinas.tsx
- src/App.tsx
- src/components/AppSidebar.tsx
- src/components/AppLayout.tsx
- src/integrations/supabase/types.ts
- src/test/machine-room.test.ts
- src/test/sala-maquinas.test.tsx
- .gitignore
- docs/stories/OP1.3-sala-de-maquinas.md
