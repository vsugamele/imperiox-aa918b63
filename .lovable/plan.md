## O que esse site faz que a gente ainda não faz bem

Olhei o painel `john.blackboxmembers.com.br/live`. Não é tracking de pixel — é **telemetria de funil server-side em tempo real**, organizada em torno de uma pergunta única: *"enquanto não há venda, qual caminho/criativo leva mais gente até o pitch por real investido?"*. Pontos que faltam no nosso Dashboard/Gerenciador:

1. **"Online agora" por etapa do funil** (Quiz, VSL, Upsell1/2, Downsell1/2, Obrigado) — visitantes ativos nos últimos 2 min. Hoje só temos vendas e leads, não vemos o funil respirando.
2. **Pitch Rate** = % que chega ao momento de oferta da VSL. É o KPI que substitui ROAS quando ainda não há vendas (caso de criativo novo ou produto em validação). Hoje no Yoshitani só olhamos CPA/Checkout.
3. **Comparação Path A vs Path B** (VSL direto vs Quiz→VSL) com base de custo equivalente — diz pra onde mandar verba.
4. **Ranking de criativos por pitch rate**, não só por CTR/CPA. Já temos `creativeLtv`, mas falta o degrau intermediário "chegou ao pitch".
5. **"Resumo do período" em linguagem natural** no topo (ex.: "Path A leva ~100% mais gente ao pitch por real investido"). Nosso `DailyBriefing` faz algo parecido mas não usa eventos de funil.

## O que vou construir

### 1. Captura de eventos de funil (base de tudo)
Nova Edge Function pública `funnel-track` + tabela `imphq_funnel_events`:
- Campos: `project_id`, `session_id`, `lead_id?`, `step` (enum: `quiz`, `vsl_view`, `vsl_pitch`, `vsl_cta_click`, `checkout`, `upsell1`, `upsell2`, `downsell1`, `downsell2`, `obrigado`), `utm_*`, `creative_id`, `created_at`.
- Snippet JS de 1 linha que o usuário cola nas páginas do funil (igual ao Tracker atual). Em VSL, dispara `vsl_pitch` num timestamp configurável (ex.: aos 18min) e `vsl_cta_click` no botão.
- Heartbeat a cada 30s para alimentar "online agora".

### 2. Novo bloco no Dashboard: **"Funil Ao Vivo"**
Componente `LiveFunnelPanel.tsx` acima do `PredictiveDashboard`:
- 7 cards horizontais (uma por etapa) com contagem de últimos 2min + % do total + barrinha de cor.
- Card grande "Total online agora" + "Última entrada".
- Auto-refresh a cada 15s (Realtime do Supabase na tabela nova).

### 3. Card **"Pitch Rate"** no Yoshitani
Adicionar à `DiagnosticoYoshitani` um terceiro indicador: `vsl_pitch / vsl_view` por criativo, com benchmarks 40%+ (verde) / 25-40% (amarelo) / <25% (vermelho). Vira o KPI decisor quando o criativo ainda não tem volume de venda.

### 4. **Path Comparison** (A vs B)
Componente `PathComparison.tsx` no Dashboard:
- Path A = leads que entraram direto em `vsl_view`.
- Path B = leads que passaram por `quiz` antes do `vsl_view`.
- Mostra Pitch Rate de cada lado + frase decisória ("Path X leva N% mais gente ao pitch por real investido"), usando custo de ads do dia rateado por entradas.

### 5. Ranking de criativos por pitch rate
Nova aba em `Criativos.tsx` ou cartão no `DashboardAds`: tabela `creative_id | views | pitch% | CTR | vendas | recomendação`. Reusa a lógica do `creativeLtv.ts`, só adiciona a coluna pitch%.

### 6. Resumo natural no topo
Estender `DailyBriefing` para, quando houver eventos de funil no período, gerar 2 linhas:
- "🅰 Path Direto: X views VSL → Y% chegou ao pitch → Z% comprou"
- "🅱 Path Quiz: ..."
Mesmo formato do painel analisado.

## Detalhes técnicos

- **DB**: nova tabela `imphq_funnel_events` (RLS por `project_id`), índices em `(project_id, created_at)` e `(session_id)`. Tabela materializada `imphq_funnel_live` atualizada por trigger para a query "online agora" ser O(1).
- **Edge Function** `funnel-track`: aceita POST sem auth (CORS aberto), valida `project_id` contra tabela de "tracking domains" e grava. Reusa padrão do `capture-lead`.
- **Realtime**: `supabase.channel('funnel_live').on('postgres_changes', ...)` no `LiveFunnelPanel`.
- **Snippet** servido em `/tracker/funnel.js` (página estática) — usuário cola `<script src="..." data-project="UUID"></script>`.
- **Compatibilidade UTM**: aproveita o pipeline atual (`xcod`, `src`, `sck`) — o snippet lê do `window.location` e do `localStorage` que o `Tracker.tsx` já popula.
- **Sem quebras**: nada do que existe (vendas, ROAS real, recovery) muda. É camada nova de cima para baixo.

## O que você precisa fazer do seu lado

1. **Colar o snippet** nas páginas: VSL, Quiz, Upsells, Downsells, Obrigado (eu te entrego o HTML pronto).
2. **Marcar o ponto do "pitch"** na VSL (timestamp do vídeo onde a oferta aparece) — configurável no painel do projeto.
3. **Manter o Tracker** que você já usa nos anúncios para os UTMs continuarem chegando.

## O que NÃO vou tocar nesta rodada

- Atribuição de venda existente (já está OK depois das últimas correções Ticto).
- Webhook de pagamento.
- Recovery buckets.

Posso seguir?