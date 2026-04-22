

## Plano: Integrar Timeline de Nutrição no painel do Lead

Vou integrar o `LeadNurtureTimeline` no **`CardDetailPanel`** (painel lateral que abre ao clicar num lead no Kanban/Leads), como uma nova aba "Nutrição" ao lado das abas existentes.

### Por que esse local
- É o painel de detalhe individual do lead já usado em todo o sistema (Leads, Kanban, Dashboard drill-down).
- Já tem estrutura de tabs, então a integração é limpa e segue o padrão existente.
- Acessível de múltiplos pontos sem duplicar UI.

### Mudanças

**`src/components/kanban/CardDetailPanel.tsx`**:
- Adicionar nova tab "Nutrição" (ícone `Mail`) no conjunto de tabs existente.
- Conteúdo: renderiza `<LeadNurtureTimeline leadId={lead.id} />`.
- Tab só aparece se o lead tiver `id` válido (não em modo criação).

**`src/components/nurture/LeadNurtureTimeline.tsx`** (ajustes se necessário):
- Garantir que aceita `leadId` como prop e busca:
  - Enrollments ativos do lead (`imphq_lead_sequence_enrollments`)
  - Histórico de e-mails (`imphq_nurture_emails`) com status (enviado/aberto/clicado)
  - Próximo e-mail agendado com preview
- Botão "Inscrever em sequência" se o lead não tem nenhum enrollment ativo (abre seletor de sequências disponíveis).

### Fora de escopo
- Mudanças no schema (já está pronto).
- Edição inline dos e-mails (só visualização + controles pause/skip que já existem no componente).

