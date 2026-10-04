# Story OPS2.2 — Perfis × canais

Pedido (04/10/2026): trazer a tabela de contas do Centro de Comando (perfil × e-mail × máquina/proxy × Instagram, Facebook, TikTok, YouTube × páginas de Facebook) como visão no Império.

## Feito (04/10/2026)
- [x] Tabela `imphq_profiles` (persona com e-mail, aparelho, proxy, status, canais e páginas de Facebook), RLS só logado. Migração `20261004_imphq_profiles.sql`, aplicada.
- [x] Script `scripts/import-centro-profiles.mjs` (`--dry-run`): mesma regra de leitura da tabela do Centro (registro manual salvo vence o cadastro). 8 perfis carregados; produtos ligados aos projetos (MemoFlow → memoflow, Slim Soda → slimsoda).
- [x] Aba **Perfis × canais** em Empresa (`ProfilesMatrix`), junta o status de aquecimento do e-mail cadastrado em Empresa e o nome do aparelho.

## Pendente
- [ ] Editar o perfil pela matriz (hoje só leitura).
- [ ] Unificar com `imphq_empresa` e `imphq_social_accounts` (esteira GeeLark) — hoje são três cadastros de contas.
- [ ] Conferência visual logado.

## File List
- supabase/migrations/20261004_imphq_profiles.sql
- scripts/import-centro-profiles.mjs
- src/components/empresa/ProfilesMatrix.tsx
- src/pages/Empresa.tsx
