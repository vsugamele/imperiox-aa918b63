

# Plano: Checklist do Expert + Upload de Vídeos

## O que será feito

### 1. Checklist interativo no portal público

Cada card de conteúdo ganha um checkbox "Feito" que o expert pode marcar direto no portal público. Ao marcar:
- Salva o status + timestamp num log persistente via Edge Function
- O gestor vê no painel interno quais cards foram marcados e quando

**Implementação**: Criar tabela `imphq_expert_logs` para persistir ações do expert (content_id, action, timestamp, metadata). A Edge Function `expert-portal` ganha uma rota POST para receber marcações. No portal público, cada card mostra o checkbox. No painel interno, cards marcados ganham um indicador visual (badge "✅ Feito" com data).

### 2. Upload de vídeo pelo expert

O expert pode subir o vídeo gravado diretamente pelo portal público, vinculado ao card de conteúdo. O gestor pode baixar/visualizar no painel interno.

**Implementação**: No portal público, cada card ganha um botão "📹 Enviar Vídeo" que faz upload para o bucket `project-media` via URL assinada (sem precisar de auth). A Edge Function `expert-portal` ganha uma rota para gerar upload URL assinada e outra para registrar o arquivo. O vídeo fica salvo na tabela `imphq_expert_logs` (action: "video_upload", metadata: {url, filename}). No painel interno, cards com vídeo mostram botão de download/preview.

## Tabela nova

```sql
create table public.imphq_expert_logs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  content_id text not null,
  week text,
  day text,
  action text not null,        -- "mark_done", "video_upload", "note"
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
```

## Edge Function `expert-portal` — novas rotas

| Método | Ação | Descrição |
|--------|------|-----------|
| GET | (existente) | Retorna dados do projeto + logs |
| POST | mark_done | Expert marca card como feito |
| POST | upload_url | Gera URL assinada para upload de vídeo |
| POST | register_upload | Registra o vídeo após upload |

O GET existente passa a incluir os logs (`imphq_expert_logs`) no response, para o portal e o painel interno saberem quais cards estão marcados e têm vídeo.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Tabela `imphq_expert_logs` |
| `expert-portal/index.ts` | Rotas POST (mark_done, upload) + incluir logs no GET |
| `ExpertPortal.tsx` | Checkbox "Feito" + botão upload vídeo em cada card |
| `ProjetoExpertPanel.tsx` | Badge "✅ Feito" + preview/download de vídeo nos cards |

