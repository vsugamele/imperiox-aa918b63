## Plano

1. Ajustar os anexos no `ChatView` para terem um botão explícito de download, em vez de depender de abrir o arquivo em outra aba.
2. Para documentos como PDF, usar o nome real mostrado na conversa e forçar o download com o atributo `download`.
3. Também adicionar download em imagens, vídeos e áudios recebidos/enviados, sem atrapalhar o clique atual de abrir/visualizar a mídia.
4. Mostrar feedback simples caso a mídia não tenha URL disponível.

## Detalhes técnicos

- Alterar apenas `src/components/whatsapp/ChatView.tsx`.
- Criar um helper local para extrair o nome do arquivo do conteúdo/URL.
- Trocar o card de documento por um layout com link de abrir e botão de baixar.
- Adicionar ícone/botão pequeno de download nos demais tipos de mídia.
- Manter o padrão visual atual do chat e os tokens existentes.