

# Plano: Fix 400 error no OpenFlow — coluna `produto` ausente

## Causa raiz

O `createAutomacao` (linha 141) e `saveAutomacao` inserem/atualizam o campo `produto` na tabela `imphq_automacoes`, mas essa coluna **nao existe** na tabela. O cast `as any` esconde o erro em build-time, mas o PostgREST retorna 400.

A segunda mensagem ("message channel closed") e o erro generico do Preview proxy ao falhar a request — nao e um bug separado.

## Fix

### 1. Migracao SQL — adicionar coluna `produto`

```sql
ALTER TABLE public.imphq_automacoes
  ADD COLUMN IF NOT EXISTS produto text;
```

### 2. Remover casts `as any` desnecessarios

No `OpenFlow.tsx`, remover os `as any` nas chamadas de insert/update agora que o tipo tera a coluna `produto`. Isso restaura a seguranca de tipos.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar coluna `produto` em `imphq_automacoes` |
| `src/pages/OpenFlow.tsx` | Remover `as any` nos insert/update |

