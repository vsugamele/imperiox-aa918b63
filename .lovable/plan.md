
## Bloco 4 — Hardening de Segurança

### 4.1 — Migration: `search_path` em funções
Adicionar `SET search_path = public` em todas as funções `imphq_*` afetadas (ex: `fn_recalc_lead_score`, `fn_recalc_lead_totals`, `handle_new_user`, `is_imphq_admin`, e demais flagadas pelo linter).

### 4.2 — Migration: storage policies
Restringir LIST nos buckets `whatsapp-media`, `criativos`, `project-media` para autenticados apenas. GET por path direto continua funcionando para mídia pública embutida.

### 4.3 — Manuais (passo seu, vou te passar links)
- Auth → reduzir OTP expiry para ≤ 600s
- Auth → ativar Leaked Password Protection
- Database → agendar upgrade do Postgres

Vou rodar o linter pra confirmar a lista exata antes de escrever as migrations, depois executo 4.1 e 4.2 em sequência e te entrego os 3 links do 4.3 no final.

Confirma com **"vai"** que saio do plan mode.
