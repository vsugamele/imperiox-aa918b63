

# Plano: Sync automático do Facebook Ads via pg_cron

## Problema

Hoje o sync é 100% manual — o usuário precisa clicar "Sincronizar Facebook" toda vez. Para dados quase em tempo real, precisamos de um job agendado.

## Solução

Usar **pg_cron + pg_net** para chamar a edge function `facebook-ads-sync` automaticamente a cada 30 minutos, para todos os projetos que têm token e ad account configurados.

### 1. Nova Edge Function: `facebook-ads-sync-all`

Uma função leve que:
- Busca todos os projetos com `data->facebook_ad_account_id` e `data->facebook_marketing_token` preenchidos
- Para cada um, chama internamente a lógica de sync (últimas 24h)
- Retorna resumo de quantos projetos foram sincronizados

### 2. Cron job via pg_cron

Agendar execução a cada 30 min (ou intervalo que preferir):
```sql
select cron.schedule(
  'facebook-ads-auto-sync',
  '*/30 * * * *',
  $$ select net.http_post(...facebook-ads-sync-all...) $$
);
```

### 3. UI: indicador de "auto-sync ativo"

No botão de sync, mostrar um badge "Auto ⚡" e o horário da última sincronização automática (campo `facebook_last_sync` que já existe no `data` do projeto). O botão manual continua disponível para forçar sync imediato.

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/facebook-ads-sync-all/index.ts` | Nova function que itera projetos configurados e chama sync |
| SQL (pg_cron) | Ativar extensões + agendar job |
| `src/components/projeto/ProjetoFinancas.tsx` | Badge "Auto-sync" + mostrar última sync |

## Ordem

1. Criar edge function `facebook-ads-sync-all`
2. Deploy + configurar cron job via SQL
3. Atualizar UI com indicador de auto-sync

