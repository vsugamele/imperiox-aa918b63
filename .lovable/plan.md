

# Plano: Exibir respostas do formulario na Qualificacao + corrigir labels

## Situacao atual

- Os dados **estao sendo salvos** — Bruno Souza tem 15 respostas, o lead teste tem 15 respostas
- Os leads antigos (Fernanda, Ingride, etc.) foram capturados **antes** do fix e nao tem `form_id` nem respostas
- O lead da screenshot provavelmente e um desses leads antigos — por isso a secao "Respostas de Formularios" nao aparece

**Problema de labels**: Bruno foi capturado com o codigo antigo, entao as questions estao como slug tecnico (`voc__cabeleireiroa_profissional_hoje`). O lead teste "0604" ja tem labels legiveis ("Voce e cabeleireiro(a) profissional hoje?").

## Mudancas

### 1. Humanizar labels antigos no display

No render das respostas (linha 1541 do `Leads.tsx`), aplicar uma funcao que converte slugs tecnicos em texto legivel quando a `question` parece ser um field_key:

```typescript
const humanize = (q: string) => {
  if (!q.includes("_") || q.includes(" ")) return q;
  return q.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};
```

### 2. Mostrar mensagem quando nao ha respostas

Quando `formResponses.length === 0`, exibir uma mensagem informativa em vez de esconder a secao completamente. Algo como "Nenhuma resposta de formulario registrada para este lead."

### 3. Corrigir retroativamente as labels do Bruno via SQL

Executar um UPDATE nas respostas do Bruno cruzando com a config do formulario para substituir os slugs pelas labels reais.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/Leads.tsx` | Humanizar labels + mostrar secao vazia com mensagem |
| SQL (dados) | Corrigir labels do Bruno retroativamente |

