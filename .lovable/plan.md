

# Plano: Webhooks & Integrações por Projeto

## O Problema

Atualmente as API keys (Hotmart, Ticto, Kiwify) ficam numa config global em `Configuracoes.tsx` salvas em `localStorage`. Mas cada **projeto** pode ter um produto diferente em plataformas diferentes — um projeto vende na Hotmart, outro na Kiwify, etc. As URLs de webhook e tokens de validação precisam ser **por projeto**.

## Solução

Adicionar uma seção **"Integrações & Webhooks"** na aba **Analytics** do `ProjetoDetalhe.tsx` (que já tem Facebook Pixel/CAPI configurados por projeto). Essa seção mostra:

1. **URL de webhook exclusiva** do projeto — já suportada pelo `webhook-pagamento` via `?project={id}`
2. **Tokens de validação por plataforma** — Hotmart hottok, Kiwify secret, Ticto token — salvos em `project.data`
3. **Status de integrações** — indicador visual de quais plataformas estão configuradas

### Dados salvos em `project.data` (JSONB existente):
```
{
  "hotmart_token": "...",       // x-hotmart-hottok esperado
  "kiwify_token": "...",        // secret de validação
  "ticto_token": "...",         // token de validação
  "webhook_platforms": ["hotmart", "kiwify"]  // plataformas ativas
}
```

Não precisa de nova tabela — usa o campo `data` JSONB que já existe em `imphq_projects`.

## Alterações

### `src/pages/ProjetoDetalhe.tsx` — Aba Analytics
Adicionar na aba Analytics (após o card de Facebook Pixel):

- **Card "Webhooks de Pagamento"**:
  - URL do webhook com botão copiar: `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project={id}`
  - URLs específicas por evento: `?project={id}&event=Lead`, `&event=InitiateCheckout`
  - Campos para tokens de validação (Hotmart hottok, Kiwify secret, Ticto token)
  - Instruções curtas de como configurar em cada plataforma

- **Card "Plataformas Ativas"**: Grid visual mostrando Hotmart/Kiwify/Ticto/Outro com status ativo/inativo

### `supabase/functions/webhook-pagamento/index.ts` — Validação por projeto
Adicionar validação opcional do `x-hotmart-hottok` contra o token salvo no projeto (`project.data.hotmart_token`), para segurança.

### `src/pages/Configuracoes.tsx` — Simplificar
Remover Hotmart/Ticto da lista de API keys globais (ficam apenas OpenRouter, OpenAI, Anthropic, Gemini, Meta Ads, PushinPay que são globais). Adicionar nota direcionando para configurar webhooks dentro de cada projeto.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/ProjetoDetalhe.tsx` | Adicionar seção de webhooks na aba Analytics |
| `supabase/functions/webhook-pagamento/index.ts` | Validação de token por projeto |
| `src/pages/Configuracoes.tsx` | Remover Hotmart/Ticto das keys globais |

