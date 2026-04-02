

# Plano: Atualizar modelos Claude + Adicionar "Ontem" no filtro de Leads

---

## 1. Atualizar modelos Claude para versões mais recentes

Os modelos Claude no sistema estão desatualizados. As versões mais recentes no OpenRouter são:
- **Claude Opus 4.6** (`anthropic/claude-opus-4.6`) — O mais poderoso da Anthropic
- **Claude Sonnet 4.6** (`anthropic/claude-sonnet-4.6`) — Melhor custo-benefício Sonnet
- **Claude Sonnet 4.5** (`anthropic/claude-sonnet-4.5`) — Versão anterior estável

Atualmente o sistema tem `claude-sonnet-4` e `claude-3.5-sonnet`, ambos defasados.

**Atualização em 3 arquivos:**

| Arquivo | O que muda |
|---|---|
| `src/components/projeto/AIGenerateButton.tsx` | Trocar `claude-sonnet-4` → `claude-sonnet-4.6`, `claude-3.5-sonnet` → `claude-opus-4.6` |
| `src/components/projeto/ProjetoFinancas.tsx` | Atualizar `AI_MODELS` com `claude-sonnet-4.6` |
| `src/pages/Skills.tsx` | Atualizar SelectItem de `claude-sonnet-4` → `claude-sonnet-4.6` |

Lista final no `AIGenerateButton` (seção OpenRouter):
```
anthropic/claude-opus-4.6  — "🟣 Claude Opus 4.6" — Mais poderoso Anthropic
anthropic/claude-sonnet-4.6 — "🟣 Claude Sonnet 4.6" — Rápido e inteligente  
anthropic/claude-sonnet-4.5 — "🟣 Claude Sonnet 4.5" — Versão estável anterior
```

---

## 2. Adicionar filtro "Ontem" em Leads + garantir "Personalizado" visível nos KPIs

**Problema**: Não existe opção "Ontem" nos filtros de período, e na área de KPIs (linha 826) o filtro "Personalizado" é excluído.

**Solução** em `src/pages/Leads.tsx`:
- Adicionar `"yesterday"` ao type `PeriodKey`
- Adicionar `{ key: "yesterday", label: "Ontem" }` no array `PERIOD_OPTIONS` (após "Hoje")
- Na função `getPeriodRange`, tratar `case "yesterday"`: retornar `startOfDay(subDays(now, 1))` até `endOfDay(subDays(now, 1))`
- Remover o `.filter(p => p.key !== "custom")` na linha 826 para que "Personalizado" apareça também nos KPIs

---

## Resumo de arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/AIGenerateButton.tsx` | Modelos Claude atualizados (Opus 4.6, Sonnet 4.6, Sonnet 4.5) |
| `src/components/projeto/ProjetoFinancas.tsx` | AI_MODELS com claude-sonnet-4.6 |
| `src/pages/Skills.tsx` | SelectItem atualizado para claude-sonnet-4.6 |
| `src/pages/Leads.tsx` | Filtro "Ontem" + "Personalizado" visível nos KPIs |

