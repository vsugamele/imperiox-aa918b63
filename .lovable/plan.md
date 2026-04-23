

## Creative Factory 2.0 — Integração total com o projeto

### Diagnóstico do que existe hoje

**O que funciona:**
- Geração via Gemini Image (`google/gemini-3-pro-image-preview`) com 7 ângulos.
- Edição de imagem por instrução textual.
- Versionamento (parent → child) e ZIP/export pra Mídias.
- Upload de fotos do expert + scrape de referências (Firecrawl).

**O que tá fraco:**
1. **Briefing 100% manual** — usuário re-digita produto/dor/desejo toda vez, mesmo já existindo no Avatar/Briefing do projeto.
2. **Não usa o Avatar** — perde dores, desejos, gatilhos, copy arsenal e camadas C1-C4 já mapeadas.
3. **Não usa concorrentes escalados** — perde melhor referência de mercado disponível.
4. **Não usa fotos do expert salvas no projeto** — expert_fotos é upload avulso.
5. **Não usa identidade visual** (cores, tipografia, logo) salva em `ProjetoBranding`.
6. **Headlines isoladas** — não puxam Copy Arsenal já validado.
7. **Sem opção de provider** — só Gemini. Sem GPT-Image-1 da OpenAI (que costuma render texto/rosto melhor).
8. **Saída não volta pro projeto** — vai pra biblioteca de mídias global, sem categoria/pasta por batch nem vínculo com um produto específico.

---

### Plano em 3 sprints

#### Sprint E1 — Auto-preenchimento do projeto (alto impacto, baixo esforço)

**Em `CriativoNovo.tsx`:**
- Ao escolher projeto, **carregar automaticamente**:
  - Avatar ativo do produto (se houver) → preenche dor/desejo/mecanismo.
  - Briefing do projeto → produto, público.
  - Branding → cores e estilo visual no campo "extras".
  - Top 3 dores e desejos → mostra como "puxar" (chips clicáveis).
  - Headlines do Copy Arsenal → mostra abaixo pra reaproveitar.
  - Fotos do expert salvas em `imphq_content_library` com tag `expert` → checkboxes ao invés de upload.
  - Top concorrentes escalados → URLs pré-preenchidas como referência.
- Toggle "**Modo Automático**": sem briefing — IA monta o briefing sozinha a partir do projeto + produto escolhido.
- Seletor de **Produto específico** (lista de `imphq_products`) → IA usa ticket/promessa do produto.

**Resultado:** usuário escolhe projeto + produto + ângulos → clica gerar. Zero digitação.

---

#### Sprint E2 — Provider OpenAI (gpt-image-1) + escolha por job

**Por que:** gpt-image-1 da OpenAI renderiza **texto na imagem** muito melhor que Gemini (essencial pra criativos com headline overlay) e mantém **fidelidade de rosto** com referência.

**Implementação:**
- Adicionar campo `provider` no `imphq_creative_batches` (`gemini` | `openai`).
- Adicionar secret `OPENAI_API_KEY` no Supabase (peço aprovação na execução).
- Em `creative-factory/index.ts`, criar `generateImageOpenAI()` que chama `https://api.openai.com/v1/images/generations` com `model: "gpt-image-1"`, `quality: "high"`, `size` mapeado por formato (1024x1024 / 1024x1536 / 1536x1024).
- Para edição com referência (expert_fotos), usar `https://api.openai.com/v1/images/edits` (suporta image input + prompt).
- UI: toggle no `CriativoNovo` "Provider: Gemini (rápido/barato) | OpenAI gpt-image-1 (premium, melhor texto+rosto)".
- Fallback automático: se OpenAI falhar (rate/credits), tenta Gemini e marca o asset.

**Custo transparente:** mostrar estimativa por provider antes de gerar (~$0.04 Gemini vs ~$0.19 OpenAI HD).

---

#### Sprint E3 — Salvar de volta no projeto (loop fechado)

**Hoje:** export joga em `imphq_content_library` sem categoria → some na biblioteca.

**Mudanças:**
- Cada batch vira uma **pasta virtual em Mídias**: `content_category = "criativos/{batch_nome}"` (já segue padrão de pastas virtuais existente).
- Cada asset salvo carrega tags: `criativo`, `ia`, `{angulo}`, `{produto}`, `{provider}`.
- Adicionar **aba "Criativos IA"** dentro de `ProjetoDetalhe` (`ProjetoCentralConteudo` ou nova aba) listando todos os batches do projeto, com mini-grid de aprovados.
- Botão "**Reutilizar este criativo**" em qualquer asset → leva pro `Criativos > novo` com briefing pré-preenchido daquele batch.
- Ao publicar criativo no Meta Ads (futuro hook), marcar `imphq_creative_assets.published_at` pra fechar loop performance ↔ criativo.

**Banco (migration pequena):**
```sql
ALTER TABLE imphq_creative_batches
  ADD COLUMN provider TEXT DEFAULT 'gemini',
  ADD COLUMN product_id TEXT,
  ADD COLUMN auto_briefing BOOLEAN DEFAULT false;

ALTER TABLE imphq_creative_assets
  ADD COLUMN provider TEXT,
  ADD COLUMN published_at TIMESTAMPTZ;
```

---

### Ordem sugerida de execução

| Sprint | Foco | Esforço |
|---|---|---|
| **E1** | Auto-preencher do Avatar/Briefing/Branding/Concorrentes | Médio (1 arquivo + queries) |
| **E2** | Provider OpenAI gpt-image-1 + seletor | Médio (edge function + UI + secret) |
| **E3** | Salvar como pasta no projeto + aba "Criativos IA" no projeto | Médio (migration + 1 componente novo) |

### Fora de escopo (próxima rodada)
- Geração de **vídeo** (Sora/Runway).
- A/B test automático no Meta Ads.
- Score preditivo de CTR antes de publicar (precisa histórico).

### Pergunta antes de executar

Provider OpenAI: ativo **gpt-image-1** (melhor mas pago — você precisa colocar `OPENAI_API_KEY`) ou prefere ficar só no Gemini por enquanto e adicionar OpenAI depois?

Aprova começar por **E1** (auto-preenchimento — ganho imediato, sem dependência externa) e seguir E2 → E3?

