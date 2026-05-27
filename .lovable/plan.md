# Melhorias propostas — GroupDistributor

Arquivo: `src/components/whatsapp/GroupDistributor.tsx` (955 linhas hoje, virá ~750).

## 1. Performance / Egress

- **N+1 em `load()`**: hoje, para cada distribuidor × cada grupo é feito 1 `count head:true` (pode dar 50+ requests no abrir da página). Trocar por **1 query agregada** via RPC `count_distributor_clicks_grouped(dist_ids[])` ou um único `select distributor_id, group_jid` paginado e agrupado no client.
- **N+1 em `loadWeeks()`**: mesmo padrão — uma chamada por semana. Unificar em 1 query filtrando `in('group_jid', jids)` e agrupar local.
- **Cache de `fetchGroups`**: hoje refaz fetch sempre que abre stats. Guardar em `useRef<Map<providerId, GroupRow[]>>` com TTL de 5min + botão "↻ atualizar".
- **Realtime opcional**: já existe `useProjectPulse`; deixar `load()` rodar só on-mount + após mutações, sem polling.

## 2. UX

- **Confirm nativo** (`confirm("Remover…")`) → substituir por `AlertDialog` do shadcn (consistente com resto do app).
- **Sem feedback de loading** ao adicionar/remover grupo, alternar ativo, excluir distribuidor — adicionar estado `busy` por linha + spinner inline.
- **Vazio nos grupos do chip**: quando `availableGroups.length === 0` e `!loadingGroups`, mostrar "Nenhum grupo. Conecte chip ou clique ↻".
- **Busca de grupos**: hoje filtra só por `subject`. Incluir match parcial em `id` (JID) também.
- **Cópia de JID**: cada item de grupo na lista deveria ter botão de copiar JID além de "+ Distrib." / "→ Semana".
- **Indicador visual de "semana atual"** no expandable: badge `Atual` em vez de só `current_week` no card.
- **Tooltip nas sparklines**: hoje mostra cliques/%, falta mostrar nome do grupo (resolver via `availableGroups` cache).

## 3. Arquitetura / DX

- **Split do componente** (955 linhas → 3 arquivos):
  - `GroupDistributor.tsx` (lista + criar)
  - `DistributorStatsDialog.tsx` (modal de stats/rotação/semanas)
  - `useDistributorData.ts` (hook com `load`, `loadWeeks`, `fetchGroups`, cache)
- **Tipos compartilhados** em `src/components/whatsapp/types/distributor.ts`.
- **Remover `as any` em queries**: tabela `imphq_wa_distributor_weeks` ainda usa cast; regenerar types do Supabase ou adicionar à `Database`.
- **`projectId` hardcoded via env**: extrair `buildDistributorUrl(slug)` para `src/lib/whatsappUrls.ts` (usado em 2 lugares).

## 4. Pequenos polimentos

- Botão "Avançar agora" sem confirmação — adicionar `AlertDialog`.
- Slug gerado: aceitar custom + validar duplicidade antes de salvar (hoje só descobre no erro do unique constraint).
- Mostrar `last_rotation_at` legível ("há 2 dias") no card, não só dentro do modal.
- `localStorage.setItem` em `useEffect` rodando em todo render do select — mover para o `onChange` direto.

## Detalhes técnicos

```ts
// Exemplo da query agregada substituindo N+1
const { data } = await supabase
  .from("imphq_wa_distributor_clicks")
  .select("distributor_id, group_jid")
  .in("distributor_id", dists.map(d => d.id));
// agrupar local: counts[dist_id][group_jid] = n
```

```ts
// Cache de grupos por provider
const groupsCacheRef = useRef<Map<string, { ts: number; rows: GroupRow[] }>>(new Map());
```

## Escopo fora desta proposta

- Mudanças no edge `wa-group-distributor` (rotação/contagem) — não tocado.
- Schema do banco — sem migrations, só uso melhor das tabelas existentes.

## Quer que eu execute tudo ou priorizar?

Posso fazer **(A) tudo**, ou **(B) só performance (item 1)**, ou **(C) só split + UX (2+3)**. Recomendo começar por **1 + 4** (ganho rápido, baixo risco) e deixar split (3) para um segundo passo.
