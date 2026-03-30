

# Plano: Funis com Dados Reais, WhatsApp Automacao, Mentes IA com Contexto Completo

## 3 frentes restantes

---

### 1. Funis com dados reais do Pixel (`imphq_events`)

**Problema**: Os campos visitantes/conversoes em cada etapa do funil sao preenchidos manualmente. A tabela `imphq_events` ja recebe PageView, ViewContent, AddToCart, Lead via imptrack.js mas nao e consultada.

**Solucao**: Quando um funil tem `project_id` e as etapas tem `url`, buscar automaticamente contagens de `imphq_events` agrupadas por `page_url` para popular visitantes e conversoes.

- Ao abrir o editor de funil, buscar `imphq_events` do projeto agrupado por `page_url` e `event_name`
- Para cada etapa com `url` preenchida, calcular: visitantes = count(PageView para essa URL), conversoes = count(ViewContent ou AddToCart ou Lead)
- Exibir badge "Dados reais" vs "Manual" em cada card
- Adicionar toggle "Usar dados do Pixel" no header do editor
- Taxas de conversao entre etapas calculadas automaticamente com os dados reais

**Arquivo**: `src/pages/Funis.tsx`

---

### 2. WhatsApp com templates salvos, agendamento e keywords

**Problema**: Hoje o WhatsApp tem envio em massa e chat basico. Falta templates reutilizaveis, agendamento de envios e respostas automaticas por keyword.

**Solucao**:

- **Templates**: Nova aba "Templates" na pagina WhatsApp. CRUD de templates usando tabela `imphq_wa_templates` (ja criada na migration anterior). Campos: nome, conteudo (com variaveis {{nome}}, {{produto}}), categoria, project_id.
- **Usar template no chat**: Botao "📋 Template" no ChatView para inserir template no campo de mensagem.
- **Agendamento**: No BulkSendDialog, campo opcional "Agendar para" com date/time picker. Se preenchido, salva na tabela com status "agendado" em vez de enviar imediatamente.
- **Keywords**: Lista simples de keyword → resposta automatica no provider config (armazenado no JSONB metadata do provider). Quando mensagem incoming contem keyword, sugere resposta.

**Arquivos**: `src/pages/WhatsAppPage.tsx`, `src/components/whatsapp/ChatView.tsx`, `src/components/whatsapp/BulkSendDialog.tsx`

---

### 3. Mentes IA com contexto automatico completo do projeto

**Problema**: O `buildSystemPrompt()` hoje injeta apenas campos basicos (nome, produto, categoria, objetivo, contexto, desejo_externo, 3 dores). Falta: briefing completo, branding, concorrentes, copy arsenal, KPIs, emails.

**Solucao**:

- Expandir a query de projetos para incluir `data` (JSONB com briefing, branding, copy_arsenal, emails, kpis, integracoes)
- Buscar concorrentes do projeto via `imphq_competitors` quando projeto selecionado
- Buscar KB ativa via `imphq_kb` do projeto
- Montar system prompt com secoes:
  - BRIEFING (do data.briefing ou campos diretos)
  - BRANDING (paleta, tom de voz, do data.branding)
  - AVATAR COMPLETO (todas as dores, desejos, problemas, gatilhos do avatar JSONB)
  - CONCORRENTES (top 3 nomes + diferenciais)
  - COPY ARSENAL (headlines, ganchos do data.copy_arsenal)
  - KPIs (metas do data.kpis)
- Mostrar badge com contagem de caracteres injetados ("12.4K chars de contexto")
- Exibir checklist visual mostrando quais dados do projeto estao disponiveis vs vazios

**Arquivo**: `src/pages/Mentes.tsx`

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/pages/Funis.tsx` | Buscar `imphq_events` por URL, popular metricas reais, toggle dados pixel |
| `src/pages/WhatsAppPage.tsx` | Nova aba Templates, CRUD de templates |
| `src/components/whatsapp/ChatView.tsx` | Botao "Usar Template" no input |
| `src/components/whatsapp/BulkSendDialog.tsx` | Campo agendar, selecionar template |
| `src/pages/Mentes.tsx` | Contexto expandido com briefing/branding/concorrentes/KB, badge de chars, checklist visual |

