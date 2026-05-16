## Problema

Na lista de Conversas, a instância (sessão conectada) aparece como um badge cinza minúsculo de 8px no rodapé do item, ao lado do nome do projeto. Resultado: visualmente é impossível bater o olho e saber se aquela conversa pertence à `JP Freitas` ou à `jpfreitas`.

## Solução

Três melhorias em `ConversationList.tsx` (UI apenas, sem mexer em backend/queries):

### 1. Bolinha colorida por instância no avatar
Gerar uma cor estável a partir do `provider_id` (hash → HSL) e renderizar um **dot** de 10px no canto inferior direito do Avatar. Cada instância vira reconhecível na hora.

### 2. Badge da instância mais visível
Mover o badge da instância para a **linha do nome do contato** (à direita do nome, antes do timestamp), com a mesma cor da bolinha (fundo `bg-{cor}/15` + borda `border-{cor}/40`). Manter o nome do projeto na linha de baixo.

### 3. Filtro por instância
Adicionar um segundo `<Select>` no header da lista, abaixo do filtro de projeto:
- "Todas as instâncias" (default)
- Uma opção por provider conectado (`instance_name` ou `Twilio ...XXXX`)

Combina com o filtro de projeto via AND.

### Detalhes técnicos
- Função `providerColor(providerId: string)`: hash simples → `hsl(${h}, 65%, 55%)`.
- Adicionar prop `filterProvider: string` + `onFilterProvider` em `Props`; estado controlado no `WhatsAppPage.tsx`.
- Filtro: `(filterProvider === "all" || s.provider_id === filterProvider)`.
- Lista de providers já chega via prop `providers` — só usar.

### Fora de escopo
- Não mexer em ordenação, polling, fetch de mensagens ou no painel direito.
- Não criar nova tabela nem alterar schema.
