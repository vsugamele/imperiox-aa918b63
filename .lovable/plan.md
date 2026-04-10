

# Plano: Melhorar UX/CX do Módulo WhatsApp

## Problemas de experiência identificados

1. **Página monolítica (690 linhas)** — difícil de manter, componentes inline misturados
2. **Sem feedback visual de loading** na tela inicial (dados carregam silenciosamente)
3. **Chat fixo em 500px** — não aproveita o espaço da tela, parece "preso"
4. **Sem busca** nas sessões — usuário com muitos contatos não consegue filtrar
5. **Lista de sessões como cards 3 colunas** — ineficiente para volume; layout de chat apps usa lista lateral + chat aberto
6. **Navegação destrutiva** — ao clicar numa sessão, toda a listagem desaparece (volta com botão "← Voltar"), perdendo contexto
7. **Empty states fracos** — textos genéricos sem call-to-action claro
8. **Console error: ref no ChatView** — React avisa "Function components cannot be given refs"
9. **Sem indicação de última mensagem** nos cards de sessão — o usuário não sabe qual conversa tem atividade recente
10. **Aba Hub Local confusa** — carrega 500 mensagens brutas no mount, conceito paralelo ao Evolution sem clareza

## Mudanças propostas

### 1. Layout split-panel (estilo WhatsApp Web)
Trocar a navegação destrutiva por um layout de 2 painéis:
- **Esquerda**: lista de conversas com busca, filtro por projeto, último trecho de mensagem e horário
- **Direita**: chat aberto da conversa selecionada, ocupando altura total

Isso elimina o "← Voltar" e dá contexto constante ao usuário.

### 2. Barra de busca nas sessões
Input de busca que filtra por nome do contato ou telefone em tempo real.

### 3. Chat responsivo (altura dinâmica)
Substituir `h-[500px]` por `h-[calc(100vh-200px)]` para preencher o viewport.

### 4. Preview da última mensagem nos cards
Na lista lateral, exibir o trecho da última mensagem e o horário relativo ("há 5 min"), similar ao WhatsApp real.

### 5. Loading skeleton na carga inicial
Skeleton cards enquanto os dados carregam, evitando tela vazia.

### 6. Empty states com ação
- Sem sessões: ilustração + botão "Criar primeira sessão"
- Sem provider: passo-a-passo rápido com botão "Configurar"
- Chat vazio: "Envie a primeira mensagem abaixo"

### 7. Fix ref warning no ChatView
Adicionar `React.forwardRef` no ChatView para eliminar o console error.

### 8. Simplificar Hub Local
Renomear para "Hub Local (Beta)" com tooltip explicando a diferença, e reduzir o limit de 500 para 100 mensagens.

### 9. Optimistic UI no envio
Ao enviar mensagem, inserir imediatamente um bubble local com status "enviando..." antes de confirmar com a API.

### 10. Refatorar página em componentes menores
Extrair: `ConversationList`, `EvolutionStatusCard` (já existe), `TemplateManager`, `SessionDetailView` — arquivo principal fica com ~100 linhas.

## Arquivos envolvidos

| Arquivo | Mudança |
|---|---|
| `src/pages/WhatsAppPage.tsx` | Refatorar para layout split-panel, busca, skeletons, empty states |
| `src/components/whatsapp/ChatView.tsx` | forwardRef, altura dinâmica, optimistic UI |
| `src/components/whatsapp/ConversationList.tsx` | **Novo** — lista lateral com busca e preview |
| `src/components/whatsapp/TemplateManager.tsx` | **Novo** — extrair lógica de templates |
| `src/components/whatsapp/SessionDetailView.tsx` | **Novo** — extrair view de detalhe/info |

## Resultado esperado
Interface que se parece com WhatsApp Web: lista à esquerda, chat à direita, busca rápida, feedback visual constante, zero navegação destrutiva.

