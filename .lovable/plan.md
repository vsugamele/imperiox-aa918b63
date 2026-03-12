

# Análise de Concorrentes — Nova feature completa com Supabase

## O que será construído

Uma nova aba "🏆 Concorrentes" dentro da página de detalhe do projeto (`/projetos/:id`), com 5 sub-abas conforme as screenshots de referência:

1. **Visão Geral** — Tabela comparativa (Nome, URL, Ponto Forte, Fraqueza, Canais, Nicho, Público-alvo, Mecanismo Único)
2. **Mercado** — Score de Escala (barras coloridas), radar de proximidade (bubble), canais/palavras-chave comuns (tags)
3. **Copywriting** — Cards por concorrente (Headline, Hook/Ângulo, CTA)
4. **Oferta** — Tabela (Oferta Principal, Preço, Garantia, Bônus)
5. **Dossiê** — Cards detalhados (Score, tráfego, ads ativos, stack tecnológico, páginas do funil, insights)

Cada concorrente terá botões "Remover" e "Importar Pesquisa". Upload de fotos/screenshots via Supabase Storage.

## Database

### Nova tabela `imphq_competitors`

```sql
CREATE TABLE imphq_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES imphq_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL DEFAULT '',
  url TEXT DEFAULT '',
  -- Visão Geral
  ponto_forte TEXT DEFAULT '',
  fraqueza TEXT DEFAULT '',
  canais_principais TEXT DEFAULT '',
  nicho TEXT DEFAULT '',
  sub_nicho TEXT DEFAULT '',
  publico_alvo TEXT DEFAULT '',
  mecanismo_unico TEXT DEFAULT '',
  -- Mercado
  score_escala INT DEFAULT 0,
  score_max INT DEFAULT 15,
  canais_keywords JSONB DEFAULT '[]',
  -- Copywriting
  headline TEXT DEFAULT '',
  hook TEXT DEFAULT '',
  cta TEXT DEFAULT '',
  -- Oferta
  oferta_principal TEXT DEFAULT '',
  preco TEXT DEFAULT '',
  garantia TEXT DEFAULT '',
  bonus TEXT DEFAULT '',
  -- Dossiê
  trafego_est TEXT DEFAULT '',
  ads_ativos BOOLEAN DEFAULT false,
  importado_em DATE,
  stack_tecnologico JSONB DEFAULT '[]',
  paginas_funil JSONB DEFAULT '[]',
  insights TEXT DEFAULT '',
  screenshot_url TEXT DEFAULT '',
  color TEXT DEFAULT '#c9922a',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE imphq_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own competitors"
  ON imphq_competitors FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_imphq_competitors_updated_at
  BEFORE UPDATE ON imphq_competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Storage bucket para screenshots

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('competitor-screenshots', 'competitor-screenshots', true);

CREATE POLICY "Auth users upload screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'competitor-screenshots');

CREATE POLICY "Public read screenshots"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'competitor-screenshots');

CREATE POLICY "Auth users delete own screenshots"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'competitor-screenshots');
```

## Arquivos a criar/editar

### Novos componentes (`src/components/projeto/concorrentes/`)
- `ConcorrentesTab.tsx` — Container principal com sub-abas (Visão Geral, Mercado, Copywriting, Oferta, Dossiê) + botões "+ Concorrente" e "Salvar"
- `VisaoGeralTab.tsx` — Tabela editável inline com todos os campos comparativos + coluna "Seu Projeto"
- `MercadoTab.tsx` — Barras de score coloridas + tags de canais/palavras-chave
- `CopywritingTab.tsx` — Grid de cards editáveis (headline, hook, CTA)
- `OfertaTab.tsx` — Tabela editável (oferta, preço, garantia, bônus)
- `DossieTab.tsx` — Cards expandidos com tráfego, stack (badges), funil (badges), insights, botão "Importar Pesquisa" e upload de screenshot

### Editar
- `ProjetoDetalhe.tsx` — Adicionar a aba "🏆 Concorrentes"
- `App.tsx` — Sem mudança (já está dentro de `/projetos/:id`)

## Funcionalidades
- CRUD completo de concorrentes via Supabase (insert/update/delete com debounce auto-save)
- Upload de screenshots via Supabase Storage (bucket `competitor-screenshots`)
- Cores únicas por concorrente para as barras do Mercado
- Tags editáveis para stack tecnológico, páginas do funil, canais/keywords
- Botão "Importar Pesquisa" (placeholder para futura integração com IA)
- Responsivo: tabelas com scroll horizontal no mobile

