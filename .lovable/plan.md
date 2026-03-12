

# Plano: Melhorar Kanban + Documento Guia do Tracker

## 3 entregas

---

### 1. Kanban Global (baseado na imagem de referencia)

**O que mudar no `KanbanPage.tsx`:**

- **Header com contadores globais**: badges coloridas mostrando totais cross-board (Travados em vermelho, Fazendo em amarelo, Feitos em verde)
- **Filtros globais**: selects para Projeto, Membro (placeholder para futuro) ao lado dos contadores
- **Aba "Geral"**: novo board que agrega cards de todos os boards, permitindo visao unificada
- **Colunas com icones**: cada coluna ganha icone temático (⚡ Backlog, 🔥 Fazendo, ⚠️ Travado, 🔍 Revisao, ✅ Feito) e cores de fundo distintas
- **Dots coloridos nos cards**: indicadores visuais de prioridade (vermelho=urgent, amarelo=high, verde=medium, cinza=low) como bolinhas na base do card
- **Labels em portugues**: Backlog, Fazendo, Travado, Revisao, Feito
- **Texto vazio**: "Nenhuma tarefa" quando coluna vazia
- **Visual mais rico**: fundo gradiente sutil por coluna, borda lateral colorida

### 2. Documento Guia do Tracker

Gerar um documento Markdown detalhado em `/mnt/documents/` cobrindo:

- **O que e o Tracker**: sistema de rastreamento completo (UTMs + clicks + leads + vendas + CAPI)
- **Como criar links UTM**: passo a passo com templates Meta/Google/TikTok
- **Como instalar o script imptrack.js**: onde colar, como funciona
- **Como configurar Facebook CAPI**: Pixel ID + Access Token + Test Event Code no projeto
- **Fluxo completo**: visitante clica → UTM capturado → click registrado → lead criado → venda via webhook → CAPI dispara Purchase para Facebook
- **KPIs e metas**: como usar o dashboard, o que cada metrica significa
- **Webhook de pagamento**: como configurar Hotmart/Kiwify/Ticto para enviar webhooks
- **FAQ e troubleshooting**

### 3. Resposta sobre Facebook CAPI

**Sim, o sistema ja suporta Facebook CAPI.** O que funciona hoje:

| Funcionalidade | Status | Como |
|---|---|---|
| Facebook Pixel ID | ✅ | Configurado por projeto em ProjetoDetalhe |
| Access Token CAPI | ✅ | Configurado por projeto |
| Test Event Code | ✅ | Para testar no Events Manager |
| Evento Purchase (compra) | ✅ | Enviado automaticamente via webhook-pagamento |
| Hash SHA-256 dos dados | ✅ | Email, nome, telefone hasheados |
| Clicks/UTMs | ✅ | Via script imptrack.js |
| Leads | ✅ | Via imptrack.trackLead() |

**O que NAO faz ainda** (e pode ser adicionado):
- Eventos PageView/ViewContent/AddToCart via Pixel client-side (o script atual nao carrega o fbq)
- Eventos CAPI alem de Purchase (Lead, InitiateCheckout, etc.)
- Deduplicacao event_id entre Pixel e CAPI

Essas limitacoes serao documentadas no guia.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/KanbanPage.tsx` | Reescrever com header global, filtros, aba Geral, visual melhorado |
| `/mnt/documents/guia-tracker.md` | Criar documento guia completo |

