## Expandir triggers e capacidades do OpenFlow

Hoje o FlowEditor expõe apenas 6 triggers (carrinho_abandonado, compra_aprovada, lead_novo, reembolso, aguardando_pagamento, inicio_checkout), mas o `webhook-pagamento` já recebe e roteia muitos outros eventos que ficam "órfãos" — sem automação possível. Vou destravar isso + adicionar capacidades novas.

### 1. Novos triggers de pagamento (já chegam no webhook, falta expor)

| Trigger | Caso de uso |
|---|---|
| `pagamento_recusado` | Cartão recusado → WhatsApp oferecendo Pix/2ª via |
| `pagamento_expirado` | Pix/boleto expirou → reengajar com novo link |
| `boleto_gerado` | Enviar boleto + lembrete D-1 do vencimento |
| `chargeback` | Alerta interno + bloqueio de acesso |
| `compra_cancelada` | Pesquisa de cancelamento + oferta de retenção |
| `assinatura_cancelada` | Win-back de churn |
| `assinatura_renovada` | Agradecimento + upsell |
| `upsell_aprovado` / `orderbump_aprovado` | Onboarding diferenciado |
| `primeiro_acesso` | Boas-vindas pós-login na área de membros |

### 2. Novos triggers não-pagamento

- `tag_adicionada` / `tag_removida` (segmentação manual via CRM)
- `lead_inativo_xd` (lead sem interação há N dias — cron)
- `aniversario_lead` / `aniversario_compra` (cron diário)
- `formulario_respondido` (já existe captura, falta gatilho)
- `mensagem_recebida_whatsapp` com palavra-chave (ex.: "quero", "cancelar")
- `clicou_link` (rastreio de cliques em campanhas)

### 3. Novas ações no FlowEditor

Hoje: whatsapp, email, telegram, aguardar, condicao. Adicionar:
- **Adicionar/Remover tag** no lead
- **Mover no Kanban** (status/coluna)
- **Atribuir responsável** (membro da equipe)
- **Criar tarefa** no Tarefas
- **HTTP request** (webhook out para integrações externas)
- **Atualizar campo do lead** (ex.: `interesse = "premium"`)
- **Notificar interno** (push para a equipe)
- **Split A/B** (50/50 entre dois caminhos)

### 4. Melhorias na condição (`condicao`)

Hoje só tem condição de tempo. Adicionar:
- Se lead **respondeu** mensagem anterior
- Se lead **abriu** email
- Se valor da venda **> X**
- Se lead **tem tag** Y
- Se é **horário comercial**

### 5. Resiliência e UX

- **Janela de silêncio**: não disparar entre 22h–8h (config por automação)
- **Dedupe**: não executar a mesma automação 2x no mesmo lead em N horas
- **Limite de tentativas** com backoff no WhatsApp (já existe parcial, formalizar)
- **Preview do fluxo** antes de ativar (simular com lead fictício)
- **Métricas por step**: taxa de entrega, leitura, conversão (já existe `step_results`, falta UI)
- **Templates prontos** ao criar automação: "Recuperação Pix", "Win-back Chargeback", "Boas-vindas Compra", "Aniversário"

### Detalhes técnicos

- **FlowEditor.tsx**: expandir `TRIGGERS_MAP` com os ~15 triggers novos, agrupar por categoria (Pagamento, Lead, Comportamento, Tempo) com `<SelectGroup>`.
- **openflow-executor**: estender `triggerAliases` para os novos eventos, e adicionar handlers para os novos `tipo`s de ação (tag, kanban, http, etc.).
- **webhook-pagamento**: já dispara a maior parte; verificar se `chargeback`, `assinatura_*`, `upsell_aprovado` chamam `openflow-executor` (linha ~1091). Hoje só dispara para variantes mapeadas — confirmar cobertura.
- **Cron novos**: `openflow-time-triggers` (diário 9h) para `aniversario_*` e `lead_inativo_xd`.
- **Sem migração obrigatória** — `imphq_flow_automacoes.trigger_tipo` já é TEXT livre. Só precisa migration se quiser tabela `imphq_flow_templates` para os templates prontos.

### Escopo da entrega (sugiro 2 sprints)

**Sprint A (essencial — agora):**
1. Expandir TRIGGERS_MAP com os 9 triggers de pagamento + agrupamento
2. Garantir que `webhook-pagamento` dispara `openflow-executor` para todos eles
3. Janela de silêncio + dedupe na automação
4. 3 templates prontos (Pix Recusado, Boleto Vencendo, Chargeback)

**Sprint B (depois):**
5. Ações novas (tag, kanban, http, A/B)
6. Triggers de tempo (aniversário, inatividade) + cron
7. Condições avançadas
8. Métricas por step na UI

### Pergunta antes de começar

Confirma que quer **Sprint A** primeiro? Ou prefere outra ordem (ex.: priorizar ações novas em vez de triggers)?