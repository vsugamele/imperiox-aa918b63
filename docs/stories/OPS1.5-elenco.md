# Story OPS1.5 — Elenco: avatares para selecionar (quem aparece e para quem fala)

**Status:** Done (código) · **Data:** 2026-10-10 · **Rodando:** só sob demanda (botões "Sugerir elenco com IA" e "Gerar fotos", MCP `cast`)

## Contexto
Para produzir criativos com consistência e testar "quem fala" (Molde V01/V02), o Vinicius pediu um lugar com os
avatares para selecionar, nos dois sentidos: o elenco visual e a persona do público. Opção 3 (com geração por IA).

## Critérios de aceite
- [x] Reaproveita `imphq_avatar_studio_projects` (Avatar Studio) com `tipo`, `papel` (elenco/publico/ambos), `ficha`, `ativo`, `origem`; `imphq_test_variants.avatar_id`
- [x] `_shared/cast.ts`: tipos e opostos, atribuição de avatar por peça (só onde alguém aparece, com foto primeiro, giro de tipos, vencedor nas variações, escolha manual ganha), bloco da persona para a copy, linha do avatar para a imagem, avatar do Molde, prompts de sugestão e de fotos (retrato base + mesma pessoa)
- [x] Função `cast-studio` (listar · sugerir/salvar · fotos na Kie com o retrato como referência, bucket privado `avatar-refs`)
- [x] Estrategista atribui avatar (e aceita troca manual ao salvar); fábrica usa persona na copy e as fotos como primeiras referências da imagem; Molde sugere avatar para V01/V02/V04; placar por avatar (tela e MCP); teste criado de leva herda o avatar
- [x] Studio → aba Elenco (sugerir com IA, adicionar à mão, gerar fotos, ativar/desativar); coluna Avatar com seleção na prévia da leva; aviso e link quando o projeto não tem elenco
- [x] MCP `cast`; skill `metodo-hw` atualizada
- [x] Testes: `cast.test.ts`, `cast-tab.test.tsx`, `leva-factory.test.ts`, `next-batch-panel.test.tsx`

## Cuidados
Personagens fictícios: nunca como depoimento de cliente real; nada parecido com famosos; sem resultado inventado.

## File List
- supabase/migrations/20261010_imphq_cast.sql
- supabase/functions/_shared/cast.ts, batch-strategist.ts, leva-factory.ts, method-scoreboard.ts
- supabase/functions/cast-studio/index.ts, batch-strategist/index.ts, creative-factory/index.ts, winner-mold/index.ts, project-mcp/index.ts
- src/hooks/useCast.ts, src/hooks/useBatchStrategist.ts, src/components/studio/CastTab.tsx, src/components/testes/NextBatchPanel.tsx, src/pages/Studio.tsx, src/pages/Testes.tsx
- src/integrations/supabase/types.ts
- src/test/cast.test.ts, cast-tab.test.tsx, leva-factory.test.ts, next-batch-panel.test.tsx, testes-page.test.tsx
- .claude/skills/metodo-hw/SKILL.md, docs/architecture/maquina-de-testes.md
