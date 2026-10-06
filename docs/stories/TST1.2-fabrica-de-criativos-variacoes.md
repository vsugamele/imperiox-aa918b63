# Story TST1.2 — Fábrica de criativos: variações do ângulo vencedor (Fase 2)

Pedido (05/10/2026): continuar o sistema de testes pela fábrica de criativos. Do ângulo vencedor para um lote de artes novas, que entra direto numa ordem de teste.

## Achados antes de construir
- `creative-factory` e as tabelas `imphq_creative_batches` e `imphq_creative_assets` já existiam, mas nunca foram usadas (0 lotes).
  - Elas geram uma imagem genérica com o expert e deixam espaço para o texto.
  - As artes que funcionam (as do Grok) são peças com a headline na arte. Por isso a ação nova recria a peça vencedora em vez de começar do zero.
- A entrada pelo WhatsApp/Telegram é a função `material-ingest`. Ela é publicada a partir de outra pasta e não está neste repositório.
  - A versão 4, no ar, já sobe imagens para o Storage e recusa base64. Os 11 do Grok chegaram por uma versão anterior.
  - Pontos de atenção, não alterados aqui: aceita material sem projeto, e o link da imagem é assinado por 1 ano.

## Feito (05/10/2026)

### Regra (`_shared/creative-variations.ts`)
- [x] Eixos da Esteira P2: headline, avatar, gancho empilhado, fatia de público.
- [x] `planAxes`: até 6 variações.
- [x] `copyPrompt`: copy da arte e do anúncio, sem repetir headline.
- [x] `parseCopy`: valida campos e limites de palavras.
- [x] `imageInstruction`: mesma pessoa, mesmo estilo, texto exato em português.

### `creative-factory`
- [x] Ação nova `variations`, que roda em segundo plano. Para cada eixo:
  1. o Gemini Flash escreve a copy;
  2. o Gemini 3 Pro Image recria a arte com a peça base como referência;
  3. a arte vai para o Storage (sem Storage, é descartada; nunca grava base64).
- [x] Anti-loop: 3 falhas seguidas param o lote.
- [x] A função passou a aceitar a chamada interna do MCP com a chave de serviço, sempre com o `user_id` de alguém do time.
- [x] O `deno check` ficou sem erros.

### Provedores (decisão do Vinicius, 05/10: sem Lovable nas variações)
- [x] Texto da copy: OpenRouter (`google/gemini-2.5-flash`).
- [x] Imagem: Kie, com `nano-banana-pro` em 2K, 4:5, e a arte vencedora como referência (`image_input`).
- [x] A fábrica cria as tarefas de todas as variações de uma vez, consulta `jobs/recordInfo` a cada 6 s (por até 5,5 min) e copia o resultado para o Storage, porque o link da Kie expira.
- [x] O lote clássico e a edição continuam no gateway da Lovable, sem mudança.

### MCP
- [x] `generate_creative_variations`: a base pode vir de uma variante de teste (`test_order_id` + `ordem`, que traz a arte, a copy e a hipótese) ou de uma imagem. Roda em nome de quem pediu, de dentro do time.
- [x] `get_creative_batch`: status, artes, eixo e copy.
- [x] `create_test_order` aceita `creative_batch_id`: as artes prontas viram variantes com texto e headline.

### Testes
- [x] `creative-variations.test.ts` (4).
- [x] Teste do MCP: pedido de variações a partir de uma variante de teste.

## Pendente
- [ ] **Validar com uma arte real.** A chamada de dentro do banco levou 401 porque a chave guardada nas configurações do banco não é a mesma que a função espera. Não há chave atual no cofre, então o primeiro lote precisa vir do MCP (com a chave) ou de um botão na tela.
- [x] Botão "Gerar variações" na tela `/testes` (menu "Testes"), com o login de quem usa. A tela mostra cada teste com as variantes, a leitura e o veredito; os lotes de variações aparecem embaixo e se atualizam sozinhos enquanto geram.
- [ ] Observação de operação: `app.settings.service_role_key`, usado pelo `run_cron_job`, difere da chave das funções. Os logs não mostram rotinas falhando, mas vale alinhar.

## File List
- supabase/functions/_shared/creative-variations.ts
- supabase/functions/creative-factory/index.ts
- supabase/functions/project-mcp/index.ts
- src/test/creative-variations.test.ts
- src/test/mcp-approvals-briefing.test.ts
- src/pages/Testes.tsx
- src/hooks/useTestOrders.ts
- src/test/testes-page.test.tsx
- src/integrations/supabase/types.ts
- src/App.tsx
- src/components/AppSidebar.tsx
