

# Plano: Melhorias no Painel do Expert

## Problemas identificados

1. **Não dá para limpar conteúdo gerado por semana** — sem botão para resetar/limpar uma semana
2. **Sem datas reais no calendário semanal** — os cards só mostram "seg, ter, qua..." sem indicar qual dia do mês
3. **Expert não sabe o contexto operacional** — não vê se tráfego está ligado, se tem campanha ativa, se tem automação rodando

## Mudanças

### 1. Botão "Limpar Semana" no painel interno

Adicionar um botão ao lado de cada aba de semana para limpar todos os cards daquela semana. Com confirmação antes de apagar.

**Arquivo**: `ProjetoExpertPanel.tsx`

### 2. Datas reais nos dias da semana

Calcular as datas reais (dd/MM) de cada dia baseado no mês corrente e na semana ativa. Exibir abaixo do label "SEG", "TER", etc. tanto no painel interno quanto no portal público.

**Arquivos**: `ProjetoExpertPanel.tsx`, `ExpertPortal.tsx`

### 3. Painel de Contexto Operacional (novo card)

Adicionar um card "📡 Status Operacional" visível no painel interno e no portal do expert com:

- **Tráfego**: se há conta de ads vinculada e investimento ativo (query `imphq_ad_accounts` + `imphq_ad_metrics`)
- **Campanhas WhatsApp**: campanhas ativas do projeto (`imphq_wa_campaigns` com status "active")
- **Automações**: total de automações ativas (`imphq_automacoes` do projeto)

No **portal público** (ExpertPortal), o edge function `expert-portal` precisa buscar esses dados e retorná-los no JSON.

**Arquivos**:
- `supabase/functions/expert-portal/index.ts` — adicionar queries para ads, campanhas WA e automações
- `ProjetoExpertPanel.tsx` — novo card com status operacional (busca client-side)
- `ExpertPortal.tsx` — exibir o card com dados vindos do edge function

### 4. Campo "Contexto do Movimento" (notas rápidas)

Adicionar um campo de texto curto no topo (junto aos objetivos) para o gestor escrever contexto operacional livre: "Tráfego ligado desde dia 5", "Campanha de reengajamento ativa", "Lançamento dia 20". Salvo no JSONB `data.movement_context`. Visível no portal público.

**Arquivos**: `ProjetoExpertPanel.tsx`, `ExpertPortal.tsx`, `expert-portal/index.ts`

## Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| `ProjetoExpertPanel.tsx` | Botão limpar semana, datas reais nos dias, card status operacional, campo contexto |
| `ExpertPortal.tsx` | Datas reais nos dias, card status operacional, campo contexto (read-only) |
| `expert-portal/index.ts` | Queries de ads, campanhas WA, automações + campo `movement_context` no response |

