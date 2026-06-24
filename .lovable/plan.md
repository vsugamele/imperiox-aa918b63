## Mudanças

**1. `SiteCard.tsx` — card clicável**
- Envolver o card num `<a href={site.url} target="_blank">` (ou usar overlay) para abrir o site ao clicar.
- Botões `Anexar`, `Usar de base`, dropdown menu e link da URL continuam funcionando via `e.stopPropagation()` + `e.preventDefault()`.
- Adicionar badge/link "GitHub" no card quando `site.github_url` existir (ícone Github, abre em nova aba).

**2. `AddSiteModal.tsx` — campo GitHub**
- Adicionar campo opcional `URL do GitHub` (Input) abaixo do Tipo.
- Salvar em `imphq_sites.github_url` no insert.

**3. Migration Supabase**
- `ALTER TABLE public.imphq_sites ADD COLUMN IF NOT EXISTS github_url text;`

**4. Tipo `Site`**
- Adicionar `github_url: string | null` em `SiteCard.tsx`.

Sem mudanças em lógica de negócio existente.