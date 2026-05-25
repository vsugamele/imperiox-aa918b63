
## Objetivo

Identificar quem clicou no botão de compra durante seu webinar externo (Zoom/YouTube/etc) **mas não comprou**, e disparar recuperação no WhatsApp automaticamente.

## Como funciona

```text
[Webinar externo] → Link de pitch personalizado por lead
        │
        ▼
[Edge: webinar-pitch-click]  ← marca lead, dispara webhook + WA
        │
        ├─→ Redireciona para checkout (transparente)
        ├─→ Registra clique em imphq_webinar_clicks
        ├─→ Agenda recuperação WA em 15min / 1h / 24h
        └─→ Cancela recuperação se venda chegar (cruza com imphq_vendas por email/phone)
```

## Entregas

### 1. Nova página `/webinar` (módulo dentro do projeto)
- Criar/editar "Sessões de webinar" (nome, data, link real do checkout)
- Gerar **link mágico de pitch** por lead: `https://app/wp/{session}/{lead_token}` 
- Tela de Sessão com KPIs: presentes, cliques no pitch, comprou, **não-comprou (recuperáveis)**
- Lista de "Cliques sem venda" com botão "Disparar WA agora"

### 2. Captura do clique (Edge Function `webinar-pitch-click`)
- Recebe `session_id` + `lead_token`
- Insere em `imphq_webinar_clicks` (lead_id, session_id, clicked_at, ua, ip)
- Dispara webhook configurado (Make/n8n) com `{ event: 'pitch_clicked', lead }`
- Enfileira 3 mensagens WA na campanha de recuperação (T+15min, T+1h, T+24h)
- Redireciona 302 para o checkout real

### 3. Sequência de recuperação WA (reusa infra existente)
- Template editável por sessão (3 passos default já populados)
- Usa `imphq_wa_campaigns` + scheduler `wa-campaign-scheduler` já em produção
- Cancela automaticamente quando webhook de venda chegar (cruzamento por email/telefone na window de 48h)

### 4. Pré-webinar (lembretes de show-up)
- Na sessão, configurar lembretes T-24h, T-1h, T-5min
- Mesmo motor de campanhas WA, audiência = leads inscritos na sessão

### 5. Inscrição / identificação do lead
- Form público `/w/{session}` (reusa FormBuilder) → gera lead + `lead_token`
- Email de confirmação com o link mágico de pitch já personalizado
- Botão "Importar inscritos" (CSV) para quem já tem lista em outra plataforma

## Banco (migração)

- `imphq_webinar_sessions` (id uuid, project_id text, nome, scheduled_at, checkout_url, pitch_template jsonb, recovery_template jsonb, reminder_template jsonb)
- `imphq_webinar_registrations` (id, session_id, lead_id, lead_token unique, status [registered|attended|clicked|bought|recovered])
- `imphq_webinar_clicks` (id, registration_id, clicked_at, recovered_at, sale_id nullable)
- RLS: dono do projeto vê/edita; Edge service-role escreve.

## Arquivos a criar/editar

**Novos**
- `src/pages/Webinar.tsx` (listagem + criar sessão)
- `src/pages/WebinarSessao.tsx` (detalhes + KPIs + cliques sem venda)
- `src/components/webinar/SessionConfigDialog.tsx` (lembretes/recuperação/checkout)
- `src/components/webinar/PitchClickTable.tsx`
- `supabase/functions/webinar-pitch-click/index.ts`
- `supabase/functions/webinar-reconcile-sales/index.ts` (cron 5min — marca recovered + cancela sequência)
- Migração SQL das 3 tabelas

**Editados**
- `src/App.tsx` (+ rotas `/webinar`, `/webinar/:id`)
- `src/components/AppSidebar.tsx` (+ item "Webinar" com ícone `Radio`)
- `src/pages/ProjetoDetalhe.tsx` (atalho "Webinar" no menu)

## Fora de escopo
- Sala de transmissão própria, replay hospedado, OBS/streaming, chat ao vivo. Tudo continua na plataforma externa — só capturamos o **clique no pitch** e operamos o follow-up.

## Próximo passo
Se aprovar, eu implemento a migração + página + edge function + sequência WA de uma vez.
