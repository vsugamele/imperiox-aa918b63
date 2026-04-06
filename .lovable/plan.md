

# Plano: Fix QR Code quebrado no Hub Local

## Problema

A imagem do QR aparece como icone quebrado. O status raw mostra `awaiting_qr`, entao o evento `qr_status` foi encontrado e `qrImageUrl` tem valor — mas a `<img>` nao consegue renderizar.

O codigo atual (linha 118) faz:
```typescript
src={qrImageUrl.startsWith("data:") ? qrImageUrl : `data:image/png;base64,${qrImageUrl}`}
```

Isso assume que o payload contem base64 puro ou data URI. Porem, o worker local pode estar enviando o QR em outro formato — por exemplo, uma URL http normal da imagem, ou o campo pode estar com nome diferente no payload (`qr`, `qrcode`, `image`).

## Diagnostico necessario

Antes de corrigir, preciso verificar o que o worker esta salvando no evento `qr_status`. Vou consultar o banco para ver o payload real.

## Fix proposto

### 1. Consultar payload real do evento qr_status no banco

Verificar `wa_hub_iso_events` para a sessao `jpfreitas` e ver o campo `payload` do evento `qr_status`.

### 2. Ajustar o mapeamento no `useWaSession.ts`

Se o campo no payload tiver nome diferente (ex: `qr` em vez de `qrImageUrl`), corrigir linhas 125-126:
```typescript
const img = payload?.qrImageUrl || payload?.qr || payload?.image || null;
```

### 3. Ajustar o `<img>` no `WaHubQrPanel.tsx`

Tornar o src mais robusto para aceitar 3 formatos:
- Data URI completa (`data:image/...`)
- Base64 puro (sem prefixo)
- URL HTTP normal

```typescript
const qrSrc = useMemo(() => {
  if (!qrImageUrl) return "";
  if (qrImageUrl.startsWith("data:")) return qrImageUrl;
  if (qrImageUrl.startsWith("http")) return qrImageUrl;
  return `data:image/png;base64,${qrImageUrl}`;
}, [qrImageUrl]);
```

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useWaSession.ts` | Fallback para nomes alternativos do campo QR no payload |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Src robusto para data URI, base64 e URL HTTP |

