

# Plano: Pastas em Mídia, Stories no Plano de IA, Seletor de Skills e Contexto Enriquecido

## Resumo

4 melhorias interligadas: (1) organização por pastas na Mídia, (2) opção de Stories na geração de plano com IA, (3) seletor de Skills no dialog de IA, (4) cruzamento de mais dados de contexto nas gerações.

---

## 1. Pastas na Mídia & Conteúdo

**Arquivo**: `src/components/projeto/ProjetoMidia.tsx`

Atualmente os conteúdos são organizados apenas por categoria (Reels, Stories, Anúncios, Feed). Adicionar suporte a subpastas:

- Adicionar campo `folder` no state local (sem necessidade de migração — usar a coluna `tags` ou `description` como metadata, ou adicionar filtro via prefixo no `content_category` ex: `reels/semana-1`)
- UI: Acima do grid, mostrar barra de pastas tipo breadcrumb com botão "Nova Pasta"
- Implementar como filtro client-side — `content_category` vira `tipo/pasta` (ex: `reels/campanha-abril`)
- Permitir mover itens entre pastas via dialog de edição (já existe o `editDialog`)
- Mostrar pastas como cards clicáveis antes dos arquivos quando há subpastas

**Abordagem simples**: Usar a coluna existente `content_category` com formato `tipo/subpasta` — sem migração DB.

## 2. Sequência de Stories no Dialog de IA

**Arquivo**: `src/components/projeto/ProjetoExpertPanel.tsx`

No dialog "Configurar Plano com IA" (linha ~894), adicionar campo:
- **"Sequência de Stories por dia?"** — Select com opções: "Nenhum", "3 stories", "5 stories", "7 stories", "10 stories"
- Passar esse valor como `stories_per_day` no `extraBody` do `AIGenerateButton`
- A Edge Function já recebe `extraBody` e injeta no prompt — basta adicionar instrução: "Inclua X stories sequenciais por dia com narrativa encadeada"

## 3. Seletor de Skills no Dialog de Geração

**Arquivo**: `src/components/projeto/AIGenerateButton.tsx`

Adicionar prop opcional `showSkillSelector` e um novo campo no dialog:
- **"Skills a aplicar"** — Multiselect com checkboxes das skills disponíveis (importar `SKILLS_DATA` de `skillsData.ts`)
- Skills selecionadas são enviadas como `skill_slugs: string[]` no body
- A Edge Function pode usar os prompts das skills como contexto adicional
- No dialog "Configurar Plano com IA", ativar `showSkillSelector`

**Arquivo**: `src/components/projeto/ProjetoExpertPanel.tsx`
- Passar `showSkillSelector` no `AIGenerateButton` do plano mensal

## 4. Enriquecer Dados de Contexto

**Arquivo**: `src/components/projeto/AIGenerateButton.tsx`

Atualmente o `contextSources` é visual (badges). Adicionar mais fontes de dados ao contexto real:
- Mostrar badges adicionais: "Concorrentes", "Vendas/ROAS", "Dossiê", "Copy Arsenal", "KPIs de Ads"
- No `ProjetoExpertPanel`, expandir `contextSources` para incluir: `["Briefing", "Avatar", "Expert", "Brand Kit", "Concorrentes", "Vendas", "Copy Arsenal"]`

**Arquivo**: `supabase/functions/openflow-ai/index.ts`
- Na action `generate_content_plan`, buscar dados adicionais do projeto:
  - `data.copy_arsenal` (promessa, mecanismo, big idea)
  - `data.concorrentes` (resumo dos concorrentes)
  - KPIs de vendas recentes (`imphq_vendas` count + soma)
  - Dados de ads ativos (CPL, CPA do `imphq_ads_spend`)
- Injetar no system prompt para gerar conteúdo mais alinhado à estratégia real

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/projeto/ProjetoMidia.tsx` | Sistema de pastas (filtro por prefixo em content_category) |
| `src/components/projeto/ProjetoExpertPanel.tsx` | Campo "Stories por dia" + `showSkillSelector` |
| `src/components/projeto/AIGenerateButton.tsx` | Seletor de Skills (multiselect) |
| `supabase/functions/openflow-ai/index.ts` | Injetar mais contexto (concorrentes, vendas, arsenal, ads) |

