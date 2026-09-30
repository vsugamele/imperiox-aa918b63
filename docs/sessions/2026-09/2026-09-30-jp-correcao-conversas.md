# Correção do atendimento JP — WhatsApp e Instagram

Data: 30/09/2026. Story JP1.1. Autorização: correção completa das causas identificadas, escolhida pelo usuário. Implementação @dev, validação @qa, publicação @devops.

## Resultado

Correções publicadas no projeto Supabase `tkbivipqiewkfnhktmqq`. Sete funções ACTIVE, com seus arquivos publicados e dependências conferidos contra os arquivos locais. Migração aplicada. O relatório de auditoria de conversas permanece como registro do estado anterior à correção.

| Causa | Comportamento implementado |
|---|---|
| Master Cuts e conteúdo de imersão no contexto comercial | Catálogo completo de produtos disponíveis; produto fechado excluído da oferta; descrição contaminada não é incorporada ao contexto; instruções completas e regras obrigatórias prevalecem sobre exemplos e histórico. |
| Agenda do salão usada para inscrição em curso | Destinos conferidos por intenção e produto; contexto da conversa participa da validação; falta de destino comercial não resulta em URL improvisada. |
| Datas passadas e persona do expert | Data de São Paulo e identidade de assistente/equipe nas regras; experiências pessoais e promessas de ações não realizadas são proibidas. |
| Mentoria de R$ 4.000 escolhida como opção barata | Conversão de preço brasileiro; alternativa exige disponibilidade, link e preço menor que o produto original identificado. Sem alternativa válida, não oferece downsell. |
| Domínio raiz anunciado como acesso sem senha | Resposta depende de acesso ativo e token válido retornado pelo CRM; erro HTTP nunca é tratado como sucesso, mesmo com corpo contraditório; fallback para domínio raiz removido. |
| Suporte no Instagram prometido sem ação | Mesmo fluxo de recuperação verificada do WhatsApp; falha gera encaminhamento persistido e pausa da IA na conversa; não concede produtos por cortesia. |
| Duplicação e respostas concorrentes no Instagram | Ingestão transacional com equivalência entre eventos Meta/Zernio; aliases preservados; trava por conversa e token de liberação; histórico deduplicado somente entre integrações equivalentes. |
| Mensagem nova durante uma resposta ou falha de execução | Mensagem mais recente continua pendente; retomada usa o agendador existente de dez minutos; três falhas pausam a conversa e registram notificação. Follow-up usa a mesma trava e revalida estado antes de enviar. |
| CRM indisponível e consulta incompatível | Segredo existente do ambiente passa a ser usado, com fallback ao cadastro antigo; contrato `exists`/`entitlements` respeitado; busca administrativa paginada e consulta por telefone compatível com WhatsApp. |

O cadastro bruto de produtos e o histórico antigo foram preservados. A proteção contra conteúdo contaminado foi feita no contexto usado pelo atendimento. Repetições legítimas da mesma integração continuam sendo mensagens distintas.

## Publicação e rastreabilidade

| Função | Versão confirmada |
|---|---:|
| instagram-api | 310 |
| instagram-webhook | 310 |
| zernio-webhook | 272 |
| instagram-followup-scheduler | 273 |
| wa-ai-reply | 309 |
| wa-pitch-followup | 141 |
| crm-bridge | 9 |

Migração: `supabase/migrations/20260930150225_jp_conversation_policy.sql`. As quatro RPCs de ingestão/trava/liberação/pendências têm execução restrita a `service_role` e administração do banco; `anon` e `authenticated` não receberam permissão.

Branch: `codex/jp-conversation-fixes`.

- `fa4506fc`: tratamento de conversas, catálogo, acesso e concorrência.
- `b5590bc3`: restauração do CRM e consulta por telefone.
- `ff35ee1e`: validação efetiva de credenciais internas do CRM.

O deploy foi realizado diretamente pela CLI autenticada do Supabase. Não houve push Git. O estado local anterior foi preservado, incluindo `AGENTS.md`, `.claude/launch.json` e `supabase/.temp/cli-latest`. O relatório de ElevenLabs e o `deno.lock` gerado durante a validação ficaram fora dos commits desta correção.

## Validação

- 467 testes passaram em 66 arquivos; 32 cenários específicos de política comercial, recuperação de acesso e autenticação/consulta do CRM.
- Lint sem erros, com dois avisos anteriores de UI; typecheck passou. Deno check das sete funções passou.
- Integração SQL validou primeiro um evento isolado e depois duplicação entre provedores, repetição legítima, exclusão mútua, liberação com token incorreto, preservação de nova mensagem, união de ecos e pausa após três falhas. Transação revertida integralmente.
- Todos os arquivos e dependências das versões publicadas foram comparados ao código local por tamanho e hash do conteúdo normalizado. Não houve divergência.
- Consulta real `lookup_lead` respondeu HTTP 200, encontrou uma conta e dois acessos cadastrados. Apenas status e contagens foram registrados, sem dados pessoais.
- Chamada sem credencial respondeu HTTP 401. Os testes também cobrem token administrativo forjado: a declaração de `service_role` no JWT não autoriza acesso; um token diferente precisa ser aceito pelo PostgREST do mesmo projeto.
- Nenhuma mensagem a lead, geração de áudio, concessão de produto ou emissão de link de acesso real foi realizada como teste.

## Limites e continuidade operacional

O login completo de um aluno e o recebimento de um magic link precisam ser confirmados em atendimento legítimo posterior. A validação atual comprova consulta real ao CRM e cobre emissão/sucesso/falha com testes isolados; não prova que um aluno já entrou após o deploy.

Uma conversa pausada por falha de acesso precisa de tratamento humano do encaminhamento registrado. A IA não promete solução concluída sem comprovação. Mensagens pendentes do Instagram são retomadas pelo agendador existente, sem novo monitor externo.

As causas técnicas identificadas foram corrigidas. Respostas generativas futuras ainda dependem do contexto da conversa; a publicação não é uma garantia de acerto de toda resposta possível.

A auditoria de consumo do ElevenLabs permanece em `docs/sessions/2026-09/2026-09-30-jp-auditoria-elevenlabs.md`. Esta etapa foi autorizada especificamente para o tratamento das mensagens; não alterou a política de geração ou o consumo de áudio.

Não há bloqueador de publicação. Referências técnicas usadas: [tarefas em segundo plano](https://supabase.com/docs/guides/functions/background-tasks), [funções do banco](https://supabase.com/docs/guides/database/functions) e [chaves de API](https://supabase.com/docs/guides/getting-started/api-keys).
