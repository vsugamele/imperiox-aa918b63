# Plano — Gerador de Avatar (Studio + Projeto)

Duas fases. Fase 1 entrega o impacto maior (Studio, onde você está agora). Fase 2 trata o avatar psicológico.

---

## FASE 1 — Studio › HyperPromptGenerator (persona/foto)

### A. Reestrutura de layout (UX — acabar com o scroll)

Trocar a pilha vertical de 8 `<Section>` por um **layout 12-col com 3 zonas**:

```text
┌──────────────────────────────────────────────────────────────┐
│  HEADER EDITORIAL (kicker · título serif · presets em chips) │
├────────────────────────────┬─────────────────────────────────┤
│  PAINEL ESQUERDO (8 col)   │  PREVIEW STICKY (4 col)         │
│  ┌──────────────────────┐  │  ┌───────────────────────────┐  │
│  │ Tabs internas:       │  │  │ Imagem (ou skeleton)      │  │
│  │ • Persona            │  │  │                           │  │
│  │ • Estilo             │  │  │  [Regenerar] [Variação]   │  │
│  │ • Câmera             │  │  ├───────────────────────────┤  │
│  │ • Acabamento         │  │  │ Prompt final (collapsed)  │  │
│  │ • Output             │  │  │ + chars + plataforma      │  │
│  └──────────────────────┘  │  │ [Copiar] [Refinar IA]     │  │
│  Form denso, 3-col grid    │  └───────────────────────────┘  │
└────────────────────────────┴─────────────────────────────────┘
│  ACTION BAR STICKY no rodapé (Gerar · Surpreender · Salvar)  │
```

- **Tabs** colapsam 8 seções → 5 grupos; só uma aberta por vez.
- **Preview sticky** (`position: sticky; top: 80px`) com a imagem + prompt ao lado, eliminando ida-e-volta.
- **Action bar sticky** no rodapé com as 3 ações principais; restantes em menu `…`.

### B. Linguagem editorial Híbrido

- Header com `brand-kicker` "STUDIO · PERSONA" + título Cormorant itálico "Gerador de Avatar".
- Section titles viram `nav-kicker` em gold/55 com hairline gold abaixo.
- Botão primário "Gerar" com 2px gold bar + glow (mesma do `nav-item-active`).
- Cards: `bg-secondary/20`, hairline `border-border/40`, sem bordas pesadas.
- Tipografia: labels em DM Sans 10px tracking 0.18em; valores em DM Sans 13px.

### C. Qualidade do prompt final

- **Reordenar tokens** no `hyperPromptBuilder` para o padrão que os modelos mais respeitam: `[medium] → [subject] → [action] → [environment] → [lighting] → [camera/lens] → [style/film] → [quality/negatives] → [params]`.
- **Pesos opcionais** em Midjourney (`::1.5`) para tokens críticos selecionados (toggle "ênfase" por campo).
- **Refinador IA agressivo**: novo modo "Refinar (estilo editorial)" que reescreve em 1 parágrafo cinematográfico denso, mantendo todos os tokens técnicos. Edge function `prompt-refiner` ganha parâmetro `mode: "compact"|"editorial"|"json"`.
- **Validador**: badge vermelho se faltar subject/medium; verde se prompt "completo".

### D. Iteração rápida no preview

- **4 variações em grid 2×2** ao invés de 1 imagem (chama `hyper-prompt-preview` em paralelo com seeds distintas).
- **Lock seed**: pin numa variação e regerar só ela com tweaks.
- **History strip**: thumbnails das últimas 6 gerações da sessão (em memória), clique reaplica fields+seed.
- **Compare A/B**: 2 prompts lado a lado (atual vs refinado).

### E. Controles que faltam

Novos campos em `HyperFields` + `hyperPromptOptions.ts`:
- `emocao` (joy, longing, melancholy, defiance…)
- `moodboard` (free text, vira "in the style of …")
- `referenciaImagem` (upload → base64 → enviado ao preview como image-to-image)
- `seed` (number, opcional, lockable)
- `tokensEnfase` (array de FieldKey com peso ::1.3)
- Hint "tokens proibidos" pré-preenchidos por plataforma (MJ não aceita `nsfw`, etc).

### Arquivos Fase 1

- `src/components/studio/HyperPromptGenerator.tsx` — reescrita do layout (tabs + sticky preview + action bar).
- `src/components/studio/hyperPanels/` (novo): `PersonaPanel.tsx`, `EstiloPanel.tsx`, `CameraPanel.tsx`, `AcabamentoPanel.tsx`, `OutputPanel.tsx` — extrair os blocos.
- `src/components/studio/PreviewSticky.tsx` (novo) — preview grid 2×2 + history strip.
- `src/lib/hyperPromptBuilder.ts` — nova ordem de tokens, suporte a `tokensEnfase`/`seed`, modo compact.
- `src/components/studio/hyperPromptOptions.ts` — novos campos (emocao, moodboard).
- `src/index.css` — só reaproveita utilities editoriais já existentes; sem novos tokens.
- `supabase/functions/hyper-prompt-preview/index.ts` — aceitar `count` (1..4), `seed`, `init_image`.
- `supabase/functions/prompt-refiner/index.ts` — parâmetro `mode`.

---

## FASE 2 — Projeto › ProjetoAvatar (psicológico)

Mesma linguagem editorial + 3 melhorias cirúrgicas:

1. **Header editorial** com kicker "PROJETO · AVATAR" + Cormorant itálico, e a **Saúde do Avatar** vira hero card (score grande + breakdown por aba).
2. **Tabs** com hairline gold ativa; remover emojis pesados, manter glifos sutis.
3. **Painel "Próxima ação"** no topo: lê `health` por aba e sugere "Rode pipeline de Dores" / "Adicione 3 desejos" — clicável.

Sem mudança de schema. Edição apenas em `ProjetoAvatar.tsx` e nas Tabs filhas (`PerfilTab`, `DesejosTab`, etc.) — só wrapper visual, **lógica intocada**.

### Arquivos Fase 2

- `src/components/projeto/ProjetoAvatar.tsx` — header + hero card de saúde + sugestão.
- `src/components/projeto/avatar/_shell.tsx` (novo) — wrapper editorial reutilizado por todas as Tabs.

---

## Fora de escopo

- Lógica do `prompt-refiner`/`hyper-prompt-preview` além dos parâmetros novos.
- Migração de schema Supabase.
- Mudar `imphq_prompts_salvos` ou cofre.
- Mexer no `StudioGenerator`/`StudioWorkflow`/`StudioPrompts` (só o HyperPromptGenerator).
- Lógica do pipeline de avatar (`AvatarPipelineRunner`).

---

## Ordem de execução

1. Fase 1A+B (layout + editorial) — entrega visível imediata.
2. Fase 1C (builder + refinador) — qualidade do output.
3. Fase 1D (preview 2×2 + history) — iteração.
4. Fase 1E (campos novos) — depois que a base estiver firme.
5. Fase 2 — quando aprovar Fase 1.

Posso executar Fase 1 inteira de uma vez, ou quebrar por bloco. Me diga.
