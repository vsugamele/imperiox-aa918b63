## Unificar ângulos de criativo — catálogo único como fonte da verdade

Sim, faz sentido. Confirmei o diagnóstico: existe o catálogo dos 11 ângulos em `supabase/functions/_shared/creativeAngles.ts` (usado por `wa-ai-reply`, `creative-factory`, `nurture-generator`, `studio-batch-cron`), mas **`openflow-ai` (Fase 1) e `site-to-ecosystem` geram ângulos free-form** com schema próprio (`nome/gancho/promessa` ou `angulo/headline/prompt_imagem`), ignorando o catálogo. É exatamente a duplicação que você descreveu.

### Mudanças

**1. `_shared/creativeAngles.ts` — enriquecer o catálogo**
- Adicionar aos 11 ângulos existentes os campos que faltam para virar fonte da verdade:
  - `emocaoDominante` (medo, raiva, esperança, orgulho, culpa, curiosidade…)
  - `quandoUsar` (regra consciência × sofisticação: ex "consciência 2-3, sofisticação 1-2")
  - `estrutura` (headline → corpo → CTA — template curto)
  - `errosComuns` (2-3 bullets)
- Adicionar helpers:
  - `selectAnglesForBrief(brief, n)` — escolhe N ângulos evitando repetir `emocaoDominante`
  - `qualityChecklistBlock()` — bloco de texto do checklist (para injetar em prompt)
  - `anglesCatalogBlock()` — lista formatada dos 11 com nome/gatilho/emoção/quando usar

**2. `openflow-ai/index.ts` Fase 1 — parar de inventar ângulos**
- Substituir o schema `angles: { nome, gancho, promessa }` gerado do zero por:
  - Tool call que **seleciona** N ângulos do catálogo por `slug` + preenche `headline`, `corpo`, `cta` **dentro da estrutura de cada ângulo**
  - Schema: `angles: [{ slug: enum(ALL_SLUGS), headline, corpo, cta }]`
- Injetar `anglesCatalogBlock()` + `qualityChecklistBlock()` no system prompt da Fase 1
- Regra explícita no prompt: "não repita a mesma `emocaoDominante` em dois ângulos"
- Ajustar `anglesList` (linha 2107) e o parsing downstream para ler `slug` e hidratar via `ANGLE_BY_SLUG`

**3. `site-to-ecosystem/index.ts` — mesmo tratamento**
- Nos schemas de criativos imagem e vídeo (linhas 82-91): trocar `angulo: string` livre por `slug: enum(ALL_SLUGS)`
- Inserir catálogo + checklist no prompt
- Ao persistir (linhas 194-199), gravar `angulo: ANGLE_BY_SLUG[slug].nome` para manter a coluna atual legível

**4. `handleAvatarAngles` (linha 610) — mesma refatoração**
- `categoria` livre → `slug` do catálogo
- Regra de não repetir emoção

**5. Teste de contrato — novo `supabase/functions/openflow-ai/angles_test.ts`**
- Mocka o AI Gateway
- Chama Fase 1 com um briefing dummy
- Valida:
  - Resposta traz N ângulos
  - Todo `slug` retornado ∈ `ALL_SLUGS`
  - Nenhum ângulo com `headline`/`corpo`/`cta` vazio
  - `emocaoDominante` de cada ângulo é única no conjunto

**6. Skill `angulos-criativos` (draft em `.agents/skills/angulos-criativos/`)**
- SKILL.md aponta o catálogo canônico (o TS) como fonte da verdade
- `references/catalogo-angulos.md` gerado por script simples a partir do `CREATIVE_ANGLES` (ou apenas referencia o arquivo TS) para eliminar o conteúdo duplicado
- Preserva o modo manual (chat) usando o mesmo vocabulário do wizard

### Fora do escopo
- Não mexer em `wa-ai-reply`, `creative-factory`, `nurture-generator`, `studio-batch-cron` (já consomem o catálogo corretamente)
- Não alterar UI de `CriativoNovo.tsx` nem `src/data/creativeAngles.ts` (mirror do frontend continua)
- Não trocar modelo de IA nem gateway
