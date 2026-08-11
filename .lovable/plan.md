# Cadê a imagem? — sincronizar mídias X1 nos fluxos já salvos

## Diagnóstico (confirmado no banco)

O template no código já está com as URLs reais. O problema está nos fluxos **já salvos** em `imphq_automacoes`, criados antes da atualização:

- `LinfaFlow X1 — Messenger (Zernio)`: 7 passos ainda com texto literal `{{img_prova_1}}`, `{{img_prova_2}}`, `{{img_prova_3}}`, `{{audio_ritual}}`, etc.
- `LinfaFlow X1 — Webchat do site`: 1 passo com placeholder.
- Exemplo real do passo #17: `{ tipo: "whatsapp", template: "{{img_prova_1}}" }` — sem `midia_url`.

Ou seja: o nó manda o texto `{{img_prova_1}}` para o lead em vez da imagem. E o card no canvas mostra só esse texto porque não existe preview de mídia no nó.

## O que vou fazer

1. **Mapa único de mídias X1**
   Exportar de `templates.ts` um mapa `X1_MEDIA` (placeholder → URL) reunindo as 7 imagens e 4 áudios.

2. **Botão "Sincronizar mídias X1"** no editor de fluxo
   Percorre as ações do fluxo aberto e, para cada `{{img_*}}` / `{{audio_*}}` encontrado:
   - se o passo é só o placeholder → grava a URL em `midia_url` e limpa/ajusta o `template`;
   - se o placeholder está dentro de um texto → troca pela URL.
   Mostra quantos passos foram corrigidos e salva.

3. **Preview de mídia no card do nó**
   Quando o passo tiver `midia_url` (ou o template for uma URL de imagem), o card mostra a miniatura; áudio mostra player compacto. Assim dá para conferir visualmente no canvas.

4. **Aviso de placeholder pendente**
   Badge âmbar no nó e uma linha no painel de validação quando restar `{{...}}` de mídia não resolvido (vai continuar aparecendo nos vídeos, que seguem pendentes).

## Detalhes técnicos

- Arquivos: `src/components/openflow/flow-editor/templates.ts` (export do mapa), `src/components/openflow/FlowEditor.tsx` (botão + preview no nó), `src/components/openflow/flow-editor/validate.ts` (regra de placeholder).
- Escrita apenas em `imphq_automacoes.acoes` do fluxo aberto — nenhuma migração de banco.
- Vídeos (`{{video_hook}}`, `{{video_mecanismo}}`, `{{video_future_pacing}}`) continuam como placeholder até serem gerados.
