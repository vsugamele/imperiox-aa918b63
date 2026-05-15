## Distribuidor com Rotação Semanal (Webinar)

Sim, dá pra fazer **ambas**: grupo da semana corrente (default para anúncios "evergreen") **e** cohort fixo por lead (quem entrou na semana 1 sempre cai no grupo 1, mesmo clicando depois). Será um toggle por distribuidor.

### Fluxo conceitual

```text
Lead clica no link → edge function calcula "semana atual"
   ├── modo CORRENTE   → redirect ao grupo ativo da semana
   └── modo COHORT     → checa cookie/IP-hash:
                         ├── já visto antes → grupo da 1ª semana dele
                         └── novo           → grupo da semana atual + grava cohort
```

### Modelo de dados

Nova tabela `imphq_wa_distributor_weeks` (uma linha por grupo semanal):
- `distributor_id`, `week_index` (1,2,3...), `group_jid`, `invite_url`
- `start_at` timestamptz (quando vira ativo), `archived_at` (auto preenchido pelo cron)

Coluna nova em `imphq_wa_group_distributors`:
- `rotation_mode` text: `'none' | 'weekly_current' | 'weekly_cohort'`
- `rotation_cron` text: ex `'0 9 * * 1'` (toda segunda 09h)
- `current_week` integer (ponteiro mantido pelo cron)

Tabela `imphq_wa_distributor_cohorts` (só usada no modo cohort):
- `distributor_id`, `ip_hash`, `week_index`, `created_at`
- chave única `(distributor_id, ip_hash)` → idempotência

### Cron semanal automático

`pg_cron` a cada 5 min roda função `wa-distributor-rotate`:
- Para cada distribuidor com `rotation_mode != 'none'`, verifica se `now() >= próxima execução do cron`.
- Se sim: arquiva semana atual (`archived_at = now()`) e incrementa `current_week` para o próximo registro com `start_at <= now()`.
- Dispara webhook opcional pra notificar (futuro).

### Edge function `wa-group-distributor` — mudanças

```text
1. Buscar distribuidor + suas weeks ordenadas
2. Se rotation_mode = 'weekly_current':
     activeWeek = weeks.find(w => w.week_index == dist.current_week && !w.archived_at)
     redirect 302 → activeWeek.invite_url
3. Se rotation_mode = 'weekly_cohort':
     cohort = busca em distributor_cohorts por ip_hash
     se existe → redirect ao group_jid daquele week_index
     se não existe → grava cohort com current_week + redirect normal
4. Se rotation_mode = 'none' → mantém comportamento atual (peso/sequencial)
```

Grupos arquivados ficam visíveis nas stats mas **fora da rotação** (consulta sempre filtra `archived_at IS NULL` para escolha).

### UI no modal Estatísticas

- Novo seletor "Modo de rotação": Nenhum / Semana corrente / Cohort por lead.
- Quando semanal: campo de cron preset (toda segunda 09h, toda quinta 20h, custom) + lista de "Semanas":
  - `Semana 1 — JID — invite URL — start_at — [✓ ativa | 🗄 arquivada]`
  - Botões: "Adicionar semana", "Avançar agora" (manual override do cron).
- Indicador visual no card: `🔄 Rotação semanal · Semana 3/8 · próxima em 2d 14h`.

### Entregáveis

1. Migration: tabela `imphq_wa_distributor_weeks`, tabela `imphq_wa_distributor_cohorts`, colunas em `imphq_wa_group_distributors`.
2. Edge function `wa-distributor-rotate` (chamada por pg_cron a cada 5 min).
3. Edge function `wa-group-distributor`: lógica de rotação + cohort.
4. UI em `GroupDistributor.tsx`: seletor de modo, gestor de semanas, badge no card.
5. pg_cron job (via insert tool, não migration).

### Não incluído (para discutir depois)

- Campanhas de WhatsApp também avançando junto com a rotação (conectar `campaign_id` ao `current_week`).
- Exportar CSV de cohorts (quem caiu em qual semana).
- Notificação automática quando uma semana lota antes da próxima virar.
