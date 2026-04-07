

# Plano: Botao "Limpar Sessao" (Reset) no Hub Local

## Contexto

O worker agora expoe `POST /projects/:id/session/reset` que encerra socket, limpa estado em memoria e apaga a pasta `sessions/<id>`, gravando status `reset`. No front, precisamos de um botao que envie um comando `reset_session` via command bus (mesma logica do `get_qr`) para o worker processar, e tambem limpe os registros antigos das tabelas do Supabase.

## Mudancas

### 1. Hook: adicionar `resetSession` (`useWaSession.ts`)

Nova funcao `resetSession` que:
- Insere comando `reset_session` em `wa_hub_iso_commands` (para o worker captar e executar o reset)
- Deleta os registros de `wa_hub_iso_events` daquela sessao (limpa eventos antigos)
- Atualiza `wa_hub_iso_sessions` status para `reset` (ou deleta o registro)
- Reseta estado local: `uiStatus = "idle"`, limpa `qrImageUrl`, `qrText`, `errorMessage`, `diagnostics`
- Retorna essa funcao no return do hook

### 2. UI: botao "Limpar Sessao" (`WaHubQrPanel.tsx`)

- Adicionar botao "Limpar Sessao" (icone Trash2) ao lado do "Gerar QR"
- Visivel quando `uiStatus` e `stale`, `error`, `connected`, ou `qr_ready` (estados que indicam sessao existente)
- Ao clicar, chama `resetSession()`, mostra toast de confirmacao
- Tambem util no estado `stale` dentro do card de "Sessao Travada" como alternativa ao "Nova Session Key"

### 3. Limpeza no Supabase

O `resetSession` vai:
```
DELETE FROM wa_hub_iso_events WHERE tenant_id = X AND session_key = Y
DELETE FROM wa_hub_iso_commands WHERE tenant_id = X AND session_key = Y AND status IN ('done','success','completed','error')
UPDATE wa_hub_iso_sessions SET status = 'reset' WHERE tenant_id = X AND session_key = Y
```

Isso garante que na proxima vez que clicar "Gerar QR", nao ha lixo de polling anterior.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useWaSession.ts` | Adicionar funcao `resetSession` + expor no return |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Botao "Limpar Sessao" na UI |

