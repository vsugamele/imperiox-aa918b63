
## Bloco 5 — Avatar/Arsenal: link ad-hoc + perguntas-chave + fix do "não gerou"

### 5.1 — Fix do botão "Gerar com IA" do Arsenal (CopyArsenalSection)
**Problema raiz:** quando "Todos" está selecionado, `product_index` não é enviado → backend não scrapeia URLs específicas do produto e gera copy genérica/diluída. Além disso, o `hasContent` filtra agressivo demais (uma variação com whitespace já bloqueia o preenchimento).

**Mudanças em `src/components/projeto/CopyArsenalSection.tsx`:**
- Default do `selectedProductIndex` passa a ser `"0"` quando há produtos (em vez de `"__all__"`), garantindo que `product_index` sempre vá no body quando há produto.
- `hasContent` mais rigoroso: considera vazio se todas as variações têm `.trim().length === 0`.
- Adicionar **toast de feedback rico** mostrando quantos blocos foram preenchidos vs. ignorados (ex: "5 blocos preenchidos, 1 já tinha conteúdo").
- Logar no console o `data` recebido para debug futuro.

### 5.2 — Modal "Gerar Arsenal" com link ad-hoc + briefing rápido
Antes de disparar a IA, abrir um pequeno modal (reutilizar `Dialog`) com:
- **URL extra (opcional)**: campo livre pra colar um link de página de vendas/LP que o usuário acabou de fazer (mesmo que ainda não esteja salvo no produto). Vai como `extra_urls: string[]` no body.
- **Briefing rápido (opcional)**: textarea com 3 placeholders/perguntas-chave guiadas:
  1. "Qual a transformação central que esse produto entrega? (ex: sair de X pra Y em Z dias)"
  2. "Quem é o inimigo / o que está bloqueando o avatar hoje?"
  3. "Que mecanismo único / método diferente você usa? (em 1 frase)"
- Botão "Gerar" → envia `extra_urls` + `briefing_extra` no `extraBody`.

Pra evitar inflar o `AIGenerateButton` com props específicas, criar um **`CopyArsenalGenerateButton`** wrapper local em `CopyArsenalSection.tsx` que faz seu próprio modal e chama `supabase.functions.invoke("openflow-ai", ...)` direto (mantendo a lógica de `mente_id`/`skill_slugs` mais simples — só modelo padrão por enquanto). Isso isola a UX nova sem mexer no botão genérico usado em 30+ lugares.

### 5.3 — Backend: aceitar `extra_urls` e `briefing_extra` em `handleCopyArsenal`
**Mudanças em `supabase/functions/openflow-ai/index.ts`:**
- Extrair `extra_urls` e `briefing_extra` do body em `serve()` e passar pra `handleCopyArsenal`.
- Em `handleCopyArsenal`:
  - Concatenar `extra_urls` na lista `productLinks` antes do dedup/scrape.
  - Se `briefing_extra` existir, injetar no prompt: `\n## BRIEFING DIRETO DO USUÁRIO (prioridade máxima):\n${briefing_extra}\n` antes das REGRAS.
- Log adicional: `console.log("Copy arsenal generated for product_index:", productIndex, "extra_urls:", extra_urls?.length)` pra debug.

### 5.4 — (bônus pequeno) Fix dos build errors travando deploy
O log mostra erros pré-existentes em `webhook-pagamento`, `whatsapp-api` e `openflow-ai` que estão impedindo deploy limpo das edge functions. Vou abordar **só os 3 do `openflow-ai`** (que tocamos agora), pra garantir que o deploy desse bloco vá:
- `objectiveLabel` / `funnelLabel`: tipar como `Record<string, string>`.
- `callAIWithTools` (linha 1678): renomear pra `callAI` (função existente) ou stub.

Os erros de `webhook-pagamento` e `whatsapp-api` ficam pra um Bloco 6 separado (não bloqueiam esse deploy porque cada função é compilada isolada).

---

**Arquivos tocados:**
- `src/components/projeto/CopyArsenalSection.tsx` (modal + fix)
- `supabase/functions/openflow-ai/index.ts` (aceitar novos params + fix dos 3 erros)

**Sem mudanças de schema.** Tudo cabe nos params existentes do JSONB e no payload do edge function.

Confirma com **"vai"** que saio do plan mode e toco 5.1 → 5.2 → 5.3 → 5.4 em sequência.
