## Diagnóstico do PIX de hoje (12:06)

Achei a evidência:
- `imphq_webhooks`: chegou `pix_gerado` Ticto/jp_freitas às 12:06, marcado `processado=true`.
- `imphq_vendas`: **nenhuma venda criada hoje**. A última é de ontem.
- `imphq_webhook_errors`: vazio (nenhum erro registrado).
- `imphq_ai_actions`: nenhuma `hot_lead_responder` rodou hoje.

**Causa raiz provável (a confirmar na Fase 1):**
1. No `webhook-pagamento` (linha 531), o bloco de checkout intent só insere venda **se `leadId` existir**. Se a resolução de lead falha (telefone/email não bate), ele apenas pula — **sem log de erro, sem entrada em `imphq_webhook_errors`**.
2. Mesmo que inserisse, o `hot-lead-responder` **não tem cron job ativo**: só roda manual. Por isso nada disparou.
3. O `recovery` de hoje falhou com `no_provider` — chip não resolvido pra jp_freitas naquele caminho.

---

## Fase 1 — Fix PIX/logs/disparo (urgente, ~1h)

**Backend (`webhook-pagamento`):**
- Sempre gravar `imphq_webhook_errors` quando `checkoutIntentEvents` chega mas `leadId` é null (com motivo: "lead_not_resolved", payload original).
- Logar `ciErr` mesmo em `23505` (duplicado) para auditoria.
- Quando `pix_gerado` cria/promove venda, enfileirar imediatamente uma `imphq_ai_actions` `kind=hot_lead_responder` (não esperar cron) com `risk_level=low`, executada inline pelo `imperius-executor` ou disparada via `supabase.functions.invoke('hot-lead-responder', { venda_id })`.

**Cron:**
- Agendar `hot-lead-responder` `*/5 * * * *` (rede de segurança caso o invoke inline falhe).
- Verificar `payment-recovery` `no_provider` → usar a hierarquia de 5 níveis (mem `whatsapp/provider-resolution-hierarchy`) corretamente.

**UI (nova aba em `/configuracoes/integracoes`):**
- "Webhooks brutos (últimas 48h)": tabela `imphq_webhooks` + `imphq_webhook_errors` lado a lado, com botão **Reprocessar** (já existe lógica, expor pro `pix_gerado` órfão).
- Badge de saúde: "X% dos webhooks viraram venda nas últimas 24h".

---

## Fase 2 — Hub Comando (Kanban | Chat | Tarefas) (~3-4h)

Nova rota `/comando` com 3 colunas resizable:
```
┌──────────────────┬──────────────────┬──────────────────┐
│ Kanban (col 1)   │ Chat ativo (2)   │ Tarefas (col 3)  │
│ - filtra projeto │ - convo do card  │ - tasks do card  │
│ - clica no card  │   selecionado    │ - +Nova rápida   │
│ → seleciona      │ - slash commands │ - check inline   │
│   contexto       │ - sugestões IA   │                  │
└──────────────────┴──────────────────┴──────────────────┘
```

- Componente novo: `src/pages/Comando.tsx` usando `ResizablePanelGroup` (já existe `ui/resizable`).
- Estado compartilhado por contexto: `ActiveLeadContext` (lead_id + project_id + kanban_card_id). Persistido em URL (`?lead=...`).
- Reutiliza componentes já existentes: `KanbanPage` board → modo embedded sem header; `ChatView` filtrado por lead; `CardDetailPanel` (parte de tarefas) lateral.
- Atalho global `Cmd/Ctrl+K` para alternar lead ativo via busca.
- Mantém páginas atuais intactas — Comando é o "modo unificado" opcional, item novo na sidebar entre Dashboard e Projetos.

---

## Fase 3 — OpenFlow IA (~3h)

3 capacidades novas no `/openflow`:

**3a. Gerar sequência de nutrição via briefing**
- Botão "✨ Gerar com IA" no editor de fluxo.
- Modal: escolhe projeto/produto, objetivo, nº mensagens, canal (WA/email).
- Edge function nova `openflow-ai-generate`: usa Lovable AI Gateway (`google/gemini-3-flash-preview`) + contexto do projeto (avatar, branding, vendas) + skills `nurture-generator` existente.
- Devolve N passos prontos (delay, copy, condição) → insere no fluxo.

**3b. Triagem automática de lead novo**
- Novo node type `ai_triage` no editor.
- Edge function `openflow-ai-triage`: classifica lead (quente/morno/frio, dor primária, objeção provável) e roteia para branch correspondente.
- Reaproveita `wa-ai-triage` existente, generalizando.

**3c. Auto-otimização**
- Em cada fluxo, painel "💡 Sugestões IA": lê `imphq_automacao_logs`, identifica passos com baixa conversão (drop > 40%), propõe reescrita do copy.
- Botão "Aplicar sugestão" cria nova versão do passo (não sobrescreve — histórico em `imphq_ai_actions`).

---

## Fase 4 — Hub Conteúdo (pipeline Ideia → Roteiro → Criativo → Vídeo) (~3-4h)

Nova rota `/conteudo` que substitui as 3 entradas separadas (Conteúdo IA, Criativos, Studio) na sidebar — páginas antigas viram tabs dentro dela.

**Pipeline visual (Kanban horizontal de 4 colunas):**
```
Ideia → Roteiro → Criativo (img) → Vídeo
```
- Cada "card" é uma `imphq_content_piece` (tabela nova) que carrega contexto entre etapas: prompt original, copy, asset gerado, vídeo final.
- Avança 1 etapa com botão: "Roteirizar com IA" → "Gerar imagem" → "Gerar vídeo (Studio)".
- Reutiliza: `ContentGenerator` (texto), `creative-factory` (imagem), `studio-generate` (vídeo).
- Biblioteca compartilhada: prompts, avatar, branding ficam num único `ContextBar` no topo.
- Histórico unificado: tudo que foi gerado vira card persistente, filtrável por projeto/produto.

**Migration nova:**
- Tabela `imphq_content_pieces` (id, project_id, produto_nome, stage, idea, script, image_url, video_url, prompt_history jsonb, status, created_at).
- RLS: leitura/escrita por membros do projeto.

---

## Importante "nada se perde"

- **Nenhuma página antiga é removida.** Comando e Conteúdo são novos hubs que **agregam** o que já existe.
- Sidebar reordena: Comando (novo) e Conteúdo (novo) no topo; páginas antigas permanecem acessíveis em "Avançado".
- Memórias do projeto atualizadas a cada fase.

---

## Ordem de execução (sua escolha confirmada)

1. **Fase 1** — Fix PIX/logs (1 migration + edits em `webhook-pagamento` + cron + 1 aba UI)
2. **Fase 2** — Hub Comando (1 página nova + contexto)
3. **Fase 3** — OpenFlow IA (3 edge functions + UI)
4. **Fase 4** — Hub Conteúdo (1 migration + 1 página nova)

Posso começar pela Fase 1 imediatamente após aprovação.