
# Swipe File de Copys — Plano

Criar uma biblioteca global de copys (roteiros, anúncios, VSLs, posts) com **engenharia reversa por IA** e **motor de geração** que reaproveita o que está salvo para gerar varia­ções, fórmulas reutilizáveis e campanhas inteiras pros seus produtos.

## 1. Onde fica

- Nova rota global **`/swipe`** na sidebar (ícone 📚, junto de Studio/Mentes).
- Cada copy pode ser **vinculada opcionalmente** a um Projeto e/ou Produto — assim você filtra "só do nicho cartomante", "só do produto Soulmate Test" etc.
- Atalho dentro do **Projeto Detalhe** → botão "Ver swipes deste nicho" que pré-filtra.

## 2. Estrutura de cada Swipe (anatomia)

Campos canônicos baseados no JSON que você mandou + extensões:

**Identificação**
- título, criador (@), plataforma (IG/TikTok/YT/LP), formato (Reel, VSL, anúncio, e-mail), idioma, data de captura

**Anatomia da copy** (editor por blocos)
- gancho, participação ativa, narrativa, reframe, CTA engajamento, CTA venda
- + blocos livres adicionais (promessa, inimigo, mecanismo, prova, oferta) que o usuário pode adicionar conforme o tipo

**Metadados estratégicos**
- mecanismo (ex: "segredo + escassez"), gatilhos (escassez, prova social, curiosidade…), nicho, produto-alvo, público-alvo
- tags livres, rating (1–5 ⭐), status (rascunho / validado / campeão)

**Mídia & fonte**
- URL original, prints/vídeos anexados (bucket `swipe-media`), transcrição

**Engenharia reversa (gerada pela IA)**
- esqueleto reutilizável (template com placeholders `{produto}`, `{dor}`, `{prova}`)
- fórmula nomeada (ex: "Segredo Duplo + Prova Real + CTA de Comentário")
- gatilhos psicológicos detectados
- observações de copy (ritmo, comprimento, voz)

## 3. Importação (3 modos)

1. **Colar JSON** estruturado — aceita o formato exato do seu exemplo (`produto`, `roteiros[]`). Importação em lote.
2. **Colar texto bruto** — IA quebra em gancho/narrativa/reframe/CTA automaticamente.
3. **URL** (IG/TikTok/LP) — Firecrawl extrai → IA estrutura. (Vídeo do IG/TT só extrai legenda + comentários — transcrição de áudio fica para v2.)

Mais: **upload de arquivo** (.txt, .md, .json) e **botão "Novo manual"** com formulário em branco.

## 4. Motor de Copys (3 ações IA)

Em cima de uma ou várias swipes selecionadas:

**A. Gerar variações** — pega 1 swipe + escolhe produto-alvo (do seu portfólio) → IA gera N variações adaptadas mantendo a estrutura. Salva como novas copys vinculadas ao swipe-fonte.

**B. Extrair fórmula reutilizável** — destila o esqueleto (gancho+mecanismo+reframe+CTA) e salva como **Template de Copy** numa segunda tabela. Templates ficam disponíveis no gerador.

**C. Bulk: gerar campanha** — seleciona 5–20 swipes + produto-alvo + briefing → IA gera 10–30 roteiros novos, cada um aplicando a fórmula de um swipe-fonte ao seu produto. Saída vai pro Studio como rascunhos prontos pra editar/usar.

Todas as 3 ações usam contexto do projeto (Avatar, Branding, Produtos) quando o swipe está vinculado a um projeto.

## 5. UI (`/swipe`)

```text
┌─────────────────────────────────────────────────────────┐
│ 📚 Swipe File         [+ Novo] [Importar ▼] [Motor ⚡]  │
├─────────────────────────────────────────────────────────┤
│ Filtros: [Nicho ▾] [Plataforma ▾] [Mecanismo ▾] [⭐≥4]  │
│ Busca: ___________  [Tags] [Projeto vinculado]          │
├─────────────────────────────────────────────────────────┤
│ Grid de cards (capa + título + criador + ⭐ + tags)     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│  │ A    │ │ B    │ │ C    │ │ D    │  …                 │
│  └──────┘ └──────┘ └──────┘ └──────┘                    │
└─────────────────────────────────────────────────────────┘
```

**Detalhe do swipe** (drawer lateral): editor por blocos + aba "🔬 Engenharia reversa" + aba "⚡ Gerar variação" + aba "📎 Mídia/Fonte".

**Bulk select** → botão "⚡ Gerar campanha com X swipes selecionadas".

## 6. Detalhes técnicos

**Banco**
- `imphq_swipes`: id (uuid), user_id, project_id (nullable), produto_id (nullable), title, criador, plataforma, formato, mecanismo, gatilhos[], nicho, tags[], rating, status, blocks (jsonb — gancho, narrativa, reframe, ctas, blocos livres), reverse_engineering (jsonb), source_url, media_urls[], raw_text, created_at, updated_at
- `imphq_swipe_templates`: id, user_id, name, formula, skeleton (jsonb com placeholders), source_swipe_ids[], created_at
- RLS: `auth.uid() = user_id` em tudo
- Bucket Storage `swipe-media` (privado, prefixo por user_id)
- Trigger `updated_at`

**Edge Functions**
- `swipe-import` — recebe `{mode: "json"|"text"|"url", payload}` → estrutura e salva. Usa Lovable AI Gateway (gemini-3-flash) p/ texto bruto, Firecrawl p/ URL.
- `swipe-engineer` — roda engenharia reversa em 1 swipe (extrai esqueleto + gatilhos + fórmula). Output estruturado via `Output.object` (zod).
- `swipe-generate` — 3 modos: `variations` | `extract_template` | `bulk_campaign`. Lê contexto do projeto vinculado quando existir.

**Frontend**
- `src/pages/Swipe.tsx` (lista + filtros + bulk)
- `src/components/swipe/SwipeCard.tsx`, `SwipeDetail.tsx` (drawer com abas), `SwipeImportDialog.tsx`, `SwipeMotorDialog.tsx`
- Rota em `App.tsx`, item na `AppSidebar.tsx`
- Atalho no `ProjetoDetalhe.tsx` ("📚 Swipes do nicho")

**Integração com Studio**
- "Bulk gerar campanha" envia roteiros prontos pro Studio (tab Prompts ou nova "Roteiros Gerados") já preenchidos.

## 7. Entrega faseada

1. **MVP** — Tabela + página `/swipe` + CRUD manual + importação JSON (pra você já jogar os 26 roteiros agora) + edição por blocos.
2. **IA** — `swipe-engineer` (eng. reversa) + `swipe-generate` (variações + extrair template).
3. **Avançado** — Importação por URL, bulk campaign, integração Studio, mídia/anexos.

Quer que eu já implemente a fase 1+2 de uma vez (importação JSON + UI + eng. reversa + gerar variações)? Fica funcional pra você importar os 26 roteiros do Soulmate Test hoje e já testar o motor.
