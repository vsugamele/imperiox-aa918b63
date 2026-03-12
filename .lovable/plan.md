

# Plano: Melhorar Parser HTML, Visualizar HTML Original e Salvar Dados do Avatar

## Problemas Identificados

### 1. Parser incompleto
O parser atual busca classes CSS que nem sempre correspondem ao HTML real:
- **Problemas**: busca `.prob-table` mas o HTML usa `.score-table` com estrutura diferente (7 scores individuais por linha)
- **Desejos**: a logica de separar externos/internos/proibidos por pill text nao funciona -- o HTML usa secoes separadas com IDs diferentes (`desejos-b1`, `desejos-b2`, `desejos-b3`)
- **Handoff**: busca `.handoff-item` mas o HTML usa `.hi` com `.hi-num` e `.hi-text`
- **Word clouds**: busca `.wpill` mas o HTML usa `.word` com classes `.dor`, `.des`, `.sol`, `.val`
- **Categorias de problemas**: 97 problemas em 13 categorias (`.cat-block`) nao sao extraidos
- **Sub-avatares**: dados ricos (hook, crenca, score) dentro de `.avatar-card` com `.av-row`, `.av-key`, `.av-val` nao sao capturados completamente
- **Fases de ativacao**: 8 fases estrategicas (`.atv-phase`) ignoradas
- **Sintese final**: 5 blocos (`.sint-card`) com insights estrategicos ignorados
- **Frases-gatilho**: `.frase-gatilho` com classes `.dor`, `.des`, `.dec` ignoradas

### 2. Sem forma de ver o HTML original
Apos importar, o HTML e descartado. Nao ha como revisitar o documento original.

### 3. Salvamento ja funciona
`onUpdateAvatar` usa `useAutoSave` que salva automaticamente no Supabase com debounce de 800ms. Nao precisa de botao extra -- mas o usuario nao sabe disso.

## Solucao

### A. Reescrever o parser para cobrir 100% do HTML
Atualizar `parseAvatarHTML()` em `AvatarImporter.tsx` para extrair:

| Secao | Seletor correto | Campo no avatar |
|---|---|---|
| Sub-avatares completos | `.avatar-card` com `.av-row .av-key .av-val` | `sub_avatares[]` com hook, crenca, urgencia, dinheiro, score |
| Cenas voyerismo | `.scene` (ja funciona) | `voyerismos[]` |
| Camadas psique | `.card` com `.card-label` contendo C1/C2/C3/C4 | `camadas_psique` |
| Crencas | `.belief-box` (ja funciona) | `crenca_bloqueadora`, `crenca_necessaria`, `epifania_central` |
| Ciclo sabotagem | `.cycle-item` | `ciclo_sabotagem[]` |
| Movimentos | `.movement` | `movimentos[]` |
| Handoff | `.hi` com `.hi-num` e `.hi-text` | `handoff[]` |
| Categorias problemas | `.cat-block` com `.plist li` | `categorias_problemas[]` |
| Tabela scores | `.score-table tbody tr` | `problemas[]` com 7 scores individuais |
| Desejos externos | secao `desejos-b1` `.desire-item` | `desejos_externos[]` |
| Desejos internos | secao `desejos-b2` `.desire-item` | `desejos_internos[]` |
| Desejos proibidos | secao `desejos-b3` `.desire-item` | `desejos_proibidos[]` |
| Palavras-chave | `.word-list .word` com classes `.dor .des .sol .val` | `palavras_dor[]`, `palavras_desejo[]`, etc. |
| Frases-gatilho | `.frase-gatilho` | `frases_gatilho_dor[]`, `frases_gatilho_desejo[]`, etc. |
| Fases ativacao | `.atv-phase` | `fases_ativacao[]` |
| Sintese final | `.sint-card` | `sintese[]` |

### B. Salvar HTML original no projeto
- Salvar o HTML cru no campo `avatar.html_original` (dentro do JSONB)
- Adicionar botao "Ver HTML Original" no `ProjetoAvatar.tsx` que abre um Dialog com iframe renderizando o HTML salvo

### C. Indicador de salvamento visivel
- Adicionar badge "Salvo automaticamente" com indicador visual (checkmark verde) na aba Avatar
- Mostrar timestamp do ultimo save

### D. Melhorar visual do preview pos-import
- Ao invés de mostrar JSON bruto, mostrar resumo amigavel: "X sub-avatares, Y problemas, Z desejos, W cenas de voyerismo importados"
- Contagem por secao com icones

## Arquivos a editar

| Arquivo | Acao |
|---|---|
| `src/components/projeto/avatar/AvatarImporter.tsx` | Reescrever parser completo + salvar HTML original + preview amigavel |
| `src/components/projeto/ProjetoAvatar.tsx` | Adicionar botao "Ver HTML Original" + badge de auto-save |

