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
- [x] Piloto público validado antes de expandir as páginas próprias das outras ofertas.
- [ ] Lint/typecheck/test/build, commits com story e produção conferida.
- [ ] Handoff com evidências e limites: recepção de testes não comprova venda real/Meta; configuração de checkout/postback dependente fica explícita.

## File List

public/funnel.js; src/components/tracker/TrackerEvidence.tsx; src/pages/Tracker.tsx; src/pages/Atribuicao.tsx; src/hooks/useFunnelRevenue.ts; src/components/funis/RevenueOverlay.tsx; src/lib/paginated-query.ts; src/integrations/supabase/types.ts; src/test/{funnel-browser,funnel-event,hw-order,sale-attribution,tracker-evidence}.test.*; supabase/functions/{funnel-track,webhook-pagamento}/index.ts; supabase/functions/_shared/{funnel-event,sale-attribution,hw-order,attribution}.ts; supabase/migrations/{20261006093140_tracker_evidence,20261006101658_tracker_legacy_click_bridge,20261006101836_tracker_unassigned_links}.sql; supabase/tests/tracker_evidence.sql; docs/operations/affiliate-offers-2026-10-02.md; docs/sessions/2026-10/2026-10-06-tracker-trk11.md.

## Evidências atuais

Migração aplicada e assertions SQL passadas com rollback; sem fixtures financeiras persistidas. Coletor v378: 400 para inválido, 200/duplicate:false e 200/duplicate:true para o mesmo event_id. Webhook v594 publicado. H&W: rota de todas ofertas corrigida, removendo project=lipo inexistente; token e escopos mantidos. Piloto Leaftide commit 9fe792c em produção: uma sessão, um clique, vsl_view/vsl_instrumented com player correto; checkout conserva hid/affid/pacote. Todos esses eventos são QA e excluídos do relatório. Gates completos: 802 testes; 64 testes focados após ajustes; lint 0 erros/8 avisos; typecheck/build passaram. A execução global inicial teve um timeout por concorrência, resolvido com maxWorkers=2 sem mudar timeout/assertions.

Compatibilidade posterior: imp_link_id transportado em meta e destino, resetado em nova campanha. Ponte transacional entre entradas e imphq_clicks mantém links registrados e globais, valida projeto/ativo, deduplica pelo click_id e exclui QA. Migrações 20261006101658_tracker_legacy_click_bridge.sql e 20261006101836_tracker_unassigned_links.sql aplicadas; assertions repetidas com rollback, incluindo deduplicação/link global/QA/projeto incorreto. Coletor atualizado v379; 11 testes contrato/navegador passados; lint 0 erros/8 avisos. Quatro pacotes de oferta: 73 testes Node, sintaxe/diff aprovados, mesmo script canônico, configurações preservadas.

## Limites

Publicação conferida em 06/10: Império `37d010cb`, Leaftide `e3fb5f7`, CardioFlush H&W `dda5cbb`, MemoFlow `2845925`, SlimSoda `eca1711`. Os cinco scripts públicos retornam 200 com SHA256 `084aba28fedb577d53ac4f028cb9ef57bd64dadbda7d6f916af1cd87f07e0b7e`. PR #2 aberta, anexada e sem merge: https://github.com/vsugamele/imperiox-aa918b63/pull/2 . Versão integrada: 819 testes/120 arquivos, lint sem erros/8 avisos, typecheck e build aprovados. CI types-drift falhou por SUPABASE_ACCESS_TOKEN ausente; nenhuma proteção foi reduzida.

QA no navegador: relatório autenticado carregou; valores desconhecidos/incompatíveis ficaram indisponíveis; Leaftide mostrou zero eventos reais, sem incluir os testes. CardioFlush e MemoFlow receberam VSL/instrumentação com respectivos players. SlimSoda ADV1 -> VSL -> link checkout conservou visitor/session/click e hid/affid; PDP conservou a identidade e recebeu pdp_view. Dez nós existentes do mapa receberam notas de versão/limites; quatro sites receberam tag TRK1.1 e resumo preservando os históricos. Conferência encontrou ROAS/CPA/alerta inválidos no painel legado sem mídia e timeline ainda bruta; correção final em execução, simulador manual preservado.

Sem compra de teste, cobrança, disparos WhatsApp ou mudança de BM. Validação identificada e excluída dos relatórios. Não inferir históricos sem evidência. API Vturb oficial: https://smartplayer.vturb.com/en/api/ e https://smartplayer.vturb.com/en/events/.
