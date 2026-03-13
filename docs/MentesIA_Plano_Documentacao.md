# Guia de Implementação: Mentes Sintéticas (Mentes IA) no Império HQ

## 1. Visão Geral (Objetivo)
O objetivo das "Mentes Sintéticas" (ou Mentes IA) dentro do Império HQ é criar um ecossistema de agentes especialistas baseados em Inteligência Artificial. Diferente de um "ChatGPT genérico", cada Mente atua como um colaborador virtual da equipe, possuindo um contexto bem definido (briefing do projeto, persona/avatar), conhecimentos específicos (Knowledge Base) e ferramentas próprias (Skills).

Este documento detalha o planejamento de UX/UI, Arquitetura de Dados e Lógica de Integração necessários para construir essa funcionalidade produtivamente.

---

## 2. Arquitetura de Dados (Database Schema)

Para suportar as Mentes Sintéticas, utilizamos e expandimos tabelas com o prefixo `imphq_`.

### 2.1. Entidades Principais
* **`imphq_ai_chats` (Sessões/Conversas):**
  * `id` (UUID): ID da conversa.
  * `title` (Text): Nome gerado automaticamente baseado no primeiro prompt.
  * `project_id` (UUID - Nulo): Qual projeto esta conversa está atendendo.
  * `agent_id` (UUID - Nulo): Caso a mente seja customizada.
  * `settings` (JSONB): Guarda o contexto injetado (quais KB secs e skills foram ativadas no momento).
* **`imphq_kb` (Knowledge Base - Base de Conhecimento):**
  * `id` (UUID).
  * `section_key` (Text): Ex: `identidade_marca`, `regras_copy`.
  * `title` (Text): Nome legível.
  * `content` (Text): O texto base que ensina a IA como a empresa atua.
  * `project_id` (UUID): (Opcional) KB específica de um projeto.
* **`imphq_skills` (Habilidades / Ferramentas):**
  * `id` (UUID).
  * `nome` (Text): Ex: "Gerar UTMs", "Pesquisar no YouTube", "Ligar para Lead".
  * `categoria` (Text): Automação, Dados, IA, Código.
  * `endpoint_url` (Text): O webhook/API que esta skill aciona no back-end (n8n, Make).

### 2.2. O "System Prompt" Dinâmico (Magia do Contexto)
Em vez de depender de IAs de terceiros guardando contexto, o painel do Império HQ constrói um **System Prompt Dinâmico** que é injetado invisivelmente no início de cada conversa.
O processo de construção do contexto (conforme visto na estrutura inicial) une:
1. **Papel Geral** ("Você é um agente do Império Digital...").
2. **Briefing do Projeto** (Injetado via `imphq_projects`).
3. **Avatar/Persona** (Injetado via `imphq_projects.avatar`).
4. **Skills Ativas** (Dizendo para a IA "Você tem capacidade de chamar as funções X e Y").
5. **Knowledge Base Ativa** (Injetando as regras de copyrighting ou tom de voz da marca `imphq_kb`).

---

## 3. As Mentes Mapeadas e as Skills Incluídas

Após uma análise profunda nos arquivos legados (`imperio-hq-v5` e nos guias "Como criar clones de metodologias"), mapeamos a engenharia exata dos Agentes:

### 3.1. As 8 Mentes Básicas (Clones Cognitivos)
O front-end (`Mentes.tsx`) replicará o "Modal de Raio-X Cognitivo" presente na v5. Cada mente possui dezenas de painéis (DNA, Heurísticas, Valores e Prompt Original) extraídos dos guias:
1. **Dan Kennedy:** The Ultimate Sales Letter, Zero BS Marketing.
2. **Gary Halbert:** Story First copy e Boron Letters.
3. **Eugene Schwartz:** Os 5 Estágios de Consciência de *Breakthrough Advertising*.
4. **Gary Bencivenga:** Marketing baseado em Evidência e Prova Irrefutável.
5. **Alex Hormozi:** Value Stack e arquitetura de Ofertas Incomuns ($100M Offers).
6. **John Carlton:** Ângulos Contraintuitivos e Street-Smart copy.
7. **Joe Sugarman:** Slippery Slide e construção de Mecanismo Único.
8. **Thiago Finch:** Dados, ROI-driven marketing para Brasil.

### 3.2. As 25 Skills (Engines Autônomos em Markdown)
Em vez de depender apenas de configurações básicas de "API", a Império HQ possui **25 arquivos Markdown hiper-detalhados** (ex: *Avatar Architect - The God-Mode Engine*, *Funnel Hacker Supremo*, *Devastador V4*). 

**Estratégia de Integração das Skills:**
O conteúdo monumental desses markdowns deve ser ingerido na tabela `imphq_skills`, no campo `system_prompt` ou guardados na `imphq_kb` como "Tomo de Onisciência". Quando a Mente IA invoca a habilidade no React (ex: "Acabar Escavador de Desejos"), o backend envia este mega-prompt (Skill) junto com as traits do especialista (Mente) via RAG ou *Context Injection*.

---

## 4. Lógica de Integração e "O Cérebro" (Back-end)

A interface React (`Mentes.tsx`) atua apenas como cliente interativo. A lógica real ("o cérebro") precisa rodar em um Edge Function do Supabase ou via n8n.

### Passo a Passo da Comunicação:
1. **O Usuário Digita:** "Escreva um e-mail de carrinho abandonado para o projeto Alpha".
2. **Construção do Payload no Frontend:**
   O frontend anexa ao array de mensagens o **System Prompt de Contexto** (gerado pelas seleções do painel lateral) + o **Histórico** + a **Nova Mensagem**.
3. **Envio para Edge Function (Supabase):**
   O array é enviado para a rota `/functions/v1/chat-minds`.
4. **Resolução LLM (OpenAI / Anthropic):**
   A rota no Supabase chama a API da OpenAI (GPT-4o) ou Anthropic (Claude 3.5), passando o array e listando os "Tools" (Functions Calling) baseados nas `imphq_skills` ativas.
5. **A IA Decide:**
   * Se a resposta for textual pura (ex: escrevendo o email), ela retorna a string.
   * Se a IA notar que precisa buscar dados do Meta Ads (via skill ativada), ela chama a Tool (que o back-end executa em background através do OpenFlow/Webhooks) antes de devolver a resposta final.
6. **Retorno em Fluxo (Streaming):**
   A resposta é transmitida via `text/event-stream` direto para a UI, dando sensação de rapidez aos usuários. Ao finalizar, grava-se o array no banco em `imphq_ai_chats_messages` (tabela dependente).

---

## 4. UI / UX Design Plan

Para refletir a estética "Premium Glassmorphism" e o estilo técnico-sofisticado do Império HQ, a UI das Mentes será dividida em:

### A. Painel Lateral (Configurador da Mente) - Lado Esquerdo
* **Design:** Um painel retrátil estilo "Command Center". Utiliza fundos `/secondary/50` translúcidos com bordas leves.
* **Componentes:**
  * **Seletor de Projeto:** Um `<Select>` limpo para ancorar a IA a um contexto de produto/produto digital.
  * **Checks da Knowledge Base:** Estilo "Toggle buttons" ou `<Checkbox>` modernos para ativar "Tom de Marca", "Regras Técnicas", etc.
  * **Rack de Skills:** Estilizado como "plugins" ligáveis. Ícones pequenos do lado (ex: um ícone de planilha para Google Sheets). Conta com "Badges" indicando ativo/beta.
* **UX Feedback:** Um botão "Atualizar Cérebro / Carregar Contexto" que exibe uma mensagem toast confirmando que "O Sistema Neural foi atualizado com X mil caracteres de contexto".

### B. Área de Chat (O Executor) - Lado Direito / Centro
* **Design:** Foco na legibilidade e amplitude. O chat preenche a maior parte da tela.
* **Balões de Mensagem:**
  * **Usuário:** Fundo da marca (`bg-primary`), cantos arredondados, texto clean.
  * **Mente Sintética (IA):** Fundo cinza escuro translúcido (`bg-secondary`), tipografia moderna. Suporte nativo a Markdown (tabelas, listas, blocos de código).
* **Indicadores Visuais:**
  * Quando a IA estiver processando ou usando uma Skill, exibir um loader interativo (ex: "⚙️ Executando Meta Ads API...").
* **Inputs:** Caixa de texto elástica (cresce conforme digita) com ícone enviar sutil. Atalhos de teclado (Enter para enviar, Shift+Enter para quebrar linha).

### C. Gestão e Dashboard de KBs
* Deve existir uma aba secundária dentro da página (ou modal) para alimentar a base `imphq_kb` de forma estruturada, com Markdown editors simples, mantendo os ativos de conhecimento organizados e prontos para serem anexados às Mentes.

---

## 5. Próximos Passos de Implementação (Roadmap)

1. **[Back-end]** Criar o Edge Function `chat-minds` no Supabase com suporte a stream e chamada para a LLM principal (ex: GPT-4).
2. **[Database]** Criar tabela derivada `imphq_ai_chat_messages` para gravar a timeline da conversa vinculada a `imphq_ai_chats`.
3. **[Frontend]** Refinar a página atual `Mentes.tsx` para ligar o array de `messages` à Edge Function e processar a resposta _streamada_.
4. **[Integração]** Configurar o "Function Calling" interligando os registros de `imphq_skills` aos fluxos criados no `imphq_automacoes` (OpenFlow).
