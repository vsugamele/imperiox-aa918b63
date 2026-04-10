

# Plano: Chat WhatsApp Bonito + Suporte a Mídia

## Problemas identificados

1. **Webhook não salva `media_url` nem `message_type`**: A tabela tem as colunas `media_url` e `message_type`, mas o INSERT no webhook ignora ambas — salva apenas o emoji como texto.

2. **Sem download de mídia**: A Evolution API fornece URLs temporárias ou base64. Precisamos baixar a mídia e salvar no Supabase Storage para que ela persista.

3. **ChatView é texto puro**: Não renderiza imagens, áudios, vídeos ou documentos — tudo aparece como texto plano. Também não tem visual de chat moderno (sem avatar, sem indicadores de status de entrega).

---

## Mudanças

### 1. Edge Function — Salvar mídia no Supabase Storage

No `whatsapp-api/index.ts`, no bloco de MESSAGES_UPSERT:
- Adicionar `message_type` e `media_url` ao INSERT
- Para mensagens de mídia (image, audio, video, document): buscar a mídia via Evolution API (`/chat/getBase64FromMediaMessage`), fazer upload para o bucket `whatsapp-media` no Supabase Storage, e salvar a URL pública como `media_url`
- Criar o bucket `whatsapp-media` via migração SQL (público, para exibir no frontend)

### 2. ChatView — Redesign visual tipo WhatsApp

Transformar o ChatView num chat bonito:
- **Background**: fundo com padrão sutil (como o WhatsApp)
- **Bolhas**: sombras suaves, cores distintas (verde claro para outgoing, branco para incoming)
- **Mídia inline**: renderizar `<img>` para imagens, `<audio>` para áudios, `<video>` para vídeos, link para documentos
- **Status de entrega**: ícones de check (✓ enviado, ✓✓ entregue, ✓✓ azul lido)
- **Avatar**: mostrar iniciais ou foto do contato nas mensagens incoming
- **Textarea**: trocar Input por Textarea com auto-resize para mensagens longas
- **Botão de emoji**: adicionar seletor básico de emojis
- **Envio de mídia**: botão para anexar imagem/arquivo (upload via Supabase Storage + envio via Evolution API)

### 3. Migração SQL — Bucket de mídia

Criar bucket `whatsapp-media` com acesso público de leitura.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/*` | Criar bucket `whatsapp-media` |
| `supabase/functions/whatsapp-api/index.ts` | Salvar `media_url` + `message_type`, download de mídia da Evolution API |
| `src/components/whatsapp/ChatView.tsx` | Redesign completo — visual de chat, mídia inline, status, textarea |

## Resultado
Chat com visual moderno tipo WhatsApp, imagens e áudios aparecendo inline, status de entrega visível, e possibilidade de enviar mídia.

