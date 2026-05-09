# Plano: Geração de Imagem com Kie GPT Image 2 + Luma uni-1

## Objetivo
Expandir o Studio de geração para suportar **dois novos provedores de imagem**:
1. **Kie.ai → GPT Image 2** (texto→imagem + edição com `image_input`)
2. **Luma Agents API → uni-1** (oficial, via `LUMA_API_KEY`)

## Mudanças

### 1. Secrets
- Solicitar `LUMA_API_KEY` (Luma Agents API). `KIE_API_KEY` já existe.

### 2. Edge Function `studio-generate` (`supabase/functions/studio-generate/index.ts`)
- Ampliar o tipo `provider` para incluir `"luma"`.
- Tratar `kind: "image"` para **Kie**:
  - Endpoint: `POST https://api.kie.ai/api/v1/jobs/createTask`
  - Body: `{ model: "gpt-image-2", input: { prompt, image_input?, size, quality } }`
  - Retorna `taskId` → status `processing` (já existe polling para Kie em `studio-generate-status`).
- Tratar `kind: "image"` para **Luma uni-1**:
  - Endpoint: `POST https://api.lumalabs.ai/agents/v1/generations`
  - Header: `Authorization: Bearer ${LUMA_API_KEY}`
  - Body: `{ model: "uni-1", type: "image" | "edit", prompt, image?: { url } , aspect_ratio }`
  - Resposta inclui `id` e (após poll) `assets.image`. Salvar `external_id`, status `processing`.

### 3. Edge Function `studio-generate-status`
- Hoje só polla Kie. Adicionar branch para `provider === "luma"`:
  - `GET https://api.lumalabs.ai/agents/v1/generations/{id}` com `Authorization: Bearer LUMA_API_KEY`
  - Quando `state === "completed"`, baixar `assets.image` e salvar no bucket `creative-assets` (reusar `uploadFromUrl`).
- Para Kie GPT Image 2: ao completar, a resposta traz `resultUrls[]` ou `imageUrl` — baixar e fazer upload pro bucket.

### 4. Frontend `src/components/studio/StudioGenerator.tsx`
- Hoje **imagem** só aceita `provider: "openrouter"`. Adicionar seletor de provider para imagem (igual ao de vídeo):
  - `openrouter` (Gemini / Recraft — já existente)
  - `kie` → modelo `gpt-image-2`
  - `luma` → modelo `uni-1`
- Adicionar campo opcional `image_input` (URL) no formulário de imagem para edição (usado por GPT Image 2 e Luma uni-1).
- Adicionar campo `aspect_ratio` para Luma (ex.: `1:1`, `9:16`, `16:9`).
- O auto-poll atual filtra `i.status === "processing" && i.external_id` — já vai funcionar para ambos novos provedores; só ampliar o filtro para incluir `provider in ("kie","luma")`.

### 5. UX
- Mostrar badge "assíncrono" nos novos provedores e nota "1–2 min para concluir".
- Mensagens de erro claras quando faltar `LUMA_API_KEY` ou `KIE_API_KEY`.

## Detalhes técnicos
- IDs dos modelos confirmados:
  - Kie: `gpt-image-2` (https://kie.ai/gpt-image-2)
  - Luma: `uni-1` (https://docs.agents.lumalabs.ai/guides/model/)
- Persistência: linhas em `imphq_studio_generations` com `provider`, `model`, `external_id`, `status`, `output_url` (já existe).
- Upload final sempre vai para o bucket `creative-assets` para servir publicamente e evitar URLs voláteis.

## Fora de escopo
- `uni-1-max` (você pediu só `uni-1`).
- Vídeo da Luma (Dream Machine) — não solicitado.
