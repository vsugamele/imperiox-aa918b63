

# Plano: OpenFlow — Seletor de Projeto no Editor, Templates de Email + WhatsApp, Mapeamento de Triggers

## Problemas identificados

1. **Falta seletor de projeto no dialog de edição** — o campo `project_id` só é setado na criação, não pode ser alterado depois
2. **Templates não puxam emails do Resend nem WhatsApp** — hoje só puxa `data.emails` e `copy_arsenal`, mas os templates reais estão em `data.email_config.templates` e na tabela `imphq_wa_templates`
3. **Carrinho abandonado e triggers** — o webhook já mapeia corretamente `abandoned_cart` (Ticto), `PURCHASE_ABANDONED` (Hotmart) e `waiting_payment` (Kiwify) para o evento `carrinho_abandonado`. A Ticto envia `pix_created` como parte do fluxo `waiting_payment`/`started` → isso já chega como `aguardando_pagamento` ou `inicio_checkout`. Precisa adicionar esses como triggers disponíveis no OpenFlow

## Alterações

### 1. Seletor de Projeto no dialog de edição (`src/pages/OpenFlow.tsx`)

Adicionar um `Select` de projeto entre Nome e Trigger no dialog de edição (linhas 299-309). Quando o projeto muda, o `useEffect` existente (linha 62) já recarrega os templates.

### 2. Templates expandidos — Email (Resend) + WhatsApp (`src/pages/OpenFlow.tsx`)

No `useEffect` que busca templates (linhas 62-85), expandir para:
- **Email Resend**: ler `data.email_config.templates[]` → cada template tem `subject` e `html_body`
- **WhatsApp**: buscar `imphq_wa_templates` filtrado por `project_id` → cada template tem `name` e `content`
- Manter os templates de `data.emails` e `copy_arsenal` que já existem

### 3. Novos triggers (`src/pages/OpenFlow.tsx` + `src/components/openflow/FlowEditor.tsx`)

Adicionar triggers:
- `aguardando_pagamento` — "Aguardando Pagamento / Pix Gerado" (icon: 💰)
- `inicio_checkout` — "Início de Checkout" (icon: 🛍️)

Isso permite criar automações para quando alguém gera um pix (Ticto `waiting_payment`) mas ainda não pagou.

### 4. Trigger no FlowEditor (`src/components/openflow/FlowEditor.tsx`)

Atualizar `TRIGGERS_MAP` com os 2 novos triggers para exibir corretamente no editor visual.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/OpenFlow.tsx` | Seletor de projeto no editor, templates de email_config + wa_templates, 2 novos triggers |
| `src/components/openflow/FlowEditor.tsx` | Adicionar novos triggers no TRIGGERS_MAP |

