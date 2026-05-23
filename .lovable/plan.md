## Plano de Refinamento — /leads + Visão Geral

### A) Página /leads (alvo principal)

**1. Performance e arquitetura**
- `Leads.tsx` tem 771 linhas com muita lógica inline (timeline, funil, conversão, charts). Quebrar em:
  - `useLeadsData.ts` (fetch + filtros + período)
  - `LeadsFunnelPanel.tsx` (gráficos)
  - `LeadTimeline.tsx` (já existe parcialmente em Nurture, reutilizar)
- Memoizar derivações pesadas (funil, buckets de conversão) com `useMemo` real por período.
- Paginação real na tabela (hoje carrega tudo, esbarra no limite 1000 do Supabase).

**2. UX da tabela**
- Filtros persistentes em `localStorage` (mesmo padrão do WhatsApp v2).
- Coluna de **score** com cor semafórica + tooltip explicando os pontos (já existe `trg_recalc_lead_score`, falta surfacing).
- Bulk actions: tag em massa, mover de estágio, disparo WhatsApp em massa (hoje só individual).
- Quick filter "Hot Leads agora" (Pix/Boleto últimas 2h) acima da tabela.

**3. Drill do lead**
- Timeline mescla eventos mas falta agrupar por dia e destacar última interação humana vs IA.
- Painel UTM (`LeadUtmsPanel`) e Predictive (`LeadPredictivePanel`) hoje aparecem soltos — unificar em tabs dentro do drill.
- Botão "Refinar IA com este lead" (alimentar `imphq_wa_knowledge` a partir de conversas reais).

**4. Inteligência**
- Sugestão automática de próximo passo por lead (já temos `imphq_lead_predictions`, falta CTA visível na linha da tabela).
- Detecção de leads "esfriando" (sem evento há X dias com score alto) — badge laranja.

---

### B) Visão geral do sistema (top refinamentos)

**Prioridade alta**
1. **Triagem WhatsApp:** confirmar deploy do skip de grupos e adicionar log de mensagens ignoradas (auditoria).
2. **Refine IA:** após salvar lição, mostrar preview de como a IA responderia agora (loop de validação).
3. **Custos/tokens IA:** painel em `/imperius` ou Config mostrando consumo por edge function (Gemini/OpenRouter) — hoje é cego.
4. **Egress Supabase:** auditar Realtime redundante (memória já alerta) — algumas páginas ainda assinam canais não usados.

**Prioridade média**
5. **Dashboard:** Hot Lead Alerts e Predictive coexistem mas não cruzam — unir num único "Painel de Oportunidades".
6. **Imperius autônomo:** ActionInbox hoje mostra fila; falta métrica de taxa de aprovação/rejeição para calibrar low-risk.
7. **Onboarding de projeto:** sincronização briefing → IA (`syncFromProject` em `WhatsAppAIConfig`) deveria rodar automaticamente quando avatar/branding mudam.

**Prioridade baixa (polish)**
8. Padronizar empty states (muitas tabelas mostram só "Sem dados").
9. SectionInfo (ℹ️) faltando em várias seções novas de /leads.
10. Acessibilidade: foco visível em tabelas e drills (teclado).

---

### Sugestão de execução
Escolha **2-3 itens** desta lista para eu implementar nesta rodada. Recomendo começar por:
- **A.2** (filtros persistentes + bulk actions + Hot Leads quick filter)
- **A.3** (unificar drill em tabs + score com tooltip)
- **B.3** (painel de consumo de IA)

Quer que eu siga por aí ou prefere outra combinação?