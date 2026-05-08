## Módulo "Studio" — Pipeline de Vídeo + Prompts Ultrarrealistas

Cria uma nova área no Império HQ que consolida os 3 sistemas dos arquivos enviados (Video Pipeline Playbook, Avatar Plan HeyGen+DreamFace, Biblioteca de Prompts Cartomantes) em um módulo único, navegável, editável e organizado por **nicho** (cartomantes, fitness, etc).

---

### 1. Sidebar — nova entrada "Studio"
Ícone `Clapperboard` em `AppSidebar.tsx`, rota `/studio`, com 3 abas internas:

```text
/studio
 ├─ /studio/playbook      → Video Pipeline (docs vivas)
 ├─ /studio/avatar-plan   → Pipeline HeyGen + DreamFace (checklist)
 └─ /studio/prompts       → Biblioteca de Prompts (filtros + copy)
```

---

### 2. Banco de dados (3 tabelas novas, todas com RLS)

**`imphq_studio_prompts`** — biblioteca de prompts ultrarrealistas
- `nicho` (text, ex: "cartomantes"), `codigo` (ex: "1F"), `titulo`, `idade`, `genero` (♀/♂), `nivel` (Padrão/Hot/Ultra Hot), `prompt_especifico` (text longo), `prompt_negativo`, `dicas`, `tags` (text[]), `favorito` (bool por user via tabela auxiliar), `created_by`, timestamps.

**`imphq_studio_pipeline_steps`** — etapas do Avatar Plan
- `nicho`, `fase` (script / heygen / dreamface / pos), `ordem`, `titulo`, `descricao`, `tipo` (checklist/doc/link), `payload` (jsonb com prompts/configs), `concluido_por` (user_id[] via tabela auxiliar de progresso).

**`imphq_studio_playbook_sections`** — blocos do Playbook
- `nicho`, `slug`, `ordem`, `titulo`, `conteudo_md` (markdown renderizado), `categoria`.

**`imphq_studio_user_state`** — favoritos e progresso por usuário
- `user_id`, `entity_type` (prompt/step), `entity_id`, `state` (jsonb: `{favorito:true, concluido:true, nota:""}`).

RLS: leitura para todos autenticados, escrita só para roles `admin`/`editor` (usar `has_imphq_role`). Estado pessoal sempre filtrado por `auth.uid()`.

---

### 3. Páginas React

**`/studio/prompts`** — replica visual do `prompts-cartomantes.html`
- Header com contador (Total / Padrão / Hot / Ultra Hot por nicho selecionado).
- Filtros: chips de nível, gênero, idade, busca textual, dropdown de **nicho**.
- Grid de cards com: código, título, idade, nível (badge colorido), preview do prompt (expansível), botão **Copiar** (toast), **Favoritar** (★), **Editar** (admin).
- Modal "Nova/Editar Prompt" com todos os campos.
- Botão "Importar JSON" (admin) — aceita o formato de `cartomantes.json` e faz bulk insert.

**`/studio/avatar-plan`** — replica `avatar-plan.html`
- Sidebar interna com fases (Script → HeyGen → DreamFace → Pós).
- Cada step renderizado como card com checkbox de progresso pessoal, prompts copiáveis e configs (jsonb).
- Indicador de progresso por fase (% concluído pelo usuário).

**`/studio/playbook`** — replica `index.html` (Video Pipeline)
- Sidebar com âncoras das seções.
- Conteúdo renderizado via `react-markdown` a partir de `conteudo_md`.
- Modo edição inline para admin (textarea + preview).

---

### 4. Seed inicial
Edge Function `studio-seed` (rodada 1x manualmente) que importa:
- 42 prompts do `cartomantes.json` → `imphq_studio_prompts` (nicho="cartomantes").
- Seções do Avatar Plan extraídas do HTML → `imphq_studio_pipeline_steps`.
- Seções do Playbook extraídas do HTML → `imphq_studio_playbook_sections` (nicho="cartomantes" como base; depois clonável para outros nichos).

---

### 5. Design
Reaproveita o tema dark gold do Império HQ (bg `#080607`, gold `#c9922a`, Cormorant + DM Sans). Os HTMLs originais usam paletas distintas (roxo/dourado) apenas como referência de **estrutura**, não de cor — mantemos a identidade visual atual.

---

### Detalhes técnicos
- 3 tabelas + 1 de estado, IDs UUID, RLS via `has_imphq_role`.
- Bulk import via Edge Function `studio-import-prompts` (valida schema do JSON).
- Componentes em `src/components/studio/` (`PromptCard`, `PromptFilters`, `PipelineStep`, `PlaybookSection`, `PromptEditorDialog`).
- Páginas em `src/pages/Studio.tsx` com sub-rotas via React Router.
- Markdown rendering: já temos `react-markdown` no projeto.

### Fora do escopo
- Integração ao vivo com APIs do HeyGen/DreamFace (só checklist/prompts por enquanto).
- Geração automática de imagem a partir do prompt (futuro: ligar a Replicate/Flux).
- Versionamento histórico dos prompts.