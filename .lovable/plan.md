

# Plano: Sistema de Campanhas para Grupos WhatsApp

## Conceito

Criar um sistema de **Campanhas** com **Sequências agendadas** para envio automático de mensagens em grupos WhatsApp. Cada campanha contém múltiplas mensagens (texto, imagem, áudio, link) programadas para horários específicos, executadas diariamente via cron job.

---

## Novas Tabelas

### `imphq_wa_campaigns`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| project_id | uuid FK | Projeto vinculado |
| provider_id | uuid FK | Provider Evolution/Twilio |
| name | text | Nome da campanha (ex: "Lançamento Curso X") |
| status | text | `draft`, `active`, `paused`, `completed` |
| groups | jsonb | Array de JIDs dos grupos alvo (ex: `["120363...@g.us"]`) |
| created_at / updated_at | timestamptz | — |

### `imphq_wa_campaign_steps`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| campaign_id | uuid FK | Campanha pai |
| step_order | int | Ordem na sequência |
| content | text | Texto da mensagem (suporta variáveis) |
| media_url | text | URL de imagem/áudio/vídeo (do bucket whatsapp-media) |
| media_type | text | `text`, `image`, `audio`, `video`, `document` |
| send_time | time | Horário de envio (ex: "09:00", "14:30") |
| days_offset | int | Dia relativo ao início (0 = hoje, 1 = amanhã...) |
| is_active | boolean | Pode desativar steps individuais |
| created_at | timestamptz | — |

### `imphq_wa_campaign_logs`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | — |
| step_id | uuid FK | Step executado |
| group_jid | text | Grupo alvo |
| status | text | `sent`, `failed`, `skipped` |
| error | text | Mensagem de erro se falhou |
| executed_at | timestamptz | — |

---

## Edge Function: `wa-campaign-scheduler`

Cron job executado a cada minuto via `pg_cron + pg_net`. Lógica:
1. Buscar campanhas com `status = 'active'`
2. Para cada campanha, verificar steps onde `send_time` bate com a hora atual (margem de 1 min) e `days_offset` corresponde ao dia correto
3. Para cada step + grupo: enviar mensagem via Evolution API (texto ou mídia)
4. Registrar resultado em `imphq_wa_campaign_logs`
5. Rate limiting: delay de 3s entre grupos para evitar ban

---

## Frontend: Nova aba "Campanhas" na página WhatsApp

### Tela de listagem
- Cards com nome da campanha, status (badge colorido), quantidade de grupos, quantidade de steps
- Botões: Criar, Editar, Pausar/Ativar, Excluir

### Tela de edição (Dialog ou inline)
- **Config da campanha**: nome, provider, status
- **Grupos**: lista de grupos do WhatsApp (buscar via Evolution API `/group/fetchAllGroups`), seleção com checkbox
- **Sequência de mensagens**: lista ordenável de steps
  - Cada step: textarea para texto, upload de mídia (imagem/áudio/vídeo), seletor de horário (time picker), campo de `days_offset`
  - Botão para adicionar/remover steps
  - Preview da mensagem
- **Logs**: tabela com histórico de envios (status, grupo, horário)

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/*` | 3 novas tabelas + RLS |
| `supabase/functions/wa-campaign-scheduler/index.ts` | Nova Edge Function (cron) |
| `src/components/whatsapp/CampaignManager.tsx` | Novo componente — listagem + edição de campanhas |
| `src/components/whatsapp/CampaignStepEditor.tsx` | Novo componente — editor de steps da sequência |
| `src/pages/WhatsAppPage.tsx` | Adicionar aba "Campanhas" ao tab switcher |
| `src/integrations/supabase/types.ts` | Tipos gerados (automático após migração) |

## Resultado
Sistema completo de campanhas agendadas: criar campanha → selecionar grupos → montar sequência de mensagens com horários → ativar → cron envia automaticamente todos os dias nos horários definidos, com log de cada envio.

