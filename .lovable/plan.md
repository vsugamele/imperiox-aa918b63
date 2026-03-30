

# Plano: PWA Instalável + Notificações Push Automáticas

## Resumo

Tornar o Imperio X instalável como app (PWA sem service worker — apenas manifest) e expandir o sistema de notificações para cobrir automaticamente: tarefas pendentes/atrasadas, novas tarefas criadas, rotinas diárias não completadas, vendas e leads.

---

## 1. PWA — App Instalável (sem service worker)

Como o app roda em preview iframe do Lovable, usar a abordagem simples: apenas `manifest.json` + meta tags. Sem `vite-plugin-pwa` nem service worker.

**Arquivos**:

- `public/manifest.json` — criar com `name: "Imperio X"`, `short_name: "ImperioX"`, `display: "standalone"`, `theme_color`, `background_color`, ícones (192x192, 512x512)
- `index.html` — adicionar `<link rel="manifest" href="/manifest.json">`, meta tags para mobile (`apple-mobile-web-app-capable`, `theme-color`)
- `public/icon-192.png` e `public/icon-512.png` — ícones PWA (placeholder SVG convertido ou ícone genérico)

**Resultado**: O app fica instalável via "Add to Home Screen" no mobile e desktop, sem problemas de cache no preview.

---

## 2. Notificações Push via Browser (expandir NotificationBell)

O `NotificationBell.tsx` já pede permissão de notificação do browser e envia push quando recebe INSERT via Realtime. O que falta é **gerar as notificações automaticamente** no backend.

---

## 3. Edge Function `notify-scheduler` — Notificações automáticas

Criar uma edge function que roda via `pg_cron` (a cada 30 min) e gera notificações em `imphq_notifications`:

| Tipo | Condição | Mensagem |
|---|---|---|
| `tarefa` | Cards com `due_date` = hoje e status != done | "Tarefa X vence hoje" |
| `tarefa` | Cards com `due_date` < hoje e status != done | "Tarefa X está atrasada!" |
| `tarefa` | Card criado nos últimos 30min (por outro user) | "Nova tarefa: X" |
| `rotina` | Rotinas do dia sem check até 18h | "Rotina X ainda não foi completada" |
| `venda` | Novo lead com `status = 'aprovado'` nos últimos 30min | "Nova venda: R$ X" |
| `lead` | Novo lead capturado nos últimos 30min | "Novo lead: Nome" |

A function consulta as tabelas relevantes, verifica o que já foi notificado (evita duplicatas via `entity_type + entity_id + type`), e insere em `imphq_notifications`. O Realtime já cuida de entregar ao browser.

**Arquivo**: `supabase/functions/notify-scheduler/index.ts`

**Cron**: Registrar via SQL insert (`cron.schedule`) para rodar a cada 30 minutos.

---

## 4. Notificação instantânea ao criar tarefa

No `KanbanPage.tsx` e `Tarefas.tsx`, após inserir um card com sucesso, inserir também uma notificação em `imphq_notifications` para os membros do time (exceto o criador):

```
type: "tarefa", title: "Nova tarefa: {titulo}", entity_type: "card", entity_id: card.id
```

Isso garante notificação instantânea sem esperar o cron.

**Arquivos**: `src/pages/KanbanPage.tsx`, `src/pages/Tarefas.tsx`

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `public/manifest.json` | Criar — manifest PWA |
| `index.html` | Meta tags PWA + link manifest |
| `supabase/functions/notify-scheduler/index.ts` | Criar — cron de notificações automáticas |
| `src/pages/KanbanPage.tsx` | Notificação instantânea ao criar card |
| `src/pages/Tarefas.tsx` | Notificação instantânea ao criar tarefa |
| SQL (insert, não migration) | Registrar cron job via `cron.schedule` |

