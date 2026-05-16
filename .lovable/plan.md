## Objetivo
Transformar o ícone 💬 (WhatsApp) na linha do lead em um **menu dropdown** com duas ações:
1. Abrir WhatsApp (wa.me + LeadWhatsAppDialog)
2. Rodar automação OpenFlow do projeto do lead

## UX
Clique no ícone abre um `DropdownMenu`:
- **Abrir conversa (wa.me)** → comportamento atual
- **Enviar via provider** → abre `LeadWhatsAppDialog` (já existe)
- **Rodar automação ▸** submenu lista automações ativas (`imphq_automacoes` filtradas por `project_id` do lead). Ao escolher → confirma e dispara.

## Disparo da automação
- Insere registro em `imphq_automacao_execucoes` com:
  - `automacao_id`, `project_id`, `lead_id`, `trigger_tipo: 'manual_lead'`, `status: 'pending'`, `payload: { lead }`
- O `openflow-executor` (cron já existente) processa pendentes — mesmo padrão usado em outros disparos manuais. Se a tabela/edge não suportar gatilho manual ainda, adicionamos suporte mínimo (sem mexer no resto do executor).
- Toast de sucesso: "Automação enfileirada".

## Mudanças

**`src/components/leads/LeadsTable.tsx`** (linha 135)
- Substituir o `<Button asChild><a href=wa.me>` por `<LeadActionsMenu lead={l} onSendWa={...} onRunAutomation={...} />`.
- Manter cor verde no trigger.

**`src/components/leads/LeadActionsMenu.tsx`** (novo, ~80 linhas)
- DropdownMenu com `MessageCircle` trigger.
- Carrega automações do projeto do lead via prop (passadas pela página) ou hook leve.
- Submenu "Rodar automação" lista nome + tipo de trigger.

**`src/pages/Leads.tsx`**
- Já carrega `automacoes`? Se não, adiciona fetch leve de `imphq_automacoes` (id, nome, project_id, ativo, trigger_tipo) na carga inicial.
- Passa `automacoes` e `onRunAutomation(lead, automacaoId)` para `LeadsTable`.
- `onRunAutomation` faz o `insert` em `imphq_automacao_execucoes` e mostra toast.

## Não-incluído
- Editor de automação (já existe em /openflow).
- Disparo em massa (multi-lead) — fica para próximo passo se quiser.

## Verificação
- Confirmar que `imphq_automacao_execucoes` aceita `trigger_tipo='manual_lead'` (ou usar valor já aceito como `manual`).
- Testar: clicar no 💬 de um lead com projeto que tem automação ativa → menu mostra a automação → disparar → registro criado.