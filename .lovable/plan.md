

## Plano: Continuar nutrição + diagnosticar push notifications

### Parte 1 — Push notifications (causa raiz identificada)

**Diagnóstico**: a tabela `imphq_push_subscriptions` está **vazia (0 registros)**. Você nunca completou o opt-in no celular, então o servidor não tem pra onde enviar. Achei 3 problemas:

1. **Botão de ativar push está OCULTO no preview** (`PushOptIn.tsx` linha 89-90): retorna `null` em domínios `id-preview--` e `lovableproject.com`. Você precisa abrir o app pelo **domínio publicado** (`imperiox.lovable.app`) **no celular** pra ver o sininho e ativar.
2. **Sem fallback claro**: você não sabia que precisava ativar. Não há card visível nas Configurações pedindo opt-in.
3. **iOS exige PWA instalada**: no iPhone, push só funciona se o app foi "Adicionado à Tela de Início" via Safari (não no navegador comum).

**Correções**:
- Adicionar **card de status push** na aba `NotificationPreferencesTab` em Configurações: mostra "❌ Push desativado neste dispositivo" + botão "Ativar agora" (funciona em qualquer domínio HTTPS, inclusive o publicado). Se for preview, explica: "Abra em imperiox.lovable.app no seu celular pra ativar".
- Adicionar **botão de teste** "Enviar notificação de teste" que chama `send-push` pro próprio user, pra você confirmar end-to-end em 1 clique.
- Adicionar instruções inline pra iPhone (precisa instalar como PWA primeiro).
- Validar que o Service Worker `sw-push.js` está registrado corretamente em produção (checagem visual no card).

### Parte 2 — Continuar nutrição (4 pendências aprovadas)

1. **Rota `/nutricao`** em `App.tsx` + link "Nutrição" no `AppSidebar.tsx` (ícone `Mail`, dentro do grupo Marketing/Leads).
2. **Bulk enrollment**: dialog em `Nutricao.tsx` com filtros (produto, tag, score mínimo, status) → preview de N leads → botão "Inscrever todos". Cria entradas em `imphq_lead_sequence_enrollments` em batch.
3. **Tab "Nutrição" no `LeadPredictivePanel`**: timeline dos e-mails enviados (assunto, data, abriu?, clicou?), próximo agendado com preview do conteúdo, botões "Pular próximo" / "Pausar sequência" / "Inscrever em outra sequência".
4. **Tracking de abertura/clique**:
   - Adicionar pixel `<img src=".../nurture-track?eid=XXX&type=open" width=1 height=1>` no rodapé do HTML gerado pelo `nurture-generator`.
   - Reescrever todos os links do corpo com redirect via `.../nurture-track?eid=XXX&type=click&url=YYY`.
   - Nova Edge Function `nurture-track`: incrementa `aberto_em` ou `clicado_em` em `imphq_nurture_emails`, redireciona ou retorna pixel 1x1 transparente.

### Arquivos afetados

**Push**:
- `src/components/configuracoes/NotificationPreferencesTab.tsx` (adicionar card status + botão teste)
- `src/components/PushOptIn.tsx` (remover bloqueio total no preview — só esconder se for iframe, não se for domínio preview aberto direto)
- Nova Edge Function: `supabase/functions/send-push-test/index.ts` (atalho que envia push de teste pro user logado)

**Nutrição**:
- `src/App.tsx` (rota `/nutricao`)
- `src/components/AppSidebar.tsx` (link)
- `src/pages/Nutricao.tsx` (bulk enroll dialog)
- `src/components/leads/LeadPredictivePanel.tsx` (tab Nutrição)
- Novo: `src/components/nurture/LeadNurtureTimeline.tsx`
- Novo: `src/components/nurture/BulkEnrollDialog.tsx`
- Nova Edge Function: `supabase/functions/nurture-track/index.ts`
- Edição: `supabase/functions/nurture-generator/index.ts` (injetar pixel + rewrite de links)
- Migration leve: índices em `imphq_nurture_emails(aberto_em, clicado_em)`

### Detalhes técnicos
- `send-push-test`: chama internamente `send-push` com `user_id` do JWT, título "Teste Imperio HQ", mensagem "Se você está vendo isso, push funciona ✅".
- Pixel tracking: 1x1 GIF transparente base64, headers `Cache-Control: no-store` pra forçar hit no servidor.
- Click tracking: `302 redirect` pra URL original após registrar.
- iOS: detectar `navigator.standalone` e mostrar instrução específica se não for PWA instalada.

### Fora de escopo
- Migrar VAPID keys (já estão configuradas).
- Push pra múltiplos devices do mesmo user (já suportado pelo schema, só precisa ativar em cada um).

