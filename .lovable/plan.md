## Diagnóstico

O JP Freitas hoje tem **1 só provider** cadastrado (`jpfreitas`, Evolution). A boa notícia é que a arquitetura WhatsApp do Império **já é multi-chip por design**:

- `imphq_wa_providers` aceita N instâncias por `project_id`
- `imphq_wa_sessions.provider_id` já amarra cada conversa ao chip de origem
- `ConversationList` já tem filtro `filterProvider` + badge de cor por provider
- `WhatsAppPage` já agrupa avatares por `provider_id`
- Envio (`send_message`) já tem failover automático entre chips (v2)

Ou seja: **não precisa migration nem código novo de backend**. O trabalho é operacional + 2 ajustes finos de UX pra evitar confusão.

## O que fazer

### 1. Cadastrar o 2º chip (operacional, sem código)
- Em `/whatsapp` no projeto JP Freitas → **+ Nova instância** → criar `jpfreitas2` (ou nome que faça sentido: `jp-suporte`, `jp-vendas`)
- Conectar via QR Code o segundo número
- Marcar `is_active = true` nos dois

### 2. Ajustes de UX no chat (código)

**a) Renomear providers com label amigável**
Adicionar campo `display_name` opcional em `imphq_wa_providers` (ex: "Suporte 1", "Suporte 2") e exibir esse rótulo em vez de `instance_name` na lista de conversas, no header do chat e no filtro. Hoje aparece `jpfreitas` cru, o que confunde quando vier `jpfreitas2`.

**b) Abas/Tabs no topo do chat**
Acima da `ConversationList`, adicionar tabs: **Todos · Suporte 1 · Suporte 2**, com contador de não-lidas por chip. Hoje existe um Select de filtro escondido — tabs deixam óbvio de qual número é cada conversa.

**c) Badge de cor sempre visível no header da conversa aberta**
No `ChatView`, mostrar no topo "Atendendo via: 🟢 Suporte 1" para o atendente nunca responder pelo chip errado. Já existe a cor estável por `provider_id` — só falta puxar pro header.

**d) Ao enviar manual, travar o chip de origem da última msg recebida**
Hoje o envio escolhe provider via failover. Pra atendimento humano isso é ruim — se o lead falou no Suporte 1, a resposta tem que sair do Suporte 1. Adicionar regra: se a conversa tem `provider_id` definido, força aquele chip no envio manual (failover continua valendo só pra disparo em massa/automação).

### 3. Memória
Atualizar `mem://features/whatsapp/v2-failover-and-commands` registrando a regra "envio manual respeita provider_id da sessão; failover só em automação/massa".

## Arquivos afetados

```text
supabase/migrations/...        — ADD COLUMN display_name (opcional)
src/components/whatsapp/ConversationList.tsx   — tabs + label amigável
src/components/whatsapp/ChatView.tsx           — badge no header + lock provider no envio manual
src/pages/WhatsAppPage.tsx                     — exibir display_name
```

## Fora de escopo
- Roteamento automático por função (vendas x pós-venda) — fica pra depois se quiser
- Distribuidor de leads entre os 2 chips — já existe em `Smart Group Links`, não precisa mexer agora
