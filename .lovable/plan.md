

# Plano: Fix QR bugado apos primeiro uso + anti-lixo + debounce

## Problemas identificados

1. **Eventos velhos poluem polling** — Apos reset, o polling ainda le eventos antigos do banco (QR expirado anterior). Nao ha filtro por timestamp.
2. **Sem debounce** — Clicar "Gerar QR" varias vezes cria multiplos comandos em paralelo, confundindo o polling.
3. **Estado "qr_ready" trava** — Apos conectar e depois desconectar, o QR antigo continua em state e o status fica preso.
4. **Sem CTA de retry** — Quando QR nao chega apos timeout, nao ha acao clara pro usuario.

## Solucao

### 1. Anti-lixo: filtro temporal no polling (`useWaSession.ts`)

- Guardar `lastResetAt` (timestamp) em ref, atualizado no `resetSession` e no inicio de `startGetQr`
- No polling de eventos, adicionar `.gte("created_at", lastResetAt.toISOString())` para ignorar eventos anteriores ao ultimo reset/inicio
- Isso impede que QR antigo reapareça

### 2. Debounce de comandos (`useWaSession.ts`)

- Adicionar ref `lockRef` (boolean)
- No inicio de `startGetQr`, checar `lockRef.current` — se true, retornar sem fazer nada
- Setar `lockRef = true` ao iniciar, `lockRef = false` quando polling para (connected/error/stale/timeout)
- `resetSession` tambem seta `lockRef = false`

### 3. Reset limpa estado de QR completamente (`useWaSession.ts`)

- Ja esta implementado mas falta limpar o timer de polling ativo de uma sessao anterior que pode estar rodando em background
- Garantir que `clearTimer()` e chamado ANTES de qualquer operacao no `resetSession` (ja esta, manter)

### 4. CTA "Limpar e tentar de novo" no awaiting_qr com timeout (`WaHubQrPanel.tsx`)

- Quando `uiStatus === "awaiting_qr"` e ja passaram 30s+ (usar `diagnostics.pollCount * 2.5s > 30`), mostrar botao "Limpar Sessao e tentar de novo" dentro do card de awaiting
- No card de `qr_ready`, se o QR ja esta la ha muito tempo, mostrar botao de refresh

### 5. Fluxo pos-reset: auto-idle limpo

- Apos `resetSession`, o estado volta a `idle` com todos os campos null — ja implementado
- Garantir que `canGenerateQr` retorna `true` quando `idle` — ja funciona

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useWaSession.ts` | Adicionar `lastResetAtRef` + filtro `.gte("created_at")` no polling de eventos + `lockRef` para debounce + limpar lock no reset/stop |
| `src/components/whatsapp/WaHubQrPanel.tsx` | CTA "Limpar e tentar de novo" no card awaiting_qr apos 30s + mostrar resetButton em mais estados |

## Ordem

1. Hook: adicionar refs (lastResetAt, lock)
2. Hook: filtro temporal no polling
3. Hook: debounce com lock
4. Painel: CTA de retry no awaiting_qr

