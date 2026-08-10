# LinfaFlow X1 — adaptar o fluxo do Typebot e deixar tudo visível no OpenFlow

## Duas coisas neste plano

1. O fluxo do Typebot (LinfaFlow, 9 grupos, EN-US, skin de WhatsApp) vira um template nativo nosso, fundido com a engenharia high-ticket que já colocamos nos templates X1.
2. Resolver o "não aparece pronto": hoje os templates X1 só existem como código dentro do botão **Templates X1** — nenhum fluxo é criado até alguém abrir o dialog e clicar. Vamos mostrar os templates direto na tela do OpenFlow, com estado "ainda não criado", e um botão de criação em 1 clique.

---

## Parte 1 — O que dá para aproveitar do Typebot

O export tem 32 grupos: 10 de configuração da skin (avatar, nome, "digitando…", "online", som, "conta comercial não recebe ligações") e 9 estágios de venda:

```text
1 CONEXÃO        nome do lead + áudio 0
2 CONSCIENTIZAÇÃO  "meias mais apertadas no fim da tarde" + pergunta aberta
3 CURIOSIDADE     buildup do dia + imagem 0 + áudio 1
4 MECANISMO       Flow Reset Method + vídeo + áudio 2
5 BENEFÍCIOS      sapato/meia/andar + pergunta do dia ideal
6 PROVA SOCIAL    print de conversa (imagem 1)
7 OPORTUNIDADE    caminho mais limpo + áudio 3
8 RISCOS E PERDAS custo de esperar + áudio 4
9 FECHAMENTO      $89 + áudio 5 + botão "Get LinfaFlow Now" + redirect
```

O que entra no nosso template:

- **A espinha dorsal dos 9 estágios** e o ritmo de mensagens curtas com espera de 2-4s entre elas (é isso que faz parecer conversa real, não bot).
- **As 4 perguntas abertas** (struggle, o que melhorar primeiro, o que já tentou, dia ideal) — mas aqui elas passam a alimentar a IA em vez de só guardar variável: cada resposta classifica o lead em Skeptic / Tried-everything / Ready e é reaproveitada no future pacing.
- **As mídias já gravadas**: 6 áudios, 2 imagens e o briefing do vídeo do export entram como valores padrão dos placeholders `{{audio_*}}` / `{{img_*}}`, então o fluxo nasce com som e imagem funcionando em vez de placeholder vazio.
- **O fechamento em $89** com botão + redirect para o checkout.

O que a nossa versão acrescenta (e o Typebot não tem):

- IA nos pontos de decisão em vez de script cego: diagnóstico (SPIN completo), árvore de 7 objeções, trial close 0-10 com ramificação (≤5 volta pra objeção, 6-8 fecha o gap, 9-10 fecha a venda).
- Régua de follow-up D+1 / D+3 / D+7 / D+30 — o Typebot morre quando a aba fecha; o nosso continua pelo canal.
- Guardrails: nada de desconto inventado, palavras proibidas de compliance (cure, detox, weight loss, guaranteed), desqualificação de caçador de desconto.
- Tags, qualificação de lead e notificação de operador nos gatilhos de mão levantada.

Resultado: **3 templates X1** no catálogo (Messenger, Webchat padrão e o novo Webchat com skin de WhatsApp), todos em EN-US.

## Parte 2 — Skin de WhatsApp no chat do site

O widget de webchat hoje só tem nome, título, cor e saudação. Para o fluxo parecer o Typebot, o widget ganha:

- avatar, subtítulo ("online" / "conta comercial…"), tema `whatsapp` ou `padrão`, som de mensagem ligado/desligado e textos de "digitando…" / "gravando áudio…".
- indicador de digitando antes de cada mensagem, respeitando o tempo de espera de cada passo.
- bolhas verdes no padrão WhatsApp quando o tema é `whatsapp`.

## Parte 3 — Deixar visível no OpenFlow

- Uma faixa **"Templates X1 prontos"** no topo da lista de fluxos, com um card por template mostrando se já foi criado neste projeto ou não. Card não criado tem botão **Criar fluxo**; card já criado leva direto ao editor.
- Botão **Criar os 3 fluxos LinfaFlow** para instanciar tudo de uma vez (desativados, como hoje).
- Depois de criado, o fluxo aparece na grade normal junto com os outros — some da faixa de pendentes.

---

## Detalhes técnicos

- `src/components/openflow/flow-editor/templates.ts`: novo template `linfaflow-x1-whatsapp` (categoria `x1-conversao`) com os 9 estágios, `delay_ms` por mensagem, blocos de áudio/imagem/vídeo já apontando para as URLs do export, e os pontos de IA/trial close/objeções reaproveitando as constantes `X1_BANNED`, `X1_NEGOTIATION`, `X1_OBJECTIONS`, `X1_TRIAL_CLOSE` que já existem no arquivo. Os dois templates atuais recebem os estágios 7 (oportunidade) e 8 (riscos e perdas) que faltavam.
- `src/components/openflow/X1TemplatesStrip.tsx` (novo): faixa de templates pendentes/criados, consulta `imphq_automacoes` por nome de template para saber o que já existe, reusa a lógica de insert do `X1TemplateLauncher`.
- `src/pages/OpenFlow.tsx`: renderiza a faixa acima da grade de fluxos.
- Migração em `imphq_webchat_widgets`: colunas `tema`, `avatar_url`, `subtitulo`, `som`, `texto_digitando`, `texto_gravando` com defaults compatíveis com os widgets já existentes.
- `supabase/functions/webchat-api/index.ts`: `init` passa a devolver os campos de tema; o snippet de embed em `WebchatWidgets.tsx` ganha o render da skin WhatsApp e o indicador de digitando.
- `src/components/openflow/WebchatWidgets.tsx`: campos de edição da skin.
- Nenhuma mídia é gerada agora — as URLs do export cobrem 6 áudios e 2 imagens; só o vídeo do mecanismo fica como placeholder, e o brief dele já está no documento de mídias v2.

## Fora de escopo

- Importador genérico de JSON do Typebot (o export tem 32 grupos e 10 são só configuração da skin; adaptar 1 fluxo à mão sai mais limpo que manter um parser).
- Gerar o vídeo do mecanismo.
