# Consolidação de marketing e SEO — revisão de 10/10/2026

Implementação preparada para revisão, sem deploy, migração, cron novo, mudança de RLS ou alteração de tráfego.

## Integração e reconciliação do checkout

Base atualizada: `main` em `13f311c9ef2ed3bfbae8d6a3cef40069a14023b5`, posterior à auditoria em `f5be734d`. Cópia isolada; os dois checkouts antigos com alterações locais foram preservados. Branch `feat/marketing-seo-consolidation-20261010`.

Amplia o GrowthDashboard usado em DashboardClassic. O usuário escolhe projeto, fonte e período UTC (fim inclusivo). Os registros manuais de `imphq_growth_metrics` continuam separados. Não agrega CPA, taxas ou LTV manual de projetos distintos. Campo manual vazio não vira zero.

Consulta somente leitura confirmou em produção: project_id de project_notes é text; PK id UUID; growth possui UNIQUE(project_id,week_start,category,metric_name); vendas possui índice único parcial (project_id,external_transaction_id,produto_nome); ads possui PK id, sem unicidade por anúncio/dia/fonte. Não altera essas constraints.

## Contrato de dados

| Fonte | Tratamento |
|---|---|
| imphq_ads_spend | valor é gasto e init_checkout é o campo gravado pelos coletores atuais. Não soma aliases legados. Separa source/plataforma/moeda/dia; anúncio + dia deduplicado dentro do grupo. Sem identidade de anúncio não consolida valor. Todas as linhas CAMP:* são placeholders sintéticos do Zernio e excluídas. Meta e Zernio não somados. |
| imphq_vendas | status pago confirmado; período por data_venda, fallback created_at sinalizado; chave projeto/plataforma/transação/tipo/componente; bump soma receita sem novo pedido; bruto e líquido separados, null preservado; moeda apenas explicitamente registrada (senão UNKNOWN). Não usa moeda_original como moeda do valor normalizado. |
| Status posteriores | Lê status atual do histórico antes de filtrar o período. Reembolso de principal invalida seus bumps; reembolso vence duplicata aprovada. Sem versão de status, não reconstrói histórico nem certifica ordem de correções. Dados ambíguos exigem reconciliação. |
| Tracker | Sessões distintas com PageView/vsl_view/advertorial_view/pdp_view ou InitiateCheckout/checkout, não visitantes/pessoas. Remove QA/validation/codex-validation; heartbeat não compõe funil. Ponte TRK1.4 deduplicada por legacy_event id e sessão; preserva nomes originais. ViewContent não comprova play; Lead não comprova quiz. Não infere atribuição por UTM nem liga visitor_id Ticto ao visitante da página. |
| imphq_leads | Leads registrados no período, sem alegar cobertura completa de aquisição. Não consulta contatos. |
| Saúde ads | Somente campos de status e último sync da view existente; não lê credenciais. Leitura recente de painel/snapshot/cron não comprova sucesso de cada fonte. Fontes sem recibo de coleta permanecem “não comprovada”. |
| GA4/GSC, métricas diárias | Sem ingestão confirmada. Consulta de 10/10 encontrou imphq_metrics_daily vazia. Nenhuma ferramenta GA4/GSC disponível nesta execução; não houve OAuth, grants ou leitura de credenciais. |

Cada fonte é paginada em blocos de 1.000 (limite 20.000). Falha de qualquer página descarta o resultado parcial daquela fonte. Limite alcançado é leitura incompleta. Fontes independentes ainda aparecem. Ausência de linhas não vira zero; número zero em linha de insight disponível é observado, não prova cobertura do período. Defasagem: 36 horas sem último sucesso conhecido. Nenhuma fonte webhook/tracker tem cobertura completa assumida. Não calcula CPA, ROAS, lucro, conversão visita→venda ou receita atribuída.

TRK1.3, TRK1.4, OF2.1 e `maquina-de-testes.md` lidos. Não executa configuração de Purchase, reenvio de WhatsApp, propostas de metas/CPA/autonomia, ou rotinas OPS1. A arquitetura existente orienta o reaproveitamento; não cria um painel, medidor ou agente paralelo. Live-snapshot e a RPC antiga permanecem fora deste diff: seus números não são usados pela consolidação nova.

## SEO e revisão semanal

Usa `imphq_project_notes`, sem nova tabela. Pesquisa versionada conserva origem, URL, collectedAt original, score heurístico, volume null, decisão, resultado e evidência original. A seleção do projeto é explícita, sem mapear “Healthy” ou referências órfãs por palpite.

Importação JSON do radar existente (`vsugamele/healthy-legs-daily/scripts/keyword-opportunities.json`): SHA b064fa35226570529250a31f3139f2062821d789, generated_at 2026-10-05T19:47:18.541Z, 60 oportunidades. Chave estável SHA-256 em UUID por projeto/origem/data/keyword, upsert na PK id com ignoreDuplicates. Reimportar preserva decisões/resultados; relatório com nova data é nova evidência. Não modifica o gerador Healthy nem ativa transferência automática. O arquivo original está entregue separadamente nesta tarefa para importação após revisão do projeto de destino. Nenhum conteúdo médico ou comparativo foi publicado/aprovado.

O Growth permite salvar no Diário de Bordo uma revisão do período com fontes, totais observados, cobertura, lacunas e próximos passos. Pesquisas ficam legíveis também no Diário existente. A ação depende de clique do usuário autenticado; nenhum envio, schedule ou cron ativado.

## Evidência de reconciliação amostral

Consulta somente leitura via conector Supabase em 10/10. Amostra de 12 componentes aprovados JP, dos últimos registros disponíveis (06–07/10): 9 pedidos únicos, bruto 554 e líquido 277 na unidade UNKNOWN; 12/12 sem data.moeda, nenhuma data fallback. A mesma função usada pela tela reproduziu esses totais. São amostra, não totais completos do período; não denominados em BRL.

Par principal+bump observado: 47+37 bruto e 23,5+18,5 líquido, um pedido. Amostra de 12 registros de ads de 10/10: todos CAMP:* Zernio, todos excluídos, gasto null (não zero). Último sucesso Zernio na view: 10/10 06:20:09 UTC; Meta status error, último sucesso 26/06. Nenhuma conclusão sobre a cobertura de anúncios a partir dessa amostra.

## Verificação e limites

Testes focados de regras, paginação, fonte indisponível versus ausência na UI e importação SEO preservando decisão anterior. Typecheck, tsc --noEmit, lint dos arquivos e build executados localmente; resultados finais registrados no PR. Primeiro Vitest sob sandbox encontrou EPERM em realpath de dependência; execução autorizada resolveu, sem alterar segurança. Nenhum erro de setup refresh ou Desktop Commander precisou ser contornado.

Não testado: escrita real de notas/upsert com sessão de usuário em produção; UI autenticada em navegador; integração GA4/GSC; transferência automática Healthy→Império; cobertura completa por fonte; correção histórica dos snapshots/RPC existentes. Validação SQL em produção foi somente leitura. Não simula prova de coleta nem sucesso de importação real.

Antes de publicar: revisar o draft PR; homologar tela e RLS existente com sessão de usuário; conferir explicitamente projeto de destino do radar; aprovar deploy. Automação semanal, importação programada, conexões GA4/GSC ou alterações nos painéis ao vivo devem ter impacto e acesso revisados antes de ativação. A classificação das referências sem projeto continua pendente com evidência, sem atribuição automática.

## Validação independente e impacto de release

Primeiro commit remoto confirmado por git ls-remote e GitHub: 157bb0e15c68f4164e19b9a52961a1e97741732e. Main ainda 13f311c9; zero commits do main ausentes na branch; PR draft #3 mergeable=true. Checks nesse commit: status Vercel success; check-runs GitGuardian Security Checks completed/success e Vercel Preview Comments completed/success. GitHub Actions de PR: nenhuma execução. O workflow types-drift-check filtra migrations/types/workflow e não cobre este diff. Esses checks não substituem testes locais e o GitGuardian verificou o diff do PR, não certificou todo o repositório.

A integração Git existente gerou um preview automático; nenhum comando de deploy foi executado. Deployment dpl_BVvC5XZC4EYsJVe6mVf8JzieRc9r: READY, branch do PR, commit 157bb0e1, target não-production. URL verificada por metadata e um GET: https://imperiox-hlutkgwla-vinicius-projects-d7d8bd24.vercel.app — HTTP 302 para SSO Vercel. A CLI tem identidade existente vsugamele, mas não foi criado bypass ou grant. A ferramenta de navegador não iniciou por diretório de plataforma Windows ausente. Não houve login, leitura de cookies ou reutilização de storage de autenticação. A URL é privada; acesso da aplicação com sessão autenticada ainda não homologado.

Homologação isolada ampliada: 20 testes, incluindo troca de projeto/período/fonte, dados ausentes, fonte atrasada, valor 0 observado, cancelamento de edição SEO sem escrita e dois imports consecutivos pela UI mantendo uma linha e a decisão anterior. Backend simulado em memória e jsdom, sem tráfego ou dados fictícios em produção. O teste de Select precisou suprir scrollIntoView ausente no jsdom; o comportamento Radix não foi substituído.

Mapeamento real somente leitura: projeto ativo linfaflow (LinfaFlow), domínios linfaflow.vip e go.linfaflow.vip; nenhum site Healthy/healthy-legs-daily cadastrado e nenhum github_url/github_repo/site_url/website/domain desse repositório no cadastro Linfa. Portanto, não há vínculo explícito suficiente para importação silenciosa. É necessária a escolha humana do projeto de destino; as 60 pesquisas reais não foram inseridas.

GA4/GSC: não há ferramenta de API utilizável exposta nesta execução; Linfa ga_id é null; leitura de painel em 07/10 não comprova OAuth/API para ingestão. Acesso existente pode bastar se houver principal já autorizado, API habilitada e propriedade correta. Para GA4 Data API, confirmar property ID e acesso à propriedade com analytics.readonly; para GSC, confirmar siteUrl/propriedade e OAuth webmasters.readonly. Se qualquer elemento não existir, habilitar API, criar OAuth/principal/credencial ou conceder acesso é nova configuração e requer autorização específica. Nenhuma dessas ações foi executada. Fontes: [Google Analytics quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart) e [Search Console authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing).

Impacto: a produção Vercel observada está READY, target production, branch main, commit 13f311c9. Como a integração Git já publica o main, merge pode disparar build/deploy automático de produção. Não tratar merge e deploy como decisões independentes sem conferir o mecanismo atual. Este diff altera UI, leituras paginadas por projeto e ações explícitas de notas; não muda banco/RLS/coletores/cron/tráfego. A UI pode solicitar até 20 páginas por fonte; histórico de vendas acima de 20 mil será marcado incompleto. Homologar sessão e permissões existentes antes da liberação. Rollback do frontend não desfaz notas que o usuário inserir; registros SEO são versionados e identificados, e não devem ser apagados sem decisão específica.
