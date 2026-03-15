

# Plano: CRM de Leads Avançado — Filtros de Funil, Importação CSV e Captura

## O que o usuário pediu

1. **Filtrar por projeto e ver estágios do funil** (carrinho abandonado, pix gerado, pix confirmado, etc.)
2. **Importar leads de plataformas de vendas** (como o CSV da Ticto que foi enviado)
3. **Capturar leads de formulários/plataformas e cruzar informações**

## Análise do CSV enviado (Ticto)

O arquivo tem ~145 linhas com colunas:
- Número/Código do Pedido, Data, Produto, Oferta, Status (Autorizado, etc.)
- Método de Pagamento, Valor, Parcelamento
- Nome/Email/Telefone/CPF do Cliente
- UTMs: Fonte (FB), Anúncio, Conjunto, Campanha, Plataforma (Instagram)

## Alterações Planejadas

### 1. Novos filtros de estágio no funil (`src/pages/Leads.tsx`)

Adicionar um filtro por **estágio de funil** além do status atual. Os estágios vêm dos webhooks recebidos e ficam no campo `data` do lead:

```text
Estágios: lead_capturado → carrinho_abandonado → pix_gerado → aguardando_pagamento → compra_aprovada → reembolso
```

- Adicionar `SelectFilter` de "Estágio" na barra de filtros
- Mapear estágio a partir de `data.ultimo_evento` ou das vendas associadas
- Mostrar badge visual do estágio na tabela (cores distintas para cada fase)
- KPI cards: adicionar "Carrinho Abandonado" e "Pix Pendente" como métricas

### 2. Importação CSV de Plataformas (`src/pages/Leads.tsx`)

Adicionar botão **"📥 Importar CSV"** ao lado do "Novo Lead":

- Dialog com upload de CSV + seletor de plataforma (Ticto/Hotmart/Kiwify)
- Seletor de projeto destino
- Parser inteligente que mapeia as colunas automaticamente:

```text
Ticto CSV → imphq_leads:
  "Nome do Cliente"     → nome
  "E-mail do Cliente"   → email  
  "Telefone Completo"   → phone
  "Status"              → data.ultimo_evento (Autorizado→compra_aprovada)
  "Valor Pago"          → total_gasto (via imphq_vendas)
  "Nome do Produto"     → vincula ao projeto
  "Fonte de Tráfego"    → data.utms.utm_source
  "Conjunto de Anúncios"→ data.utms.utm_campaign
```

- Preview dos dados antes de importar (tabela com primeiras 5 linhas)
- Deduplicação por email (se já existe, atualiza; se não, cria)
- Criar vendas em `imphq_vendas` para registros com status "Autorizado"
- Progresso visual durante importação

### 3. Captura de Leads via Formulários (`supabase/functions/webhook-pagamento/index.ts`)

O webhook já suporta `?event=Lead` para captura. Melhorias:

- Na UI, exibir URL de captura de lead: `...webhook-pagamento?project={id}&event=Lead`
- Adicionar novo endpoint leve `capture-lead` (Edge Function) para formulários HTML simples:
  - Aceita POST com `name`, `email`, `phone`, `tags`
  - Cria lead em `imphq_leads` e dispara evento `LeadCapture` em `imphq_events`
  - Retorna snippet HTML/JS para embedar em qualquer página

### 4. Cruzamento de informações

- Ao importar CSV, cruzar email com leads existentes e com `imphq_events` (visitor_id)
- Na timeline (aba Jornada), mostrar também os webhooks recebidos (`imphq_webhooks`) como eventos
- Badge "📊 Origem" mostrando UTMs da captura original e do CSV importado

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/pages/Leads.tsx` | Filtro de estágio, importação CSV, KPIs de funil, badge de estágio |
| `supabase/functions/capture-lead/index.ts` | Nova Edge Function para captura via formulários |
| `src/pages/ProjetoDetalhe.tsx` | Mostrar URL de captura de leads na aba Analytics |

## Fluxo da Importação CSV

```text
1. Upload CSV → parse com PapaParse (client-side)
2. Detectar plataforma automaticamente pelas colunas
3. Preview com 5 primeiras linhas mapeadas
4. Usuário confirma + seleciona projeto destino
5. Para cada linha:
   a. Buscar lead por email → se existe, merge dados
   b. Se não existe, criar lead
   c. Se status = Autorizado, criar venda em imphq_vendas
   d. Salvar UTMs em data.utms
6. Toast com resumo: "145 leads importados, 12 duplicados atualizados"
```

