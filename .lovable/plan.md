## Diagrama de Sequências — 3 modos

Novo componente `CampaignSequenceDiagram.tsx` aberto via botão "Diagrama" no `CampaignStepEditor`, dentro de um `Dialog` largo (max-w-7xl, h-[85vh]). Reutiliza os `steps` já carregados — zero query nova.

### Estrutura do Dialog

- Header: título + `ToggleGroup` com 3 modos (Timeline · Fluxo · Calendário) + botão "Exportar PNG" (html-to-image)
- Body: `ScrollArea` com o modo selecionado
- Footer: legenda das cores (🟢 ok · 🟡 conflito mesmo horário · 🔴 gap >48h)

### Modo 1 — Timeline horizontal (default)

```text
 Sex 22/05 │ Sáb 23/05 │ Dom 24/05 │ Seg 25/05 │ ...
 ─────────┼──────────┼──────────┼──────────┼──
 [09:00]  │ [09:00]  │          │ [08:00]  │
 ▢ #1     │ ▢ #4     │          │ ▢ #12    │
 check-in │ aula 1   │          │ bonus    │
 [14:00]  │ [19:30]  │          │          │
 ▢ #2 …   │ ▢ #5 …   │          │          │
```

- Eixo X = dias agrupados (header sticky com `dia + data`)
- Cada coluna = `flex flex-col gap-2`, largura fixa 200px
- Card: `#order` + hora em mono + 60 chars de prévia + ícone `media_type`
- Linha vermelha tracejada vertical = "agora" se campanha ativa

### Modo 2 — Fluxo vertical (OpenFlow style)

```text
   ┌─────────────┐
   │ #1 · Sex 09h│
   │ check-in    │
   └──────┬──────┘
          │ ↓ 5h depois
   ┌──────┴──────┐
   │ #2 · Sex 14h│
   └──────┬──────┘
          │ ↓ próx dia 09:00
```

- Cards centralizados, conectados por linha SVG
- Label entre cards calculado: `Xh depois` ou `próx dia HH:MM`
- Click no card abre o editor inline

### Modo 3 — Calendário semanal

- Grid 7 colunas × 24 linhas (ou 6h–23h = 18)
- Cada step = dot colorido posicionado em `(day_offset % 7, send_time)`
- Hover no dot mostra popover com prévia completa
- Útil para ver densidade de horários e gaps

### Detecções visuais

Compartilhadas entre os modos, calculadas uma vez via `useMemo`:
- 🟡 mesmo `day_offset` + `send_time` que outro step
- 🔴 gap >48h entre steps consecutivos
- 🟢 step com `media_type !== 'text'` (marco visual)

### Arquivos

- `src/components/whatsapp/CampaignSequenceDiagram.tsx` (novo) — todos os 3 modos num só arquivo
- `src/components/whatsapp/CampaignStepEditor.tsx` (edit) — adicionar botão "Diagrama" (`Network` icon) e estado `showDiagram`
- `package.json` — adicionar `html-to-image` (~15kb) para o export PNG

### Fora de escopo

- Drag & drop para reordenar no diagrama (pode virar v2)
- Edição inline dentro do diagrama (abre o editor existente)
