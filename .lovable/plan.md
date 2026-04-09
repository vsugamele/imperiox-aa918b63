

# Plano: Corrigir bugs restantes da maquina de estados + atualizar HubGuide

## Bugs encontrados no codigo atual

### Bug 1: `!qrAvailable` vs `qrAvailable === false`
Linha 230: `sessionStatus === "connected" && !qrAvailable` — quando `qrAvailable` e `undefined` (worker nao enviou o campo), `!undefined` e `true`. Isso faz o front mostrar "Conectado" mesmo sem confirmacao de que nao ha QR pendente.

**Fix**: trocar `!qrAvailable` por `qrAvailable !== true` nao resolve. O correto e exigir `qrAvailable === false` (strict) ou unificar com a checagem da linha 227.

### Bug 2: `qrAvailable === true` mas `hasRealQr === false`
Quando o worker seta `qrAvailable: true` mas a imagem ainda nao chegou (payload parcial), nenhuma condicao pega esse caso. Cai no fallback (awaiting_qr ou stale). Deveria mostrar "awaiting_qr" com indicacao de que o QR esta a caminho.

### Bug 3: Check inicial no mount sobrescreve
Linha 66: se `wa_hub_iso_sessions.status === "connected"`, seta `uiStatus("connected")` imediatamente. Depois, quando o usuario clica "Gerar QR" e o worker retorna `qrAvailable: true`, o polling pode nao rodar porque o `startGetQr` auto-reset so checa `stale`/`error`, nao `connected`.

### Bug 4: Polling para em `qr_ready`
Linha 253: `shouldStop` inclui `qr_ready`. Isso significa que depois de mostrar o QR, o polling para e nunca detecta a transicao para `connected` apos o usuario escanear.

## Solucao

### `useWaSession.ts` — 4 fixes

1. **Unificar checagem connected**: trocar linha 230 de `!qrAvailable` para `qrAvailable === false` (strict). Se qrAvailable for undefined, nao assumir connected.

2. **Adicionar caso `qrAvailable === true && !hasRealQr`**: entre linhas 223-224, adicionar:
```
else if (qrAvailable === true && !hasRealQr) {
  nextUi = "awaiting_qr"; // QR sinalizado mas imagem nao chegou ainda
}
```

3. **Nao parar polling em `qr_ready`**: remover `qr_ready` do `shouldStop`. Continuar polling para detectar `connected` apos scan. Adicionar `qr_ready` com um timeout maior (ex: 120s) para nao ficar infinito.

4. **Auto-reset de `connected` no `startGetQr`**: adicionar `connected` a lista de estados que fazem auto-reset antes de gerar novo QR (linha 78).

### `WaHubQrPanel.tsx` — Ajuste menor
- Mostrar botao "Limpar Sessao" tambem quando `uiStatus === "idle"` e `sessionRawStatus === "connected"` (caso mount detectou sessao antiga).

### `HubGuide.tsx` — Atualizar documentacao
Atualizar para refletir:
- Nova maquina de estados (6 estados: idle, resetting, pending/starting, awaiting_qr, qr_ready, connected, stale, error)
- Regra de prioridade: QR > connected
- Novo fluxo de reset
- Polling continua apos QR para detectar scan

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useWaSession.ts` | Fix 4 bugs: strict qrAvailable check, caso qrAvailable sem imagem, polling continua em qr_ready, auto-reset de connected |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Botao reset visivel quando sessao antiga detectada |
| `src/components/whatsapp/HubGuide.tsx` | Atualizar guia com nova maquina de estados e regras |

## Ordem

1. Fix maquina de estados (useWaSession.ts)
2. Ajustar visibilidade do botao reset (WaHubQrPanel.tsx)
3. Atualizar HubGuide com nova documentacao

