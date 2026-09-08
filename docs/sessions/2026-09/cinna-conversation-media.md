# CSX1.7 — Ana: conversa, capturas e mídias

## Resultado preparado

Mesma automação `cinna-shield-x1-native`, nove etapas e 43 ações: 26 mensagens/perguntas, nove esperas, seis áudios e duas imagens. Layout e 35 IDs anteriores preservados. Pausas de 1–2 segundos, dentro dos limites do executor. Oferta/checkout e ativação permanecem inalterados.

Copy em inglês aprofunda objetivo, experiência anterior, rotina e objeções. As capturas configuradas ficam no estado privado da execução, limitadas a 240 caracteres por campo, como declarações do usuário, não conclusões clínicas. Nome só é reconhecido quando explicitamente informado na resposta; cinco perguntas guardam motivo, objetivo, experiência, rotina e objeção. Pular perguntas não preenche campo. Dúvidas são respondidas antes de avançar. Compositor recebe respostas anteriores como dados não confiáveis, mantendo fatos verbatim do catálogo aprovado.

Correções verificadas de conversa: negativas à experiência anterior não equivalem a recusa de compra; opções de ingredientes são reconhecidas como resposta ao objetivo; objeções de custo/fórmula são lembradas enquanto recebem FAQ; nenhuma dúvida restante permite chegar ao fechamento; sim ao link depende de pergunta emitida e oferta válida. Um hold limpa o marcador, exigindo nova confirmação. Urgências e orientação clínica individual mantêm encaminhamento humano.

## Mídias

Os seis MP3 originais continham instruções de produção; não foram publicados no fluxo. Geradas seis falas finais via integração ElevenLabs já existente no Supabase (`linfaflow-care-voice`). Cada uma tem texto e transcrição local em `csx17-media`, com cache próprio cinna-csx17. Primeiro item foi validado antes dos demais. MP3 decodificável, conteúdo conferido por Whisper base; nomes próprios podem ter grafia fonética na transcrição. Identificação de voz gerada e transcrição acompanham os blocos. Nenhuma voz clonada criada.

Duas imagens novas: comparação dos ingredientes listados e checklist de compra. Não são prova clínica/depoimento. O infográfico original com claims, o depoimento sem origem e o vídeo-placeholder não foram publicados.

Publicação dos oito arquivos em `creative-assets/cinna-shield/csx17/`, no Supabase `tkbivipqiewkfnhktmqq`; todas as URLs públicas responderam HTTP 200. URLs assinadas temporárias do gerador não foram gravadas no fluxo. Nenhuma credencial salva em arquivo/log/commit.

Preview nativo passa a renderizar imagem/áudio com controles e sem autoplay. Webchat preserva legendas/transcrição quando a mensagem contém mídia. Aparência dos aplicativos Meta permanece controlada pelos próprios aplicativos; não foi criado outro chat paralelo.

## Validação e publicação

QA independente PASS após quatro correções de respostas naturais e consentimento no fechamento. Gates finais: 389 testes em 54 arquivos passaram; lint global, typecheck app/node, build de produção, node --check do widget e Deno check das três funções passaram. Primeiro Deno check sem o import map falhou; nova execução com deno.json existente passou, sem alterar imports para contornar a configuração. Publicação ainda será registrada após conclusão. Backup CAS: `cinna-native-before-CSX1.7.json`. Ações preparadas: `cinna-native-CSX1.7-actions.json`.

## Limites operacionais

Oferta não aprovada: preço de 97 no export não é confirmação comercial; checkout do export era example.com. Pacote, total, frete, termos e checkout reais precisam ser fornecidos/confirmados antes da ativação. Meta ainda não conectado; não houve mensagens para clientes nem teste de entrega Messenger/Instagram. Não foi implementado adaptador Instagram nesta revisão de conteúdo/mídias.

## File List

- scripts/cinna-shield-x1/flow.yaml, voice-manifest.json, prepare-voice.ps1, prepare-native-csx17.mjs
- src/lib/cinna-shield-x1/engine.ts, consultative.ts; supabase/functions/cinna-shield-x1/engine.ts
- src/components/openflow/FlowEditor.tsx, FlowLivePreview.tsx; src/lib/openflow-action-schema.ts; public/webchat.js
- src/test/cinna-conversation-capture.test.ts, cinna-consultative.test.ts, flow-preview-data.test.tsx
- docs/stories/CSX1.7-conversation-and-media.md; docs/sessions/2026-09/cinna-native-before-CSX1.7.json, cinna-native-CSX1.7-actions.json, csx17-media/*, cinna-conversation-media.md

Fonte educativa reconsultada: https://www.nccih.nih.gov/health/diabetes-and-dietary-supplements-what-you-need-to-know. Materiais do produto fornecidos não substituem comprovação dos benefícios/condições de venda.
