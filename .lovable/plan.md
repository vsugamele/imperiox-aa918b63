## Novo tipo de feedback: "➕ Complementar"

Adiciona um 4º chip no dialog de correção do WhatsApp: a IA aprende que a resposta original **estava boa** mas faltou complemento — sem invalidá-la.

### Backend

**`supabase/functions/wa-feedback-learn/index.ts`**
- Aceitar `correction_type: "complement"` no body.
- Nova rota quando `feedback === "bad"` (semanticamente "boa mas incompleta") + `correction_type === "complement"`:
  1. Buscar pergunta do lead + resposta original da IA (já temos a lógica).
  2. Gravar par P/R na `imphq_wa_knowledge`:
     - `pergunta`: pergunta do lead
     - `resposta`: `${resposta_original}\n\n${complemento_operador}`
     - `source: "feedback:complement:wa"`
  3. Chamar LLM (`gemini-2.5-flash-lite`) para extrair uma **regra genérica** a partir do exemplo (ex: "sempre confirmar detalhes de curso com a equipe antes de responder").
  4. Gravar essa regra em `imphq_wa_project_rules` com `rule_type: "behavior"`, `source_message_id`, `embedding`.
  5. Logar em `imphq_ai_actions` com título `➕ Complemento aprendido (P/R + regra)`.

### Frontend

**`src/components/whatsapp/[dialog de correção].tsx`** (o componente que tem os chips Auto/Resposta melhor/Regra/Produto indisponível — vou localizar por grep no build mode)
- Adicionar chip `➕ Complementar` com ícone Plus.
- Placeholder do textarea muda para: *"O que faltou dizer? Ex: 'poderia acrescentar que só tem dentro da JP Hair Education'"*.
- Envia `correction_type: "complement"` para a edge function.
- Toast de sucesso: "Complemento gravado — P/R + regra criadas ✓"

### Tipo na tabela

`imphq_wa_messages.feedback_correction_type` já aceita texto livre — só adicionamos o novo valor `"complement"`. Sem migração necessária.

### Não muda

- Fluxo `answer` / `rule` / `unavailable` / `auto` existentes.
- A/B testing de regras.
- Nenhuma outra edge function.