## Melhorias no Sistema de Leads — Roteamento por Tag + Bulk

### 1. Backfill com "sobrescrever projeto existente"
**Arquivo:** `src/components/configuracoes/TagRoutingRulesTab.tsx`
- Adicionar `Checkbox` "Sobrescrever projeto já atribuído"
- Quando marcado, remover o filtro `.is("project_id", null)` da query de backfill
- Texto de confirmação ajustado: "Isso vai reatribuir leads que já estão em outro projeto. Confirma?"

### 2. Preview de impacto antes do backfill
**Mesmo arquivo.**
- Novo botão "Pré-visualizar impacto" ao lado de "Aplicar regras"
- Roda as mesmas queries em modo `count: 'exact', head: true` (sem trazer dados)
- Exibe modal/alerta: "Regra `cortes → JP Freitas`: 230 leads. Regra `tatuagem → Tatuagem`: 410 leads. Total: 640."
- Só depois o usuário clica em "Aplicar"

### 3. Atalho "Criar regra desta tag" na sidebar de Leads
**Arquivos:** `src/components/leads/LeadsSidebar.tsx` (+ novo `QuickTagRuleDialog.tsx`)
- Hover em cada tag mostra ícone ⚡
- Click abre dialog leve: Select de projeto + prioridade → insere em `imphq_tag_project_rules`
- Toast: "Regra criada. Aplicar nos leads existentes?" com botão que dispara o backfill só dessa regra

### 4. Bulk manual: mover N leads para projeto X
**Arquivos:** `src/components/leads/LeadsTable.tsx`, `src/pages/Leads.tsx`
- Coluna de checkbox por linha + checkbox no header (select-all da página)
- Barra flutuante quando há seleção: "{N} leads selecionados" + Select de projeto + botão "Mover"
- Update direto: `supabase.from("imphq_leads").update({ project_id }).in("id", selectedIds)`
- Refresh da lista + invalidação do `projectCounts`

### 5. Regras avançadas (combinação de critérios)
**Migration + UI:**

Migration em `imphq_tag_project_rules`:
- Adicionar colunas opcionais: `tags_all text[]` (todas devem casar), `origem text`, `plataforma text`
- Manter `tag` como atalho (= 1 elemento em `tags_all`) por retrocompatibilidade

Edge functions (`capture-lead`, `membros-webhook`):
- Trocar o `.in("tag", allTags)` por uma resolução que respeite a regra mais específica:
  1. Carrega todas as regras do user
  2. Para cada lead, filtra regras onde `tags_all` ⊆ tags do lead E (`origem` nulo ou igual) E (`plataforma` nulo ou igual)
  3. Pega a de menor `priority`

UI `TagRoutingRulesTab.tsx`:
- Form passa a aceitar múltiplas tags (TagAutocomplete) + dois inputs opcionais (origem, plataforma)
- Linha da regra mostra todos os critérios

### Detalhes técnicos
- IDs: `imphq_leads.id` e `project_id` são TEXT (memória de arquitetura).
- Para bulk update via cliente, RLS já permite o user dono dos leads atualizar. Verificar policy antes.
- `projectCounts` no `Leads.tsx` precisa ser invalidado após bulk move e após backfill.
- Preview de impacto NÃO deve trazer dados — só `count: 'exact', head: true` para não estourar egress.
- Memória de Network Efficiency: limitar backfill em batches de 500 com `.in()` em vez de update único gigante.

### Fora de escopo
- Mudar estrutura de `imphq_leads`, RLS, autenticação.
- Regras baseadas em UTM ou em score (fica para depois se quiser).
- Auto-rerodar regras periodicamente via cron.

### Ordem de implementação sugerida
1 → 2 → 3 → 4 (entregam valor imediato sem migration) e depois 5 (precisa de migration).
