# Cinna nativo — CSX1.5

Usuário aprovou opção 1: editor e execução nativos do OpenFlow.

Criado em Supabase o registro `cinna-shield-x1-native`, projeto `cinna-shield`, canal Messenger, trigger mensagem recebida, inativo. Importação única de revisão 1 da configuração existente: 26 mensagens/perguntas e 9 waits. Nenhum roteiro anterior foi excluído. Nenhum envio aos canais foi ativado.

Editor utiliza Canvas existente, autosave, histórico e preview. Cada wait mostra Resposta + IA e título da etapa; primeiro wait edita respostas aprovadas, oferta e modelo. Rota antiga abre o editor nativo. Compilador reconstrói a configuração a partir das ações editadas; não sobrescreve com a cópia histórica.

Execução: snapshot por conversa, classificação restrita pela política existente, CAS no turno e retomada vinculada ao execution_id. Próxima etapa é enviada somente pelo executor. Parada/humano preservados; entrega incerta requer revisão e não reenvia automaticamente. Integração atual cobre Messenger/chat do site; Instagram continua dependente de conexão compatível.

Validação e publicação: atualizar após gates finais. Testes não enviam mensagens reais nem geram compras.

Arquivos: src/lib/cinna-shield-x1/openflow.ts, native-contract.ts; src/pages/CinnaShieldNative.tsx; src/App.tsx; src/pages/OpenFlow.tsx; src/components/openflow/CinnaCloudFlowCard.tsx, FlowEditor.tsx, FlowEditorCanvas.tsx, flow-editor/validate.ts; src/lib/openflow-action-schema.ts; supabase/functions/channel-ai-reply/index.ts, openflow-executor/index.ts, _shared/cinna-openflow.ts; src/test/cinna-native-flow.test.ts, cinna-native-editor.test.ts, cinna-openflow-runtime.test.ts; scripts/cinna-shield-x1/export-native.mjs; docs/stories/CSX1.5-native-openflow.md.

Gates finais: lint zero; typecheck app+node exit0; Deno check dos dois entrypoints/dependências exit0; 307 testes/51 arquivos; build exit0. Limites explícitos: fluxo sequencial, nove etapas, pausas por resposta sem timeout; ritmo delay_sec até5s por bloco/20s etapa. Janelas de silêncio e delays por minuto bloqueados antes da ativação/execução.
