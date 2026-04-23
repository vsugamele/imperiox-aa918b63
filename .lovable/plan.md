

## Sprint 2: Retenção & Recuperação

Próximo passo da ordem combinada. Foco: recuperar dinheiro que está vazando hoje (PIX/boleto não pago, carrinho abandonado, reembolsos).

---

### 1. Nova página `/recuperacao`

Dashboard dedicado com 4 buckets visuais (cards no topo + lista detalhada abaixo):

- **PIX pendente** — gerado e não pago, separado em 2 faixas:
  - 🔥 Urgente: 0–2h (alta chance de conversão)
  - ⏰ Esfriando: 2–24h
- **Boleto a vencer** — vence nas próximas 48h
- **Carrinho abandonado** — checkout iniciado sem venda nos últimos 7d
- **Reembolso/Chargeback** — últimos 30d (análise de causa)

Cada card mostra: contagem, valor total em risco, taxa de recuperação histórica.

---

### 2. Lista detalhada por bucket

Tabela com: lead, produto, valor, tempo no bucket, último contato, ações rápidas.

Ações por linha:
- 📱 Enviar WhatsApp (template pronto)
- 📧 Enviar e-mail (template pronto)
- ✏️ Marcar como recuperado / perdido manualmente
- 🔗 Abrir lead no CRM

---

### 3. Templates de mensagens

Tabela `imphq_recovery_templates` (por projeto):
- Tipo (pix_2h, pix_24h, boleto, carrinho, reembolso)
- Canal (whatsapp / email)
- Assunto + corpo (com variáveis: {nome}, {produto}, {valor}, {link_pagamento})
- Editáveis pelo usuário, com defaults sugeridos pela IA Imperius.

---

### 4. Integração com OpenFlow

Botão "Automatizar este bucket" cria automaticamente um fluxo no OpenFlow:
- Trigger: lead entra no bucket
- Ação: enviar template após X minutos
- Retry: re-enviar após Y horas se não houver pagamento

---

### 5. KPI de recuperação no Comando

Novo mini-bloco no `ProjetoComando`:
- **Recuperado este mês**: R$ X (Y vendas)
- **Em risco agora**: R$ Z
- Link "Ver detalhes" → `/recuperacao?projeto=X`

---

### Banco de dados

Nova tabela `imphq_recovery_templates` (project_id, tipo, canal, assunto, corpo, ativo).

Nova tabela `imphq_recovery_logs` (lead_id, bucket, ação tomada, canal, status, timestamp) — pra calcular taxa de recuperação histórica.

Reaproveita dados existentes:
- `imphq_vendas` com status "pendente" / "pix_gerado" / "boleto_gerado" → buckets PIX e boleto
- `imphq_leads` com `ultimo_evento = 'checkout_iniciado'` sem venda → carrinho abandonado
- `imphq_vendas` com status "reembolsado" / "chargeback" → reembolso

---

### Arquivos

**Novos**:
- `src/pages/Recuperacao.tsx`
- `src/components/recuperacao/BucketCard.tsx`
- `src/components/recuperacao/RecoveryTable.tsx`
- `src/components/recuperacao/TemplateEditor.tsx`
- `src/components/recuperacao/RecoveryKpiBlock.tsx` (mini-bloco pro Comando)
- `src/lib/recoveryBuckets.ts` (lógica de classificação)

**Editados**:
- `src/App.tsx` (rota `/recuperacao`)
- `src/components/AppSidebar.tsx` (item de menu)
- `src/components/projeto/ProjetoComando.tsx` (mini-bloco recuperação)

**Migration**: criar `imphq_recovery_templates` + `imphq_recovery_logs` com RLS.

---

### Fora de escopo (fica pra depois)
- Disparo automático sem aprovação (segurança).
- Análise preditiva de qual lead tem maior chance de recuperar (entra no Sprint 4 / Copilot).
- Integração com gateway pra reenviar link de pagamento atualizado (depende de cada provedor).

