
# IA WhatsApp via OpenRouter + Aprendizado com Respostas Humanas

## Contexto atual

O autoresponder já existe em `supabase/functions/whatsapp-api/index.ts` (linhas 1073-1322). Hoje ele:
- Lê `imphq_wa_ai_config` (personalidade, tom, FAQ, horários, contexto).
- Monta system prompt com briefing/avatar/produtos/branding/expert.
- Pega últimas 10 msgs da conversa como histórico.
- Chama `ai.gateway.lovable.dev` (Gemini 3 flash) com debounce/cooldown/lock anti-loop.

Faltam dois pontos: **escolher modelo via OpenRouter** e **transformar respostas humanas em insumo**.

---

## Parte 1 — Provider OpenRouter (opcional, por projeto)

### 1.1 Schema
Migration acrescenta em `imphq_wa_ai_config`:
- `ai_provider` text default `'lovable'` — valores: `'lovable'` | `'openrouter'`.
- `ai_model` text — ex.: `anthropic/claude-3.5-sonnet`, `openai/gpt-4o-mini`, `google/gemini-2.5-pro`, `meta-llama/llama-3.3-70b-instruct`.
- `ai_temperature` numeric default `0.7`.
- `ai_top_p` numeric default `1`.

Sem chave por projeto — `OPENROUTER_API_KEY` fica como secret global (você adiciona uma vez).

### 1.2 Edge function
Refatorar o trecho de IA do `whatsapp-api/index.ts` para uma função helper `callAI(provider, model, messages, opts)` que:
- Se `provider='openrouter'`: `POST https://openrouter.ai/api/v1/chat/completions` com `Authorization: Bearer ${OPENROUTER_API_KEY}` e headers `HTTP-Referer` + `X-Title: Imperio HQ`.
- Senão: mantém Lovable AI Gateway (default e fallback).
- Fallback automático: se OpenRouter falhar (429/5xx), tenta Lovable AI uma vez e loga em `imphq_ai_actions` como `notify`.

### 1.3 UI
Em `src/components/whatsapp/WhatsAppAIConfig.tsx`, nova seção **"Modelo de IA"**:
- Toggle Provider (Lovable AI / OpenRouter).
- Select de modelo (lista curada: Claude 3.5/Sonnet/Haiku, GPT-4o/mini, Gemini 2.5, Llama 3.3, DeepSeek, Mistral Large).
- Sliders de temperature/top_p com presets ("Conservador", "Equilibrado", "Criativo").
- Link "Ver custos por 1k tokens" abrindo openrouter.ai/models.

---

## Parte 2 — Respostas humanas como insumo para a IA

Hoje o operador responde no `ChatView` e isso fica em `imphq_wa_messages` (`direction='outgoing'`, sem flag de origem humana clara). Vamos transformar esses turnos em **memória ativa**.

### 2.1 Identificar respostas humanas
Migration em `imphq_wa_messages`: coluna `sent_by` text com valores `'ai' | 'human' | 'command' | 'campaign' | 'system'`.
- Backfill via `metadata->>source` quando existir; senão `'human'` para outgoing sem `metadata.source='ai'`.
- Atualizar trecho do autoresponder p/ marcar `sent_by='ai'` no INSERT (linha 1289-1298).
- `ChatView` envia `sent_by='human'` ao mandar manualmente.

### 2.2 Few-shot dinâmico no system prompt
No momento de montar `messages` (linha 1240), antes do histórico cru, injetar bloco **"EXEMPLOS DE COMO ESTE PROJETO RESPONDE"** com 5-8 pares (pergunta do lead → resposta humana) do mesmo projeto. Critério: últimos 30 dias, mensagens humanas com >20 chars, dedup por similaridade simples (primeiros 40 chars).

Query: pega últimas N mensagens `sent_by='human'` do projeto + a `imphq_wa_messages` incoming imediatamente anterior na mesma conversa.

### 2.3 RAG semântico (opcional, fase 2)
Tabela nova `imphq_wa_knowledge`:
- `id`, `project_id`, `pergunta` text, `resposta` text, `embedding` vector(768), `source` ('human_reply'|'manual'|'objection'), `score_uso` int, `aprovada` bool, `created_at`.
- Trigger ou edge function `wa-learn-from-human` (cron 1x/hora ou após `INSERT` em msg humana) que:
  1. Lê msgs humanas dos últimos 60 min.
  2. Pega a pergunta antecedente do lead.
  3. Gera embedding via Lovable AI (`google/gemini-embedding-001`).
  4. Insere em `imphq_wa_knowledge` se similaridade < 0.92 com algo existente (evita duplicar).
- No autoresponder, antes de chamar a LLM: embedda a msg do lead, busca top-3 do `imphq_wa_knowledge` do projeto (`<=>` cosine), injeta como "RESPOSTAS DE REFERÊNCIA APROVADAS PELO TIME".

### 2.4 Modo "Rascunho IA" (human-in-the-loop)
Toggle novo em `WhatsAppAIConfig`: **"Modo Sugestão"** (default off).
Quando ligado, a IA **não envia automaticamente** — grava o draft em nova tabela `imphq_wa_ai_drafts` (`conversation_id`, `suggested_text`, `model`, `confidence`, `status`).
No `ChatView`, um chip aparece acima do input: *"💡 Sugestão da IA: 'texto…'"* com botões **Usar** (preenche input) / **Editar** / **Descartar**.
Quando o operador edita e envia, calculamos `diff_ratio` e gravamos em `imphq_wa_ai_drafts.final_text` → vira sinal de qualidade para promover (ou não) aquele par para `imphq_wa_knowledge.aprovada=true`.

### 2.5 Painel "Aprendizado"
Nova aba dentro de `WhatsAppAIConfig` ou subseção em `/whatsapp`:
- Cards: nº de mensagens humanas capturadas, nº de pares aprovados, taxa de aceite das sugestões, modelos em uso (custo estimado/mês).
- Tabela revisional dos pares pendentes em `imphq_wa_knowledge` (aprovar/editar/descartar).

---

## Detalhes técnicos

**Migrations**
1. `ALTER TABLE imphq_wa_ai_config ADD COLUMN ai_provider text default 'lovable', ai_model text, ai_temperature numeric default 0.7, ai_top_p numeric default 1, learning_mode boolean default false, draft_mode boolean default false`.
2. `ALTER TABLE imphq_wa_messages ADD COLUMN sent_by text` + backfill.
3. `CREATE TABLE imphq_wa_knowledge (... embedding vector(768) ...)` + índice ivfflat + RLS via `has_role`.
4. `CREATE TABLE imphq_wa_ai_drafts` + RLS.

**Secrets**
- Adicionar `OPENROUTER_API_KEY` (você fornece quando aprovar o plano).

**Edge functions**
- `whatsapp-api/index.ts` — refatorar trecho IA (extrair `callAI`, `buildContext`, `getFewShotExamples`, `getRAGRefs`).
- `wa-learn-from-human` (nova) — invocada após msg humana via fire-and-forget, gera embedding e popula `imphq_wa_knowledge`.

**Frontend**
- `WhatsAppAIConfig.tsx` — seção Modelo + toggles Learning/Draft + tab Aprendizado.
- `ChatView.tsx` — banner de rascunho IA + envio com `sent_by='human'`.

---

## Escopo / fora de escopo

**Dentro:** migrations, edge functions, UI de config, captura humana, few-shot, RAG opcional, modo rascunho.
**Fora:** fine-tuning de modelo próprio, multi-tenant billing por projeto, transcrição de áudio do lead (já existe pipeline próprio).

## Perguntas antes de implementar

1. Quer começar pelos **dois pacotes juntos** (OpenRouter + Aprendizado) ou só OpenRouter agora e aprendizado em fase 2?
2. **Modo Sugestão** (rascunho aprovado por humano) ou **Modo Automático** (IA envia sozinha como hoje) como default?
3. Quer RAG semântico (embedding + pgvector) ou começar só com few-shot dos últimos pares humanos (mais simples)?
