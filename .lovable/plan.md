

# Plano: Atualizar Ticto para Webhook v2 + Flexibilidade de Roteamento

## Problemas Atuais

1. **Parser Ticto desatualizado**: O código detecta Ticto por `body.tipo_evento` e `body.dados` (formato antigo). O v2 envia `version: "2.0"`, `status`, `customer`, `item`, `order`.
2. **Token não validado**: Ticto v2 envia `token` no body. Precisamos validar contra `project.data.ticto_token`.
3. **Roteamento fixo**: Atualmente só funciona com `?project={id}`. O usuário quer opções:
   - Por projeto: `?project={id}` (já existe)
   - Por produto: sem `?project`, o sistema encontra pelo nome do produto
   - Global: um único webhook que atende todos os produtos

## Alterações

### 1. `supabase/functions/webhook-pagamento/index.ts`

**Atualizar parser Ticto para v2:**
- Detectar Ticto v2 via `body.version === "2.0"` ou `body.token` (campo exclusivo)
- Mapear campos corretamente:

```text
v2 field              → campo interno
─────────────────────────────────────
status: "authorized"  → compra_aprovada
status: "abandoned_cart" → carrinho_abandonado
status: "refunded"    → reembolso
status: "waiting_payment" → aguardando_pagamento
customer.email        → email
customer.name         → nome
customer.phone.ddd + number → phone
order.paid_amount / 100  → valor (v2 envia centavos!)
item.product_name     → produto
item.offer_code       → offer_code (para UTMs/tracking)
```

**Validar token Ticto:**
- Após encontrar o projeto, comparar `body.token` com `project.data.ticto_token`
- Se não bater, retornar 401

**Roteamento flexível (já parcialmente existe):**
- Se `?project=` → usa direto (já funciona)
- Se sem `?project=` → busca por `item.product_name` ou `body.data?.product?.name` no `imphq_projects.name` (já existe mas melhorar a busca)
- Armazenar o token do user (`bNw0UrUV...`) no campo `ticto_token` do projeto

### 2. `src/pages/ProjetoDetalhe.tsx` — WebhooksPagamentoCard

Pequena melhoria na UI:
- Adicionar instrução específica para Ticto v2: "Na Ticto, vá em Integrações > Webhooks > Adicione a URL abaixo. O token de segurança enviado no corpo do webhook será validado automaticamente."
- Mostrar que `paid_amount` vem em centavos e será convertido

### 3. Token global do Ticto

O token fornecido (`bNw0UrUV...`) será armazenado no campo `ticto_token` do projeto específico via a UI existente na aba Analytics. Se o usuário quiser um webhook global (sem `?project=`), a busca por nome do produto já funciona — vamos melhorar a heurística de match.

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/webhook-pagamento/index.ts` | Reescrever parser Ticto para v2, validar token, melhorar roteamento |
| `src/pages/ProjetoDetalhe.tsx` | Atualizar instruções do Ticto na UI de webhooks |

