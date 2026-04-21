

## Fix: não consigo trocar coluna em alguns cards

### Causa
Em `CardDetailPanel.tsx` (linha 405-407), o select de coluna usa:
```ts
columns.filter(c => c.board === card.board)
       .filter((c, i, arr) => arr.findIndex(x => x.title === c.title) === i)
```

Dois problemas:
1. **Dedup por título**: se o board tem 2 colunas com mesmo nome (ex: duas "feito"), mantém só uma → a coluna real do card pode sumir da lista, então o Select não consegue casar `value={columnId}` e fica travado.
2. **Board órfão**: cards com `board` que não tem colunas (ex: criados antes de board ser deletado, ou board "experts"/"geral" virtual) ficam com lista vazia → Select não abre opções.

Resultado: o Select renderiza, mas sem itens válidos ou sem o item atual → trocar não funciona / fica em branco.

### Solução

**`src/components/kanban/CardDetailPanel.tsx`**

1. Remover o dedup por título — mostrar todas as colunas reais com sufixo se houver duplicata (ex: "feito (2)").
2. Fallback: se `boardColumns` ficar vazio para o `card.board`, exibir todas as colunas de todos os boards agrupadas, permitindo mover entre boards no mesmo Select.
3. No `handleColumnChange`, ao trocar de coluna, atualizar também o campo `board` do card para o board da coluna destino (evita inconsistência futura).
4. Garantir que a coluna atual do card (`card.column_id`) sempre apareça na lista, mesmo que pertença a outro board (injetar como item extra rotulado "atual").

### Detalhes técnicos
- Agrupar opções por `board` usando `<SelectGroup>` quando houver fallback multi-board.
- Adicionar log `console.warn` quando `card.board` não tiver colunas (debug futuro).
- Sem migrations.

### Fora de escopo
- Limpeza de boards órfãos no banco (pode virar próxima fase).

