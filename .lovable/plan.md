## Problema

Hoje cada semana da rotação mostra só `S1 + JID truncado + data`. Você não consegue ver:
- **Nome do grupo** (subject)
- **Link de convite completo** (só vê truncado)
- **Quantos cliques já caíram naquela semana**
- **Data/hora exata de início e fim** (quando vai rodar pra próxima)
- **Quantas vagas restam no grupo daquela semana**

## O que vai mudar

**`src/components/whatsapp/GroupDistributor.tsx`** — cada linha da lista de semanas vira **expansível** (chevron à esquerda). Fechada continua igual; aberta mostra um painel com os detalhes.

### Painel expandido por semana

```
┌─ S2  [Grupo: "VIP Webinar Turma 5"]              ✓ ativa ─┐
│  JID:        120363426598002237@g.us          [copiar]    │
│  Convite:    https://chat.whatsapp.com/Abc123 [copiar][↗] │
│  Início:     27/05/2026 09:00                             │
│  Próx. troca: 03/06/2026 09:00 (em 6d 3h)                 │
│  Cliques:    142 / 1000   ████░░░░░░  (858 vagas)         │
│  Status:     ativa desde 20/05/2026                       │
└───────────────────────────────────────────────────────────┘
```

### Como cada dado é obtido

1. **Subject do grupo** — reaproveita o cache `availableGroups` (já buscado via `fetch_groups`). Se não estiver no cache, mostra "—" e oferece "↻ buscar nome".
2. **Cliques da semana** — `select count(*) head:true` em `imphq_wa_distributor_clicks` filtrando por `distributor_id` + `group_jid` da semana. Carrega junto com `loadWeeks`.
3. **Vagas** — `max_per_group - cliques`.
4. **Próxima troca** — calculada a partir de `last_rotation_at` + `rotation_cron` (já existe lógica equivalente em `wa-distributor-rotate/index.ts`; replico no client de forma simples: próximo match do cron a partir de agora).
5. **Botões copiar** + **abrir convite no WhatsApp** (`window.open`).

### Pequenos extras

- Mini-barra de progresso (cliques / max) usando `bg-gold` quando >80%.
- Badge "🗄 arquivada" mantém comportamento; expandida mostra `archived_at`.
- Linha fica clicável inteira pra expandir (chevron + click no row).

## Arquivos tocados

- `src/components/whatsapp/GroupDistributor.tsx` (UI + 1 query agregada de cliques por semana)

Sem mudanças de schema ou backend.

## Resultado

Você abre o modal, clica numa semana, e vê tudo: nome do grupo, link inteiro, quantos já entraram, quanto falta pra encher, e quando vai virar a próxima. Sem precisar abrir o WhatsApp pra conferir.