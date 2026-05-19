## Plano

Integrar o Chat (`/chat`) como uma aba dentro de `/tarefas`, removendo o item duplicado do sidebar.

### Mudanças

1. **`src/pages/Tarefas.tsx`**
   - Adicionar nova `<TabsTrigger value="chat">` (ícone `MessageSquare`, label "Chat") na `TabsList` existente (linha 775).
   - Adicionar `<TabsContent value="chat">` renderizando `<Chat />` importado de `./Chat`.

2. **`src/components/AppSidebar.tsx`**
   - Remover o item "Chat" (linha 25) — fica acessível via Tarefas > Chat.

3. **`src/App.tsx`**
   - Manter rota `/chat` apontando para `<Chat />` (compatibilidade com links antigos) **ou** redirecionar `/chat` → `/tarefas?tab=chat`. Sugiro manter a rota direta para não quebrar links existentes.

### Detalhes técnicos
- O `Chat.tsx` usa `h-[calc(100vh-4rem)]` no container raiz; dentro da aba isso pode causar overflow. Envolver em wrapper com altura controlada (ex.: `h-[calc(100vh-12rem)]`) apenas quando renderizado dentro de Tarefas, ou ajustar o componente para aceitar prop opcional `heightClass`.
- Nenhuma mudança em lógica de chat, comandos ou Realtime.

### Fora de escopo
- Refator visual do Chat.
- Mudanças no schema ou edge functions.