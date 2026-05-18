## Respostas rápidas

**1) Botão Imperador salva histórico?** Sim — grava em `imphq_sales_paths` (status `processing`→`ready`, com snapshot, plano, model_used). Confirmei 2 registros recentes em `jp_freitas`. **Só falta a UI mostrar** — hoje cada clique gera novo e descarta o anterior visualmente.

**2) Timeouts do gerador de IA — dá pra ir batch?** Sim. Edge function tem 150s. Hoje `openflow-ai` chama o modelo síncrono e responde — modelos lentos (Gemini Pro, Opus, R1) estouram. `sales-path-engine` já tem a base certa (`imphq_sales_paths` com `status`), só não é assíncrono. Solução: padrão **fire-and-forget + polling**.

**3) Estamos usando todos os modelos do OpenRouter?** Não. Hoje só **5 hardcoded** (`AIGenerateButton.tsx`): Claude Opus 4, Sonnet 4, 3.5 Sonnet, DeepSeek R1, Llama 4 Maverick. OpenRouter tem 300+. Vale puxar dinamicamente do endpoint `/api/v1/models`.

---

## Plano de implementação

### A. Histórico do Imperador (UI)
1. Nova tabela query em `SalesPathButton.tsx`: ao abrir o Sheet, listar últimos 10 planos de `imphq_sales_paths` para o `projectId` (status `ready`).
2. Adicionar Tab "Histórico" no Sheet com cards (data, health_score, model_used, botão "Ver").
3. Ao clicar, hidratar o estado `plan` com a linha salva (sem gerar nova).
4. Botão "Gerar novo" continua chamando `sales-path-engine`.

### B. Batch / Async para geração longa
**Padrão:** edge function enfileira job, retorna `job_id` imediato, worker processa em background, frontend faz polling.

1. **Tabela `imphq_ai_jobs`** (nova):
   - `id`, `user_id`, `project_id`, `action`, `model`, `payload jsonb`, `status` (queued/processing/ready/failed), `result jsonb`, `error`, `created_at`, `completed_at`.

2. **Refactor `openflow-ai`**:
   - Modo `async: true` no body → cria job, retorna `{ job_id, status: "queued" }` em <1s.
   - Usa `EdgeRuntime.waitUntil()` para rodar a chamada AI em background após responder (não bloqueia HTTP).
   - Atualiza `imphq_ai_jobs` com result/error.
   - Mantém modo síncrono para chamadas curtas (Flash/Mini).

3. **Novo endpoint `ai-job-status`** (ou reusar via `action: "get_job"`): retorna status + result.

4. **Frontend (`AIGenerateButton.tsx`)**:
   - Se modelo for "lento" (Pro/Opus/R1) ou `async` selecionado → envia `async:true`, recebe `job_id`, faz polling a cada 3s, mostra progresso. Sem timeout artificial.
   - Toast "Gerando em background — você pode continuar usando o app".

5. **Aplicar mesmo padrão ao `sales-path-engine`**: já tem `imphq_sales_paths` com `status processing` — só falta retornar imediato e processar via `waitUntil`. Frontend faz polling no `pathId`.

### C. Catálogo OpenRouter dinâmico
1. **Edge function nova `openrouter-models`**: chama `GET https://openrouter.ai/api/v1/models` com cache de 1h (em memória ou tabela `imphq_ai_models_cache`). Retorna lista filtrada (id, name, pricing, context_length).
2. **`AIGenerateButton.tsx`**: substituir array `MODELS` hardcoded por fetch dinâmico no mount. Manter os Gateway (Gemini/GPT) hardcoded no topo + lista OpenRouter abaixo com search/filtro (são 300+).
3. UI: Select com input de busca, badges de preço (📈 caro / 💰 médio / 💨 barato) e contexto (128k, 1M, etc).
4. Favoritos: salvar top 10 mais usados em `localStorage` no topo do select.

---

## Ordem de execução sugerida
1. **A** (rápido, sem migration) → resolve dor imediata do histórico.
2. **C** (1 edge function + UI) → resolve "todos modelos OpenRouter".
3. **B** (mais pesado, migration + refactor) → resolve timeouts de vez.

Confirma essa ordem ou prefere começar por outro item?