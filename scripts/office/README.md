# Conector do Escritório — OFFICE1.7

O Habblaud continua em 127.0.0.1:4747. O conector publica resumos e consulta uma fila privada no Supabase a cada poucos segundos, sempre por conexão de saída. Não é proxy público do Habblaud.

## Operação
- Página: https://imperiox.vercel.app/escritorio, conta do proprietário aprovado.
- Iniciar: `pwsh -NoProfile -File scripts/office/Start-Office.ps1`.
- Autostart: `pwsh -NoProfile -File scripts/office/Enable-Autostart.ps1`.
- Testes de projeção e comandos: `node --test scripts/office/relay-core.test.mjs`.
- Testes do banco: executar `security-check.sql` com acesso de manutenção. A transação faz rollback, sem despachar instruções.
- Credencial: `%USERPROFILE%/.habblaud/imperio/connection.dpapi`, cifrada para o usuário Windows atual, ACL restrita. Nunca copiar para o repositório.
- Logs sem conteúdo de mensagens: `%USERPROFILE%/.habblaud/imperio/relay.log`.

## Instalação em outra máquina
1. Preparar Habblaud e aplicar as migrações OFFICE1.7.
2. Executar `Install-Office.ps1 -DeviceId <novo UUID>`. A saída contém somente ID e hash público da credencial.
3. Registrar o dispositivo no banco com o owner_id verificado do usuário aprovado e o hash. O conector não recebe service_role.
4. Iniciar e validar heartbeat; depois executar Enable-Autostart.ps1.

## Garantias e limites
- Somente o proprietário com role admin e status approved pode ler e enviar comandos. Outros administradores também não acessam o dispositivo.
- Verificação da sessão e empresa no servidor e novamente no computador antes da ação.
- Comandos expiram em 45 segundos. Heartbeat maior que 20 segundos bloqueia envio.
- Cada UUID só é aceito uma vez. Ao buscar, o comando passa a dispatching; não há reentrega automática. Se cair durante uma ação, resultado unknown exige conferência humana.
- Aprovação é por pedido, sem regra permanente. Detalhes e opções já mascarados pelo Habblaud são mostrados antes de responder.
- Fonte de demonstração não é publicada. Pastas, contas, transcrições completas e raciocínio não são transmitidos.
- Autostart roda ao entrar no Windows, no usuário que possui a credencial; não executa antes do login. Supervisor reinicia conector e Habblaud após falha. Queda de luz/internet não é evitada por software.
- Plugins Claude são carregados em novas sessões. Hooks Codex exigem revisão humana em /hooks; mensagens Codex independem deles.
- Revogação: desabilitar a linha do dispositivo no banco. Para desativar início automático, preservar/mover o arquivo Imperio-Escritorio.lnk fora da pasta Startup.
