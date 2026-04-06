

# Plano: 3 Melhorias — Chat do WhatsApp, Seletor de Sessao no OpenFlow, e Envio via Lead

## 1. Ver o chat do numero que "bati" (WhatsApp Hub)

**Problema**: Quando voce conecta via Hub Local e troca mensagens, as mensagens ficam em `imphq_wa_messages` com `conversation_id = telefone`. Mas para abrir o ChatView, voce precisa de uma "sessao" em `imphq_wa_conversations`. Se nao criou manualmente, nao aparece na lista.

**Fix**: Na aba Hub do WhatsApp, apos conectar com sucesso, adicionar um botao "Ver Conversas" que lista as mensagens recentes agrupadas por telefone. Ao clicar, abre o ChatView diretamente usando o phone como conversation_id (ja funciona assim no ChatView — ele busca por `conversation_id` OR `phone`).

Alternativa mais robusta: criar automaticamente uma `imphq_wa_conversations` quando o Hub envia/recebe a primeira mensagem de um numero.

## 2. OpenFlow: Mostrar qual WhatsApp vai enviar

**Problema**: No FlowEditor, quando seleciona tipo "WhatsApp", nao mostra qual sessao/provider sera usado. O usuario nao sabe por qual numero vai sair.

**Fix**: Adicionar ao FlowEditor uma prop `providers` (lista de wa_providers do projeto). Quando o tipo da acao for "whatsapp", exibir um Select com os providers configurados. Salvar `provider_id` na acao. No OpenFlow page, passar os providers filtrados pelo projeto selecionado.

Mudanca na interface `Acao`:
```typescript
export interface Acao {
  tipo: string;
  template: string;
  delay_min: number;
  provider_id?: string;  // novo
  // ...
}
```

## 3. Leads: Botao de enviar WhatsApp com sessao e template

**Problema**: O `sendQuickWhatsApp` atual so abre `wa.me/` no navegador. Nao usa a infraestrutura interna (providers, templates).

**Fix**: Substituir por um dialog que permite:
- Selecionar o provider/sessao WhatsApp (lista de `imphq_wa_providers`)
- Escolher um template ou digitar texto livre
- Variaveis automaticas: `{{nome}}`, `{{email}}`, `{{telefone}}`
- Enviar via `whatsapp-api?action=send_message`
- Criar automaticamente a conversa em `imphq_wa_conversations` se nao existir

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/openflow/FlowEditor.tsx` | Prop `providers`, Select de provider quando tipo=whatsapp, salvar `provider_id` na acao |
| `src/pages/OpenFlow.tsx` | Passar providers do projeto ao FlowEditor |
| `src/pages/Leads.tsx` | Substituir `sendQuickWhatsApp` por dialog com seletor de provider + template |
| `src/pages/WhatsAppPage.tsx` | Na aba Hub, listar conversas recentes do hub por telefone |

## Ordem

1. FlowEditor + OpenFlow (seletor de provider)
2. Leads (dialog de envio WhatsApp)
3. WhatsApp Hub (listar conversas)

