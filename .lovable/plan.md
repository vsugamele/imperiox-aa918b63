# Plano: Conversas históricas + IA Autônoma operacional (JP Freitas)

Objetivo: resolver os 2 buracos detectados — (1) chips conectados não mostram conversas antigas, (2) Triagem/IA/Objeções existem na UI mas não estão ativas em produção.

## 1. Sync de histórico (Evolution → Supabase)

Nova action `sync_messages` no edge `whatsapp-api`:
- Chama `chat/findMessages/{instance}` (Evolution) paginado, últimos 30 dias.
- Para cada mensagem: upsert em `imphq_wa_conversations` (por `remote_jid` + `provider_id`) e `imphq_wa_messages` (dedup por `external_id`).
- Baixa mídias volátiles pro bucket `whatsapp-media` (padrão já existente).
- Vincula `lead_id` quando telefone bate com `imphq_leads.telefone`.

Botão "Importar histórico" no header do provider (ao lado de "Sincronizar contatos"), com progress toast. Roda 1 chip por vez (os 2 do JP separados, mantendo `provider_id` correto → tabs já funcionam).

## 2. Triagem real (mata o mock)

Tabela `imphq_wa_triagem_rules` já não existe — mas `imphq_wa_triage` (resultados) existe e o edge `wa-ai-triage` já classifica. O que falta:
- **Disparar** `wa-ai-triage` automaticamente dentro do webhook `whatsapp-api` quando `MESSAGES_UPSERT` chega com `from_me=false`.
- Hoje a triagem só roda se alguém invocar manual. Vou plugar no fluxo do webhook (fire-and-forget, não bloqueia resposta).
- Painel `TriagemPanel` já lê de `imphq_wa_triage` → vai popular sozinho.

## 3. IA Autônoma ativa no JP

- Criar registro em `imphq_wa_ai_config` pro projeto JP com `enabled=true`, personality `vendedor`, contexto: briefing+avatar+produtos+objeções.
- Edge `wa-ai-autoresponder` (verificar se já existe; se não, criar) é chamado após triagem quando: `intent != compra_quente` (esses escalam pra humano) e `escalation_keywords` não batem e dentro do horário comercial.
- Respeita `response_delay_seconds` e marca `from_me=true, sent_by='ai'` em `imphq_wa_messages`.

## 4. Objeções — seed inicial

Inserir 8-10 objeções clássicas do nicho do JP (preço, tempo, "vou pensar", funciona pra mim?, etc) em `imphq_wa_objections` com `projeto_id` do JP, baseadas no que tiver em `funnel-hacking-jpfreitas/` e briefing. Triagem já cruza essas automaticamente.

## Detalhes técnicos

```
Arquivos:
- supabase/functions/whatsapp-api/index.ts       (action sync_messages + hook triagem)
- supabase/functions/wa-ai-autoresponder/index.ts (criar se não existir)
- src/components/whatsapp/ProviderConfigDialog.tsx (botão Importar histórico)
- migration: índice em imphq_wa_messages(external_id, provider_id) UNIQUE pra dedup

Sem mudança de UI estrutural — só botão novo + painéis existentes começam a popular.
```

## Ordem de execução

1. Migration (índice dedup + seed objeções JP + ai_config JP)
2. Edge `whatsapp-api`: action `sync_messages` + hook auto-triagem no webhook
3. Edge `wa-ai-autoresponder` (verificar/criar)
4. Botão "Importar histórico" no ProviderConfigDialog
5. Você roda o import nos 2 chips → conversas aparecem nas tabs Suporte 1 / Suporte 2

Posso prosseguir?