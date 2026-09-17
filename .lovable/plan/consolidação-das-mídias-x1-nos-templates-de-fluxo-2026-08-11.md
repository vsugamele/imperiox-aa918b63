# Consolidação das mídias X1 nos templates de fluxo

## Estado atual

- **7 imagens** novas já estão no Supabase Storage e inseridas nos fluxos **Messenger** e **Webchat**.
- **4 áudios** novos foram gerados e subidos, mas apenas **2 estão no fluxo**:
  - `audio_ritual.mp3` → usado no Messenger.
  - `audio_inercia.mp3` → usado no follow-up D+3 do Messenger.
  - `audio_objecao_preco.mp3` e `audio_tentei_tudo.mp3` → **ainda não plugados**.
- O template **WhatsApp (`linfaflow-x1-whatsapp`)** ainda usa as mídias antigas do export Typebot (`storage.tynk.ai`: 6 áudios e 2 imagens) através das constantes `LF_BASE`, `LF_AUDIO` e `LF_IMG`.
- **Vídeos** (`{{video_hook}}`, `{{video_mecanismo}}`, `{{video_future_pacing}}`) continuam como placeholders — nada foi gerado ainda.

## O que vou fazer

1. **Limpar URLs antigas no template WhatsApp**
   - Remover `LF_BASE`, `LF_AUDIO`, `LF_IMG`.
   - Substituir pelas 7 imagens e 4 áudios novos do Supabase Storage, respeitando os pontos do roteiro (mecanismo, prova, inércia, objeção, etc.).

2. **Plugar os 2 áudios pendentes**
   - `audio_objecao_preco.mp3` → estágio de objeção de preço (Messenger/Webchat/WhatsApp).
   - `audio_tentei_tudo.mp3` → track "tried-everything" (WhatsApp/Messenger).

3. **Padronizar referências de imagem**
   - Garantir que `img_prova_1/2/3`, `img_ingredientes`, `img_custo_comparativo`, `img_ritual`, `img_garantia` usem as URLs do Supabase em todos os canais.

4. **Atualizar documento bilíngue**
   - Marcar imagens e áudios como "no fluxo" na tabela de status.
   - Deixar vídeos como "pendente".

5. **Não gerar vídeos agora**
   - Manter placeholders `{{video_hook}}`, `{{video_mecanismo}}`, `{{video_future_pacing}}` até você pedir.

## Arquivos envolvidos

- `src/components/openflow/flow-editor/templates.ts`
- `/mnt/documents/linfaflow-x1-midias-pendentes-PT-EN.md`
