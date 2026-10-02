# JP — SDR, suporte e resultados (2026-10-02)

## Feito
Story JP1.5 autorizada pelo usuário: implementação da evolução completa sugerida para WhatsApp e Instagram. Reaproveitados catálogo/persona, CRM de acesso, mensagens, leads e aplicações de regras existentes. Arquivos de Estratégias/playbooks eram de outra tarefa e não entraram neste commit.

Preço isolado, saudação e reclamação não geram compra quente. JP não acumula incrementos comerciais em score de lead; scores/tags históricos foram preservados e deixaram de ativar o closer JP. Novo score do turno é um sinal determinístico (0/20/80), não probabilidade. O closer responde ao pedido explícito com dados confirmados, sem pressão/prova inventada. Qualificação usa uma pergunta relevante e permite preço/link sem exigir duas dimensões antes. Regras de escuta/esclarecimento/resposta à objeção e respeito à recusa aplicadas aos dois canais.

Triagem JP lê mensagens do canal correto e somente contexto recente; verifica fonte/projeto antes de chamar o modelo. Extração persistida exige uma citação literal da mensagem atual, com data/canal/id. Estado do turno, fatos e pendências são separados. Cobrança de imersão é um compromisso a verificar, sem pressupor Master Cuts nem dominar uma pergunta nova sobre livro.

Suporte tem responsável derivado do projeto, abertura, ação, pendência e confirmação explícita. O envio aceito pelo provedor registra link enviado e aguarda confirmação; agradecimento não encerra suporte. Falha depois do link encaminha para a equipe sem emitir mais um token. Eventos repetidos não duplicam estado e ações atrasadas não sobrescrevem um turno mais recente. Follow-ups comerciais bloqueados durante suporte pendente, recusa ou assunto social/agenda.

Atribuição de regras JP agora exige pagamento aprovado no mesmo projeto; aprovação em UPDATE é reconhecida e repetição não soma novamente. Histórico dos contadores permaneceu intacto. Nova atribuição traz attribution_policy=JP1.5 para distinguir o registro novo. Promoção automática de regras JP com contadores antigos bloqueada até revisão semântica; outros projetos mantêm sua decisão anterior. Relatório contabiliza pagamentos reais/aprovados, UTMs, associação a regras, necessidade declarada e estoque de suporte. Associação em sete dias não prova causalidade nem permite calcular conversão misturando coortes.

## Validação
- Primeiro teste: cobrança de imersão do print enviado, anonimizada; suporte com score zero.
- 583 testes passaram em 84 arquivos; tipos passaram; lint zero erros e dois warnings preexistentes.
- Deno check --no-lock passou para as seis funções publicadas.
- scripts/jp-conversation-regression.sql passou contra fontes reais nos dois canais, em transação com rollback: idempotência, confirmação, mensagem atrasada, canal errado, Pix pendente, aprovação em UPDATE e aprovação repetida. Nenhum evento/estado de teste permaneceu.
- scripts/jp-conversation-report.sql executado read-only; registro novo inicia vazio, sem backfill inventado.
- Duas tabelas com RLS e sem privilégios anon/authenticated; RPC exclusiva service_role, SECURITY INVOKER.
- Migrações registradas: 20261002111544_jp_service_decisions e 20261002111753_jp_support_event_order.

## Publicação e estado
Commit de implementação: 947d6cc5. Publicação via CLI do Supabase; sem git push. Fontes completas e todas as dependências publicadas conferidas contra arquivos locais:

| Função | Versão | Estado |
| --- | --- | --- |
| wa-ai-triage | 340 | ACTIVE |
| wa-ai-reply | 322 | ACTIVE |
| instagram-webhook | 321 | ACTIVE |
| wa-pitch-followup | 153 | ACTIVE |
| instagram-followup-scheduler | 284 | ACTIVE |
| wa-rules-evaluate-ab | 151 | ACTIVE |

Controles de voz existentes preservados; nenhuma chamada de geração de áudio foi feita durante esta validação. Nenhuma mensagem de teste foi enviada aos leads.

## Operação e limites
Relatório CLI: `supabase db query --linked --file scripts/jp-conversation-report.sql`. Replay técnico com rollback: `supabase db query --linked --file scripts/jp-conversation-regression.sql` (para diagnóstico dirigido, não execução agendada).

Fit de produto permanece desconhecido sem evidência explícita; necessidade extraída não é qualificação confirmada. Pendências de imersão continuam para verificação humana; não foram canceladas. Confirmação de suporte significa relato explícito de entrada, não telemetria independente de autenticação. Eficiência comercial e qualidade de respostas futuras ainda dependem de conversas reais e dos novos registros, sem teste externo nesta sessão.

Não há blocker de publicação nem ação solicitada ao usuário. Próxima verificação útil, quando houver conversas novas: consultar eventos e relatório, revisar assunto/pitch, suporte confirmado e pagamentos aprovados. Não foi criada automação de monitoramento.

Rollback se necessário: preparar reversão somente dos arquivos deste commit e republicar as funções selecionadas, preservando mudanças paralelas. Manter tabelas/eventos/migrações e histórico; não apagar conteúdo nem resetar o worktree. A correção de atribuição de pagamento é independente do rollback dos prompts.
