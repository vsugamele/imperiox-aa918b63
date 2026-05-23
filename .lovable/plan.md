## Importar sequência pronta para campanha de grupo

Hoje você tem 3 caminhos na campanha WhatsApp:
1. Criar step a step manualmente no `CampaignStepEditor` (lento pra 30+ mensagens).
2. Gerar via IA (`CampaignAIGenerateDialog` → `wa-campaign-ai-generate`), bom pra criar do zero, ruim quando você **já tem o copy pronto**.
3. Não existe importar texto cru.

Pra esse seu caso (copy enorme, datado, blocos separados por `—----`), o melhor não é "melhorar a IA" — é criar um **Importador de Sequência**. A IA entra só como apoio pra fazer o parsing inteligente do texto datado.

### O que vou construir

**1. Botão "📋 Importar texto" no CampaignStepEditor**
- Ao lado do botão "Gerar com IA".
- Abre `CampaignImportDialog`.

**2. CampaignImportDialog (novo)**
- Textarea grande pra colar o copy inteiro.
- Campo "Data base" (ex: sexta 22/05) — vira o `day_offset = 0`.
- Botão "Analisar com IA" → chama nova edge function `wa-campaign-parse-text`.
- Preview tabular: `#`, `dia (offset)`, `horário`, `prévia do texto`, com checkbox por item pra desmarcar o que não quer importar.
- Botão "Importar N mensagens" → insere em lote em `imphq_wa_campaign_steps`.

**3. Edge function `wa-campaign-parse-text` (nova)**
- Recebe `{ text, base_date, campaign_id }`.
- Usa Lovable AI (`google/gemini-2.5-flash`) com **tool calling** (structured output) pra extrair:
  ```
  { steps: [{ day_label, time, content, day_offset, send_time }] }
  ```
- System prompt ensina a regra: separadores `—---`, cabeçalhos tipo "Sábado 23/05 - 9:00", calcular `day_offset` a partir da `base_date`, normalizar horários ("9:00" → "09:00", "20h" → "20:00"), preservar emojis/negrito/links, ignorar comentários tipo "Fazer uma Enquete" como nota não como mensagem (ou marcar `media_type: "poll"` se identificar enquete).
- Retorna os steps prontos pra inserir (não insere — quem insere é o frontend depois do preview).

**4. Melhoria no Gerar com IA existente**
- Aumentar `max count` de 14 → 60 (sua sequência tem ~35 mensagens).
- Adicionar campo opcional "Referência de copy" (textarea) no `CampaignAIGenerateDialog` que entra no prompt como "siga este estilo/estrutura".

### Por que essa abordagem e não "melhorar o gerar com IA"

- Seu texto **já está escrito e aprovado pelo cliente**. Gerar de novo perderia voz, CTAs específicos, links, datas.
- Parsing é determinístico no objetivo (separar e datar) — IA só ajuda a interpretar a bagunça humana ("9:00", "9h", "20h00", "Sexta 22/05").
- Você mantém controle: vê o preview antes de gravar.

### Fora de escopo (pode virar passo 2 se quiser)

- Anexar mídia (imagens/PDF) automaticamente — fica manual no editor depois do import.
- Detectar "(enviar guia)" e criar step `media_type: document` em branco aguardando upload — posso fazer, só avisa.
- Criar enquete automática quando o texto diz "Fazer uma Enquete" — posso marcar como `media_type: "poll"` mas a Evolution API exige config específica.

### Arquivos

- `src/components/whatsapp/CampaignImportDialog.tsx` (novo)
- `src/components/whatsapp/CampaignStepEditor.tsx` (adicionar botão)
- `src/components/whatsapp/CampaignAIGenerateDialog.tsx` (count até 60 + campo referência)
- `supabase/functions/wa-campaign-parse-text/index.ts` (nova)
- `supabase/config.toml` (registrar função)

Topa que eu siga assim?
