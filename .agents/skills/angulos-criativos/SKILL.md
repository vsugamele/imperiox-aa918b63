---
name: angulos-criativos
description: Escolher e escrever ângulos de criativo/anúncio a partir do catálogo canônico dos 11 ângulos do Imperius, aplicando a regra de consciência × sofisticação e evitando repetir emoção dominante. Usar sempre que o usuário pedir headline, hook, ângulo, criativo, VSL, Reels ou anúncio.
---

# Ângulos de Criativo — Modo Manual

Este skill é o **modo manual** do mesmo catálogo que roda no wizard one-click e nas edge functions `openflow-ai`, `site-to-ecosystem`, `wa-ai-reply`, `creative-factory`, `nurture-generator`, `studio-batch-cron`.

## Fonte da verdade

O catálogo canônico dos 11 ângulos vive em código, não neste arquivo:

- `supabase/functions/_shared/creativeAngles.ts` — a estrutura `CREATIVE_ANGLES` com `slug`, `nome`, `gatilho`, `emocaoDominante`, `quandoUsar`, `estrutura`, `errosComuns`, `exemploHook`.

Antes de gerar qualquer ângulo, leia esse arquivo. Nunca invente ângulos novos — sempre escolha um dos 11 slugs.

## Fluxo de trabalho

1. **Diagnosticar o momento do avatar**
   - Consciência (Eugene Schwartz, 1-5): inconsciente → mais consciente
   - Sofisticação de mercado (1-5): mercado virgem → saturado
2. **Escolher N slugs** que casam com o momento, usando o campo `quandoUsar` de cada ângulo do catálogo.
3. **Diversificar emoção dominante** — nunca repetir a mesma `emocaoDominante` em dois ângulos do mesmo lote.
4. **Escrever cada ângulo seguindo a `estrutura`** documentada (headline → corpo → CTA).
5. **Rodar o checklist de qualidade** antes de entregar:
   - Headline para o scroll (≤ 60 chars, para o scroll em 3s)
   - Uma emoção dominante clara por ângulo
   - Corpo respeita a estrutura documentada do ângulo
   - CTA específico (nunca "clique aqui")
   - Claim arriscado sinalizado (renda / saúde / prazo → "resultados variam")
   - Nenhum item da lista `errosComuns` do ângulo escolhido presente

## Helpers disponíveis (edge)

```ts
import {
  CREATIVE_ANGLES, ANGLE_BY_SLUG, ALL_SLUGS,
  anglesCatalogBlock,     // catálogo formatado para injetar em system prompt
  qualityChecklistBlock,  // checklist para injetar antes do modelo retornar
  selectAnglesForBrief,   // seleciona N ângulos diversificando emoção
} from "../_shared/creativeAngles.ts";
```

## Formato de entrega (chat)

```
### Ângulo 1 — {nome}  (slug: {slug} · emoção: {emocaoDominante})
Headline: …
Corpo: …
CTA: …
```

## Não fazer

- Não gerar ângulos com nomes ou slugs fora do catálogo.
- Não repetir emoção dominante entre ângulos do mesmo lote.
- Não usar "clique aqui" ou CTA genérico.
- Não prometer resultado específico sem sinalização de garantia/variação.
