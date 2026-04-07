
Plano: corrigir o fluxo do QR do Hub Local com base no que o código e o banco mostram hoje.

O que encontrei
- O front já está tentando ler QR em vários formatos: `payload.qrImageUrl`, `payload.qr`, `payload.image` e também fallback em `command.result.qr.qrImageUrl`.
- Nos registros recentes de `wa_hub_iso_commands` e `wa_hub_iso_events`, o worker está respondendo `success: true`, mas com:
  - `qrAvailable: false`
  - `qrImageUrl: null`
  - `qrText: null`
  - `hasSession: false`
- Existe histórico antigo funcionando com esses mesmos campos (`qrImageUrl` e `qrText`), então hoje o problema principal não parece ser mismatch de nome de campo no front.
- O bug atual de UX é que o app trata `session.status = awaiting_qr` como se o QR estivesse disponível, então mostra “QR Disponível” mesmo sem imagem.
- O timeout não parece ser a causa principal agora, porque o comando termina rápido e já volta sem QR.

O que vou implementar
1. Ajustar a máquina de estados do QR
- Em `src/hooks/useWaSession.ts`, separar claramente:
  - worker processando
  - sessão aguardando QR
  - QR realmente pronto
  - erro / sessão travada
- Não marcar mais “QR Disponível” só porque a sessão ficou `awaiting_qr`.
- Só considerar QR pronto quando houver `qrImageUrl` ou `qrText` de fato.

2. Corrigir a UI para não enganar
- Em `src/components/whatsapp/WaHubQrPanel.tsx`, trocar o badge/estado visual:
  - “Aguardando worker”
  - “Sessão aguardando geração do QR”
  - “QR pronto para escanear”
  - “Sessão possivelmente travada”
- Se o worker responder sem QR, mostrar isso explicitamente em vez de ficar preso em “QR Disponível”.

3. Exibir diagnóstico bruto do worker
- Aproveitar os dados que já estão vindo no payload/result:
  - `instructions`
  - `hasSession`
  - `needsQr`
  - `qrAvailable`
  - `qrAt`
  - `commandId`
- Mostrar isso no painel para você entender rapidamente se:
  - o worker não subiu direito
  - a session key está suja
  - o QR não foi persistido
  - o retorno veio sem imagem

4. Destravar a tentativa de novo QR
- Hoje, se cair em `awaiting_qr`, o botão pode ficar bloqueado.
- Vou ajustar para permitir novo “Gerar QR” quando o comando já terminou mas não trouxe QR real.
- Também vou adicionar uma ação de “nova session key”/“trocar session key” para contornar sessão presa sem depender de limpeza manual.

5. Tratar sessão suja como caso explícito
- Se vier repetidamente `awaiting_qr` + `qrAvailable: false` + `qrImageUrl: null`, o painel vai assumir “sessão travada ou worker sem persistência”.
- Em vez de spinner infinito, mostrar instrução clara:
  - tentar nova session key
  - reiniciar worker local
  - repetir a geração

Dependência externa importante
- O worker do Hub Local não está neste repositório, então eu consigo corrigir bem a experiência, diagnóstico e retry no app.
- Mas se o worker continuar retornando `qrAvailable: false` e `qrImageUrl: null`, o app não tem como inventar a imagem.
- Se você também controla o worker externo, o ideal é padronizar o contrato para sempre devolver:
  - `qrAvailable`
  - `qrImageUrl`
  - `qrText`
  - `error` ou `reason`
  - `expiresAt`
  - algum indicador de “dirty/stale session”

Arquivos
- `src/hooks/useWaSession.ts`
- `src/components/whatsapp/WaHubQrPanel.tsx`
- `src/pages/WhatsAppPage.tsx` (apoio para sessão nova/diagnóstico visível)

Detalhes técnicos
- Causa 1 (“campo diferente”) hoje é improvável, porque o front já cobre os campos conhecidos e há evento antigo com `qrImageUrl` no mesmo formato.
- Causa 2 e 3 são as mais prováveis no estado atual:
  - sessão presa
  - worker não persistindo/retornando o QR mesmo concluindo o comando
- Causa 4 (timeout) fica como melhoria secundária, não como raiz principal.
- Há também warnings de `ref` em `HubConversations`, mas isso é separado do bug do QR.

Ordem
1. Corrigir estado e regras de “QR pronto” no hook
2. Ajustar badge/mensagens e reabilitar retry no painel
3. Exibir diagnóstico bruto do comando/evento
4. Adicionar fluxo de nova session key para sessões travadas
