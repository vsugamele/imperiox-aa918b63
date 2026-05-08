# Export de Skills para Claude Desktop

## Objetivo
Permitir baixar qualquer Skill do Império HQ (e todas de uma vez) em formato compatível com **Anthropic Agent Skills** — o padrão oficial usado pelo Claude Desktop / Claude.ai. Cada skill vira um `.zip` que o usuário arrasta para Claude → Settings → Capabilities → Skills.

## Como funciona o formato Claude Skills
Cada skill é uma pasta com:
- `SKILL.md` (obrigatório) — frontmatter YAML + corpo em Markdown:
  ```
  ---
  name: nome-kebab-case        # ≤ 64 chars
  description: O que faz e quando usar  # ≤ 1024 chars, em 3ª pessoa
  ---
  # Conteúdo / instruções da skill (system prompt)
  ```
- Arquivos auxiliares opcionais (references/, scripts/, assets/).

O Claude lê só o frontmatter no boot e carrega o corpo sob demanda quando a descrição combina com a tarefa do usuário.

## Escopo da implementação

### 1. Helper `src/lib/claudeSkillExport.ts`
- `toClaudeSkillSlug(nome)` → kebab-case sanitizado.
- `buildSkillMarkdown(skill)` → monta `SKILL.md` com frontmatter (name + description truncada a 1024 chars) e o `system_prompt` no corpo. Quando `system_prompt` estiver vazio, usa `descricao` + nota de placeholder.
- `downloadSkillZip(skill)` → gera 1 zip (`<slug>.zip`) contendo `<slug>/SKILL.md` via JSZip (já instalado).
- `downloadAllSkillsZip(skills)` → gera `imperio-skills.zip` com uma pasta por skill + `README.md` listando todas e instruções de instalação no Claude Desktop.

### 2. UI em `src/pages/Skills.tsx`
- Em cada card de skill: novo botão ícone **Download** (tooltip "Baixar para Claude Desktop") ao lado dos botões existentes.
- No header da página: botão **"Exportar todas (.zip)"** ao lado do "Nova Skill".
- Toast de sucesso após o download com dica curta: "Arraste o .zip em Claude → Settings → Capabilities → Skills".

### 3. Modal de instruções (1x, opcional)
Pequeno `Dialog` "Como instalar no Claude Desktop" acessível por um link `?` ao lado do botão de exportar tudo, com os 4 passos (abrir Claude Desktop → Settings → Capabilities → Skills → Upload skill → selecionar .zip) e link para a doc oficial.

## Fora do escopo
- Sincronização bidirecional com Claude.
- Empacotar arquivos auxiliares (scripts/assets) — só `SKILL.md` por enquanto, que já cobre 100% das skills atuais (todas são prompt-only).
- Publicar como MCP server (caminho diferente; podemos planejar depois se quiser).

## Validação
- Baixar 1 skill, descompactar, conferir frontmatter válido (`name` kebab-case, `description` ≤ 1024).
- Importar no Claude Desktop e disparar um prompt que ative a skill.
