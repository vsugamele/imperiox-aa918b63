## Problema
O `wa-health-monitor` roda periodicamente e quando uma instância cai, dispara e-mail de alerta. O throttle atual é só 30min, então em quedas longas chegam vários e-mails. Não há controle manual para silenciar.

## Solução

### 1. Toggle "Alertas de queda" por provider
- Adicionar coluna `health_alerts_enabled` (boolean, default true) em `imphq_wa_providers`
- No `ProviderConfigDialog.tsx`: switch "Receber alerta por e-mail quando cair"
- `wa-health-monitor` ignora providers com `health_alerts_enabled = false` ao montar a lista de failures (continua monitorando estado, só não notifica)

### 2. Pausa global temporária
- Adicionar `health_alerts_muted_until` (timestamptz, null) em `imphq_wa_providers`
- Botão na UI do WhatsApp: "Silenciar alertas por 1h / 6h / 24h"
- Health monitor checa o timestamp antes de enfileirar failure

### 3. Reduzir frequência de e-mail
- Trocar throttle de 30min → **6h por instância** (hoje é global p/ todos)
- Tornar throttle **por instância** (não global), usando `data->>instance_name` no `imphq_events`
- Só re-enviar e-mail se o estado piorou OU se passou 6h
- Sempre logar em `imphq_events` (sem e-mail) para histórico

### 4. UI no /whatsapp
- Badge de status por instância já existe; adicionar:
  - Switch "Alertas ativos" (persistente)
  - Menu "Silenciar por…" (1h/6h/24h/até reconectar)
  - Indicador visual quando mutado

## Arquivos afetados
- Migration: `imphq_wa_providers` + 2 colunas
- `supabase/functions/wa-health-monitor/index.ts` (filtros + throttle por instância de 6h)
- `src/components/whatsapp/ProviderConfigDialog.tsx` (switch)
- `src/pages/WhatsAppPage.tsx` ou `SessionDetailView.tsx` (botão silenciar)

## Pergunta rápida
Quer que o **auto-reconnect** continue rodando mesmo com alertas silenciados? (recomendo: sim — só silencia o e-mail, não o monitoramento)
