

# Plano: Guia do Tracker dentro do sistema + Evolucao do rastreamento de eventos

## Parte 1: Guia do Tracker como secao na Knowledge Base

A forma mais natural e ja existente de colocar documentacao dentro do sistema e adicionar uma nova secao no `KB_SECTIONS` em `src/data/kbTemplates.ts`. A pagina Docs ja funciona como wiki interna editavel.

**Acao:** Adicionar uma nova secao `tracker_guia` no array `KB_SECTIONS` com o conteudo completo do guia (UTMs, script, CAPI, webhook, fluxo completo, FAQ). O usuario podera editar e salvar no Supabase como qualquer outra secao da KB.

| Arquivo | Acao |
|---|---|
| `src/data/kbTemplates.ts` | Adicionar secao `tracker_guia` com defaultContent contendo o guia completo |

---

## Parte 2: Resposta sobre CAPI/Pixel e rastreamento de jornada

### O que funciona hoje

- **Pixel**: O script `imptrack.js` captura UTMs e registra clicks na tabela `imphq_clicks`
- **CAPI**: O webhook `webhook-pagamento` envia evento `Purchase` ao Facebook quando uma venda e aprovada (Hotmart/Kiwify/Ticto)
- **Leads**: O script expoe `imptrack.trackLead()` para capturar leads de formularios

### O que NAO funciona ainda (e precisa ser construido)

Para rastrear a **jornada completa do usuario** (saiu, voltou pelo Instagram, clicou, fez isso, fez aquilo), o sistema precisa de:

1. **Tabela de eventos (`imphq_events`)**: Registrar cada acao do visitante (PageView, ButtonClick, FormSubmit, Scroll, VideoPlay, etc.) com `session_id` e `visitor_id` persistente
2. **Visitor ID persistente**: Cookie/localStorage que identifica o mesmo visitante entre sessoes e canais
3. **Session tracking**: Agrupar eventos por sessao com timestamp de inicio/fim
4. **Timeline do lead**: Na pagina de Leads, mostrar a jornada completa: "Veio pelo Meta Ads > viu pagina X > saiu > voltou pelo Instagram > capturou lead > comprou"
5. **Eventos CAPI adicionais**: Enviar PageView, ViewContent, Lead, InitiateCheckout alem de Purchase
6. **Deduplicacao event_id**: Compartilhar event_id entre Pixel client-side e CAPI server-side

### Proposta de implementacao (eventos e jornada)

Isso e uma feature grande. Posso construir em etapas:

**Etapa 1** (neste ciclo): Criar tabela `imphq_events`, atualizar o script `imptrack.js` para registrar PageView automaticamente e expor `imptrack.trackEvent(name, data)`, adicionar visitor_id persistente.

**Etapa 2** (proximo ciclo): Timeline visual na pagina de Leads mostrando jornada do visitante. Eventos CAPI adicionais no webhook.

### Arquivos da Etapa 1

| Arquivo | Acao |
|---|---|
| `src/data/kbTemplates.ts` | Adicionar secao do guia |
| Migration SQL | Criar tabela `imphq_events` (visitor_id, session_id, event_name, event_data, page_url, referrer, created_at) |
| `src/pages/Tracker.tsx` | Atualizar o script gerado para incluir PageView, visitor_id persistente e `imptrack.trackEvent()` |

Quer que eu implemente a Etapa 1 completa agora?

