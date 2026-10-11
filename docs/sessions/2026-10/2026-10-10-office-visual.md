# Escritório visual — OFFICE1.8

## Entrega
Opção 3 autorizada após proposta: duas alas no computador, empresa e sala no celular. Arte procedural original Habblaud 0.8.0 copiada do snapshot 3ca81537b04dce97b7e2d0954853b783bbd1958d (MIT, notice público e atribuição). Sem iframe, sem expor o servidor local. Pisos, mesas, plantas e personagens são os mesmos sprites do Habblaud; layout responsivo próprio do Império.

OfficeMap usa apenas o snapshot autorizado existente. Personagem responde ao status (digitando, parado, pedindo atenção); animação é pausada offline ou com prefers-reduced-motion. LayoutGroup anima a mudança de sala informada no snapshot. Sem passeios/atividades simuladas. Salas permanentes e projetos ocupados, filtrados por empresa. O celular monta somente a sala selecionada, com área ativa como padrão; desktop monta as duas alas.

Personagem abre Sheet com o AgentCommand existente. Identidade de seleção inclui dispositivo, agente e sessão. Se a sessão é substituída, compositor sai e pede nova seleção. Offline e cache antigo mantêm os bloqueios existentes. Backend/RPC/conector/autostart não alterados.

## Validação
4 testes de UI passando; 7 testes do conector passando. Lint específico com arte vendorizada passando. Typecheck completo (app e node) passou. Lint global mantém os 13 erros anteriores; nenhum erro novo no escopo. Browser: snapshot real (leitura de imphq_office_devices), celular 390x844, empresa → sala → agente corretos e scrollWidth 390 = viewport 390. Fotos em C:/Users/vsuga/habblaud/imperio-office-visual-{mobile,desktop}.png. Prévia explicitamente marcada somente leitura, preservada em ~/.habblaud/imperio/previews/office1.8, fora do workspace antes de publicar.

## Limites e próximos passos
- Teste visual inicial é local com snapshot real capturado; não comprova envio remoto novo. Os comandos usam o mesmo caminho já validado em OFFICE1.7.
- Lint/testes gerais têm falhas anteriores registradas em OFFICE1.7, bloqueando push; não foi enviado nada ao GitHub. A integração remota com main continua pendente e publicações futuras de main podem substituir esta versão.
- Deploy dpl_AcE5QxiVLKajR9mKArHnh6L28K47 READY, alias https://imperiox.vercel.app. Bundle público index-B1Gy0ITB.js carrega Escritorio-IT_dtcDx.js, com office-room-scene e painel de sessão. Licença pública HTTP 200 e prévia não publicada. Browser público reconhece /escritorio e redireciona para login; não havia sessão autenticada neste navegador, portanto teste visual com dados reais ficou local. 57 testes originais de arte passaram. Build remoto concluído; build local completo, incluindo PWA, passou.
- Commit da implementação: 8e2b5fc4. Servidor de prévia local encerrado após verificação. Relay mantém heartbeat (0 segundos no check), 7 agentes reais no snapshot. Arquivos previamente modificados e skill metodo-hw preservados.
- Reversão visual: restaurar src/pages/Escritorio.tsx da versão anterior; manter conector e banco intactos. Não apagar dados de agentes.
