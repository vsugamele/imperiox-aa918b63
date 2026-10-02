# Story OP1.2 — Esteira de conteúdo GeeLark (TikTok/IG em farm)

Decisões do Vinicius (02/10/2026): 4 tabelas `imphq_` novas (a `posting_log` antiga fica intocada); arquivos no Supabase agora, Drive depois; nada posta sem aprovação por lote; métricas por coleta pública + link e venda.

Contrato do GeeLark conferido na doc oficial (github.com/GeeLark/geelark-openapi) em 02/10:
- Postar no TikTok: `POST /open/v1/task/add` (`taskType` 1 vídeo, 2 aquecimento, 3 carrossel; até 100 por chamada).
- Reels: `rpa/task/instagramPubReels`, `rpa/task/faceBookPubReels` (aceita `page`), Shorts: `rpa/task/youtubePubShort`.
- Upload: `upload/getUrl` devolve `uploadUrl` (PUT) e `resourceUrl` (usada na tarefa); o arquivo expira em 30 dias.
- Status: `task/query` (1 esperando, 2 rodando, 3 concluída, 4 falhou, 7 cancelada; `failCode`, `shareLink`).
- Métricas de conta: `analytics/data` (plays, seguidores, curtidas, comentários, salvos, compartilhamentos por dia; exige plano Pro). Métrica por post não existe na API.
- Limite: 200 req/min e 24.000/h; estourar trava a API por 2 h.

## Feito (02/10/2026)
- [x] Tabelas `imphq_social_accounts`, `imphq_content_items`, `imphq_content_posts`, `imphq_content_metrics_daily` + bucket público `content-media`. Migração `20261002_imphq_content_pipeline.sql`, aplicada. Teste de integração SQL com rollback: postagem criada, sem duplicar peça × conta, 4ª tentativa barrada, status inválido barrado, métrica única por conta/dia/fonte (0 linhas sobraram).
- [x] Regras em `_shared/content-pipeline.ts`: só sai peça aprovada em conta ativa do GeeLark, até 3 tentativas; pedido por plataforma; leitura do ID da tarefa; tradução do status (conta bloqueada → conta `bloqueado`; deslogada → `pausado`; falha comum → nova tentativa até 3); planejamento por limite diário de cada conta; UTM por postagem. Testes: `src/test/content-pipeline.test.ts`.
- [x] Cliente `_shared/geelark.ts` (token, traceId, erro com código do GeeLark, upload por URL, consulta de até 100 tarefas). Testes com fetch simulado: `src/test/geelark-client.test.ts`.
- [x] Worker `geelark-publisher`: acompanha tarefas em andamento, devolve reservas órfãs ("enviando" > 15 min) e envia as postagens vencidas em lote (máx. 25), reservando cada uma antes de chamar o GeeLark. `dry_run` lista o que sairia. Deno check sem erros.
- [x] CLI `scripts/content.mjs`: contas (listar, adicionar, alterar), peças (subir vídeo ao Storage), lote, aprovar, agendar, status (erros e contas paradas) e `run`.

## Pendente
- [ ] Vinicius: gravar o token da API do GeeLark como secret (`GEELARK_API_TOKEN`) e publicar o `geelark-publisher`.
- [ ] Vinicius: lista de aparelhos/contas (ID do aparelho no GeeLark, plataforma, @, projeto, link da bio).
- [ ] Primeiro teste real: 1 conta, 1 vídeo, `run --dry-run`, depois `run`; conferir tarefa concluída e link do post. O método do upload (PUT na `uploadUrl`) não está detalhado na doc e é validado nesse teste.
- [ ] Agendar o worker no pg_cron (a cada 5 min) só depois do primeiro teste real.
- [ ] Métricas: sincronizar `analytics/data` (se o plano for Pro) e coleta pública por URL do post; ligar UTM às sessões e vendas.
- [ ] Geração dos vídeos em série a partir dos roteiros e cópia no Drive.
- [ ] Segurança (fim): o `geelark-publisher` aceita a chave pública do app no gateway; só processa o que já está aprovado e vencido.

## File List
- supabase/migrations/20261002_imphq_content_pipeline.sql
- supabase/functions/_shared/content-pipeline.ts
- supabase/functions/_shared/geelark.ts
- supabase/functions/geelark-publisher/index.ts
- scripts/content.mjs
- src/test/content-pipeline.test.ts
- src/test/geelark-client.test.ts
- .gitignore
- docs/stories/OP1.2-esteira-geelark.md
