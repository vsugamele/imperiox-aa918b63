

## Fases pendentes

### Bloco 1 — Creative Factory (já implementado, faltam refinamentos)

**Fase 2 — Edição iterativa**
- Edge Function `creative-edit` (hoje só geração, falta edit)
- Modal "editar imagem" no `CriativoDetalhe.tsx`: usuário descreve mudança ("troca fundo pra azul", "remove texto") → Nano Banana edit → nova versão salva
- Histórico de versões por asset

**Fase 3 — Export & integração**
- Botão "Enviar pra biblioteca de mídias" (copia asset aprovado pra `imphq_midias` do projeto)
- Download em ZIP de todos aprovados do batch
- Redimensionamento automático: 1080×1080, 1080×1350, 1080×1920 (3 versões por asset aprovado)

**Fase 4 — Vídeo (custo alto)**
- Integração com Veo 3 / Runway / Kling pra gerar vídeos curtos (3-6 seg) a partir das imagens aprovadas
- Custo: ~$0.50/vídeo de 5seg → $5-10 por batch

**Fase 5 — Polimento**
- Realtime na página `/criativos/:batchId` (status atualiza sem refresh)
- Retry de assets que falharam
- Preview de UTM/copy gerada antes do export pro Meta Ads

---

### Bloco 2 — Skills novas de Ads (ainda não começou)

- Cadastrar no `imphq_skills` (slug + system prompt + categoria):
  - `ads-copy-multiplier` — 15 variações de headline/primary/description
  - `video-hook-generator` — 10 ganchos de 3s pra Reels/VSL
  - `objection-destroyer` — 20 objeções + script de quebra
- Aparecem na página `/skills` automaticamente
- Conectar `ads-copy-multiplier` ao Creative Factory (gerar headline real, hoje é placeholder)

---

### Bloco 3 — Auto-follow-up + tags WhatsApp IA (não começou)

- Migration: `imphq_lead_followup_rules` (lead_id, dias_parado, mensagem, status)
- pg_cron diário roda às 9h: detecta leads parados há X dias, IA gera mensagem personalizada com base no histórico, agenda envio via `wa-campaign-scheduler`
- Edge Function `wa-conversation-tagger`: roda em novas mensagens, classifica conversa (dúvida/objeção/quente/frio) e salva tag em `imphq_wa_conversations`
- UI: filtros por tag em `/whatsapp`, badge de "temperatura" nos cards de lead

---

### Bloco 4 — Dashboard Comando Único + LTV/cohort (não começou)

- Novo componente `CommandHero.tsx` no topo do `/dashboard`: 1 número (gap pra meta) + 3 ações IA
- Edge Function `dashboard-command` que calcula gap + chama IA pra recomendar ações com base em vendas/ads/leads recentes
- KPIs novos:
  - LTV por canal de aquisição (group by `lead.origem`)
  - Tempo médio lead → venda (delta entre `lead.created_at` e primeira `venda`)
  - ROI por conteúdo (cruzar UTM `content` com vendas)
- Cards comparativos semana vs semana em todo dashboard

---

## Recomendação

Fechar o Bloco 1 (fases 2 e 3 — edição + export) antes de abrir frente nova. São as funcionalidades que tornam o Creative Factory **realmente usável** — hoje gera imagem mas não dá pra ajustar nem mandar pro Ads Manager.

Depois disso, **Bloco 2** (skills) é o de menor esforço e maior alavancagem (1 dia de trabalho, libera 3 ferramentas novas).

**Por qual fase seguimos?**
- A) Creative Factory Fase 2 (edição iterativa)
- B) Creative Factory Fase 3 (export pra mídias + ZIP + redimensionamento)
- C) Bloco 2 (3 skills novas de Ads)
- D) Bloco 3 (auto-follow-up + tags WhatsApp)
- E) Bloco 4 (Dashboard Comando Único)

