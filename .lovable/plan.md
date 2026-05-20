## Objetivo
Permitir colar (Ctrl/Cmd+V) uma imagem da área de transferência direto no chat do WhatsApp, reaproveitando o pipeline atual de upload.

## Mudanças

**`src/components/whatsapp/ChatView.tsx`** (único arquivo)

1. Extrair a lógica de upload de `handleFileUpload` para uma função reutilizável `uploadAndSendFile(file: File)` — mesmo fluxo de hoje (storage `whatsapp-media`, optimistic UI, `whatsapp-api?action=send_message`, `pollNew`).
2. `handleFileUpload` passa a só chamar `uploadAndSendFile(file)`.
3. Atualizar o `onPaste` da `<Textarea>`:
   - Percorrer `e.clipboardData.items` procurando `kind === "file"` e `type.startsWith("image/")`.
   - Se encontrar: `e.preventDefault()`, pegar `item.getAsFile()`, gerar nome `paste-{timestamp}.png` se vazio, mostrar `toast.info("Enviando imagem colada…")` e chamar `uploadAndSendFile(file)`.
   - Se não houver imagem: manter o comportamento atual (apenas forçar foco via `requestAnimationFrame`).
4. Validações já existentes (10MB, provider configurado) são reaproveitadas dentro de `uploadAndSendFile`.

## Fora do escopo
- Preview antes de enviar (envio é imediato, igual ao Paperclip).
- Colar múltiplas imagens de uma vez (envia a primeira).
- Backend, realtime, AI config — nada muda.

## Validação
- Print do sistema → Ctrl+V no campo → imagem sobe e aparece no chat.
- Colar texto continua funcionando normalmente e sem perder foco.
