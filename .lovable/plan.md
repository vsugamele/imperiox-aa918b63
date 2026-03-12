

# Plano: Construir pagina Skills & Capacidades

## O que construir

Pagina completa de inventario de skills/ferramentas da operacao, baseada na imagem de referencia. Interface com cards organizados por categoria, filtros e status.

## Estrutura dos dados

Array estatico de skills com campos:
- `id`, `nome`, `descricao`, `categoria` (Codigo, IA, Dados, Criativo, Automacao, Pesquisa, Infra)
- `status`: Ativo | Beta | Planejado
- `icone`: icone Lucide correspondente

## Skills baseadas na imagem

| Categoria | Skills |
|---|---|
| Codigo | Coding Agent, GitHub Issues, GitHub CLI, Skill Creator |
| IA | Gemini Flash, Image Vision, Whisper API, Copy Engine |
| Dados | Google Sheets, Weather, Meta Ads API, Hotmart API |
| Criativo | Nano Banana Pro, OpenAI Image Gen, Remotion, Video Frames |
| Automacao | Telegram Bot |
| Pesquisa | YouTube, Market Scraper |
| Infra | Healthcheck |

## Interface

- Header com titulo "Skills & Capacidades", contagem (X ativos, Y total)
- Barra de filtros: busca por texto, select de categoria, select de status
- Grid de cards (4 colunas desktop) agrupados por categoria
- Cada card: icone, nome, badge de status (cor por status), descricao
- Cores dos badges: Ativo = verde, Beta = amarelo, Planejado = cinza

## Arquivo a editar

| Arquivo | Acao |
|---|---|
| `src/pages/Skills.tsx` | Reescrever com dados, filtros e grid de cards |

