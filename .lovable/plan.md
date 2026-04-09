
Objetivo: fazer o WhatsApp/Evolution realmente aparecer na interface depois que a instância conecta, envia ou recebe mensagem.

O que encontrei
- O provider Evolution está salvo no banco, então a configuração básica existe.
- Mesmo assim, hoje as tabelas que alimentam a UI estão vazias: `imphq_wa_conversations = 0` e `imphq_wa_messages = 0`.
- A edge function `whatsapp-api` tenta salvar em `imphq_wa_messages` campos que não existem hoje nessa tabela (`project_id`, `direction`, `phone`, `provider`, `status`).
- Além disso, ela não checa erro após esses inserts. Então pode até mandar para a Evolution, mas falhar ao persistir no banco sem deixar isso claro na tela.
- O front depende justamente desses registros para mostrar conversas e histórico. Sem persistência, “não aparece nada”.
- Há também uma confusão de UX: conectar a instância da Evolution não cria automaticamente uma conversa. A aba atual mistura “instância conectada” com “conversas CRM”.
- O fluxo do Hub Local está vivo (`wa_hub_iso_*` com atividade), mas ele é separado do fluxo Evolution/Twilio.

Plano de correção
1. Normalizar a persistência do WhatsApp
- Criar migration para alinhar `imphq_wa_messages` ao uso real do app, adicionando os campos que o sistema já usa na UI e na function.
- Garantir políticas/RLS adequadas para `imphq_wa_conversations` e `imphq_wa_messages`, porque têm telefone e conteúdo de mensagem.

2. Corrigir a edge function `whatsapp-api`
- Antes de salvar uma mensagem, localizar ou criar uma conversa em `imphq_wa_conversations`.
- Usar sempre `conversation_id` UUID real da conversa, nunca telefone direto nesse campo.
- Atualizar `last_message`, `last_message_at` e `message_count` da conversa em envios e recebimentos.
- Validar e propagar erro de insert/update; se a Evolution aceitar o envio mas o banco falhar, a UI deve mostrar erro real.

3. Corrigir o front da página WhatsApp
- Ajustar `ChatView` para buscar por `conversation_id` real, sem fallback inconsistente por telefone.
- Atualizar o fluxo da aba “Sessões” para refletir “Conversas”.
- Melhorar o empty state: “instância conectada, mas ainda sem conversas”.
- Recarregar automaticamente a conversa após envio bem-sucedido.

4. Separar melhor instância vs conversa
- Exibir o status do provider/instância de forma mais clara no topo da página, mesmo quando não há nenhuma conversa ainda.
- Isso evita a sensação de que “não apareceu nada” quando, na prática, a instância conectou mas não houve persistência ou conversa criada.

5. Higiene de dados
- Tratar duplicidade de providers ativos do mesmo projeto/instância para o app não pegar um registro errado.
- Preferir `provider_id` salvo na conversa em vez de “primeiro provider do projeto”.

Validação
1. Configurar/abrir a instância Evolution.
2. Enviar uma mensagem teste.
3. Confirmar:
- conversa criada em `imphq_wa_conversations`
- mensagem criada em `imphq_wa_messages`
- card aparece na tela
- chat abre com histórico
4. Testar resposta recebida via webhook e verificar atualização da mesma conversa.

Arquivos envolvidos
- `supabase/functions/whatsapp-api/index.ts`
- `src/pages/WhatsAppPage.tsx`
- `src/components/whatsapp/ChatView.tsx`
- `supabase/migrations/*` (ajuste de schema/RLS)

Detalhe técnico importante
O principal bug hoje não parece ser “a Evolution não conecta”; parece ser “o app não persiste nem lê corretamente os dados do WhatsApp”. Ou seja: mesmo que a instância esteja ok, a tela continua vazia porque o modelo de dados da function e o schema real do banco estão desencontrados.
