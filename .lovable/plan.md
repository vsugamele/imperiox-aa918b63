## Problema

Existem 2 providers Evolution ativos para o projeto `jp_freitas`:
- `cd3bbdb5-059e-4f79-bec6-a978ddb5fa38` → instance_name `JP Freitas` (não existe mais no servidor Evolution → 404)
- `6effd737-7c2d-4ff2-adce-fcdbb5b81a47` → instance_name `jpfreitas` (ativa, funcionando)

A UI/automações estão selecionando o provider errado em alguns fluxos → erro `The "JP Freitas" instance does not exist`.

## Solução

**Migration única** que limpa o provider obsoleto com cascata (mesmo padrão já usado em `whatsapp-api/index.ts` action `delete_instance`):

```sql
-- 1. Apagar mensagens das conversas desse provider
DELETE FROM imphq_wa_messages
WHERE conversation_id IN (
  SELECT id FROM imphq_wa_conversations
  WHERE provider_id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38'
);

-- 2. Apagar conversas
DELETE FROM imphq_wa_conversations
WHERE provider_id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38';

-- 3. Apagar instances (QR/sessões)
DELETE FROM imphq_wa_instances
WHERE provider_id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38';

-- 4. Apagar o provider obsoleto
DELETE FROM imphq_wa_providers
WHERE id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38';
```

Resultado: sobra só o `jpfreitas` ativo e correto. O dropdown de "Sessão" no envio passa a mostrar uma única opção válida.

## Fora de escopo

- Não mudar código de envio (já está correto, era dado sujo)
- Não tocar no provider `jpfreitas` que está saudável
- Histórico de conversas do provider antigo será perdido (não recuperável, já que a instância nem existe mais no Evolution)

## Alternativa (se quiser preservar histórico)

Em vez de DELETE, fazer `UPDATE imphq_wa_providers SET is_active=false WHERE id='cd3bbdb5...'` — mas isso mantém conversas órfãs aparecendo na lista.

**Recomendado: DELETE com cascata.** Confirma?
