# Melhorias propostas para o módulo de Ads

Análise feita em `/gerenciador` (Meta Manager Pro) e `Finanças → Ads` (FinancasAds.tsx, 710 linhas). O backend já captura mais dados do que a UI mostra — boa parte das melhorias é desbloquear o que já existe.

---

## 1. Preview visual dos criativos (thumbnail)

**Problema:** `facebook-ads-sync` já busca `creative.thumbnail_url` e `image_url` da Meta, mas a tabela hierárquica não mostra. O usuário fica adivinhando qual anúncio é qual pelo nome.

**Solução:**
- Persistir `thumbnail_url` em `imphq_ads_spend` no nível `ad` (coluna nova).
- Na linha de Ad (3º nível do drilldown), exibir miniatura 32×32 ao lado do nome.
- Hover → preview 240×240 em popover com `body` + `title` do criativo.

---

## 2. Comparação período anterior (Δ%)

**Problema:** o usuário vê CPA hoje, mas não sabe se piorou ou melhorou vs. período anterior. O Meta Manager mostra setinhas ▲▼ em todas as colunas.

**Solução:**
- Buscar dois ranges (atual + anterior do mesmo tamanho) em paralelo.
- Em cada célula numérica (CPA, ROAS, CTR, CPM, gasto, compras), badge `+12%` verde / `-8%` vermelho.
- Toggle no header: "vs. período anterior" on/off.

---

## 3. Sparkline de tendência por linha

**Problema:** decisão de pausar/escalar precisa de série temporal. Hoje exige clicar e abrir outra tela.

**Solução:**
- Mini-gráfico 80×24px na coluna ROAS (ou CPA) mostrando os últimos 7 dias.
- Reusa Recharts (já no projeto).

---

## 4. Diagnóstico Yoshitani inline no Gerenciador

**Problema:** o diagnóstico 7/5/3 só aparece em `Finanças → Ads`, não no `/gerenciador`. Quem está pausando/ativando não vê o veredito.

**Solução:**
- Coluna `VEREDITO` opcional (toggle no popover de colunas) com badge: ESCALAR / MANTER / OTIMIZAR / MATAR.
- Tooltip com motivo (gargalo + manobra recomendada).
- Reaproveita `analyzeCampaigns()` já implementada.

---

## 5. Filtros rápidos de status + presets

**Problema:** lista única com tudo misturado. Difícil isolar "campanhas ativas com ROAS < 1" ou "pausadas que vendiam bem".

**Solução:**
- Chips no topo da tabela: `Todas` · `Ativas` · `Pausadas` · `Com vendas hoje` · `ROAS < 1` · `Sem dados (24h)`.
- Filtro por intervalo de gasto (slider min/max).

---

## 6. Alertas automáticos no header

**Problema:** problemas críticos (campanha gastando sem vender, frequência > 4, conta com erro) só aparecem depois que o usuário cava.

**Solução:**
- Banner no topo do `/gerenciador` com 3 alertas prioritários:
  - "2 campanhas gastaram >R$200 hoje sem nenhuma compra"
  - "Campanha X com frequência 5.8 (saturação)"
  - "Conta de anúncios desconectada há 2h" (já existe `FacebookHealthAlert`, integrar)
- Cada alerta clicável → filtra a tabela.

---

## 7. Ações em massa avançadas

**Já temos:** Pausar / Ativar / Duplicar.

**Adicionar:**
- `Aumentar orçamento +20%` em massa (escala segura).
- `Diminuir orçamento -20%` em massa.
- `Exportar selecionadas` (CSV só do que está marcado).

---

## 8. Edição inline do nome da campanha

Hoje só orçamento é editável. Permitir renomear (útil para padronizar `[DD/MM] Nome` que o `analyzeCampaigns` já normaliza).

---

## 9. KPI cards no topo do Gerenciador

**Problema:** o `/gerenciador` vai direto pra tabela. Faltam números agregados.

**Solução:** 4 cards no topo (estilo `KpiHeroCard`): Gasto total · ROAS médio · Compras · CPA médio — todos com Δ% vs período anterior.

---

## 10. Histórico de mudanças por linha

**Problema:** `imphq_ads_actions` registra tudo mas só aparece em `AcoesHistorico` (lista global no rodapé).

**Solução:** ícone 🕐 no fim de cada linha → popover com últimas 5 ações daquela campanha (quem pausou, quando mudou orçamento, etc).

---

## Prioridade sugerida

| # | Esforço | Impacto |
|---|---------|---------|
| 1 Thumbnails | Médio (migration + sync + UI) | **Alto** — reconhecimento visual |
| 2 Δ% período anterior | Médio | **Alto** — decisão informada |
| 6 Alertas no header | Baixo | **Alto** — proatividade |
| 9 KPI cards topo | Baixo | Médio |
| 4 Veredito inline | Baixo (reusa código) | **Alto** |
| 5 Filtros rápidos | Baixo | Médio |
| 3 Sparkline | Médio | Médio |
| 7 Ajuste orçamento massa | Baixo | Médio |
| 10 Histórico por linha | Baixo | Baixo |
| 8 Renomear inline | Baixo | Baixo |

---

## Próximo passo

Me diga quais itens quer atacar agora. Sugestão de primeira leva (1 sprint curto):
**#1 Thumbnails + #2 Δ% + #4 Veredito inline + #6 Alertas no header + #9 KPI cards.**

Isso transforma o `/gerenciador` num cockpit de decisão completo, sem precisar abrir outras telas.
