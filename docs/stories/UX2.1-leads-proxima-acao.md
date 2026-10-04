# Story UX2.1 — Leads por próxima ação

Pedido (04/10/2026): deixar a aba de Leads mais simples de entender e mais útil para agir. Decisão do Vinicius: lista por próxima ação e menos abas.

## Feito (04/10/2026)
- [x] Regra `src/lib/lead-next-action.ts`: grupos Responder agora / Pagamento esperando / Quentes sem contato / Reengajar; texto da próxima ação; conversas individuais cuja última mensagem é do cliente (48 h), quem espera há mais tempo primeiro. Testes: `src/test/lead-next-action.test.ts`.
- [x] Aba **Agora** (antes "Quentes", agora a primeira ao abrir /leads; `HotLeadsInbox`): "Responder agora" no topo com prévia da mensagem, tempo de espera e botão **Abrir conversa** (`/inbox?tab=whatsapp&phone=…`, que já abre a conversa certa); demais leads agrupados por próxima ação, cada um com "Próxima ação: …"; cores pelos tokens do tema. Teste: `src/test/hot-leads-agora.test.tsx`.
- [x] Menos abas: "Pix Hoje" saiu (está em Pagamento esperando); Predições e Custo por lead viraram seções dentro de Analytics. Abas: Agora · Leads · Analytics · Formulários.
- Correção do que foi dito na conversa: a aba Custo não duplicava "Custos IA"; ela mostra o custo de anúncio por lead (CPL) e foi preservada dentro de Analytics.

## Pendente
- [ ] Conferência visual logado.
- [ ] Mensagem pronta da próxima ação gerada pela IA e enviada pela fila /aprovar (hoje: texto fixo + link de WhatsApp).
- [ ] Cartão do lead com origem (anúncio/UTM) e etapa no detalhe; cores fixas (slate/amber) no detalhe do lead.

## File List
- src/lib/lead-next-action.ts
- src/components/leads/HotLeadsInbox.tsx
- src/pages/Leads.tsx
- src/test/lead-next-action.test.ts
- src/test/hot-leads-agora.test.tsx
- docs/stories/UX2.1-leads-proxima-acao.md
