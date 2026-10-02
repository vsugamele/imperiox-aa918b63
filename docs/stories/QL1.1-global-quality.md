# Story QL1.1 — Qualidade global do Império

Pedido: corrigir os erros globais encontrados durante a sincronização CSX1.4, preservando funcionalidades e dados.

- [x] Baseline: 5.053 erros e 154 avisos.
- [x] Corrigir hooks, expressões, parser e declarações inválidas.
- [x] Substituir tipos permissivos por contratos de banco e validação de payloads.
- [x] Resolver avisos React sem desativar regras.
- [x] Lint global: zero erros e zero avisos.
- [x] Typecheck completo de app e configuração Node passou.
- [x] Suíte completa: 284 testes em 48 arquivos passaram.
- [x] Build de produção passou; aviso de tamanho de chunks permanece informativo.
- [x] Revisão de regressões e documentação.
- [ ] Sincronização/publicação acompanhada na story CSX1.4.

Correções incluem confirmação real de envio/persistência, consultas compatíveis com schema, visualização de versão sem restauração, replay vinculado ao lead correto e preservação de dados JSON. Não foram enviados contatos/campanhas reais nos testes.

Validação das Edge Functions: lint, testes de regressão e checagem TypeScript adaptada. Deno não está disponível neste ambiente; isto não equivale a validação de runtime Deno ou deploy de todas as funções. Publicação das funções de outros domínios não integra este lote de frontend.

File List: docs/sessions/2026-09/quality-file-list.txt.
## Limpeza da auditoria de 29/09 (02/10/2026, aprovada pelo Vinicius)
- [x] `/cockpit` e `/redesign` sem login removidos; as rotas logadas continuam.
- [x] Segunda declaração de `kanban` (redirect para Tarefas que nunca era usado) removida; `/kanban` segue abrindo o Kanban.
- [x] Página do projeto: as 23 abas carregam só quando abertas (`lazyWithRetry` + `Suspense`). Pacote `ProjetoDetalhe` de 764 kB para 83 kB; maior aba 96 kB (Finanças). Conferido na tela: Comando e Avatar abrem.
- [ ] `/dashboard-classic`: não apagado. O rodapé do Dashboard tem o link "Ver versão clássica" e a página é a única que usa 18 componentes (receita, Ads, funil ao vivo, previsão, crescimento). Aguarda nova decisão.
- [ ] Achado em passagem: `src/hooks/useProjectPulse.ts` filtra `imphq_vendas` pela coluna `last_intent_at`, que não existe (400 em toda abertura de projeto); o certo é `data->>last_intent_at`, como no `TodayCard`.
