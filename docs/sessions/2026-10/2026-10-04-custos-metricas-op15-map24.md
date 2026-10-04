# OP1.5 / MAP2.4 — Entrega de custos de IA e métricas por etapa

04/10/2026, conferência final por volta de 20:00 BRT. Escopo: opção 1 aprovada nos itens 5/6. Papéis @dev, @data-engineer, @qa e @devops executados nesta sessão, sem subagentes. Nenhuma mensagem ou chamada paga foi disparada para validar a entrega.

## Resultado

- Custos: contexto de projeto imutável por chamada, inclusive em concorrência e embeddings. Falhas de gravação registradas sem alterar a resposta do provedor. Consumo não informado permanece null e a interface mostra A confirmar/total parcial.
- Mapas: métricas pela combinação projeto + URL da etapa, sem usar o total do projeto como tráfego de todas as páginas. Fonte, escopo e horário visíveis na visão Caminho, inclusive alternativas/etapas fora do caminho.
- Deduplicação entre tracker novo e legado por sessão; taxas com a mesma coorte de visualizações. Clique no CTA, checkout iniciado e compra têm significados separados.
- Eventos de validação identificados excluídos dos agregados. Metas anteriores, entrada manual e eventos históricos preservados.
- Pilotos antes do lote: Instagram webhook para custos; VSL SlimSoda para mapas. Depois: dez funções publicadas e 12 etapas existentes vinculadas a sessões de página.

## Acessos de operação

- Custos: https://imperiox.vercel.app/custos-ia
- Mapa SlimSoda: https://imperiox.vercel.app/funis?view=mapa&map=a2e01bd8-f262-43d9-a91f-779ea371ca40 — selecionar Caminho e expandir Fora do caminho para ver as páginas Powder.
- Mapa das quatro ofertas: https://imperiox.vercel.app/funis?view=mapa&map=67f9f17a-e75e-45f6-a5e3-20198bfdd692
- GitHub: https://github.com/vsugamele/imperiox-aa918b63

## Evidências observadas

Primeiras chamadas naturais após publicação, sem forçar atendimento:

| Função | Projeto | UTC | Tokens | USD |
|---|---|---|---:|---:|
| instagram-webhook | jp_freitas | 22:42:23 | 4396 | 0.000665 |
| instagram-followup-scheduler | jp_freitas | 22:50:03 | 3693 | 0.000565 |

Chrome autenticado mostrou 15 chamadas nos últimos 30 dias, 67027 tokens e USD 0.0103 arredondados: 8089 tokens de JP Freitas, histórico restante Sem projeto. A tela não apresentou erros de console na leitura. Os valores são uma fotografia desse horário, não um saldo permanente.

Etapas próprias, últimos 7 dias:

| Página | Sessões | CTA | Checkout iniciado |
|---|---:|---:|---:|
| SlimSoda VSL | 4 | 0 | 0 |
| SlimSoda ADV1 | 1 | 0 | 0 |
| CardioFlush VSL | 4 | 0 | 0 |
| MemoFlow VSL | 4 | 0 | 0 |
| Leaftide VSL | sem eventos de operação | — | — |
| SlimSoda PDP / ADV2–4 | sem eventos de operação | — | — |

São sessões registradas sem marca de validação; isso não comprova aquisição orgânica, pessoa única ou compra. 14 eventos SlimSoda identificados como validação foram excluídos. No Chrome, SlimSoda confirmou VSL=4, ADV1=1, PDP=sem dado, fonte Tracker do funil e horário de atualização.

Capturas locais (fora do Git, sem copiar contatos de clientes):

- C:/Users/vsuga/.codex/visualizations/2026/10/03/01a0ff10-6870-7693-9cab-69fc80a9e9cf/mapa-metricas-slimsoda.jpg
- C:/Users/vsuga/.codex/visualizations/2026/10/03/01a0ff10-6870-7693-9cab-69fc80a9e9cf/custos-ia-producao.jpg

## Validação

- npm test: 698 testes em 106 arquivos, passou.
- npm run typecheck: passou com tipos completos regenerados do banco vivo.
- npm run lint: zero erros; duas advertências anteriores (Fast Refresh em CompanyMapTacticalBar; dependência gerarQrCode em ConnectWhatsAppModal).
- npm run build: passou; alertas de chunks grandes/import misto existentes. Build remoto do código final também passou.
- Deno: dez funções checadas; fontes remotas conferidas arquivo por arquivo; OPTIONS HTTP 200 em todas após deploy.
- Banco: nullable aceito em transação revertida; oito regressões da RPC passaram em supabase/tests/map_stage_metrics.sql; zero linhas/fixtures de teste persistentes.
- Metas: somente 12 nós com metrics_target vazio receberam a chave sessoes_pagina; nenhum número de meta inventado.

## Deploy Result

- URL: https://imperiox.vercel.app
- Deployment URL: https://imperiox-lc8uvvok3-vinicius-projects-d7d8bd24.vercel.app
- Target: production
- Status: READY, alias imperiox.vercel.app confirmado
- Deployment: dpl_58XFn7f2dpewvbPTMRRn6sRUHwqZ
- Commit de código: 92bc05f94a3d581643ef43faf89e49c1659a2fb2
- Framework: Vite
- Build remoto: aproximadamente 43 segundos segundo buildingAt/ready

Commits de implementação: 648b1298 (OP1.5), 244cf74b (MAP2.4), 92bc05f9 (total de tokens desconhecidos). Todos em main; publicação pela integração Git existente. O commit deste handoff é documental e não muda os assets verificados acima.

### Post-Deploy Observability

- Error scan: nenhum log encontrado com level=error e since=1h para os dois deploys publicados. Isso é ausência de registros correspondentes, não garantia de ausência de falhas no cliente.
- Chrome: custos sem erros de console; mapa leu as métricas de produção.
- Drains: inventário indisponível (API retornou 404); não concluir que não existem.
- Monitoring: checagem de tipos existente preservada; não foi criada nova automação de monitoramento nesta entrega.

## Backend publicado

Projeto Supabase tkbivipqiewkfnhktmqq. Migrações aplicadas: ai_usage_nullable_consumption, imphq_page_metrics, imphq_page_metrics_cohort. Security invoker/RLS mantidos; RPC de métricas executável apenas por authenticated/service_role.

| Função | Versão publicada |
|---|---:|
| instagram-webhook | 337 |
| instagram-followup-scheduler | 300 |
| hot-lead-responder | 362 |
| wa-learn-from-sale | 220 |
| wa-consultive-followup | 98 |
| wa-pitch-followup | 169 |
| wa-ai-decide-escalation | 260 |
| wa-ai-conv-scoring | 260 |
| wa-ai-detect-gaps | 262 |
| nurture-auto-segment | 347 |

verify_jwt e dependências de cada bundle preservados. Nove funções têm projeto identificável; nurture-auto-segment agrega projetos e continua compartilhada. A prova natural cobre webhook/scheduler; as demais têm verificação de código, tipos, testes e inicialização, sem chamada paga forçada.

## CLI / consulta da fonte

Executar com acesso já autorizado ao banco; não incluir chaves em comandos/documentos:

```sql
select public.imphq_page_metrics('slimsoda', now() - interval '7 days');

select function_name, project_id, count(*) as chamadas,
       sum(cost_usd) as custo_informado,
       count(*) filter (where cost_usd is null) as custo_a_confirmar
from public.imphq_ai_usage
where created_at >= now() - interval '30 days'
group by function_name, project_id;
```

## Rollback disponível

- Frontend anterior à entrega: dpl_DoLFCN5CpXH1fHnxMmyryS9AumGx, commit 29f119091dc599e3e402301ff5053b378b163899, https://imperiox-g1x815p0j-vinicius-projects-d7d8bd24.vercel.app. Reverter alias com o fluxo Vercel existente somente se necessário; nenhum rollback foi executado.
- Código antigo das funções no commit-base 29f11909. Restaurar somente as funções afetadas, preservando verify_jwt/dependências; não publicar todas as funções do repositório.
- Migrações são compatíveis com UI antiga. Manter colunas nullable/RPC/index é seguro no rollback de código. Não converter null em zero nem restabelecer NOT NULL enquanto houver nulls.
- Vínculos adicionados ao mapa podem ser revertidos de forma guardada, sem apagar nós/eventos ou sobrescrever ajustes posteriores:

```sql
update public.imphq_company_map_nodes
set metrics_target = '{}'::jsonb
where metrics_target = '{"key":"sessoes_pagina"}'::jsonb
and id in (
 'af110001-0000-4000-8000-000000000003',
 'af110002-0000-4000-8000-000000000003',
 'af110003-0000-4000-8000-000000000003',
 'af110004-0000-4000-8000-000000000003',
 'af110005-0000-4000-8000-000000000001',
 'af110005-0000-4000-8000-000000000002',
 'af110005-0000-4000-8000-000000000003',
 'af110005-0000-4000-8000-000000000004',
 'af110005-0000-4000-8000-000000000005',
 'af110007-0000-4000-8000-000000000001',
 'af110007-0000-4000-8000-000000000002',
 'af110007-0000-4000-8000-000000000003'
);
```

## Checkout e trabalho paralelo

Implementação/validação isoladas em C:/Users/vsuga/.codex/worktrees/custos-metricas-op15-map24/Imperio System, branch fix/custos-metricas-op15-map24. Código consolidado por fast-forward no checkout principal feat/operacao-diaria. SHA256 confirmou os mesmos conteúdos nos 19 arquivos concorrentes; não foram publicados.

Rascunhos iniciais desta própria tarefa preservados no stash 34be39d9aaf1fe127bcad6977ff02cbe151379b8. Não aplicar esse stash inteiro: ele representa versões anteriores agora substituídas pelos commits validados. Não remover o snapshot nem os arquivos concorrentes para limpar o git status.

## Limites e próximos passos

Escopo dos itens 5/6 concluído. Os 13 registros históricos sem projeto continuam sem projeto; não há atribuição retroativa por suposição. Custos abrangem automações instrumentadas e a UI mantém seu limite existente de 5000 registros. Não é uma fatura completa de todos os fornecedores.

As páginas Leaftide e SlimSoda PDP/ADV2–4 precisam de eventos de operação para mostrar contagens; visitas identificadas como validação não entram. Receita/CPA por URL exigem atribuição de compra confiável e não foram inventados. Configuração/certificação de Meta/GA e campanhas não foram ampliadas neste escopo.
