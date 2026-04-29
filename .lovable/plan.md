
# Resposta às 5 perguntas + plano

## 1. Dashboard sem clique nos cards

**Diagnóstico:** Hoje só os cards do bloco **Investimento em Ads** (`DashboardAds.tsx`) abrem o `DashboardDrillSheet`. Os cards do `DashboardStats` (Projetos, Tarefas, Leads, Receita, Vendas, Pix Pendentes) **não têm `onClick`** — embora o `DashboardDrillSheet` já suporte essas métricas.

**Plano:**
- Adicionar `onClick` em todos os cards de `DashboardStats.tsx` abrindo o drill correspondente (`leads`, `revenue`, `sales`, `pix_pending`, `ads_spend`, `op_cost`).
- Card "Projetos" → navega para `/projetos`. Card "Tarefas" → `/tarefas`.
- Adicionar cursor-pointer + hover-scale para indicar interatividade.
- Tornar o `PredictiveDashboard` clicável: card "Projeção 30 dias" abre drill de receita; "Saúde do Funil" abre `AcquisitionFunnel`; "Anomalias" expande lista detalhada.

## 2. Diagnóstico Yoshitani 7/5/3 ignora status ATIVO/PAUSADO

**Diagnóstico:** Em `DashboardAds.tsx:188-244`, o agrupamento é só por `campanha` (nome). Não filtra por `status` da campanha (`ATIVO`/`PAUSED`) — então campanhas pausadas há semanas aparecem no diagnóstico, poluindo o ranking.

**Plano:**
- No SELECT de `imphq_ads_spend` incluir `status` (já existe na coluna).
- Filtrar `diagcampMap` para incluir só campanhas com pelo menos uma linha `status='ACTIVE'` nos últimos 3 dias.
- Adicionar badge **PAUSADA** (cinza) e seção colapsável "Campanhas pausadas" abaixo do top 5 de ativas.
- Ordenar ativas primeiro, depois pausadas com gasto > 0 em 7d.

## 3. Vendas de hoje não marcaram na campanha

**Diagnóstico (confirmado por SQL):** As 8 vendas dos últimos 2 dias chegaram com `utm_campaign = NULL`, `utm_source = NULL`. O webhook da Ticto/Hotmart está entregando sem UTMs porque a página de checkout não está propagando `?utm_campaign=` da URL para o checkout. Não é bug do nosso lado — é configuração no checkout.

**O que VOCÊ precisa fazer (lado do produto):**
1. Na página de captura/VSL, garantir que os links para o checkout (Ticto/Hotmart) repassam **todos** os UTMs da URL — usar o `Tracker` que já temos (`src/pages/Tracker.tsx`) com `xcod` codificado.
2. Na Ticto: ativar **"Receber UTMs do checkout"** nas configurações do produto.
3. Na Hotmart: configurar **"src" + UTMs** no link do produto (`?src={{campaign.name}}`).
4. Validar uma compra de teste e ver se chega `utm_campaign` na tabela `imphq_vendas`.

**O que EU faço (lado do código):**
- Em `webhook-pagamento`: adicionar fallback para extrair UTMs do `xcod`/`src`/`sck` (Ticto manda em `purchase.tracking.src`).
- Criar matching reverso: se `utm_campaign` casa parcialmente (case-insensitive, contém) com `imphq_ads_spend.campanha`, gravar `campaign_id` na venda.
- Adicionar card de **diagnóstico de atribuição** no Gerenciador: "X vendas hoje sem UTM — clique para corrigir" com instruções inline.
- Job diário que reconcilia vendas órfãs por proximidade temporal + click_id quando existir.

## 4. Creative Factory — sem escolha de modelos / sem puxar produtos

**Diagnóstico:** Em `CriativoNovo.tsx`:
- O seletor de **Avatar/Produto** existe (linha 392) e lê `currentProject.data.produtos`. Se você não vê produtos é porque o projeto selecionado não tem `data.produtos` populado (precisa ser preenchido em ProjetoDetalhe → Produtos).
- Não há seletor de **modelo de IA** (sempre usa `lovable-gemini` ou `openai-image` via dropdown que existe em `imageProvider`, mas não há escolha de "modelos" no sentido de presets de estilo/template).

**Plano:**
- Verificar projetos sem `data.produtos` e mostrar aviso inline: "Cadastre produtos em Projeto → Produtos para o auto-briefing puxar preço/promessa".
- Adicionar **galeria de templates/modelos visuais** (header-ad, story-ad, carousel-frame, depoimento, antes-depois) — cada template define `formato`, `angulo` sugerido e prompt-base.
- Tornar o seletor `imageProvider` mais visível com previews (Gemini = rápido/barato, OpenAI = qualidade alta).
- Botão "Importar de batch anterior" para clonar configuração.

## 5. Finanças — receita inflada + filtro de projetos

**Diagnóstico:**

**A) Receita parecendo maior:** Em `Financas.tsx:54`, o SELECT de vendas **não tem filtro de data no SQL**:
```ts
supabase.from("imphq_vendas").select(...).eq("status", "aprovado")
```
Carrega TODAS as vendas históricas (até 1000, limite default Supabase). Quando o usuário não escolhe datas, os KPIs somam tudo. Pior: o limite de 1000 corta vendas antigas silenciosamente, então o número fica errado dos dois lados.

**B) Filtro de projetos:** O SQL é `or("is_archived.eq.false,is_archived.is.null")` — funciona (9 projetos ativos confirmados). Se você não vê todos é porque o dropdown está cortado visualmente OU o `briefing` no SELECT (`"id, name, icon, briefing"`) está falhando silenciosamente em projetos sem essa coluna.

**Plano:**
- **Forçar período padrão de 30 dias** ao abrir Finanças (`filterDateFrom = localDaysAgo(30)`) para evitar somar histórico inteiro.
- Aplicar `gte/lte` no SELECT de vendas e ads usando o filtro de datas, não só no client-side.
- Aumentar `.limit(5000)` ou paginar via `supabasePaginate` que já existe no projeto.
- Mostrar contador "Mostrando X de Y vendas" abaixo do KPI de receita.
- Remover `briefing` do SELECT de projetos (não é usado na página).
- Adicionar tooltip no KPI Receita explicando que respeita o filtro de período.

---

## Resumo do que será feito (ordem)

1. **Dashboard clicável** — `DashboardStats` + `PredictiveDashboard` ganham drill-down.
2. **Yoshitani só com ativas** — filtra por status, separa pausadas.
3. **Atribuição de vendas** — fallback de UTM no webhook + matching reverso + card de diagnóstico no Gerenciador (+ doc com passo-a-passo Ticto/Hotmart).
4. **Creative Factory** — aviso de produtos faltando + galeria de templates + preview de providers.
5. **Finanças** — período default 30d + SQL com data + paginação + KPI honesto.

Aprova que eu implemente nessa ordem?
