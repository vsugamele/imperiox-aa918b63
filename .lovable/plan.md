
# Avaliacao de Melhorias Pendentes — Imperio HQ

## Problemas Tecnicos (Divida Tecnica)

### 1. Arquivos gigantes e sem separacao
- `Leads.tsx` tem **1.946 linhas** — deveria ser dividido em componentes menores (tabela, filtros, detalhe do lead, qualificacao, formularios)
- `Dashboard.tsx` tem **939 linhas** com ~15 useState e queries soltas — deveria usar hooks customizados
- `KanbanPage.tsx` tem **1.123 linhas** — idem
- `ProjetoDetalhe.tsx` tem **583 linhas** mas e gerenciavel

### 2. Queries sem cache / re-fetch desnecessario
- Dashboard faz **7+ queries paralelas** no mount sem React Query (`useQuery`). Ja existe `@tanstack/react-query` instalado mas quase nao e usado.
- Navegacao entre paginas refaz todas as queries do zero — sem cache, sem stale-while-revalidate.

### 3. Tipagem fraca (`any` excessivo)
- `project` e tipado como `any` em quase todos os componentes
- `lead.data` e `any` sem interface
- Isso gera bugs silenciosos (ex: o bug do R$74 vs R$47 so foi pego manualmente)

---

## Melhorias de Produto (UX)

### 4. Dashboard — filtros sem efeito global
- O filtro de periodo/projeto so afeta o bloco de Ads. Receita, leads trend, funil e outros KPIs nao respeitam o filtro selecionado.

### 5. Leads — performance com volume
- Sem paginacao real (carrega tudo do Supabase). Com 500+ leads vai ficar lento.
- Busca e client-side, nao server-side.

### 6. Notificacoes / Alertas proativos
- Nao existe alerta quando um lead fica "pix_gerado" por mais de X horas sem converter.
- Nao existe alerta quando gasto de ads sobe sem leads proporcionais (CPA disparando).

### 7. WhatsApp — robustez pos-QR
- Acabamos de melhorar o fluxo de QR, mas falta: reconexao automatica quando sessao cai, notificacao quando desconecta, e historico de sessoes.

### 8. Mobile responsivo
- Sidebar funciona com collapsible, mas varias paginas (Kanban, Leads, Dashboard) nao foram otimizadas para mobile.

---

## Priorizacao Sugerida

| # | Melhoria | Impacto | Esforco |
|---|----------|---------|---------|
| 1 | Filtros globais no Dashboard (periodo afeta tudo) | Alto | Medio |
| 2 | Paginacao server-side em Leads | Alto | Medio |
| 3 | Alertas proativos (pix sem conversao, CPA alto) | Alto | Medio |
| 4 | Refatorar Leads.tsx em componentes menores | Medio | Alto |
| 5 | Migrar queries para React Query (cache) | Medio | Alto |
| 6 | Tipagem forte para Project, Lead, Venda | Medio | Medio |
| 7 | Mobile responsivo (Kanban + Leads) | Medio | Medio |
| 8 | WhatsApp reconexao + notificacao | Baixo | Alto |

---

Qual area voce quer atacar primeiro? Posso comecar por qualquer item acima.
