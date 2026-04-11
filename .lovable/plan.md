

# Plano: Corrigir busca de grupos via proxy na Edge Function

## Problema

A função `fetchGroups` no `CampaignManager.tsx` (linha 98) faz chamada direta do browser para a Evolution API:
```
fetch(`${apiUrl}/group/fetchAllGroups/...`, { headers: { apikey: ... } })
```
Isso falha por CORS — o browser não pode chamar a Evolution API diretamente.

## Solução

Adicionar action `fetch_groups` na Edge Function `whatsapp-api` e chamar via Supabase no frontend.

### 1. Edge Function — `supabase/functions/whatsapp-api/index.ts`

Adicionar handler para `action === "fetch_groups"`:
- Recebe `provider_id` no body
- Busca o provider no banco (já existe helper `getProvider`)
- Faz fetch server-side para `${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`
- Retorna array de `{ id, subject }`

### 2. Frontend — `src/components/whatsapp/CampaignManager.tsx`

Alterar `fetchGroups` (linha 93-112) para chamar a Edge Function via `supabase.functions.invoke("whatsapp-api", { body: { action: "fetch_groups", provider_id } })` em vez de fetch direto.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | Novo handler `fetch_groups` |
| `src/components/whatsapp/CampaignManager.tsx` | Trocar fetch direto por chamada à Edge Function |

