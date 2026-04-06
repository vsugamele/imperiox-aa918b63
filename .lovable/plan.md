

# Plano: OpenFlow com Hub Local + Melhorias WhatsApp + Dashboard

3 blocos de trabalho.

---

## 1. OpenFlow: Puxar providers do Hub Local

**Problema**: O OpenFlow so busca `imphq_wa_providers` (Evolution/Twilio). O Hub Local usa tabelas `wa_hub_iso_sessions` — sessoes conectadas por la nao aparecem como opcao no seletor de provider do FlowEditor.

**Fix**: No `OpenFlow.tsx`, alem de buscar `imphq_wa_providers`, buscar tambem `wa_hub_iso_sessions` com `status = 'connected'` e unificar as duas listas em um formato comum para o FlowEditor. O FlowEditor ja aceita a prop `providers` com `id`, `provider`, `instance_name` — basta mapear as sessoes do Hub para esse formato.

```typescript
// OpenFlow.tsx - adicionar ao load()
const hubRes = await supabase
  .from("wa_hub_iso_sessions")
  .select("id, session_key, tenant_id, status")
  .eq("status", "connected");

// Mapear para formato WaProvider
const hubProviders = (hubRes.data || []).map(s => ({
  id: `hub_${s.id}`,
  provider: "hub_local",
  instance_name: s.session_key,
  twilio_from: null,
  project_id: null,
}));

setProviders([...provRes.data || [], ...hubProviders]);
```

No FlowEditor, adicionar icone diferenciado para `hub_local` (📱) vs Evolution (🟢) vs Twilio (🔵).

---

## 2. Melhorias no sistema WhatsApp integrado

### 2a. Status de conexao visivel em toda a plataforma
- No `WhatsAppPage.tsx`, mostrar badge de status da sessao Hub (connected/disconnected) no topo
- No painel lateral (AppSidebar), mostrar indicador verde/vermelho no item WhatsApp se ha sessao ativa

### 2b. Leads: Mostrar se o provider selecionado esta conectado
- No dialog de envio WhatsApp em Leads, ao lado de cada provider no Select, mostrar badge (🟢 Conectado / 🔴 Offline)
- Para Hub Local: checar `wa_hub_iso_sessions.status`
- Para Evolution: checar ultimo `session_status` conhecido

### 2c. Conversas do Hub: Filtro por projeto
- O `HubConversations` atual nao filtra por projeto. Adicionar Select de projeto no topo da lista de conversas do Hub

---

## 3. Melhorias na Dashboard principal

### 3a. Widget WhatsApp na Dashboard
- Novo card "WhatsApp" nos stat cards mostrando:
  - Total de mensagens enviadas (hoje/periodo)
  - Sessoes ativas (connected)
  - Taxa de resposta (incoming vs outgoing)

### 3b. Leads recentes com score na Dashboard
- Adicionar card "Leads Quentes" mostrando os 5 leads com maior score que ainda nao sao clientes
- Exibir nome, score, produto, e tempo desde captura

### 3c. Filtro de periodo afetando mais widgets
- Atualmente `dashPeriod` so afeta `loadAdsGlobal`. Fazer o filtro afetar tambem:
  - Leads trend (usar o periodo selecionado em vez de fixo 30 dias)
  - Receita vs Custo (usar periodo em vez de fixo 6 meses)
  - Funnel de conversao (filtrar por periodo)

### 3d. Performance: Reduzir queries
- O Dashboard faz ~15 queries sequenciais no `load()`. Agrupar em `Promise.all` as que sao independentes (varias ja estao, mas `leadsTrend`, `funnelData`, `receitaVsCusto` rodam sequencialmente apos o primeiro `Promise.all`)

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/OpenFlow.tsx` | Buscar `wa_hub_iso_sessions` e unificar com providers |
| `src/components/openflow/FlowEditor.tsx` | Icone para `hub_local` no Select de provider |
| `src/pages/WhatsAppPage.tsx` | Badge de status + filtro projeto no HubConversations |
| `src/pages/Dashboard.tsx` | Widget WhatsApp + Leads Quentes + periodo global + otimizar queries |
| `src/pages/Leads.tsx` | Badge de status do provider no dialog de envio |

## Ordem

1. OpenFlow + FlowEditor (Hub Local como provider)
2. Dashboard (widgets + filtro global + performance)
3. WhatsApp + Leads (status badges + filtro)

