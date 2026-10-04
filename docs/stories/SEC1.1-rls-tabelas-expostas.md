# Story SEC1.1 — Tabelas expostas pela chave pública

Achado em 04/10/2026, ao revisar o modal de e-mails da Empresa: 15 tabelas do Império estavam sem RLS. Com a chave pública do app (que vai no navegador e está no `.env` do repositório público) dava para ler leads (2.870, com nome, telefone e e-mail), vendas (1.065), memória das conversas (2.271), webhooks de compra e as 52 contas da Empresa com senha em texto aberto. Teste feito só com leitura de IDs.

Decisão do Vinicius (04/10): ligar o RLS agora e depois mover as senhas para o Cofre.

## Feito (04/10/2026)
- [x] RLS ligado em: imphq_leads, imphq_wa_lead_memory, imphq_webhooks, imphq_vendas, imphq_referencias, imphq_empresa, imphq_automacoes, imphq_funis, imphq_clicks, imphq_quick_links, imphq_ig_sequences, imphq_sdr_coach_audits, imphq_kb, imphq_kanban, imphq_ig_sequence_enrollments. Política: usuário logado lê e grava; `imphq_leads` e `imphq_clicks` aceitam gravação anônima sem leitura. Migração `20261004_rls_exposed_tables.sql`, aplicada.
- [x] Conferido antes: telas públicas não leem essas tabelas (formulário grava pela function `capture-lead`); functions que usam a chave pública repassam o login do usuário ou usam a chave de servidor.
- [x] Conferido depois: leitura anônima volta vazia; como usuário logado as contagens seguem iguais; nenhuma tabela `imphq_` sem RLS.

## Pendente
- [x] SEC1.2 (04/10): senhas das contas no Cofre (Supabase Vault, criptografado). Funções `imphq_set_account_secret` e `imphq_reveal_account_secret` (só logado; cada revelação em `imphq_secret_access_log`); migração `20261004_account_secrets_vault.sql` validada antes com rollback (52/52 senhas e 1 senha de proxy idênticas após decifrar) e aplicada depois que a tela nova estava no ar. Resultado: 0 senha em texto aberto, 53 segredos no Cofre; revelar sem login é negado.
- [x] Tela Empresa → Emails: senha só aparece ao clicar (some em 30 s); edição nunca carrega a senha ("Guardada no Cofre — em branco mantém"); salvar preserva o `extra` existente (antes substituía o campo inteiro e apagava o que não estivesse no formulário). Modal: até 90% da altura da tela com rolagem interna, rodapé fixo com Salvar, seções Conta / Uso / Avançado (foto, proxy e GeeLark recolhidos). Teste: `src/test/empresa-accounts.test.tsx`.
- [ ] Trocar as senhas dessas contas: ficaram legíveis com a chave pública até 04/10.
- [ ] Conferência visual logado das telas de Leads, Vendas e Empresa.
- [ ] Segurança geral (fim): repositório público com `.env` versionado, chave da Evolution no `OPERACAO.md`, chaves expostas.

## File List
- supabase/migrations/20261004_rls_exposed_tables.sql
- supabase/migrations/20261004_account_secrets_vault.sql
- src/pages/Empresa.tsx
- src/test/empresa-accounts.test.tsx
- docs/stories/SEC1.1-rls-tabelas-expostas.md
