# CSX1.8 — Etapas e histórico por lead

## Entrega

Botão “Etapas e histórico” no editor nativo da automação `cinna-shield-x1-native`. Reutiliza execuções, snapshot do roteiro e mensagens do canal existentes; nenhum sistema paralelo ou alteração de banco. Filtros de conversas iniciadas em 7/30/90 dias ou todo o histórico, versão e busca de nome/ID. Histórico individual mostra etapa alcançada, estado, datas, caminho percorrido e mensagens da sessão com imagem/áudio e paginação. O histórico de canal é explicitamente identificado como podendo incluir mensagens fora da execução selecionada.

## Definições

- Unidade: conversa/execução, não lead único. Retornos podem contar novamente.
- Alcance: envio confirmado ou resposta processada naquela etapa. Não é confirmação de leitura.
- Responderam: conversas com evento de resposta processada após confirmar todos os retornos necessários. Pendências de entrega não entram nessa contagem.
- Avanço: decisão da política permite próxima etapa; não implica que a próxima etapa foi entregue.
- Espera: execução ativa no wait da etapa; encaminhamento humano/parada/checkout são separados. Espera não é abandono.
- Link enviado não é venda. Sem atribuição de receita ou compra inventada.
- Consultas paginadas em lotes de 250, até 5.000 execuções recentes. Se o período exceder isso, contagem total e alerta explícito de amostra; orientar reduzir período. Erro de leitura/contagem não aparece como zero.
- Etapas e versões vêm do snapshot executado; registros sem snapshot reconhecido são reportados separadamente. Eventos detalhados não são reconstruídos retroativamente.

## Persistência e permissões

Eventos cinna_turn ficam no step_results da execução, contendo ID da mensagem, etapa de origem/destino, decisão, intenção, fonte, versão e timestamp. Registro ocorre após envio confirmado e antes do avanço do cursor; preserva CAS, bloqueio de pendência e deduplicação. Não copia texto clínico, respostas capturadas, tokens ou conteúdo de mídia para telemetria. Executor preserva os eventos no resume. Estatísticas técnicas antigas ignoram esses eventos para não inflar contagens.

Schemas completos das três tabelas consultados; RLS habilitada. Políticas existentes permitem leitura a usuários autenticados (mensagens/sessões têm política ALL authenticated; execuções SELECT authenticated). Esta entrega não amplia nem altera permissões, não cria grants, tabelas ou endpoints públicos. O conteúdo continua no painel autenticado existente.

Produção consultada antes da implantação: zero execuções para Cinna. Não criados leads, conversas, mensagens ou resultados fictícios em produção. Fluxo permanece inativo, oferta/checkout e canais inalterados.

## Validação

407 testes em 57 arquivos passaram, incluindo 18 novos testes de jornada, paginação e UI. Testes do handler real com storage/transporte isolados verificam emissão única de evento, ausência após envio parcial e etapa anterior correta. QA independente PASS após corrigir checkpoint delivery_pending: última situação por step define pendência; confirmação posterior resolve. Ajuste de descrição acessível do diálogo incluído.

Lint global passou; typecheck, build e Deno check das três funções foram executados. Evidência final e publicação serão registradas ao concluir. Changelog Supabase e documentação de range consultados; nenhuma mudança de SDK necessária.

## File List

- src/lib/cinna-shield-x1/journey.ts, journey-data.ts
- src/components/openflow/CinnaJourneyPanel.tsx, FlowEditor.tsx, flow-editor/useFlowNodeStats.ts
- supabase/functions/_shared/cinna-openflow.ts, channel-ai-reply/index.ts
- src/test/cinna-journey.test.ts, cinna-journey-data.test.ts, cinna-journey-panel.test.tsx, cinna-openflow-runtime.test.ts
- docs/stories/CSX1.8-stage-metrics-history.md; este handoff
