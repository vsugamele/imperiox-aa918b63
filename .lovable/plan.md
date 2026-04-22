

## Plano: Nutrição automática por e-mail (Lead → Comprador) com IA

Você quer transformar lead em comprador via e-mail automático por até 1 ano, com IA gerando/personalizando o conteúdo. Hoje o sistema já tem base sólida (OpenFlow, Resend por projeto, leads com `ultimo_produto`, AI Gateway). Falta a **camada de nutrição contínua de longo prazo** com inteligência por estágio.

### O que já existe (não vou refazer)
- `imphq_leads` com `ultimo_produto`, `score`, `status`, `total_gasto`
- OpenFlow para fluxos pontuais (boas-vindas, recuperação)
- `send-project-email` (Resend integrado por projeto)
- `openflow-ai` com Gemini/GPT/Claude e skills (Avatar, Copy, Anams)
- `imphq_email_templates` (já existe estrutura de templates)
- Suppression/unsubscribe básico

### O que falta construir

**1. Tabela `imphq_nurture_sequences`** (sequências por produto)
- Campos: `id`, `project_id`, `produto_nome`, `nome`, `duracao_dias` (default 365), `cadencia` (`diaria`/`semanal`/`custom`), `ativa`, `objetivo` (texto livre — "converter pra Cortes Perfeitos"), `tom` (mente_id opcional), `created_at`
- Cada produto tem 1 sequência ativa de nutrição

**2. Tabela `imphq_nurture_emails`** (e-mails gerados, fila individual)
- Campos: `id`, `lead_id`, `sequence_id`, `dia_numero` (1..365), `assunto`, `corpo_html`, `corpo_texto`, `status` (`pendente`/`agendado`/`enviado`/`pulado`/`convertido`), `agendado_para`, `enviado_em`, `aberto_em`, `clicado_em`, `gerado_por_ia` (bool), `modelo_ia`, `contexto_usado` (jsonb)
- 1 linha por e-mail individual (1:1 transacional, não bulk marketing)

**3. Edge Function `nurture-generator`** (gera próximo e-mail com IA)
- Input: `lead_id` + `sequence_id`
- Carrega contexto: lead (nome, último produto, score, vendas anteriores), Avatar do projeto, Copy Arsenal, Branding, **histórico dos últimos 5 e-mails enviados** (pra não repetir tema)
- Decide o **estágio do funil** baseado em `score` + `total_gasto` + dias desde lead:
  - Dia 1-7: aquecimento (problema/dor do avatar)
  - Dia 8-30: educação (mecanismo único)
  - Dia 31-90: prova social + objeção
  - Dia 91-365: nutrição leve quinzenal (insight + soft pitch)
- Gera assunto + corpo via `openflow-ai` (Gemini Flash default — barato pra escalar)
- Salva em `imphq_nurture_emails` como `agendado`

**4. Edge Function `nurture-scheduler`** (cron diário)
- Roda 1x/dia às 9h BRT via `pg_cron`
- Para cada lead ativo em sequência:
  - Verifica se já é dia de enviar (cadência da sequência)
  - Pula se: `status=convertido` (virou cliente do produto), unsubscribed, bounce
  - Chama `nurture-generator` se não há e-mail pendente
  - Envia e-mails `agendado` com `agendado_para <= now()` via `send-project-email`
- Marca `enviado` + cria entrada em `imphq_email_send_log`

**5. Trigger automático: lead → entra em sequência**
- Quando `imphq_leads` recebe novo lead com `ultimo_produto = X` e existe `imphq_nurture_sequences` ativa pra esse produto:
  - Cria 1 entrada em `imphq_lead_sequence_enrollments` (lead × sequência × data_inicio × ativo)
  - Scheduler pega no próximo ciclo
- Trigger automático: quando lead vira cliente do produto (`imphq_vendas` aprovada), marca enrollment como `convertido` e para a sequência **daquele produto** (mas continua nas outras se houver)

**6. UI: `/nutricao` (nova página) ou tab em Projetos**
- Lista de sequências por produto com toggle ativo/pausado
- Botão "Criar com IA" → gera plano de 365 dias (estágios + cadência) baseado no produto/avatar
- Card por sequência: leads ativos, taxa abertura, taxa clique, conversões, receita atribuída
- Drill: ver e-mails gerados de um lead específico (timeline)
- Botão "Pausar/Reativar" individual por lead

**7. Drill no CRM de Leads**
- Tab nova "Nutrição" no `LeadPredictivePanel` mostrando:
  - Sequências ativas
  - Próximo e-mail agendado (preview)
  - Histórico de e-mails enviados (assunto, abertura, clique)
  - Botão "Pular próximo" / "Pausar sequência"

**8. Anti-spam / qualidade**
- Limite hard: máx 1 e-mail/dia por lead (mesmo se múltiplas sequências)
- Verifica `suppressed_emails` antes de enviar
- Rodapé com unsubscribe automático (já existe infra)
- Se lead não abre 5 e-mails seguidos → reduz cadência pra quinzenal automaticamente
- Se lead não abre 10 → pausa sequência e move pra `cold`

### Arquivos afetados
- **Migration**: `imphq_nurture_sequences`, `imphq_nurture_emails`, `imphq_lead_sequence_enrollments` + RLS + triggers + cron `pg_cron` para `nurture-scheduler`
- **Novas Edge Functions**: `supabase/functions/nurture-generator/index.ts`, `supabase/functions/nurture-scheduler/index.ts`
- **Nova página**: `src/pages/Nutricao.tsx` + entrada no sidebar
- **Novo componente**: `src/components/nurture/SequenceCard.tsx`, `src/components/nurture/SequenceEditor.tsx`, `src/components/nurture/LeadNurtureTimeline.tsx`
- **Edição**: `src/components/leads/LeadPredictivePanel.tsx` (tab Nutrição), `src/App.tsx` (rota), `src/components/AppSidebar.tsx` (link)

### Detalhes técnicos (curto)
- IA default: `google/gemini-3-flash-preview` (custo ~$0.001/e-mail). 365 e-mails × 100 leads = ~$36/ano por produto. Aceitável.
- Geração lazy: só gera o próximo e-mail quando o scheduler roda (não pré-gera 365 de uma vez — economiza créditos e mantém contexto fresco).
- Idempotência: `idempotencyKey = nurture-{lead_id}-{sequence_id}-{dia}` no `send-transactional-email`.
- Marca como `purpose: transactional` (cada e-mail é 1:1 triggered por enrollment do lead — não é broadcast).
- Categorização: e-mail conta como transacional pois é resposta ao opt-in (lead se cadastrou em form do produto).

### Outras ideias de IA pra evoluir depois (fora deste escopo)
- **WhatsApp nurture paralelo** (mesmo motor, canal diferente)
- **Score preditivo de "pronto pra comprar"** que troca tom dos e-mails (já temos `imphq_lead_predictions`)
- **A/B testing automático de assuntos** (Gemini gera 2 variações, scheduler escolhe vencedor por taxa de abertura)
- **Resumo semanal por e-mail/WhatsApp pra você** com destaques (leads quentes, sequências performando, ROI por produto)
- **Auto-categorização de respostas** (lead respondeu o e-mail → IA classifica intent: dúvida/objeção/interesse → cria task ou move pro WhatsApp)

### Fora de escopo desta entrega
- Editor visual drag-and-drop de e-mails (uso HTML responsivo padrão com vars dinâmicas)
- Multi-canal (WhatsApp + e-mail no mesmo fluxo) — fica pra fase 2
- A/B testing automático

