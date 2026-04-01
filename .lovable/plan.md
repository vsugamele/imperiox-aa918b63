

# Plano: Funcionalidades inspiradas no Mira Ads para o Imperio HQ

---

## O que o Mira Ads oferece

O Mira Ads automatiza Meta Ads com: criação de campanhas por linguagem natural, templates reutilizáveis, publicação em lote, otimização de budget com IA, galeria de criativos e dashboard multi-conta.

## O que podemos adaptar (3 funcionalidades viáveis)

Criar campanhas diretamente via API do Facebook exige App Review avançado. Porém, podemos usar IA para **planejar e gerar drafts** de campanhas, otimizar o que já existe e organizar criativos — tudo isso usando o que já temos (OpenRouter, facebook-ads-sync, dados do projeto).

---

## 1. Gerador de Campanhas com IA (Drafts)

Botão "Gerar Campanha com IA" na aba Ads do projeto. Abre um Dialog onde o usuário descreve em linguagem natural o que quer (ex: "5 campanhas de conversão para mulheres 25-45 interessadas em skincare"). A IA usa o contexto completo do projeto (avatar, produtos, copy arsenal, dados de ads anteriores) para gerar drafts estruturados com:

- Nome da campanha
- Objetivo (conversão, tráfego, leads)
- Público-alvo sugerido (interesses, idade, gênero)
- Budget diário sugerido
- 2-3 variações de copy (headline + texto primário + CTA)
- Sugestão de criativos baseada nos criativos do Facebook já sincronizados

Os drafts ficam salvos no JSONB do projeto (`data.campaign_drafts`) para consulta futura. Não publica nada automaticamente — é um planejador.

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx` (novo Dialog + botão na aba Ads)
**Edge Function**: `supabase/functions/openflow-ai/index.ts` (nova action `generate_campaign_drafts`)

---

## 2. Consultor de Otimização com IA

Botão "Analisar Performance" na aba Ads. A IA recebe os dados reais de ads sincronizados (spend, CTR, CPC, frequência, conversões) e gera um relatório com:

- Campanhas com melhor e pior ROI
- Alertas de frequência alta (saturação de público)
- Sugestões de redistribuição de budget
- Criativos com melhor CTR vs piores
- Recomendações de novos públicos baseadas no avatar

Resultado exibido em Dialog com seções colapsáveis e botão copiar.

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx` (botão + Dialog de análise)
**Edge Function**: `supabase/functions/openflow-ai/index.ts` (nova action `analyze_ads_performance`)

---

## 3. Galeria de Criativos com métricas

Os criativos já são sincronizados do Facebook (`facebook_creatives` no JSONB do projeto), mas não são exibidos em nenhum lugar. Criar uma sub-aba "Criativos" dentro de Ads que mostra:

- Grid de cards com thumbnail, título e body text de cada criativo
- Se possível cruzar com dados de ads para mostrar qual criativo performou melhor
- Botão para copiar o texto do criativo
- Filtro por status (ativo/pausado) se disponível

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx` (nova sub-seção na aba Ads)

---

## Resumo de alterações

| Arquivo | Acao |
|---|---|
| `src/components/projeto/ProjetoFinancas.tsx` | Botão "Gerar Campanha IA" + "Analisar Performance" + Galeria de Criativos na aba Ads |
| `supabase/functions/openflow-ai/index.ts` | Actions `generate_campaign_drafts` e `analyze_ads_performance` com contexto completo |

