# Guia de Tabelas do Banco de Dados (Imperio HQ)

Este guia documenta as principais tabelas relacionais do sistema **Imperio HQ**, identificadas pelo prefixo `imphq_`. Elas dão suporte aos variados módulos do painel, desde a gestão de tarefas e automações até análise de inteligência de mercado e CRM.

## 1. Núcleo e Projetos
* **`imphq_projects`**: Armazena os diferentes projetos e produtos que estão sendo gerenciados. A maioria das outras tabelas possui uma chave estrangeira (`project_id`) apontando para esta, garantindo a separação de dados por projeto.
* **`imphq_team_members`**: Cadastros dos membros da equipe, incluindo nome, avatar e função. Utilizada na delegação de tarefas e organização ágil.

## 2. Tarefas e Kanban (Ágil)
* **`imphq_tasks`**: Registra as tarefas avulsas (to-do list), com data de entrega, status e responsável.
* **`imphq_kanban_columns`**: Representa os estágios/fases (colunas) dos quadros no estilo Kanban (ex: A Fazer, Em Progresso, Concluído).
* **`imphq_kanban_cards`**: Cartões do Kanban. Permitem acompanhamento visual das atividades e podem estar vinculados a membros e projetos.

## 3. Tracker e Analytics (Rastreamento)
* **`imphq_tracking_links`**: Links de rastreamento gerados para campanhas, com parametrização UTMs e origem (Orgânico, Ads, etc).
* **`imphq_clicks`**: Tabela de log que registra cada clique efetuado nos links de rastreamento (contém IP, User Agent, geolocalização).
* **`imphq_vendas`**: Registra as conversões e vendas atreladas ao rastreamento, para cálculo de ROI e performance.
* **`imphq_events`**: Grava eventos analíticos unificados da navegação e interação dos leads (ex: visitas a páginas, cliques em botões específicos).

## 4. OpenFlow (Automações e Integrações)
* **`imphq_automacoes`**: Representa fluxos e automações cadastradas (integrações com ferramentas como n8n, Make, Zapier).
* **`imphq_webhooks`**: Histórico/Logs das conexões de Webhooks que entram e saem do sistema, útil para debugar os fluxos.

## 5. CRM e Atendimento
* **`imphq_leads`**: Gestão da base de contatos (CRM). Armazena dados dos leads capturados, estágio no funil e informações de vendas.
* **`imphq_wa_conversations`**: Dados e métricas sobre conversas realizadas no WhatsApp.

## 6. Mentes IA (Inteligência Artificial)
* **`imphq_ai_chats`**: Histórico de sessões de chat com os agentes especialistas de Inteligência Artificial.
* **`imphq_kb`**: Base de Conhecimento (*Knowledge Base*), armazenando diretrizes, documentos e textos que instruem as respostas das IAs.
* **`imphq_skills`**: Biblioteca de habilidades (Skills) específicas que podem ser atribuídas tanto aos agentes de IA quanto estruturadas para o time.

## 7. Market Intel e Competidores
* **`imphq_mi_opportunities`**: Tabela essencial na curadoria de oportunidades. Cruza nichos, dores de mercado, ângulos de copy e sugestões de estrutura de funil.
* **`imphq_competitors`**: Cadastro e análise aprimorada dos concorrentes de cada projeto.

## 8. Conteúdo e Referências
* **`imphq_referencias`**: Biblioteca estruturada de links, criativos e ideias de inspiração (Swipe File do usuário).
* **`imphq_content_library`**: Repositório (biblioteca) onde são guardados arquivos pesados, assets, imagens e documentos dos projetos.
* **`imphq_calendar_events`**: Eventos agendados no calendário do painel (como vistorias, publicações ou reuniões), associados aos projetos.

---

> [!TIP]
> Caso queira a partir de agora trabalhar na estrutura ou criar novas tabelas a partir do Supabase para novas páginas que estão no roadmap, possuímos um histórico completo de migrações (`supabase/migrations`) para garantir a consistência do modelo de dados em todos os ambientes!
