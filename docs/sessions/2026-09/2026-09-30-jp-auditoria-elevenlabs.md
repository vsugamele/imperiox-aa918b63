# Auditoria ElevenLabs — consumo e entrega de áudio do JP

Data: 30/09/2026, horário de São Paulo. Escopo confirmado pelo usuário: consumo acumulado do mês. Análise: @analyst; eventual implementação: @dev, validação: @qa, publicação: @devops.

## Conclusão

Houve desperdício confirmado: entre 08 e 12/09, o sistema gerou 162 áudios e tentou enviá-los ao WhatsApp. O provedor rejeitou 157 envios com HTTP 400; somente cinco receberam HTTP 201. Aceitação pelo provedor não equivale, sozinha, a recebimento ou reprodução pelo destinatário.

Dos 162 áudios, 138 pertenciam a conversas de grupos e todos foram rejeitados. Outros 24 eram de conversas individuais: 19 rejeitados e cinco aceitos. Algumas conversas de grupo estavam identificadas com os nomes Vinicius e Bruno, embora o destinatário fosse um JID de grupo. Isso explica parte da impressão de consumo apenas para os sócios. Não foi comprovado consumo exclusivamente para os dois.

O saldo nos erros recentes do ElevenLabs é **zero créditos**. Nas últimas 24 horas consultadas, houve 15 tentativas de síntese e cinco de transcrição, todas rejeitadas por `quota_exceeded`. Essas tentativas recentes não são prova de novas gerações cobradas. A conta não consegue produzir voz nem transcrever esses áudios enquanto a cota estiver indisponível.

Nenhuma alteração de produção, envio, geração de áudio ou compra de créditos foi realizada durante a auditoria.

## Evidência do mês

Período: desde 01/09/2026 às 00h de São Paulo (`2026-09-01T03:00Z`) até a consulta de 30/09.

| Data em São Paulo | Arquivos de voz do JP no Storage | Logs de geração/envio analisados |
|---|---:|---|
| 01/09 | 1 | Histórico marca uma resposta da IA como reproduzida; consulta de logs desse dia ficou indisponível |
| 08/09 | 53 | 53 rejeições HTTP 400 |
| 09/09 | 12 | 12 rejeições HTTP 400 |
| 11/09 | 19 | 16 rejeições e três aceites HTTP 201 |
| 12/09 | 78 | 76 rejeições e dois aceites HTTP 201 |
| **Total** | **163** | **157 rejeições confirmadas no pico de 08–12/09** |

Fonte: `storage.objects`, bucket `media`, prefixo `jp_freitas/voice_`; cruzamento com `function_logs` de `wa-ai-reply`, agrupado por `execution_id` e relacionado ao `conversation_id` registrado no START da execução. Datas históricas consultadas em janelas de até 24 horas.

Nos dias do pico, 57 gerações aconteceram entre 28 e 33 segundos depois da anterior. Os arquivos não têm referência persistida no histórico de mensagens. Somente sete dos 163 arquivos têm alguma saída no intervalo entre cinco segundos antes e dois minutos depois da geração; esse cruzamento por horário é apenas indício, pois pode coincidir com outra conversa. Os logs por execução são a confirmação mais forte das rejeições.

Também foram encontrados seis arquivos de cache de voz de outro fluxo, `linfaflow-care-media/voice-cache`, em 08/09. Não foram somados ao consumo do JP. Studio e execuções OpenFlow consultadas não apresentaram registros recentes identificáveis como geração ElevenLabs nas tabelas examinadas. Isso não exclui outros aplicativos usando a mesma conta/chave.

## 1. Geração antes de validar entrega e repetição após falha

O caminho de `wa-ai-reply` sintetiza o texto, salva um MP3 e só então chama `sendWhatsAppAudio`. Em falha de envio, limpa a trava e retorna erro no JSON, porém sem status HTTP de erro explícito nesse ramo. Também não registra uma tentativa de áudio com contador de falhas por mensagem nem reutiliza o arquivo gerado na próxima tentativa.

Assim, uma nova execução pode pagar por outra síntese para o mesmo contexto sem que a anterior tenha chegado ao WhatsApp. O padrão de repetição e as rejeições estão confirmados; a origem exata de cada reexecução histórica não foi isolada.

Referências: `supabase/functions/wa-ai-reply/index.ts:2257–2315,2491–2511,2800–2805`.

O envio concatena `phone + '@s.whatsapp.net'`. Isso é um caminho para número individual, inadequado quando o identificador representa grupo. Nos logs do pico, 138 execuções corresponderam a conversas `jid_suffix='g.us'`; todas receberam 400.

Os outros 19 erros de destinatários individuais exigem análise específica. O log de áudio guarda somente o status HTTP, sem o corpo da rejeição; não foi possível atribuí-los com segurança a número inválido, formato ou conectividade.

## 2. O bloqueio de grupos já existe na versão atual

A geração de 12/09 foi executada na versão 282. A versão publicada consultada em 30/09 é 306 e tem guardas antecipadas que bloqueiam grupo/broadcast/canal e conversas de grupo no banco antes da geração.

Portanto, o pico histórico não deve ser descrito como prova de que a versão atual continua sintetizando para grupos. A guarda atual existe; sua existência não resolve os demais problemas de gasto, transcrição, rastreio e falhas de envio.

Referência: `wa-ai-reply/index.ts:62–103`.

## 3. Critérios de voz são amplos; não há restrição aos sócios

Configuração por provedor do JP: voz habilitada, ElevenLabs, modelo de síntese `eleven_multilingual_v2`. A configuração genérica do projeto tem voz desabilitada, mas o WhatsApp prioriza a configuração específica do provedor.

A voz é acionada por:

- etapa OpenFlow forçando áudio;
- áudio enviado pelo lead, mesmo antes de avaliar o toggle geral;
- áudio entre as últimas três mensagens recebidas;
- primeiro contato;
- retorno depois de seis horas;
- palavras muito amplas como “hoje”, “amanhã”, “ajuda”, “acesso” e “entrar”;
- intenção de compra.

Os logs recentes mostram nove gatilhos por retorno após silêncio, três por intenção de compra, dois por áudio recente e um por primeiro contato. Não foi encontrada whitelist de sócios nesse caminho.

Não há orçamento/limite de caracteres por conversa, cache de síntese por texto+voz, trava compartilhada de saldo esgotado ou pausa depois de três falhas. Desabilitar somente `voice_reply_enabled` não garante bloquear todo TTS: áudio recebido e etapas forçadas podem passar por outras condições.

Referência: `wa-ai-reply/index.ts:2172–2257`.

## 4. Transcrição também utiliza ElevenLabs

O consumo não é apenas voz de saída. `wa-audio-transcribe` usa Scribe v2 para transformar áudios recebidos em texto. O webhook dispara essa transcrição independentemente do autoresponder.

No mês: 34 registros de áudio recebido; 11 têm transcrição persistida. Desses, sete pertencem a grupos com IA atualmente desativada e quatro a conversas individuais. Isso confirma transcrição de áudio de grupo, não exclusivamente de leads em atendimento individual.

`wa-ai-reply` também transcreve se ainda não encontra texto persistido. Como a tarefa do webhook é disparada sem aguardar sua conclusão, os dois caminhos podem concorrer e pagar duas vezes pelo mesmo áudio. Essa duplicação de cobrança é risco técnico identificado, não quantificada como ocorrência comprovada na auditoria. A reutilização consulta o último áudio da conversa, sem exigir correspondência com o ID/URL do áudio atual, o que também pode reaproveitar transcrição errada.

As cinco tentativas STT recentes rejeitadas por saldo eram de conversas individuais; não foram atribuídas a grupos.

Referências: `whatsapp-api/_lib/webhook-handler.ts:455–465`; `wa-audio-transcribe/index.ts:31–70`; `wa-ai-reply/index.ts:302–368`.

## 5. Histórico não comprova a entrega da voz

Quando o envio de voz da IA é aceito, `wa-ai-reply` grava `message_type:'text'`, sem `media_url`, sem `audio_url` e sem o motivo de ter usado voz. Isso oculta os áudios na tela e impede reconciliar geração, envio e reprodução.

Existe um caminho alternativo `whatsapp-api/send_voice_synthesis` que grava tipo áudio e metadados, mas ele não é o caminho automático de `wa-ai-reply`. Não há indicação de que os 163 arquivos do bucket `media` tenham vindo daquele caminho alternativo.

Além disso, TTS ocorre antes da decisão de `draft_mode`. Se alguém ativar rascunhos, o áudio pode ser gerado e abandonado sem envio. No JP, o modo rascunho estava desativado na consulta; não foi confirmado como causa do pico.

Referências: `wa-ai-reply/index.ts:2430–2442,2557–2565`; `whatsapp-api/index.ts:1206–1217`.

## 6. Não existe conciliação de custo ElevenLabs no banco consultado

Nenhum registro ElevenLabs/Scribe correspondente foi encontrado em `imphq_ai_usage` no mês. O sistema não persiste créditos cobrados, identificador de requisição ElevenLabs ou custo por entrega nessa tabela.

Os erros do provedor citam cota de 52.010 e saldo zero. Isso é evidência do saldo no momento da requisição, não um extrato que atribua todos os créditos gastos a este sistema.

Não foi consultado o histórico financeiro/Usage do painel ElevenLabs. Logo, não há valor exato em reais/dólares nem total de créditos desperdiçados confirmado. Há 157 sínteses geradas com envio rejeitado confirmado. Não houve geração de teste para evitar mais consumo.

## Opções para a correção

1. **Contenção imediata:** bloquear síntese automática e etapas de voz afetadas; manter respostas de texto e definir se a transcrição de conversas individuais permanece habilitada. Aplicar a decisão em todos os caminhos, não só no toggle.
2. **Voz seletiva com controle de gasto e entrega — recomendada:** validar destinatário antes de gastar; manter guarda de grupos; restringir STT ao escopo autorizado; usar idempotência por mensagem e cache de síntese; reenviar o mesmo arquivo em falha transitória; pausar após no máximo três falhas; tratar saldo esgotado; limitar voz por motivo/contexto; registrar áudio, créditos/uso e confirmação de envio. Corrigir os erros individuais com evidência do provedor.
3. **Operação apenas em texto:** desabilitar TTS e STT automáticos no atendimento JP até escolher um novo funcionamento, preservando o recebimento de mídia e a possibilidade de atendimento humano.

Não apagar arquivos ou conversas como parte da correção inicial. Uma pausa permanente ou temporária exige a escolha do usuário; não foi aplicada nesta investigação.

## Handoff e validação

- [x] Confirmado período mensal com o usuário.
- [x] Configuração, código publicado, Storage e logs históricos/recentes consultados.
- [x] Geração cruzada com tentativa de envio por execução.
- [x] Grupos separados de conversas individuais.
- [x] Saldo esgotado e falhas de TTS/STT recentes confirmados.
- [ ] Escolha do usuário; story de implementação.
- [ ] Recuperar detalhes das falhas de destinatários individuais.
- [ ] Consultar Usage/History da conta ElevenLabs para quantificar créditos, se necessário.
- [ ] Implementar e validar um cenário antes de expansão: arquivo gerado uma vez, envio aceito, mensagem de áudio visível e confirmação de entrega.
- [ ] Verificar saldo esgotado, falha de envio, grupo, conversa pausada e mensagens repetidas sem geração extra.
- [ ] Executar lint, typecheck e testes adequados; commit com story; publicação por @devops.

Somente este relatório foi adicionado. Código, configurações e produção permanecem sem alterações nesta auditoria. Alterações locais anteriores foram preservadas.
