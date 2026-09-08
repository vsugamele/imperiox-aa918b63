# CSX1.6 — Ana consultiva

## O que mudou

O roteiro operacional continua no OpenFlow do Império. A abertura apresenta Ana, do atendimento, sem marca na primeira mensagem. A conversa começa pelo motivo do contato; um sim após a pergunta de apresentação permite continuar. Dúvidas no meio invalidam a permissão pendente e levam a uma confirmação natural; não é preciso decorar uma frase. As nove etapas e os 35 IDs de ações foram preservados.

A IA recebe até oito mensagens recentes e seleciona acolhimento, textos aprovados e uma pergunta. Ela não escreve alegações clínicas livres nem altera o cursor ou checkout. FAQs de preço, frete, composição e objeções preservam respostas configuradas. Se o modelo falhar ou devolver IDs inválidos, permanece a resposta aprovada de fallback. A primeira espera no editor permite revisar os textos aprovados; mudanças valem para novas execuções, preservando snapshots em andamento.

Urgências reconhecidas e pedidos de orientação individual sobre medicamento/adequação interrompem a venda automática. Histórico de diagnóstico ou preocupação geral pode receber acolhimento educativo. Pedido por pessoa real pausa o fluxo. A identidade é esclarecida se perguntada; não se inventam credenciais ou experiências pessoais.

## Verificação

- 358 testes em 53 arquivos passaram na revisão final, incluindo regressões do legado, composição, consentimento natural, dúvidas comerciais, eventos duplicados, envio parcial e autenticação do diagnóstico.
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

Commit inicial 225f6086 publicado na Vercel (READY dpl_28xkZwRDFpqxWfd6MaXznXoZXtyg) e funções channel-ai-reply v14, openflow-executor v464, cinna-shield-x1 v4, com JWT false/false/true preservados.

Comparação otimista da automação confirmou exatamente uma atualização em 2026-09-08 18:11:21.967674 UTC. Releitura:35 ações, Ana,6 textos aprovados, posição x150 preservada,ativo=false e oferta não aprovada.

Diagnóstico com modelo real: preocupação geral retornou contextual=true e acolhimento com informação geral; permissão avançou à etapa2; medicamento e emergência retornaram human. Todos sent=false,sem criação de sessão ou envio a canal.

Patch ab3bd22d corrigiu falso positivo em perguntas sobre usar PayPal/consultar ingredientes; Vercel READY dpl_31zpDesiamRwrkbNT44jindoas3a e Edge15/465/5 confirmadas.

Ajuste final de UX: State.awaitingProductConsent opcional aceita sim natural só após a pergunta de apresentação. Hold/identidade limpam o marcador, reask determinístico não é substituído pelo compositor, confirmação depende de entrega/persistência e deduplicação. Também reconhece pergunta direta sobre o suplemento como interesse, evitando loop no acolhimento. 116 testes focados passaram antes dos gates finais. Sem alteração de tabelas.

A pergunta natural foi atualizada com comparação do conteúdo anterior em 2026-09-08 18:24:10.38402 UTC, preservando os demais campos do registro. Gates finais:358 testes, build, typecheck app/node, lint dos arquivos alterados e Deno passaram.

Código final5c1a5708e2803b4174be91d83b734f147a280b55 publicado. Vercel READY dpl_5SYsoLp7RVmCE5UajyUdNGX14CWy, rota HTTP200. Funções channel-ai-reply16/openflow-executor466/cinna-shield-x1 6 ACTIVE com JWTfalse/false/true preservado; código dos bundles reais conferido com awaitingProductConsent presente.

Lovable confirmou `Your website was updated`. Conferência autenticada da rota nativa: abertura da Ana,35/35blocos,Fluxo válido,primeiro wait Acolhimento e seis pares de identificador/texto aprovado visíveis para edição. Aba deixada aberta no primeiro wait. Sem ativação de canal ou envio a clientes.

Próximos passos operacionais: confirmar oferta/checkout e conectar/testar canal antes de ativar. Diagnóstico interno real já exercitou o modelo; este não substitui teste ponta a ponta de entrega Meta, ainda não conectado neste fluxo.
