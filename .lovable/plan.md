# Alternativas ao CAPI da Meta

Se a conta não libera token CAPI, dá pra deixar a Meta mais inteligente por outros caminhos. Em ordem de impacto:

## 1. Pixel + Advanced Matching (manual)
Enviar no `fbq('init', PIXEL_ID, { em, ph, fn, ln, ct, country, external_id })` com dados hasheados do lead capturado no formulário/checkout. Já melhora muito o match rate sem CAPI.
- Onde: hook no `lead-capture` e no checkout para popular `external_id` (ID do lead/venda) e enviar no `fbq`.

## 2. CAPI via Gateway (sem token da conta)
Usar o **Conversions API Gateway** da própria Meta (deploy AWS) ou serviços como **Stape.io / Addingwell** (server-side GTM gerenciado). Eles assinam os eventos server-side sem precisar você gerar token manualmente — a integração é via Business Manager.

## 3. CAPI for Stripe / Shopify nativo
Se a venda passa por Stripe/Shopify, a Meta tem integração nativa no Events Manager → "Adicionar eventos" → escolher partner. Zero código, envia compra server-side.

## 4. Offline Conversions (CSV/API)
Subir conversões via **Offline Event Sets** no Business Manager (upload CSV diário ou API). Atribui vendas reais às campanhas via `email`/`phone` matching. Bom pra rastrear PIX/Boleto pagos depois.
- Já temos `imphq_vendas` com email/telefone → daria pra gerar CSV automático.

## 5. UTM Tracker próprio (já temos)
Reforçar o `tracker-system` com `xcod` cheio (`{{campaign.id}}|{{adset.id}}|{{ad.id}}`) e cruzar com `imphq_vendas` no dashboard. Não melhora o algoritmo da Meta, mas dá ROAS real interno.

## 6. Eventos enriquecidos no Pixel
Enviar `value`, `currency`, `content_ids`, `content_type`, `predicted_ltv` em **todos** os eventos (ViewContent, AddToCart, InitiateCheckout, Purchase). Meta usa esses sinais pra otimizar mesmo só com Pixel.

## Recomendação
**Combo mais barato e eficaz:** (1) Advanced Matching no Pixel + (4) Offline Conversions automático a partir do `imphq_vendas`. Cobre 80% do ganho do CAPI sem depender de token.

Se quiser ir além: (2) Stape.io (~$20/mês) faz CAPI completo sem você gerenciar token.

---

Qual caminho você quer que eu implemente? Posso começar pelo Advanced Matching + Offline Conversions automático já que temos os dados em `imphq_vendas`.