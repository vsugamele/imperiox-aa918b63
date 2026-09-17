# LinfaFlow Care: do quiz direto para o chat do médico

Duas correções na sala do Care (`/care` e preview em `/funis/...`):

## 1. Depois do quiz, cair direto no chat

Hoje, ao terminar o quiz, o lead vê uma tela intermediária "Putting your answers together" travada por 2,4s antes do chat abrir.

Mudança: ao concluir o quiz, abrir imediatamente o chat com o médico. O resumo do que ele respondeu deixa de ser uma tela e passa a ser:
- a primeira bolha do assistente (saudação + o que ele leu do quiz, já existente em `startQueue`);
- seguida da primeira pergunta aberta, com o campo de resposta já focado.

O indicador de "preparando" fica apenas como um "digitando..." curto (≈800 ms) dentro do próprio chat, sem trocar de tela.

## 2. Separar o que é instrução para você do que o lead vê

Vários textos escritos para o operador estão aparecendo no ambiente do lead, o que gera a sensação de confusão:

Sai da tela do lead (vai para o painel lateral, só visível no preview admin):
- Helpers estratégicos do quiz: "This is where the conversation becomes personal enough to sell later", "Repeated patterns convert differently from a one-off bad day", "This lets the assistant position LinfaFlow against outside-in fixes".
- Bloco "Private review / Your answers are shaping a more personal conversation" com linguagem de sistema.
- Cabeçalho do chat "Lead web experience" e o rótulo de estágio operacional → passa a mostrar o nome/assinatura do atendimento ("Private consultation").
- Cards "Private wellness assessment" (6 etapas) e "Why this feels personal" — material de venda/briefing, não da conversa.

Fica na tela do lead, reescrito em linguagem de paciente:
- Pergunta, opções, campo de texto, progresso.
- Foto/áudio opcional e consentimento.
- Aviso de compliance no rodapé ("not a medical diagnosis").

Todo o painel operacional (Fit score, temperatura, OpenFlow stage, guardrails, textos em PT-BR, Supabase/session) continua existindo, mas só sob `isAdminPreview`, agrupado em uma aba "Operação" para não se misturar visualmente com a conversa.

## Detalhes técnicos

- `src/pages/LinfaFlowCareRoom.tsx`
  - `completeQuiz()`: remover o estado `preparing` do caminho do lead; ir para `chat` + `startQueue()` e mostrar `isAiThinking` por ~800 ms.
  - `CareView`: `"preparing"` deixa de ser usado no fluxo do lead (mantido só se o preview admin quiser inspecionar).
  - Mover strings operacionais de `quizQuestions.helper` / `quizCompanions` para constantes de briefing usadas apenas nos painéis admin; substituir por helpers de paciente.
  - Envolver os blocos `assessmentSteps` / `proofPoints` / header "Lead web experience" na condição admin.
- Nenhuma mudança de schema, Edge Function ou tracking: `trackQuizProgress`, `persistStage` e voz continuam iguais.
