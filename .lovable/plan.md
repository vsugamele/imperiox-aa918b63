## Contexto
A tela de chat do WhatsApp (`ChatView`) renderiza o componente `ConversationIntelCard` logo acima da lista de mensagens. Esse card contém duas seções empilhadas:
- **Handoff para humano** (box âmbar): resumo de handoff, dor, próxima ação, score e tempo.
- **Inteligência da conversa** (box secondary): intent, estado emocional, objeção, resumo e tags.

O usuário quer poder **minimizar esse bloco inteiro** para ganhar espaço visual no chat.

## O que será feito
1. Adicionar estado local `minimized` no `ConversationIntelCard`.
2. Incluir um botão de colapsar/expandir (Chevron) no topo do bloco, ao lado do título.
3. Quando minimizado:
   - Ocultar o conteúdo das duas seções.
   - Manter apenas uma linha compacta com: ícone de alerta, título "Handoff + Inteligência" e badges essenciais (score, intent, emoção) para não perder o contexto rápido.
4. Persistir a preferência de minimizado por conversa no `localStorage` (chave `imperiohq_intel_minimized`), para não ter que recolher toda vez que trocar de chat.

## Arquivos afetados
- `src/components/whatsapp/ConversationIntelCard.tsx` — adiciona estado, botão e layout colapsado.

## Fora de escopo
- Não alterar o conteúdo gerado pela IA.
- Não mexer no `LeadIntelPanel` lateral (o outro painel de inteligência).
- Não alterar schema/banco de dados.