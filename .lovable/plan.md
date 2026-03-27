

# Plano: Export de Contexto, IA Expandida, Color Picker, KPIs com IA e Filtros em Finanças

## 6 frentes

---

### 1. Exportar dados do projeto (JSON/Markdown + Webhook)

Adicionar botao "📤 Exportar Contexto" no header do `ProjetoDetalhe` que gera um JSON/Markdown consolidado com: Expert, Briefing, Avatar, Branding, Concorrentes, KPIs, Produtos, Pesquisa. O usuario pode copiar ou baixar.

Para webhooks: criar uma nova edge function `imperio-api` (ou expandir a existente) com endpoint `GET /imperio-api?project_id=X&action=export_context` que retorna o mesmo JSON consolidado. Cada projeto ja tem seu ID, entao o webhook e por projeto automaticamente.

**Arquivos**: `src/pages/ProjetoDetalhe.tsx` (botao + dialog de export), `supabase/functions/imperio-api/index.ts` (endpoint de export)

---

### 2. "Completar com IA" expandido -- seletor de modelo + contexto visivel

Criar um componente reutilizavel `AIGenerateButton` que:
- Antes de chamar a IA, abre um mini-dialog perguntando qual modelo usar (Gemini Flash, Gemini Pro, GPT-5, GPT-5 Mini)
- Mostra um resumo dos campos/dados que serao usados como contexto (ex: "Usando: Avatar, Branding, Concorrentes, Produtos")
- Indica quais campos serao preenchidos

Aplicar esse componente em todos os lugares que ja tem "Completar com IA" (Branding, CopyArsenal, Gatilhos) e adicionar em novos:
- **Expert** (ProjetoExpert) -- preencher bio, tom de voz, pilares baseado em pesquisas
- **Avatar perfil** (PerfilTab) -- preencher dados demograficos baseado em pesquisas/concorrentes
- **Posicionamento** (dentro de Branding) -- preencher inimigo, mecanismo, personalidade

A edge function `openflow-ai` recebera um campo `model` opcional no body.

**Arquivos**: `src/components/projeto/AIGenerateButton.tsx` (novo componente), `src/components/projeto/ProjetoExpert.tsx`, `src/components/projeto/avatar/PerfilTab.tsx`, `src/components/projeto/ProjetoBranding.tsx`, `src/components/projeto/CopyArsenalSection.tsx`, `src/components/projeto/avatar/GatilhosTab.tsx`, `supabase/functions/openflow-ai/index.ts`

---

### 3. Branding -- Color Picker nativo

Na secao "Paleta de Cores" do `ProjetoBranding`, adicionar:
- Um `<input type="color">` nativo ao lado do campo de tags hex
- Ao selecionar uma cor, ela e adicionada automaticamente a lista de tags
- Os swatches de cor ja existentes continuam funcionando
- Clicar em um swatch existente abre o color picker para editar aquela cor

**Arquivo**: `src/components/projeto/ProjetoBranding.tsx`

---

### 4. KPIs com IA

Adicionar botao "🤖 Calcular com IA" no `ProjetoKPIs` que:
- Usa o mesmo `AIGenerateButton` com seletor de modelo
- Envia dados reais do projeto (vendas, custos, ads, leads) para a IA
- A IA calcula/estima CPL, CAC, ROI, ROAS, Ticket Medio, LTV, Taxa de Conversao, Leads/Mes
- Preenche apenas campos vazios

Nova action `generate_kpis` na edge function `openflow-ai`.

**Arquivos**: `src/components/projeto/ProjetoKPIs.tsx`, `supabase/functions/openflow-ai/index.ts`

---

### 5. Financas do projeto -- filtros por periodo

Adicionar barra de filtros no topo do `ProjetoFinancas`:
- Seletor de periodo: Hoje, 7 dias, 30 dias, Este mes, Mes passado, Custom
- Filtrar custos, receitas, ads e vendas pelo periodo selecionado
- KPIs recalculados com base no periodo filtrado

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx`

---

### 6. Edge function -- novos actions e modelo configuravel

Expandir `openflow-ai`:
- Aceitar campo `model` no body (default: `google/gemini-3-flash-preview`)
- Nova action `export_context` -- retorna JSON consolidado do projeto
- Nova action `generate_kpis` -- calcula KPIs baseado em dados reais
- Nova action `generate_expert` -- preenche dados do expert
- Nova action `generate_avatar_perfil` -- preenche perfil do avatar

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/components/projeto/AIGenerateButton.tsx` | **Novo**: componente reutilizavel com seletor de modelo e contexto visivel |
| `src/pages/ProjetoDetalhe.tsx` | Botao "Exportar Contexto" no header |
| `src/components/projeto/ProjetoBranding.tsx` | Color picker nativo na paleta de cores |
| `src/components/projeto/ProjetoKPIs.tsx` | Botao "Calcular com IA" usando AIGenerateButton |
| `src/components/projeto/ProjetoExpert.tsx` | Botao "Completar com IA" |
| `src/components/projeto/ProjetoFinancas.tsx` | Filtros por periodo |
| `src/components/projeto/CopyArsenalSection.tsx` | Migrar para AIGenerateButton |
| `src/components/projeto/avatar/GatilhosTab.tsx` | Migrar para AIGenerateButton |
| `supabase/functions/openflow-ai/index.ts` | Campo `model`, actions generate_kpis, generate_expert, generate_avatar_perfil |
| `supabase/functions/imperio-api/index.ts` | Endpoint export_context por projeto |

