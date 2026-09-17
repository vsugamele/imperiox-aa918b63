# Cinna Shield x1 — CSX1.1

Sistema local de revisão: roteiro versionado, interrupções, classificador de IA opcional, CLI JSON e simulador responsivo. Não envia mensagens para contas de Instagram/Facebook. Não é um endpoint público de produção.

## Executar

No diretório raiz do Império, com Node 22.18+:

```powershell
node scripts/cinna-shield-x1/run.mjs
```

Abra http://127.0.0.1:4318. Apenas loopback e a origem local são aceitos. Não use localhost: a origem configurada é 127.0.0.1. Porta alternativa: variável CINNA_X1_PORT.

Para usar o motor sem interface:

```powershell
'{"eventId":"start-1","message":""}' | node scripts/cinna-shield-x1/run.mjs --once
```

Próximas chamadas recebem `state` da decisão anterior, `eventId` único e `message`. Esse modo é uma ferramenta local para integração/teste; o adaptador de produção deve possuir o estado no servidor, nunca confiar em estado enviado por um visitante. O motor é puro: o chamador confirma entrega antes de persistir o novo estado.

## IA

O servidor usa OPENROUTER_API_KEY e CINNA_AI_MODEL do processo. Não lê o cofre, não cria arquivo de segredo e não expõe chave ao navegador. Configure localmente por seu mecanismo de segredos e reinicie o servidor. Sem ambas, a interface informa “IA não configurada” e opera com regras e fallback; isso não é uma chamada de IA real.

A IA classifica respostas ambíguas e livres. Retorna somente um enum de intenção. Não gera copy livre nem escolhe oferta, URL, fatos ou estado. Respostas comerciais vêm da configuração revisada. Timeout, saída inválida ou chave ausente mantêm a pergunta pendente. Texto digitado vai ao provedor somente quando a classificação externa for usada; o histórico completo não é enviado. Use dados de teste no simulador.

## Editar conteúdo

`flow.yaml` usa o subconjunto JSON válido de YAML, para não acrescentar parser/dependência. Preserve nove IDs únicos e aumente `version` quando alterar o fluxo. `sourceGroups` aponta os grupos originais do Typebot. Esta é uma adaptação textual de revisão; não é importação literal nem importação pronta do OpenFlow. Os textos originais continuam na pasta Diabetes/x1-cinna-shield/roteiro-original.md e no export fornecido.

A oferta inicia com `approved: false`, URL e preço nulos. Só marque como aprovada após confirmar pacote, preço, URL real e condições. Validação rejeita example.com, protocolos inseguros e domínios de teste. Validar sintaxe não comprova vendedor, preço, disponibilidade ou conformidade.

Pedidos de compra encerram a automação com o link aprovado; sem oferta, pausam para humano. O simulador não notifica um atendente. Pedidos de parada impedem novas mensagens até uma nova sessão explicitamente criada. Estado não guarda respostas pessoais; a conversa visual fica em memória. Servidor conserva recibos de teste em memória por até duas horas sem atividade, até 100 sessões/1000 eventos por sessão; reinício apaga tudo.

## Contrato de conexão ao Império

1. Resolver no servidor projeto + conta + canal autenticados. Fixar versão por sessão.
2. Validar webhook/permissões/janela vigente de resposta; deduplicar ID do provedor por essa identidade composta.
3. Usar roteamento exclusivo: Cinna OU autoresponder existente; nunca ambos.
4. Carregar sessão persistente com revision; adquirir lock/CAS; invocar motor.
5. Gravar outbox e enviar por adaptador real de Instagram ou Messenger. Confirmar estado somente após entrega conforme política de retry/idempotência do provedor.
6. Cancelar fila em opt-out/handoff; notificar atendente com mecanismo configurado. Não transportar relatos clínicos para eventos publicitários.

Não ligar diretamente o pacote ao `channel-ai-reply`: a revisão identificou avanço incondicional, ausência de envio Instagram em `channel-out` e problemas de isolamento/concorrência. Esses handlers não foram modificados. Não há migration nesta entrega. Projeto/contas, transporte e armazenamento precisam de validação antes de produção.

## Verificar

```powershell
npm test -- src/test/cinna-shield-x1-engine.test.ts
npx eslint src/lib/cinna-shield-x1/engine.ts src/test/cinna-shield-x1-engine.test.ts
npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/lib/cinna-shield-x1/engine.ts
node scripts/cinna-shield-x1/verify-http.mjs
```

A última verificação exige servidor local ativo; cria apenas sessões de teste. Gates completos e limitações registrados em docs/sessions/2026-09/2026-09-07-cinna-shield-x1.md.
