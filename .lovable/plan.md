

# Plano: Fix Reembolso + Ads Sync + Filtro Criativos

---

## Diagnóstico dos problemas

### 1. Ads mostrando valor errado em Abril
O banco tem **apenas 2 registros em abril**: 01/04 (R$59.69) e 02/04 (R$15.94) = **R$75.63 total**. Se voce gastou R$150+, os dias 03/04 e 04/04 **nao foram sincronizados**. O filtro "Este mes" funciona corretamente — o problema e que falta rodar o sync para os dias mais recentes.

**Solucao**: Quando clicar "Sincronizar Facebook" no ProjetoFinancas, enviar automaticamente as datas do filtro ativo (ou do mes atual se "Todo periodo"). Adicionar tambem um botao "Atualizar hoje" que force sync do dia atual. E mostrar a data do ultimo sync visivel para o usuario saber quando foi atualizado.

### 2. Jornada do lead — Reembolso nao registrado corretamente
O webhook `webhook-pagamento` quando recebe `reembolso`:
- **Nao** atualiza a venda existente para "reembolsado"
- **Nao** atualiza o status do lead
- Se nao existia venda anterior, nao cria registro retroativo

A timeline no Leads.tsx filtra vendas por `status = "aprovado"`, escondendo reembolsos.

### 3. Criativos sem filtro de busca
Todos os criativos aparecem juntos. Com muitos criativos, nao da para encontrar os ativos rapidamente.

---

## Correcoes

### Arquivo 1: `supabase/functions/webhook-pagamento/index.ts`

**Tratar reembolso**:
- Quando `evento === "reembolso"` e `leadId` existe:
  - Buscar venda existente do lead (mesmo produto ou qualquer) → update `status: "reembolsado"`
  - Se nao existir venda, criar uma com status "reembolsado" (historico retroativo)
  - Atualizar status do lead: se tem outras vendas aprovadas manter "cliente", senao voltar para "lead"

### Arquivo 2: `src/components/projeto/ProjetoFinancas.tsx`

**Sync com datas**:
- Botao "Sincronizar Facebook" envia `date_from` e `date_to` do filtro ativo
- Mostrar "Ultimo sync: DD/MM" baseado no `data_ref` mais recente dos ads
- Se o periodo filtrado mostra valor menor que o total, exibir "(total historico: R$ X.XX)" nos KPIs

**Filtro de criativos**:
- Select: "Todos" / "Ativos" / "Inativos"
- Input de busca por nome do criativo
- Contagem visivel (ex: "12 ativos, 88 inativos")

### Arquivo 3: `src/pages/Leads.tsx`

**Timeline com todos os status de venda**:
- Remover filtro `eq("status", "aprovado")` na query de vendas da timeline
- Diferenciar visualmente: aprovado (verde), reembolsado (vermelho com icone de refund)

---

## Resumo

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/webhook-pagamento/index.ts` | Tratar reembolso: update venda + status lead |
| `src/components/projeto/ProjetoFinancas.tsx` | Sync com datas, ultimo sync, contexto total nos KPIs, filtro criativos |
| `src/pages/Leads.tsx` | Timeline com vendas de todos os status |

---

## Ordem

1. Fix webhook reembolso
2. ProjetoFinancas: sync com datas + filtro criativos + KPIs contextuais
3. Leads: timeline completa

