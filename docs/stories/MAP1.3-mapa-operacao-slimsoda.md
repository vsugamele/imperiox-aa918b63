# Story MAP1.3 — Mapa de operação da SlimSoda (piloto: Ads · Orgânico · X1)

Pedido: ter no Império o desenho de cada projeto por operação (orgânico, ads, X1), com cada etapa dizendo qual agente/skill executa, com quais regras, e a IA lendo isso para executar e melhorar o funil. SlimSoda é o piloto; depois replicar para CardioFlush, MemoFlow, LinfaFlow e JP.

## Feito (29/09/2026)
- [x] Mapa novo "SlimSoda — Operação (Ads · Orgânico · X1)" no canvas (`/funis?view=mapa`): 23 etapas, 27 conexões, 5 seções (Inteligência, Ads, Destinos e conversão, Orgânico, X1). Nenhum mapa existente foi alterado.
- [x] Etapas com dados reais do repositório `Slim-Soda01` e do banco: 6 advertoriais, quiz, VSL, PDP, buy page, checkout H&W (`cc.slimsodapowder.com`), Pixel 1619587959397761 + CAPI, briefs e análise de top performers, personas Ray/Hank, Central Orgânica, Zernio, chat X1.
- [x] Cada etapa com playbook (o quê, entradas, saídas, pronto quando), executor (`AI_SKILL`, `EXTERNAL_TOOL`, `API_AUTONOMOUS`, `HUMAN_OPERATOR`), skill e checklist do que já existe e do que falta.
- [x] Molduras das seções com `z_index = -1` (com 0 elas cobriam os cartões).
- [x] `get_project_map` passou a ler o funil da SlimSoda por fase: Aquisição, Conversão e Relacionamento construídos; Ascensão falta (checkout sem upsell/orderbump); sem WhatsApp; sem sequência de e-mail.
- [x] `get_executable_steps` / REST do `project-mcp` passaram a ler `executor_type` e `linked_skill_id` da etapa (antes só marcações nas notas, e as etapas apareciam como `human_general` / `none`). Publicado e verificado.

## Limites combinados
- Automação não sobe cloaking nem peças com marca de terceiros (TODAY/NBC, CNN, Oprah); as etapas de advertorial e VSL têm item de checklist "versão própria sem marca de terceiros".
- Subida na BM: IA prepara, humano aprova.

## Lacunas de dados que travam a autonomia
- [ ] Conta de anúncio da SlimSoda sincronizada com o Império (`imphq_ads_spend` vazio).
- [ ] Vendas da H&W chegando ao Império com origem (postback/webhook) — hoje `imphq_vendas` vazio.
- [ ] Contas Ray e Hank conectadas ao Zernio no Império e gatilhos BELLY/MORNING.
- [x] Eventos de funil reais (02/10): o mapa (tela e project-mcp) conta sessões distintas com evento que não seja `heartbeat`, pela função `imphq_funnel_sessions` (migração `20261002_imphq_funnel_sessions.sql`, aplicada). Rodando a partir de 10 sessões reais em 7 dias (decisão do Vinicius). Em 02/10: SlimSoda 3, Cardio Clear 16, JP 0.

## File List
- supabase/functions/project-mcp/index.ts
- docs/stories/MAP1.3-mapa-operacao-slimsoda.md
- (dados) imphq_company_maps / nodes / edges / annotations — mapa `a2e01bd8-f262-43d9-a91f-779ea371ca40`
