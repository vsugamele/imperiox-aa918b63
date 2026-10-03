# LAUNCH1.1 — Kit de operação (canais, acessos e ferramentas)

**Status:** Done (03/10/2026) · Épico: `EPIC-LAUNCH1-lancador-de-projetos.md`

## Objetivo
Todo projeto sabe de que precisa para rodar cada canal: acessos (com status, dono e o que trava o quê), ferramentas de operação e playbooks. Base do lançador (LAUNCH1.3).

## Acceptance Criteria
- [x] `_shared/launch-kit.ts`: 6 canais (YouTube, SEO, tráfego direto, X1, orgânico social, webinar) → playbooks, acessos obrigatórios/opcionais, ferramentas; 17 acessos com "como fazer", dependências e evidência; 13 ferramentas de operação
- [x] Pedido em texto livre ("YouTube, SEO, tráfego direto, X1") vira canais; canais também saem dos playbooks já aplicados
- [x] Checklist: junta canais sem repetir, puxa dependências (de obrigatório = obrigatória; de opcional = opcional), ordem de dependência, "próximos" = o que falta sem bloqueio
- [x] Status: evidência do banco manda (WhatsApp ativo, gasto sincronizado 7 d, tracker 7 d, vendas 30 d); depois o declarado; depois inferência (tracker com eventos ⇒ site e domínio existem); avisos quando declaração e dado divergem
- [x] Tabela `imphq_project_access` (só status, nota, dono; nunca segredo) com RLS; migração aplicada
- [x] Ferramentas de operação no catálogo `imphq_capabilities` (fonte "kit de operação"): antes eram 73 itens só de design/código
- [x] CLI `scripts/launch.mjs`: `canais`, `seed-tools`, `kit`, `acesso`
- [x] MCP `get_project_kit` e `set_project_access`; `project-mcp` publicado
- [x] Testes: `launch-kit.test.ts` (8) + MCP (+2); suíte 633 verde; typecheck e lint limpos; deno check na linha de base (9)

## Leitura real (03/10)
- SlimSoda (tráfego direto): 2/6 — faltam domínio, site, BM/conta de anúncio, pixel/CAPI.
- JP (X1 + tráfego direto): 5/7 — falta BM/conta de anúncio e pixel; sync de anúncios sem dado desde 19/08.

## File List
- `supabase/functions/_shared/launch-kit.ts` (novo)
- `supabase/migrations/20261003_imphq_project_access.sql` (novo)
- `scripts/launch.mjs` (novo), `.gitignore`
- `supabase/functions/project-mcp/index.ts`
- `src/test/launch-kit.test.ts` (novo), `src/test/mcp-approvals-briefing.test.ts`, `src/test/map-agent-status-mcp.test.ts`
