

# Plano: Setup de Integração com Campos de Configuração Reais

## Situação atual

Os cards de integração hoje têm apenas status (Pendente/Configurado/Verificado) e um campo genérico "Observação". Não há campos reais para inserir IDs, tokens ou URLs -- o usuário precisa ir a outra aba para configurar.

## Decisão: Por projeto (não por produto)

Integrações como Clarity, GA4, Pixel, Resend e Webhooks são configurações de **infraestrutura do projeto** (um Pixel por projeto, um GA4 por projeto). Os produtos herdam essas configs. Manter por projeto faz mais sentido -- o que muda por produto é apenas o **link do checkout** e **webhook específico da plataforma**, que já existem nas Ofertas.

---

## O que muda

Cada card de integração ganha **campos específicos** de configuração. Quando um campo está vazio, aparece um placeholder explicando exatamente o que preencher e onde encontrar o dado.

| Integração | Campos | Placeholder/Ajuda |
|---|---|---|
| **Microsoft Clarity** | `clarity_id` | "Ex: abc123xyz — Encontre em clarity.ms → Settings → Overview" |
| **Google Analytics** | `ga4_measurement_id` | "Ex: G-XXXXXXXXXX — GA4 → Admin → Data Streams" |
| **Webhook Pagamento** | URL gerada (read-only) + `webhook_secret` | URL auto-gerada com project ID, secret para validação |
| **Facebook Pixel / CAPI** | `pixel_id`, `access_token`, `test_event_code` | Links para Events Manager, passo-a-passo |
| **Resend (Email)** | `resend_api_key`, `from_email` | "Encontre em resend.com → API Keys" |
| **UTMs no Site** | `base_url` | "URL base do site para geração de UTMs" |

### Comportamento
- Se todos os campos obrigatórios de um card estão preenchidos → status muda automaticamente para "Configurado"
- Se vazio → badge "Pendente" com texto "Preencha os dados abaixo"
- Status "Verificado" continua sendo manual (o usuário confirma que testou)
- Dados salvam no JSONB `data.integrations.{key}` do projeto (já usado pelo checklist atual)
- O campo "Observação" continua existindo

### Webhook Pagamento -- URL pronta
- Exibir a URL completa do webhook já montada: `https://{SUPABASE_URL}/functions/v1/webhook-pagamento?project={project.id}`
- Botão de copiar ao lado
- Campo para webhook_secret (token de validação)

---

## Detalhes técnicos

### Estrutura no JSONB `data.integrations`
```text
integrations: {
  clarity: { status, nota, clarity_id },
  google_analytics: { status, nota, ga4_measurement_id },
  webhook_pagamento: { status, nota, webhook_secret },
  facebook_pixel: { status, nota, pixel_id, access_token, test_event_code },
  resend: { status, nota, resend_api_key, from_email },
  utms: { status, nota, base_url }
}
```

Os campos `pixel_id` e `access_token` do Facebook que já existem em `data.facebook_pixel_id` e `data.facebook_access_token` serão lidos como fallback para manter compatibilidade.

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Expandir cada card de integração com campos específicos, placeholders explicativos, auto-status, URL do webhook com botão copiar |

