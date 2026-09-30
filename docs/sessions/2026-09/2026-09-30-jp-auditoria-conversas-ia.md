# Auditoria da IA do JP Freitas — WhatsApp e Instagram

Data: 30/09/2026. Responsabilidade de análise: @analyst. Implementação proposta: @dev; validação: @qa; publicação: @devops.

## Resultado

Os erros relatados foram confirmados em conversas reais. Há causas no cadastro de produtos, na montagem dos prompts, no fluxo de recuperação de acesso, no processamento de preços e na ingestão de mensagens do Instagram. Acrescentar mais uma instrução ao prompt não resolve o conjunto.

Investigação somente de leitura em produção. Nenhum envio, alteração de configuração, chamada de geração de acesso, migração ou deploy foi realizado. Este arquivo é o relatório e handoff da investigação; não representa uma correção implementada.

## Escopo e evidência

- Projeto Supabase: `tkbivipqiewkfnhktmqq`; projeto de negócio: `jp_freitas`.
- WhatsApp: instância `jpfreitas`, Suporte Cursos, conectada e com IA habilitada.
- Instagram: conta `jpfreitas06`, usando Zernio.
- Janela principal: 23/09/2026 às 10h até 30/09/2026 às 10h, horário de São Paulo; intervalo SQL `[2026-09-23 13:00Z, 2026-09-30 13:00Z)`.
- Nessa janela: 45 registros de saída identificados como IA no WhatsApp; 94 no Instagram. As contagens são registros, não pessoas nem taxa de resolução.
- Leitura das 45 respostas do WhatsApp, amostra das 50 respostas mais recentes do Instagram e sequências completas selecionadas. Busca adicional de Master Cuts em 30 dias.
- Grupos de WhatsApp excluídos da análise principal.
- Schema real consultado antes das queries. Código publicado consultado diretamente: `wa-ai-reply` v306, `instagram-webhook` v307, `instagram-api` v307, `zernio-webhook` v269, `instagram-followup-scheduler` v270, `wa-pitch-followup` v138.
- Identificadores de conversa/mensagem abaixo permitem localizar a evidência no banco. Nomes, emails, telefones e conteúdo sensível dos leads foram omitidos do relatório.

## 1. Master Cuts oferecido e datas passadas tratadas como futuras — alta prioridade

### Conversas observadas

Instagram, conversa `8a6738b0-93e9-4068-92bf-196f58a37b22`, em 21/09:

1. Lead: “Ainda não fui”. A IA introduziu Master Cuts e perguntou sobre garantir uma vaga.
2. A IA informou que o evento aconteceria em 29–30/03/2026 e que restavam 15 vagas.
3. Lead: “Março de 2026 já passou”. A IA respondeu que seria em 29–30/03/2024 e continuou oferecendo inscrição. Existem duas respostas distintas da IA nesse trecho, separadas por cerca de um segundo.

WhatsApp, mensagem `2fb83b37-4f65-4bd7-8454-55be880b6627`, em 16/09: a IA sugeriu Master Cuts para aprimorar técnicas, sem informar indisponibilidade.

No período principal, 3 respostas do WhatsApp e 2 do Instagram mencionaram Master Cuts. Essas cinco respostas informam que não há turmas abertas; não foram identificadas ofertas abertas nessas cinco. Isso não elimina o histórico anterior nem as contradições ainda presentes em produção.

### Causas confirmadas no código e cadastro atuais

- Master Cuts está corretamente marcado `ativo:false`, `status:inativo`, `turma_aberta:false`, com aviso de não oferecer.
- Apesar disso, ele continua sendo o primeiro produto do array. Tanto WhatsApp quanto Instagram serializam o array bruto e cortam nos primeiros 500/600 caracteres. O resultado contém exclusivamente Master Cuts, seu link, preço e texto de vagas; os demais produtos ficam fora desse bloco. O aviso de indisponibilidade também aparece, tornando o contexto contraditório.
- O `copy_arsenal` do produto ativo Código dos Cortes Perfeitos contém “Imersão Master Cuts”, dois dias presenciais, prática em boneca e 15 vagas. Trata-se de contaminação de conteúdo entre produtos. A leitura confirmou o dado; não atribui todas as respostas a esse campo, pois cada caminho carrega fontes diferentes.
- O prompt publicado de WhatsApp contém o exemplo explícito: pergunta de valor do Master Cuts respondida com R$ 1.997 e link, apesar das proibições em outros blocos.
- A configuração específica do WhatsApp tem 2.224 caracteres de instruções. A menção à proibição de Master Cuts começa no índice 1.596. O código só inclui os primeiros 600 caracteres, eliminando essa proibição do bloco de instruções customizadas.
- O WhatsApp também consulta regras permanentes que proíbem o produto; o Instagram não consulta essa tabela nesse caminho. Instagram usa a configuração genérica do projeto, diferente da configuração por provedor do WhatsApp. A regra genérica de indisponibilidade chega ao prompt do Instagram, mas compete com o contexto bruto e histórico.
- Instagram e seu follow-up não incluem a mesma âncora de data atual do WhatsApp nem o mesmo catálogo de links por produto.

Referências: `wa-ai-reply/index.ts:1217,1447,1511,1792`; `instagram-webhook/index.ts:460,580,646`; `instagram-followup-scheduler/index.ts:122,162`.

## 2. Link do salão enviado como inscrição em curso — alta prioridade

Instagram, conversa `4dd33920-d297-45a4-8a80-b3ac9a4bb492`, 26/09. Lead identificou “education 5.0”, a IA informou a Formação por R$ 797; após “Sim quero”, enviou `https://jpfreitas.com.br/agenda` como link para finalizar a inscrição.

Mensagem da IA: `9d21891f-36cf-49ad-b396-974d7ab89a96`.

O caminho do Instagram não monta o catálogo completo de links por produto usado pelo WhatsApp. O contexto de produtos foi consumido pelo primeiro item, Master Cuts. A URL de agenda aparece nas instruções gerais, e acabou reutilizada para uma finalidade diferente. O caso confirma o destino incorreto; não é necessário supor um erro no checkout para explicar a falha.

Correção proposta: resolver links por intenção e produto; agenda exclusiva para serviços do salão; venda usa somente destino comercial cadastrado. Sem destino cadastrado, não improvisar URL.

## 3. Domínio comum anunciado como link mágico — alta prioridade

WhatsApp, conversa `b5e87e4c-9bcd-40f6-bd41-05a29f9eefe1`:

- 24/09: a IA disse enviar acesso sem senha, mas entregou somente `https://jphaireducation.com.br`.
- A aluna informou que não conseguia entrar. A IA passou a orientar recuperação de senha.
- 28/09: a IA repetiu que o mesmo domínio era acesso direto sem senha. A aluna respondeu que não entrava direto e o email não chegava.
- 29/09: houve resposta humana dizendo ter liberado o acesso. Essa mensagem não prova, por si, o recebimento ou sucesso posterior da aluna.

O código compartilhado publicado substitui a tag de magic link pelo domínio raiz quando a geração não retorna um link. O bloco de segurança em `wa-ai-reply` tenta gerar novamente, mas mantém a resposta original se também falhar. Assim, o texto pode prometer acesso sem senha sem a operação ter sido concluída.

Referências: `_shared/crmBridgeJP.ts:192–200`; `wa-ai-reply/index.ts:2077–2097`.

A falha exata do serviço CRM naquelas datas não foi isolada nesta investigação. Está comprovado o comportamento incorreto enviado e a existência do fallback silencioso que o permite. Não foi gerado magic link durante a auditoria.

Correção proposta: validar o resultado real antes de anunciar sucesso; em falha, registrar o erro e acionar a recuperação/handoff efetivo, mantendo a mensagem coerente com o resultado.

## 4. Promessas de suporte no Instagram sem resolução observada — alta prioridade

Instagram, conversa `50409317-bbce-4c80-89e7-8b15c3a3b5f7`:

- 25/09: lead pediu acesso às aulas e informou email. A IA disse verificar com a equipe e prometeu retorno/notificação.
- 29/09: a pessoa voltou dizendo que ainda não conseguia acessar. A IA repetiu a promessa de contato com a equipe.

O prompt manda prometer verificação e notificação administrativa. Nesse caminho de resposta DM não existe integração com `crmBridgeJP`, processamento de `JP_MAGIC_LINK`, nem criação de encaminhamento administrativo decorrente dessa promessa. Há outras automações no sistema; não foram descartadas globalmente. O que foi confirmado é a ausência dessas operações nesse caminho e a reclamação repetida dias depois.

Referência: `instagram-webhook/index.ts:646–685,770–784`.

Correção proposta: reaproveitar a recuperação de acesso já existente para WhatsApp ou criar encaminhamento verificável. Anunciar apenas a ação realmente registrada/executada.

## 5. Mentoria de R$ 4.000 escolhida como opção mais acessível — causa reproduzida

WhatsApp, conversa `1eabc8ab-4404-4e58-bfad-96d98360ec7f`:

- 23/09: campanha recuperou checkout do Finalização Express, atualmente cadastrado a R$ 37.
- 25/09: terceiro toque sugeriu “começar com a Mentoria de Negócios por R$4.000”.

Mensagem: `5448c6fc-a686-49fd-ac62-a3a816a1e834`.

O código publicado de `wa-pitch-followup` usa `parseFloat` para ordenar preços. Reprodução com os produtos reais:

| Produto | Valor cadastrado | Valor usado na comparação |
|---|---:|---:|
| Finalização Express | `37,00` | 37 |
| Código dos Cortes Perfeitos | `47,00` | 47 |
| JP Hair Education | `797` | 797 |
| Mentoria de Negócios | `4.000` | **4** |

A ordenação escolhe Mentoria como produto de entrada. Não exige que o valor seja menor que o produto original, não filtra produtos inativos e consulta somente `preco/price`, ignorando itens precificados apenas em `valor`. A configuração não tem produto de entrada explícito. O produto ofertado no metadado atual da conversa está nulo, favorecendo comparação genérica.

Referência: `wa-pitch-followup/index.ts:173–188,212–214`.

Correção proposta: reaproveitar conversor monetário adequado, exigir produto disponível e preço inferior ao original; se nenhum downsell válido existir, encerrar sem oferecer alternativa mais cara. Usar produto original identificado de forma confiável.

## 6. Instagram duplica registros e admite concorrência nas respostas

Na janela fixa, 294 registros de entrada têm outro registro na mesma conversa/direção, com conteúdo idêntico e distância inferior a 10 segundos. Dos 468 registros de saída, 465 têm um par com esse critério. Das 94 saídas marcadas IA, 93 têm par.

Isso é evidência de duplicação no banco. Não significa que todas as mensagens tenham sido enviadas duas vezes ao usuário.

Exemplo da conversa `4dd33920-d297-45a4-8a80-b3ac9a4bb492`: “Sim quero” foi gravado uma vez com ID Zernio e outra com ID Meta; a resposta da Formação também foi gravada uma vez por ingestão direta Zernio e outra por `instagram-api`, com IDs diferentes.

`zernio-webhook` grava diretamente e deduplica por `mid`. `instagram-webhook` também deduplica por `mid` e trata alguns ecos de saída por conteúdo. IDs diferentes entre integrações e a corrida entre gravação/envio fazem o mecanismo ser insuficiente. O histórico enviado ao modelo não elimina esses pares e limita-se aos últimos 20 registros, reduzindo o contexto útil.

Além da duplicação de registros, foram observadas respostas **distintas** da IA quase simultâneas, incluindo as duas correções de data de Master Cuts e duas respostas ao trecho “Melhoras”, em 30/09. O Instagram verifica cooldown/última saída antes de gerar, mas não adquire trava atômica por conversa nesse caminho; duas invocações podem passar juntas.

Foram também encontradas duas saídas da IA com o mesmo parágrafo repetido dentro do próprio texto, em 26/09 e 30/09. Contaminação do histórico é uma explicação plausível; sua causalidade isolada não foi provada.

Referências: `zernio-webhook/index.ts:482–503`; `instagram-webhook/index.ts:293–333,522–549,667–685`; `instagram-api/index.ts:415–423`.

Correção proposta: normalização de identificadores/eventos, ingestão idempotente e trava por conversa; deduplicação no histórico usado pelo modelo. Preservar histórico existente, sem apagar registros como parte da correção inicial.

## 7. A IA inventa experiências pessoais do JP em conversas sociais

Em 27/09, no Instagram, a IA respondeu “A viagem foi ótima” a uma conversa social. Em 30/09, respondeu “Vou cuidar para ficar 100% logo” após o contato desejar melhoras. A pessoa chegou a comentar “Mensagem automática”.

Mensagens: `4660fba8-48e4-488b-a7af-5d9e3ce19252`, `68cfa88c-9d42-46e8-bfa6-1c3e145b6ce2`.

O prompt manda incorporar a persona e humanizar a conversa, mas não separa atendimento operacional de falas pessoais do expert. Também instrui a não mencionar ser IA. Resultado observado: o assistente assume experiências pessoais sem base.

Correção proposta: manter a identidade de equipe/assistente e limitar afirmações ao contexto confirmado; respostas sociais a stories não devem virar relatos pessoais inventados nem ofertas automáticas.

## Opções concretas para a próxima etapa

1. **Contenção de configuração:** priorizar instruções mandatórias e revisar o contexto comercial do JP com backup. Reduz exposição, mas não resolve parse de preço, magic link, deduplicação ou concorrência.
2. **Correção completa das causas — recomendada:** catálogo estruturado de produtos disponíveis e destinos por intenção; regras mandatórias preservadas; remover exemplo contraditório; preço/downsells; sucesso real de recuperação de acesso; operação de suporte no Instagram; idempotência/trava; comportamento da persona. Reaproveitar código existente. @dev implementa, @qa valida e @devops publica após a decisão do usuário.
3. **Pausar os fluxos afetados durante a correção:** pausar a resposta automática do Instagram e/ou follow-ups afetados, conforme decisão do usuário. Reduz os erros imediatamente, com impacto na continuidade do atendimento e recuperação comercial.

## Validação exigida na correção

- [ ] Master Cuts nunca ofertado como disponível; pergunta direta recebe informação de indisponibilidade.
- [ ] Código dos Cortes não herda condições da imersão presencial.
- [ ] Compra da Formação jamais recebe link de agenda de salão.
- [ ] Preços brasileiros são comparados corretamente; downsell precisa ser inferior e disponível.
- [ ] Falha na geração de acesso não produz promessa de entrada sem senha.
- [ ] Promessa de suporte corresponde a operação executada ou encaminhamento registrado.
- [ ] Mesmo evento recebido por Zernio/Meta não produz histórico repetido nem segunda geração.
- [ ] Mensagens próximas do lead são tratadas com contexto atualizado e sem respostas simultâneas.
- [ ] Persona não afirma experiências pessoais desconhecidas do JP.
- [ ] Validar um cenário isolado antes de expandir para mais casos.
- [ ] Executar lint, typecheck e testes apropriados antes de declarar código pronto.
- [ ] Registrar story, arquivos modificados, commit e publicação conforme AGENTS.md.

## Estado e limitações do handoff

- [x] Configurações de ambos os canais verificadas em produção.
- [x] Conversas reais e versões publicadas consultadas.
- [x] Causa monetária reproduzida sem escrita no banco.
- [x] Causas e proposta documentadas.
- [ ] Escolha da opção pelo usuário.
- [ ] Implementação, testes e deploy — não iniciados.

Não foi realizado censo de todas as conversas, validação de pagamento ou emissão de acesso para leads. Não há prova de que os pares de registros correspondam a envios duplicados em todos os casos. O erro específico do serviço de magic link nas datas históricas permanece a investigar. Os logs de IA consultados registram sucesso técnico; isso não comprova resposta correta, acesso concedido ou problema resolvido.

O repositório já tinha alterações locais em `supabase/.temp/cli-latest` e arquivos não rastreados `.claude/launch.json` e `AGENTS.md`; foram preservados. Apenas este relatório foi adicionado nesta investigação. Não houve commit, alteração de código ou publicação.
