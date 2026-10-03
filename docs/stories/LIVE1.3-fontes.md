# LIVE1.3 — Fontes do painel: tracker, sync de anúncios e webhook

**Status:** Parte de código Done (03/10/2026) · ações humanas pendentes abaixo · Épico: `EPIC-LIVE1-painel-ao-vivo.md`

## Diagnóstico (dados reais)
| Fonte | Problema | Causa |
|---|---|---|
| Tracker | Eventos chegavam sem `project_id` (LinfaFlow 4.216, JP ~3.500, SlimSoda… em 90 dias) | As páginas gravam direto em `imphq_events` sem o projeto |
| Meta direto (`facebook-ads-sync-all`) | Sem gasto desde 26/06 | **Token da Meta expirado em 26/06** (erro 190/463) no JP e em "tatuagem"; o sync falha a cada 30 min em silêncio |
| Zernio (`zernio-ads-sync`) | Último sucesso 19/08 | **Zernio é o X1 do Direct, não fonte de anúncio** (Vinicius). O cron de anúncios via Zernio foi desligado |
| Webhook Ticto | Julho com 18 vendas no Império × 748 compras no pixel só em 02/07 | Não são os erros do webhook: todas as aprovadas que caíram em erro desde agosto estão em `imphq_vendas`. As vendas de julho não chegaram ao Império (Ticto sem webhook para o Império ou outro checkout) |
| `imphq_ads_spend` | `checkouts_iniciados` sempre 0 | O sync grava em `init_checkout` (já tratado no LIVE1.1) |
| Finanças → Ads | Mostrava "✅ Facebook conectado" com token vencido | Olhava só se havia token salvo |

## Feito
- [x] `imphq_project_domains` + `imphq_resolve_project()` + gatilho em `imphq_events`: evento sem projeto ganha o projeto pelo domínio (cadastro manual ou URLs das etapas do mapa; plataformas compartilhadas como Ticto/vturb/Lovable nunca decidem sozinhas)
- [x] Retroativo de 90 dias: 8.449 eventos ligados (LinfaFlow 4.424, JP 3.552, SlimSoda 330, tatuagem, Vigor Boost, Leaftide), marcados com `metadata.project_from_domain` (desfazer documentado na migração); 669 seguem sem dono (domínios incertos)
- [x] `imphq_v_ads_sync_health` (só status, nunca token; sem acesso anônimo) + `adsSyncHealth()`: erro, parado (> 36 h sem sucesso) ou ok, com instrução; no painel ao vivo, no kit (CLI e MCP `get_project_kit.saude_sync_anuncios`) e no `scripts/live.mjs`
- [x] `zernio-ads-sync`: saídas de erro passam pelo `catch` (status gravado + `imphq_webhook_errors`), mensagem distingue 429 de conta vazia; publicado e confirmado
- [x] Zernio = X1 do Direct (03/10): cron `zernio-ads-sync-daily` desligado (religar documentado em `20261003_imphq_zernio_is_x1.sql`); saúde do sync olha só a Meta direta; kit: X1 = checkout + (WhatsApp **ou** Direct do Instagram), evidência do Direct = conta ativa com DM em 7 dias; Zernio no catálogo de ferramentas (X1)
- [x] Finanças → Ads mostra o erro real do sync (token expirado → instrução)
- [x] Testes (+3 saúde do sync); suíte 650 verde; typecheck, lint, build; `project-mcp` publicado

## Pendente (ação humana)
- [ ] **Token da Meta**: gerar token de usuário do sistema (não expira) no Business Manager com `ads_read` e salvar nas integrações do JP (e "tatuagem", se ainda usar).
- [ ] **Julho do JP**: em que checkout rodou a venda de julho e se a Ticto tinha o webhook do Império ativo; se der, exportar os pedidos para importar.
- [ ] **Domínios sem dono**: `horse-jello.healiks.com`, `codigodacobertura.*`, `gelatina-core-magic.lovable.app`, prévias do Lovable com id — de que projeto são?
  - 03/10: `horse-jello.healiks.com` → projeto novo **HorseJello** (decisão do Vinicius), com as 6 vendas H&W sem projeto e 169 eventos de 90 dias (migração `20261003_imphq_horsejello_project.sql`, com desfazer). Seguem sem dono: `codigodacobertura.*`, `gelatina-core-magic.lovable.app` e prévias do Lovable.
  - Atenção: a H&W grafou um SKU como "HorseJelo" (um L); o webhook acha o projeto pelo nome do produto e esse item sozinho não casaria. Se a oferta seguir, vale passar `?project_id=horsejello` na URL do postback dessa oferta.

## File List
- `supabase/migrations/20261003_imphq_project_domains.sql`, `supabase/migrations/20261003_imphq_v_ads_sync_health.sql`, `supabase/migrations/20261003_imphq_zernio_is_x1.sql` (novos)
- `supabase/functions/_shared/launch-kit.ts`, `supabase/functions/_shared/launch-plan.ts`, `src/test/launch-kit.test.ts`
- `supabase/functions/_shared/live-panel.ts`, `supabase/functions/zernio-ads-sync/index.ts`, `supabase/functions/project-mcp/index.ts`
- `src/hooks/useLivePanel.ts`, `src/integrations/supabase/types.ts`, `src/components/projeto/ProjetoFinancas.tsx`
- `scripts/launch.mjs`, `scripts/live.mjs`
- `src/test/live-panel.test.tsx`, `src/test/mcp-approvals-briefing.test.ts`, `src/test/map-agent-status-mcp.test.ts`
