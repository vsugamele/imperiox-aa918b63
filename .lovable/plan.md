

# Plano: Snippet Visual + Investimento Correto + Criativos Nítidos

---

## 3 Problemas Identificados

### 1. Snippet gera HTML cru sem estilo visual
O snippet gerado pelo FormBuilder produz `<select>`, `<input>`, `<textarea>` puros sem CSS. Quem colar na LP recebe campos sem formatação — sem visual bonito, sem radio buttons, sem opções clicáveis estilizadas.

**Solução**: Melhorar `getSnippetHTML()` para:
- Incluir CSS inline embutido (dark theme, inputs estilizados, selects bonitos)
- Adicionar novo tipo de campo `radio` (Sim/Não, opções clicáveis) na interface `FormField`
- Adicionar tipo `checkbox` para múltipla escolha
- Gerar o HTML com classes e estilos prontos para usar
- Adicionar preview ao vivo no Dialog do snippet (iframe com o HTML renderizado)

### 2. Investimento em Ads não bate com o Gerenciador
O problema é que a edge function `facebook-ads-sync` puxa dados no nível `ad` com `time_increment=1` (diário por anúncio). Quando o filtro de data no ProjetoFinancas não coincide exatamente, ou quando há duplicação por ad/adset, os totais divergem.

**Solução**:
- Na edge function: adicionar campo `date_from` e `date_to` no request de sync para respeitar o período selecionado pelo usuário
- No ProjetoFinancas: ao clicar "Sincronizar", enviar as datas do filtro ativo (período selecionado) para a edge function
- Garantir que o upsert não duplique registros (já faz por campaign+adset+ad+date)

### 3. Criativos embaçados + sem distinção ativo/inativo
A edge function busca `thumbnail_url` do Facebook — essa URL é uma miniatura de baixa resolução (~64px). Além disso, não há campo `status` sendo puxado dos criativos, e todos aparecem iguais.

**Solução**:
- Na edge function: buscar `image_url` (já busca!) e `effective_status` do ad que usa o creative. Buscar ads com `fields=creative{id},effective_status` e cruzar
- No ProjetoFinancas: usar `c.image_url || c.thumbnail_url` como src da imagem (image_url é full-res)
- Separar criativos em 2 grupos: "Ativos" (com borda verde, primeiro) e "Inativos" (opacidade reduzida, depois)
- Adicionar badge "🟢 Ativo" ou "⏸ Inativo" visível

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/leads/FormBuilder.tsx` | Tipos `radio`/`checkbox`, snippet com CSS embutido, preview iframe, editor de opções |
| `supabase/functions/facebook-ads-sync/index.ts` | Buscar `effective_status` dos ads, usar `image_url`, cruzar status com creatives |
| `src/components/projeto/ProjetoFinancas.tsx` | Usar `image_url` nos criativos, separar ativos/inativos, enviar datas no sync |

---

## Ordem de execução

1. FormBuilder: adicionar tipos radio/checkbox + snippet com CSS + preview
2. Edge function: melhorar dados de criativos (image_url + status)
3. ProjetoFinancas: criativos full-res + ativos vs inativos + sync com datas

