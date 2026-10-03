# Catálogo de ofertas DTC — AFF1.1

Atualizado em 03/10/2026, America/Sao_Paulo. Histórico de 02/10 preservado abaixo.

## Atualização — páginas próprias e tracking

Pedido de publicação, tracker/IDs, Analytics e mapa autorizado pelo usuário. As versões antigas foram preservadas. Os deploys novos servem somente `site/` de cada repositório.

| Oferta | Página própria | Player / pitch | GA4 (Direct Response) | Meta |
|---|---|---|---|---|
| Leaftide Powder | https://leaftide-powder-vsl.vercel.app/ | ML04 `6aa4dde98aa57ba613b3b3d3` / 56:28 | `G-CEXWP1QQRE`, propriedade `557212253`, fluxo `15976071789`; tempo real com page_view/session_start/vsl_view confirmado | Pendente de BM/pixel |
| CardioFlush | https://cardioflush-vsls-hw.vercel.app/ | LEAD5 `6a9841cee7a8842efeeb2801` / 55:30 | `G-P3BGTRYWE3`, propriedade `557161984`, fluxo `15977337371`; page_view/session_start/vsl_view recebidos em tempo real em 03/10 | Pendente de BM/pixel |
| MemoFlow | https://memoflow-vsl.vercel.app/ | `6aa4c6586d7a1359e68358cf` / 55:00 | `G-T52GP0M1MJ`, propriedade `557173271`, fluxo `15977184412`; page_view/session_start/vsl_view recebidos em tempo real em 03/10 | Pendente de BM/pixel |
| SlimSoda Powder | https://slimsoda-powder-vsl.vercel.app/ | `6aa4c68d589230110306fe6c` / 37:06 | `G-6BY843CN82`, propriedade `557209019`, fluxo `15976232055`; VSL/ADV1/PDP recebidos em tempo real em 03/10 | `996492073462713` instalado; proprietário Imperio Company e compartilhamento AD Vini 01 confirmados; PageView próprio recebido, Purchase/CAPI pendentes |

Conta GA4 Direct Response `359475519`. Orientação corrigida pelo usuário: Analytics e demais serviços usam os acessos do próprio Vinicius já conectados no computador/navegador. Somente Facebook/Meta usa a conta do Bruno, aberta no perfil que o usuário identifica como VSUGML. A sessão Google de Vinicius é a sessão correta; não há pendência de e-mail Google do Bruno nem necessidade de trocar ou transferir propriedades. Não houve duplicação da propriedade Slim.

Meta Slim: Eventos de Teste mostrou PageView processado do domínio `slimsoda-powder-vsl.vercel.app` às 08:43 de 03/10, classificado pela interface como "Evento personalizado". SDK, configuração do pixel e requisição `/tr?id=996492073462713&ev=PageView` responderam HTTP 200 no navegador. Eventos históricos/CAPI existentes do dataset não comprovam compra/CAPI deste novo site. 2FA liberado pelo usuário e acesso às configurações da empresa confirmado em 03/10; detalhes da checagem abaixo.

Tracker Império: visita de navegador `vsl_view` recebida nas quatro ofertas, com `utm_source=codex-validation`, `utm_campaign=aff1-1` e `meta.validation=true`. Nenhuma compra, Purchase ou CAPI foi certificado. Os atrasos foram configurados com `displayHiddenElements` do player; nenhuma sessão completa até todos os pitches foi acompanhada.

Endpoint público `funnel-track` atualizado da versão 360 para 361 apenas para aceitar `advertorial_view`, `advertorial_cta_click`, `pdp_view`, `pdp_cta_click`. Fonte publicada anterior comparada antes do deploy; nenhum token vai ao cliente. Quatro eventos sintéticos de smoke test aceitos e identificados com origem `codex-validation-endpoint`. Não confundir com visitantes ou vendas reais.

### SlimSoda — materiais reutilizados e publicados

- [Advertorial 1](https://slimsoda-powder-vsl.vercel.app/advertorials/slimsoda-adv1-original-recipe.html)
- [Advertorial 2](https://slimsoda-powder-vsl.vercel.app/advertorials/slimsoda-adv2-reader-warning.html)
- [Advertorial 3](https://slimsoda-powder-vsl.vercel.app/advertorials/slimsoda-adv3-two-column.html)
- [Advertorial 4](https://slimsoda-powder-vsl.vercel.app/advertorials/slimsoda-adv4-exclusive-report.html)
- [PDP](https://slimsoda-powder-vsl.vercel.app/pdp/)

Fontes originais continuam em `materials/`. Cópias publicadas: 16 CTAs editoriais levam à VSL própria; 12 CTAs da PDP levam ao DTC H&W. Instruções ajustadas para apresentação, sem perfil/quiz inexistente. Contadores estáticos de escassez/comentários, cronômetro, lote de envio simulado e projeção individual ficam ocultos. Header "See packages" corrigido; footer usa Terms/Privacy/Support do comerciante, observados no checkout e HTTP 200.

QA desktop ADV1/PDP concluído em 03/10. Clique ADV1 → VSL e PDP → checkout testados com afiliado/hid/UTMs preservados. Tracker Império recebeu advertorial_view, advertorial_cta_click, pdp_view e pdp_cta_click dessas visitas, campanha aff1-1-20261003. Outros três editoriais passaram conferência de HTML/CTAs; não houve clique individual de navegador. Conteúdo do fornecedor e garantias divergentes (60 dias no editorial, 90 no checkout/PDP) seguem em revisão. No checkout Slim: 3+3 USD 19.99/unidade, 2+2 USD 27.49, 1+1 USD 44.75; compra única declarada, expedited shipping USD 9.95 marcado por padrão. Nenhum pedido efetuado.

### Checkouts disponíveis no H&W e direção aplicada

| Oferta | Opções observadas | Escolha das novas VSLs |
|---|---|---|
| Leaftide | 3+3, 2+2, 1+1, LTW/Wealthpay, DTC 6b19 | DTC 6b19 em getleaftide.com/powder/cc2/pay |
| CardioFlush | LT/BuyLink dtc6b19; LTW/DTC Wealthpay | LT/BuyLink dtc6b19 em cardioflush.com/cc2/pay |
| MemoFlow | DTC dtcnew; LTW/Wealthpay | DTC em cc.usememoflow.com/dtcnew |
| SlimSoda Powder | LJ 6b19aj; V3 6b19; V2 3bottles; LT/DTC v2 | LT/DTC v2 em cc.slimsodapowder.com/v2 |

Todos com `affid=aff_6821377` e `hid` oficial da variante. A escolha reaproveita o destino oficial DTC correspondente à oferta; não é conclusão de teste de conversão entre gateways.

### Organização e dependências

Mapa Master `67f9f17a-e75e-45f6-a5e3-20198bfdd692`: 29 novos nós, 25 conexões e seis faixas das quatro ofertas e materiais, sem alterar as faixas antigas. Snapshot anterior `d9de9532-c790-4b05-91e3-1d9ca7f1d612`. Links, IDs e pendências constam nas descrições; etapa de compra/Meta permanece em revisão. ADV/PDP Memo existentes estão vinculados como fluxo a validar, sem mudança nos sites antigos.

Mapa operacional SlimSoda `a2e01bd8-f262-43d9-a91f-779ea371ca40`: nova faixa Powder com seis nós/cinco conexões, preservando operação legada; snapshot `9303e436-bd5f-4467-b999-721bf2e82b1f`. Mapa Master e operacional Slim, links dos novos nós e tracking conferidos na interface em 03/10; capturas salvas. Assumido que "Ipena" refere-se ao Império, pergunta opcional sem resposta.

Sites: nove novas páginas próprias registradas (quatro VSLs + quatro advertoriais Slim + PDP Slim), além dos dez sites antes catalogados. Briefings agora têm 14/19/21/27 links para Leaftide/CardioFlush/MemoFlow/SlimSoda, respectivamente. IDs públicos GA4/Pixel e resultados de validação atualizados nos projetos, Sites e tracking dos mapas.

GitHub: em 03/10, commits remotos verificados e quatro checkouts limpos: Leaftide `9c59c87bea8c068bb17f9b361108eb84a28482b9`, Cardio `c681acabbbd74815573699a20a16dd6422527748`, Memo `a28703bf4c60182e5266d37c96f31fdcbf04283c`, Slim `9f1af096c550b00da1ff854006c4c63961bb19bb`. Último deploy Slim `dpl_9E2PfXednmBhTrVmKNnGdbbZ2Js2`; alias público HTTP 200 com GA4 e footer atual. Deploy CLI serve o código de `site/`. Nenhum commit alheio do repositório raiz foi enviado.

[Mapa Master](https://imperiox.vercel.app/funis?view=mapa&map=67f9f17a-e75e-45f6-a5e3-20198bfdd692&node=af110001-0000-4000-8000-000000000003).

Conexão GitHub → Vercel automática: tentativa Leaftide retornou exigência de Login Connection GitHub na conta Vercel. GitHub e deploy CLI funcionam; vínculo automático não foi concluído. Usuário concluiu o 2FA Meta; tela de pessoas confirmou Bruno Souza com acesso total na BM Imperio Company.

Chrome: novas abas do perfil Vinicius voltaram a responder em 03/10; usadas para GA4, Meta, PDP e mapa. Após liberar 2FA e consultar a BM, o perfil identificado pelo usuário como VSUGML deixou de aparecer na conexão da extensão. Inventário passou a mostrar somente Chrome Imperio, Edge e navegador interno; não trocar a sessão do Bruno por essas outras sessões. Reconexão solicitada ao usuário; bloqueio atual é conexão do navegador, não 2FA.

### Meta — conferência após liberação do 2FA, 03/10

- BM Imperio Company `1895345497616474`: Bruno Souza com acesso total; AD Vini 01 `448271424884723` pertence à BM, sem selo de conta desabilitada. Página de suporte mostrou "Nenhum anúncio rejeitado". Isso não certifica aprovação futura, faturamento, limites ou saúde integral do portfólio.
- Outras contas restritas/desabilitadas existem: Bruno Ale e CLG_1539; CLG pertence à ClikimGlobal. Hipertens pertence a jpfreitas06 e foi excluída desta operação.
- Dataset Slim `996492073462713` pertence à Imperio Company; suporte mostrou nenhum problema da fonte de dados nos últimos 30 dias. Dtc-Clear `1619587959397761` também pertence à BM; não confundir com o pixel Clear legado `1427772126180988` nem reaproveitar para CardioFlush sem conferir identidade.
- Suporte lista 12 fontes; primeiras dez observadas no inventário. Busca específica por Leaftide/CardioFlush/MemoFlow ainda não concluída; não afirmar ausência de datasets existentes.
- Formulário Leaftide Powder - Império preparado, categoria Prestador de serviços de saúde e bem-estar. O botão Criar implica aceitar os Termos das Ferramentas Comerciais da Meta; não foi acionado. Confirmação humana de aceite necessária no momento da criação, caso ela seja necessária. Nenhum novo dataset/ID gerado; nenhum novo Pixel/Vturb/deploy alterado nesta etapa.
- Quatro projetos e cinco nós de tracking dos mapas atualizados com 2FA liberado, BM/conta conferidas e pendências. IDs de pixel preservados: somente Slim tem ID certificado para o novo site.
- Diretório antigo `Downloads/imperio-ofertas` não encontrado nesta retomada. Quatro fontes recuperadas dos GitHubs privados em `C:/Users/vsuga/Documents/imperio-ofertas-meta/`; HEADs iguais aos remotos registrados acima e checkouts limpos. Recuperação não certifica presença dos ZIPs externos ou das capturas históricas. Formulário observado por screenshot no navegador; nova gravação PNG falhou antes da desconexão, sem evidência local nova alegada.

Validação: cinco testes do tracker; lint sem erros (2 avisos existentes), typecheck e 623 testes do Império aprovados. Aplicativo raiz não foi republicado por esta story.

## Histórico da primeira conferência

Organização dos quatro projetos validada na interface pública do Império. Dez páginas publicadas cadastradas em Sites. O estado abaixo distingue organização, configuração do player e funil validado para tráfego.

| Oferta | Império (aba Briefing) | Fonte privada | Estado |
|---|---|---|---|
| LeafTide Powder LT | [Projeto](https://imperiox.vercel.app/projetos/leaftide) | [GitHub](https://github.com/vsugamele/leaftide-powder-vsl) | Checkout existente preservado; decisão de migração pendente |
| CardioFlush LT | [Projeto](https://imperiox.vercel.app/projetos/cardioflush) | [GitHub](https://github.com/vsugamele/cardioflush-vsls) | Checkout existente preservado; decisão de migração pendente |
| MemoFlow LT | [Projeto](https://imperiox.vercel.app/projetos/memoflow) | [GitHub](https://github.com/vsugamele/memoflow-vsl) | CTA Vturb 55:00 salvo; VSL local ainda não publicada |
| SlimSoda Powder LT | [Projeto](https://imperiox.vercel.app/projetos/slimsoda) | [GitHub](https://github.com/vsugamele/slimsoda-powder-vsl) | CTA Vturb 37:06 salvo; fluxo público ainda não validado |

## BM e pixel

Imperio Company (1895345497616474) é candidata fora do JP; AD Vini 01 (448271424884723) foi observada. Dataset Slim (996492073462713) sem eventos observados. Nova conferência ainda redirecionou à autenticação de dois fatores da conta Bruno Souza de Carvalho. Nenhuma BM foi declarada saudável e nenhum Pixel/CAPI foi certificado.

Leaftide ML01 usa pixel Leaf 3404268439746053; CardioFlush LEAD1 usa Clear 1427772126180988. Propriedade, permissões, domínio e recebimento de eventos precisam ser conferidos na Meta. MemoFlow, SlimSoda Powder, Leaftide ML04 e os três outros CardioFlush estavam sem pixel no Vturb.

## Materiais

Manifestos privados em docs/materials-manifest.json de cada fonte: 25 ZIPs/RARs locais, com caminhos/tamanhos e SHA256 para os arquivos menores que 70 MB. Um arquivo MemoFlow de aproximadamente 1 GB foi catalogado sem hash. Os arquivos originais permanecem no disco. Duplicatas ADS TEXT(S) com (1) confirmadas em Leaftide, MemoFlow e SlimSoda; nada foi excluído.

O H&W atual lista 0 arquivos Leaftide Powder, 1 PDF CardioFlush, 4 arquivos MemoFlow e 6 SlimSoda Powder. A equivalência de ZIPs locais com downloads remotos não foi confirmada por hash. O download do PDF CardioFlush não foi concluído pelo navegador.

MemoFlow: ADV01/Eleanor/PDP já possuem repositórios existentes e foram associados. SlimSoda: quatro advertoriais originais e PDP v3 com assets adicionados a materials/ da fonte privada; esses materiais não foram publicados nesta sessão.

## Páginas e players

### LeafTide Powder LT

Oferta: [off_0135210](https://www.hwaffiliate.com/offers/8b8e0fd3-af4d-4a1a-8a18-f34f2419ed8e) — aprovada, USD 120 CPA front + 15% recorrência.

| Player | Pitch | CTA Vturb | Pixel |
|---|---|---|---|
| Leaftide - ML 01 - PITCH 55_14.mp4 (`6aa4de19dea371bb53cd1ae2`) | 55:14 | Existente conferido | 3404268439746053 |
| Leaftide - ML 04 - PITCH 56_28.mp4 (`6aa4dde98aa57ba613b3b3d3`) | 56:28 | Desligado | Sem pixel configurado observado |

- [Leaftide Powder — VSL publicada (ML01)](https://leaftide-powder.vercel.app/)
- [H&W — LeafTide Powder LT (oferta aprovada)](https://www.hwaffiliate.com/offers/8b8e0fd3-af4d-4a1a-8a18-f34f2419ed8e)
- [Vturb — Leaftide ML01 · pitch 55:14](https://app.vturb.com/players/6aa4de19dea371bb53cd1ae2/edit)
- [Vturb — Leaftide ML04 · pitch 56:28](https://app.vturb.com/players/6aa4dde98aa57ba613b3b3d3/edit)
- [H&W — Checkout Powder LT DTC 6b19](https://getleaftide.com/powder/cc2/pay/checkout.php?package=6b19&hid=b2lkPW9mZl8wMTM1MjEwJmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMDk4Njk0Ng%3D%3D&affid=aff_6821377)
- [GitHub — Leaftide Powder VSL (fonte privada)](https://github.com/vsugamele/leaftide-powder-vsl)

Pendências e observações:

- CTA publicado/Vturb usa dtcv1-whop; oferta atual Powder LT no H&W usa powder/cc2/pay. Manter ambos separados até confirmar intenção de troca.
- Link legado healthy-legs-daily é de outro funil e truevitallabs-pdp pertence a MemoFlow; preservados para revisão.
- Pixel 3404268439746053 observado em página e Vturb; BM proprietária ainda não confirmada.
- Leaftide ML04: autoplay/progresso/continuar assistindo ligados, Turbo/CTA/pixels desligados. Nenhuma mudança no ML04.

### CardioFlush LT

Oferta: [off_6504713](https://www.hwaffiliate.com/offers/7c4ee852-26bf-4a8c-86bc-32d36725df9b) — aprovada, USD 120 CPA front + 15% recorrência.

| Player | Pitch | CTA Vturb | Pixel |
|---|---|---|---|
| LEAD 5 - CardioFlush [19] PITCH 55_30.mp4 (`6a9841cee7a8842efeeb2801`) | 55:30 | Desligado | Sem pixel configurado observado |
| LEAD 4 - CardioFlush [19] PITCH 52_50.mp4 (`6a98402de94f46878fa7f026`) | 52:50 | Desligado | Sem pixel configurado observado |
| LEAD 2 - CardioFlush [19] PITCH 53-05.mp4 (`6a983e731c392af2378f5f23`) | 53:05 | Desligado | Sem pixel configurado observado |
| LEAD 1 - CardioFlush [19] PITCH 57_27.mp4 (`6a983ac54a724088f931e28b`) | 57:27 | Switch ligado; destino não confirmado | 1427772126180988 |

- [CardioFlush — vsl-1 · LEAD 5 · pitch 55:30](https://cardioflush-vsls.vercel.app/cc/pv/vsl-1/)
- [Vturb — CardioFlush LEAD 5 · 55:30](https://app.vturb.com/players/6a9841cee7a8842efeeb2801/edit)
- [CardioFlush — vsl-2 · LEAD 4 · pitch 52:50](https://cardioflush-vsls.vercel.app/cc/pv/vsl-2/)
- [Vturb — CardioFlush LEAD 4 · 52:50](https://app.vturb.com/players/6a98402de94f46878fa7f026/edit)
- [CardioFlush — vsl-3 · LEAD 2 · pitch 53:05](https://cardioflush-vsls.vercel.app/cc/pv/vsl-3/)
- [Vturb — CardioFlush LEAD 2 · 53:05](https://app.vturb.com/players/6a983e731c392af2378f5f23/edit)
- [CardioFlush — vsl-4 · LEAD 1 · pitch 57:27](https://cardioflush-vsls.vercel.app/cc/pv/vsl-4/)
- [Vturb — CardioFlush LEAD 1 · 57:27](https://app.vturb.com/players/6a983ac54a724088f931e28b/edit)
- [H&W — CardioFlush LT (aprovada)](https://www.hwaffiliate.com/offers/7c4ee852-26bf-4a8c-86bc-32d36725df9b)
- [H&W — CardioFlush LT checkout oficial](https://cardioflush.com/cc2/pay/checkout.php?package=dtc6b19&hid=b2lkPW9mZl82NTA0NzEzJmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMzc5NTk3OA%3D%3D&affid=aff_6821377)
- [H&W — CardioFlush LTW Wealthpay](https://order.wealthpay.io/p9vao89ywg4n?hid=b2lkPW9mZl82NTA0NzEzJmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfODM1MjkwOQ%3D%3D&affid=aff_6821377)
- [GitHub — CardioFlush VSLs (fonte privada)](https://github.com/vsugamele/cardioflush-vsls)
- [Catálogo operacional — fontes e pendências](https://github.com/vsugamele/cardioflush-vsls/blob/main/CATALOGO.md)

Pendências e observações:

- Quatro páginas HTTP 200 com players confirmados. Configurações Vturb conferidas: autoplay, progresso e continuar assistindo ligados nos quatro; LEAD1 tem Turbo, CTA e pixel Clear; demais CTA/pixels desligados.
- CTA publicado usa MyCartpanda 210357868:1; H&W atual fornece cardioflush.com e Wealthpay. Não trocar antes de definir checkout e atribuição.
- As quatro fontes têm atraso fixo 3448 segundos (57:28), diferente dos pitches individuais.
- Link CardioClear legado pertence a outro produto; mantido para revisão.
- PDF cardioflush-metricas.pdf (393.8 KB, 01/09/2026) listado no H&W. Download não concluído pelo navegador.
- Pixel Clear 1427772126180988 observado no LEAD1; BM proprietária/eventos ainda não confirmados. Não presumir adequação para CardioFlush apenas pelo nome.

### MemoFlow LT

Oferta: [off_3654496](https://www.hwaffiliate.com/offers/9f918e3d-b175-4e3a-9253-e34d85d77e52) — aprovada, USD 120 CPA front + 15% recorrência.

| Player | Pitch | CTA Vturb | Pixel |
|---|---|---|---|
| VSL PRINCIPAL - MemoFlow [19] - PITCH 55-00.mp4 (`6aa4c6586d7a1359e68358cf`) | 55:00 | Salvo, habilitado 55:00 | Sem pixel configurado observado |

- [MemoFlow — Advertorial ADV01 (publicado)](https://memoflow-advertorial-adv01.vercel.app/)
- [MemoFlow — Advertorial Eleanor (publicado)](https://memoflow-advertorial-eleanor.vercel.app/)
- [MemoFlow — Advertorial no domínio](https://adv.truememoflow.com/)
- [MemoFlow — PDP TrueVitalLabs (publicado)](https://truevitallabs.com/)
- [Vturb — MemoFlow principal · pitch 55:00](https://app.vturb.com/players/6aa4c6586d7a1359e68358cf/edit)
- [H&W — MemoFlow LT (aprovada)](https://www.hwaffiliate.com/offers/9f918e3d-b175-4e3a-9253-e34d85d77e52)
- [H&W — MemoFlow LT checkout DTC](https://cc.usememoflow.com/dtcnew/checkout.php?hid=b2lkPW9mZl8zNjU0NDk2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMjE5OTQ4Mg%3D%3D&affid=aff_6821377)
- [H&W — MemoFlow LTW Wealthpay](https://order.wealthpay.io/wvrv7d7repq7?hid=b2lkPW9mZl8zNjU0NDk2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMjIzMTg4MA%3D%3D&affid=aff_6821377)
- [GitHub — memoflow-vsl](https://github.com/vsugamele/memoflow-vsl)
- [GitHub — memoflow-advertorial-adv01](https://github.com/vsugamele/memoflow-advertorial-adv01)
- [GitHub — memoflow-advertorial-eleanor](https://github.com/vsugamele/memoflow-advertorial-eleanor)
- [GitHub — truevitallabs-pdp](https://github.com/vsugamele/truevitallabs-pdp)
- [Catálogo operacional — fontes e pendências](https://github.com/vsugamele/memoflow-vsl/blob/main/CATALOGO.md)

Pendências e observações:

- Fonte VSL existente com checkoutUrl e legalUrls vazios: não publicada nesta organização.
- ADV01, Eleanor, adv.truememoflow.com e truevitallabs.com responderam HTTP 200. PDP não é uma VSL.
- H&W oferece DTC cc.usememoflow.com/dtcnew e Wealthpay; links de afiliado catalogados, sem substituir funis atuais.
- MemoPryl é produto distinto e seus repositórios/players não foram associados como MemoFlow.
- Arquivos H&W: affiliate brief HTML 10 MB, imagens RAR 11.4 MB, PDP ZIP 6.2 MB, advertorial ZIP 55.8 MB. Correspondência local por tamanho/formato; identidade remota não comprovada por hash.
- Botão Vturb criado e habilitado em 55:00, para checkout DTC oficial H&W com aff_6821377. Não houve deploy da VSL local; checkout/legal config.js ainda vazios.

### SlimSoda Powder LT

Oferta: [off_5058725](https://www.hwaffiliate.com/offers/e2191b9c-a827-4d26-8f63-1a20d2be9d65) — aprovada, USD 120 CPA front + 15% recorrência.

| Player | Pitch | CTA Vturb | Pixel |
|---|---|---|---|
| VSL PRINCIPAL - SlimSoda [Powder][19] PITCH 37_06.mp4 (`6aa4c68d589230110306fe6c`) | 37:06 | Salvo, habilitado 37:06 | Sem pixel configurado observado |

- [SlimSoda Powder — VSL publicada (ML01)](https://slimsoda-powder.vercel.app/)
- [Vturb — SlimSoda Powder principal · pitch 37:06](https://app.vturb.com/players/6aa4c68d589230110306fe6c/edit)
- [H&W — SlimSoda Powder LT (aprovada)](https://www.hwaffiliate.com/offers/e2191b9c-a827-4d26-8f63-1a20d2be9d65)
- [H&W — SlimSoda Powder checkout LJ · 6b19aj](https://slimsodapowder.com/cc2/dtc/pay/checkout.php?package=6b19aj&hid=b2lkPW9mZl81MDU4NzI1JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfNzA0MTEyNQ%3D%3D&affid=aff_6821377)
- [H&W — SlimSoda Powder checkout V3 · 6b19](https://slimsodapowder.com/cc2/dtc/pay/checkout.php?package=6b19&hid=b2lkPW9mZl81MDU4NzI1JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMTI2NjkzMg%3D%3D&affid=aff_6821377)
- [H&W — SlimSoda Powder checkout V2 · 3bottles](https://slimsodapowder.com/cc2/dtc/pay/checkout.php?package=3bottles&hid=b2lkPW9mZl81MDU4NzI1JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMDM4MDIyMg%3D%3D&affid=aff_6821377)
- [H&W — SlimSoda Powder checkout LT · DTC v2](https://cc.slimsodapowder.com/v2/checkout.php?&hid=b2lkPW9mZl81MDU4NzI1JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMzk5MDY3Mg%3D%3D&affid=aff_6821377)
- [GitHub — SlimSoda Powder VSL (fonte privada)](https://github.com/vsugamele/slimsoda-powder-vsl)
- [Catálogo operacional — fontes e pendências](https://github.com/vsugamele/slimsoda-powder-vsl/blob/main/CATALOGO.md)
- [SlimSoda Powder — advertorial 1 (fonte GitHub; não publicado)](https://github.com/vsugamele/slimsoda-powder-vsl/blob/main/materials/advertorials/slimsoda-adv1-original-recipe.html)
- [SlimSoda Powder — advertorial 2 (fonte GitHub; não publicado)](https://github.com/vsugamele/slimsoda-powder-vsl/blob/main/materials/advertorials/slimsoda-adv2-reader-warning.html)
- [SlimSoda Powder — advertorial 3 (fonte GitHub; não publicado)](https://github.com/vsugamele/slimsoda-powder-vsl/blob/main/materials/advertorials/slimsoda-adv3-two-column.html)
- [SlimSoda Powder — advertorial 4 (fonte GitHub; não publicado)](https://github.com/vsugamele/slimsoda-powder-vsl/blob/main/materials/advertorials/slimsoda-adv4-exclusive-report.html)
- [SlimSoda Powder — PDP v3 (fonte GitHub; não publicado)](https://github.com/vsugamele/slimsoda-powder-vsl/blob/main/materials/pdp/index.html)

Pendências e observações:

- VSL slimsoda-powder.vercel.app HTTP 200 com player correto. Fonte usa links Buygoods e botão Ordering available soon desativado; não está pronta para tráfego.
- H&W Powder LT aprovada; Capsules LT pendente é variante distinta.
- H&W tem checkouts DTC /v2 e pacotes 6b19aj,6b19,3bottles; registrados separadamente sem substituir página atual.
- PDP legado slim.purelabss.com/slim-pdp-v3 respondeu HTTP 404; não cadastrado como ativo.
- Tracker local excluído do Git via .gitignore; ambas as páginas da cópia referenciam tracker público existente https://slimsoda-powder.vercel.app/assets/pages/dtc/pv/ml01/js/imptrack.js (HTTP 200). Fonte original intacta; dependência externa não é repositório autocontido.
- H&W lista 6 arquivos: PDP ZIP 4.9 MB, advertoriais ZIP 6 MB, imagens ZIP 17.9 MB, brief HTML 4.5 MB, vídeos RAR 3.3 GB e 705.4 MB. Materiais locais correlacionados por formato/tamanho; hash remoto não conferido.
- Botão novo Vturb criado, salvo e habilitado em 37:06 para checkout DTC H&W com aff_6821377. Botão independente da página antiga Ordering available soon; fluxo público até o pitch ainda não validado.
- Quatro advertoriais originais e PDP v3 local copiados para materials/ no repositório privado, com assets e sintaxe JavaScript conferida. Não publicados nesta sessão.

## Validação e limites

- H&W: quatro ofertas/IDs e links oficiais conferidos na sessão autenticada.
- HTTP 200/player: Leaftide, quatro CardioFlush, SlimSoda Powder; HTTP 200 dos dois advertoriais MemoFlow, domínio ADV e PDP.
- Império: Briefing dos quatro projetos conferido; legados sinalizados, conteúdo preservado. Total atual: Leaftide 11, CardioFlush 16, MemoFlow 18, SlimSoda 19 links.
- GitHub: quatro fontes privadas; commits remotos conferidos. ZIPs grandes e trackers com chaves fora do Git; Leaftide/Slim dependem dos trackers públicos existentes.
- MemoFlow/Slim: botões novos Vturb confirmados salvos e habilitados, com H&W affid=aff_6821377. Não houve compra/teste Purchase.
- JavaScript: sintaxe de arquivos/inline scripts das cópias conferida; nenhuma execução de scripts de fornecedores para validação.
- Império: typecheck aprovado após conclusão da alteração paralela; lint 0 erros/2 avisos; 623 testes/91 arquivos aprovados. Nenhum código do app foi alterado ou deployado por esta story.

## Próximas ações

1. Usuário finalizar 2FA Meta diretamente no navegador; conferir BM/pixels e eventos antes de atribuir qualquer integração como verificada.
2. Decisão pendente apresentada: versões isoladas com H&W; substituir checkout publicado; ou manter destinos atuais. Sem resposta, destinos Leaftide/CardioFlush permanecem preservados.
3. Completar checkout/legal e publicação da VSL local MemoFlow; validar fluxo público dos CTAs novos até o checkout e depois eventos.
4. Conferir/regularizar CTA e pitch das variantes CardioFlush e ML04 na direção escolhida, sem alterar players já usados em produção sem decisão.
5. Conferir equivalência de materiais remotos e armazenar vídeos/ZIPs grandes fora de Git conforme necessário.
