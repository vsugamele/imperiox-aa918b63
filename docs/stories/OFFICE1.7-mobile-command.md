# OFFICE1.7 — Escritório no Império e comando pelo celular

Opção 2 aprovada pelo usuário. Liderança: @dev; banco e controle de acesso no escopo @data-engineer; publicação no escopo @devops. Sem delegação necessária.

## Critérios
- [x] Página responsiva /escritorio com empresas, áreas e agentes reais.
- [x] Instruções e decisões autenticadas, vinculadas ao proprietário do computador, sessão e empresa.
- [x] Computador offline bloqueia comandos; expiração, deduplicação e nenhuma repetição automática de uma ação incerta.
- [x] Conector local somente de saída; Habblaud permanece em loopback.
- [x] Inicialização automática e recuperação do serviço local.
- [x] Piloto real de mensagem, controles de acesso, typecheck, lint específico, testes e build.
- [x] Canal de pendências validado com hook técnico; reteste de pergunta criada pelo modelo bloqueado pela cota Claude.
- [x] Publicação verificável, commit e handoff.

## File List
- supabase/migrations/20261010193000_office_command.sql
- supabase/migrations/20261010194500_office_online_status.sql
- scripts/office/*
- src/lib/office-command.ts
- src/pages/Escritorio.tsx
- src/App.tsx
- src/components/AppSidebar.tsx
- docs/sessions/2026-10/2026-10-10-office-mobile.md

## Arquitetura
Fila privada no Supabase. Somente o proprietário aprovado acessa o dispositivo. Conector consulta RPC com credencial de dispositivo limitada, protegida pelo Windows; nenhum service_role no computador. Transmissão de resumos e detalhes de pedidos já mascarados pelo Habblaud, sem transcrições completas. Nenhuma porta remota ou iframe.

## Validação e limites
- Mensagem real ao Codex por https://imperiox.vercel.app/escritorio em viewport móvel: resposta OFFICE_MOBILE_INSTRUCAO_RECEBIDA. Comando 2dea6fee-4c9c-40b1-b800-36dd4efb3b9b entregue.
- Resposta Confirmar integração voltou ao hook técnico com updatedInput.answers correto. Comando daeb1477-4964-4f41-9d20-7afbb5a56621 entregue. Pedido técnico identificado como tal, sem execução de tarefa de produção.
- Plugin de mensagens Claude instalado na conta existente agora em 2.1.296. Mensagem recebida pela sessão real (f361f65b-411f-4b38-9d2c-53a213287ac3); resposta do modelo bloqueada por limite de uso.
- Testes de segurança reais com rollback aprovados, incluindo outro administrador, dispositivo offline e idempotência.
- 7 testes do conector passando; typecheck e lint dos arquivos alterados aprovados; build local e Vercel aprovados.
- Suíte geral: 943 testes passando, 5 falhas preexistentes em ugc-ad-factory por ausência de Router; 12 erros assíncronos em tracker-evidence/MetaCapiCard por mock sem eq. Lint global: 13 any preexistentes em SwipeDetail, useProductHealth, Cofre, material-ingest e vault-sync. Arquivos fora do escopo preservados.
- Recuperação do conector e do processo Habblaud comprovada por interrupções controladas. Autostart ao login Windows, sem reboot de teste.
- Hooks Codex ainda aguardam revisão humana em /hooks para permissões. Não usamos bypass ou trusted_hash.
- Produção final: dpl_4utnaAkJFSQ1wofRQcHiRHqx4EvX, READY, alias https://imperiox.vercel.app.
