## Objetivo

1. Expandir catálogo de modelos do **Kie** (imagem + vídeo) no Studio.
2. Criar um **Workflow Pipeline** (linear + templates) que encadeia geração de imagem → vídeo → áudio, passando a saída de um step como input do próximo.

---

## Parte 1 — Novos modelos Kie

### Imagem (Kie)
- `gpt-image-2` (já existe)
- `nano-banana` — Gemini 2.5 Flash Image, edição multi-imagem, rápido
- `nano-banana-2` — versão Pro, qualidade alta
- `flux-kontext-pro` — edição contextual com referência
- `flux-kontext-max` — versão máxima
- `seedream-4` — Bytedance, fotorealista
- `ideogram-v3` — texto legível em imagem
- `qwen-image-edit` — edição estilo conversacional

### Vídeo (Kie)
- `veo3` / `veo3-fast` (já existem)
- `veo3.1` — versão mais nova
- `runway-gen4` — Runway Gen-4 Turbo
- `hailuo-02` — MiniMax Hailuo 02
- `wan-2.2` — Alibaba Wan 2.2
- `pixverse-v5` — Pixverse V5
- `minimax-video-01` — MiniMax T2V/I2V
- `sora-2` / `kling-2.1` (já existem)

Todos passam pelo mesmo endpoint `https://api.kie.ai/api/v1/jobs/createTask` (já implementado), só muda o `model`. Polling em `studio-generate-status` já é genérico.

**Mudança técnica:** apenas adicionar entradas nos arrays `IMAGE_MODELS_KIE` / `VIDEO_MODELS_KIE` em `StudioGenerator.tsx` com labels descritivos (preço/uso).

---

## Parte 2 — Workflow Pipeline

### UX (nova aba "Workflow" em `/studio`)

```text
┌─────────────────────────────────────────────┐
│ Workflow: [Reels com narração ▼] [Salvar]  │
├─────────────────────────────────────────────┤
│ ① Imagem  Kie / nano-banana       [✓ pronto]│
│   prompt: "Personagem misterioso..."        │
│   ↓ output → frame inicial do step ②       │
├─────────────────────────────────────────────┤
│ ② Vídeo   Kie / veo3.1   image-to-video    │
│   prompt: "Câmera aproxima lentamente"      │
│   image_url: {{step1.output}}               │
│   ↓ output → vídeo final                    │
├─────────────────────────────────────────────┤
│ ③ Áudio   ElevenLabs / George               │
│   text: "Narração do roteiro..."            │
├─────────────────────────────────────────────┤
│ [+ Adicionar step]   [▶ Executar tudo]     │
└─────────────────────────────────────────────┘
```

- Cada step: kind + provider + model + prompt + params
- Campos suportam **variáveis** `{{step1.output}}`, `{{step2.output}}` que são resolvidas em runtime
- Status visual por step: idle / processing / completed / failed
- "Executar tudo" roda em sequência: aguarda step N completar antes de iniciar N+1
- Cada step grava em `imphq_studio_generations` normalmente (gallery continua funcionando)

### Templates prontos
- **Reels com narração**: imagem → vídeo I2V → áudio TTS
- **Carrossel 3 slides**: 3 imagens em paralelo (mesmo briefing, prompts variados)
- **Story animado**: imagem 9:16 → vídeo 5s 9:16
- **Anúncio com voz**: imagem → vídeo → áudio (mesmo do Reels mas presets de copy)

### Persistência

Nova tabela `imphq_studio_workflows`:
- `id` UUID, `user_id` UUID, `projeto_id` TEXT (nullable)
- `name` TEXT
- `template_key` TEXT (nullable — qual template originou)
- `steps` JSONB — array de `{ kind, provider, model, prompt, params, voice_id?, depends_on?: number, image_var?: string }`
- `created_at`, `updated_at`

Nova tabela `imphq_studio_workflow_runs`:
- `id` UUID, `workflow_id` UUID, `user_id` UUID
- `status` TEXT (running / completed / failed)
- `step_outputs` JSONB — `{ "1": "https://...", "2": "https://..." }`
- `current_step` INT
- `error` TEXT
- `created_at`, `updated_at`

RLS: dono = `user_id` em ambas, padrão das tabelas existentes.

### Edge Function nova: `studio-workflow-run`

Fluxo:
1. Recebe `workflow_id` (ou steps inline)
2. Cria row em `imphq_studio_workflow_runs` (status `running`)
3. Para cada step:
   - Resolve variáveis `{{stepN.output}}` em prompts e `image_url`/`image_input`
   - Chama internamente a mesma lógica de `studio-generate` (refatorar handlers em helpers compartilháveis OU `supabase.functions.invoke("studio-generate", ...)`)
   - Se `provider` for assíncrono (kie/luma): faz polling interno (até ~3 min com backoff) até `output_url` aparecer em `imphq_studio_generations`
   - Salva URL em `step_outputs[N]` e atualiza `current_step`
4. Marca run como `completed` ou `failed`

Frontend acompanha via subscription/poll a `imphq_studio_workflow_runs.status` e `step_outputs`.

### Componentes frontend novos
- `src/components/studio/StudioWorkflow.tsx` — aba principal, lista templates + workflows salvos
- `src/components/studio/WorkflowEditor.tsx` — editor linear de steps (add/remove/reorder, configurar cada step)
- `src/components/studio/WorkflowStepCard.tsx` — card individual com status e preview de output
- `src/data/studio/workflowTemplates.ts` — definição dos 4 templates iniciais

`Studio.tsx` ganha tabs: **Gerador** (atual) | **Workflow** (novo) | **Prompts** (atual)

---

## Detalhes técnicos

- **Aspect ratios suportados** por modelo: mapa em `IMAGE_MODELS_KIE`/`VIDEO_MODELS_KIE` indicando quais aceitam `9:16`, `16:9`, etc., para mostrar só opções válidas no select.
- **Variáveis**: regex simples `/\{\{step(\d+)\.output\}\}/g` na edge function, substitui pelo URL do step referenciado.
- **Falhas**: se step N falha, run fica `failed`, steps N+1 não rodam, frontend mostra qual step quebrou.
- **Custo estimado**: opcional, somar `cost_usd` dos generations associadas ao run.
- **Cancelamento**: botão "parar" marca run como `failed` com mensagem "cancelado pelo usuário".

## Fora de escopo
- Canvas drag-and-drop (React Flow) — mantemos linear conforme escolha.
- Loops, condicionais, branches no workflow.
- Execução paralela de steps (exceto template "Carrossel" que é caso especial).
- Compartilhar workflows entre usuários do mesmo projeto.