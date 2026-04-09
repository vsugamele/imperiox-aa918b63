

# Plano: Fix RLS de templates + Debug envio Evolution API

## 3 problemas encontrados

### 1. Template RLS — `user_id` nao enviado no INSERT

A tabela `imphq_wa_templates` tem RLS com policy `auth.uid() = user_id`. Mas o INSERT na linha 195 de `WhatsAppPage.tsx` **nao inclui `user_id`**. Como `user_id` fica `NULL`, a policy falha porque `auth.uid() != NULL`.

**Fix**: Adicionar `user_id: (await supabase.auth.getUser()).data.user?.id` no insert. Fazer o mesmo no `FlowEditor.tsx` (linha 82).

### 2. Disparo em massa sem contatos

A imagem mostra "Contatos (0/0)" — o `BulkSendDialog` busca leads de `imphq_leads` com telefone preenchido. Se nao ha leads com telefone cadastrado, nao aparece nenhum. Isso nao e bug, e ausencia de dados. Mas podemos melhorar permitindo colar numeros manualmente.

### 3. Evolution API — envio de mensagem

A edge function `whatsapp-api` usa `sendEvolution` com endpoint `/message/sendText/{instance_name}`. Pela imagem a instancia "JP Freitas" esta conectada. Preciso verificar se a URL e API key do provider estao corretas no banco, e checar logs de erro.

## Mudancas

| Arquivo | Mudanca |
|---|---|
| `src/pages/WhatsAppPage.tsx` | Incluir `user_id` no insert de templates |
| `src/components/openflow/FlowEditor.tsx` | Incluir `user_id` no insert de templates |
| `src/components/whatsapp/BulkSendDialog.tsx` | Adicionar campo para colar numeros manualmente |
| `supabase/functions/whatsapp-api/index.ts` | Adicionar logs de debug no sendEvolution para diagnosticar falhas |

## Ordem

1. Fix insert de templates (user_id) — resolve o erro RLS imediatamente
2. Adicionar campo manual de numeros no disparo em massa
3. Testar Evolution API via curl para diagnosticar o envio

