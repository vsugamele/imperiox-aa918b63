

# Plano: Import Multi-arquivo + Skill Market Intel

## 2 Tarefas

### 1. Import de skill com multiplos arquivos

Hoje o `handleImportFile` aceita apenas 1 arquivo. A skill "Market Intel" tem 1 arquivo principal + 5 referencias (intake, mapa-protocol, copy-library, scoring, outputs, platforms). O import precisa suportar isso.

**Mudancas em `Skills.tsx`**:

- Input file: adicionar `multiple` ao `<input type="file">`
- `handleImportFile`: processar todos os arquivos selecionados
  - O primeiro `.md` (ou o maior) vira o `system_prompt` principal
  - Os demais sao concatenados como secoes de referencia no final do prompt, com separador `---\n## Referencia: {nome do arquivo}\n`
  - ZIP: extrair todos os `.md` do zip e aplicar a mesma logica
- Label do botao: "Importar .md / .zip (multiplos)"

### 2. Subir a skill Market Intel v2

Copiar os 6 arquivos do usuario para `src/data/skills/`:
- `SKILL-3.md` → `src/data/skills/market-intel-v2.md` (prompt principal)
- `intake-2.md` → conteudo concatenado no prompt
- `mapa-protocol-2.md` → conteudo concatenado
- `copy-library-2.md` → conteudo concatenado
- `scoring-3.md` → conteudo concatenado
- `outputs-2.md` → conteudo concatenado
- `platforms-2.md` → conteudo concatenado

Criar um unico arquivo `src/data/skills/market-intel-v2.md` que combina o prompt principal com todas as referencias inline (ja que o sistema de skills usa 1 prompt por skill).

Registrar no `skillsData.ts`:
```typescript
import marketIntelPrompt from "./skills/market-intel-v2.md?raw";
// ...
{
  id: "market-intel",
  nome: "Market Intel",
  versao: "V2.0",
  categoria: "Inteligência Competitiva",
  descricao: "Sistema completo de inteligência de mercado para infoprodutos. Pesquisa nichos, espiona concorrentes, mapeia produtos, define ângulos de copy e gera relatórios com score objetivo.",
  gatilho: "[Nicho] ou [Temas do usuário]",
  status: "Ativo",
  icone: "🕵️",
  cor: "#4895ef",
  system_prompt: marketIntelPrompt,
}
```

Adicionar ao `SKILL_FILE_MAP` em `Skills.tsx`:
```typescript
"market-intel": "market-intel-v2.md",
```

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/data/skills/market-intel-v2.md` | Novo — prompt completo com 6 referencias inline |
| `src/data/skillsData.ts` | Import + registro da skill Market Intel |
| `src/pages/Skills.tsx` | Import multi-arquivo + registro no SKILL_FILE_MAP |

## Ordem

1. Criar market-intel-v2.md combinado
2. Registrar em skillsData.ts
3. Atualizar Skills.tsx (multi-import + SKILL_FILE_MAP)

