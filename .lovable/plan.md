

# Plano: Skills Visual + Conteúdo por Categoria dentro de Mídia

## 1. Skills — Renderização visual além do Markdown bruto

O modal "Raio-X" já usa `ReactMarkdown` com prose styling, mas o system_prompt é um bloco longo de texto. Melhorias visuais:

- **Extrair seções do prompt** (tudo que começa com `#`, `##`, `---`) e renderizar como **accordion/collapsible** ao invés de um scroll infinito
- **Destacar blocos especiais**: seções como "IDENTIDADE", "INSTRUÇÕES", "OUTPUT" ganham cards visuais com ícones e cores distintas
- **Info cards no topo**: versão, gatilho, categoria, número de seções — tudo em cards compactos antes do conteúdo
- **Syntax highlighting** para blocos de código dentro do prompt (já suportado pelo prose, mas melhorar com fundo distinto)
- **Barra lateral de navegação**: índice das seções do prompt para navegação rápida (dentro do modal)

| Arquivo | Ação |
|---|---|
| `src/pages/Skills.tsx` | Refatorar modal Raio-X com seções colapsáveis, info cards, índice lateral |

## 2. Conteúdo por categoria + merge dentro de Mídia

**Problema atual**: Existem 3 abas separadas (Mídia, Conteúdo, e fotos genéricas) — o menu fica grande demais.

**Solução**: Unificar tudo na aba "🖼️ Mídia" com sub-abas internas:

### Sub-abas dentro de Mídia:
- **📸 Fotos** — Fotos do Expert, Produtos, Complementares (atual ProjetoMidia)
- **🎬 Reels** — Conteúdos tipo vídeo curto com data de publicação
- **📱 Stories** — Imagens/vídeos para stories com data
- **📣 Anúncios** — Criativos de ads (imagens e vídeos)
- **📰 Feed** — Posts de feed com data de publicação
- **📂 Todos** — Grid geral com filtros (atual ProjetoConteudo)

### Mudanças no banco:
- Adicionar coluna `content_category` à tabela `imphq_content_library` (valores: `reels`, `stories`, `anuncios`, `feed`, `geral`)
- Adicionar coluna `publish_date` (DATE) para controle de data de publicação

### Componente unificado:
- Remover aba "📦 Conteúdo" do `ProjetoDetalhe.tsx`
- Expandir `ProjetoMidia` para incluir sub-tabs com:
  - Tab Fotos = componente atual de fotos (expert/produtos/complementar)
  - Tabs Reels/Stories/Anúncios/Feed = filtro do `imphq_content_library` por `content_category`
  - Tab Todos = grid completo sem filtro
- Cada item mostra: thumbnail, título, data de publicação, tags, tipo
- Upload atribui automaticamente a categoria da sub-aba ativa
- Campo de data de publicação no dialog de edição

### Migration SQL:
```sql
ALTER TABLE imphq_content_library 
  ADD COLUMN IF NOT EXISTS content_category TEXT DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS publish_date DATE;
```

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Skills.tsx` | Modal Raio-X com seções colapsáveis + índice + info cards |
| Migration SQL | `content_category` + `publish_date` em `imphq_content_library` |
| `src/components/projeto/ProjetoMidia.tsx` | Expandir com sub-tabs (Fotos, Reels, Stories, Anúncios, Feed, Todos) + upload categorizado + data |
| `src/pages/ProjetoDetalhe.tsx` | Remover aba "📦 Conteúdo" — tudo fica em Mídia |

