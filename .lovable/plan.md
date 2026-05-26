# Permitir múltiplos links no modal de Estatísticas do Distribuidor

## Diagnóstico

No print, só aparece **1 linha** (`120363426598002237@g.us`) com campos Peso + Link, mesmo o distribuidor podendo ter vários grupos. Causa: em `GroupDistributor.tsx` → `loadClickStats()` só monta linhas a partir de `imphq_wa_distributor_clicks`. Grupos do `redirect_order` que ainda não receberam clique ficam invisíveis e ficam sem como configurar peso/link.

## Mudança (apenas frontend, escopo do modal)

Arquivo: `src/components/whatsapp/GroupDistributor.tsx`

1. Em `loadClickStats(distributorId)`: depois de montar `countMap` a partir dos cliques, fazer merge com `showStats.redirect_order` (lista oficial de grupos do distribuidor), inserindo `count: 0` para os ausentes. Ordenar pela ordem de `redirect_order`.
2. Quando o modal abre sem cliques ainda, popular `clickStats` com todos os grupos zerados em vez de mostrar "Nenhum clique registrado ainda" — substituir esse vazio por uma mensagem mais leve só quando `redirect_order` também estiver vazio.
3. Adicionar mini ação "➕ Adicionar grupo extra" abaixo da lista (input JID + botão) que faz append em `redirect_order` e salva via `update({ redirect_order: [...] })`. Útil para incluir um grupo de overflow que não vinha da campanha original.
4. Botão 🗑 ao lado de cada linha para remover o grupo de `redirect_order` (com confirm) — espelha o comportamento das semanas.

Nenhuma mudança em Edge Function, schema, ou na rotação semanal (essa parte já suporta N semanas via "+ Semana").

## Resultado esperado

O modal de Estatísticas passa a listar todos os grupos do distribuidor, cada um com Peso + Link de convite editáveis, mesmo sem cliques. Usuário também consegue adicionar/remover grupos diretamente ali, sem precisar editar a campanha de origem.
