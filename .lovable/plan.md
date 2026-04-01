

# Plano: Corrigir parser do Avatar para HTML V2 ("Código da Pele")

## Problema

O HTML "Código da Pele" usa uma estrutura CSS completamente diferente do HTML que o parser foi construído para ler (formato JP Freitas). Nenhum seletor bate, então o import resulta em objeto vazio.

## Mapeamento de diferenças (V1 vs V2)

```text
Seção            | Parser espera               | HTML V2 usa
─────────────────┼─────────────────────────────┼──────────────────────────
Sub-avatares     | .avatar-card .av-name       | .sub-card .sub-card-name
                 | .av-row .av-key .av-val     | .sub-field .sub-field-label .sub-field-value
Voyerismos       | .scene .scene-title         | .voyeur-card .voyeur-title
                 | .scene-key .scene-val       | .voyeur-key .voyeur-val
                 | .scene-quote                | .voyeur-quote
                 | .scene-intensity            | .intensity-badge
Camadas C1-C4    | .acc-card .acc-num          | <h3>Camada N — ...</h3> + .card ul.styled
                 | .card .card-label C1/C2     | (sem label, inferido do heading)
Desejos          | .desejo-card .dc-name       | .desire-card .desire-name
                 | .dc-score-pill .dc-tag      | .desire-score-badge .mini-score
                 | #desejos-b2/b3/b4          | <h4> headings (Externos/Internos/Proibidos)
Ads              | .ad-angle .ad-section       | .ad-label .ad-body p>strong
                 | .ad-key .ad-text            | (inline bold: Hook/Corpo/CTA)
Problemas        | #problemas-tabela           | #m7 .score-table (sem ID especial)
Emoções          | .em-step .em-num .em-name   | .emotion-step .emotion-num .emotion-name
Palavras         | .wpill .dor/.desejo         | .word .pain/.desire/.solution
Frases-gatilho   | .frase-gatilho .dor/.des    | .phrase-trigger .phrase-type.pain/.desire
Crenças          | .belief-box .belief-type     | .sub-field-label + .highlight (inline)
Síntese          | .sint-card .sint-title       | .strategy-box .strategy-title .strategy-text
Trauma           | (não suportado)              | .trauma-step .trauma-circle .trauma-content
Ciclo sabotagem  | .cycle-item .cycle-step      | .cycle-box + .cycle-arrow
```

## Solução

Atualizar `parseAvatarHTML()` em `AvatarImporter.tsx` para detectar ambos os formatos. Para cada seção, adicionar seletores fallback para as classes V2:

1. **Sub-avatares**: Adicionar fallback `.sub-card` → `.sub-card-name` para nome, `.sub-field-label` / `.sub-field-value` para campos
2. **Voyerismos**: Adicionar fallback `.voyeur-card` → `.voyeur-title`, `.voyeur-key`/`.voyeur-val`, `.voyeur-quote`, `.intensity-badge`
3. **Camadas C1-C4**: Buscar `<h3>` com texto "Camada N" e coletar os `<li>` dos `.card ul.styled` seguintes
4. **Desejos**: Adicionar fallback `.desire-card` → `.desire-name`, `.desire-score-badge`, `.mini-score`, classificar por heading `<h4>` (Externos vs Internos vs Proibidos)
5. **Ads**: Adicionar fallback para `.ad-card .ad-label` + parsear `<p><strong>Hook:</strong>` / `Corpo:` / `CTA:` do `.ad-body`
6. **Problemas**: Adicionar fallback `#m7 .score-table` ou qualquer `.score-table` dentro de seção com título "Problemas"
7. **Emoções**: Adicionar `.emotion-step` / `.emotion-num` / `.emotion-name` / `.emotion-quote`
8. **Palavras**: Adicionar `.word.pain` / `.word.desire` / `.word.solution` / `.word.validation`
9. **Frases-gatilho**: Adicionar `.phrase-trigger` → `.phrase-type` (pain/desire/decision) + `.phrase-text`
10. **Crenças**: Buscar `.sub-field-label` com texto "Crença Bloqueadora/Necessária" + próximo `.highlight p`
11. **Síntese**: Adicionar `.strategy-box` → `.strategy-title` / `.strategy-text`
12. **Trauma (novo)**: Parsear `.trauma-step` → `.trauma-circle` (número) + `.trauma-step-title` + conteúdo
13. **Ciclo sabotagem**: Adicionar `.cycle-box` com `.cycle-arrow` como etapas

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/components/projeto/avatar/AvatarImporter.tsx` | Adicionar seletores V2 como fallback em `parseAvatarHTML()` para todas as seções |

