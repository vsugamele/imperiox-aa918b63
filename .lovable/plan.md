## Parte 1 — Nó Produto puxando dados reais do Projeto

Hoje o card "Produto" no Hub mostra só nome, preço e descrição. Vou expandir para consumir tudo que já existe em `imphq_projetos.data.briefing.produtos[]`:

- **Links das ofertas** (`normalizeProductLinks(produto)`) listados abaixo do preço, cada um com badge do tipo (Checkout / VSL / LP / Upsell / Downsell / Bônus) e cor da prioridade IA (preferido / alternativo / evitar). Clique abre em nova aba; ícone de copiar ao lado.
- **Botão "Editar links"** no cabeçalho do card → abre o mesmo editor já existente (`ProductLinksTable` do `ProjetoBriefing`) num Dialog, sem sair do Hub.
- **Auto-vinculação:** ao criar assets de Checkout/VSL/LP/Upsell/Downsell/Order Bump, se o produto atual já tem um link com `tipo` correspondente e `prioridade_ia = preferido`, preencher automaticamente o `output` do asset (via `channel_config`) — some o "🛒 Vincular produto" para esses casos.
- **Painel lateral "Dados do produto"** (colapsável, à direita do card): puxa do briefing → avatar resumido, promessa, dores top 3, oferta, garantia, bônus. É o mesmo conteúdo que o Imperador Estrategista já consome, exposto visualmente pra IA e pra você.

## Parte 2 — Jornada do Lead (nova aba no Hub)

Toggle no topo do `/funis` Hub: **Ativos** (atual) | **Jornada**. A Jornada é um canvas horizontal com etapas fixas do funil, onde cada etapa é um "slot" que aceita blocos generativos.

```text
[Descoberta] → [Interesse] → [Consideração] → [Decisão] → [Compra] → [Pós]
    ↓             ↓              ↓                ↓           ↓         ↓
  blocos       blocos          blocos          blocos      blocos    blocos
```

Cada etapa é uma coluna. Você arrasta blocos da sidebar pra dentro. Blocos disponíveis (skills reutilizando o que já existe):

- **Gerar VSL** (usa skill `vsl_writer` + dados do produto)
- **Gerar E-mail** (nova skill `email_writer`, 1 lead + 1 sequência 5 toques)
- **Gerar Copy de Anúncio** (reusa `CreativeAdsActions`)
- **Gerar Landing Page** (reusa pipeline existente)
- **Sequência WhatsApp** (reusa `openflow-executor`)
- **Roteiro de Story/Reels** (reusa Zernio)
- **Formulário de Qualificação** (reusa Form Builder)

Cada bloco arrastado vira um "step" com status (pendente / gerado / publicado). Clicar abre drawer com o output editável + botão "Publicar" que grava no projeto (WhatsApp campanha, e-mail salvo em `imphq_email_templates`, VSL no Swipe, etc.).

### Orquestração pela IA

Botão **"⚡ Auto-Jornada"** no topo:
1. Chama nova Edge Function `journey-orchestrator` que lê produto + avatar + links preferidos.
2. IA (Imperador) decide quais blocos plantar em cada etapa (ex: Descoberta → Reels + Anúncio; Consideração → VSL + E-mail 1; Decisão → Checkout + WhatsApp de objeção).
3. Enfileira geração em paralelo, atualiza status ao vivo (Realtime na tabela `imphq_journey_steps`).
4. Ao final, mostra Diff visual e você aprova bloco a bloco.

### Persistência

Nova tabela `imphq_journey_steps` (projeto_id, produto_idx, etapa, bloco_tipo, config, output, status, order_idx) + `imphq_journeys` (metadados por produto). RLS por membro do workspace do projeto. Sem alterar o que já existe em `imphq_flow_assets`.

## Parte 3 — Auto-refresh nos Ativos

Enquanto isso, no modo Ativos, adicionar um botão "🔄 Puxar do Projeto" no toolbar que:
- Reimporta links/preço/descrição do briefing (caso você tenha editado em `/projetos/:id`).
- Sincroniza `channel_config` dos assets de canal com o link `preferido` de mesmo tipo.

## Arquivos técnicos

- `src/components/funis/ProductHubCanvas.tsx` — expandir card Produto (linha 955-987), adicionar toggle Ativos/Jornada, painel de dados.
- `src/components/funis/ProductLinksMini.tsx` — **novo**, lista compacta de links dentro do card.
- `src/components/funis/JourneyCanvas.tsx` — **novo**, canvas de colunas por etapa.
- `src/components/funis/journey/BlockLibrary.tsx` — **novo**, sidebar de blocos arrastáveis.
- `src/components/funis/journey/BlockDrawer.tsx` — **novo**, editor por bloco.
- `supabase/functions/journey-orchestrator/index.ts` — **nova** edge (orquestra geração).
- `supabase/functions/email-writer/index.ts` — **nova** skill de e-mail.
- Migration: `imphq_journeys` + `imphq_journey_steps` (RLS por workspace, GRANTs).
- `src/lib/produto-links.ts` — usar `pickBestLink({ tipo })` já existente para auto-vinculação.

## Fora do escopo

- Não altero o editor de links em `ProjetoBriefing` (fonte única continua lá).
- Não mexo em `OpenFlow` — Jornada é camada acima, pode gerar fluxos mas não substitui.
- Sem novas dependências.