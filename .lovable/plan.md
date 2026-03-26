

# Plano: Branding Expandido + Leads com Receita Bruta/Liquida e Sinalizacao de Pendencias

## 3 frentes

---

### 1. Branding -- Novos blocos (baseado nas imagens de referencia)

Adicionar ao `ProjetoBranding.tsx` os seguintes cards alem dos existentes (Paleta, Tipografia, Tom Visual):

| Card | Campos | Tipo |
|---|---|---|
| **Arquetipo da Marca** | Grid de 9 arquetipos selecionaveis (Heroi, Mentor, Fora da Lei, Explorador, Criador, Cuidador, Rei, Mago, Bobo) | botoes toggle, 1 selecionado por vez |
| **Posicionamento** | Inimigo Comum, Mecanismo-Chave, Personalidade da Marca | 3 textareas |
| **Manifesto da Marca** | Texto longo do manifesto | 1 textarea grande |
| **Linguagem: Usa / Evita** | Duas listas de palavras lado a lado | 2 textareas (ou EditableTagList) |

Tudo salvo no JSONB `brand_kit` existente (sem migration). O "Tom Visual" atual pode ser mantido e os novos cards adicionados abaixo.

---

### 2. Leads Import -- Receita Bruta e Liquida no preview e no banco

O CSV da Ticto ja tem "Valor Pago" (bruto) e "Valor Liquidado" (liquido). O `mapRow` ja extrai ambos, mas:

- O **preview** so mostra "Valor" (bruto). Adicionar coluna "Liquido" na tabela de preview.
- Os **badges de resumo** so mostram contagem de vendas. Adicionar: `Receita Bruta: R$ X` e `Receita Liquida: R$ Y`.
- Na **insercao** em `imphq_vendas`, salvar `valor_liquidado` no campo `data` (JSONB) ja que nao existe coluna dedicada.

---

### 3. Leads -- Sinalizacao de status pendente (carrinho abandonado, pix gerado, aguardando)

O sistema ja mapeia esses status (`carrinho_abandonado`, `aguardando_pagamento`, `pix_gerado`), mas falta **sinalizacao visual clara** na listagem de leads:

- Na tabela de leads (`Leads.tsx`), adicionar um **icone de alerta** ao lado do badge de estagio para status pendentes (`carrinho_abandonado`, `pix_gerado`, `aguardando_pagamento`).
- Badge pulsante ou com borda amarela/laranja para esses estagios.
- No resumo do import, badge separado: `X carrinhos abandonados`, `X pix gerados`, `X aguardando pagamento`.
- Adicionar `pix_gerado` ao `STATUS_MAP_TICTO` se existir no CSV (ex: "Pix Gerado", "PIX Gerado").
- Adicionar filtro rapido por "Pendentes" na listagem de leads.

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/components/projeto/ProjetoBranding.tsx` | Adicionar cards de Arquetipo, Posicionamento, Manifesto, Linguagem |
| `src/components/leads/LeadImportDialog.tsx` | Coluna Liquido no preview, badges de receita bruta/liquida, badges de pendencias, mapear pix_gerado |
| `src/pages/Leads.tsx` | Icone de alerta em status pendentes, badge pulsante, filtro "Pendentes" |

