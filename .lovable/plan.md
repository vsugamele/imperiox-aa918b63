

# Plano: Evoluir AIGenerateButton com prop `menteId`

## Objetivo

Permitir que qualquer instancia do `AIGenerateButton` injete a personalidade de uma Mente IA (Dan Kennedy, Gary Halbert, etc.) no system prompt da geracao. O usuario escolhe a Mente no dialog antes de gerar.

## Mudancas

### 1. `src/components/projeto/AIGenerateButton.tsx`

- Adicionar prop opcional `showMenteSelector?: boolean` (default false)
- Importar `MENTES_DATA` de `@/data/mentesData`
- Adicionar state `selectedMente: string | null` (null = sem mente)
- No dialog, quando `showMenteSelector=true`, renderizar um `<Select>` com as 8 mentes + opcao "Nenhuma"
- No `handleGenerate`, se `selectedMente` estiver setado, enviar `mente_id` no body payload

### 2. `supabase/functions/openflow-ai/index.ts`

- No inicio (apos extrair `body`), ler `mente_id` do body
- Se `mente_id` existir, buscar o prompt da mente correspondente em `MENTES_DATA` (hardcoded no edge function como lookup simples — id → prompt)
- Injetar o prompt da mente como prefixo do system prompt em `handleExecuteSkill` e nos handlers de copy/branding/gatilhos
- Substituir o bloco generico `mentesRef` (linha 335) pelo prompt completo da mente selecionada quando `mente_id` for passado

### 3. Ativar seletor de Mente nas abas relevantes

- `CopyArsenalSection.tsx` — adicionar `showMenteSelector={true}` no AIGenerateButton existente
- `ProjetoBriefing.tsx` — se tiver AIGenerateButton, adicionar `showMenteSelector`
- `ProjetoEmails.tsx` — idem

## Lookup de Mentes no Edge Function

Em vez de buscar do banco (nao existe tabela de mentes), o edge function tera um map simples:

```typescript
const MENTE_PROMPTS: Record<string, { nome: string; prompt: string }> = {
  dan_kennedy: { nome: "Dan Kennedy", prompt: "Você é Dan Kennedy — o pai do marketing de resposta direta..." },
  gary_halbert: { nome: "Gary Halbert", prompt: "Você é Gary Halbert — o príncipe do direct mail..." },
  // ... 8 mentes
};
```

Quando `mente_id` chega no body, o prompt da mente e prepended ao system prompt:

```typescript
if (mente_id && MENTE_PROMPTS[mente_id]) {
  systemPrompt = `## PERSONALIDADE ATIVA: ${MENTE_PROMPTS[mente_id].nome}\n${MENTE_PROMPTS[mente_id].prompt}\n\n---\n\n${systemPrompt}`;
}
```

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/AIGenerateButton.tsx` | Prop `showMenteSelector`, Select de Mentes no dialog, enviar `mente_id` no payload |
| `supabase/functions/openflow-ai/index.ts` | Ler `mente_id`, lookup de prompts, injetar no system prompt |
| `src/components/projeto/CopyArsenalSection.tsx` | Adicionar `showMenteSelector={true}` |

