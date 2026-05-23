## Problema

Quando a sequência é gerada (via IA) ou importada (via texto colado), os parágrafos chegam grudados — sem espaçamento entre saudação, corpo e CTA. A causa está em três pontos:

1. **`wa-campaign-ai-generate`** — o prompt pede "máx 8 linhas" mas não instrui o modelo a usar `\n\n` entre parágrafos. O Gemini devolve tudo num bloco só.
2. **`wa-campaign-parse-text`** — o parser pede pra "preservar quebras de linha", mas não enfatiza **linhas em branco entre parágrafos** (e o `.trim()` final remove blocos vazios nas pontas). Ao reextrair, o modelo normaliza tudo pra `\n` simples.
3. **Textarea do editor** — o campo de conteúdo no `CampaignStepEditor` usa altura padrão e não tem fonte monoespaçada nem indicação visual de quebras, o que faz parecer "grudado" mesmo quando há `\n`.

A preview do WhatsApp e o diagrama já usam `whitespace-pre-wrap`, então o renderer está OK — o problema é o conteúdo salvo não ter espaçamento.

## Mudanças

### 1. `supabase/functions/wa-campaign-ai-generate/index.ts`
Reforçar no `systemPrompt` e no `userPrompt`:
- "Formate como mensagem WhatsApp real: **uma linha em branco entre parágrafos** (use `\n\n`)."
- "Saudação isolada, corpo em 2-3 parágrafos curtos, CTA em linha própria."
- "Negrito com `*texto*`, listas com `•` ou emoji + linha."
- Adicionar exemplo curto inline mostrando estrutura com `\n\n`.

### 2. `supabase/functions/wa-campaign-parse-text/index.ts`
- Trocar instrução 6 para: "content = texto **exato** da mensagem, **preservando linhas em branco entre parágrafos** (use `\n\n`). Não colapse múltiplos `\n` em um só."
- Trocar `String(s.content || "").trim()` por preservação interna: remover só espaços/quebras nas pontas via `.replace(/^[\s\n]+|[\s\n]+$/g, "")` (mantém os `\n\n` internos).
- Adicionar exemplo no prompt mostrando input com linhas em branco → output com `\n\n`.

### 3. `src/components/whatsapp/CampaignStepEditor.tsx`
Localizar o `Textarea` do campo `content` (~linha 420+) e:
- Aumentar `rows` para 8 (atual provavelmente 3-4).
- Adicionar `className="font-mono text-xs leading-6 whitespace-pre-wrap"` para mostrar quebras claramente.
- Adicionar contador discreto abaixo: "X linhas · Y caracteres".

### 4. `src/components/whatsapp/CampaignImportDialog.tsx`
Confirmar que `s.content.slice(0, 4000)` não está sendo passado por nenhum `.trim()` adicional antes do insert (linha 76). Se houver, remover.

## Fora de escopo

- Não mexer no envio (Evolution API já preserva `\n`).
- Não mudar o preview/diagrama (já usam `whitespace-pre-wrap`).
- Não criar migração — apenas edge functions + componente.

## Resultado esperado

Mensagens geradas pela IA e importadas do texto colado mantêm a formatação visual de uma mensagem WhatsApp real, com parágrafos separados por linha em branco, tanto no editor quanto na preview e no envio.