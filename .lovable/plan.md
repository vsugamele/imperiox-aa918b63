## 🎬 Video Prompt Generator — Studio › aba "Vídeo"

Reaproveita a arquitetura do `HyperPromptGenerator` (imagem) mas com lógica própria de **camadas cinematográficas** e **templates por plataforma**.

### 1. Arquivos novos

```
src/components/studio/VideoPromptGenerator.tsx     ← UI principal (mesmo layout 12-col do Hyper)
src/components/studio/videoPromptOptions.ts        ← selects com micro-descrições
src/lib/videoPromptBuilder.ts                      ← buildVideoPrompt + buildVideoPromptJson
```

E uma nova aba `<TabsTrigger value="video">` em `src/pages/Studio.tsx` (ícone `Film`).

### 2. Estrutura de campos (6 camadas)

| Camada | Campos |
|---|---|
| 1. Ação física | `movimentoPrincipal` (ex.: "shuffles slowly and lays the deck on the table") |
| 2. Emoção corporificada | `movimentoCorpo`, `expressaoFacial`, `olharDirecao` |
| 3. Câmera | `movimentoCamera`, `velocidadeCamera`, `lente` (opcional) |
| 4. Áudio/atmosfera | `somAmbiente`, `musicaFundo`, `atmosferaMood` |
| 5. Voz/diálogo | `dialogo` (textarea), `tomVoz`, `idioma` |
| 6. Técnico | `duracao`, `estiloVisual`, `continuidade`, `aspectRatio`, `plataforma` |

Cada `option` é uma **frase pronta em inglês** (cinematográfica), com `label` em PT-BR. Ex.:
```ts
{ label: "Lentíssimo, quase imperceptível", value: "at an almost imperceptible pace" }
```

### 3. Templates por plataforma (`videoPromptBuilder.ts`)

Objeto `PLATFORM_TEMPLATES` com 4 dialetos:

- **veo3** — parágrafo cinematográfico descritivo em inglês
- **sora** — narrativo conciso, foco em ação+ambiente
- **runway** — comandos diretos, separados por vírgula
- **heygen** — prescritivo sobre avatar+gesto+fala

Cada template define a **ordem** e os **conectores** ("with a", "as the camera", "while"). Função única:
```ts
buildVideoPrompt(fields, platform): string
buildVideoPromptJson(fields): Record<string, any>   // sempre o mesmo schema
```

Esqueleto Veo3 (referência do usuário):
```
A cinematic video clip. {acao}. The character {corpo}, with a {expressao} expression,
{olhar}. The camera {camMov} {camVel}. Background ambient sound: {som}. Music: {musica}.
Overall mood: {mood}. [Character says in a {tom} voice in {idioma}: "{dialogo}".]
Duration: {dur}s. Visual style: {estilo}. Editing: {continuidade}.
```

### 4. UI (mesmo padrão editorial do Hyper)

Layout 12-col:
- **Esquerda (7 col)**: `Tabs` com 6 abas — Ação, Personagem, Câmera, Áudio, Voz, Técnico — uma camada por aba (elimina scroll).
- **Direita sticky (5 col)**:
  - Card **Plataforma** (select Veo3/Sora/Runway/HeyGen) — muda o output em tempo real
  - Card **Prompt — Texto** (parágrafo cinematográfico)
  - Card **Prompt — JSON** (schema estruturado, com botão copiar)
  - Card **Refinador IA** (botão chama `prompt-refiner` edge function existente em modo `editorial`)
- **Action bar inferior**: "Copiar texto", "Copiar JSON", "Salvar no Cofre", "Surpreender" (preenche random a partir dos presets)

### 5. Integrações reaproveitadas

- **Cofre**: salva em `imphq_prompts_salvos` com `tipo: 'video'` (já existe a tabela; só passar o tipo).
- **Refinador**: usa `supabase/functions/prompt-refiner` adicionando `mode: 'video_editorial'` (1 linha no switch).
- **Preview**: NÃO gera vídeo (custo alto). Apenas copy + salvar.

### 6. Fora de escopo

- Geração de vídeo via API (Veo/Sora ainda não acessíveis via Lovable AI Gateway).
- Migração de schema (usa `imphq_prompts_salvos` com campo `tipo`).
- Integração com avatar psicológico do projeto (Fase 2).

### Resultado

Studio passa a ter 8 abas: Gerar · Hyper (imagem) · **Vídeo (novo)** · Cofre · Workflow · Prompts · Avatar Plan · Playbook. Usuário escolhe plataforma, preenche 6 abas curtas, copia prompt cinematográfico pronto para colar em Veo3/Sora/Runway/HeyGen.

**Aprova pra eu implementar?**