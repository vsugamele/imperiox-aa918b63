

# Plano: Botao IA no Market Intel + Integracao Skills/Mentes nos Projetos

2 blocos: um concreto (botao IA no Market Intel) e um de evolucao arquitetural (cruzamento Skills/Mentes com etapas do projeto).

---

## Bloco 1: Botao "Rodar com IA" no Market Intel

### O que fazer

Adicionar um `AIGenerateButton` na pagina `MarketIntel.tsx` que executa a skill Market Intel V2 via `openflow-ai` com `action: "execute_skill"`.

O botao ficara no header, ao lado do titulo. O usuario escolhe um projeto (opcional) e o modelo. A skill `market-intel-v2` sera carregada automaticamente do banco (`imphq_skills`) e injetada como contexto.

### Mudancas

**`src/pages/MarketIntel.tsx`**:
- Importar `AIGenerateButton`, `Select` para projeto, e states para projeto/resultado
- Adicionar seletor de projeto + botao AI no header
- Adicionar secao de resultado (Markdown renderizado) abaixo das tabs quando houver resultado
- Props do AIGenerateButton: `action="execute_skill"`, `extraBody={{ skill_slug: "market-intel", mode: "DISCOVERY" }}`

**`supabase/functions/openflow-ai/index.ts`** (handler `handleExecuteSkill`):
- Verificar se ja suporta `skill_slug` para buscar a skill correta do banco
- Se nao, adicionar fallback para buscar por slug/nome alem de `skill_id`

### Resultado esperado
O usuario clica "Pesquisa de Mercado com IA", seleciona projeto e modelo, a skill Market Intel V2 e injetada como system prompt com todo o contexto do projeto, e o resultado aparece renderizado em Markdown na pagina.

---

## Bloco 2: Onde Skills e Mentes podem agregar mais valor nos projetos

Apos analisar o sistema completo, identifiquei **5 pontos de integracao** onde Skills/Mentes poderiam ser acionadas diretamente nas etapas do projeto, em vez de exigir que o usuario va ate a pagina Mentes ou Skills.

### 2.1 Concorrentes → Skill "Funnel Hacker" + "Market Intel"
**Onde**: `ConcorrentesTab.tsx` / `DossieTab.tsx`
**O que**: Botao "Analisar Concorrente com IA" que injeta a skill Funnel Hacker + dados do concorrente e gera dossie automatico (posicionamento, funil, copy, ofertas).

### 2.2 Avatar → Skill "Avatar Architect" + "Dossie Problemas"
**Onde**: Tabs de Avatar (DoresTab, DesejosTab, ProblemasTab)
**O que**: Ja existe `AIGenerateButton` no PerfilTab e GatilhosTab. Falta nas abas Dores, Desejos, Problemas e Voyerismos. Adicionar com skills especificas injetadas.

### 2.3 Copy Arsenal → Skill "ANAMS Copywriter" + Mente selecionavel
**Onde**: `CopyArsenalSection.tsx`
**O que**: Ja tem AIGenerateButton. Evoluir para permitir escolher qual Mente (Dan Kennedy, Gary Halbert, etc.) sera usada como "personalidade" ao gerar o copy. Adicionar dropdown de Mente antes de gerar.

### 2.4 Emails → Skill "Sales Architect" + contexto do funil
**Onde**: `ProjetoEmails.tsx`
**O que**: Botao para gerar sequencia completa de emails (nurture, lancamento, carrinho) usando a skill Sales Architect com contexto total do projeto.

### 2.5 Briefing → Skill "Reposicionamento" + "Mecanismo Unico"
**Onde**: `ProjetoBriefing.tsx`
**O que**: Botao para gerar/refinar USP, mecanismo unico e big idea usando skills de posicionamento.

### Implementacao sugerida para Bloco 2

Em vez de implementar 5 integracoes separadas agora, a abordagem mais eficiente e:

1. **Evoluir o `AIGenerateButton`** para aceitar um prop `menteId` (opcional) que injeta a personalidade da Mente no system prompt
2. **Evoluir o `AIGenerateButton`** para aceitar um prop `skillSlugs: string[]` que carrega e injeta as skills especificas
3. **Adicionar no `openflow-ai`** um handler generico `execute_with_context` que combina: projeto + skills selecionadas + mente selecionada

Isso permite reusar o mesmo componente em todas as abas do projeto com configuracoes diferentes.

---

## Prioridade de implementacao

1. **Botao IA no Market Intel** (Bloco 1) — implementar agora
2. **AIGenerateButton nas abas de Avatar que faltam** (2.2) — rapido, reusa pattern existente
3. **Evoluir AIGenerateButton com menteId/skillSlugs** (infraestrutura para 2.1-2.5) — proximo passo

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/MarketIntel.tsx` | Seletor de projeto + AIGenerateButton + area de resultado |
| `supabase/functions/openflow-ai/index.ts` | Suporte a `skill_slug` no handleExecuteSkill |
| `src/components/projeto/avatar/DoresTab.tsx` | Adicionar AIGenerateButton |
| `src/components/projeto/avatar/DesejosTab.tsx` | Adicionar AIGenerateButton |
| `src/components/projeto/avatar/ProblemasTab.tsx` | Adicionar AIGenerateButton |
| `src/components/projeto/avatar/VoyerismosTab.tsx` | Adicionar AIGenerateButton |

