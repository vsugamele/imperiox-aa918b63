# Story CSX1.3 — Cinna Shield centralizado no Império

Usuário autorizou integrar ao Supabase/painel e conferir o fluxo. Proposta aprovada: manter engine, persistir configuração/sessões de teste no Supabase e executar IA em Edge Function autenticada. Não exige contas Meta para conferir o fluxo; envio real permanece fora do modo teste.

- [x] Schema completo das tabelas relacionadas e auth/RLS inspecionados.
- [x] Projeto Cinna Shield cadastrado sem substituir projetos existentes.
- [x] Configuração versionada, sessão persistida, retry/lock e histórico no Supabase.
- [x] Edge Function com autenticação e IA via segredo existente.
- [x] Tela no Império para conferir/editar nove etapas e testar conversa.
- [x] Deploy, validação auth/concorrência, lint/tipos/testes/build.

Arquitetura: novas tabelas específicas evitam reutilizar sessões genéricas com chave incompleta de conta/projeto. Engine é reutilizado sem fork manual; sincronizado no bundle de Edge por script e hash. Config do projeto tem revisão CAS; sessão fixa snapshot. Serviço reivindica lease de turno e commit atômico (estado+resposta), sem envio Meta. Admin approved do Império pode gerenciar/testar; RLS impede usuário anon/pending. Segredo OpenRouter já cadastrado no projeto; não transferir chave de chat/processo.

Validação: 86 testes passam; lint dos arquivos novos e tsc --noEmit -p tsconfig.app.json passam; build local e Vercel passam. Lint global tem dívida anterior (5049 erros/155 warnings); nenhum push feito. SQL transacional com rollback confirmou lock, replay e persistência atômica. Anônimo recebe 401. Health autenticado de serviço confirmou source=ai, intent=price, action=hold. Browser Chrome manteve 404 antigo após deploy; screenshot/CDP e navegador embutido falharam por timeout. HTTP público 200 e bundle de produção contém a rota nova; validação visual autenticada pendente.

File List: src/pages/CinnaShieldX1.tsx; src/App.tsx; src/pages/OpenFlow.tsx; supabase/config.toml; supabase/migrations/20260908001000_cinna_x1_cloud.sql; supabase/functions/cinna-shield-x1/{index.ts,engine.ts,deno.json}; scripts/cinna-shield-x1/sync-edge.mjs; docs/sessions/2026-09/cinna-x1-cloud.md.
