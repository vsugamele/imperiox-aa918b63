
## Problema observado

Na conversa do print (suporte JP Freitas):
1. **Humano respondeu** com magic link → IA pausada por 30min (`ai_paused_until`).
2. Aluna voltou em seguida com **3 perguntas novas** ("não tá chegando e-mail", "tenho que reassistir aulas?") e ficou **37min aguardando** — IA ignorou porque ainda estava no janelão de pausa.
3. A aluna não digitou e-mail nessa janela, então mesmo quando a IA voltasse, ela não teria contexto do cadastro (matrículas, status) para responder com precisão.

## Plano

### 1. Auto-retomada inteligente pós-humano (`wa-ai-reply`)
Hoje qualquer mensagem humana pausa IA por 30min fixos, mesmo se o lead voltar 1 minuto depois com uma pergunta nova.

- Reduzir pausa default de **30min → 10min** (parâmetro `ai_paused_until` em `whatsapp-api/_lib/db.ts`).
- Em `wa-ai-reply`, antes de honrar `ai_paused_until`, verificar:
  - Quantas mensagens **incoming** chegaram **depois** da última outgoing humana.
  - Se >=1 mensagem nova do lead E já se passaram pelo menos 3min desde a resposta humana → **liberar IA** (registra `human_followup_resume=true` no log).
  - Se status `needs_human` permanece, mantém bloqueio (esse é o flag definitivo).
- Adicionar coluna nenhuma; usa apenas `last_outgoing_at` + `last_message_direction` já existentes.

### 2. E-mail sempre puxado (lead E aluna)
Hoje `jpLookupLead` só busca por email. Se aluna não digita email, IA fica cega.

- Estender `crmBridgeJP.ts`:
  - Nova função `jpLookupLeadByPhone(phone)` → bridge endpoint `lookup_lead` com payload `{ phone }` (assumindo bridge JP aceita; senão, fallback gracioso).
  - Função combinada `jpResolveLead({ email?, phone? })` — tenta email, depois phone.
- Em `wa-ai-reply` (bloco JP):
  - Se sem email no cadastro/extração, chamar lookup por **phone** (já temos `conv.phone`).
  - Se ainda assim não achar, manter comportamento atual (IA pede email no diálogo), mas reforçar no prompt: *"Você AINDA NÃO tem e-mail dessa aluna. Pergunte de forma natural na primeira oportunidade, sem soar robótico, para puxar o cadastro completo."*
- Persistir o email descoberto via lookup-por-phone em `imphq_leads.email` (não sobrescreve se já houver) para reaproveitamento.

### 3. Leitura de momento do lead (não-aluno)
A IA já gera `current_intent` + `emotional_state` no JSON final, mas isso é só registro. Não está sendo **lido de volta** no prompt seguinte para guiar a próxima resposta.

- Quando lead **não tem matrícula** (lookup vazio), injetar no system prompt um bloco `MOMENTO ATUAL DO LEAD`:
  - `current_intent` da última conversa (`imphq_wa_conversations.current_intent`).
  - `emotional_state` + `last_objection`.
  - Instrução curta tipo: *"Adapte tom e CTA ao momento: descoberta=educar, consideração=mostrar prova, decisão=fechar, objeção=quebrar barreira específica, pronto_para_comprar=enviar checkout."*
- Quando é **aluna confirmada** (lookup ok), o bloco vira `MOMENTO ATUAL DA ALUNA` com status do curso/última aula vista (campos já trazidos pelo `jpBuildContextBlock`).

### 4. Telemetria mínima
- Log `[wa-ai-reply] resume_reason=human_followup` quando a pausa for liberada antecipadamente, para auditarmos no painel de logs.

## Arquivos afetados (somente edge functions, sem SQL)

- `supabase/functions/wa-ai-reply/index.ts` — lógica de auto-resume, lookup por phone, bloco de momento.
- `supabase/functions/_shared/crmBridgeJP.ts` — `jpLookupLeadByPhone`, `jpResolveLead`.
- `supabase/functions/whatsapp-api/_lib/db.ts` — pausa default 30min → 10min.

## Fora do escopo

- Mexer em UI da Inbox.
- Mudar schema do banco.
- Tocar no follow-up consultivo pós-pitch (continua igual).
