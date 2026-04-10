

# Avaliação do Sistema — Oportunidades de Melhoria em Integração

## Diagnóstico Geral

O sistema tem 14 Edge Functions, integrações com Evolution API, Facebook Ads, Google Calendar, webhooks de pagamento (Ticto/Hotmart/Kiwify), Resend, e IA (Lovable Gateway + OpenRouter). A arquitetura é funcional, mas tem lacunas importantes em **confiabilidade**, **observabilidade** e **experiência de configuração**.

---

## 1. Sem Health Check centralizado das integrações

**Problema**: Não existe nenhum painel que mostre o status real de cada integração. O usuário não sabe se o token do Facebook expirou, se a Evolution API está online, ou se o Google Calendar está autenticado — só descobre quando algo falha.

**Solução**: Criar uma página "Status de Integrações" (ou aba em Configurações) que:
- Pinga cada serviço e exibe verde/vermelho
- Mostra última sincronização bem-sucedida
- Alerta proativamente quando tokens expiram

---

## 2. Tokens do Facebook armazenados como texto plano no JSONB

**Problema**: O `facebook_marketing_token` está dentro de `imphq_projects.data` (coluna JSONB). Qualquer query que retorna `data` expõe o token ao frontend. Não há refresh automático — tokens de curta duração expiram e o sync quebra silenciosamente.

**Solução**:
- Mover tokens sensíveis para os Supabase Secrets (acessíveis apenas pelas Edge Functions)
- Ou criar uma tabela `imphq_integration_credentials` com RLS restritivo
- Implementar alerta de expiração de token

---

## 3. Google Calendar usa credenciais globais (não por projeto)

**Problema**: A Edge Function `google-calendar-sync` usa `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` como secrets globais. Todos os projetos compartilham a mesma conta Google. Não há suporte para múltiplas agendas de projetos diferentes.

**Solução**: Vincular credenciais Google por projeto (similar ao que já é feito com WhatsApp providers), permitindo cada projeto ter sua própria integração.

---

## 4. Webhooks de pagamento sem retry nem log visual

**Problema**: A `webhook-pagamento` processa Ticto/Hotmart/Kiwify, mas:
- Se falhar, o evento se perde (sem fila de retry)
- Os logs só existem no Supabase Dashboard (Edge Function Logs)
- O usuário não tem visibilidade dos webhooks recebidos

**Solução**:
- Salvar cada webhook recebido em `imphq_webhooks` antes de processar (já existe a tabela, mas não está sendo usada consistentemente)
- Painel no frontend mostrando webhooks recentes com status (sucesso/erro/pendente)
- Botão de "reprocessar" para webhooks com erro

---

## 5. OpenFlow não executa — só planeja

**Problema**: O `FlowEditor` permite criar automações com ações (email, WhatsApp, Telegram), mas a execução real das etapas depende de triggers manuais ou cron jobs que não estão implementados. O sistema monta o fluxo mas não tem um "motor" que o executa automaticamente quando o trigger dispara.

**Solução**: Implementar um executor de fluxos:
- Edge Function `openflow-executor` que recebe um trigger event e percorre as etapas
- Integrar com `webhook-pagamento` para disparar automaticamente em eventos como `compra_aprovada`
- Fila de execução com status por etapa

---

## 6. Sem integração nativa com plataformas de email

**Problema**: A ação "Email (Resend)" no OpenFlow apenas configura o template, mas não há integração de envio real implementada. A Edge Function `send-project-email` existe mas é invocada manualmente.

**Solução**: Conectar o executor de fluxos ao Resend para disparos automáticos.

---

## 7. CORS inconsistente entre Edge Functions

**Problema**: Algumas funções usam `corsHeaders` do SDK (`@supabase/supabase-js/cors`), outras definem manualmente com headers diferentes. Isso pode causar falhas silenciosas em browsers diferentes.

**Solução**: Padronizar todas as Edge Functions para usar o mesmo padrão de CORS headers.

---

## 8. Sem monitoramento de rate limits da Evolution API

**Problema**: O sync de contatos e envio de mensagens não controlam rate limits. Se houver muitas chamadas simultâneas, a Evolution API pode bloquear temporariamente.

**Solução**: Adicionar controle de concorrência e delays entre batches no sync de contatos/avatares.

---

## Priorização sugerida (por impacto)

| # | Melhoria | Impacto | Esforço |
|---|---|---|---|
| 1 | Painel de Status das Integrações | Alto | Médio |
| 2 | Webhook log visual + reprocessar | Alto | Médio |
| 3 | Mover tokens sensíveis para secrets | Alto (segurança) | Baixo |
| 4 | Motor de execução do OpenFlow | Muito Alto | Alto |
| 5 | CORS padronizado | Médio | Baixo |
| 6 | Google Calendar multi-projeto | Médio | Médio |
| 7 | Rate limiting Evolution API | Médio | Baixo |
| 8 | Integração real Resend no OpenFlow | Alto | Médio |

## Recomendação

Começar pelo **Painel de Status das Integrações** (item 1) + **Webhook log visual** (item 2) — são os que mais impactam a experiência do usuário e dão visibilidade sobre o que está funcionando. Depois avançar para o **motor de execução do OpenFlow** (item 4), que é o mais transformador em termos de automação real.

Quer que eu implemente algum desses itens? Posso começar por qualquer um.

