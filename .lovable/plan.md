## Cores nos cards de conta (Empresa)

Adicionar cor customizável a cada card da grade de "Controle da Empresa" para organização visual (ex: agrupar por operação, cliente, farm).

### Mudanças

1. **Migration** — adicionar coluna `color` (text, nullable) em `imphq_empresa`.

2. **`src/pages/Empresa.tsx`**
   - Novo botão de paleta no header do card (ao lado dos ícones existentes) abrindo `Popover` com `ColumnColorMenu` (já existe em `src/components/kanban/ColumnColorMenu.tsx`, reutilizar).
   - Aplicar a cor escolhida como:
     - Borda esquerda de 3px no card (`borderLeft: 3px solid {color}`)
     - Tint sutil no fundo do card usando `hexToTint(color, 0.06)`
   - Persistir via `update({ color }).eq('id', ...)`.
   - Opção "Sem cor" (limpar) no menu.

3. **Filtro por cor** (leve): chips das cores em uso no topo da grade para filtrar visualmente. Se preferir simples, pulo este item.

### Técnico
- Reusa `ColumnColorMenu` e `hexToTint` já existentes (Kanban).
- Sem breaking changes — coluna nullable, cards antigos ficam sem cor.

Quer com filtro por cor no topo, ou só a marcação nos cards?
