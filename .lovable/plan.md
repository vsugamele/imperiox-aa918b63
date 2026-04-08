

# Plano: Fluxogramas Visuais + Portal do Expert

## Duas funcionalidades pedidas

### 1. Fluxogramas de Processo por Projeto
Diagramas visuais de processos/funis (como os que voce mostrou — "Funil B — Low Ticket + Webinario + Formacao") dentro de cada projeto.

### 2. Portal do Expert
Uma secao onde o expert acessa tudo que precisa fazer: calendario, tarefas, processos, plano de conteudo — tudo filtrado pelo projeto dele.

---

## Funcionalidade 1: Fluxogramas de Processo

### O que existe hoje
- A pagina **Funis** (`/funis`) ja tem um canvas com etapas arrastaves e conexoes (setas SVG entre nos)
- A tabela `imphq_processes` tem `steps` (JSON) mas e usada apenas como checklist (passos com done/not done)
- Nao existe nenhum editor de fluxograma tipo whiteboard nos projetos

### Solucao
Criar uma nova aba **"🗺️ Fluxogramas"** no ProjetoDetalhe que reutiliza a mecanica de canvas do Funis, mas simplificada para desenhar processos estrategicos (como os das imagens).

**Armazenamento**: Usar `imphq_projects.data.flowcharts[]` — array de fluxogramas, cada um com nome, nos (texto + posicao + cor + tipo) e conexoes.

**Editor**: Canvas com:
- Nos arrastaves com titulo, subtitulo e cor configuravel
- Conexoes (setas) entre nos
- Tipos de no: etapa, decisao, resultado, nota
- Zoom in/out (ja existe no Funis)
- Salvar via autoSave no campo `data`

**Diferenca do Funis**: O Funis e para metricas de conversao (visitantes/conversoes). Os fluxogramas sao para planejamento estrategico visual — sem metricas, com mais flexibilidade de layout e texto.

---

## Funcionalidade 2: Portal do Expert

### O que existe hoje
- Aba "Expert" no projeto — dados do expert (nome, bio, redes)
- Calendario por projeto
- Processos/SOPs na pagina Tarefas (com filtro por projeto)
- Kanban com cards por projeto
- Nenhuma visao unificada "o que o expert precisa fazer"

### Solucao
Criar uma nova aba **"🧭 Painel Expert"** no ProjetoDetalhe que agrega numa unica tela:

1. **Agenda da Semana** — Proximos 7 dias de eventos do calendario do projeto
2. **Tarefas Pendentes** — Cards do Kanban atribuidos ao projeto com status != concluido
3. **Processos Ativos** — SOPs do projeto com progresso (barra de %)
4. **Plano de Conteudo** — Calendario semanal estilo o da imagem (seg-dom, com posts planejados por dia)
5. **Fluxogramas** — Link rapido para os fluxogramas do projeto (abre a aba)
6. **Notas/Instrucoes** — Campo de texto livre para orientacoes gerais ao expert

O plano de conteudo sera uma sub-secao nova com:
- Grid semanal (7 colunas)
- Cada dia tem cards de conteudo (plataforma + tipo + descricao curta)
- Armazenado em `imphq_projects.data.content_plan[]` com `{semana, dia, plataforma, tipo, descricao}`
- KPIs resumidos: posts/semana, plataformas ativas, foco estrategico

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/ProjetoFlowcharts.tsx` | **Novo** — Editor de fluxogramas canvas (nos + setas + drag) |
| `src/components/projeto/ProjetoExpertPanel.tsx` | **Novo** — Painel unificado do expert (agenda, tarefas, processos, conteudo) |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar 2 novas abas: Fluxogramas e Painel Expert |

## Ordem

1. Criar `ProjetoFlowcharts.tsx` com editor canvas
2. Criar `ProjetoExpertPanel.tsx` com as 5 secoes agregadas
3. Integrar ambos como novas abas no ProjetoDetalhe

