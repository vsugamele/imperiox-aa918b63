

# Plano: Corrigir cores não aparecendo na paleta

## Problema

Os valores das cores estão salvos sem o prefixo `#` (ex: `ff4400` em vez de `#ff4400`). O CSS `backgroundColor` precisa do `#` para interpretar como hex. Os swatches ficam sem cor porque `ff4400` não é uma cor CSS válida.

## Solução

No `ProjetoBranding.tsx`, garantir que o `backgroundColor` sempre inclua o `#`:

- Na linha 104, trocar `style={{ backgroundColor: c }}` por `style={{ backgroundColor: c.startsWith('#') ? c : '#' + c }}`
- Na linha 109, aplicar a mesma normalização no `input.value` para o color picker funcionar

Também normalizar o valor ao salvar (na função `addColorFromPicker` e `editColorSwatch`), para que novos valores sempre incluam `#`.

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBranding.tsx` | Normalizar hex com `#` no render dos swatches e ao salvar |

