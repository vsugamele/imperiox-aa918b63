

# Plano: WhatsApp Avançado — Multi-Provider (Evolution API + Twilio)

## Arquitetura

O sistema será construído com uma **camada de abstração** que suporta ambos os providers. O usuário configura qual provider usar por projeto.

```text
┌─────────────────────────────────────────┐
│           Frontend (WhatsApp Page)       │
│  - Enviar mensagem   - Ver conversas     │
│  - QR Code (Evolution) - Templates       │
│  - Disparo em massa  - Histórico         │
└──────────────┬──────────────────────────┘
               │ supabase.functions.invoke()
               ▼
┌─────────────────────────────────────────┐
│     Edge Function: whatsapp-api         │
│  - POST ?action=send_message            │
│  - POST ?action=send_bulk               │
│  - GET  ?action=qr_code (Evolution)     │
│  - GET  ?action=session_status          │
│  - POST ?action=webhook (receber msgs)  │
│  Provider routing via config no DB      │
└──────┬──────────────┬───────────────────┘
       │              │
       ▼              ▼
┌────────────┐  ┌──────────────────┐
│ Evolution  │  │ Twilio Gateway   │
│ API (VPS)  │  │ (connector)      │
│ URL+Key    │  │ LOVABLE_API_KEY  │
└────────────┘  └──────────────────┘
```

## 1. Banco de Dados — Novas Tabelas + Alterações

### Tabela `imphq_wa_providers` (Nova)
Armazena as configurações de cada provider WhatsApp por projeto.

```sql
CREATE TABLE imphq_wa_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('evolution', 'twilio')),
  instance_name TEXT,          -- nome da instância (Evolution)
  api_url TEXT,                -- URL da Evolution API
  api_key TEXT,                -- API Key da Evolution
  twilio_from TEXT,            -- número Twilio (ex: +5511999...)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `imphq_wa_messages` (Nova)
Histórico de mensagens enviadas e recebidas.

```sql
CREATE TABLE imphq_wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outgoing', 'incoming')),
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  message_type TEXT DEFAULT 'text',
  provider TEXT,
  provider_message_id TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Alteração em `imphq_wa_conversations`
Adicionar campo `provider_id` para vincular ao provider configurado.

## 2. Edge Function: `whatsapp-api`

Uma Edge Function unificada com routing por `action`:

| Action | Método | Provider | Descrição |
|---|---|---|---|
| `send_message` | POST | Ambos | Envia mensagem de texto para um número |
| `send_bulk` | POST | Ambos | Disparo em massa para lista de números |
| `qr_code` | GET | Evolution | Busca QR Code real da instância |
| `session_status` | GET | Evolution | Status da conexão WhatsApp |
| `create_instance` | POST | Evolution | Cria nova instância no Evolution |
| `webhook` | POST | Ambos | Recebe mensagens/status via webhook |

### Evolution API — Endpoints usados:
- `POST /message/sendText/{instance}` — enviar texto
- `GET /instance/connect/{instance}` — obter QR Code
- `GET /instance/connectionState/{instance}` — status
- `POST /instance/create` — criar instância

### Twilio — Via connector gateway:
- `POST /Messages.json` — enviar mensagem WhatsApp (`whatsapp:+55...`)

### Secrets necessários:
- **Evolution**: `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` (adicionados via secrets tool)
- **Twilio**: Conector Twilio já disponível no Lovable (a conectar)

## 3. Frontend — Melhorias na Página WhatsApp

### Novas funcionalidades na UI:

**a) Configuração de Provider (por projeto)**
- Dialog para configurar Evolution API (URL + API Key + Instance Name) ou Twilio (número from)
- Salva em `imphq_wa_providers`

**b) QR Code Real (Evolution)**
- Quando provider = Evolution, buscar QR Code real via Edge Function
- Polling a cada 5s para atualizar status da conexão
- Indicador visual: Conectado / Desconectado / Aguardando QR

**c) Envio de Mensagens**
- Campo de texto + botão enviar na tela de detalhe da sessão
- Histórico de mensagens (chat view) puxando de `imphq_wa_messages`
- Suporte a envio de mídia (imagem/PDF via URL)

**d) Disparo em Massa**
- Botão "Disparar para Lista" que abre dialog
- Seleção de contatos da base de leads (`imphq_leads`)
- Template de mensagem com variáveis (`{{nome}}`, `{{projeto}}`)
- Delay entre mensagens (anti-ban) configurável
- Log de envios com status por número

**e) Inbox / Chat View**
- Visualização estilo chat (bolhas) do histórico de mensagens
- Mensagens recebidas via webhook aparecem em tempo real
- Filtro por projeto/contato

## 4. Webhook para Receber Mensagens

A Edge Function `whatsapp-api` com `action=webhook` recebe callbacks do Evolution/Twilio:
- Salva mensagem recebida em `imphq_wa_messages` com `direction = 'incoming'`
- Atualiza `message_count` em `imphq_wa_conversations`
- Pode disparar automação via `imphq_automacoes` (futuro)

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | `imphq_wa_providers`, `imphq_wa_messages`, alter `imphq_wa_conversations` |
| `supabase/functions/whatsapp-api/index.ts` | Edge Function multi-provider |
| `supabase/config.toml` | Registrar `whatsapp-api` |
| `src/pages/WhatsAppPage.tsx` | Reescrever com: config provider, chat view, envio, disparo em massa, QR real |

## Pré-requisitos do Usuário

- **Evolution API**: Ter uma instância rodando em VPS (Docker). Fornecer URL + API Key.
- **Twilio**: Conectar o conector Twilio no Lovable e ter número WhatsApp Business verificado.

