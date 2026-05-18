## Plano — Hyper Prompt v2 (polir + Cofre + Criativos)

Foco em 3 frentes integradas. Sem mexer em outras áreas do sistema.

---

### 1. Hyper Prompt — polir & extras

**Novos campos** em `hyperPromptOptions.ts` + `hyperPromptBuilder.ts`:
- Composição (rule of thirds, centered, leading lines, dutch angle…)
- Aspect ratio (`--ar 9:16`, `1:1`, `16:9`, `2:3`, `21:9`)
- Plataforma alvo (Midjourney / DALL·E / Firefly / Sora / Flux) → muda sufixos automáticos (`--v 7 --s 250`, `--style raw` etc.)
- Negative prompt (campo livre opcional, anexa `--no ...` no MJ)
- Estilo de pós (grain intensity, halation, bloom)

**Presets por nicho** (botões no topo que pré-preenchem campos):
- Cartomante místico, Coach executivo, Fitness, Lifestyle premium, Produto e-commerce, Retrato editorial
- Salvos em `src/data/studio/hyperPresets.ts`

**UX**:
- Barra fixa no topo do prompt gerado com contagem de caracteres + plataforma alvo
- Botão "🎲 Surpreenda-me" → randomiza campos vazios
- Persistência de rascunho em `localStorage` (`hyperPrompt:draft`)

---

### 2. Cofre — organização

Adicionar colunas em `imphq_prompts_salvos` (migration):
- `tags TEXT[]` (já existe no plan original, confirmar)
- `favorito BOOLEAN DEFAULT false`
- `plataforma TEXT` (mj/dalle/firefly/sora)
- `thumbnail_url TEXT` (preview gerado, opcional)

Refatorar `HyperPromptVault.tsx`:
- Busca por nome/tags (input no topo)
- Filtros: plataforma, favoritos, projeto
- Toggle ⭐ favorito inline
- Duplicar prompt (clona como novo)
- Editar nome/tags inline

---

### 3. Integração Criativos — preview real

**Nova edge function** `hyper-prompt-preview`:
- Recebe `{ prompt }`
- Chama Lovable AI Gateway com `google/gemini-2.5-flash-image` (Nano Banana)
- Retorna `image_base64` ou faz upload no bucket `studio-previews` e retorna URL
- Salva em `thumbnail_url` se `save_to_vault_id` for passado

**No HyperPromptGenerator**:
- Botão "🖼️ Gerar Preview" ao lado de "Refinar com IA"
- Mostra imagem inline (Card 512×512) com botões: Baixar / Regerar / Anexar a Criativo

**Fluxo "Usar em Criativo"** (melhorar o atual):
- Em vez de só sessionStorage, criar registro temporário em `imphq_criativos_drafts` (ou usar sessionStorage com mais campos) contendo: `prompt_text`, `refined_text`, `preview_url`, `plataforma`, `campos`
- `/criativos/novo` lê e pré-preenche prompt visual + anexa preview como referência

---

### Arquivos afetados

```
src/components/studio/HyperPromptGenerator.tsx   (editar)
src/components/studio/HyperPromptVault.tsx       (refatorar)
src/components/studio/hyperPromptOptions.ts      (adicionar campos)
src/lib/hyperPromptBuilder.ts                    (sufixos por plataforma)
src/data/studio/hyperPresets.ts                  (novo)
src/pages/CriativoNovo.tsx                       (ler preview_url)
supabase/functions/hyper-prompt-preview/index.ts (nova)
supabase/migrations/<nova>                       (tags/favorito/plataforma/thumbnail)
```

---

### Ordem de execução

1. Migration (tags/favorito/plataforma/thumbnail) — requer aprovação
2. Builder + opções novas + presets (frontend puro)
3. Cofre refatorado (busca/filtros/favoritos)
4. Edge function de preview + botão no gerador
5. Pipeline Criativo com preview anexado

Posso fazer tudo de uma vez ou fatiar em 2 entregas (1+2+3 primeiro, depois 4+5). Qual prefere?
