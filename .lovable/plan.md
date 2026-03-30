

# Plano: 4 Correções e Melhorias

---

## 1. Bug Admin — Vinicius e Bruno não reconhecidos

**Causa raiz**: O banco armazena role como `"Admin"` (maiúsculo), mas o código compara com `"admin"` (minúsculo).

- Bruno está com `role: "Admin"` no banco
- Dashboard linha 197: `data?.role === "admin"` → falha
- Tarefas linha 152: `memberData?.role === "admin"` → falha

**Fix**: Usar `.toLowerCase()` em todas as comparações de role:
```ts
const r = (data?.role || "").toLowerCase();
setIsAdmin(r === "admin" || r === "owner");
```

**Arquivos**: `src/pages/Dashboard.tsx`, `src/pages/Tarefas.tsx`

---

## 2. Chat sem atualização em tempo real

**Causa raiz**: A subscription Realtime está configurada (INSERT/DELETE em `imphq_chat_messages`), mas a tabela pode não ter **REPLICA IDENTITY FULL** habilitado para o canal, ou o Realtime não está ativo para essa tabela no Supabase Dashboard.

Porém, como fallback mais robusto, o chat deveria também ter **polling incremental** (a cada 5s) para garantir que mensagens apareçam mesmo se o Realtime falhar. Além disso, após enviar, fazer refetch imediato.

**Fix**:
- Após `sendMessage()`, chamar `loadMessages()` imediatamente (fallback)
- Adicionar polling a cada 5s como backup do Realtime
- Verificar via migration se REPLICA IDENTITY FULL está configurado

**Arquivo**: `src/pages/Chat.tsx`

---

## 3. Calendário maior e com mais dados

**Problema**: O calendário é um widget pequeno (`w-fit`) com o componente Calendar padrão (cells de 36px). Só mostra dots de eventos, sem detalhes visuais.

**Melhorias**:
- Aumentar o tamanho do calendário para ocupar largura total em telas maiores
- Dentro de cada célula do dia, mostrar **contagem de eventos** e **tarefas com due_date**
- Layout: calendário no topo (full-width), lista de eventos embaixo
- Mostrar resumo do dia selecionado: tarefas + eventos + rotinas pendentes
- Adicionar cores diferentes por tipo de evento nas células

**Arquivo**: `src/pages/Tarefas.tsx` — refatorar a aba "calendar"

---

## 4. Notificações via WhatsApp + PWA por usuário

**Problema**: O `notify-scheduler` cria notificações no banco, mas não envia via WhatsApp nem push PWA. Notifica todos os usuários igualmente, sem considerar o responsável da tarefa.

**Melhorias**:
- Se o card tem `member_id`, notificar apenas o responsável (não todos)
- Adicionar envio via WhatsApp: buscar telefone do membro em `imphq_team_members`, chamar `whatsapp-api` para enviar a notificação
- Para PWA: o sistema já tem `Notification.permission` no `NotificationBell.tsx`. Expandir para que o `notify-scheduler` também grave um campo `channels: ['pwa', 'whatsapp']` para tracking

**Arquivo**: `supabase/functions/notify-scheduler/index.ts`

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/Dashboard.tsx` | Fix: `.toLowerCase()` na comparação de role |
| `src/pages/Tarefas.tsx` | Fix role + calendário maior com tarefas integradas |
| `src/pages/Chat.tsx` | Refetch após envio + polling backup de 5s |
| `supabase/functions/notify-scheduler/index.ts` | Notificar responsável, enviar via WhatsApp |
| SQL migration | Garantir REPLICA IDENTITY FULL em `imphq_chat_messages` |

