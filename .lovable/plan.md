# Plano — WhatsApp v2

Quatro entregas independentes na página `/whatsapp`.

## 1. Filtro de Chat por Sessão (sem migration)

**Problema:** com vários chips, conversas/templates/comandos viram um caldeirão.

**Solução:** manter tudo global (sem mexer em schema), mas adicionar **filtro de sessão persistente** no topo do chat. Templates, Campanhas, Comandos, IA, Triagem e Objeções continuam globais; só o **Sessões** (lista de conversas + chat) respeita o filtro.

- Novo seletor "Sessão ativa" no header (ao lado dos badges de status), salvo em `localStorage` por usuário.
- `ConversationList` filtra por `provider_id` da sessão escolhida (já existe o campo).
- Indicador visual em cada conversa mostrando de qual chip veio (já tem badge, vai ficar mais explícito).
- Opção "Todas as sessões" para visão consolidada quando quiser.

## 2. Failover automático entre chips (health-based)

**Quando dispara:** ao enviar mensagem, se a sessão alvo estiver `disconnected`/`error` ou retornar 404/401 da Evolution.

- Edge function `whatsapp-api` ganha modo `auto_failover`: lê sessões do mesmo `project_id`, ordena por `last_seen_at`/status `connected`, tenta a próxima.
- Toast no front: "Sessão X caiu, enviado via Y".
- Log em `imphq_wa_messages.metadata.failover_from` para auditoria.
- Health check passivo: cada envio bem-sucedido atualiza `last_seen_at` da sessão (coluna já existe ou criamos).

## 3. Fotos de perfil (sob demanda + cache)

- Nova coluna `imphq_wa_conversations.profile_pic_url` (text, nullable).
- Ao abrir conversa: se `profile_pic_url` for null OU mais velho que 7d, chama Evolution `/chat/fetchProfilePictureUrl/{instance}` via edge proxy.
- Baixa imagem e salva no bucket `whatsapp-media/profiles/{remote_jid}.jpg`.
- `ConversationList` e header do `ChatView` renderizam a foto; fallback continua sendo as iniciais coloridas.

## 4. Slash Commands no chat

**UX:** digitar `/` no input abre popover com lista filtrável de comandos cadastrados (já existe `CommandManager` + tabela `imphq_wa_commands`). Selecionar dispara a(s) mensagem(ns).

- Comandos suportam **sequência** (várias mensagens com `delay_seconds` entre elas) — adicionar coluna `sequence` (jsonb) na tabela existente, formato `[{content, delay_seconds, media_url?}]`.
- Editor em `CommandManager` ganha modo "sequência" (botão "+ adicionar passo").
- Variáveis suportadas no envio: `{nome}`, `{telefone}`, `{projeto}` — substituídas no momento do envio.
- `/ia` já existente continua funcionando (passa por outro caminho).

---

## Detalhes técnicos

**Migrations (1 só):**
- `ALTER TABLE imphq_wa_conversations ADD COLUMN profile_pic_url TEXT, profile_pic_updated_at TIMESTAMPTZ;`
- `ALTER TABLE imphq_wa_commands ADD COLUMN sequence JSONB DEFAULT '[]'::jsonb;`
- `ALTER TABLE imphq_wa_providers ADD COLUMN last_seen_at TIMESTAMPTZ;` (se não existir)

**Edge functions:**
- `whatsapp-api`: novas actions `fetch_profile_pic` e `send_with_failover`.
- Failover percorre providers do mesmo projeto em ordem de saúde.

**Frontend:**
- `WhatsAppPage.tsx`: seletor global de sessão (hook `useActiveSession`).
- `ConversationList.tsx`: respeita filtro, mostra avatar com foto.
- `ChatView.tsx`: avatar com foto no header + componente `SlashCommandPopover` plugado no input.
- `CommandManager.tsx`: editor de sequências.

**Sem impacto em:** Templates, Campanhas, Comandos (tabela), IA Autônoma, Triagem, Objeções — continuam globais.

## Fora de escopo (fica para depois)
- Pool de chips com rodízio round-robin
- Migrar conversas existentes entre chips manualmente
- Sync em lote de fotos de todos os contatos
- Painel lateral de atalhos clicáveis (só slash commands por enquanto)
