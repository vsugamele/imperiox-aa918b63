

# Plano: Adaptar Sistema de QR via Command Bus (Supabase)

## Contexto

O clawdbot projetou um sistema de QR Code via "command bus" usando 3 tabelas Supabase (`wa_hub_iso_commands`, `wa_hub_iso_sessions`, `wa_hub_iso_events`) + API routes Next.js + worker local. Este projeto é Vite/React (sem Next.js), então precisa adaptar.

## Arquitetura Adaptada

```text
Frontend (React)                    Supabase                     Worker Local (sua máquina)
─────────────────                   ────────                     ─────────────────────────
                                                                 
useWaSession hook ──insert──> wa_hub_iso_commands (action=get_qr)
                                         │
                                         ▼
                              worker poll (3s) ──> detecta comando pending
                              worker executa bot local (Baileys)
                              worker grava: command.status=done + result
                              worker grava: wa_hub_iso_events (qr_status + qrImageUrl)
                              worker grava: wa_hub_iso_sessions (status=awaiting_qr)
                                         │
useWaSession poll ◄──select──────────────┘
(busca commands + sessions + events diretamente do Supabase client)
```

**Diferença chave**: sem API routes. O frontend usa `supabase.from("wa_hub_iso_*")` diretamente para inserir comandos e ler status. Não precisa de edge function intermediária.

---

## Entregáveis

### 1. Migração SQL — 3 tabelas novas

**`wa_hub_iso_commands`**: fila de comandos
- `id`, `tenant_id`, `session_key`, `action` (get_qr, disconnect, etc.), `payload` (jsonb), `status` (pending/processing/done/error), `error`, `result` (jsonb), `created_at`, `updated_at`

**`wa_hub_iso_sessions`**: estado da sessão
- `id`, `tenant_id`, `session_key`, `status` (awaiting_qr/connected/stopped/error), `last_seen_at`, `updated_at`
- Unique constraint em `(tenant_id, session_key)`

**`wa_hub_iso_events`**: log de eventos (qr gerado, conexão, desconexão)
- `id`, `tenant_id`, `session_key`, `event_type`, `payload` (jsonb), `created_at`

RLS: leitura e escrita para authenticated (o worker usa service_role key, o frontend usa anon com auth).

### 2. Hook `useWaSession.ts`

Adaptação do hook do clawdbot para usar Supabase client direto (sem fetch para API routes):

- `startGetQr()`: insere comando na tabela `wa_hub_iso_commands` com action=`get_qr`
- Polling (2.5s): lê `wa_hub_iso_commands` (status do comando), `wa_hub_iso_sessions` (estado sessão), `wa_hub_iso_events` (QR data)
- Estados UI: `idle` → `pending` → `awaiting_qr` → `connected` (ou `error`)
- Timeout de 90s
- Retorna: `uiStatus`, `qrImageUrl`, `qrText`, `errorMessage`, `canGenerateQr`, `startGetQr`

### 3. Componente `WaHubQrPanel.tsx`

Novo componente visual (separado do QrCodePanel existente que é para Evolution API):
- Botão "Gerar QR" com estados visuais (loading spinner, badge de status)
- Renderiza `qrImageUrl` como imagem, fallback para `qrText` em mono
- Badge de status colorido (pending=amarelo, awaiting_qr=azul, connected=verde, error=vermelho)
- Mensagem de erro amigável
- Design consistente com o tema dark do projeto

### 4. Integração no WhatsAppPage

Adicionar uma nova aba ou seção "Hub Local" no WhatsAppPage que mostra o `WaHubQrPanel` para sessões que usam o worker local (em vez de Evolution API).

---

## Importante

O **worker local** (que roda na sua máquina com Baileys) NÃO é parte deste projeto Lovable — ele é externo. Este plano cria apenas:
- As tabelas no Supabase
- O hook + UI no frontend que lê/escreve nessas tabelas

O worker local precisa ser configurado separadamente para:
1. Poll `wa_hub_iso_commands` com status=pending
2. Executar o bot local
3. Gravar resultados de volta nas tabelas

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| Migration SQL | 3 tabelas: `wa_hub_iso_commands`, `wa_hub_iso_sessions`, `wa_hub_iso_events` |
| `src/hooks/useWaSession.ts` | Hook com polling via Supabase client |
| `src/components/whatsapp/WaHubQrPanel.tsx` | Componente visual QR + status |
| `src/pages/WhatsAppPage.tsx` | Aba/seção "Hub Local" com WaHubQrPanel |

## Ordem

1. Migração SQL (3 tabelas + RLS)
2. Hook useWaSession
3. WaHubQrPanel componente
4. Integração no WhatsAppPage

