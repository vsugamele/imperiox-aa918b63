## Plano — 3 melhorias no Hub WhatsApp

### 1. Sequência com IA + Compartilhar (CampaignStepEditor)

**No header da sequência** (ScrollArea, acima dos steps):
- Botão **"✨ Gerar com IA"** → abre dialog com:
  - Quantidade de steps (1–14)
  - Tom (vendas / conteúdo / aquecimento / lançamento)
  - Briefing livre (textarea, opcional — já puxa `produto` + branding do projeto)
- Chama nova edge function `wa-campaign-ai-generate` (Lovable AI Gateway, `google/gemini-3-flash-preview`, structured output via `Output.object` com `z.object({ steps: z.array(...) })`).
- Retorna `[{ day_offset, send_time, media_type: "text", content }]` → insere os steps em `imphq_wa_campaign_steps` e dá reload.

**Botão "📤 Compartilhar sequência"** (lado do gerar IA):
- Exporta steps como **JSON** (download `.json`) e como **link de import** (gera um registro em nova tabela `imphq_wa_campaign_templates` com slug curto e copia URL `…/?import=slug`).
- No CampaignManager, ao abrir "Sequência" e estiver vazia, mostra campo **"Importar de link/JSON"** que pré-popula os steps.

### 2. Editar campanha existente: provider + contingências (CampaignManager)

Adicionar botão **`Settings2` (⚙️)** em cada card de campanha → abre `Dialog "Configurações da campanha"` com tabs:

**Tab "Geral"**
- Nome, produto, projeto, data início, janela de envio (start/end).

**Tab "Provider & Contingências"** (novo)
- Select de **Provider principal** (`provider_id`) — lista os providers conectados.
- Select de **Provider de contingência** (`fallback_provider_id`, nova coluna nullable) — usado se principal estiver desconectado/erro.
- Toggle **"Auto-fallback em falha"** (nova coluna `auto_fallback bool default true`).
- Toggle **"Pausar campanha se ambos falharem"** (`pause_on_failure bool`).
- Mostra status atual de cada provider (badge ativo/desconectado lendo `imphq_wa_providers.status`).

**No `wa-campaign-scheduler/index.ts`**: ao falhar 2x seguidas no provider principal de uma campanha (já tem retry), se `auto_fallback` e `fallback_provider_id` existir → reenvia pelo fallback e loga `error: "FALLBACK_USED"`. Se ambos falharem e `pause_on_failure` → seta `status='paused'`.

**Migração:**
```sql
ALTER TABLE imphq_wa_campaigns 
  ADD COLUMN fallback_provider_id uuid REFERENCES imphq_wa_providers(id),
  ADD COLUMN auto_fallback boolean DEFAULT true,
  ADD COLUMN pause_on_failure boolean DEFAULT false;
```

### 3. Distribuidor de Grupos — visual mais bonito (GroupDistributor)

Refazer o card e a página:
- **Hero header** com gradient gold sutil, contador total de cliques agregado e CTA grande "Novo Link".
- **Cards** ganham:
  - Ícone circular dourado (`Link2` em círculo `bg-gold/15`).
  - URL renderizada como pill **clicável-copiável** com ícone copy embutido (substitui o `<button>` cinza atual).
  - **Barra de progresso** (Progress component shadcn) mostrando `fullestPct` em vez de só texto.
  - Sparkline atual maior e com tooltip por barra (nome do grupo + cliques + %).
  - Mini-badges com ícone (📢 campanha vira chip clicável, 👥 grupos, 🖱️ cliques, 🔒 limite).
  - Hover: leve `scale-[1.01]` + glow gold.
- **Empty state** ilustrado (ícone grande Link2 + copy + CTA).
- **Modal de stats** com tabela de cliques por grupo + barra horizontal por linha (em vez do bloco denso atual).

Sem mudança de schema, sem mudança de lógica do edge function.

### Arquivos afetados

- `supabase/functions/wa-campaign-ai-generate/index.ts` (novo)
- `supabase/functions/wa-campaign-scheduler/index.ts` (fallback logic)
- `supabase/migrations/...` (3 colunas + tabela `imphq_wa_campaign_templates`)
- `src/components/whatsapp/CampaignStepEditor.tsx` (botões IA + share + import)
- `src/components/whatsapp/CampaignAIGenerateDialog.tsx` (novo)
- `src/components/whatsapp/CampaignSettingsDialog.tsx` (novo, tabs)
- `src/components/whatsapp/CampaignManager.tsx` (botão ⚙️)
- `src/components/whatsapp/GroupDistributor.tsx` (redesign visual)

Posso implementar tudo de uma vez ou preferes em ondas (ex.: começar pela #1 IA + share)?