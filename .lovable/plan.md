# Fallback de UTM via Lead no Matching de Criativos

## Problema
Vendas da Ticto chegam com `utm_campaign`/`utm_content`/`utm_source` nulos em `imphq_vendas`, virando `unmatched`. Mas elas têm `lead_id` válido e o lead em `imphq_leads` tem os UTMs originais da captura.

## Solução
Em `src/lib/creativeLtv.ts`, ao buscar vendas, fazer JOIN/lookup com `imphq_leads` e herdar UTMs do lead quando a venda não tiver.

### Mudanças

**1. `src/lib/creativeLtv.ts` — `fetchCreativeDataset`**
- Coletar todos os `lead_id` únicos das vendas.
- Buscar `imphq_leads` (id, utm_campaign, utm_content, utm_source) em batch.
- Montar `Map<lead_id, utms>`.
- Antes de retornar `vendas`, preencher campos UTM nulos com os do lead correspondente. Marcar origem (`utm_source_origin: 'venda' | 'lead'`) para futuro debug se necessário.

**2. `MatchingReport`**
- Adicionar contadores `inheritedFromLead: { count, receita }` para visibilidade do quanto foi recuperado via fallback.

**3. `CreativeLtvTable.tsx`**
- No painel "Qualidade do Match", mostrar nova linha: "Herdado do lead: X vendas / R$ Y" em tom secundário.

### Fora do escopo
- Não muda webhook da Ticto (Opção B fica para depois).
- Não altera lógica de tiers (exact/adset/campaign continuam iguais — só ganham mais matérias-prima).

### Risco
Baixo. Fallback só preenche campos nulos; vendas com UTM próprio ficam intactas. Atribuição passa a refletir first-touch quando a plataforma não propaga UTM, o que é o comportamento esperado.