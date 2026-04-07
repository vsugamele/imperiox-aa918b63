

# Plano: Alinhar front com regras do backend QR

## Estado atual

A maioria das regras ja esta implementada:
- Lock por session_key (lockRef) — OK
- Filtro anti-lixo (.gte created_at > lastResetAt) — OK
- Polling so le qr_status mais recente — OK
- CTA "Limpar e tentar de novo" apos 30s — OK
- Reset idempotente com limpeza completa — OK

## O que falta ajustar

### 1. Auto-reset antes de novo pareamento

Quando o usuario clica "Gerar QR" e o status atual e `stale`, `error`, ou `creating_qr` (sessionRawStatus), executar `resetSession()` automaticamente antes de enviar o `get_qr`. Isso evita que o usuario precise clicar "Limpar" manualmente antes de tentar de novo.

### 2. Timeout de QR: 90s → 45s

O `timeoutMs` default e 90s. O backend agora emite `qr_timeout` apos 45s. Ajustar o default para 45s e, no timeout, setar `reset_required: true` nos diagnostics para deixar claro que precisa limpar.

### 3. Ler `connected` do evento qr_status

Alem de checar `sessionRawStatus === "connected"`, tambem checar `payload.connected === true` no evento `qr_status` — o backend agora envia esse campo canonico.

### 4. Priorizar `payload.qrImageUrl` explicitamente

Ja esta implementado, mas reordenar para que `payload.qrImageUrl` seja a PRIMEIRA opcao, antes de `payload.qr` e `payload.image` (ja e assim, apenas confirmar).

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useWaSession.ts` | Auto-reset pre-pareamento, timeout 45s, ler `payload.connected` |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Nenhuma mudanca necessaria (CTA ja existe) |

## Detalhes tecnicos

No `startGetQr`, antes de inserir o comando:
```
if (["stale", "error"].includes(uiStatus) || 
    ["stale", "error", "creating_qr"].includes(sessionRawStatus || "")) {
  await resetSession();
}
```

No polling, adicionar check de `payload.connected`:
```
if (payload?.connected === true) sessionStatus = "connected";
```

Timeout default: `timeoutMs = 45000`

