

# Plano: Criativos no Projeto + Filtros Ads + Atribuição Vendas/Ads + Chat com Imagem e Comandos /

## Contexto dos problemas identificados

1. **Criativos não aparecem no projeto do Jonathan**: O componente `ProjetoFinancas` lê `project.data.facebook_creatives`, mas o `project` prop vem do state do `ProjetoDetalhe.tsx` que carrega uma única vez no mount. Após a sync, o `project.data` não é re-fetched.

2. **Grupos na campanha**: O `fetchGroups` usa endpoint `group/fetchAllGroups` — funciona, mas o provider_id pode ser null. Precisa validar e exibir feedback quando não há provider configurado.

3. **Chat sem envio de imagem nem comandos /**: O `ChatView` atualmente só envia texto. Não há upload de imagem nem detecção de `/` para autocomplete de comandos.

---

## 1. Fix Criativos — Re-fetch project após sync

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx`

- Após o sync do Facebook (onde chama `supabase.functions.invoke("facebook-ads-sync")`), re-buscar o projeto: `supabase.from("imphq_projects").select("*").eq("id", projectId).single()` e atualizar via um callback prop `onProjectUpdate`
- Alternativa simples: adicionar prop `onRefresh` ao `ProjetoFinancas` que chama o reload do `ProjetoDetalhe`

**Arquivo**: `src/pages/ProjetoDetalhe.tsx`

- Passar callback `onRefresh` que re-busca o projeto do DB

## 2. Filtros e Status nas tabelas de Ads

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx`

- Adicionar coluna "Status" na tabela de Ads mostrando badge (ACTIVE verde, PAUSED âmbar, etc.) — os dados `effective_status` já são salvos nos criativos
- Adicionar filtro por `conjunto_anuncios` e `anuncio` na tabela principal de Ads (já existe nos criativos)
- Adicionar campo de busca por nome de campanha

## 3. Atribuição Vendas vs Ads (ROAS Real)

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx`

- No card de KPIs, cruzar `fVendas` (soma de vendas aprovadas) com `fAds` (soma de gastos) para mostrar **ROAS Real** = receita vendas / gasto ads
- Adicionar card "Atribuição" mostrando: total vendas, total ads, ROAS, custo por venda
- Isso já é possível com os dados existentes — basta calcular

## 4. Chat: envio de imagem via upload

**Arquivo**: `src/components/whatsapp/ChatView.tsx`

- Adicionar botão de upload (ícone 📎/Image) no input area
- Ao selecionar arquivo, fazer upload para Supabase Storage (`whatsapp-media` bucket) 
- Chamar a Edge Function com `media_url` e `media_type: "image"`

**Arquivo**: `supabase/functions/whatsapp-api/index.ts`

- No action `send_message`, aceitar campos `media_url` e `media_type`
- Se presente, usar endpoint Evolution `/message/sendMedia` ao invés de `/message/sendText`
- Salvar na DB com `message_type` e `media_url`

## 5. Chat: autocomplete de comandos /

**Arquivo**: `src/components/whatsapp/ChatView.tsx`

- Carregar `imphq_wa_commands` do projeto ativo
- Detectar quando o texto começa com `/` — mostrar dropdown com comandos filtrados
- Ao selecionar, preencher o textarea com o `response_text` do comando
- UI: popup flutuante acima do textarea com lista filtrada

## 6. Campanhas: validação de provider nos grupos

**Arquivo**: `src/components/whatsapp/CampaignManager.tsx`

- No `openGroupSelector`, se `provider_id` é null, mostrar toast de aviso e não abrir o dialog

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/ProjetoDetalhe.tsx` | Callback `onRefresh` para re-fetch do projeto |
| `src/components/projeto/ProjetoFinancas.tsx` | Re-fetch após sync + filtros ads + ROAS real |
| `src/components/whatsapp/ChatView.tsx` | Upload de imagem + autocomplete de comandos / |
| `supabase/functions/whatsapp-api/index.ts` | Suporte a `sendMedia` no action send_message |
| `src/components/whatsapp/CampaignManager.tsx` | Validação provider nos grupos |

