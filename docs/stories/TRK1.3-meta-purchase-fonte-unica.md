# TRK1.3 — Purchase na Meta com fonte única, chaves do checkout e pedido com bump

Status: Em execução · 09/10/2026

Origem: teste de ângulos do CCP (campanha 120253342926380169, pausada em 09/10). A Meta mostrava 32 compras e CPA de R$ 27; a Ticto mandou 12 compras aprovadas no período. O pixel 614834761557621 recebeu 40 Purchases via servidor e 4 via navegador, de três remetentes com event_id diferentes: a integração da Ticto, o `webhook-pagamento` (sha256(tx:Purchase)) e o `meta-offline-upload` (purchase_<tx>, lote de 13 em 07/10 20:00, antes da marcação `meta_purchase_source = "plataforma"`). As UTMs não estavam se perdendo: 9 das 12 compras chegaram com a `utm_campaign` do teste.

## Critérios

- [x] `webhook-pagamento` não manda Purchase para o pixel principal do projeto (fb_pixel_id + fb_access_token); esse pixel tem um remetente só (meta-offline-upload, ou a plataforma quando `meta_purchase_source = "plataforma"`). Outros pixels de `data.facebook_pixels` seguem recebendo.
- [x] `fbc`, `fbp`, `fbclid`, `visitor_id` e `utm_id` que a Ticto repassa em `query_params` ficam em `data.tracker` da venda (pix gerado, compra nova e pix promovido a aprovado).
- [x] `meta-offline-upload` manda uma Purchase por pedido: valor da principal + bumps do mesmo pedido, com `contents`, `content_ids` e `num_items`; usa `fbclid` de `data.tracker`.
- [x] Aviso da plataforma não espera o `openflow-executor`: automações rodam em segundo plano (`EdgeRuntime.waitUntil`). Os 4 tempos limite de 150s de 06–07/10 vinham do fluxo "Aprovada - JP Freitas" (e-mail com `delay_min: 2` esperado dentro da requisição); os fluxos rodaram, só o aviso ficou como não processado.
- [x] Testes: helpers do webhook (index.test.ts) e Purchase do pedido com bump e fbc/fbp (quality-backend). Suíte 898/898, typecheck e lint limpos.
- [ ] Desligar o envio de Purchase da Ticto para o pixel 614834761557621 (ação no painel da Ticto, pelo Vinicius).
- [ ] Depois disso, `jp_freitas.settings.meta_purchase_source` deixa de ser "plataforma" para o Império virar o único remetente.
- [ ] Conferir no Gerenciador de Eventos que cada venda nova gera uma Purchase (servidor, com fbc/fbp).

## Fora do escopo (anotado)

- Regra de corte de testes de criativo deve ler vendas do Império, não o pixel (rotina `jp-ccp-teste-angulos-corte` desligada em 09/10).
- O passo de e-mail do fluxo "Aprovada - JP Freitas" deu erro nas 4 execuções.
- Os Purchases duplicados de 05–07/10 já recebidos pela Meta não podem ser apagados.

## File List

supabase/functions/webhook-pagamento/index.ts; supabase/functions/webhook-pagamento/index.test.ts; supabase/functions/meta-offline-upload/index.ts; src/test/quality-backend.test.ts; docs/stories/TRK1.3-meta-purchase-fonte-unica.md.
