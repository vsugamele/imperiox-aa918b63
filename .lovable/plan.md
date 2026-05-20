## Plano: uma conversa por chip

### 1. Migração (schema + dados)
- Backfill de segurança: para conversas existentes com `provider_id IS NULL`, deduzir a partir da última mensagem (`imphq_wa_messages.provider` + `instance_name`) ou marcar como pertencente ao provider ativo do projeto.
- Remover unique key `(project_id, phone)`.
- Criar unique key `(project_id, phone, provider_id)`.
- Manter índice em `(project_id, phone)` apenas para queries (não único).

### 2. Edge function `whatsapp-api`
- `findOrCreateConversation(phone, projectId, providerId, contactName)`: passar a buscar por `(phone, project_id, provider_id)` em vez de só `(phone, project_id)`; upsert com `onConflict: "project_id,phone,provider_id"`.
- Todos os callers já passam `providerId`, nenhum precisa mudar.
- Para chamadas sem provider conhecido (raras), manter fallback que cria conversa com `provider_id = null` e não conflita com as por chip.

### 3. UI
- Sem mudança estrutural. O mesmo lead aparecerá uma vez por chip na lista — o filtro de chip já existente faz a separação visual.
- A conversa atual `92b89bfd…` (que ficou no chip errado) continuará existindo no jpfreitas; a próxima mensagem do Suporte Oficial criará a thread correta naquele chip.

### 4. Verificação
- Mandar "oi" do mesmo número para os dois chips: devem aparecer duas conversas distintas, cada uma com seu `provider_id`.
- Conferir que a IA responde no chip correto (já usa `providerId` da conversa).

### Fora de escopo
- Mesclar/migrar mensagens antigas que caíram no chip errado.
- Mudar UI da lista de conversas.
