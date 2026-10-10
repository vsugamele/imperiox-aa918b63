# Handoff OFFICE1.7 — Escritório no celular

Pedido aprovado: integrar Habblaud ao Império com acompanhamento, mensagens, pendências e início automático no computador existente.

## Estado entregue
- https://imperiox.vercel.app/escritorio, menu Escritório. Página nativa responsiva, empresas separadas, áreas reais e agentes com atividade/tarefa, envio, perguntas, aprovar esta vez/recusar e status da entrega.
- Conector de saída em scripts/office. Habblaud continua em loopback; não expusemos proxy, túnel, terminal ou portas na internet.
- Duas tabelas isoladas imphq_office_devices e imphq_office_commands, RLS ativado, sem grants diretos aos clientes. RPCs conferem usuário aprovado e proprietário. Dispositivo do Vinicius b6248c10-c4a8-4755-8022-df3384adac7c.
- Capacidade limitada do dispositivo cifrada com DPAPI e ACL no perfil Windows. Nenhuma service_role local. Nunca registrar o conteúdo de connection.dpapi ou o token em logs/chat/Git.
- Autostart instalado em pasta Startup como Imperio-Escritorio.lnk. Start-Office.ps1 tem mutex e supervisor; inicia ao entrar no Windows, não antes do login. Atalho real executado com sucesso, supervisor Windows PowerShell e heartbeat confirmado. VBS do piloto preservado desativado no perfil local.

## Testes reais e limites
- Fluxo remoto: navegador autenticado do proprietário, página pública, viewport móvel, mensagem à sessão Codex Thiago. Terminal real confirmou OFFICE_MOBILE_INSTRUCAO_RECEBIDA; banco e conector confirmaram delivered. Largura efetiva 433 e scrollWidth 427, sem transbordamento horizontal.
- Pendência: modelo Claude bloqueou antes de produzir pergunta por limite da conta. Validamos então o canal com hook técnico explicitamente identificado na própria sessão piloto Lara 61dbee76-2120-4c85-aad1-be2b916fba7b. Escolha feita na página pública voltou como Confirmar integração nos argumentos originais do hook. Não é evidência de uma nova pergunta gerada pelo modelo.
- Claude agora em 2.1.296, plugin habblaud-mensagens instalado via CLI oficial, preservado hook PermissionRequest existente. Mensagem real recebida pela sessão com identificação do plugin; resposta do modelo bloqueada pela cota.
- Codex mensagens independem de trust. Permissões Codex continuam exigindo revisão humana em /hooks. Nenhum bypass, alteração de trusted_hash ou aprovação ampla.
- Recuperação comprovada: conector PID 24496 interrompido e substituído automaticamente; Habblaud PID 39656 interrompido e reiniciado pelo conector. Health voltou ok, heartbeat atualizou. Nenhum reboot ou queda real de energia provocados.
- Banco: testes com rollback recusaram anon, outro usuário, outro admin, empresa diferente, sessão errada, computador offline e chave inválida. Reenvio do mesmo UUID preserva uma única linha.

## Qualidade
- Typecheck aprovado; lint específico aprovado; 7 testes Node do conector aprovados; builds local e Vercel aprovados.
- Corrigidas compatibilidade BOM/UTF-8 do stdin e importação explícita do módulo Security do Windows PowerShell 5.1 (PSModulePath herdado do PowerShell 7 apontava para módulo incompatível). Autostart usa PowerShell nativo estável, sem depender do runtime do Codex. ExecutionPolicy Bypass somente no processo que roda o script próprio, sem alterar política do Windows ou trust de hooks Codex. Erro de parsing agora é genérico. Credencial de dispositivo rotacionada e anterior revogada após diagnóstico; não guardar seu valor em documentação.
- Lint geral e suíte geral têm falhas anteriores fora do escopo: 13 explicit-any; 5 testes ugc-ad-factory sem Router; 12 erros assíncronos tracker-evidence/MetaCapiCard por mock sem eq. 943 testes passando. Não declaramos quality gates globais verdes.
- Preservadas alterações locais do usuário em .claude/settings.local.json, deno.lock e supabase/.temp/cli-latest; não incluídas no commit.
- Incorporado origin/main b08ffd16 (correção Inbox) por fast-forward antes da publicação para preservar atualização simultânea.
- Vercel projeto imperiox / team_RmXJPWcyJjnejiYMRcpmYx3h. Publicação final dpl_4utnaAkJFSQ1wofRQcHiRHqx4EvX READY e alias imperiox.vercel.app. Sem push.

## Operação e próximos passos
- Usar a conta proprietária no celular. Sem conexão, a página mostra última atualização e bloqueia comandos.
- Comandos expiram em 45s; heartbeat expira em 20s; limite 10/min. dispatching não é reenfileirado. Resultado unknown exige conferir a sessão antes de reenviar.
- Guia reprodutível: scripts/office/README.md. Desabilitar o dispositivo no banco revoga o conector; preservar/mover o atalho para fora de Startup desativa início automático.
- Evidência visual: C:/Users/vsuga/habblaud/imperio-mobile-entrega.png (fora do Git).
- Para completar a comprovação de perguntas geradas pelo modelo, retestar após a cota Claude voltar; para permissões Codex, usuário revisa hooks. Sem automação de reteste agendada.

## Recuperação do 404 no celular
- Publicação posterior dpl_AHP1AUvEzzVCAsMFpTWc8o6Z89Xw, commit main 26efe0fa, substituiu o deploy local com Escritório. Confirmado no histórico Vercel e no bundle público; não era apenas cache do celular.
- Integrado origin/main na branch local, preservando chat, referências e telemetria: merge f1afb3bd [Story OFFICE1.7]. Nenhum push realizado.
- Nova tentativa da suíte geral: 943 testes passando, 14 falhando, 13 erros (incluindo timeout de worker); lint global mantém 13 erros. Gates impedem push para consolidar em main. A publicação local não resolve essa pendência de integração remota.
- Deploy de recuperação: dpl_8zcb4w19cWdtckFfQFrDiW6grPKm READY, alias imperiox.vercel.app. Build remoto passou. Bundle público index-8fHet28k.js contém path escritorio e chunk Escritorio-C89ip9oW.js retorna HTTP 200.
- Navegador in-app reproduziu 404 antes e, após recarregar a nova publicação, redirecionou corretamente ao login. Sem sessão autenticada disponível neste navegador; não repetimos ações de agentes. Captura C:/Users/vsuga/habblaud/imperio-escritorio-recuperado.png. Chrome ficou indisponível.
- Typecheck e lint específico concluídos sem erros; 7 testes do conector passaram. Falhas gerais acima permanecem bloqueando push. Integração remota ainda pendente: novas publicações de main podem remover novamente a rota.
