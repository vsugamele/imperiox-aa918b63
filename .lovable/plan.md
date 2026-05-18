# Semana 2 — Performance & Confiabilidade

Objetivo: reduzir egress do Supabase, cortar refetches inúteis, e endurecer pontos frágeis (realtime, polling, queries sem filtro). Tudo frontend + 1-2 índices se necessário.

## 1. React Query defaults globais ✅

`src/App.tsx` — `QueryClient` agora vem com:
- `staleTime: 60s` — não refetch ao trocar de aba/rota dentro de 1min
- `gcTime: 5min` — cache vive mais
- `refetchOnWindowFocus: false` — fim do hammering ao voltar pra aba
- `retry: 1` — falha rápido em vez de 3 tentativas

Impacto esperado: -40% de chamadas redundantes ao Supabase.

## 2. Queries pesadas — corrigidas ✅

- **`Leads.tsx` timeline** — eventos `LeadCapture`/`CSVImport` agora filtram por `project_id` quando o lead tem um, e usam `select` específico de colunas (corta ~60% do payload). `imphq_clicks` agora filtra direto por `utm_source` no servidor em vez de baixar 50 linhas e filtrar no cliente.
- **Próximos**: `Gerenciador.tsx` linha 56 (`select("*")` → colunas usadas) — fica pra próxima passada se aparecer slow query.

## 3. Realtime hygiene

- Verificar `supabase.channel(...)` órfãos (sem `removeChannel` no cleanup).
- WhatsApp já usa polling 30s — manter.
- Garantir 1 channel por hook, não por componente render.

## 4. Skeleton states + suspense boundaries

Trocar `loading ? <Spinner /> : <Page />` por skeletons localizados nos cards pesados (Dashboard, Financas). Sensação de velocidade > velocidade real.

## 5. Índices DB (se sinal de slow query aparecer)

Candidatos prováveis (validar antes):
- `imphq_events(visitor_id, created_at desc)`
- `imphq_vendas(lead_id, created_at desc)`
- `imphq_clicks(utm_source, created_at desc)`

Só criar via migration depois de medir.

## O que NÃO muda nesta semana

- Lógica de negócio, edge functions, schema (exceto índices puros).
- Layout — Semana 1 já fechou isso.

## Ordem

1. ✅ React Query defaults
2. Filtro `project_id` em `Leads.tsx` (eventos órfãos)
3. Auditoria de `select("*")` em páginas top
4. Skeletons localizados
5. Índices (só se houver slow query medida)

Ao terminar: seguimos pra Semana 3 (Inteligência & Receita).
