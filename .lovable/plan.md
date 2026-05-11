## Lipsync com Seedance 2 no Studio

Adicionar o modelo **Seedance 2 da Kie.ai** com suporte a `reference_audio_urls` para sincronizar áudio de referência (lipsync) com a imagem do avatar — disponível tanto no Generator manual quanto como bloco no Workflow, mais um template "Avatar Falante" pronto.

---

### 1. Generator manual (`StudioGenerator.tsx`)

- Adicionar `seedance-2` na lista `VIDEO_MODELS_KIE` com flag `supportsLipsync: true`.
- Quando o usuário escolher `seedance-2`, exibir uma seção **"Áudio de Referência (Lipsync)"** com:
  - Botão **Upload** (`FileUpload` para `creative-assets/studio-audio`, accept `audio/*`).
  - Campo **URL manual** (colar link).
  - Botão **"Usar áudio gerado"** abrindo dialog que lista `imphq_studio_generations` do usuário onde `kind='audio'` e `output_url` não nulo.
  - Lista de até 3 URLs (chip removível) — limite da API.
- Adicionar campo **duração** (5/10/15s) e **resolução** (720p/1080p) específicos.
- No envio: passar `params: { reference_audio_urls: [...], generate_audio: false, duration, resolution }` e `image_url` (first_frame_url) — bloquear `last_frame_url` quando há áudio.
- Aviso visual: "Áudio combinado até 15s. First frame + áudio são exclusivos com last frame."

### 2. Edge Function `studio-generate`

- Em `kieVideo()`, quando `model === 'seedance-2'` e `params.reference_audio_urls?.length`:
  - Montar input com `first_frame_url` (vindo de `body.image_url`), `reference_audio_urls`, `generate_audio: false`, `resolution`, `duration`.
  - Não enviar `last_frame_url`.
- Demais modelos seguem fluxo atual.

### 3. Workflow — novo step "Lipsync"

- Em `workflowTemplates.ts`, adicionar tipo de step `kind: "lipsync"` com:
  - `provider: "kie"`, `model: "seedance-2"`.
  - `image_var`: referência ao output de um step de imagem (`{{step1.output}}`).
  - `audio_var`: referência ao output de um step de áudio (`{{step2.output}}`).
  - `params`: `duration`, `resolution`, `prompt` (descrição de fala/expressão).
- Em `StudioWorkflow.tsx` (editor), adicionar opção "Lipsync (Seedance 2)" no menu de adicionar step, com seletores de qual step fornece imagem e qual fornece áudio.

### 4. Edge Function `studio-workflow-run`

- Resolver `image_var` e `audio_var` para URLs concretas dos `step_outputs`.
- Chamar `studio-generate` internamente com `kind:"video"`, `provider:"kie"`, `model:"seedance-2"`, `image_url`, `params.reference_audio_urls=[audioUrl]`, `params.generate_audio=false`.
- Pollar `studio-generate-status` (já trata Kie genericamente — sem mudanças lá).

### 5. Template "Avatar Falante"

Em `src/data/studio/workflowTemplates.ts` adicionar:

```text
Step 1: Imagem (Kie nano-banana / Flux Kontext)
  → prompt: "Avatar premium olhando para a câmera, iluminação cinematográfica, 9:16"
Step 2: Áudio (ElevenLabs TTS)
  → prompt: texto da fala, voice_id selecionável
Step 3: Lipsync (Kie seedance-2)
  → image_var: {{step1.output}}
  → audio_var: {{step2.output}}
  → params: { duration: 10, resolution: "1080p", generate_audio: false }
```

### 6. Storage

- Reutilizar bucket `creative-assets` (já público) com prefixo `studio-audio/{userId}/`.
- Sem migração nova — `imphq_studio_generations.params` JSONB já guarda `reference_audio_urls`.

---

### Detalhes técnicos

- API Kie endpoint: `https://api.kie.ai/api/v1/jobs/createTask` com `model: "bytedance/seedance-2"` (verificar se precisa do prefixo `bytedance/` ou só `seedance-2` — alinhar com docs do Kie; default seguro: `bytedance/seedance-2`).
- Polling de resultado já funciona via `studio-generate-status` (lê `resultUrls[0]` / `videoUrl`).
- Validações no frontend: máx 3 URLs de áudio, áudio total ≤15s (aviso, sem bloqueio — Kie valida), duração do vídeo ≤15s.
- Sem alterações em RLS, tipos Supabase, ou tabela.

### Fora de escopo

- Medir duração real dos áudios localmente (deixar Kie validar).
- Geração paralela de múltiplos avatares no mesmo workflow.
- Editor de timing/legendas pós-lipsync.
