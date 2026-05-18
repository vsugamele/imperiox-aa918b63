# Correções: 400 nas queries + 504 do openflow-ai

## Diagnóstico

Os erros principais não são causados pela IA. São queries com colunas inexistentes em `imphq_projects` retornando **HTTP 400**, o que quebra a tela `/metas` e outras.

Schema real de `imphq_projects` (colunas relevantes): `id, name, category, color, parent_id, icon, description, members, data (jsonb), avatar, pipeline, brand_kit, settings, is_archived, user_id, daily_revenue_goal, …`

Não existem: `nome`, `briefing`, `produto`, `categoria`, `objetivo`, `contexto`. Todos esses dados vivem dentro do JSONB `data`.

Locais com query inválida (causa dos 400 no console):
- `src/pages/Metas.tsx:21` → `select("id, nome").order("nome")` (tela atual do usuário)
- `src/pages/Funis.tsx:282` → `select("id, name, briefing, data")`
- `src/pages/Mentes.tsx:122` → `select("id,name,produto,categoria,objetivo,avatar,contexto,data")`

Sobre os erros de console "A listener indicated an asynchronous response…": ruído de extensão do Chrome, ignorar.

Sobre o 504 do `openflow-ai`: o guard de 90s e o fluxo de background via `imphq_ai_jobs` já foram implementados nas iterações anteriores. O 504 que apareceu no replay veio de uma chamada anterior à tela atual (Metas não invoca IA). Para evitar reincidência, vamos reduzir o guard de 90s → **60s** e garantir 408 estruturado.

## Mudanças

### 1. `src/pages/Metas.tsx` (linha 21 e usos de `r.nome`)
Trocar para coluna real `name` e ler campos extras via `data` jsonb se necessário:
```ts
const { data: projects } = await sb.from("imphq_projects")
  .select("id, name").order("name");
// ...
return { id: p.id, nome: p.name, /* resto igual */ };
```
(Mantém `r.nome` no JSX — apenas a fonte muda.)

### 2. `src/pages/Funis.tsx` (linha 282 + leitura de `proj.briefing`)
```ts
supabase.from("imphq_projects").select("id, name, data").order("name"),
```
E onde lê `proj.briefing`, usar `proj.data?.briefing` (já há fallback `typeof === "string"`, manter).

### 3. `src/pages/Mentes.tsx` (linha 122)
```ts
supabase.from("imphq_projects")
  .select("id, name, category, avatar, data")
  .order("name").then(({ data }) => setProjects(data || []));
```
E ajustar leituras: `p.produto → p.data?.produto`, `p.objetivo → p.data?.objetivo`, `p.contexto → p.data?.contexto`, `p.categoria → p.category`.

### 4. `supabase/functions/openflow-ai/index.ts`
- Reduzir `TIMEOUT_MS` de 90_000 → **60_000** no `fetchAI`.
- Garantir que toda resposta de timeout retorne `408` com JSON `{ error: "TIMEOUT_GUARD", suggest_background: true }` + `corsHeaders`.

## Fora do escopo
- Não tocar no `sales-path-engine` (já está em background).
- Não tocar nas demais telas que já usam `select("id, name")` corretamente.
- Erros do manifest.json 401 e de extensão são ruído, ignorar.
