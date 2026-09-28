# 🏛️ IMPÉRIO HQ — Manual de Operação e Diretrizes de IA (OPERACAO.md)

> **Documento Canônico de Alinhamento Operacional**  
> Destinado aos sócios (Vinicius & Bruno) e a todos os agentes autônomos de IA (Antigravity, Claude Code, Cursor, Codex).

---

## 1. Sócios & Hierarquia de Decisão

* **Vinicius Sugamele** (`vsugamele@gmail.com`):
  * Responsável por: Estratégia de Copy, Arquitetura Técnica, Engenharia de IA, Automações e Infraestrutura.
* **Bruno - Macete Mental**:
  * Responsável por: Gestão de Negócio, Operações Comerciais, Parcerias e Escala.
* **Canal Oficial de Alertas e Decisões:**
  * **Grupo WhatsApp:** `Imperio X`
  * **JID do Grupo:** `120363409438175766@g.us`
  * **Bots Administradores:** `Suporte JP` (`jpfreitas`) e `Suporte JP Freitas` (`suportejpoficial`).
  * **Rotinas Ativas:** Briefing Matinal diário às 09:00 BRT e Alerta Crítico instantâneo se chip de WhatsApp desconectar.

---

## 2. Ecossistema de Projetos & Produtos

### 2.1. Projeto JP Freitas (`jp_freitas`)
* **Nicho:** Cabelos cacheados, crespos e ondulados / Cabeleireiras e Profissionais da Beleza.
* **Expert:** JP Freitas (+20 anos de experiência, +3.000 alunas formadas, salão próprio em SP).
* **Esteira de Produtos:**
  1. **Front-End (Carro-Chefe):** *O Código dos Cortes Perfeitos* (R$ 47,00)
     * LP / VSL Ativa: [https://codigodoscortesperfeitos.vercel.app](https://codigodoscortesperfeitos.vercel.app) (espelhos: [codigo-dos-cortes.vercel.app](https://codigo-dos-cortes.vercel.app/), [jpfreitas.com.br](https://jpfreitas.com.br/))
     * Order Bump de Impulso: *Finalização Express* (R$ 27,00)
  2. **Core / Formação:** *JP Hair Education* (R$ 797,00 na Ticto)
     * URL de Venda: [https://www.jphaireducation.com/promocao](https://www.jphaireducation.com/promocao)
  3. **High-Ticket / Mentoria:** *Mentoria de Negócios para Salões* (R$ 4.000,00)
     * URL: [https://www.jphaireducation.com/mentoria](https://www.jphaireducation.com/mentoria)
  4. **Presencial & Salão Físico:** *Master Cuts* (Imersão presencial SP) e Agendamentos no salão:
     * Agenda: [https://jpfreitas.com.br/agenda](https://jpfreitas.com.br/agenda)
* **Atendimento WhatsApp:**
  * Instância Primária: `jpfreitas` (`Suporte Cursos` · `5521974279264`)
  * Modo de IA: **100% Autônomo** (full autonomy ativo, sem transbordo humano desnecessário).

---

### 2.2. Projeto LinfaFlow (`linfaflow`)
* **Nicho:** DTC Saúde & Estética / Drenagem Linfática Líquida / Combate ao Inchaço e Retenção.
* **Modelo:** DTC Físico (Potes/Frascos líquidos).
* **Rotas e Funis do Projeto:**
  * Funil X1 Conversacional: `/funis/linfaflow-x1-ready`
  * LinfaFlow Care Room (IA de Escuta e Empatia): `/funis/linfaflow-care`
  * Dashboard de Conversão Care: `/funis/linfaflow-care-dashboard`
* **Regra de Navegação:**
  * Os funis do LinfaFlow são acessíveis **exclusivamente dentro do escopo do projeto LinfaFlow** (não devem ser colocados no menu lateral global `AppSidebar`).

---

### 2.3. Projeto SlimSoda (`slimsoda`)
* **Nicho:** DTC E-commerce / Suplemento em pó/efervescente / Whop.
* **Modelo:** Kits de 2, 4 e 6 frascos com comissão e tracking integrado.

---

## 3. Infraestrutura & APIs

### 3.1. Supabase (Backend Central)
* **Project Ref:** `tkbivipqiewkfnhktmqq`
* **URL:** `https://tkbivipqiewkfnhktmqq.supabase.co`
* **Tabelas Centrais:**
  * Provedores de WhatsApp: `imphq_wa_providers` *(ATENÇÃO: nunca usar a tabela inexistente `imphq_whatsapp_config`; há uma view de compatibilidade criada, mas a tabela oficial é `imphq_wa_providers`)*.
  * Leads & CRM: `imphq_leads`
  * Vendas & Checkouts: `imphq_vendas`
  * Feed de Decisões de IA: `imphq_ai_actions`
  * Mapas Operacionais: `imphq_company_maps` e `imphq_company_map_nodes`
  * Preferências de Alerta: `imphq_notification_preferences`

### 3.2. Evolution API (Motor WhatsApp)
* **Base URL:** `https://darkadvanced-evolution-api.llxtug.easypanel.host/`
* **Instância Conectada:** `jpfreitas`
* **API Key:** `B500C35BE341-4CCB-B108-34384641D7D7`
* **Endpoint de Envio:** `POST /message/sendText/{instance}` com payload:
  ```json
  {
    "number": "5511999999999", // ou JID de grupo: "120363409438175766@g.us"
    "text": "Mensagem aqui"
  }
  ```

### 3.3. Servidor MCP de Gestão (`project-mcp`)
* **Endpoint:** `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/project-mcp`
* **Tools Disponíveis para IAs (Codex, Cursor, Claude):**
  * `get_company_flow`: Retorna nós, conexões e gargalos do projeto.
  * `create_company_flow`: Desenha ou atualiza a esteira do projeto com auto-layout em colunas.
  * `get_project_context`: Retorna dados do expert, produtos, kits e checkouts.
  * `get_agent_runbook`: Retorna o checklist de tarefas e passos executáveis por IA.
  * `complete_step`: Marca um passo executável como concluído no mapa da empresa.

---

## 4. Skills Persuasivas & Ferramental de Copywriting

Quando criar ou auditar criativos, páginas ou anúncios, os agentes devem acionar:
1. `angulos-criativos`: Ganchos de dor, causa raiz, vilão escondido e brief de imagem/IA.
2. `mecanismo-vsl`: Tese do mecanismo único, quebra de crenças e scripts de retenção.
3. `skill-black-belt`: Prompts de vídeo 9:16 para Seedance 2.0, Veo 3.1 e Higgsfield.
4. `briefing-gestor-trafego`: Estrutura de campanhas C1 (Principal) vs C2 (Risco) e cópias de teste.
5. `rebel-copy` & `devastador-v4`: Copywriting de resposta direta agressivo no estilo John Carlton.

---

## 5. Diretrizes Inegociáveis para Agentes de Código

1. **Menu Global Limpo:** A sidebar geral (`AppSidebar.tsx`) deve conter apenas ferramentas operacionais universais (Projetos, Campanhas, Sites, OpenFlow). Produtos específicos pertencem às páginas dos respectivos projetos.
2. **Qualidade de Tipagem:** Sempre executar `npx tsc --noEmit` antes de commitar qualquer alteração.
3. **Resiliência de Mensageria:** Qualquer rotina de envio de WhatsApp deve implementar rate-limiting e trava anti-loop (máximo de 3 falhas antes de pausar), para nunca inundar os logs ou leads com repetições.
4. **Deploy no Supabase:** Edge functions modificadas devem ser imediatamente deployadas com:
   `npx supabase functions deploy <function-name> --project-ref tkbivipqiewkfnhktmqq`
