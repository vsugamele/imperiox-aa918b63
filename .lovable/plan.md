

# Plano: Calendário por Projeto + Biblioteca de Conteúdo + Próximos Eventos no Dashboard

## 1. Nova tabela: `imphq_calendar_events`

Armazena eventos vinculados a projetos (lançamentos, lives, deadlines, reuniões, etc.)

```sql
CREATE TABLE imphq_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES imphq_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  event_type TEXT DEFAULT 'general', -- launch, live, deadline, meeting, content
  color TEXT,
  all_day BOOLEAN DEFAULT false,
  reminder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own events" ON imphq_calendar_events FOR ALL TO authenticated USING (user_id = auth.uid());
```

## 2. Nova tabela: `imphq_content_library`

Biblioteca de conteúdo (imagens, vídeos, arquivos) vinculada a projetos.

```sql
CREATE TABLE imphq_content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES imphq_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'image', -- image, video, document, audio
  thumbnail_url TEXT,
  tags TEXT[],
  description TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE imphq_content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own content" ON imphq_content_library FOR ALL TO authenticated USING (user_id = auth.uid());
```

## 3. Novo componente: `ProjetoCalendario.tsx`

Nova aba "📅 Calendário" no ProjetoDetalhe com:
- Calendário visual mensal usando `react-day-picker` (já instalado) com dias que têm eventos destacados
- Lista de eventos do mês selecionado ao lado
- Dialog para criar/editar evento (título, data, tipo, descrição, cor)
- Tipos de evento com ícones: 🚀 Lançamento, 🎥 Live, ⏰ Deadline, 🤝 Reunião, 📝 Conteúdo
- Filtro por tipo de evento

## 4. Novo componente: `ProjetoConteudo.tsx`

Nova aba "📦 Conteúdo" no ProjetoDetalhe com:
- Grid de mídia (imagens + vídeos) com preview visual
- Upload via Supabase Storage (bucket `project-content`)
- Tags e descrição por item
- Filtro por tipo (imagem/vídeo/documento)
- Referência cruzada — ao criar evento tipo "content", pode linkar conteúdo da biblioteca

## 5. Dashboard: Próximos Eventos

Adicionar seção "📅 Próximos Eventos" no Dashboard:
- Query: `imphq_calendar_events` onde `event_date >= now()`, ordenados por data, limit 5
- JOIN com `imphq_projects` para mostrar nome/ícone do projeto
- Mostra tipo do evento com badge colorida e contagem regressiva ("em 2 dias")

## 6. Storage bucket

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('project-content', 'project-content', true);
```
Com RLS para upload autenticado.

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `imphq_calendar_events`, `imphq_content_library`, bucket `project-content` |
| `src/components/projeto/ProjetoCalendario.tsx` | Criar — calendário visual + CRUD de eventos |
| `src/components/projeto/ProjetoConteudo.tsx` | Criar — biblioteca de conteúdo com upload |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar abas 📅 Calendário e 📦 Conteúdo |
| `src/pages/Dashboard.tsx` | Adicionar seção "Próximos Eventos" |

