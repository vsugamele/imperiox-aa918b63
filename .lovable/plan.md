## 1) Conectar Imagem ↔ Script

O card **IMAGEM** é um nó principal (`MapNodeCard`) e só tem 2 pontos de conexão (topo/base) invisíveis; o **SCRIPT** é uma anotação (4 pontos). Por isso arrastar não funciona bem.

**Mudança em `src/components/funis/CompanyMapCanvas.tsx` (MapNodeCard):**
- Substituir os 2 `<Handle>` atuais por um bloco de 4 handles (source+target sobrepostos em Top/Right/Bottom/Left), sempre visíveis com 50% de opacidade — mesmo padrão do `AnnotationHandles`.
- Os handles usam a cor do nó (`data.color`).

Resultado: qualquer nó (imagem, WhatsApp, script, etc.) pode ser conectado em qualquer direção arrastando de um pontinho dourado/colorido.

## 2) Cronograma dentro do mapa

Novo tipo de anotação **`schedule`** (card "Cronograma").

**Estrutura de dados** (sem migração — usa `style` JSON existente):
```
kind: "schedule"
text: "Rotina Diária de Conteúdo"    // título
style: {
  recurrence: "daily" | "weekly",
  items: [
    { time: "09:00", kind: "post",   label: "Post carrossel — dor do avatar" },
    { time: "13:00", kind: "post",   label: "Post reels — solução" },
    { time: "18:00", kind: "post",   label: "Post prova social" },
    { time: "20:00", kind: "story",  label: "Story bastidor" },
    { time: "20:05", kind: "story",  label: "Story enquete" },
    { time: "20:10", kind: "story",  label: "Story CTA link" }
  ]
}
```

**Arquivos:**

`src/components/funis/MapAnnotationNodes.tsx`:
- Adicionar `"schedule"` no tipo `AnnotationKind` e no mapa `annotationNodeTypes` / `kindToType` / defaults (w:280, h:340).
- Novo `AnnotationScheduleNode` (usa `GeneratorShell` com ícone `CalendarClock`, accent `#3b82f6`):
  - Cabeçalho editável (título + toggle diário/semanal).
  - Lista de linhas `HH:MM · [ícone tipo] · texto` — cada linha editável in-place.
  - Botão "+ item" no rodapé; botão "×" por linha.
  - Ícones por tipo: `Camera` (post), `Circle` (story), `Video` (reel), `Send` (email), `MessageCircle` (WA).

`src/components/funis/CompanyMapCanvas.tsx`:
- Adicionar `annotation_schedule: annotationNodeTypes.annotation_schedule` no `nodeTypes`.
- Adicionar botão **"Cronograma"** no toolbar de anotações (perto do botão "Reel"), que cria o nó já com o exemplo acima pré-preenchido para o usuário editar.
- Handler `onScheduleChange(id, items)` que atualiza `style.items` e salva em `imphq_company_map_annotations`.

Sem mudanças no banco.