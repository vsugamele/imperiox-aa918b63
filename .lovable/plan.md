## Fix: não consigo redimensionar o frame "Grupo"

**Causa:** o wrapper do `AnnotationFrameNode` tem `pointerEvents: "none"` (para deixar o miolo transparente a cliques). O `NodeResizer` do React Flow renderiza as alças como filhos desse wrapper, então elas herdam `pointer-events: none` e não capturam mouse — por isso as alças aparecem mas não arrastam.

**Correção mínima em `src/components/funis/MapAnnotationNodes.tsx`:**

Adicionar `!pointer-events-auto` nas classes dos handles/linhas do resizer para forçá-los interativos independente do parent:

```ts
const resizerLineClassName = "nodrag nopan !pointer-events-auto !border-primary/70 !border-2 !z-50";
const resizerHandleClassName = "nodrag nopan !pointer-events-auto !w-5 !h-5 !rounded-sm !bg-primary !border-2 !border-background !shadow-lg !z-50";
```

Isso é seguro: as outras notas (note, label, arrow, reel) usam wrappers com `pointer-events` normal, então nada muda para elas — só destrava o resizer do frame.

**Fora de escopo:** os erros `<rect> width/height negative` do console vêm do NodeResizer ao medir nodes recém-criados sem dimensões — some sozinho após o primeiro layout e não é o que impede o resize.
