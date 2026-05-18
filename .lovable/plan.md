# Semana 4 — Polish & QA

Objetivo: amarrar pontas soltas, remover atrito e deixar tudo que foi entregue nas semanas 1–3 production-ready. Sem novas features.

## 1. Loading & empty states ⏳
- `NextActionCard`, `BucketCard` (após dispatch), `PredictiveDashboard` recommendations: skeletons + estados vazios consistentes (copy curto, ícone, sem placeholder genérico).

## 2. Toasts & feedback ⏳
- `recovery-bucket-dispatch`: toast com `sent/skipped/total`, link "Ver logs" → `/imperius`.
- Erros de provider WhatsApp ausente: toast `destructive` com CTA "Configurar" → `/whatsapp`.

## 3. Anti-spam visual ⏳
- Em `BucketCard`, mostrar count de "já disparados nas últimas 24h" pra evitar clique duplicado.

## 4. Performance ⏳
- `NextActionCard`: usar `staleTime: 30s` (já temos default 60s, mas card é tempo-real).
- `PredictiveDashboard`: memoizar mapping de CTAs.

## 5. Acessibilidade ⏳
- `aria-label` em botões de ícone (`Send`, `Crown`, `ArrowRight`).
- Foco visível em cards clicáveis.

## Fora de escopo
- Novas edge functions, novas tabelas, redesign visual.

Pós-Semana 4: roadmap concluído. Próximos passos definidos pelo usuário.
