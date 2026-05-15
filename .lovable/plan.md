## Diagnóstico — Sistema de Campanhas WhatsApp + Distribuidor

Analisei `CampaignManager`, `CampaignStepEditor`, `GroupDistributor` e a Edge `wa-group-distributor`. O sistema funciona, mas tem fricções claras de UX, lacunas operacionais e dívidas técnicas. Abaixo, o plano dividido em **3 ondas**.

---

### Onda 1 — Visual / UX (alto impacto, baixo risco)

**Campanhas (`CampaignManager.tsx`)**
- Substituir o card-linha atual por um **card editorial** com 3 zonas: header (nome + status pill com glow gold quando `active`), KPI strip inline (grupos / próximo disparo / steps ativos / cliques) e action rail discreta (ícones só aparecem em hover).
- **Status visual claro**: barra lateral colorida de 2px (gold = active, âmbar = paused, muted = draft, blue = completed) em vez de badge solto.
- **"Próximo disparo"** vira um mini-bloco com ícone `Clock`, contagem regressiva relativa ("em 3h12") e preview de copy truncada com `...`.
- **Empty state** com ilustração serif minimal (Cormorant) + CTA gold.
- **Filtros no topo**: tabs `Todas / Ativas / Pausadas / Rascunho` + busca por nome.
- Modal "Nova Campanha" reorganizado em **2 colunas** (identidade à esquerda, agendamento à direita) com `editorial-divider`.

**Distribuidor (`GroupDistributor.tsx`)**
- Card mostra **mini-gráfico de barras** (sparkline) da distribuição atual entre grupos, em vez de só números.
- **Botão "QR do link"** que abre popover com QR code escaneável para colar em criativos / story.
- Modal de stats vira **dashboard**: cards de "Total cliques / Grupo mais cheio / Disponibilidade restante" no topo, depois lista com pesos.
- Substituir `<select>` nativo (linha 206) pelo `Select` do shadcn para consistência.
- Slug com **preview do link completo** copiável no card, não escondido em ícone.

---

### Onda 2 — Processual (preencher buracos do fluxo)

**Campanhas**
1. **Wizard de criação em 3 passos** (Identidade → Provider/Janela → Primeiros steps) — hoje cria campanha vazia e o usuário precisa lembrar de configurar grupos + steps separados. Isso é a maior fonte de campanhas "draft" abandonadas.
2. **Botão "Testar agora"** em cada step: dispara a mensagem para um número de teste do usuário (sem afetar grupos reais).
3. **Pré-flight check** antes de ativar: valida (a) provider conectado, (b) ≥1 grupo, (c) ≥1 step ativo, (d) janela coerente. Bloqueia ativação com toast detalhando o que falta.
4. **Pausar grupo individual** dentro de uma campanha ativa (usar `paused_groups` que já existe no schema mas não tem UI).
5. **Histórico consolidado**: aba "Performance" por campanha com taxa de entrega, taxa de leitura (se Evolution suportar), opt-outs e cliques rastreados via distribuidor vinculado.

**Distribuidor**
1. **Modo "rotação por horário"**: além de sequencial/peso, permitir definir que grupo X recebe leads das 9h-18h e grupo Y das 18h-9h.
2. **Auto-arquivar grupo cheio**: quando atinge `max_per_group`, marcar visualmente como "fechado" e gerar evento em `imphq_events` para alertar.
3. **UTM passthrough**: distribuidor aceita `?utm_source=...` e armazena em `imphq_wa_distributor_clicks` para cruzar com vendas (atribuição real de grupos a receita).
4. **A/B de mensagem de boas-vindas** entre grupos (já existe `welcome_message` na campanha — falta variante B).
5. **Bloqueio anti-fraude**: hoje só hasheia IP. Adicionar rate-limit por `ip_hash` (ex: máx 3 cliques/hora) para evitar inflar contadores.

---

### Onda 3 — Técnico (qualidade + escala)

**Backend / Edge Functions**
- `wa-group-distributor/index.ts`: o cálculo de `clickCounts` faz `select` sem limite — com >1000 cliques quebra. Trocar por **count agregado** (`count: 'exact', head: true`) por `group_jid` ou criar coluna materializada `current_count` em `imphq_wa_group_distributors` atualizada por trigger.
- Mesma função: o **incremento de `click_count`** é race-condition (read-modify-write). Trocar por RPC `increment_distributor_clicks(dist_id)` usando `UPDATE ... SET click_count = click_count + 1`.
- **Retornar redirect HTTP 302** real para `https://chat.whatsapp.com/<invite_code>` em vez de JSON. Hoje o front precisa interpretar — fora do app, o link "puro" não funciona em criativos/Stories. Exigirá armazenar `invite_code` por grupo (nova coluna em `imphq_wa_group_distributors.group_invites jsonb`).
- **Webhook `wa-campaign-scheduler`**: adicionar `try/catch` com fallback que marca step como `error` em `imphq_wa_campaign_logs` para o `CampaignLogViewer` exibir.
- **Janela anti-ban**: validar `send_window_start/end` no scheduler e respeitar timezone do projeto (hoje é America/Sao_Paulo hardcoded).

**Frontend**
- `CampaignManager.load()` faz 2 queries sequenciais — paralelizar com `Promise.all` (já temos esse padrão no `GroupDistributor`).
- Extrair `nextSteps` em hook `useCampaignNextSteps(campaignIds)` para reuso no Dashboard.
- Tipos: criar `src/types/whatsapp.ts` com `Campaign`, `Distributor`, `Step` — hoje duplicados.
- **Realtime subscription** em `imphq_wa_campaigns` para refletir status quando o scheduler atualiza, sem precisar de F5.

**Observabilidade**
- Botão "Diagnóstico" em cada campanha: mostra últimos 20 logs de `imphq_wa_campaign_logs` + último ping do health monitor do provider associado.
- Métrica em `imphq_growth_metrics`: `wa_campaigns_active`, `wa_distributor_clicks_24h` para alimentar Growth Dashboard.

---

### Arquivos impactados

- `src/components/whatsapp/CampaignManager.tsx` (reorg visual + filtros + wizard)
- `src/components/whatsapp/GroupDistributor.tsx` (sparklines + QR + dashboard stats)
- `src/components/whatsapp/CampaignStepEditor.tsx` (botão "Testar agora" + variantes A/B)
- `src/components/whatsapp/CampaignLogViewer.tsx` (status `error` visual)
- `supabase/functions/wa-group-distributor/index.ts` (302 redirect + count agregado + RPC)
- `supabase/functions/wa-campaign-scheduler/index.ts` (timezone + error handling)
- Migração: coluna `group_invites jsonb`, RPC `increment_distributor_clicks`, índice em `imphq_wa_distributor_clicks(distributor_id, group_jid)`
- `src/types/whatsapp.ts` (novo)

---

### Sugestão de execução

Cada onda é independente. Recomendo começar pela **Onda 2.1 (wizard)** + **Onda 3 backend (302 redirect + race-condition)** pois desbloqueiam uso real fora do app e eliminam bugs silenciosos. Visual (Onda 1) entra depois para não retrabalhar.

**Quer que eu execute todas, ou priorizar uma onda específica?**