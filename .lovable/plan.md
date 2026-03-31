

# Plano: 7 Melhorias — Expert Multi-Fotos, Jornada PIX, OpenFlow Condicional, Produto em Automações, Segmentação

---

## 1. Expert — Galeria de fotos (não apenas 1)

**Problema**: O campo `expert.foto` é uma string única. Ao subir 3 fotos, apenas a última sobrevive porque `onUpload` sobrescreve `expert.foto` com a URL mais recente. Além disso, os dados ficam no JSONB `data.expert` do projeto — qualquer membro salva e todos veem, mas se dois salvam ao mesmo tempo, o último ganha.

**Solução**:
- Mudar `expert.foto` de string para array: `expert.fotos: string[]`
- Na UI: manter o `Avatar` mostrando `fotos[0]`, mas adicionar galeria abaixo com thumbnails de todas as fotos
- O `FileUpload` com `multiple={true}` chama `onUpload` para cada arquivo — no handler, fazer push no array em vez de substituir
- Manter o campo `foto` (URL input) como foto principal, e adicionar seção "Galeria" abaixo com as fotos adicionais e botão de remover individual

**Arquivo**: `src/components/projeto/ProjetoExpert.tsx`

---

## 2. Jornada do Lead — PIX gerado antes da compra

**Problema**: O webhook já registra `PixGerado` em `imphq_events` (linhas 298-306 do webhook), e o Leads.tsx já tem `PixGerado` no `EVENT_CONFIG` (linha 83). Mas o `ultimo_evento` no lead fica como `"aguardando_pagamento"` ou `"pix_gerado"`, e na timeline os eventos de webhook são buscados via `visitor_id = leadId`.

**Verificação necessária**: Checar se a query de timeline em Leads.tsx busca `imphq_events` onde `visitor_id = lead.id` — se sim, os eventos de PIX já devem aparecer. O problema pode ser que o webhook salva `visitor_id` como `leadId` mas a timeline busca por outro campo.

**Solução**: 
- Verificar query de timeline e garantir que filtra por `visitor_id = lead.id` OU `utm_source = lead.email`
- Adicionar mapeamento `aguardando_pagamento` → label "Pix Gerado / Aguardando" na timeline
- Garantir que o estágio visual do funil mostra "Pix Gerado" como etapa intermediária antes de "Compra"

**Arquivo**: `src/pages/Leads.tsx` (query de timeline + estágio visual)

---

## 3. OpenFlow — Nós condicionais (Se não abriu, Se não leu)

**Problema**: Hoje o FlowEditor só tem nós lineares (ação após ação). Não existe nó de condição/branch.

**Solução**: Adicionar novo tipo de ação `"condicao"` com:
- Campo `condicao_tipo`: "nao_abriu_email", "nao_respondeu_whatsapp", "nao_clicou_link", "clicou_link"
- Campo `condicao_tempo_min`: tempo de espera antes de verificar (ex: 1440 min = 24h)
- Na UI do FlowEditor: nó especial com cor diferente (roxo), ícone de bifurcação
- Branch SIM/NÃO: por simplicidade, o branch "SIM" continua o fluxo sequencial; o branch "NÃO" é a condição — ou seja, "se não abriu em 24h, faz X"
- Cada ação ganha campo opcional `condicao` que define quando executar

**Arquivos**: `src/components/openflow/FlowEditor.tsx` (novo tipo + UI), `src/pages/OpenFlow.tsx` (atualizar `ACAO_TIPOS`)

---

## 4. OpenFlow — Filtro por Produto (não só projeto)

**Problema**: Automação tem `project_id` mas não `product_name`. Quando o projeto tem 5 produtos, todas as automações disparam para qualquer produto daquele projeto.

**Solução**:
- Adicionar campo `produto` (string) no formulário de criar/editar automação
- Quando um projeto é selecionado, carregar `data.produtos` do projeto e mostrar dropdown de produtos
- No webhook, ao buscar automações, filtrar também por `produto` (match contra `produto_nome` do webhook)
- No card da automação, mostrar badge do produto quando definido

**Arquivos**: `src/pages/OpenFlow.tsx` (campo produto no form + edit), `supabase/functions/webhook-pagamento/index.ts` (filtrar automações por produto)

---

## 5. Automações em Leads — Filtro por projeto

**Problema**: O botão "Automações" no lead (se existir) não filtra por projeto, podendo disparar automação do projeto errado.

**Solução**: Na seção de automações do detalhe do lead, filtrar `imphq_automacoes` pelo `project_id` do lead. Se o lead não tem `project_id`, mostrar todas mas com aviso.

**Arquivo**: `src/pages/Leads.tsx`

---

## 6. Webhook — Produtos do webhook salvos no briefing por projeto

**Problema**: Já está implementado! Linhas 329-349 do `webhook-pagamento/index.ts` fazem exatamente isso: auto-criam produto no `data.produtos` do projeto quando não existe.

**Melhoria**: Salvar também o `valor` e a `plataforma` do produto no auto-create, para que fique mais completo no briefing.

**Arquivo**: `supabase/functions/webhook-pagamento/index.ts` (enriquecer auto-create com preço e plataforma)

---

## 7. Segmentação global — Sistema ler produto/projeto para classificar

**Problema**: Hoje a segmentação é fraca. O lead tem `project_id` mas não `product_id`. As automações filtram por projeto mas não por produto.

**Solução**: Conjunto de melhorias:
- No lead, manter array `data.produtos_comprados` atualizado pelo webhook (já parcialmente feito via `imphq_vendas`)
- No OpenFlow, permitir filtro por produto (item 4 acima)
- Na importação CSV de leads, quando o CSV traz produto, gravar no `data.produto_importado` do lead

**Arquivos**: `supabase/functions/webhook-pagamento/index.ts`, `src/pages/Leads.tsx` (importação)

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoExpert.tsx` | Galeria multi-fotos (array), upload múltiplo, thumbnails |
| `src/pages/Leads.tsx` | Timeline PIX, filtro automações por projeto, segmentação produto |
| `src/components/openflow/FlowEditor.tsx` | Nó condicional (se não abriu, se não leu), tipo "condicao" |
| `src/pages/OpenFlow.tsx` | Campo produto no form, carregar produtos do projeto selecionado |
| `supabase/functions/webhook-pagamento/index.ts` | Filtrar automações por produto, enriquecer auto-create, atualizar `produtos_comprados` no lead |

