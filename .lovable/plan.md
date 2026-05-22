## O que vamos fazer

**1) Tirar grupos da triagem IA**
- No webhook `whatsapp-api/index.ts`, antes de invocar `wa-ai-triage`, checar se o JID é de grupo (`@g.us`) ou broadcast e pular. A mensagem ainda é salva no chat normalmente — só não consome IA classificando conversa de grupo, que polui a aba de Triagem e gasta tokens à toa.

**2) IA Autônoma mais inteligente — botão "Refinar com a IA"**

Hoje a IA aprende passivamente quando você responde manualmente (modo learning). Vamos adicionar um modo **ativo de refinamento**: você abre um chat com a própria IA e ensina ela — tom, objeções comuns, o que evitar, regras de negócio, exemplos de boas respostas. Cada lição vira conhecimento permanente.

### Como vai funcionar

- Novo botão **"Refinar IA"** no painel `WhatsAppAIConfig` (ao lado do toggle de learning).
- Abre um Dialog com chat (estilo coach):
  - IA começa perguntando o que você quer ajustar (tom, objeção nova, erro recente, regra).
  - Você responde em linguagem natural.
  - A IA confirma o que entendeu e **salva como conhecimento** (`imphq_wa_knowledge` com tipo `refinement` + embedding) e/ou cadastra objeção em `imphq_wa_objections` quando detecta padrão de objeção.
  - Mostra lista de "Lições aprendidas hoje" abaixo do chat pra você revisar/apagar.
- Nova edge function `wa-ai-refine`:
  - Recebe histórico do chat de refinamento + projeto_id.
  - Usa Gemini com tool calling: ferramentas `save_lesson(titulo, regra, contexto)`, `save_objection(objecao, resposta_padrao)`, `update_tone(descricao)`.
  - Atualiza `imphq_wa_ai_config.persona_extra` quando ajusta tom; insere em `imphq_wa_knowledge`/`imphq_wa_objections` nos demais casos.
- A IA autônoma (`wa-ai-triage` e respondedor) já consulta `imphq_wa_knowledge` + `imphq_wa_objections` → os refinamentos passam a influenciar respostas automaticamente.

### Arquivos

- `supabase/functions/whatsapp-api/index.ts` — pular triagem em grupos (~linha 1005).
- `supabase/functions/wa-ai-refine/index.ts` — nova função.
- `src/components/whatsapp/WhatsAppAIConfig.tsx` — botão + Dialog de refinamento.
- (Opcional) coluna `persona_extra TEXT` em `imphq_wa_ai_config` se não existir — confirmo antes via migration.

Sem mudanças de schema invasivas; reuso `imphq_wa_knowledge` (já tem embedding) marcando `source='refinement'`.