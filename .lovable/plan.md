Ajustar layout do Inbox para melhorar respiro no notebook, focando no chat central e no painel de inteligência do lead.

Objetivo
- Dar mais espaço horizontal para leitura e digitação no chat em telas de 1280–1440 px.
- Manter todos os recursos atuais, apenas reorganizando a densidade.

Mudanças

1. Painel de Inteligência do Lead colapsável
   - Arquivo: `src/components/whatsapp/ChatView.tsx`
   - Adicionar botão no header do chat para mostrar/ocultar `<LeadIntelPanel>`.
   - Em telas < 1400 px de largura, iniciar o painel oculto por padrão.
   - Quando oculto, o chat central ocupa 100% da largura do painel direito.
   - Guardar preferência do usuário em `localStorage` (`wa.intelPanelOpen`).

2. Largura da lista de conversas responsiva
   - Arquivo: `src/pages/WhatsAppPage.tsx`
   - Ajustar `defaultSize` do `<ResizablePanel>` da lista conforme a largura da viewport:
     - ≥ 1440 px: 30% (atual)
     - 1280–1439 px: 24%
     - < 1280 px: 22%
   - Manter `minSize={20}` e `maxSize={45}`.

3. Aproveitamento de largura do chat
   - Arquivo: `src/components/whatsapp/ChatView.tsx`
   - Substituir `max-w-3xl` por `max-w-5xl` (1024 px) quando o painel de inteligência estiver oculto.
   - Com painel aberto, manter `max-w-3xl` para não comprimir as mensagens.
   - Aplicar a mesma lógica em todas as áreas do input (sugestões, objeções, etc.).

4. Input de mensagem mais enxuto em telas pequenas
   - Arquivo: `src/components/whatsapp/ChatView.tsx`
   - Em telas < 1280 px, agrupar botões secundários em um menu "Mais" (emoji, anexo, templates, interativos, agendar, copilot, 3 sugestões).
   - Manter visíveis sempre: temperatura do lead, toggle IA, toggle intel, anexo/gravação, botão enviar.
   - Isso evita que a textarea fique comprimida entre ícones.

5. KPI strip do Inbox colapsável
   - Arquivo: `src/pages/Inbox.tsx`
   - Adicionar botão pequeno ao lado do título para recolher/expandir o `<InboxKpiStrip>`.
   - Iniciar recolhido em telas < 1280 px.
   - Guardar preferência em `localStorage` (`inbox.kpiStripOpen`).

Validação
- Testar visualmente em viewport de 1366 px e 1280 px.
- Verificar que o painel de inteligência pode ser reaberto e que os botões do menu "Mais" funcionam.
- Confirmar que a largura da lista de conversas não quebra o layout em telas grandes.