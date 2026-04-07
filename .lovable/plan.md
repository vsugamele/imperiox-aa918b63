

# Plano: Corrigir Badge ref + Ajustar stale card no WaHubQrPanel

## Analise do estado atual

Dos 4 itens solicitados, a maioria ja esta implementada:

- **Item 2** (resetSession no hook): ja existe (linha 225-272 do useWaSession.ts), com exatamente o fluxo pedido.
- **Item 3** (botao Limpar Sessao): ja existe no painel (linhas 252-261), com toast e condicao de visibilidade correta.
- **Item 4** (garantias): fluxo ja funciona corretamente.

O que falta de fato:

### 1. Badge: converter para forwardRef

O `badge.tsx` usa `function Badge(...)` sem forwardRef. Isso causa warnings no React quando componentes pai tentam passar ref (ex: dentro de Collapsible, Tooltip, etc.).

**Mudanca**: Reescrever usando `React.forwardRef<HTMLDivElement, BadgeProps>` e adicionar `displayName`.

### 2. Stale card: adicionar "Limpar Sessao" como opcao

No card de sessao travada (stale, linhas 194-199), so tem "Nova Session Key" e "reinicie o worker". Falta o botao "Limpar Sessao" ali tambem, conforme solicitado.

**Mudanca**: Adicionar botao `handleResetSession` no card stale, antes do "Nova Session Key".

### 3. Payload do reset: adicionar `source: "ui"`

O reset atual envia `{ project }` no payload. O pedido especifica `{ source: "ui" }`. Vou incluir ambos: `{ project, source: "ui" }`.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/ui/badge.tsx` | forwardRef + displayName |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Botao "Limpar Sessao" no card stale |
| `src/hooks/useWaSession.ts` | Adicionar `source: "ui"` no payload do reset |

