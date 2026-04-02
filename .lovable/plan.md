

# Plano: OpenRouter + Claude + Gateway Lovable Híbrido

## Situação atual

- As API keys (incluindo OpenRouter) são salvas apenas no **localStorage** do navegador (página Configurações)
- A edge function `openflow-ai` usa **apenas** o `LOVABLE_API_KEY` com o gateway `ai.gateway.lovable.dev`
- O gateway Lovable suporta apenas Gemini e GPT — Claude e outros modelos não funcionam
- Não existe secret `OPENROUTER_API_KEY` no Supabase

## Solução: Roteamento híbrido automático

O frontend envia a key OpenRouter junto na request. A edge function decide qual API usar baseado no modelo escolhido:

- Modelos `google/*` e `openai/*` → Gateway Lovable (usa `LOVABLE_API_KEY`)
- Modelos `anthropic/*`, `meta-llama/*`, `deepseek/*`, qualquer outro → OpenRouter direto (usa a key enviada pelo frontend)

## Passo 1: Adicionar OPENROUTER_API_KEY como secret no Supabase

Usar a tool `add_secret` para criar o secret `OPENROUTER_API_KEY`. Assim a edge function pode ler de `Deno.env.get("OPENROUTER_API_KEY")` como fallback caso o frontend não envie.

## Passo 2: Atualizar a edge function `openflow-ai`

Na função `callAI()` e no trecho default:

```text
Se modelo começa com "google/" ou "openai/" → 
  URL: https://ai.gateway.lovable.dev/v1/chat/completions
  Auth: Bearer LOVABLE_API_KEY

Senão →
  URL: https://openrouter.ai/api/v1/chat/completions
  Auth: Bearer OPENROUTER_API_KEY
  Header extra: X-Title: ImperioHQ
```

## Passo 3: Atualizar lista de modelos no frontend

Adicionar modelos Claude e outros ao `AIGenerateButton.tsx`:

- `anthropic/claude-sonnet-4` — Claude Sonnet 4
- `anthropic/claude-3.5-sonnet` — Claude 3.5 Sonnet
- `deepseek/deepseek-r1` — DeepSeek R1
- `meta-llama/llama-4-maverick` — Llama 4 Maverick

Cada modelo terá um badge visual indicando se usa "Gateway" ou "OpenRouter".

## Passo 4: Passar a key do frontend para a edge function

O `AIGenerateButton` lê a key OpenRouter do localStorage (`imphq_api_keys → openrouter`) e envia no body da request como `openrouter_key`. A edge function usa essa key OU o secret do Supabase como fallback.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/openflow-ai/index.ts` | Roteamento híbrido: Lovable gateway vs OpenRouter baseado no modelo |
| `src/components/projeto/AIGenerateButton.tsx` | Adicionar modelos Claude/DeepSeek/Llama + enviar openrouter_key no body |

