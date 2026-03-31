

# Plano: Upload da Skill Webinar + Botão "Executar Skill" com Projeto/Produto/Contexto Completo

---

## 1. Salvar a Skill de Webinar automaticamente no banco

O conteúdo do `SKILL-2.md` (194 linhas) e do `prompt-mestre-webinar.md` (267 linhas) serão combinados. A skill será salva na tabela `imphq_skills` com:

- `nome`: "Gerador de Roteiro de Webinar"
- `categoria`: "Copy & Persuasão"
- `versao`: "V1.0"
- `gatilho`: "[Produto] e [Dados do Expert/Avatar]"
- `icone`: "Film"
- `cor`: "#e05c5c"
- `system_prompt`: conteúdo completo do `prompt-mestre-webinar.md`
- `status`: "Ativa"

O conteúdo do `.md` será copiado para `src/data/skills/webinar-roteiro.md` e também adicionado ao `SKILLS_DATA` no `skillsData.ts` para aparecer como skill default.

**Arquivos**: `src/data/skills/webinar-roteiro.md`, `src/data/skillsData.ts`

---

## 2. Botão "Executar Skill" na página de Skills

Na página de Skills, ao visualizar o detalhe de uma skill que tenha `system_prompt`, adicionar um botão **"Executar com IA"** que abre um Dialog com:

- **Select de Projeto**: lista todos os projetos do usuário
- **Select de Produto**: ao selecionar projeto, carrega os produtos do `data.produtos` desse projeto
- **Select de Modelo**: mesma lista do `AIGenerateButton` (Gemini, GPT-5, Claude, Kimi)
- **Textarea de instrução adicional** (opcional): para o usuário dar contexto extra
- **Botão "Gerar"**: chama a edge function `openflow-ai` com uma nova action `"execute_skill"`

**Arquivo**: `src/pages/Skills.tsx`

---

## 3. Nova action `execute_skill` no edge function

Na edge function `openflow-ai`, adicionar handler `handleExecuteSkill` que:

1. Recebe `skill_id`, `project_id`, `produto` (nome), `model`, `extra_instructions`
2. Busca a skill no banco → pega o `system_prompt` completo
3. Busca o projeto completo (briefing, avatar, expert, branding, copy arsenal, KPIs, concorrentes)
4. Busca o produto específico dentro de `data.produtos` e enriquece com dados de vendas
5. Busca imagens do expert (`data.expert.fotos`) e mídia do projeto
6. **Auto-enriquecimento**: busca OUTRAS skills relevantes (por categoria similar) e mentes IA para injetar como contexto adicional — ex: se a skill é de Copy, injeta também skills de Avatar e Posicionamento
7. Monta o prompt com: `system_prompt` da skill + contexto completo do projeto/produto/avatar/expert + skills complementares + mentes relevantes
8. Chama a Lovable AI Gateway com streaming desativado (resposta completa)
9. Retorna o resultado como texto

**Arquivo**: `supabase/functions/openflow-ai/index.ts`

---

## 4. Exibição do resultado

O resultado da execução da skill aparece em um Dialog com:
- Textarea scrollável com o conteúdo gerado (markdown)
- Botão "Copiar"
- Botão "Salvar como Doc" → salva em `imphq_kb` do projeto como documento

**Arquivo**: `src/pages/Skills.tsx`

---

## Detalhes Técnicos

**Auto-enriquecimento de skills/mentes**: O edge function fará:
```
SELECT nome, system_prompt, categoria FROM imphq_skills 
WHERE status = 'Ativa' AND system_prompt IS NOT NULL AND id != skill_id 
LIMIT 3
```
Filtrando por categorias complementares (se a skill é "Copy & Persuasão", busca "Pesquisa & Avatar" e "Estratégia & Posicionamento"). As 8 mentes sintéticas (Dan Kennedy, Halbert, Schwartz, etc.) serão injetadas como referência resumida.

**Contexto do produto**: Quando um produto é selecionado, o prompt inclui nome, preço, tipo (tripwire/core/premium), URLs de checkout, e dados de vendas daquele produto específico.

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `src/data/skills/webinar-roteiro.md` | Novo: conteúdo do prompt mestre |
| `src/data/skillsData.ts` | Adicionar skill webinar-roteiro ao array |
| `src/pages/Skills.tsx` | Botão "Executar com IA" + Dialog com projeto/produto/modelo + resultado |
| `supabase/functions/openflow-ai/index.ts` | Nova action `execute_skill` com contexto completo + auto-enriquecimento |

