

# Plano: Fix payload.project no Hub Local

## Problema

O hook `useWaSession` usa `project = "default"` como fallback (linha 13), e o `WaHubQrPanel` não passa `project` ao hook. O worker recebe `payload.project = "default"` e o endpoint QR retorna 400 porque só aceita `forex`, `igaming`, `eu`.

## Solução

### 1. `WaHubQrPanel.tsx` — Adicionar seletor de projeto

- Adicionar um `<Select>` com as opções `igaming`, `forex`, `eu`
- Default: `igaming`
- Passar `project` para o hook `useWaSession`

### 2. `useWaSession.ts` — Mudar fallback

- Linha 13: trocar `project = "default"` para `project = "igaming"`

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/hooks/useWaSession.ts` | Fallback de `"default"` para `"igaming"` |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Seletor de projeto (igaming/forex/eu), passar ao hook |

