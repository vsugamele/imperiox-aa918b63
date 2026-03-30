

# Plano: Webhook Dropdown, Fix Email Config, Historico de Emails

## 3 problemas

---

### 1. Webhook — campo plataforma como dropdown

**Problema**: O campo "nome" do webhook (linha 607 do ProjetoBriefing) é um Input livre. Deveria ser um Select/dropdown com opções pré-definidas + possibilidade de adicionar custom.

**Solução**: Trocar o Input por um Select com as opções: Hotmart, Kiwify, Ticto, Eduzz, Hubla. Adicionar uma opção "Outro..." que abre um Input para nome custom. Guardar lista de plataformas custom em `data.custom_platforms[]` para persistir novas adicionadas pelo usuário.

**Arquivo**: `src/components/projeto/ProjetoBriefing.tsx` (linhas 602-628)

---

### 2. Fix — Emails mostra "não configurado" mesmo com Resend configurado

**Problema**: O Briefing salva a API key do Resend em `data.checklist.resend.resend_api_key` e o email em `data.checklist.resend.from_email`. Mas o `ProjetoEmails` lê de `data.email_config.resend_api_key` e `data.email_config.from_email`. São caminhos diferentes no JSONB — por isso o Emails nunca vê a config feita no Briefing.

**Solução**: No `ProjetoEmails`, fazer fallback: se `email_config` não tem `resend_api_key`, tentar ler de `data.checklist?.resend?.resend_api_key`. Quando o usuário salva no ProjetoEmails, continua salvando em `email_config`. Quando salva no Briefing, sincronizar para `email_config` também.

**Arquivo**: `src/components/projeto/ProjetoEmails.tsx` (linha 35)

---

### 3. Histórico de emails enviados com status

**Problema**: Não existe histórico de emails enviados pelo projeto. Quando o `send-project-email` envia via Resend, não registra nada.

**Solução**:
- Na edge function `send-project-email`, após envio bem-sucedido, inserir registro em `imphq_events` com `event_name: "email_sent"`, `project_id`, e metadata (template, destinatário, resend_id, status).
- No `ProjetoEmails`, adicionar uma seção "Histórico de Envios" que busca `imphq_events` onde `event_name = 'email_sent'` e `project_id` = projeto atual.
- Exibir tabela com: destinatário, template, data/hora, status (enviado/erro).
- Para aberturas e cliques: informar o usuário que isso requer configurar webhooks do Resend (resend.com/webhooks) apontando para a imperio-api. Adicionar na UI um card explicativo com link direto para o painel de webhooks do Resend.

**Arquivos**: `supabase/functions/send-project-email/index.ts`, `src/components/projeto/ProjetoEmails.tsx`

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Dropdown de plataformas no webhook com opções pré-definidas + custom |
| `src/components/projeto/ProjetoEmails.tsx` | Fallback para ler config do Briefing, seção Histórico de Envios |
| `supabase/functions/send-project-email/index.ts` | Registrar envio em imphq_events após sucesso |

