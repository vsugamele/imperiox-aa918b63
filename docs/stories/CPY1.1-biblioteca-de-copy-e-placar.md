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

## Próximos passos
- Jev (TypeSafe) para classificar referências, anúncios e comentários nos ângulos e objeções da biblioteca, quando a chave estiver salva como `TYPESAFE_API_KEY`.
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
