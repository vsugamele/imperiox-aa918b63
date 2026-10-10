# Story OPS1.4 — Fábrica gera as artes da leva aprovada

**Status:** Done (código) · **Data:** 2026-10-10 · **Rodando:** só quando alguém manda (botão "Gerar artes" numa leva aprovada ou MCP `generate_batch`)

## Contexto
Opção 2 depois do Estrategista (OPS1.3): transformar a leva aprovada em artes prontas para teste, sem escrever copy à mão.

## Critérios de aceite
- [x] `_shared/leva-factory.ts`: prompt de copy pelo Método H&W (porta, ponto, hook com 4 funções, aterrissagem para ela, Regra do Um, compliance) com o ângulo da biblioteca e as referências do mercado; instrução de imagem por formato (estático, carrossel, print de conversa, antes/depois, infográfico, meme, depoimento) e carga; checagem rápida do Revisor
- [x] `creative-factory` action `leva`: só leva com status `aprovado`; até 20 itens de imagem; copy (OpenRouter) → Kie (nano-banana-pro, referências do mercado só como inspiração) → Storage; etiquetas no metadata; reprovada na checagem rápida já sai marcada; para após 3 falhas seguidas
- [x] Leva: aprovar só de planejado/failed; descartar só antes de gerar
- [x] Painel "Próxima leva": botão "Gerar artes" (oferta + público), andamento, link "ver artes"
- [x] MCP `generate_batch`; `create_test_order` com `creative_batch_id` de leva copia ângulo, formato, porta, carga e ponto para as variantes
- [x] Testes: `leva-factory.test.ts`, `next-batch-panel.test.tsx`

## File List
- supabase/functions/_shared/leva-factory.ts
- supabase/functions/creative-factory/index.ts, batch-strategist/index.ts, project-mcp/index.ts
- src/hooks/useBatchStrategist.ts, src/components/testes/NextBatchPanel.tsx
- src/test/leva-factory.test.ts, src/test/next-batch-panel.test.tsx
- .claude/skills/metodo-hw/SKILL.md, docs/architecture/maquina-de-testes.md
