# Story STR1.1 — Biblioteca de estratégias (playbooks) aplicável aos mapas

Pedido (02/10/2026): deixar o sistema mais estratégico. Ele precisa ter as estratégias de marketing bem pensadas (X1, webinar, lançamento pago, lançamento gratuito, anúncio direto, canal orgânico, SEO). Também precisa saber desenhar cada uma no projeto, com tudo medido.

Decisões do Vinicius:
- Piloto: SlimSoda.
- Famílias: as quatro (X1 + anúncio direto, webinar/lançamentos, canal orgânico, SEO/conteúdo).
- Ritmo: "fundamentos de tudo antes".

Esta é a primeira fundação da épica STR1.

## Feito (02/10/2026)

### Banco
- [x] Tabelas `imphq_playbooks`, `imphq_playbook_steps` (contrato O QUÊ…SE FALHAR, executor, skill, métrica, checklist, dependências) e `imphq_playbook_applications` (onde cada estratégia foi aplicada), com RLS para usuários logados.
  - Migração `20261002_imphq_playbooks.sql`, aplicada.
  - Fica separada de `imphq_funnel_templates`, que não muda.

### Catálogo de métricas
- [x] `_shared/metric-keys.ts`: 25 chaves, cada uma com fonte e `disponivel`.
- [x] O que ainda não tem fonte aparece como "fonte ainda não ligada", nunca como número: SEO/Search Console, presença na live e recuperadas.

### Conteúdo das estratégias
- [x] `_shared/playbook-library.ts` traz 7 estratégias com 55 etapas:
  - X1 (anúncio para conversa);
  - anúncio direto (página e checkout);
  - webinar perpétuo;
  - lançamento pago;
  - lançamento gratuito;
  - canal orgânico (mineração → persona → conta e link na bio com UTM → roteiros → produção → publicação com aprovação → comentário-palavra → DM → métricas);
  - SEO e conteúdo.
- [x] Conferências feitas:
  - as 14 skills citadas existem em `imphq_skills`;
  - os 22 tipos de etapa existem no catálogo do mapa.
- [x] Para regravar o conteúdo no banco: `scripts/playbooks-seed.ts`.
  - Carregado no banco: 7 playbooks e 55 etapas.

### Regra de desenho no mapa
- [x] Planejador em `_shared/playbooks.ts`:
  - uma seção por fase, abaixo do que já existe no mapa;
  - setas por dependência;
  - contrato no formato lido por `readStageContract`.
- [x] A etapa equivalente que já existe no mapa é ligada, não duplicada. Conta como equivalente:
  - o mesmo tipo com nome parecido; ou
  - um tipo específico que aparece uma vez só no mapa e no playbook.
- [x] Gravador único em `_shared/playbook-apply.ts`, usado pelo MCP e pela tela:
  - não cria moldura vazia nem seta repetida;
  - a etapa nova nasce com `[agent_status:pending]` e `[agent_playbook:id#ordem]`;
  - registra a aplicação.

### MCP
- [x] `project-mcp`, publicado: `list_playbooks` (lista ou detalhe com etapas e onde foi aplicado).
- [x] `project-mcp`, publicado: `apply_playbook`.
  - Sem `confirmar=true` só mostra o plano.
  - Com `confirmar=true`, faz o snapshot do mapa e grava.

### Tela
- [x] `/estrategias`, item "Estratégias" no menu junto de Funis.
  - Mostra cards por família, com animação.
  - O detalhe traz quando usar e quando evitar, o horizonte, as métricas com meta (a principal em destaque), o passo a passo por fase com executor, skill e métrica, e os cuidados.
- [x] "Aplicar a um projeto":
  - escolhe o projeto e o mapa;
  - mostra a prévia do que é novo e do que é ligado;
  - faz backup e grava.

### Testes
- [x] `src/test/playbooks.test.ts` (17).
- [x] `src/test/estrategias.test.tsx`.
- [x] O harness do MCP foi atualizado.

### Simulação no mapa real da SlimSoda (nada gravado)

| Estratégia | Novas | Ligadas |
|---|---|---|
| Anúncio direto | 1 (Upsell) | 8 |
| X1 | 2 | 5 |
| Canal orgânico | 5 | 3 |
| Webinar | 4 | 5 |
| Lançamento pago | 6 | 3 |
| Lançamento gratuito | 4 | 3 |
| SEO | 6 | 0 |

## Pendente
- [ ] Aplicar ao piloto SlimSoda: escolher qual estratégia (ou quais) entra no mapa real. Isso altera um mapa em uso, então a escolha é do Vinicius.
- [ ] Conferência visual logado em `/estrategias`.
- [ ] Próximas fundações da épica STR1:
  - STR1.2: valor real × meta da métrica em cada etapa e alertas em Hoje;
  - STR1.3: experimentos;
  - STR1.4: canal ponta a ponta com GeeLark;
  - STR1.5: animação do fluxo com volume real;
  - STR1.6: auditoria de SEO;
  - STR1.7: diagnóstico semanal pelo MCP.

## File List
- supabase/migrations/20261002_imphq_playbooks.sql
- supabase/functions/_shared/metric-keys.ts
- supabase/functions/_shared/playbooks.ts
- supabase/functions/_shared/playbook-library.ts
- supabase/functions/_shared/playbook-apply.ts
- supabase/functions/project-mcp/index.ts
- scripts/playbooks-seed.ts
- src/hooks/usePlaybooks.ts
- src/pages/Estrategias.tsx
- src/components/estrategias/ApplyPlaybookDialog.tsx
- src/App.tsx
- src/components/AppSidebar.tsx
- src/integrations/supabase/types.ts
- src/test/playbooks.test.ts
- src/test/estrategias.test.tsx
- src/test/map-agent-status-mcp.test.ts
