# Auditoria — Projetos, Referências, Gerenciador

Foco pedido: **Inteligência (IA) + UX/produtividade + Visualização/insights**. Para cada área listo os gaps observados no código atual e priorizo por impacto/esforço.

---

## 1) PROJETOS (`Projetos.tsx` + `ProjetoDetalhe.tsx`, ~1.000 linhas, 25+ subcomponentes)

### Gaps detectados
- **Lista (`Projetos.tsx`)**: cards apenas com nome/ícone. Sem KPIs inline (receita 7d, ROAS, leads novos, health), sem ordenar por prioridade ("Vendendo" deveria flutuar no topo automaticamente), sem busca por tag/produto, sem visualização kanban por estágio (validação/escala/maturidade).
- **ProjetoDetalhe**: 15+ tabs sem hierarquia visual — usuário se perde. Não há "tab inteligente" que destaca o que precisa de atenção *hoje*.
- **Plano de Ataque (Imperius)**: existe mas é one-shot. Não persiste histórico nem mede execução de cada passo.
- **HealthScoreCard** existe mas não dispara ações nem alimenta a fila do Imperius.
- **Cross-projeto**: zero comparativo entre projetos (qual está crescendo, qual está estagnado).

### Melhorias priorizadas
| # | Melhoria | Tipo | Impacto |
|---|----------|------|---------|
| P1 | **Cards de projeto com KPIs vivos** (receita 7d/30d, ROAS, leads, delta % vs período anterior, badge de health) + ordenação automática por estágio/receita | UX + Insight | Alto |
| P2 | **"Foco do dia" no topo de `ProjetoDetalhe`** — banner que resume os 3 sinais críticos vindos do scout (queda CTR, lead quente parado, meta em risco) com CTAs diretos | IA + UX | Alto |
| P3 | **Plano de Ataque persistente**: salvar cada plano em `imphq_sales_paths`, marcar passos como concluídos, mostrar progresso e revisar semanalmente via Imperius | IA | Alto |
| P4 | **Visão Portfólio** (`/projetos` modo dashboard): tabela comparativa cross-projeto com receita, ROAS, leads, health e tendência (sparkline) | Insight | Médio |
| P5 | **Reorganização das tabs** em grupos colapsáveis (Estratégia · Operação · Conteúdo · Performance) com badge de "tem novidade" | UX | Médio |
| P6 | **HealthScore acionável**: cada métrica vermelha vira sugestão na ActionInbox do Imperius | IA | Médio |

---

## 2) REFERÊNCIAS (`Referencias.tsx`, 919 linhas)

### Gaps detectados
- Biblioteca é **passiva**: usuário salva, mas a IA não usa proativamente. `geracao-campanhas-whatsapp` puxa branding/avatar mas ignora referências marcadas com score alto.
- **Sem similaridade visual/semântica**: busca só por título/tag. Não há embeddings para "me mostre criativos parecidos com este".
- **Sem score automático**: usuário precisa estrelar manualmente. Anúncios sincronizados de `imphq_ads_creatives` (via filterOrigem=ads) não herdam CTR/ROAS como score.
- **Pastas virtuais via `content_category` prefix** funcionam mas: sem drag&drop entre pastas, sem mover em lote, sem cover automática.
- **Sem "swipe mode"** (Tinder-like) para triagem rápida — hoje precisa abrir cada uma.
- **Sem extração automática de copy/hooks** de criativos salvos (já temos `firecrawl`/`OCR` em outras partes).

### Melhorias priorizadas
| # | Melhoria | Tipo | Impacto |
|---|----------|------|---------|
| R1 | **Score automático em refs vindas de Ads** (CTR/ROAS → score 1–5 colorido) + ordenação "Top performers primeiro" | Insight | Alto |
| R2 | **"Inspire-se com isso" no gerador de copy/campanha**: ao gerar criativo, IA cita 2-3 referências top-score do mesmo produto/tipo e justifica | IA | Alto |
| R3 | **Triagem rápida (Swipe Mode)**: modal full-screen com next/prev, atalhos teclado (★ favoritar, T tag, D delete) | UX | Médio |
| R4 | **Extração automática de copy** de criativos (OCR/transcrição vídeo) salvando em campo `extracted_copy` pesquisável | IA + Insight | Médio |
| R5 | **Busca semântica** com embeddings (`pgvector`) — "criativos com promessa de transformação rápida" | IA | Médio (esforço maior) |
| R6 | **Drag&drop e bulk move** entre pastas + cover automática (primeira imagem da pasta) | UX | Baixo-Médio |

---

## 3) GERENCIADOR (`Gerenciador.tsx`, 217 linhas + 19 componentes)

### Gaps detectados
- **Alertas isolados**: `AlertsHeader`, `AnomalyBadge`, `AttributionDiagnostic`, `TictoEventFlowDiagnostic` não geram ações na fila do Imperius — só mostram.
- **Regras (`RulesPanel`)**: existe mas é reativo (pausar se CPA > X). Não há regras preditivas ("pausar se CTR caindo 3 dias seguidos") nem sugestões automáticas baseadas em histórico de `imphq_ads_actions`.
- **Sem comparativo entre criativos**: `CampaignComparator` compara campanhas mas não ads individuais (qual ângulo está performando melhor).
- **Histórico (`AcoesHistorico`)**: mostra ações mas não mede impacto (ROAS antes/depois da pausa, recuperação após boost).
- **Atribuição**: já tem `AttributionDiagnostic` mas falta painel consolidado de "verdade vs Meta vs UTM" lado a lado, com diff destacado.
- **Bulk actions**: existem mas sem confirmação inteligente (ex: "vai pausar 12 ads que somam R$ 4.300/dia — confirma?").

### Melhorias priorizadas
| # | Melhoria | Tipo | Impacto |
|---|----------|------|---------|
| G1 | **Alertas viram ações no Imperius**: cada anomalia 2σ ou CPA fora do range gera item em `imphq_ai_actions` com sugestão pronta (pausar, escalar, duplicar) | IA | Alto |
| G2 | **Regras preditivas + sugestão automática**: scout analisa últimas 30 ações que deram certo e sugere novas regras ("Você sempre pausa ads com CTR<0.8% em 3 dias — quer automatizar?") | IA | Alto |
| G3 | **Impact tracking no histórico**: cada linha mostra ROAS/CPA antes×depois (D-7 vs D+7) com badge verde/vermelho | Insight | Alto |
| G4 | **Comparativo de ads (ângulos)**: agrupa criativos por hook/promessa (via embedding do texto) e ranqueia | IA + Insight | Médio |
| G5 | **Painel de Atribuição lado-a-lado**: Meta vs UTM vs Vendas reais, com % de discrepância destacado | Insight | Médio |
| G6 | **Confirmações inteligentes em bulk**: prévia do impacto financeiro/dia + lista do que vai mudar | UX | Médio |

---

## Ordem de execução recomendada (sprints curtos)

**Sprint 1 — Quick wins de alto impacto (1–2 dias)**
- P1 (KPIs nos cards de projeto)
- R1 (score automático em ads-refs)
- G3 (impact tracking no histórico)

**Sprint 2 — Inteligência conectada (2–3 dias)**
- P2 (Foco do dia) + P6 (HealthScore → Imperius)
- G1 (Alertas → fila Imperius)
- R2 (refs no gerador de copy)

**Sprint 3 — Planejamento e portfólio (2 dias)**
- P3 (Plano de Ataque persistente)
- P4 (Visão Portfólio)
- G2 (Regras preditivas)

**Sprint 4 — Refinamentos UX (1–2 dias)**
- P5 (reorg tabs), R3 (swipe), R6 (drag&drop), G6 (bulk inteligente)

**Sprint 5 — Heavy IA (opcional, 3+ dias)**
- R4 (OCR copy), R5 (busca semântica), G4 (comparativo por ângulo)

---

## Detalhes técnicos

- **Tabelas a tocar**: `imphq_projects` (campo `data.kpis_cache`), `imphq_references` (novos: `auto_score`, `extracted_copy`, `embedding vector(1536)`), `imphq_ai_actions` (já existe — só pluga novos producers), `imphq_sales_paths` (nova para P3), `imphq_ads_actions` (já tem — adicionar campos `impact_roas_delta`, `impact_cpa_delta`).
- **Edge functions novas**: `project-kpis-aggregator` (P1, roda 1x/h via cron), `ads-impact-tracker` (G3, dispara 7d após cada ação), `references-auto-scorer` (R1, trigger no insert de ads).
- **Imperius scout**: estender `imperius-scout` para incluir os novos triggers (HealthScore vermelho, anomalia ads, plano de ataque atrasado).
- **Sem breaking changes** — tudo aditivo.

---

Me diga qual sprint começamos (sugiro Sprint 1) ou se quer reordenar.