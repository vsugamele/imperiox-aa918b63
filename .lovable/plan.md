

# Analise: O que falta ajustar no projeto

Depois de revisar todos os arquivos principais, identifiquei os seguintes problemas e melhorias pendentes:

---

## Bugs e Problemas

### 1. Funis: Inputs de numero (Visitas/Conv) ainda usam `onChange` direto
Os campos `nome`, `descricao` e `url` ja foram corrigidos com `onBlur`, mas os inputs numericos de `visitantes` e `conversoes` (linhas 381-386) ainda causam re-render a cada keystroke via `onChange` + `setEtapaField`. Devem usar `defaultValue` + `onBlur` tambem.

### 2. Funis: Conexao manual entre etapas e confusa
O campo "Conecta a: 1,2" exige que o usuario saiba os indices (0-based) das etapas. Nao ha feedback visual de qual etapa e qual indice. Precisa mostrar o numero de cada etapa no card e idealmente permitir click-to-connect.

### 3. Kanban: Sem suporte touch/mobile real
O drag-and-drop usa apenas HTML5 Drag API (`draggable`, `onDragStart`), que nao funciona em dispositivos touch. Cards ficam imoveis no mobile. A grid `grid-cols-2` no mobile tambem corta colunas.

### 4. Kanban: Board "geral" nao tem coluna propria
Quando no board "geral", ao criar um card, o usuario precisa escolher o board destino, mas a UX e confusa - o card e criado em "agentes" por padrao sem indicacao clara.

### 5. OpenFlow: Dialog de edicao pequeno demais para o FlowEditor
O dialog `max-w-2xl` e limitante para editar fluxos longos. Deveria expandir para quase fullscreen ou usar uma pagina dedicada.

### 6. Tarefas: Exportar PDF usa apenas `window.print()` sem CSS de impressao
O botao de exportar PDF provavelmente abre o print dialog do browser sem estilizacao especifica para impressao, resultando em output ruim.

---

## Melhorias de UX

### 7. Dashboard: Falta grafico de evolucao temporal
O dashboard mostra numeros estaticos mas nao tem nenhum grafico de linha/barra mostrando evolucao de leads, vendas ou tarefas ao longo do tempo.

### 8. Sidebar: Falta indicador de notificacoes/alertas
Nenhum badge de contagem na sidebar para tarefas urgentes, leads novos, etc.

### 9. ProjetoDetalhe: Tab Analytics tem muitos campos soltos
Os campos de Pixel, Clarity, GA estao todos como inputs simples sem validacao. Nao ha teste de conexao ou feedback se os IDs sao validos.

### 10. Busca global ausente
Nao existe busca global para encontrar projetos, leads, tarefas ou docs de qualquer lugar.

---

## Plano de Implementacao (Priorizado)

### Fase 1 - Fixes criticos

| Arquivo | Acao |
|---|---|
| `src/pages/Funis.tsx` | Corrigir inputs numericos para `defaultValue`+`onBlur`; mostrar indice da etapa no card |
| `src/pages/Tarefas.tsx` | Adicionar CSS `@media print` para exportacao PDF limpa |
| `src/pages/KanbanPage.tsx` | Adicionar touch events (`onTouchStart/Move/End`) para drag mobile; horizontal scroll no mobile em vez de grid quebrada |

### Fase 2 - UX melhorias

| Arquivo | Acao |
|---|---|
| `src/pages/OpenFlow.tsx` | Expandir dialog de edicao para `max-w-4xl` ou sheet fullscreen |
| `src/pages/Dashboard.tsx` | Adicionar mini chart de leads/vendas dos ultimos 7 dias usando Recharts (ja disponivel via shadcn) |
| `src/components/AppSidebar.tsx` | Badge com contagem de tarefas urgentes/overdue |

### Fase 3 - Polimento

| Arquivo | Acao |
|---|---|
| `src/components/AppLayout.tsx` | Adicionar busca global (Command+K) com `Command` dialog do shadcn |
| `src/pages/Funis.tsx` | Click-to-connect: clicar no nó de saida e depois no nó destino para criar conexao visual |

---

Total: 8 arquivos, 8 ajustes prioritarios organizados em 3 fases.

