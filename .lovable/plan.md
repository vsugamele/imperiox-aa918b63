

# Plano: Melhorias no WhatsApp (4 frentes)

## 1. Campanhas: Dia específico (data) além do offset

**Problema**: Hoje os steps só têm `days_offset` (dia 0, 1, 2...) relativo à `start_date`. O usuário quer poder escolher um dia/data específica.

**Solução**: Adicionar campo `send_date` (DATE, nullable) na tabela `imphq_wa_campaign_steps`. Se preenchido, usa a data exata; se não, usa o `days_offset` como fallback. No editor, trocar o label "Dia (offset)" por um seletor com duas opções: "Data específica" ou "Offset (dia relativo)". Atualizar o scheduler para checar `send_date` primeiro.

**Arquivos**: migration SQL, `CampaignStepEditor.tsx`, `wa-campaign-scheduler/index.ts`

## 2. Alerta de saída de grupo (quem saiu → enviar mensagem)

**Problema**: Quando alguém sai de um grupo WhatsApp, o sistema não detecta nem reage.

**Solução**: 
- A Evolution API envia o evento `GROUPS_UPDATE` ou `GROUP_PARTICIPANTS_UPDATE` no webhook quando alguém sai
- Criar handler no `whatsapp-api` que detecta `action: "remove"` e salva na nova tabela `imphq_wa_group_exits` (group_jid, phone, exited_at, message_sent)
- Criar UI em Campanhas com campo "Mensagem de saída" por campanha — quando detectada a saída, envia DM automática para o número que saiu
- Adicionar coluna `exit_message` (TEXT) em `imphq_wa_campaigns`

**Arquivos**: migration SQL, `whatsapp-api/index.ts` (handler de GROUP_PARTICIPANTS_UPDATE), `CampaignManager.tsx` (campo de mensagem de saída)

## 3. WhatsApp Chat: sempre mostrar telefone no header

**Problema**: O header do chat mostra `contact_name || phone` — se tem nome, esconde o telefone.

**Solução**: Sempre exibir o telefone abaixo do nome no header. Mudar linha 182-184 do `WhatsAppPage.tsx`:
```
<h2>{selectedSession.contact_name || selectedSession.phone}</h2>
<p>{selectedSession.phone} · {projectName(...)}</p>
```
Também na lista de conversas (`ConversationList.tsx`), mostrar telefone como subtexto quando há nome.

**Arquivos**: `WhatsAppPage.tsx`, `ConversationList.tsx`

## 4. Comandos e mini-CRM

**Comandos**: Sistema de auto-resposta baseado em palavras-chave. Nova tabela `imphq_wa_commands` (project_id, trigger_word, response_text, response_media_url, is_active). Quando uma mensagem inbound contém a trigger_word, o webhook responde automaticamente.

**Mini-CRM**: Adicionar campos de qualificação na conversa — tags, estágio do funil (lead/prospect/cliente), notas. Nova tabela `imphq_wa_crm` (conversation_id, stage, tags[], notes, value). Exibir no painel lateral (tab "Info") do chat.

**Arquivos**:
- Migration SQL (2 tabelas: `imphq_wa_commands`, `imphq_wa_crm`)
- `whatsapp-api/index.ts` — auto-resposta por comando
- Novo `src/components/whatsapp/CommandManager.tsx` — CRUD de comandos
- `SessionDetailView.tsx` — adicionar seção CRM (stage, tags, notas)
- `WhatsAppPage.tsx` — nova aba "Comandos"

---

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | 3 mudanças: `send_date` em steps, `exit_message` em campaigns, tabelas `imphq_wa_group_exits`, `imphq_wa_commands`, `imphq_wa_crm` |
| `wa-campaign-scheduler/index.ts` | Suporte a `send_date` |
| `whatsapp-api/index.ts` | Handler GROUP_PARTICIPANTS_UPDATE + auto-resposta por comando |
| `CampaignStepEditor.tsx` | Seletor data/offset |
| `CampaignManager.tsx` | Campo mensagem de saída |
| `WhatsAppPage.tsx` | Telefone no header + aba Comandos |
| `ConversationList.tsx` | Mostrar telefone sempre |
| `SessionDetailView.tsx` | Seção CRM |
| Novo `CommandManager.tsx` | CRUD de comandos |

