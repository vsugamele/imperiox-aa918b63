

# Plano: Filtro por Periodo na Tabela + CSV inteligente

## Situacao atual

- **Projeto**: filtro ja existe na sidebar (funciona)
- **Produto**: filtro ja existe na sidebar (funciona, via `productFilter`)
- **Periodo**: so filtra os analytics/KPIs (`periodLeads`), NAO filtra a tabela principal (`filtered`)
- **CSV**: ja exporta `filtered`, mas como periodo nao filtra a tabela, exporta tudo independente do periodo selecionado
- **Nome do arquivo CSV**: generico (`leads_2026-04-06.csv`), nao reflete os filtros aplicados

## Mudancas

### 1. Aplicar filtro de periodo na tabela principal

No bloco `filtered` (linha 410), adicionar check de data usando `periodRange`:

```typescript
const matchDate = (() => {
  if (!l.criado_em) return true;
  try {
    const d = parseISO(l.criado_em);
    return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to });
  } catch { return true; }
})();
return matchSearch && matchStatus && matchPlatform && matchProject && matchStage && matchProduct && matchDate;
```

### 2. Adicionar coluna Produto no CSV

Incluir "Produto" nos headers do CSV e buscar o produto da venda associada ao lead para cada linha exportada.

### 3. Nome do CSV refletir filtros ativos

Mudar o filename para incluir projeto/produto/periodo quando filtrados:

```
leads_ProjetoX_ProdutoY_2026-03-01_2026-04-06.csv
```

### 4. Adicionar seletor de periodo na toolbar da tabela

Mover ou duplicar o seletor de periodo (que ja existe nos analytics) para a toolbar da tabela, ao lado do Export CSV, para que o usuario tenha controle visual direto do filtro temporal.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/Leads.tsx` | Aplicar `periodRange` no `filtered`, adicionar produto no CSV, nome dinamico, seletor de periodo na toolbar |

## Ordem

1. Integrar `periodRange` no filtro `filtered`
2. Adicionar seletor de periodo na toolbar
3. Enriquecer CSV com produto + nome dinamico

