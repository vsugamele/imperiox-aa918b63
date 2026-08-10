# Gerar os 4 áudios do X1 via ElevenLabs

Eu gero os áudios direto aqui, em EN-US, com a voz **Brian** (`nPczCjzI2devNBz1zQrb`), usando os roteiros palavra-por-palavra que já estão no documento de mídias pendentes.

## Áudios a produzir

| Placeholder | Onde entra | Duração alvo |
|---|---|---|
| `{{audio_ritual}}` | Etapa Mecanismo — explicação do ritual de 90s | ~35-45s |
| `{{audio_inercia}}` | Etapa Implicação — custo de não agir | ~30-40s |
| `{{audio_objecao_preco}}` | Árvore de objeções — preço/Value Equation | ~30-40s |
| `{{audio_fechamento}}` | Fechamento assumptivo | ~25-35s |

Configuração: `eleven_multilingual_v2`, stability 0.5, similarity 0.75, speaker boost on, MP3 44.1kHz 128kbps.

## Passos

1. **Sua API key** — abro o formulário seguro para você colar a `ELEVENLABS_API_KEY` (não cole no chat).
2. **Geração** — rodo os 4 roteiros contra a API de text-to-speech e salvo os MP3s.
3. **Entrega + hospedagem** — os arquivos ficam disponíveis para download e também subo no bucket público de mídia do Supabase, para ter URL definitiva.
4. **Plug no fluxo** — substituo os placeholders nos templates `linfaflow-x1-whatsapp`, `linfaflow-x1-messenger` e `linfaflow-x1-webchat` pelas URLs reais.
5. **Documento** — atualizo a tabela de status do `linfaflow-x1-midias-pendentes-PT-EN.md` marcando os 4 áudios como prontos com as URLs.

## Detalhes técnicos

- Chamada direta a `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` com header `xi-api-key`.
- Uso *request stitching* (`previous_text`/`next_text`) quando o roteiro tiver mais de um parágrafo, para prosódia contínua.
- Bucket: `whatsapp-media` (já público e usado pelo webchat/WA), pasta `x1/audio/`.
- Sem alteração na lógica do executor — só troca de URL nos templates.

## Fora de escopo

Vídeos e imagens continuam pendentes (ElevenLabs não gera). Se quiser, na sequência eu gero as 7 imagens aqui mesmo.
