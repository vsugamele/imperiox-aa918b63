# Plano — IA no Construtor de Formulários + Categorização por Campanha

## Objetivo
1. Botão "✨ Gerar com IA" que monta o formulário completo (nome, tipo, campos, descrição) a partir de um briefing curto.
2. Classificar cada formulário por **tipo de campanha** (Captura / Vendas / Pesquisa / Aplicação / Pós-compra), **produto**, **nome da campanha** e **data**.
3. A IA recebe esse contexto ao gerar snippet/webhook/JS para segregar leads corretamente (UTM `utm_campaign`, tag, `form_type`).

---

## 1. Banco — novos campos em `imphq_capture_forms.settings` (JSONB, sem migration nova)

Campos consolidados em `settings`:
- `form_type`: `'captura' | 'vendas' | 'pesquisa' | 'aplicacao' | 'pos_compra' | 'lead_magnet'`
- `campaign_name`: string (ex: "Lançamento Cortes Perfeitos — Abril")
- `product_name`: já existe
- `tag`: já existe
- `description`: já existe
- `ai_briefing`: string (briefing original usado pela IA, p/ regenerar depois)

Sem migration — `settings` já é JSONB livre.

## 2. Nova Edge Function: `ai-form-builder`

`supabase/functions/ai-form-builder/index.ts`

**Input:**
```json
{
  "briefing": "Quero captar leads para o webinar de cortes do dia 25",
  "project_id": "uuid",
  "product_name": "Cortes Perfeitos"
}
```

**Processo:**
- Busca contexto do projeto: avatar, produtos, branding (`imphq_projects.data`)
- Chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com tool calling estruturado retornando:
  - `nome`, `form_type`, `campaign_name`, `stage`, `description`, `tag`
  - `fields[]` (key/label/type/required/options/placeholder)
- Prompt instrui: usar avatar do projeto para perguntas de qualificação, evitar campos demais (regra: captura ≤ 3 campos, pesquisa pode 6-10, aplicação 5-8).

**Output:** JSON pronto para preencher o estado do FormBuilder.

## 3. UI — `src/components/leads/FormBuilder.tsx`

### a) Novo botão na tela de templates
"✨ Gerar com IA" (acima de "Começar do Zero") abre um mini-dialog com:
- Textarea: "O que você precisa? (ex: pesquisa pré-aula do produto X)"
- Select tipo de campanha (opcional, IA detecta)
- Select projeto e produto (já filtrado)
- Botão "Gerar" → invoca `ai-form-builder` → preenche `formName/formFields/formStage/formType/...` → abre dialog de edição normal já populado.

### b) Novos campos no dialog de criação/edição
- **Tipo de Campanha** (Select obrigatório): Captura / Vendas / Pesquisa / Aplicação / Pós-compra / Lead Magnet
- **Nome da Campanha** (Input): "Ex: Lançamento Abril 2026"
- Mantém Projeto, Produto, Tag, Descrição
- Botão secundário "✨ Sugerir campos com IA" dentro do dialog (regenera só `fields[]` mantendo contexto)

### c) Card do formulário (listagem)
Adicionar badges:
- Tipo de campanha (cor por tipo: captura=azul, vendas=verde, pesquisa=roxo, etc.)
- Nome da campanha
- Data de criação formatada (`created_at` já existe)

### d) Filtros no topo
Além do filtro por projeto, adicionar:
- Select "Tipo": todos / captura / vendas / pesquisa / aplicação / pós-compra
- Input busca por nome de campanha

## 4. Snippet com contexto (segregação)

`getSnippetHTML` passa a injetar no `body` do POST:
```js
body.form_type = "vendas";
body.campaign_name = "Lançamento Abril";
body.product_name = "Cortes Perfeitos";
body.tag = "webinar-abril";
```

Edge function `capture-lead` (já existe) salva esses campos em `imphq_leads.metadata` / `ultimo_produto` / `ultimo_evento` — já está mapeado pela memória `Lead Responses`. Apenas garantir leitura de `form_type`/`campaign_name` do body.

## 5. Secrets
`LOVABLE_API_KEY` já está disponível (memória confirma uso do Gateway).

---

## Arquivos tocados
- **Novo:** `supabase/functions/ai-form-builder/index.ts`
- **Editado:** `src/components/leads/FormBuilder.tsx` (UI + estados + chamadas)
- **Editado:** `supabase/functions/capture-lead/index.ts` (ler form_type/campaign_name do body)

## Fora do escopo
- Não cria nova tabela
- Não mexe na timeline do lead
- Não automatiza envio para CRM/WhatsApp baseado no tipo (pode ser fase 2)
