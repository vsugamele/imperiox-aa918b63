

# Plano: Corrigir exibicao de respostas de formulario na Qualificacao

## Causa raiz

A query na linha 372 usa um join embutido do PostgREST:
```
.select("*, imphq_capture_forms(nome)")
```

Porem a tabela `imphq_lead_responses` **nao tem foreign key** para `imphq_capture_forms` (o types.ts mostra `Relationships: []`). O PostgREST retorna erro 400 ou dados vazios, fazendo `formResponses` ficar sempre vazio.

Os dados existem no banco — confirmei 10 respostas para o lead `fb55df1d` com perguntas como "Voce e cabeleireiro(a)?", "Faixa de faturamento", etc.

## Solucao

### 1. Migracaoo SQL: adicionar FK

```sql
ALTER TABLE public.imphq_lead_responses
  ADD CONSTRAINT imphq_lead_responses_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES public.imphq_capture_forms(id)
  ON DELETE SET NULL;
```

Isso permite o join do PostgREST funcionar nativamente.

### 2. Fallback no front (defesa)

Mesmo com a FK, adicionar fallback: se o join retornar sem `imphq_capture_forms`, buscar os nomes dos forms separadamente por `form_id` distinto. Assim, se a FK falhar por qualquer razao, as respostas ainda aparecem.

### 3. Filtrar campos meta da exibicao

Atualmente a `capture-lead` salva `nome`, `email`, `phone` como respostas tambem. Na Qualificacao, filtrar esses campos basicos (ja exibidos na aba Dados) para nao poluir — mostrar apenas as respostas de qualificacao reais.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | FK `imphq_lead_responses.form_id` → `imphq_capture_forms.id` |
| `src/pages/Leads.tsx` | Fallback para buscar nomes de forms sem join + filtrar campos basicos (nome/email/phone) da exibicao |

## Ordem

1. Criar migracao com FK
2. Ajustar query com fallback
3. Filtrar campos meta da lista de respostas

