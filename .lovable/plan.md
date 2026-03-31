

# Plano: Olhinho nos Campos Secretos + Painel de Vendas com Dados do Facebook

---

## 1. Adicionar Eye/EyeOff nos campos de senha que estão faltando

**Problema**: Vários campos `type="password"` não têm o botão de olhinho para revelar o dado. O padrão já existe em `Empresa.tsx`, `Configuracoes.tsx` e `ProjetoBriefing.tsx`, mas falta em:

- **ProjetoDetalhe.tsx**: Access Token CAPI (linha 380) e tokens Hotmart/Kiwify/Ticto (linha 504)
- **ProjetoEmails.tsx**: API Key Resend (linha 163)
- **ProviderConfigDialog.tsx**: API Key WhatsApp (linha 72)
- **Cofre.tsx**: campo senha no dialog de adicionar/editar (linha 368)

**Solução**: Em cada arquivo, adicionar estado `visibleSecrets` (ou similar) e envolver o Input num `div.relative` com botão Eye/EyeOff no canto direito. Padrão idêntico ao já usado no `Configuracoes.tsx`.

**Arquivos**: `src/pages/ProjetoDetalhe.tsx`, `src/components/projeto/ProjetoEmails.tsx`, `src/components/whatsapp/ProviderConfigDialog.tsx`, `src/pages/Cofre.tsx`

---

## 2. Painel de Performance Facebook + Vendas por Projeto/Produto

**Problema**: Os dados do Facebook (via `imphq_ads_spend`) e as vendas (via `imphq_vendas`) existem separados. Não há uma visão unificada que mostre: "neste projeto, com este produto, gastei X em ads no Facebook, tive Y vendas, ROAS Z".

**Solução**: Criar uma nova aba **"Performance"** na página de Finanças (ou como seção dentro da Overview) que cruza ads + vendas filtrados por projeto e produto.

### Componentes do painel:

**Filtros**:
- Projeto (já existe)
- Produto (novo select baseado em `produto_nome` das vendas)
- Período (7d, 30d, mês atual, personalizado)

**KPIs cruzados** (cards):
- Investido em Ads (soma `imphq_ads_spend.valor` do período)
- Receita Vendas (soma `imphq_vendas.valor` do período)
- ROAS Real (receita / ads)
- CPA Real (ads / qtd vendas)
- Nº Vendas
- Lucro (receita - ads)

**Gráfico Timeline** (já existe parcialmente no Overview):
- Gasto Ads vs Receita Vendas por dia, filtrado por projeto + produto

**Tabela de Campanhas** (novo):
- Agrupa `imphq_ads_spend` por `campanha`
- Colunas: Campanha, Investido, Impressões, Cliques, CTR, Leads, Compras, CPA, ROAS
- Cruza com vendas do mesmo período para calcular ROAS por campanha

**Breakdown por Produto**:
- Para cada produto (`produto_nome`), mostra receita total, nº vendas, ticket médio

### Implementação:
- Nova aba `TabsTrigger value="performance"` em `Financas.tsx`
- Novo componente `src/components/financas/FinancasPerformance.tsx`
- Recebe `ads`, `vendas`, `projects` como props (já carregados)
- Filtros de período e produto são internos ao componente

**Arquivos**: `src/pages/Financas.tsx`, `src/components/financas/FinancasPerformance.tsx` (novo)

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `src/pages/ProjetoDetalhe.tsx` | Eye toggle nos campos CAPI token e tokens de plataforma |
| `src/components/projeto/ProjetoEmails.tsx` | Eye toggle no campo Resend API Key |
| `src/components/whatsapp/ProviderConfigDialog.tsx` | Eye toggle no campo API Key |
| `src/pages/Cofre.tsx` | Eye toggle no campo senha do form dialog |
| `src/pages/Financas.tsx` | Nova aba "Performance" |
| `src/components/financas/FinancasPerformance.tsx` | Novo: painel cruzando ads + vendas com filtros |

