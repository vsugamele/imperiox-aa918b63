## Refinamento de Design — Projeto & Lead

Objetivo: elevar a sensação editorial/luxo já presente (Cormorant + ouro #c9922a) sem reescrever lógica. Foco em hierarquia, respiro e ritmo visual.

### 1. Cabeçalho do Projeto (ProjetoDetalhe)
- Hero header com nome em Cormorant 4xl/5xl, ouro sutil, subtítulo em DM Sans uppercase tracking-wider
- Linha decorativa dourada (1px gradient) separando hero das tabs
- Status "Vendendo/Validando" como pill ouro com glow leve
- Métricas-chave (faturamento, leads, ROAS) em tira horizontal abaixo do nome — KPI inline em vez de cards soltos

### 2. Sistema de Tabs
- Trocar tabs atuais (visual genérico shadcn) por nav editorial: underline dourado animado, espaçamento amplo, tipografia em uppercase
- Indicador ativo com transição suave (motion)
- Sticky no scroll com blur backdrop

### 3. Cards internos (Avatar, Branding, KPIs, Insights)
- Padronizar: `bg-card/40 border border-border/50`, padding 6-8, radius consistente
- Headers de card com ícone ouro pequeno + título serifa + descrição muted
- Substituir bordas duras por divisores `border-border/30` e hover com `border-primary/30`
- Espaçamento vertical entre seções: 8 → 12

### 4. Lead Detail / Sidebar
- Avatar do lead maior, com ring dourado sutil
- Score como anel circular animado (em vez de número solto)
- Timeline com linha vertical ouro, dots maiores, tipografia hierarquizada
- Tags como chips pill, ouro translúcido para tags-chave

### 5. Vazios e estados
- Empty states com ilustração mínima (ícone grande muted + frase serifa) no lugar dos textos secos atuais
- Loading: skeletons que respeitam o layout final, não spinners genéricos

### 6. Microinterações
- Hover em cards: leve lift (translateY -2px) + sombra ouro 5%
- Botão "Imperador" (Sales Path): gradient ouro animado pulsante discreto
- Toasts e modais: já estão bons, só padronizar leading-7

### 7. Tipografia & ritmo
- Tamanhos: H1 4xl, H2 2xl, H3 lg — hoje misturado
- Body: leading-relaxed em descrições, leading-tight em dados
- Adicionar `tracking-[0.18em]` em uppercase labels

### Escopo técnico
Arquivos afetados (somente UI/Tailwind, zero lógica):
- `src/pages/ProjetoDetalhe.tsx` — header + tabs
- `src/components/projeto/Projeto*.tsx` — padronização de cards
- `src/pages/Leads.tsx` + `src/components/leads/LeadsSidebar.tsx` — sidebar e timeline
- `src/index.css` — adicionar utilitários (ex: `.editorial-divider`, sombra ouro)

### Entrega sugerida em 3 ondas
1. Header + tabs + tipografia (impacto visual imediato)
2. Padronização de cards e estados vazios
3. Lead sidebar + microinterações

Quer que eu execute as 3 ondas ou prefere começar só pela onda 1 pra validar a direção?
