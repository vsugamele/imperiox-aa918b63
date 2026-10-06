# TRK1.1 — Jornada, receita e confiança do tracker

Status: Em execução · 06/10/2026

Direção aprovada: 1. Jornada e checkout; 2. Receita, deduplicação e confiança; 3. VSL, diagnóstico e escala. Piloto Leaftide, seguido das três páginas próprias já cadastradas. Reaproveitar tracker, Tracker/Atribuição, webhooks e mapa. Liderança técnica @dev; schema @data-engineer; gates @qa; publicação exclusivamente @devops.

## Critérios

- [x] Conferir código, fontes existentes e schema vivo completo das tabelas afetadas, índices, políticas e triggers.
- [x] IDs de visitante/sessão/clique propagados nos destinos próprios e checkout sem alterar afiliado/pacote.
- [x] Primeiro/último contato separados, cache por projeto, novo contato sem mistura de UTMs antigas.
- [x] Evento idempotente, payload validado, fila limitada, confirmação e reenvio com limite.
- [x] H&W: preservar comissão zero, não regredir estado pago por aviso pendente, registrar falhas e atribuição por clique comprovado.
- [x] Atribuição WhatsApp exige produto e janela no fallback e informa método/confiança; desconhecido não vira orgânico.
- [x] Receita agregada por moeda/criativo, aprovações/reembolsos separados; resultado após mídia só entre valores compatíveis.
- [x] Diagnóstico: ausência/erro não vira zero; fonte nova entra na saúde; sessões VSL/pitch/retensão por player.
- [ ] Piloto público validado antes de expandir as páginas próprias das outras ofertas.
- [ ] Lint/typecheck/test/build, commits com story e produção conferida.
- [ ] Handoff com evidências e limites: recepção de testes não comprova venda real/Meta; configuração de checkout/postback dependente fica explícita.

## File List

public/funnel.js; src/components/tracker/TrackerEvidence.tsx; src/pages/Tracker.tsx; src/pages/Atribuicao.tsx; src/hooks/useFunnelRevenue.ts; src/components/funis/RevenueOverlay.tsx; src/lib/paginated-query.ts; src/integrations/supabase/types.ts; src/test/{funnel-browser,funnel-event,hw-order,sale-attribution,tracker-evidence}.test.*; supabase/functions/{funnel-track,webhook-pagamento}/index.ts; supabase/functions/_shared/{funnel-event,sale-attribution,hw-order,attribution}.ts; supabase/migrations/20261006093140_tracker_evidence.sql; supabase/tests/tracker_evidence.sql.

## Evidências atuais

Migração aplicada e assertions SQL passadas com rollback; sem fixtures financeiras persistidas. Coletor v378: 400 para inválido, 200/duplicate:false e 200/duplicate:true para o mesmo event_id. Webhook v594 publicado. H&W: rota de todas ofertas corrigida, removendo project=lipo inexistente; token e escopos mantidos. Piloto Leaftide commit 9fe792c em produção: uma sessão, um clique, vsl_view/vsl_instrumented com player correto; checkout conserva hid/affid/pacote. Todos esses eventos são QA e excluídos do relatório. Gates completos: 802 testes; 64 testes focados após ajustes; lint 0 erros/8 avisos; typecheck/build passaram. A execução global inicial teve um timeout por concorrência, resolvido com maxWorkers=2 sem mudar timeout/assertions.

## Limites

Sem compra de teste, cobrança, disparos WhatsApp ou mudança de BM. Validação identificada e excluída dos relatórios. Não inferir históricos sem evidência. API Vturb oficial: https://smartplayer.vturb.com/en/api/ e https://smartplayer.vturb.com/en/events/.
