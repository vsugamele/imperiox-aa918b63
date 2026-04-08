

# Plano: Corrigir filtros do Kanban que nao abrem

## Causa raiz

O botao "Filtros" usa `Popover` com `Select` dentro. Quando o usuario clica num `Select` (Prioridade, Projeto, Prazo), o dropdown do Select abre num portal fora do DOM do Popover. Isso dispara o "outside click" do Popover, que fecha imediatamente — parece que nada abre.

## Solucao

Trocar o `Popover` por um `DropdownMenu` nao resolve (mesmo problema). A solucao correta e adicionar `modal={false}` no `PopoverContent` para que cliques em portais filhos (como o Select dropdown) nao fechem o Popover. Alternativamente, adicionar `onInteractOutside` para prevenir o fechamento quando o clique e num portal de Select.

Abordagem concreta: adicionar `onInteractOutside` no `PopoverContent` para ignorar cliques que vem de dentro de um `[data-radix-popper-content-wrapper]` (o portal do Select):

```tsx
<PopoverContent
  className="w-64 space-y-3"
  align="start"
  onInteractOutside={(e) => {
    const target = e.target as HTMLElement;
    if (target?.closest("[data-radix-popper-content-wrapper]")) {
      e.preventDefault();
    }
  }}
>
```

## Arquivo

| Arquivo | Mudanca |
|---|---|
| `src/pages/KanbanPage.tsx` | Adicionar `onInteractOutside` no PopoverContent dos filtros (linha ~616) |

