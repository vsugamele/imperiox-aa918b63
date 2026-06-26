## Objetivo

Trazer estrutura tipo Typebot para o `/funis` e `/openflow`: importar exports JSON, gerar fluxos completos a partir do briefing do produto (IA), e gerar imagens dos blocos automaticamente. Sem runtime público — fica como **blueprint editável dentro do Hub**, conectável aos ativos existentes.

---

## 1. Engenharia reversa do Typebot

Mapear o schema do export (`groups[]`, `blocks[]`, `events[]`, `edges[]`) para um formato interno unificado `FlowBlueprint`:

```text
FlowBlueprint
├── nodes[]      (= groups, com x/y do graphCoordinates)
│   └── blocks[] (text | image | input | choice | condition | set_variable | webhook | code | ai_prompt)
├── edges[]      (from → to, com source handle por bloco)
└── variables[]  (nome, default, tipo)
```

Tipos de bloco do Typebot a suportar inicialmente: `text`, `image`, `video`, `Set variable`, `Code`, `choice input`, `text input`, `email input`, `phone input`, `number input`, `condition`, `Wait`, `Redirect`, `Webhook`. Blocos desconhecidos viram `unknown` preservando JSON cru.

## 2. Importador `.json` (Typebot)

- Novo botão **"Importar Typebot"** na toolbar do `ProductHubCanvas` e no `OpenFlow Editor`.
- Componente `TypebotImporter.tsx`: file picker → parser `typebotToBlueprint(json)` → grava em `imphq_flow_blueprints` (nova tabela) → renderiza como subcanvas conectado ao produto-âncora.
- Preserva coordenadas originais (com offset) para manter o layout visual do Typebot.

## 3. Renderer de Blueprint (canvas)

Novo componente `FlowBlueprintCanvas.tsx` reutilizando o motor de pan/zoom/drag do `ProductHubCanvas`:

- Cada **node** = card colapsável (título do group + lista de blocos).
- Cada **block** com ícone e preview (texto truncado, thumb de imagem, label do input).
- **Edges** desenhadas como bezier SVG (igual ao Hub).
- Edição inline: clicar no bloco abre drawer lateral (`BlockEditorDrawer`) com campos por tipo.

## 4. Geração por IA (o core do pedido)

Nova Edge Function **`flow-generator`**:

**Input:** `{ project_id, produto_id, objetivo: 'quiz' | 'vsl' | 'chat_qualificacao' | 'pitch', tom?, canal? }`

**Pipeline:**
1. Busca briefing/avatar/branding do produto (`imphq_projects.data`).
2. Chama Gemini 2.5 Pro com `Output.object` (schema = `FlowBlueprint`) e prompt com:
   - Avatar (dor, desejo, objeções)
   - 19 regras Sugamele (já no projeto)
   - Estrutura alvo por objetivo (ex: quiz holográfico = Hook → 3-5 perguntas qualificadoras → diagnóstico → CTA com link)
3. Para cada bloco `image` retornado pela IA com `image_prompt`, dispara **job assíncrono** (`imphq_flow_image_jobs`) que chama `openai/gpt-image-2` via gateway e salva no bucket `flow-media` → atualiza o bloco com a URL.
4. Layout automático (algoritmo simples: BFS do start, espaçamento x=380, y=200, ramificações empilhadas).
5. Retorna `blueprint_id` para o canvas abrir imediatamente (imagens aparecem em streaming conforme jobs concluem, via realtime).

**UI:** botão **"Gerar fluxo com IA"** no Hub → modal com objetivo, tom, canal (chat/VSL/quiz) → após gerar, blueprint vira um nó-pacote no Hub conectado ao produto.

## 5. Imagens em qualquer bloco

- Cada bloco `image` no editor tem ações **Anexar / Gerar com IA / Regenerar**.
- Reusa o padrão do `ProductImageMenu` já existente (gpt-image-2 + bucket Supabase).
- Botão "Gerar todas faltantes" no header do blueprint.

## 6. Persistência

**Nova tabela `imphq_flow_blueprints`:**
```text
id uuid pk
project_id text
produto_id text null
title text
source 'typebot_import' | 'ai_generated' | 'manual'
objetivo text null
blueprint jsonb   (FlowBlueprint completo)
created_at, updated_at
```
+ GRANTs padrão + RLS (`auth.uid()` via membership do projeto, igual aos outros).

**Nova tabela `imphq_flow_image_jobs`:**
```text
id uuid pk
blueprint_id uuid fk
block_id text
prompt text
status 'pending' | 'done' | 'error'
url text null
```

**Novo bucket** `flow-media` (público, signed URLs 1 ano).

## 7. Integração com Hub e OpenFlow

- No `ProductHubCanvas`: blueprint vira um **asset de categoria "Funil interativo"** conectado ao produto. Duplo clique abre o `FlowBlueprintCanvas`.
- No `OpenFlow Editor`: aba "Importar de Blueprint" — converte nodes do blueprint em steps OpenFlow equivalentes (text/wait/condition) quando o usuário quiser jogar pro WhatsApp.

## 8. Entregáveis por ordem

1. Migration (tabelas + bucket + grants).
2. `lib/typebot-parser.ts` (engenharia reversa).
3. Edge Function `flow-generator` + `flow-image-worker`.
4. `FlowBlueprintCanvas.tsx` + `BlockEditorDrawer.tsx`.
5. `TypebotImporter.tsx` integrado no Hub.
6. Botão "Gerar fluxo com IA" no Hub + modal.
7. Realtime para imagens chegando em streaming.

## Detalhes técnicos

- Modelo de geração: `google/gemini-3-flash-preview` (estrutural) + `openai/gpt-image-2` quality `low`, streaming, `partial_images: 1` (imagens).
- Schema de `Output.object` enxuto para evitar "too many states" do Gemini (sem enums longos; tipos de bloco como string livre validada em pós-processamento).
- Coordenadas auto-layout: Dagre-like simples em JS (sem dep externa).
- Realtime: subscribe em `imphq_flow_image_jobs` filtrado por `blueprint_id` dentro do `useEffect` do canvas.

## Fora de escopo (nesta fase)

- Runtime público jogável (página `/q/:slug` que renderiza o quiz para leads). Fica para fase 2 quando o blueprint estiver maduro.
- Sincronização bidirecional com Typebot real (só importação, não export de volta).
