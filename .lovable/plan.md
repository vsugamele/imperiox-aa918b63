

# Diagnóstico: O que as imagens mostram vs o que temos

## Imagens 1 e 2 — Mapa de Ecossistema / Escada de Valor

Mostram uma visão estratégica de **clusters de produtos** organizados por nível (Aquisição → Ascensão → Core → Premium), com:
- Cards por produto com **nome, preço, plataforma** (Eduzz, Kiwify, Hotmart), descrição e insight estratégico
- **Setas/conexões** entre produtos mostrando o fluxo do cliente
- **Agrupamento em clusters** (Cluster 01: entrada, Cluster 02: upsells, Cluster 03: core/premium)
- Badges de tipo (BUNDLE, PRODUTO NUCLEAR, 5 VERSOES)

**No nosso sistema**: O módulo Funis já tem canvas visual com drag, setas e tipos de etapa, mas é focado em **etapas de um funil individual** (anúncio → opt-in → VSL → checkout). Falta a visão macro de **ecossistema de produtos** — onde cada card é um produto/oferta e as conexões mostram a escada de valor.

## Imagem 3 — Centro de Comando por Projeto

Mostra um dashboard operacional focado em um projeto com:
- Header com **projeto, fase, complexidade, última atualização**
- Barra de progresso de tarefas (8/8 = 100%)
- **KPIs do dia**: leads hoje, agendados, atendidos, voicemail, pendentes
- Tabela de **últimos leads** com nome, telefone, região, status, horário
- **Fila de clientes** lateral
- **Kanban inline** (Fazendo, Revisão, Concluído) com cards de tarefas

**No nosso sistema**: Temos o `ProjetoDetalhe` com abas separadas (Briefing, Avatar, Finanças, etc.) mas não temos essa visão consolidada de "centro de comando" que mostra tudo de uma vez.

---

## Plano de Melhorias

### 1. Mapa de Ecossistema de Produtos (nova view em Funis)

Adicionar um toggle/aba "Ecossistema" no módulo Funis que mostra uma visão macro:
- Cada card representa um **produto** (não etapa de funil), puxado dos projetos (`briefing.produtos`)
- Cards mostram: nome, preço, plataforma (badge), descrição curta, insight
- Organizar em **clusters** arrastáveis (Aquisição, Ascensão, Core, Premium)
- Setas entre produtos representando a escada de valor
- Reutilizar o canvas engine existente (drag, zoom, pan, conexões)
- Estilo visual dark com bordas vermelhas como nas imagens

**Arquivo**: `src/pages/Funis.tsx` — novo modo "ecossistema" ao lado do modo "funil individual"

### 2. Centro de Comando por Projeto (nova aba em ProjetoDetalhe)

Adicionar aba "🎯 Comando" no `ProjetoDetalhe` que consolida:
- **Header**: fase do projeto, complexidade, última atualização, botão atualizar
- **Barra de progresso**: total de tarefas do projeto (cards no Kanban vinculados) vs concluídas
- **KPIs do dia**: leads capturados hoje, pix gerados, vendas, pendentes
- **Tabela de últimos leads** do projeto (nome, email/tel, status, horário)
- **Mini-Kanban inline**: colunas Fazendo/Revisão/Concluído com cards do projeto
- Tudo em uma tela só, estilo painel operacional

**Arquivos**: Criar `src/components/projeto/ProjetoComando.tsx`, registrar nova aba em `src/pages/ProjetoDetalhe.tsx`

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `src/pages/Funis.tsx` | Toggle "Ecossistema" com visão macro de produtos por cluster, cards com preço/plataforma/insight, conexões de escada de valor |
| `src/components/projeto/ProjetoComando.tsx` | Criar — Centro de Comando por projeto com KPIs do dia, leads recentes, barra de progresso, mini-kanban inline |
| `src/pages/ProjetoDetalhe.tsx` | Registrar aba "Comando" |

