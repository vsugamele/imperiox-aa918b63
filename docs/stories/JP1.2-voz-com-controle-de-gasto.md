# Story JP1.2 — Voz da IA com controle de gasto e entrega

Origem: auditoria ElevenLabs de 30/09 (`docs/sessions/2026-09/2026-09-30-jp-auditoria-elevenlabs.md`). Decisão do Vinicius em 01/10: **opção b — corrigir e manter a voz** (exige recarregar os créditos da ElevenLabs).

## Feito (01/10/2026)
- [x] Regras puras em `_shared/voice-policy.ts`, com testes (`src/test/voice-policy.test.ts`):
  - voz nunca em rascunho, grupo/broadcast ou provedor sem áudio;
  - saldo esgotado ("quota_exceeded") pausa TTS e STT por 1 h;
  - 3 falhas seguidas de geração/envio pausam a voz por 6 h (um envio bem-sucedido zera a conta);
  - no máximo 2 áudios por conversa em 24 h (etapa de fluxo que força áudio não conta);
  - gatilhos enxutos: saíram "hoje", "amanhã", "ajuda", "urgente", "prazo", "acesso" e "entrar".
- [x] Tabela `imphq_wa_voice_log` (migração `20261001_imphq_wa_voice_log.sql`): cada áudio gerado, reaproveitado, enviado, recusado, bloqueado, e cada transcrição.
- [x] `wa-ai-reply`:
  - decisão de voz passa pelas travas (bloqueio registrado como `skipped` com o motivo);
  - reaproveita o áudio já gerado para o mesmo texto e voz (7 dias) em vez de sintetizar de novo;
  - áudio recusado pelo WhatsApp → a mesma resposta vai em texto (antes o lead ficava sem nada);
  - áudio enviado fica no histórico como `audio`, com o arquivo e o motivo da voz;
  - transcrição casa com o arquivo do áudio atual (antes pegava o último áudio da conversa) e respeita a pausa de saldo.
- [x] Versão no ar (v309) conferida idêntica ao repositório antes de publicar.

## Pendente
- [ ] Vinicius: recarregar créditos da ElevenLabs (saldo zero em 30/09).
- [ ] Validar o primeiro áudio real depois da recarga: 1 geração, envio aceito, mensagem de áudio visível no histórico, registro `sent` em `imphq_wa_voice_log`.
- [ ] `wa-audio-transcribe` (disparado pelo webhook) ainda não consulta a pausa de saldo nem registra no log.

## File List
- supabase/functions/_shared/voice-policy.ts
- supabase/functions/wa-ai-reply/index.ts
- supabase/migrations/20261001_imphq_wa_voice_log.sql
- src/test/voice-policy.test.ts
- docs/stories/JP1.2-voz-com-controle-de-gasto.md
