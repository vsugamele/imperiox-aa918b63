

# Plano: Correções e Melhorias Gerais (Referência)

## Problemas Identificados e Soluções

### 1. Bug: Campo perde foco a cada letra digitada
**Causa provável**: Componentes recriados a cada keystroke por state updates no parent. Afeta inputs em `Funis.tsx` (etapa nome/url) e possivelmente outros.
- Em `Funis.tsx`, o `setEtapaField` causa re-render de todo o canvas. Solução: usar `useRef` para valores temporários ou debounce nos inputs das etapas, e aplicar `onBlur` em vez de `onChange` para campos de texto dentro dos cards do canvas.

### 2. Funis: Conexão manual entre etapas
Atualmente, os connectors são sempre sequenciais (`etapas[i] → etapas[i+1]`). Melhorias:
- Adicionar campo `connects_to: number[]` em cada `Etapa` (índices dos destinos)
- Permitir clicar em um nó de saída e arrastar até outro nó para criar conexão
- Renderizar connectors SVG baseados em `connects_to` em vez de sequenciais
- Adicionar campo `descricao` nas etapas para clarificar "Captura de quê? Qual link?"

### 3. Tarefas: Exportar PDF do dia
- Adicionar botão "📄 Exportar PDF" no header de Tarefas
- Gerar PDF client-side com as tarefas do dia (overdue + hoje) usando formatação simples via `window.print()` com CSS de impressão ou biblioteca leve

### 4. Leads: Exportar Excel
- Adicionar botão "📊 Exportar Excel" no header de Leads
- Gerar arquivo `.xlsx` client-side com `xlsx` (SheetJS) ou CSV simples com os leads filtrados

### 5. Kanban: Melhorar drag-and-drop
- O drag atual usa HTML5 drag API nativa, que é limitada em mobile. Melhorar com:
  - Touch events para mobile (`onTouchStart/Move/End`)
  - Visual feedback durante drag (placeholder na coluna destino)
  - Mostrar todas as 5 colunas responsivamente (atualmente `grid-cols-5` não funciona em mobile)
- Mostrar todos os boards no filtro, não apenas 3 no topo

### 6. Projetos — Links
- Adicionar seção "🔗 Links" no `ProjetoDetalhe` (nova tab ou dentro de Briefing)
- Estrutura: array de `{ label, url }` salvos no campo `data.links` do projeto
- Botão "+ Adicionar Link" com inputs de nome e URL

### 7. Mídia: Botões de visualizar e download
- Na grid de fotos (tab Fotos), adicionar botões de overlay: 👁 Visualizar (abre dialog com imagem grande) e ⬇ Download
- O preview dialog já existe para content library, estender para fotos simples

### 8. Docs: Importar e Download
- Adicionar botão "📥 Importar" que aceita `.txt`, `.md`, `.doc` para criar doc automaticamente
- Adicionar botão "⬇ Download" em cada doc para exportar como `.md` ou `.txt`

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/pages/Funis.tsx` | Fix foco dos inputs (onBlur), conexões manuais entre etapas, campo descrição |
| `src/pages/Tarefas.tsx` | Botão exportar PDF das tarefas do dia |
| `src/pages/Leads.tsx` | Botão exportar Excel/CSV |
| `src/pages/KanbanPage.tsx` | Melhorar drag mobile, visual feedback, responsividade colunas |
| `src/components/projeto/ProjetoMidia.tsx` | Botões visualizar/download nas fotos |
| `src/components/projeto/ProjetoDocs.tsx` | Botões importar doc e download |
| `src/pages/ProjetoDetalhe.tsx` | Nova seção/tab de Links do projeto |

