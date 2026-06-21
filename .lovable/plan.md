# Guia de Inteligência para Claude — Pasta de Skills

Vou montar uma pasta `claude-skills/` na raiz do projeto com **8 arquivos .md modulares**, consolidando todo o arsenal de copy/VSL/avatar do ImperioHQ num formato pronto pra colar no Claude Projects (cada arquivo vira um "knowledge file" do projeto).

## Estrutura proposta

```text
claude-skills/
├── README.md                    # Índice + instruções de uso no Claude Projects
├── 00-persona-imperius.md       # Tom estratégico, pt-BR, hierarquia de prioridade
├── 01-vsl-7-blocos.md           # Estrutura VSL 19m30s + regras por bloco
├── 02-copy-frameworks.md        # Equação Hormozi + Sales Page 14 blocos + ângulos de ad
├── 03-avatar-4-camadas.md       # C1 Sintomas → C4 Ferida central + mapeamento de desejos
├── 04-skills-arsenal.md         # Consolidado dos /skills (Anams, Devastador, Filemon, Mecanismo Único, Tripwire, LP Persuasiva, Yoshitani, Sales Architect/Closer, Webinar)
├── 05-roteiros-virais-reels.md  # 60+ estruturas (Dica, React, Antes/Depois, etc.) de roteirosViraisTemplates.ts
└── 06-prompt-base-copy.md       # Prompt-mãe pronto: "Você é o Imperius..." c/ regras de output
```

## Conteúdo por arquivo

**00 — Persona Imperius**: tom estratégico/militar, pt-BR, sempre consulta avatar+branding, prioriza projetos "vendendo", nunca cita IA na copy final.

**01 — VSL 7 Blocos**: extraído de `src/data/copilotFrameworks.ts` (vsl.blocks) — Gancho, Agitação, Origem/Epifania, Mecanismo Único, Oferta/Ancoragem, Value Stack, Garantia/CTA. Cada bloco com timing, objetivo e *rule* anti-erro.

**02 — Copy Frameworks**: 
- Equação de Valor Hormozi (fórmula + 4 alavancas)
- Sales Page 14 Blocos (B1 Headline → B14 CTA)
- 5 ângulos de anúncio (Raiva, Medo, Lógica, Status, Curiosidade)

**03 — Avatar 4 Camadas**: C1 Sintomas Observáveis → C2 Dores Conscientes → C3 Ego Ferido → C4 Ferida Central, com perguntas-guia pra preencher cada camada.

**04 — Skills Arsenal**: condenso os .md de `src/data/skills/` (10+ skills) num único índice navegável, mantendo o prompt-system de cada um (Devastador V4, Anams Copywriter, Ângulos Filemon, Mecanismo Único V2, Tripwire Matador, LP Persuasiva, Sales Architect/Closer, Webinar Roteiro, Yoshitani Traffic, Dossiê Problemas).

**05 — Roteiros Virais**: lista de `src/data/roteirosViraisTemplates.ts` com estrutura de cada formato (gancho + corpo + CTA).

**06 — Prompt Base**: prompt-system pronto pra colar no campo "Instructions" do Claude Project, instruindo a ler os outros 6 arquivos como knowledge base e gerar copy seguindo o pipeline Avatar → Ângulo → Framework → Output.

**README**: passo a passo de "como usar no Claude Projects" (criar Project → colar 00-prompt em Instructions → upload dos 01-06 em Knowledge → começar a pedir copy).

## Arquivos a criar
- 8 arquivos novos sob `claude-skills/`

## Fora de escopo
- Não cria Claude Skill empacotada (`.claude/skills/` com SKILL.md frontmatter) — é pasta solta pra colar no Claude Projects, conforme escolhido.
- Não altera código do app.
- Não inclui transcripts de aulas (`docs/transcripts/`) — escopo é frameworks de copy.
