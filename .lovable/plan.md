# Plano: Evolução Estratégica do Império HQ

Três entregas separadas para você aprovar uma de cada vez (ou tudo junto).

---

## PARTE 1 — O que melhorar no sistema (prioridade alta → baixa)

### Receita & inteligência (alto ROI)
1. **Atribuição multi-touch** — hoje toda venda cola no `utm_source` do lead. Adicionar `first_touch` vs `last_touch` vs `linear` (ponderado entre touchpoints).
2. **Forecast de caixa 90 dias** — extrapolar ARR/MRR usando vendas recorrentes + sazonalidade (não só linear).
3. **Anomaly detection real-time** — hoje é 2σ no Dashboard. Adicionar alerta proativo via WhatsApp quando CPA dobrar, ROAS cair >30% em 24h, ou LTV/CAC < 1.
4. **Cohort de retenção por produto** (não só por canal) — cruzar com upsell/downsell para achar produtos que “seguram” cliente.

### UX & operação (médio ROI)
5. **Comando rápido global (Cmd+K)** — buscar lead, projeto, venda, navegar entre páginas. Reduz cliques drasticamente.
6. **Modo offline mínimo** — cache de leads recentes e mensagens WhatsApp para responder sem net.
7. **Notificações push agrupadas** — hoje cada evento vira push. Agrupar por contexto (ex: “3 vendas hoje, R$ X”).
8. **Audit log unificado** — trilha de quem alterou o quê (já existe `imphq_activity_logs`, mas fragmentado).

### Performance & dívida técnica (baixo ROI visível, alto custo se ignorado)
9. **Reduzir queries N+1** em Dashboard, Cohort e Gerenciador (paralelizar via Promise.all consistente).
10. **Migrar tabelas grandes para paginação cursor-based** (`imphq_vendas`, `imphq_ads_spend`, `imphq_events`).
11. **Limpeza de Service Workers/PWA** — caches duplicados causam telas brancas em preview.
12. **Padronizar tratamento de erros nos webhooks** (Hotmart/Ticto/Kiwify) com reprocessamento idempotente.

### Segurança
13. **Rotação de tokens automática** em `imphq_integration_credentials` (alertar 7 dias antes de expirar Meta/Google).
14. **RLS audit** — varredura semanal de policies novas que escapem do padrão `has_role`.

---

## PARTE 2 — Atualização de modelos de IA

### Estado atual (10 edge functions de IA)
| Function | Modelo hoje | Sugestão |
|---|---|---|
| `copilot-imperius` (chat estratégico) | `gemini-2.5-flash` | **`gemini-3-flash-preview`** (mais raciocínio, mesmo custo) |
| `daily-briefing` | `gemini-3-flash-preview` | manter |
| `nurture-generator` (copy WhatsApp/email) | `gemini-3-flash-preview` (configurável) | manter, mas oferecer **`gpt-5-mini`** como opção premium |
| `openflow-ai` (orquestrador) | `gemini-3-flash-preview` | manter |
| `lead-predict` (probabilidade conversão) | `gemini-3-flash-preview` | manter |
| `avatar-pipeline` (psicografia) | `gemini-2.5-flash` | **`gemini-3-flash-preview`** |
| `content-cluster` (agrupamento temático) | `gemini-2.5-flash` | **`gemini-3-flash-preview`** |
| `daily-stories-ideas` | `gemini-2.5-flash` | **`gemini-3-flash-preview`** |
| `creative-factory` (texto) | `gemini-3-flash-preview` | manter |
| `creative-factory` (imagem premium) | `gemini-3-pro-image-preview` | manter |
| `creative-factory` (imagem rápida) | `gemini-2.5-flash-image` | **`gemini-3.1-flash-image-preview`** (Nano Banana 2) |

### Princípios da atualização
- **Default geral**: `google/gemini-3-flash-preview` (já é o padrão do gateway).
- **Reasoning ligado** (`reasoning: { effort: "medium" }`) só em: `copilot-imperius`, `lead-predict`, e na **Parte 3** (Sales Path Engine).
- **Tool calling em vez de “me devolve JSON”** em `lead-predict`, `avatar-pipeline`, `content-cluster` — mais robusto.
- **Image upgrade**: trocar Nano Banana 1 → Nano Banana 2 em todos os pontos de geração de criativo rápido.

---

## PARTE 3 — Botão Imperador (Sales Path Engine)

Botão único no `/projetos/:id` que dispara uma análise total e devolve um **Plano de Ataque de Vendas** acionável.

### O que ele faz, em ordem
1. **Coleta tudo do projeto**: briefing, avatar, branding, produtos, vendas (90d), leads, ads, copy arsenal, integrações ativas, funis, mensagens WhatsApp, eventos do site.
2. **Diagnostica gargalos** rodando regras determinísticas + IA:
   - Funil: onde leak está maior (lead→checkout, checkout→pix, pix→aprovado).
   - Ads: campanhas com CTR>2% mas CPA alto = problema de página, não criativo.
   - LTV/CAC por canal + por produto.
   - Avatar vs Copy: existe desalinhamento entre dor mapeada e copy ativa?
3. **Gera Sales Path** com IA (reasoning: high) — saída estruturada via tool calling:
   - `diagnostico` (3-5 bullets do que está sangrando)
   - `oportunidades` (3-5 alavancas mapeadas: ex: “Order bump no Produto X pode +18% AOV”)
   - `acoes_72h` (lista priorizada com responsável sugerido, esforço, impacto estimado em R$)
   - `acoes_30d` (sequência estratégica)
   - `sales_path_recomendado` (passo-a-passo do funil ideal: tráfego → captura → nurture → oferta → upsell)
   - `riscos` (o que pode dar errado se não agir)
4. **Cria automaticamente**:
   - Tarefas no Kanban com prazo, prioridade e produto vinculado.
   - Briefings de criativos prontos pra `creative-factory` (sem gerar imagem ainda — só preparar).
   - Sequência de nutrição draft no `nurture-generator` (status: `pending_review`).
   - Alertas no Dashboard com link para cada gargalo.
5. **Persiste** o plano em nova tabela `imphq_sales_paths` para histórico, comparação e rerun.
6. **UI**: painel deslizante mostrando o plano renderizado em markdown + botões “Aprovar tarefas”, “Aprovar nutrição”, “Refazer com mais foco em X”.

### Detalhes técnicos
- **Nova edge function**: `sales-path-engine` (modelo `google/gemini-3-flash-preview` + `reasoning: high`, fallback `openai/gpt-5-mini` em erro).
- **Nova tabela**: `imphq_sales_paths` (project_id, snapshot_data jsonb, plano jsonb, status, created_at, score_health).
- **Trigger opcional**: rodar automaticamente toda segunda-feira para projetos `vendendo`.
- **Custo estimado**: ~1 chamada com reasoning high por projeto = trocados de centavos via Lovable AI Gateway.
- **Persona**: usa "Imperius" (pt-BR, estratégico, direto).

### Onde o botão aparece
- Topo de `ProjetoDetalhe.tsx`, badge dourado, ícone de coroa.
- Atalho global Cmd+I (se aprovar item 5 da Parte 1).

---

## Ordem sugerida de execução

1. **Parte 3 primeiro** (Botão Imperador) — entrega valor imediato, é o que move agulha.
2. **Parte 2** (atualização de modelos) — uma migração só, baixo risco, melhora tudo.
3. **Parte 1** em ondas: começar pelos itens 1, 3, 5 (atribuição, anomaly real-time, Cmd+K).

Me diz: **executo as três partes sequencialmente, ou prefere começar só pela Parte 3 (Botão Imperador)?**
