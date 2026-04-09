

# Plano: Melhorar Painel Expert — Cards claros, perguntas na IA, conteudo mensal

## 3 melhorias pedidas

### 1. Cards de conteudo mais claros + perguntas antes de gerar com IA
Hoje o card do conteudo mostra apenas plataforma/tipo/descricao em texto minusculo (8px). E o botao "Gerar Plano com IA" nao faz perguntas — gera direto sem saber o objetivo do movimento.

**Solucao:**
- Redesenhar os cards de conteudo com icones por plataforma, cores por tipo, e layout mais legivel
- Adicionar campo "Objetivo do Movimento" no topo do plano de conteudo (ex: "Lançamento do produto X", "Aquecimento para webinar") — salvo em `data.content_objective`
- No dialog do AIGenerateButton para `generate_content_plan`, adicionar perguntas antes de gerar:
  - "Qual o objetivo do conteudo?" (texto livre)
  - "Frequencia de posts por dia?" (1-3)
  - "Plataformas prioritarias?" (multi-select)
- Essas respostas sao enviadas como `extraBody` para a edge function e injetadas no prompt da IA
- Botao "Consultar Mentes Sinteticas" que pre-seleciona a mente e gera sugestoes estrategicas antes do plano

### 2. Objetivo do movimento de conteudo
- Campo editavel no topo da secao de conteudo: "🎯 Objetivo do Movimento"
- Placeholder: "Ex: Aquecimento para lancamento, Autoridade no nicho, Captacao de leads..."
- Salvo em `data.content_objective`
- Injetado automaticamente no prompt da IA ao gerar plano

### 3. Plano mensal (4 semanas) em vez de semanal
- Trocar grid de 7 colunas (seg-dom) por navegacao de **4 semanas**
- Tabs ou selector: "Semana 1 | Semana 2 | Semana 3 | Semana 4"
- Cada semana tem os 7 dias com cards de conteudo
- Armazenamento: `data.content_plan` muda de `{seg: [], ter: []}` para `{semana_1: {seg: [], ter: []}, semana_2: {...}, ...}`
- A IA gera o mes inteiro de uma vez (4 semanas)
- O portal publico do expert tambem mostra as 4 semanas com navegacao

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/ProjetoExpertPanel.tsx` | Redesenhar cards, adicionar objetivo, navegacao mensal (4 semanas), perguntas pre-IA |
| `supabase/functions/openflow-ai/index.ts` | Atualizar `handleContentPlan` para aceitar objetivo + preferencias e gerar 4 semanas |
| `src/pages/ExpertPortal.tsx` | Atualizar portal publico para exibir 4 semanas com navegacao |
| `supabase/functions/expert-portal/index.ts` | Incluir `content_objective` na resposta |

## Ordem

1. Atualizar estrutura de dados para mensal (4 semanas) no ExpertPanel
2. Adicionar campo "Objetivo do Movimento" e perguntas pre-IA
3. Redesenhar cards de conteudo com icones e cores
4. Atualizar edge function para gerar plano mensal com objetivo
5. Atualizar portal publico para exibir 4 semanas

