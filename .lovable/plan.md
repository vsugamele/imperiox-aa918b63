# Filtro por Tag em /leads

Hoje as tags aparecem só na sidebar como "Top tags · criar regra" (atalho pra criar regra de roteamento). Não dá pra filtrar leads por tag. Vou adicionar.

## O que muda

1. **Sidebar (`LeadsSidebar.tsx`)** — Bloco "Top tags" vira clicável:
   - Clique na tag → ativa filtro `tagFilter`
   - Mantém o atalho ⚡ (criar regra) visível no hover
   - Tag selecionada fica destacada (mesmo padrão dos projetos)

2. **`Leads.tsx`** — Novo estado `tagFilter` (persistido junto com os outros):
   - Aplicado no `filteredLeads` (match se `lead.tags` inclui a tag)
   - Chip removível no header quando ativo: `🏷️ tag-x ×`
   - Contagem no header já reflete (usa `filtered.length`)

3. **Barra de filtros** — Novo `Select` "Tag" ao lado de Estágio/Produto/Formulário, populado com `topTags` (todas, não só 12). Sincroniza com a sidebar.

## Resultado

- Clica numa tag → vê quantos leads têm aquela tag (contador) e quem são (tabela filtrada)
- Export CSV respeita o filtro (já usa `filtered`)
- Combina com os outros filtros (período, projeto, estágio, etc.)

## Arquivos

- `src/pages/Leads.tsx` — estado + filtro + Select + chip
- `src/components/leads/LeadsSidebar.tsx` — tag clicável + destaque do selecionado + prop `tagFilter`/`onTagFilter`
