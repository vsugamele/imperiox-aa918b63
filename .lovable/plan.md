
# Avaliação Rigorosa — Módulo WhatsApp

## Problemas Encontrados

### 1. URL da API com barra dupla (BUG ATIVO)
A `api_url` salva no banco termina com `/`: `https://darkadvanced-evolution-api.llxtug.easypanel.host/`
O código concatena: `${provider.api_url}/message/sendText/...`, gerando URLs com `//` (ex: `host//message/sendText/...`).
Os logs confirmam: `[sendEvolution] URL: https://...easypanel.host//message/sendText/JP Freitas`.
**Impacto**: Pode causar erros 404 ou comportamento inesperado dependendo do servidor.
**Fix**: Normalizar a URL no helper removendo trailing slash: `provider.api_url.replace(/\/+$/, "")`.

### 2. Instance name sem encode na URL (BUG ATIVO)
O nome da instância é `JP Freitas` (com espaço). O código insere direto na URL sem `encodeURIComponent`.
URL gerada: `/message/sendText/JP Freitas` — espaço não encodado.
**Impacto**: Pode funcionar em alguns servidores mas é tecnicamente incorreto e frágil.
**Fix**: Usar `encodeURIComponent(provider.instance_name)` em todas as chamadas à Evolution API.

### 3. sync_contacts dá timeout (BUG ATIVO)
A action `sync_contacts` percorre todos os chats da Evolution fazendo queries individuais ao banco para cada contato. Se houver muitos chats, ultrapassa o timeout de 60s da edge function.
**Fix**: Usar batch upsert em vez de loop individual. Limitar a 500 contatos por sync.

### 4. ChatView: `send` não trata resposta `success: false` (BUG)
Quando o envio retorna `{ success: false, error: "Número inválido..." }`, o frontend trata como sucesso porque `supabase.functions.invoke` não joga erro para status 200. O toast mostra "Mensagem enviada!" mesmo quando o número é inválido.
**Fix**: Checar `data.success === false` após o invoke e mostrar `data.error` no toast.

### 5. Polling ineficiente no ChatView
`pollNew` depende de `messages` no dependency array do `useCallback`, causando recriação do intervalo a cada mudança. Polling a cada 30s é lento para um chat.
**Fix**: Usar `useRef` para o timestamp mais recente em vez de depender do state.

### 6. Hub Local x Sessões: confusão conceitual
A aba "Sessões" mostra `imphq_wa_conversations` (contatos), a aba "Hub Local" mostra `wa_hub_iso_sessions` + mensagens brutas. São dois sistemas paralelos e desconectados:
- Evolution API (via edge function) salva em `imphq_wa_messages`
- Hub Local (via command bus) salva em `wa_hub_iso_events`
Nenhum dos dois recebe mensagens incoming automaticamente da Evolution (o webhook precisa ser configurado na Evolution apontando para a edge function).
**Fix**: Documentar no UI que o webhook da Evolution precisa ser configurado. Adicionar o webhook URL visível no EvolutionStatusCard.

### 7. ProviderConfigDialog: API key salva em texto puro no banco (SEGURANÇA)
A `api_key` da Evolution está salva diretamente na tabela `imphq_wa_providers`, acessível a qualquer usuário autenticado via RLS `USING (true)`.
**Impacto**: Qualquer usuário autenticado pode ler a API key de todos os providers.
**Recomendação**: Mover para Supabase Vault ou secrets. Por agora, ao menos restringir RLS por `user_id`.

### 8. RLS sem isolamento por usuário
Todas as policies em `imphq_wa_conversations`, `imphq_wa_messages` e `imphq_wa_providers` usam `USING (true)` — qualquer usuário autenticado vê tudo de todos.
Não é um problema agora se é single-tenant, mas é um risco se mais usuários forem adicionados.

---

## Plano de Correção (priorizado)

### Passo 1 — Corrigir bugs ativos na edge function
Arquivo: `supabase/functions/whatsapp-api/index.ts`
- Normalizar `api_url` (remover trailing slash) no helper `getProvider` ou antes de cada fetch
- Encodar `instance_name` com `encodeURIComponent` em todas as URLs
- Otimizar `sync_contacts` com batch processing e limite de 500

### Passo 2 — Corrigir ChatView
Arquivo: `src/components/whatsapp/ChatView.tsx`
- Tratar `data.success === false` no handler de envio
- Refatorar polling para usar `useRef` no timestamp, reduzir intervalo para 5-10s
- Reduzir re-renders desnecessários

### Passo 3 — Mostrar webhook URL no EvolutionStatusCard
Arquivo: `src/pages/WhatsAppPage.tsx`
- No card de status, exibir o URL do webhook que deve ser configurado na Evolution:
  `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/whatsapp-api?action=webhook&provider=evolution`
- Botão de copiar para facilitar a configuração

### Passo 4 — Fix na API URL duplicada no banco
- Migration para limpar o trailing slash da `api_url` existente

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | URL normalization, encodeURIComponent, batch sync |
| `src/components/whatsapp/ChatView.tsx` | Error handling, polling fix |
| `src/pages/WhatsAppPage.tsx` | Webhook URL display |
| `supabase/migrations/*` | Fix api_url trailing slash |
