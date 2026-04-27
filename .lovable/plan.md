## Alerta de Integração Facebook no Dashboard

Adicionar um alerta visível no topo do Dashboard quando a integração com o Facebook Ads entrar em estado de erro (token expirado, checkpoint, permissões), pra você não depender de notar manualmente que a sincronização parou.

### Como vai funcionar

**Detecção do erro (backend)**
- A Edge Function `facebook-ads-sync-all` já captura erros 400 da Graph API com subcode 459/190 nos logs.
- Vou estendê-la para **persistir** o estado do erro: salvar em `imphq_integration_credentials` (campo `data` JSONB) os campos `last_sync_status`, `last_sync_error`, `last_sync_at` e `last_error_subcode` por projeto/ad_account.
- Quando o sync rodar com sucesso, esses campos são limpos automaticamente.

**Componente visual (frontend)**
- Novo componente `FacebookHealthAlert.tsx` em `src/components/dashboard/`.
- Renderiza no topo do Dashboard (acima do `DashboardAlerts` existente), só aparece quando há erro ativo.
- Visual: card vermelho/âmbar com ícone de alerta, mensagem clara em pt-BR, e CTA "Renovar Token" que leva pra `/configuracoes` (aba Integrações).

**Mensagens contextuais por subcode**
- `459` (checkpoint): "🔒 Facebook bloqueou o acesso por segurança. Faça login em facebook.com, resolva o checkpoint e renove o token."
- `190` (token expirado): "⏰ Token do Facebook expirou. Renove em Configurações → Integrações."
- Outros 400/403: "⚠️ Erro na sincronização do Facebook Ads. Última tentativa: {data}."

**Detalhes mostrados**
- Nome dos projetos afetados (ex: "JP Freitas, Tatuagem — Jonathan").
- Última sincronização bem-sucedida (ex: "Última coleta: 26/04/2026 às 14h").
- Botões: "Renovar Token" → `/configuracoes`, "Ver Logs" → abre painel com detalhes técnicos.

### Arquivos

**Editados:**
- `supabase/functions/facebook-ads-sync-all/index.ts` — persistir status do sync por credencial
- `src/pages/Dashboard.tsx` — montar o novo componente

**Criados:**
- `src/components/dashboard/FacebookHealthAlert.tsx`

**Migration:** nenhuma necessária (uso o JSONB `data` existente em `imphq_integration_credentials`).

### Bônus opcional
Se quiser, posso também disparar uma **notificação push PWA** quando o erro for detectado pela primeira vez (1x por incidente, sem spam), reaproveitando o `send-push` que já existe. Me confirme se quer incluir.
