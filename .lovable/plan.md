

# Plano: Enriquecer integração Evolution na ImperioHQ

## Problema atual

1. A sessão existe e aparece no app (1 card), mas com 0 mensagens porque o envio falhou (número inválido no WhatsApp)
2. Existem 2 providers duplicados para o mesmo projeto — causa confusão visual (2 badges "🟢 JP Freitas")
3. A Evolution pode ter contatos e conversas reais, mas o app não puxa esses dados automaticamente
4. Não há visão do status real da instância Evolution (conectada? desconectada? número vinculado?)

## Mudanças propostas

### 1. Limpar providers duplicados e prevenir duplicatas futuras

- Remover o provider mais antigo via migration (DELETE do `cf701693`)
- Adicionar constraint UNIQUE em `(project_id, provider, instance_name)` para evitar duplicatas

### 2. Painel de status da instância Evolution

Na página WhatsApp, acima das sessões, exibir um card com:
- Status real da instância (chamando `GET /instance/connectionState/{instanceName}` na Evolution)
- Número conectado
- Botão "Sincronizar contatos" para importar conversas existentes

Isso será feito via a edge function `whatsapp-api` com uma nova action `instance_status` que consulta a Evolution API.

### 3. Action "sync_contacts" na edge function

Nova action POST que:
- Chama `GET /chat/findContacts/{instanceName}` na Evolution API
- Para cada contato encontrado, cria/atualiza um registro em `imphq_wa_conversations`
- Retorna quantos contatos foram importados

### 4. Action "instance_status" na edge function

Nova action GET que:
- Chama a Evolution API para obter `connectionState` e `fetchInstances`
- Retorna: status (open/close/connecting), número vinculado, nome da instância

### 5. UI: Card de status + botão de sync

No topo da aba "Sessões", antes da lista de conversas:
- Card mostrando "🟢 Conectado — +55 11 99999-9999" ou "🔴 Desconectado"
- Botão "Sincronizar Contatos" que chama `sync_contacts`
- Empty state melhorado: "Instância conectada! Sincronize seus contatos ou crie uma nova sessão."

## Arquivos envolvidos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | Novas actions: `instance_status`, `sync_contacts` |
| `src/pages/WhatsAppPage.tsx` | Card de status da instância + botão sync |
| `supabase/migrations/*` | Limpar provider duplicado + unique constraint |

## Fora do escopo (próximos passos)

- Automações de grupos WhatsApp
- Integração com funis (vincular etapa do funil a template de mensagem)
- Webhook para receber mensagens inbound automaticamente

Essas features podem ser construídas depois que a base de dados de conversas estiver populada e funcional.

