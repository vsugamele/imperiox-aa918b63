## Handles sempre visíveis nos cards do mapa

Em `src/components/funis/MapAnnotationNodes.tsx`, o componente `AnnotationHandles` só renderiza quando `visible` é true (baseado em hover/seleção via `useResizeVisibility`).

### Mudança
- Forçar `visible={true}` nas 3 chamadas de `AnnotationHandles` (linhas 208, 433, 482), OU alterar o próprio componente para ignorar o prop e sempre mostrar os pontos.
- Deixar os handles com opacidade reduzida (~50%) por padrão e 100% no hover/seleção, para não poluir mas ficarem sempre visíveis.

Um arquivo, sem mudanças de schema.