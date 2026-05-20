## Diagnóstico

**1. Chats não atualizam em tempo real**
- `WhatsAppPage.tsx` (linhas 91-120) já assina `postgres_changes` em `imphq_wa_messages` e `imphq_wa_conversations`.
- Mas as tabelas **não estão na publication `supabase_realtime`** (verificado via query — retornou vazio). Sem isso o Postgres não emite eventos.

**2. Auto-resposta sem contexto rico**
- A IA usa `imphq_wa_ai_config.context_sources` em `whatsapp-api/index.ts` (linhas 1076-1136). Hoje injeta: briefing, produtos, avatar, branding, copy_arsenal.
- **Faltam**: tom/voz do expert, FAQ (opção existe na UI mas não tem código que injete), instruções customizadas por projeto, oferta ativa/produto principal, links de pagamento.
- UI `WhatsAppAIConfig.tsx` não tem campo para "instruções extras" nem para amarrar o expert.

---

## Plano

### Parte 1 — Realtime (corrige imediatamente)

Migration que:
- Adiciona `imphq_wa_messages`, `imphq_wa_conversations` (e `imphq_wa_triage` para o painel de IA) à publication `supabase_realtime`.
- Define `REPLICA IDENTITY FULL` nas 3 tabelas para que UPDATE entregue o payload completo (necessário pro contador de não-lidas e status).

Sem mudança no frontend — a subscription já está pronta.

### Parte 2 — Contexto rico para auto-resposta

**2a. Nova migration** acrescenta colunas opcionais em `imphq_wa_ai_config`:
- `custom_instructions text` — bloco livre de instruções/regras do expert.
- `expert_persona text` — descrição curta do tom/personagem (ex: "Imperius — direto, sem clichê, autoridade calma").
- `product_focus text` — produto principal a oferecer (nome + preço + link de pagamento).
- `faq jsonb` — array `{pergunta, resposta}` para resposta determinística.

**2b. UI `WhatsAppAIConfig.tsx`** ganha:
- Textarea "Persona do Expert" (auto-preenchida puxando `imphq_projects.data.expert` / `branding.voice` se vazio).
- Textarea "Instruções customizadas" (regras imutáveis — ex: "nunca prometa entrega em menos de 7 dias").
- Campo "Produto em foco" + link de checkout.
- Editor simples de FAQ (lista de pares pergunta/resposta).
- Botão "Sincronizar com projeto" que faz auto-fill da persona/produto a partir de `imphq_projects`.

**2c. `whatsapp-api/index.ts` (bloco AI autoresponder)**:
- Lê os novos campos e injeta no `systemPrompt`:
  - Persona do expert vira o cabeçalho do prompt (acima das `personalityPrompts`).
  - `custom_instructions` entra em bloco "REGRAS DO EXPERT (obrigatórias)".
  - `product_focus` entra em "OFERTA ATIVA" com link.
  - `faq` vira lista "Q&A oficiais — use literalmente se a pergunta bater".
- Implementa o caso `sources.includes("faq")` que hoje está faltando (usa `imphq_kb` filtrando por projeto se existir, fallback no `faq` jsonb).
- Inclui `expert` do projeto (`imphq_projects.data.expert`) quando `sources` incluir "expert".

**2d. Adiciona opção `expert` em `CONTEXT_OPTIONS`** no `WhatsAppAIConfig.tsx`.

---

## Detalhes técnicos

- Sem quebra: todos os campos novos são nullable; comportamento atual preservado se vazios.
- Tamanho do prompt: cada bloco truncado em 600 chars para não estourar tokens.
- FAQ jsonb default `'[]'::jsonb`.
- Realtime: apenas DDL, sem dado afetado.
- Não mexer em RLS — `imphq_wa_ai_config` já tem políticas.

## Fora de escopo
- Mudar provider de WhatsApp, fluxo de OpenFlow, ou triagem `wa-ai-triage`.
- RAG/embeddings (fica para próxima iteração se a FAQ jsonb não bastar).

## Ordem sugerida
1. Migration realtime (instantâneo, testa abrindo dois browsers).
2. Migration colunas + UI + edge function (entregue em conjunto).