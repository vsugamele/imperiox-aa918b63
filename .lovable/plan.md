

# Plano: Finalizar Checklist + Upload de Vídeo no Portal e Painel

## Contexto

A lógica de backend (tabela `imphq_expert_logs`, rotas POST na Edge Function) e os handlers no frontend (`ExpertPortal.tsx`) já estão prontos. Falta conectar a UI nos cards de conteúdo.

## O que falta

### 1. ExpertPortal.tsx — Adicionar checkbox e botão de upload nos cards

Os cards de conteúdo (linhas 470-489) não mostram o checkbox "Feito" nem o botão "Enviar Vídeo". Precisa adicionar:

- **Checkbox "Feito"** abaixo de cada card, chamando `toggleDone(item.id, wk, day)` ao clicar
- **Botão "📹 Enviar Vídeo"** que seta `pendingUploadCard` e dispara o `videoInputRef.current.click()`
- **Indicador de vídeo enviado** quando `getVideoLog(item.id)` retorna algo (badge "📹 Vídeo enviado")
- **Loading spinner** quando `uploadingId === item.id`

### 2. ProjetoExpertPanel.tsx — Mostrar status dos logs no painel interno

Atualmente o painel interno não busca `imphq_expert_logs`. Precisa:

- Fazer query dos logs ao carregar o componente: `supabase.from("imphq_expert_logs").select("*").eq("project_id", projectId)`
- Nos cards de conteúdo do calendário, mostrar:
  - Badge "✅ Feito" (com data) quando há log `mark_done`
  - Botão "📹 Baixar Vídeo" / preview quando há log `video_upload` (link no `metadata.url`)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/ExpertPortal.tsx` | Adicionar checkbox + botão upload + indicadores nos cards de conteúdo |
| `src/components/projeto/ProjetoExpertPanel.tsx` | Buscar `imphq_expert_logs`, exibir badges de status e link de download nos cards |

