# Story OPS2.1 — Plataformas

Pedido (04/10/2026): uma tela no estilo de imperio-centro-comando.vercel.app/plataformas. Decisão do Vinicius: montar com os dados do Império.

## Feito (04/10/2026)
- [x] Registro versionado `_shared/platforms.ts`: 19 plataformas em 9 categorias (mídia paga, conversas, IA, produção, distribuição, receita, métricas, infraestrutura, pesquisa), com ações, autonomia (API, CLI, agente, webhook, navegador, humano), acesso (só nomes de variáveis, nunca valores), quem opera e próximo passo.
- [x] Estado calculado pelos sinais da sala de máquinas (`imphq_machine_room()`): sync da Meta, chips, Instagram/Zernio, rotinas, tracker, webhooks de checkout e consumo dos provedores; sem sinal automático aparece como "Sem sinal automático" (nunca "ok"). Custo da OpenRouter pela semana informada por ela.
- [x] Tela `/plataformas` (grupo Configurar): resumo (utilizáveis, automatizáveis, assistidas, pendentes), 3 princípios e cartões por categoria. CLI: `node scripts/health.mjs --plataformas`.
- [x] Retrato em 04/10: 19 plataformas, 10 utilizáveis; Meta Ads em erro (token vencido em 26/06).
- [x] Testes: `src/test/platforms.test.ts`, `src/test/centro-imports-views.test.tsx`.

## Pendente
- [ ] Sinais para GeeLark, YouTube, Vercel, Higgsfield e gateway do Lovable.
- [ ] MCP `get_platforms` para a IA consultar o mesmo estado.
- [ ] Conferência visual logado.

## File List
- supabase/functions/_shared/platforms.ts
- src/pages/Plataformas.tsx
- src/App.tsx
- src/components/AppSidebar.tsx
- src/components/AppLayout.tsx
- scripts/health.mjs
- src/test/platforms.test.ts
