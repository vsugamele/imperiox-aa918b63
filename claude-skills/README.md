# 🏛️ Imperius Copy Arsenal — Knowledge Base para Claude

Pasta pronta pra colar no **Claude Projects** (ou Claude.ai com Projects) e transformar o Claude num copywriter estratégico nível ImperioHQ.

## Como usar (passo a passo)

1. Abra **claude.ai** → **Projects** → **Create Project**.
2. Nome sugerido: `Imperius Copy Engine`.
3. **Custom Instructions** → cole o conteúdo de `06-prompt-base-copy.md`.
4. **Project Knowledge** → faça upload dos arquivos:
   - `00-persona-imperius.md`
   - `01-vsl-7-blocos.md`
   - `02-copy-frameworks.md`
   - `03-avatar-4-camadas.md`
   - `04-skills-arsenal.md`
   - `05-roteiros-virais-reels.md`
5. Comece a pedir copy: *"Gera VSL pra meu produto X, avatar Y"*, *"3 ângulos de anúncio pra Z"*, etc.

## O que cada arquivo faz

| Arquivo | Conteúdo |
|---|---|
| **00 — Persona Imperius** | Tom estratégico/militar pt-BR, hierarquia de prioridade, regras de output |
| **01 — VSL 7 Blocos** | Estrutura de VSL 19m30s com timing, objetivo e regra anti-erro por bloco |
| **02 — Copy Frameworks** | Equação de Valor Hormozi + Sales Page 14 blocos + 5 ângulos de ad |
| **03 — Avatar 4 Camadas** | C1 Sintomas → C4 Ferida Central, com perguntas-guia |
| **04 — Skills Arsenal** | Índice dos 15+ módulos especializados (Devastador, Anams, Filemon...) |
| **05 — Roteiros Virais** | 60+ estruturas de Reels (Dica, Esquema, React, Antes/Depois, Provocação) |
| **06 — Prompt Base** | System prompt pronto pro campo Instructions |

## Pipeline padrão de geração

```
Pedido do usuário
    ↓
[1] Identificar Avatar (C1→C4) — arquivo 03
    ↓
[2] Escolher Ângulo (Raiva/Medo/Lógica/Status/Curiosidade) — arquivo 02
    ↓
[3] Escolher Framework (VSL / Sales Page / Reels / Ad / Email) — arquivos 01, 02, 05
    ↓
[4] Aplicar Skill específica se relevante — arquivo 04
    ↓
[5] Entregar copy + 1 variação alternativa + métrica esperada
```

## Princípios não-negociáveis (resumo)

- pt-BR sempre, tom estratégico/militar (não corporativo, não fofo).
- Nunca cita "IA", "como modelo de linguagem", "Claude", "ChatGPT" na copy final.
- Headline antes de qualquer coisa.
- Mecanismo único > benefício genérico.
- Prova social ou prova lógica em todo bloco de venda.
- CTA único e direto. Nunca múltiplos CTAs competindo.

## Atualização

Esse arsenal espelha `src/data/skills/`, `src/data/copilotFrameworks.ts` e `src/data/roteirosViraisTemplates.ts` do projeto ImperioHQ. Quando atualizar o app, sincronize aqui.
