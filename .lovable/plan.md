

# Plano: Fotos de Contato + Navegação Multi-Número

## Situação Atual

1. **Fotos**: Não são buscadas. O avatar na lista é um ícone genérico (`MessageSquare`). A Evolution API oferece o endpoint `/chat/fetchProfilePictureUrl/{instance}` que retorna a URL da foto do contato.

2. **Multi-número**: O sistema vincula provider a `project_id` (`getProvider(projectId)`). Se houver 2 providers (2 números/instâncias), cada um em um projeto diferente, funciona — mas se o usuário filtrar "Todos os Projetos", as conversas misturam sem indicação visual de qual número está sendo usado.

## Mudanças

### 1. Puxar fotos de contato da Evolution API
- **Edge Function**: Adicionar action `fetch_profile_pic` que chama `/chat/fetchProfilePictureUrl/{instance}` passando o número do contato
- **Tabela**: Adicionar coluna `avatar_url` em `imphq_wa_conversations` para cachear a URL (evita chamadas repetidas)
- **Sync**: No `sync_contacts`, buscar a foto de cada contato em lote e salvar
- **Frontend**: No `ConversationList`, trocar o ícone `MessageSquare` por um `Avatar` com a foto (fallback = iniciais do nome)

### 2. Indicação visual de qual número/instância
- No `ConversationList`, exibir um badge pequeno com o nome da instância ou os últimos 4 dígitos do número vinculado ao provider
- No header do `ChatView`, mostrar "Enviando via: +55...1234 (JP Freitas)"

### 3. Navegação fluida entre conversas de diferentes providers
- O `selectedSession` já carrega `provider_id`, e o `ChatView` recebe `providerId` — isso já funciona
- Garantir que ao trocar de conversa entre projetos/providers diferentes, o chat limpa corretamente (já faz via `useEffect` no `conversationId`)
- Nenhuma mudança estrutural necessária aqui, apenas testes

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-api/index.ts` | Nova action `fetch_profile_pic` + salvar avatar no sync |
| `supabase/migrations/*` | Adicionar coluna `avatar_url` em `imphq_wa_conversations` |
| `src/components/whatsapp/ConversationList.tsx` | Avatar com foto real + badge do provider |
| `src/components/whatsapp/ChatView.tsx` | Header com indicação do número remetente |
| `src/pages/WhatsAppPage.tsx` | Passar dados do provider ao ConversationList |

## Resultado
Lista de conversas com fotos reais dos contatos, indicação clara de qual número está enviando, e navegação sem problemas entre conversas de instâncias diferentes.

