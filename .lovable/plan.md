

# Plano: Melhorias no importador Avatar HTML + Concorrentes + Docs

## Resumo dos problemas e soluções

### 1. Avatar HTML: extrair mais dados do arquivo

O parser atual (`parseAvatarHTML`) nao extrai varias secoes presentes no HTML real:
- **Copy Arsenal (mod-copy)**: headlines (`.hl-card`), anuncios (`.ad-card`), VSL (`.vsl-block`), objections (`.obj-card`), value stack (`.vs-item`), upsell (`.upsell-step`), pagina de vendas (`.copy-block`)
- **Problemas (mod-problemas)**: categorias completas (`.cat-block`), tabela mestre com scores, 15 campeoes, voyerismo detalhado, matriz de copy
- **Desejos (mod-desejos)**: blocos B1-B11 completos incluindo vontades, obsessoes, gostos, gatilhos detalhados (`.gat-card`), fases de ativacao (`.atv-phase`), arsenal de palavras (`.word-list .word`)
- **Filtro de Demanda**: dados do stat-bar (776 respostas, 90.3% feminino, etc.), tabela de score do avatar
- **Conteudo de 30 dias**: plano de conteudo semanal (`.content-week`)
- **Emotion flow**: sequencia de 6 emocoes (`.em-step`)
- **Camadas C1-C4**: conteudo interno das listas (`.dl li`) dentro de `.acc-card`

**Acao**: Expandir `parseAvatarHTML` para extrair:
- `filtro_demanda` (stat-bar + score table)
- `headlines` (de `.hl-card`)
- `anuncios` (de `.ad-card`)
- `vsl_timeline` (de `.vsl-block`)
- `pagina_vendas` (de `.copy-block`)
- `objecoes` (de `.obj-card`)
- `value_stack` (de `.vs-item`)
- `upsell_steps` (de `.upsell-step`)
- `emocoes_sequencia` (de `.em-step`)
- `plano_conteudo` (de `.content-week`)
- `arsenal_palavras` (de `.word-list .word` e `.wpill`)
- Melhorar extracao de camadas C1-C4 (conteudo das listas internas)

Atualizar `getImportSummary` para mostrar as novas secoes.

| Arquivo | Acao |
|---|---|
| `src/components/projeto/avatar/AvatarImporter.tsx` | Expandir parser com ~15 novos extratores |

---

### 2. Concorrentes: duplicacao + delete individual

**Problema de duplicacao**: Quando o usuario importa arquivos com concorrentes que ja existem no banco, `importCompetitors` sempre faz INSERT sem verificar nomes existentes. Resultado: colunas duplicadas.

**Solucao**: No `importCompetitors`, antes de inserir, verificar se ja existe concorrente com mesmo nome (case-insensitive). Se existir, fazer MERGE (update dos campos nao-vazios) ao inves de insert.

**Delete de colunas**: Ja existe `removeCompetitor` no hook, mas NAO ha botao de delete visivel nas tabelas/abas. Apenas no DossieTab tem o botao. Precisa adicionar botao de delete no header de cada coluna da tabela (VisaoGeralTab, MercadoTab, CopywritingTab, OfertaTab).

| Arquivo | Acao |
|---|---|
| `src/components/projeto/concorrentes/useConcorrentes.ts` | Merge ao inves de insert para nomes existentes |
| `src/components/projeto/concorrentes/VisaoGeralTab.tsx` | Botao delete no header de cada coluna |
| `src/components/projeto/concorrentes/MercadoTab.tsx` | Botao delete no header |
| `src/components/projeto/concorrentes/CopywritingTab.tsx` | Botao delete no header |
| `src/components/projeto/concorrentes/OfertaTab.tsx` | Botao delete no header |
| `src/components/projeto/concorrentes/ConcorrentesTab.tsx` | Passar `removeCompetitor` para todas as tabs |

---

### 3. Ofertas: parser nao identifica formato "ofertas-2.md"

O arquivo `ofertas-2.md` tem o titulo "ANÁLISE DE OFERTAS ESCALADAS" que deveria casar com o regex no `detectAndParse` (`"análise de ofertas"`). Porem, o titulo real contem "ESCALADAS" e "OBJ 2". O pattern `"ofertas validadas"` tambem esta presente no corpo. Preciso verificar se o encoding/acentos estao bloqueando o match, e tambem melhorar os patterns.

**Acao**: Melhorar `detectAndParse` com patterns mais flexiveis e adicionar fallback para "ofertas escaladas". Tambem ajustar `parseOfertasReport` para ignorar a secao do JP Freitas (#4) que tem `*(produto atual — referência para comparação)*`.

| Arquivo | Acao |
|---|---|
| `src/components/projeto/concorrentes/CompetitorImporter.tsx` | Melhorar detecao de ofertas + parsing |

---

### 4. Salvar documentos importados em Docs do projeto

Quando o usuario faz upload de arquivos (MD, HTML), alem de parsear, salvar o conteudo como documento na tabela `imphq_docs` automaticamente para referencia futura.

| Arquivo | Acao |
|---|---|
| `src/components/projeto/concorrentes/CompetitorImporter.tsx` | Apos import, salvar cada arquivo como doc |
| `src/components/projeto/concorrentes/ConcorrentesTab.tsx` | Receber `projectId` e passar ao importer |
| `src/components/projeto/avatar/AvatarImporter.tsx` | Salvar HTML como doc tambem |

---

### 5. Resposta sobre GitHub

Sim, a sincronizacao Lovable ↔ GitHub e bidirecional. Editar pelo GitHub (ou IDE local) e fazer push para o branch default (`main`) sincroniza automaticamente de volta para o Lovable.

---

## Resumo de arquivos

| Arquivo | Mudancas |
|---|---|
| `src/components/projeto/avatar/AvatarImporter.tsx` | +15 extratores para copy, problemas, desejos, conteudo, emocoes; salvar como doc |
| `src/components/projeto/concorrentes/CompetitorImporter.tsx` | Fix detecao ofertas; salvar como docs |
| `src/components/projeto/concorrentes/useConcorrentes.ts` | Merge por nome existente ao inves de duplicar |
| `src/components/projeto/concorrentes/VisaoGeralTab.tsx` | Botao delete em cada coluna |
| `src/components/projeto/concorrentes/MercadoTab.tsx` | Botao delete |
| `src/components/projeto/concorrentes/CopywritingTab.tsx` | Botao delete |
| `src/components/projeto/concorrentes/OfertaTab.tsx` | Botao delete |
| `src/components/projeto/concorrentes/ConcorrentesTab.tsx` | Passar removeCompetitor + projectId para tabs e importer |

