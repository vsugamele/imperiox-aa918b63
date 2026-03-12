

# Plano: Melhorias Visuais, Financas CRUD, Webhook por Projeto e Funis com Cor

## 1. Financas -- CRUD Completo

**Problema**: Pagina so exibe dados, nao permite adicionar/editar/deletar ferramentas.

**Solucao**:
- Adicionar botao "+ Nova Ferramenta" que abre dialog com campos: Nome, Tipo (SaaS, API, Infra, Ads, Outro), Valor, Moeda (BRL/USD)
- Editar inline ou via dialog ao clicar na linha
- Botao de deletar por linha
- Cards KPI coloridos no topo: Total BRL, Total USD, Qtd Ferramentas, Media por Ferramenta
- Animacoes fade-in nos cards

## 2. Webhook URL por Projeto

**Problema**: Webhook unico nao permite diferenciar projeto de origem. Plataformas como Hotmart/Kiwify nao enviam project_id.

**Solucao**:
- Alterar a URL do webhook para aceitar query param: `?project=<project_id>`
- Atualizar edge function para ler `project_id` da URL query string (prioridade sobre deteccao automatica)
- Na pagina OpenFlow, mostrar URL unica por projeto com select de projeto
- Cada projeto gera sua propria URL com `?project=id`

## 3. Funis -- Cards Coloridos + Melhor Canvas

**Problema**: Cards na listagem sao sem cor. Canvas precisa de mais vida visual.

**Solucao**:
- **Listagem**: Cards com gradient lateral baseado no status (Ativo=emerald, Rascunho=amber, Pausado=gray)
- **Canvas**: Nodes com cor de fundo gradient sutil, bordas mais espessas, icones por tipo de etapa
- Thumbnails maiores quando tem imagem, placeholder com gradiente
- Animacao de entrada nos nodes (fade-in escalonado)
- SVG connectors com animacao de dash (stroke-dasharray animado)

## 4. Cores e Animacoes Globais

**Problema**: Interface monocromatica em varias paginas, sem animacoes de entrada.

**Solucao**:
- **Dashboard**: Cards com hover scale + gradient sutil, animacao fade-in escalonada
- **Sidebar**: Icones com cor por grupo (CRM=emerald, IA=violet, Tools=cyan, Org=amber)
- **Referencias**: Cards com borda colorida por tipo (criativo=rose, LP=blue, email=amber, video=violet, copy=emerald)
- **Todas as paginas**: Adicionar `animate-fade-in` nos containers principais
- **Market Intel**: Ja tem cores, adicionar hover effects mais vivos e gradients nos cards de oferta
- **OpenFlow/Automacoes**: Cards com borda lateral colorida por trigger type

## 5. Referencias -- Melhorias

- Ao clicar na URL de um card, abrir em iframe/preview lateral (ou nova aba com destaque visual)
- Score com estrelas clicaveis (ja existe mas melhorar visual com cor dourada)

## Arquivos a editar

| Arquivo | Acao |
|---|---|
| `src/pages/Financas.tsx` | Reescrever com CRUD completo + KPIs coloridos |
| `src/pages/Funis.tsx` | Cards coloridos na lista + canvas melhorado + animacoes |
| `src/pages/OpenFlow.tsx` | URL de webhook por projeto + cards coloridos |
| `supabase/functions/webhook-pagamento/index.ts` | Ler project_id da query string |
| `src/pages/Dashboard.tsx` | Animacoes + hover effects + gradients |
| `src/components/AppSidebar.tsx` | Icones coloridos por grupo |
| `src/pages/Referencias.tsx` | Cards coloridos por tipo + score dourado |
| `src/pages/MarketIntel.tsx` | Hover effects + gradients melhorados |

Nenhuma migration necessaria.

