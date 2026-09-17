# MemoFlow X1 na Imperio

Data: 2026-08-24
Status: implementado como motor deterministico + Edge Function.

## Arquivos

- `supabase/functions/_shared/memoflow-x1-engine.ts`
- `supabase/functions/memoflow-x1-agent/index.ts`
- `src/test/memoflow-x1-engine.test.ts`

## Objetivo

Transformar o playbook MemoFlow X1 em uma arvore executavel para Direct, Messenger, WhatsApp ou webchat.

O motor decide:

- angulo de entrada;
- dor principal;
- comprador;
- objecao;
- risco medico;
- temperatura;
- proxima etapa do script;
- resposta pronta;
- eventos para tracking;
- dados CRM capturados;
- follow-up recomendado.

## Endpoint

```http
POST /functions/v1/memoflow-x1-agent
Content-Type: application/json
```

Body minimo:

```json
{
  "message": "Isso e golpe? Vi anuncio fake",
  "channel": "instagram",
  "ad_angle": "anti_scam",
  "checkout_url": "https://checkout..."
}
```

Body com estado:

```json
{
  "message": "me manda o link",
  "channel": "messenger",
  "checkout_url": "https://checkout...",
  "state": {
    "stage": "offer",
    "entry_angle": "lithium",
    "buyer": "self",
    "pain": "word_recall",
    "temperature": "warm",
    "checkout_sent": false
  }
}
```

Resposta:

```json
{
  "ok": true,
  "reply": "...",
  "action": "continue|safe_pause|checkout|followup",
  "state": {},
  "events": [],
  "crm_patch": {},
  "followup": null,
  "compliance": { "safe": true, "reason": null }
}
```

## Eventos

Eventos retornados pelo motor:

- `LeadIntentDetected`
- `PainIdentified`
- `CRMSoftIdentityCaptured`
- `CRMContactCaptured`
- `ConsentCaptured`
- `MechanismDelivered`
- `ProofDelivered`
- `SafetyFlagged`
- `CheckoutSent`

## Regra de compliance

Quando ha diagnostico, medicamento, Alzheimer/demencia ou duvida medica, o motor retorna:

```json
{
  "action": "safe_pause",
  "compliance": { "safe": false, "reason": "medical_or_support_risk" }
}
```

Nesse caso, a automacao nao deve enviar checkout.

## Proximo encaixe

1. Direct/Messenger webhook chama `memoflow-x1-agent` quando `project/tag/funnel = memoflow_x1`.
2. WhatsApp/webchat fazem o mesmo quando o lead estiver nesse funil.
3. Persistir `state` no metadata da conversa ou lead.
4. Gravar `events` em `imphq_events` ou na tabela de tracking usada pelo canal.
5. Agendar `followup` quando vier `followup.delay_minutes`.
