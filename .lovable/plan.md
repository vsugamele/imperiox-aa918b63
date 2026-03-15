

# Plano: Catálogo de 20+ Ângulos de Copy no Market Intel

## Situação Atual

A tab "Ângulos de Copy" no Market Intel tem 12 ângulos com estrutura: angulo, logica, gatilho, nichoConverte, hookPronto, headlineVSL, quandoUsar, ctrEsperado, convEsperada.

O catálogo enviado tem 20 ângulos com estrutura diferente: nome, descrição, 2 exemplos.

## O que será feito

### 1. `src/data/marketIntelData.ts` — Adicionar os 20 ângulos do catálogo

Mesclar os 20 ângulos do catálogo com os 12 existentes. Os existentes já cobrem alguns (Dor Aguda ≈ Problema, Segredo ≈ Segredo Antigo, Inimigo Externo ≈ Conspiração, etc). Estratégia:

- **Manter os 12 existentes** (já têm dados ricos de CTR/conversão)
- **Adicionar ~10 novos** que não existem: Causa Raiz, Mecanismo da Solução, Segredo Antigo, Fascination, Lead-to-Ad, Descoberta Científica, Future Pacing, História Associativa, Demonstração Dramática, Notícia Sensacionalista, Qualificação, Superestrutura, Depoimento, Pergunta Paradoxal, Quebra de Expectativa

Cada novo ângulo segue o mesmo `MarketingAngle` interface, preenchendo hookPronto e headlineVSL com os exemplos fornecidos, e estimativas de CTR/conversão baseadas no tipo.

### 2. `src/pages/MarketIntel.tsx` — Busca e filtro nos ângulos

Adicionar campo de busca dentro da tab "Ângulos de Copy" para filtrar por nome/gatilho, já que agora serão 20+ cards. Também adicionar um contador no header.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/data/marketIntelData.ts` | Adicionar ~10 novos ângulos ao array `MARKETING_ANGLES` |
| `src/pages/MarketIntel.tsx` | Busca/filtro na tab de ângulos |

