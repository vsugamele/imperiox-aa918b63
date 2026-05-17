## Gerador de Prompts Ultrarrealistas — Integração ao Imperius

Sim, dá pra adaptar 100% — e melhor que um HTML único, porque já temos design system (dark, gold #c9922a), Studio/Criativos/ConteúdoIA, e Lovable AI Gateway pra enriquecer com IA.

### Onde encaixar

Nova rota `/studio/prompts` (sub-aba dentro do Studio) + atalho no hub Conteúdo IA. Não cria página solta — entra no pipeline **Ideia → Roteiro → Criativo → Vídeo** como gerador de prompts visuais para a etapa **Criativo**.

### Estrutura

```
src/pages/PromptGenerator.tsx           ← página principal
src/components/prompts/
  ├─ PromptSection.tsx                  ← wrapper de seção (título + grid)
  ├─ PromptField.tsx                    ← select + campo LIVRE (lida com __free__)
  ├─ PromptOutput.tsx                   ← output box + copiar + salvar
  └─ promptOptions.ts                   ← todas as 22 listas PT→EN
src/lib/promptBuilder.ts                ← monta o template da Seção 6
```

### Adaptações ao nosso sistema (vs HTML puro)

1. **Design tokens nossos** — usa `bg-background`, `border-border`, `text-primary` (gold). Sem hardcode de `#F7D200`. Mantém vibe dark premium já existente (Cormorant + DM Sans em vez de Tomorrow/Montserrat — coerência de marca).
2. **Componentes shadcn** — `Select`, `Input`, `Button`, `Card` em vez de `<select>` cru. Comportamento `__free__` revela um `Input` inline.
3. **Persistência** — botão **"Salvar no Cofre"** grava o prompt em `imphq_prompts_salvos` (nova tabela: id, user_id, project_id, titulo, prompt_text, campos jsonb, created_at) com RLS por user_id. Nada se perde.
4. **Integração com Criativos** — botão **"Usar em novo Criativo"** navega para `/criativos/novo?prompt=<id>` pré-preenchendo o campo de prompt visual.
5. **IA opcional (Lovable AI)** — botão **"✨ Refinar com IA"** envia o prompt montado + briefing do projeto ativo para edge function `prompt-refiner` (Gemini), retorna versão otimizada para Midjourney/DALL-E.
6. **Histórico** — lista lateral dos últimos 10 prompts salvos do usuário, com restore de todos os campos.

### Template de geração (Seção 6 — idêntico)

Função `buildPrompt(fields)` em `promptBuilder.ts` segue exatamente a ordem das linhas, omite vazios, anexa fenótipo antes de `skin`. Sem alteração na lógica.

### Backend mínimo

Migration:
```sql
create table imphq_prompts_salvos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text references imphq_projetos(id) on delete set null,
  titulo text,
  prompt_text text not null,
  campos jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table imphq_prompts_salvos enable row level security;
create policy "own" on imphq_prompts_salvos for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
```

Edge function `prompt-refiner` (opcional, fase 2): chama `google/gemini-2.5-flash` via Lovable AI Gateway.

### Fases

1. **Fase A (core, ~rápido)** — página + 22 selects + builder + copiar/resetar. Sem backend.
2. **Fase B** — tabela + salvar/histórico + RLS.
3. **Fase C** — refinar com IA + integração Criativos.

### O que NÃO vou fazer

- Não vou criar um `.html` standalone — viraria silo fora do sistema.
- Não vou usar fontes Tomorrow/Montserrat (quebra identidade Cormorant/DM Sans).
- Não vou hardcodar cores — tudo via tokens do `index.css`.

Confirma se faço **só Fase A** primeiro (entregável já hoje) ou **A+B juntas** (salva no Cofre desde o início)?
