

# Plano: Evoluir Referencias, Funis, Produtos, Docs, Projetos (Analytics), Leads (Webhooks) e Automacoes

Este e um plano grande com 7 blocos. Vou dividir em fases para facilitar.

---

## Fase 1: Schema (Migrations)

### 1A. Tabela `imphq_referencias` (Swipe File)
```sql
CREATE TABLE imphq_referencias (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES imphq_projects(id),
  tipo TEXT DEFAULT 'criativo', -- criativo, landing_page, email, video, copy
  titulo TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  tags TEXT[],
  notas TEXT,
  score INTEGER DEFAULT 0,
  plataforma TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 1B. Campos analytics no `imphq_projects`
```sql
ALTER TABLE imphq_projects
  ADD COLUMN IF NOT EXISTS clarity_id TEXT,
  ADD COLUMN IF NOT EXISTS ga_id TEXT;
```

### 1C. Tabela `imphq_webhooks` (receber dados de plataformas de pagamento)
```sql
CREATE TABLE imphq_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES imphq_projects(id),
  plataforma TEXT NOT NULL, -- Hotmart, Kiwify, Ticto, Eduzz
  evento TEXT NOT NULL, -- compra_aprovada, carrinho_abandonado, reembolso
  payload JSONB,
  lead_id TEXT REFERENCES imphq_leads(id),
  processado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 1D. Tabela `imphq_automacoes` (fluxos estilo n8n)
```sql
CREATE TABLE imphq_automacoes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES imphq_projects(id),
  nome TEXT NOT NULL,
  trigger_tipo TEXT NOT NULL, -- carrinho_abandonado, compra_aprovada, lead_novo
  acoes JSONB DEFAULT '[]', -- [{tipo: "email", template: "...", delay_min: 30}, {tipo: "whatsapp", msg: "..."}]
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Fase 2: Edge Function -- Webhook Receiver

Criar `supabase/functions/webhook-pagamento/index.ts`:
- Endpoint publico (verify_jwt = false) que recebe POST de Hotmart/Kiwify/Ticto
- Identifica a plataforma pelo header ou body
- Salva em `imphq_webhooks`
- Cruza com `imphq_leads` por email/telefone
- Cria venda em `imphq_vendas` se for compra aprovada
- Atualiza status do lead para "cliente"
- Dispara automacoes (busca `imphq_automacoes` ativas para o trigger correspondente)

---

## Fase 3: Paginas Frontend

### 3A. Referencias (`src/pages/Referencias.tsx`)
- CRUD completo com tabela `imphq_referencias`
- Grid de cards com preview da imagem (thumbnail da URL ou upload)
- Filtro por tipo (criativo, LP, email, video, copy), plataforma e projeto
- Campo de URL e campo de upload de imagem
- Tags editaveis, notas, score (1-5 estrelas)
- Botao para abrir URL em nova aba

### 3B. Funis Canvas melhorado (`src/pages/Funis.tsx`)
- Etapa agora inclui campos `url` e `image_url` no JSONB (sem migration, ja e JSON)
- Cada node do canvas mostra thumbnail se tiver imagem
- Campo de URL clicavel na etapa
- Upload de imagem por etapa (usando FileUpload component existente)
- Melhorar visual: nodes maiores, mais espacamento, icones por tipo de etapa

### 3C. Produtos com Link (`src/components/projeto/ProjetoBriefing.tsx`)
- Adicionar campo "Link" nos produtos (data JSONB, campo `link`)
- Input de URL com icone de link externo
- Clicavel para abrir em nova aba

### 3D. Docs com vinculo de projeto (`src/pages/Docs.tsx`)
- Adicionar select de projeto no editor (ao editar um doc)
- Ao criar doc, herdar o projeto do filtro ativo
- Mostrar badge do projeto no card

### 3E. Projetos com Clarity/GA (`src/pages/ProjetoDetalhe.tsx`)
- Nova aba "Analytics" ou campos na aba Briefing
- Inputs para Clarity ID e Google Analytics ID
- Salvar diretamente na tabela `imphq_projects`

### 3F. Leads -- Recepcao de Webhooks (`src/pages/Leads.tsx`)
- Nova aba ou secao mostrando vendas recebidas via webhook
- Vinculo automatico: quando webhook chega, associa ao lead por email
- Totalizacao de receita por projeto (ja existe `total_gasto`)
- Badge mostrando origem (Hotmart, Kiwify, etc.)

### 3G. Automacoes (`src/pages/OpenFlow.tsx` reescrever ou nova pagina)
- Interface visual simples para criar automacoes
- Trigger: selecionar evento (carrinho_abandonado, compra_aprovada)
- Acoes: lista sequencial com tipo (Email/WhatsApp/Telegram), delay, template
- Toggle ativo/inativo
- Futuramente integrar com Resend (email), WhatsApp API, Telegram Bot

---

## Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabelas + alterar imphq_projects |
| `supabase/functions/webhook-pagamento/index.ts` | Edge function para receber webhooks |
| `supabase/config.toml` | Adicionar verify_jwt=false para webhook |
| `src/pages/Referencias.tsx` | Reescrever com CRUD completo |
| `src/pages/Funis.tsx` | Adicionar URL/imagem nas etapas |
| `src/components/projeto/ProjetoBriefing.tsx` | Adicionar campo link nos produtos |
| `src/pages/Docs.tsx` | Adicionar vinculo de projeto no editor |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar campos Clarity/GA |
| `src/pages/Leads.tsx` | Mostrar vendas de webhook |
| `src/pages/OpenFlow.tsx` | Reescrever como sistema de automacoes |

---

## Nota sobre integracao de email/WhatsApp/Telegram

As automacoes serao salvas na tabela `imphq_automacoes`. A execucao real (enviar email via Resend, WhatsApp, Telegram) requer secrets de API que serao configurados depois. Na primeira versao, a edge function de webhook salvara os eventos e marcara as automacoes como "pendentes". Quando os secrets estiverem configurados, criaremos edge functions adicionais para cada canal.

