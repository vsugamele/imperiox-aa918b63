

# Plano: Refatorar maquina de estados do WhatsApp (QR prioritario sobre connected)

## Problema

A logica atual em `useWaSession.ts` (linha 217-218) prioriza `sessionStatus === "connected"` sobre `hasRealQr`. Quando o backend retorna `qrAvailable=true` mas `hasSession=true`, o front mostra "Conectado" em vez do QR. Alem disso, falta o estado `resetting` e o fluxo pos-reset nao e limpo.

## Mudancas

### 1. `useWaSession.ts` — Nova maquina de estados

Adicionar estado `resetting` ao tipo `UiStatus`:
```
"idle" | "pending" | "awaiting_qr" | "qr_ready" | "connected" | "stale" | "error" | "resetting"
```

Nova prioridade de decisao no polling (linhas 212-240):
```
1. isResetting → "resetting"
2. qrAvailable === true && hasRealQr → "qr_ready"  
3. needsQr && !hasRealQr → "awaiting_qr"
4. hasSession && !qrAvailable → "connected"
5. commandFailed → "error"
6. commandDone && !hasRealQr → stale (apos 2 tentativas)
7. pending/processing → "pending"
8. fallback → "awaiting_qr"
```

Regra chave: **se tiver QR, mostra QR — mesmo que hasSession=true ou connected=true**.

No `resetSession`: setar `uiStatus = "resetting"`, aguardar resposta, depois setar `"idle"`.

Usar `qrAvailable` do payload/result como sinal canonico (alem de verificar se a imagem existe).

### 2. `WaHubQrPanel.tsx` — Novo estado visual + botao reset melhorado

- Adicionar render para `uiStatus === "resetting"` (spinner + "Limpando sessao...")
- Mostrar botao "Limpar Sessao" sempre que `hasSession || connected || stale || error || qr_timeout`
- Apos reset: estado visual volta para `idle` com botao "Gerar QR" habilitado
- Adicionar `resetting` ao `statusConfig`

### 3. `WaHubQrPanel.tsx` — canGenerateQr atualizado

Permitir gerar QR tambem no estado `resetting` (apos conclusao) — ja controlado pelo hook.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useWaSession.ts` | Adicionar estado `resetting`, inverter prioridade QR > connected, reset assincrono |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Render do estado `resetting`, ajustar visibilidade do botao reset |

## Ordem

1. Refatorar maquina de estados no hook
2. Atualizar UI do painel

