

# Plano: Fix QR Code nao aparecendo

## Causa raiz

Dois problemas no `useWaSession.ts`:

1. **`needsQr` nao significa QR disponivel** — O campo `needsQr: true` no payload indica que a sessao *precisa* de um QR, nao que ele *esta disponivel*. O codigo usa `needsQr` na checagem `hasQr`, o que faz o `mapStatus` retornar `awaiting_qr` mesmo quando `qrAvailable: false` e `qrImageUrl: null`. Resultado: badge mostra "QR Disponivel" mas nenhuma imagem aparece.

2. **Command result ignorado** — O `result` do comando contem `qr.qrImageUrl` quando disponivel, mas o polling so extrai QR dos *events*. Nos eventos recentes, `qrImageUrl` e null, mas em comandos mais antigos o QR estava no result.

## Fix

### 1. Corrigir `hasQr` no polling (`useWaSession.ts`)

Remover `needsQr` da checagem de `hasQr`. Usar apenas `qrAvailable` (que e `true` somente quando o worker realmente gerou o QR):

```ts
const hasQr = Boolean(payload?.qrAvailable);
```

### 2. Extrair QR tambem do command result

Apos buscar o comando, verificar se `cmd.result?.qr?.qrImageUrl` existe e usar como fallback:

```ts
const cmdQrImg = cmd?.result?.qr?.qrImageUrl || null;
const cmdQrTxt = cmd?.result?.qr?.qrText || null;
if (cmdQrImg) setQrImageUrl(cmdQrImg);
if (cmdQrTxt) setQrText(cmdQrTxt);
```

### 3. UI: estado intermediario quando `awaiting_qr` sem imagem

No `WaHubQrPanel.tsx`, adicionar um caso para `awaiting_qr` sem QR disponivel — mostrar spinner com mensagem "Aguardando worker gerar QR..." em vez do placeholder "Clique em Gerar QR". Isso evita confusao quando o badge diz "QR Disponivel" mas nada aparece.

Reorganizar a logica de render:
- `pending` → spinner "Aguardando worker"
- `awaiting_qr` + sem imagem → spinner "Worker respondeu, gerando QR..."
- `awaiting_qr` + com imagem → mostrar QR
- `connected` → checkmark
- `error` → erro

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useWaSession.ts` | Corrigir `hasQr` (remover needsQr) + extrair QR do command result |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Novo estado visual para `awaiting_qr` sem imagem |

