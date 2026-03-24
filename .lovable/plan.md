

# Plano: Melhorias no Projeto + Pesquisa Automatica de Avatar

## 2 frentes priorizadas

---

### 1. Melhorias na estrutura do Projeto

**A) Ofertas nos Produtos (Briefing)**

Dentro de cada produto no ProjetoBriefing, adicionar uma secao "Ofertas" alem dos links do produto:
- Array de ofertas no JSONB do produto: `{ nome, preco_de, preco_por, tipo_oferta, link_checkout, ativo }`
- UI: botao "+ Oferta" dentro de cada produto, card compacto com nome, preco de/por, link de checkout, badge ativo/inativo
- Permite ter varias ofertas por produto (tripwire, order bump, upsell, oferta principal)

**B) Pipeline merge no Briefing**

- Mover os sliders do Pipeline Rapido para dentro do ProjetoBriefing (ja existe o card "Pipeline Rapido" la)
- Adicionar as notas do pipeline (textarea por etapa) inline, colapsaveis
- Remover a aba "Pipeline" do ProjetoDetalhe

**C) Checklist de Integracao no Projeto**

Novo card no Briefing ou nova secao: "Setup de Integracao" com checklist visual:
- Items fixos: Clarity, Google Analytics, Webhook Pagamento, Facebook Pixel/CAPI, Resend, UTMs no site
- Cada item: checkbox + campo de status (pendente/configurado/verificado) + campo de observacao
- Dados salvos no `data.integrations_checklist` (JSONB, sem migration)
- Visual: cards com icone do servico, badge de status colorido (vermelho=pendente, amarelo=parcial, verde=ok)

---

### 2. Pesquisa Automatica de Avatar/Expert (com Firecrawl)

Transformar a aba "Pipeline" em "Pesquisa" -- ferramenta para extrair dados do expert automaticamente a partir de fontes externas.

**Pre-requisito**: Conectar o Firecrawl (connector). Sera solicitado durante a implementacao.

**Edge Function `expert-research`**:
- Recebe URL (site, YouTube channel, Instagram) + project_id
- Usa Firecrawl para scrape do conteudo (markdown + summary)
- Usa AI (via openflow-ai ou modelo similar) para extrair: tom de voz, temas que ensina, metodo/framework, bio, palavras que usa, transformacao prometida
- Retorna dados estruturados prontos para preencher os campos do Expert

**UI na aba "Pesquisa" (substitui Pipeline)**:
- Input de URL (site do expert, canal YouTube, perfil Instagram)
- Botao "Pesquisar e Extrair"
- Preview dos dados extraidos em cards organizados
- Botao "Aplicar ao Expert" que preenche os campos do ProjetoExpert automaticamente
- Botao "Salvar como Doc" que cria documento na imphq_kb com o conteudo bruto
- Historico de pesquisas realizadas (salvo no `data.research_history`)

**Campos extraidos automaticamente**:
- Nome, area de atuacao, bio
- Tom de voz (analise do texto)
- Temas/conteudos abordados
- Metodo/framework mencionado
- Palavras frequentes
- Transformacao prometida

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Adicionar ofertas nos produtos, notas do pipeline inline, card de checklist de integracao |
| `src/pages/ProjetoDetalhe.tsx` | Renomear aba Pipeline para Pesquisa, remover ProjetoPipeline, adicionar novo componente |
| `src/components/projeto/ProjetoPesquisa.tsx` | Novo: UI de pesquisa com input URL, preview de dados, aplicar ao expert, salvar como doc |
| `supabase/functions/expert-research/index.ts` | Novo: Edge function que usa Firecrawl + AI para extrair dados do expert |
| Conector Firecrawl | Sera solicitada conexao antes da implementacao |

