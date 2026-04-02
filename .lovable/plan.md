

# Plano: Corrigir tela branca + Separar tokens Facebook (CAPI vs Marketing API)

---

## Problema 1: Tela branca

A tela branca no preview é causada pelo proxy de autenticação do ambiente de preview do Lovable. **Teste na URL publicada** (https://imperiox.lovable.app) — lá funciona normalmente. Isso não é um bug do código.

## Problema 2: Onde colocar o token do Graph API Explorer?

Atualmente o sistema usa **um único campo** `facebook_access_token` para tudo (CAPI e Ads Sync). Mas são **tokens diferentes**:

- **Token CAPI**: gerado no Events Manager → Conversions API (envia eventos de conversão)
- **Token Marketing API**: gerado no Graph API Explorer com permissões `ads_read` (puxa gastos, criativos, métricas)

O plano é separar em dois campos distintos.

---

## Alterações

### 1. `src/pages/ProjetoDetalhe.tsx` — FacebookCAPICard

Adicionar um novo campo **"Access Token (Marketing API)"** salvo como `facebook_marketing_token` no `project.data`. O campo existente `facebook_access_token` continua sendo o token CAPI. Inclui:
- Input com toggle de visibilidade (eye/eye-off)
- Helper text: "Gere no Graph API Explorer com permissão ads_read. Usado para puxar gastos e criativos."
- Link direto para o Graph API Explorer

Também corrigir o warning de `forwardRef` envolvendo `FacebookCAPICard` e `WebhooksPagamentoCard` com `React.forwardRef`.

### 2. `supabase/functions/facebook-ads-sync/index.ts` — Usar novo token

Alterar a leitura do token para priorizar `facebook_marketing_token`, com fallback para `facebook_access_token`:

```typescript
const rawToken = project.data?.facebook_marketing_token || project.data?.facebook_access_token || "";
```

### 3. `src/components/projeto/ProjetoFinancas.tsx` — Botão de sync

Atualizar a validação do botão "Sincronizar Facebook" para verificar `facebook_marketing_token` OU `facebook_access_token`, e mostrar mensagem orientando o usuário caso falte o token de Marketing API.

### 4. Indicador de status

No card "Integrações Ativas" (linha 284), adicionar um item "Marketing API" que verifica `facebook_marketing_token`.

---

## Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/ProjetoDetalhe.tsx` | Novo campo `facebook_marketing_token` no card CAPI, forwardRef fix, indicador no status |
| `supabase/functions/facebook-ads-sync/index.ts` | Priorizar `facebook_marketing_token` |
| `src/components/projeto/ProjetoFinancas.tsx` | Validação do novo token no botão sync |

