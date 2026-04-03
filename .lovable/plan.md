

# Plano: Sistema de Captura Rica de Leads com Formulários Dinâmicos

---

## O Problema

Hoje a edge function `capture-lead` aceita campos fixos (email, nome, phone, tags, source). Não há como:
- Capturar respostas de pesquisas/questionários customizados
- Associar o lead a uma etapa específica do funil
- Armazenar campos extras (profissão, faturamento, nível de consciência, etc.)
- Gerar formulários embutíveis para páginas externas
- Depois analisar padrões/semelhanças entre leads

---

## Solução em 4 Partes

### 1. Tabela `imphq_lead_responses` (respostas estruturadas)

Nova tabela para guardar respostas de perguntas customizadas, separada do lead principal para permitir múltiplas respostas ao longo da jornada.

```sql
create table public.imphq_lead_responses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.imphq_leads(id) on delete cascade not null,
  project_id text,
  form_id text,              -- identifica qual formulário gerou
  step text,                 -- etapa do funil (ex: "captura", "pesquisa_pos_webinar")
  question text not null,    -- "Qual seu faturamento mensal?"
  answer text not null,      -- "Entre R$10k e R$30k"
  field_key text,            -- chave normalizada (ex: "faturamento_mensal")
  created_at timestamptz default now()
);
```

Isso permite queries como: "Dos leads que compraram, 70% responderam faturamento > R$10k".

### 2. Tabela `imphq_capture_forms` (formulários configuráveis)

Permite criar formulários pelo painel, cada um com campos customizados, vinculado a um projeto e etapa do funil.

```sql
create table public.imphq_capture_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id text,
  nome text not null,
  step text default 'captura',
  fields jsonb not null default '[]',  -- [{key, label, type, options, required}]
  settings jsonb default '{}',         -- redirect_url, thank_you_message, tags_auto
  is_active boolean default true,
  created_at timestamptz default now()
);
```

O campo `fields` armazena a estrutura:
```json
[
  {"key": "email", "label": "E-mail", "type": "email", "required": true},
  {"key": "nome", "label": "Nome", "type": "text", "required": true},
  {"key": "phone", "label": "WhatsApp", "type": "tel", "required": false},
  {"key": "faturamento", "label": "Qual seu faturamento?", "type": "select", "options": ["Até R$5k", "R$5k-R$30k", "R$30k+"]},
  {"key": "maior_dor", "label": "Qual sua maior dificuldade?", "type": "textarea"}
]
```

### 3. Upgrade da Edge Function `capture-lead`

Expandir para aceitar campos dinâmicos e gravar respostas:

- Receber `form_id` opcional no body
- Se `form_id` presente, buscar a config do formulário em `imphq_capture_forms`
- Todos os campos extras (além de email/nome/phone) viram registros em `imphq_lead_responses`
- Gravar `step` e `field_key` para facilitar análise posterior
- Enriquecer `data` JSONB do lead com campos extras (`profissao`, `faturamento`, etc.)
- Continuar suportando chamadas simples sem `form_id` (retrocompatível)

### 4. UI no Painel

#### 4.1 Gerenciador de Formulários (nova aba em Leads ou no Projeto)

- Lista de formulários criados com status (ativo/inativo)
- Editor visual de campos: arrastar para reordenar, tipos (text, email, tel, select, textarea, radio, checkbox)
- Preview do formulário
- Gerar snippet HTML/JS embutível: `<script src="..."></script>` ou `<form action="https://...capture-lead?project=X&form=Y">`
- Gerar link direto do formulário hospedado no próprio Imperio HQ

#### 4.2 Respostas na Jornada do Lead

Na timeline do lead (aba Jornada), exibir as respostas como eventos formatados:
- "📝 Pesquisa Pré-Webinar: faturamento = R$10k-R$30k, maior_dor = Não consigo escalar"

#### 4.3 Aba Insights (análise de respostas)

Na página de Leads, nova aba "Insights" que cruza respostas com conversão:
- Gráfico de barras: "Respostas mais comuns para [campo X]"
- Tabela cruzada: "Dos que responderam faturamento > R$30k, X% compraram"
- Nuvem de palavras ou lista de respostas abertas mais frequentes
- Filtro por formulário e por período

---

## Snippet Embutível (o que seu time/designer recebe)

Duas opções de integração para páginas externas:

**Opção A — Form HTML puro (funciona em qualquer LP):**
```html
<form action="https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/capture-lead?project=ID&form=FORM_ID" method="POST">
  <input name="email" required />
  <input name="nome" />
  <select name="faturamento">
    <option>Até R$5k</option>
    <option>R$5k-R$30k</option>
  </select>
  <button type="submit">Enviar</button>
</form>
```

**Opção B — JS embed (mais rico, sem redirect):**
```html
<div id="imp-form" data-form="FORM_ID" data-project="PROJECT_ID"></div>
<script src="https://imperiox.lovable.app/embed/capture.js"></script>
```

---

## Resumo de Arquivos

| Arquivo | Mudança |
|---|---|
| **Migração SQL** | Tabelas `imphq_lead_responses` e `imphq_capture_forms` com RLS |
| `supabase/functions/capture-lead/index.ts` | Aceitar campos dinâmicos, gravar respostas, buscar config de form |
| `src/pages/Leads.tsx` | Nova aba "Formulários" + nova aba "Insights" |
| `src/components/leads/FormBuilder.tsx` | Editor visual de formulários com preview e gerador de snippet |
| `src/components/leads/FormInsights.tsx` | Análise cruzada de respostas vs conversão |
| Timeline do lead | Exibir respostas como eventos na jornada |

---

## Ordem de Execução

1. Migração SQL (2 tabelas)
2. Upgrade da edge function `capture-lead`
3. FormBuilder (criar/editar formulários + gerar snippets)
4. Respostas na timeline do lead
5. Aba Insights com análise cruzada

