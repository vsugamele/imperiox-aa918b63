# CSX1.6 — Ana consultiva

## O que mudou

O roteiro operacional continua no OpenFlow do Império. A abertura apresenta Ana, do atendimento, sem marca na primeira mensagem. A conversa começa pelo motivo do contato; apresentação comercial exige o pedido explícito `Tell me about the product` na etapa de permissão. As nove etapas e os 35 IDs de ações foram preservados.

A IA recebe até oito mensagens recentes e seleciona acolhimento, textos aprovados e uma pergunta. Ela não escreve alegações clínicas livres nem altera o cursor ou checkout. FAQs de preço, frete, composição e objeções preservam respostas configuradas. Se o modelo falhar ou devolver IDs inválidos, permanece a resposta aprovada de fallback. A primeira espera no editor permite revisar os textos aprovados; mudanças valem para novas execuções, preservando snapshots em andamento.

Urgências reconhecidas e pedidos de orientação individual sobre medicamento/adequação interrompem a venda automática. Histórico de diagnóstico ou preocupação geral pode receber acolhimento educativo. Pedido por pessoa real pausa o fluxo. A identidade é esclarecida se perguntada; não se inventam credenciais ou experiências pessoais.

## Verificação

- 347 testes em 53 arquivos passaram, incluindo regressões do legado, composição, consentimento, eventos duplicados, envio parcial e autenticação do diagnóstico.
- Build passou; avisos existentes de tamanho de chunks e import misto permanecem.
- Deno verificou channel-ai-reply, openflow-executor e cinna-shield-x1 com seus imports reais.
- Revisão independente PASS após corrigir pedido por pessoa real, ordem dos sintomas e acolhimento livre.
- Lint global passou após terminar o build (primeira execução encontrou um arquivo temporário do Vite removido durante a varredura).
- Typecheck app e node passaram após trocar Object.hasOwn por hasOwnProperty.call, compatível com o target do frontend. Os 32 testes de composição/diagnóstico e lint do helper também passaram após essa correção.

## Operação e limites

Rota nativa: https://imperiox.lovable.app/openflow/cinna-shield e https://imperiox.vercel.app/openflow/cinna-shield.

Automação `cinna-shield-x1-native`, projeto `tkbivipqiewkfnhktmqq`, versão de roteiro `csx1.6-ana-consultative`. Manter `ativo=false`, oferta não aprovada e checkout ausente. Sem conexão/ativação de Meta ou áudios nesta mudança. O simulador local antigo e a configuração histórica standalone não são o roteiro operacional novo.

Diagnóstico interno existente `cinna-shield-x1` aceita `op:health,native:true,sample:concern|permission|medication|emergency` após autenticação de serviço. Usa apenas exemplos fixos, snapshot efêmero e modelo configurado; não cria sessão, não modifica o banco e não envia mensagens a canais. Uma resposta `contextual:true` significa seleção validada de textos, não envio a cliente.

Rollback de conteúdo: comparar a automação atual antes de restaurar `cinna-native-before-CSX1.6.json`; não sobrescrever edições posteriores. O arquivo `cinna-native-CSX1.6-actions.json` registra o conteúdo proposto, preservando a posição editada no canvas. Código anterior é o commit 4e924e5366c4824f47c866b84b2da141dbd54107; sessões antigas continuam com snapshot antigo.

## Arquivos

- scripts/cinna-shield-x1/flow.yaml
- src/lib/cinna-shield-x1/engine.ts, consultative.ts, openflow.ts
- src/components/openflow/FlowEditor.tsx
- src/lib/openflow-action-schema.ts
- src/test/cinna-consultative.test.ts, cinna-native-health.test.ts, cinna-native-editor.test.ts, cinna-openflow-runtime.test.ts, cinna-shield-x1-engine.test.ts
- src/test/fixtures/cinna-legacy.json
- supabase/functions/_shared/cinna-openflow.ts
- supabase/functions/channel-ai-reply/index.ts
- supabase/functions/cinna-shield-x1/engine.ts, index.ts
- docs/stories/CSX1.6-ana-consultative.md
- docs/sessions/2026-09/cinna-native-before-CSX1.6.json, cinna-native-CSX1.6-actions.json, cinna-ana-consultative.md

## Publicação

Pendente de gates finais, commit, publicação e comparação otimista da automação.
