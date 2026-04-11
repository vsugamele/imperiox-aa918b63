

# Plano: Campo Produto na Campanha + Botão IA na Sequência

## 1. Migration — coluna `produto`
```sql
ALTER TABLE imphq_wa_campaigns ADD COLUMN produto text;
```

## 2. CampaignManager.tsx — Campo "Produto" no form
- Adicionar `produto` ao state `form` e ao `Campaign` interface
- Incluir campo Input "Produto" no dialog de criação (entre Nome e Projeto)
- Salvar `produto` no insert e resetar no form
- Passar `produto` e `project_id` como props ao `CampaignStepEditor`

## 3. CampaignStepEditor.tsx — Botão "Gerar com IA"
- Receber `produto` e `projectId` como props
- Importar `AIGenerateButton`
- Em cada step, adicionar botão IA ao lado do label "Mensagem" com:
  - `action="generate_campaign_message"`
  - `extraBody={{ produto, step_order, total_steps, media_type }}`
  - `showMenteSelector={true}`
  - `onResult` → preenche o textarea do step

## 4. Edge Function `openflow-ai` — action `generate_campaign_message`
- Buscar nome da campanha de `imphq_wa_campaigns`
- System prompt: gerar copy persuasiva de WhatsApp para step N de N, produto X, tipo de mídia Y, usando contexto do projeto (briefing, avatar, branding)
- Retornar `{ text: "mensagem gerada" }`

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration (nova) | `ALTER TABLE imphq_wa_campaigns ADD COLUMN produto text` |
| `src/components/whatsapp/CampaignManager.tsx` | Campo produto no form + passar props |
| `src/components/whatsapp/CampaignStepEditor.tsx` | Props + AIGenerateButton por step |
| `supabase/functions/openflow-ai/index.ts` | Handler `generate_campaign_message` |

