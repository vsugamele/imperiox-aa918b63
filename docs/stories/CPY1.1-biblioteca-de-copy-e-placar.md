# CPY1.1 — Biblioteca de copy e placar por método e ângulo

**Status:** Done · 06/10/2026

## Contexto
Vinicius trouxe as bibliotecas do @renanmsap (ângulos, objeções, provas, mecanismos) e pediu para usá-las no dia a dia e como controle dentro do Império, medindo qual jeito de escrever e qual ângulo vende ("skill x, skill y, jeito A, jeito B").

## Acceptance Criteria
- [x] Tabela `imphq_copy_library` com 78 ângulos, 24 objeções, 34 provas, 10 tipos de mecanismo e 19 itens de processo (leitura para o time, escrita só pelo servidor). Conteúdo semeado a partir dos arquivos do Vinicius, fora do repositório (material de terceiro, uso interno).
- [x] Variantes de teste ganham `metodo` (quem escreveu) e `copy_lib_id` (ângulo da biblioteca).
- [x] Estratégias → "Biblioteca de copy": abas por biblioteca, filtro por camada, busca, detalhe com explicação, exemplo, como usar, prova que quebra, onde quebrar, prompt e a etiqueta para copiar.
- [x] Testes → "Placar" por método, ângulo ou camada: anúncios, quantos venderam, gasto, IC, vendas reais, CPA e saldo; "sem etiqueta" sempre por último.
- [x] Etiquetas visíveis em cada variante.
- [x] MCP: `get_copy_library`, `tag_test_variants`, `get_method_scoreboard`.
- [x] Teste do CCP etiquetado (método `grok:minerado`, ângulos 2, 72, 51, 13, 22, 23, 73, 40, 26, 12 — classificação do Claude, ajustável).

## CPY1.2 — Jev (piloto, 06/10)
- [x] `TYPESAFE_API_KEY` salva pelo Vinicius como segredo do Supabase.
- [x] `_shared/angle-classifier.ts` (pergunta Choice com os 78 ângulos + "nenhum", e a camada) e função `jev-classify` (modo variants/references, dry-run por padrão, máx. 30 itens, para após 3 falhas; gravar só preenche etiqueta vazia com decisão firme).
- [x] Piloto CCP (10 variantes): 6 firmes, 4 batem com a etiqueta do Claude e 2 são alternativas defensáveis; as 4 discordâncias restantes vieram como dúvida. US$ 0,0018.
- [x] Piloto referências (20): 11 firmes, 9 dúvidas. US$ 0,0039 (~4,6 mil tokens por item).

## CPY1.3 — Ângulo nas referências (06/10)
- [x] `imphq_referencias` ganha copy_lib_id/status/conf/camada/alt/at; `jev-classify` modo auto (cron `jev-classify-auto` a cada 6h, :50): referências novas + variantes sem etiqueta dos testes ativos, máx. 30 por rodada.
- [x] Variante só recebe etiqueta firme e nunca sobrescreve; referência grava firme e dúvida (dúvida vai para revisão).
- [x] Backfill: 106 referências com transcrição → 56 firmes, 50 dúvidas, ~US$ 0,02.
- [x] Estratégias → Biblioteca de copy → "No mercado": camadas, ângulos mais usados (clique lista as referências) e fila de dúvidas com o palpite do Jev e as alternativas para decidir em um clique.

## Próximos passos
- Objeções dos comentários e do WhatsApp com o Jev.
- Arsenal de objeções e provas por projeto.

## File List
- supabase/migrations/20261006_imphq_copy_library.sql
- supabase/functions/_shared/method-scoreboard.ts
- supabase/functions/project-mcp/index.ts
- src/integrations/supabase/types.ts
- src/hooks/useCopyLibrary.ts
- src/components/estrategias/CopyLibrary.tsx
- src/pages/Estrategias.tsx
- src/pages/Testes.tsx
- src/test/method-scoreboard.test.ts
- src/test/copy-library.test.tsx
- src/test/testes-page.test.tsx
- supabase/functions/_shared/angle-classifier.ts
- supabase/functions/jev-classify/index.ts
- src/test/angle-classifier.test.ts
- supabase/migrations/20261006_imphq_referencias_copy_angle.sql
- src/components/estrategias/MarketAngles.tsx
- src/test/market-angles.test.tsx
