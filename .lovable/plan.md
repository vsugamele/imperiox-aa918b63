

# Plano: Oportunidades de Melhoria no Imperio HQ

## Status Atual

O Arsenal de Copy por produto ja foi implementado no Briefing com os 6 blocos (Promessa, Inimigo Comum, Efeito Colateral, Oportunidade, Metodo Simplificado, Hora do Show). O Chat com comandos e o Activity Feed no Dashboard tambem estao prontos.

---

## Oportunidades Identificadas por Modulo

### 1. Arsenal de Copy -- Melhorias (Briefing)

O arsenal atual usa 1 textarea por bloco. Pelo seu exemplo do JP, cada bloco precisa de **multiplos textos/variacoes** (nao apenas 1). Melhorias:

| Melhoria | Descricao |
|---|---|
| **Multi-variacoes por bloco** | Em vez de 1 textarea, permitir N variacoes (array de textos) com botao "+ Adicionar variacao" em cada bloco |
| **Label contextual** | Adicionar subtitulo instrucional mais rico em cada bloco (ex: "Mexer psicologicamente com o lead" na Promessa) |
| **Copiar bloco** | Botao de copiar todo o conteudo de um bloco para clipboard |

### 2. Guia de Uso da Plataforma (Onboarding)

Criar uma pagina ou modal "Guia / Como Usar" acessivel pela sidebar ou header:

| Secao | Conteudo |
|---|---|
| **Visao Geral** | O que e cada modulo (Projetos, Avatar, Briefing, Mentes, Leads, etc.) |
| **Fluxo de Trabalho** | Passo a passo: Criar projeto → Briefing → Avatar → Arsenal de Copy → Funil → Trafego |
| **Dicas por Modulo** | Cards interativos com descricao curta e link direto para cada pagina |
| **Atalhos e Comandos** | Lista de comandos do Chat (`/tarefa`, `/lead`, etc.) |

### 3. Mentes IA -- System Prompt Dinamico

Conforme o doc `MentesIA_Plano_Documentacao.md`, a Mentes IA ainda nao injeta contexto do projeto (briefing, avatar, arsenal de copy) no system prompt. Oportunidade:

- Ao selecionar um projeto na Mentes IA, injetar automaticamente: briefing, avatar, produtos com arsenal de copy
- Isso tornaria os agentes muito mais inteligentes e contextuais

### 4. Leads -- Jornada do Cliente

Conforme o doc `Detalhes_Imphq_Leads.md`, a timeline unificando cliques + eventos + vendas por lead esta documentada mas pode estar incompleta na UI.

### 5. Dashboard -- Widgets Financeiros por Projeto

O Dashboard carrega `imphq_custos` mas nao mostra ROI por projeto. Oportunidade de card "Top Projetos por ROI".

---

## Prioridade Sugerida

1. **Arsenal de Copy com multi-variacoes** -- impacto direto no workflow de copy
2. **Guia de Uso da Plataforma** -- ajuda onboarding e referencia rapida
3. **Mentes IA com contexto do projeto** -- salto de qualidade nos agentes

---

## Arquivos Alterados

| Arquivo | Acao |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Refatorar Arsenal de Copy para suportar array de variacoes por bloco |
| `src/pages/Guia.tsx` | **Novo**: pagina com guia interativo de uso da plataforma |
| `src/App.tsx` | Adicionar rota `/guia` |
| `src/components/AppSidebar.tsx` | Adicionar item "Guia" na sidebar (grupo Organizacao) |

