

# Plano: Melhorar Skills + Finanças por Projeto

## 1. Melhorias na página Skills

Baseado nas imagens de referência, a página atual já está bem estruturada. Melhorias:

### 1.1 Separar Skills Marketing vs Skills Técnicas (tabs)
- Adicionar `TabsList` com "Skills Marketing" e "Skills Técnicas" como na imagem
- Skills Marketing = categorias "Pesquisa & Avatar", "Copy & Persuasão", "Inteligência Competitiva", "Estratégia & Posicionamento", "Vendas High-Ticket"
- Skills Técnicas = "Código", "IA", "Dados", "Automação", "Pesquisa", "Infra", "Outro"
- Mostrar contador (ex: "9 metodologias") no canto superior direito
- Adicionar banner informativo abaixo das tabs

### 1.2 Melhorar card de Skill
- Mostrar nome do arquivo `.md` abaixo do nome (ex: `skill-avatar-architect-v2.md`)
- Mostrar tags na parte inferior do card (extraídas da categoria/gatilho)
- Adicionar botão "Ler →" no canto inferior direito do card

### 1.3 Melhorar modal de detalhe (Raio-X)
- Renderizar o `system_prompt` como **Markdown formatado** (usando `react-markdown` ou parser simples) em vez de `<pre>` com texto verde
- Suportar tabelas, listas, headings, bold, código inline como nas imagens
- Adicionar botão "Fechar" e badge de categoria no header do modal
- Tags clicáveis no topo do modal

| Arquivo | Ação |
|---|---|
| `src/pages/Skills.tsx` | Tabs Marketing/Técnicas, cards com tags + arquivo, modal com Markdown |

## 2. Finanças por Projeto

A tabela `imphq_custos` atual NÃO tem `project_id` — é global. Precisamos:

### 2.1 Nova tabela `imphq_project_costs`
Custos específicos por projeto com categorias: Ferramentas, Ads, Freelancer, Infra, Outro.

```sql
CREATE TABLE imphq_project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT DEFAULT 'Outro', -- Ferramentas, Ads, Freelancer, Infra, Outro
  valor NUMERIC(10,2) DEFAULT 0,
  moeda TEXT DEFAULT 'BRL',
  recorrente BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS
```

### 2.2 Nova tabela `imphq_project_revenue`
Receitas por projeto (vendas manuais ou integradas).

```sql
CREATE TABLE imphq_project_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) DEFAULT 0,
  fonte TEXT DEFAULT 'Manual', -- Manual, Hotmart, Stripe, Outro
  data_ref DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS
```

### 2.3 Nova aba "💰 Finanças" no ProjetoDetalhe
Componente `ProjetoFinancas.tsx` com:

- **KPI Cards**: Custo Total, Receita Total, Lucro (receita - custo), ROI %
- **Seção Custos**: Tabela CRUD de custos do projeto (ferramentas, ads, freelancers)
- **Seção Receitas**: Tabela CRUD de receitas (vendas, comissões)
- **Gráfico simples**: Barras comparando custo vs receita (opcional, pode usar div bars)
- Puxar custos globais (`imphq_custos`) rateados se necessário

### 2.4 Atualizar Dashboard
Adicionar card "Projetos mais lucrativos" ou "Saúde financeira" mostrando lucro/prejuízo por projeto.

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Skills.tsx` | Tabs Marketing/Técnicas, tags nos cards, Markdown no modal |
| Migration SQL | `imphq_project_costs` + `imphq_project_revenue` com RLS |
| `src/components/projeto/ProjetoFinancas.tsx` | Criar — KPIs + CRUD custos/receitas por projeto |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar aba 💰 Finanças |
| `src/pages/Dashboard.tsx` | Card de saúde financeira dos projetos |

