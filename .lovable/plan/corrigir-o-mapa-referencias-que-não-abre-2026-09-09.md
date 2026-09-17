# Corrigir o mapa "Referencias" que não abre

## O que está acontecendo

O mapa **Referencias** tem um card de reel (Instagram, `dona_odete1`) salvo com a descrição vazia (nula). Ao abrir o mapa, a leitura desse card falha e o carregamento inteiro é interrompido — por isso a tela continua mostrando o mapa anterior, mesmo com "Referencias" selecionado no seletor.

Confirmado no banco: existe 1 anotação do mapa Referencias com `description` nula.

## Correção

1. Aceitar campos vazios/nulos nos cards do mapa (descrição, título, autor, thumb, link etc.), tratando-os como "sem valor" em vez de erro.
2. Tornar o carregamento tolerante: se um card estiver corrompido, ele é ignorado (com aviso no console) e o resto do mapa abre normalmente — nunca mais uma troca de mapa travada.
3. Ao trocar de mapa, limpar os elementos do mapa anterior enquanto o novo carrega, para não dar a impressão de que "não trocou".

## Detalhes técnicos

- `src/components/funis/company-map-data.ts`: no `styleSchema`, trocar `.optional()` por `.nullish()` nos campos de texto/número e normalizar `null` para `undefined` no retorno de `parseAnnotationStyle`.
- `src/components/funis/CompanyMapCanvas.tsx` (`loadMap`): envolver o parse de cada anotação em try/catch, descartando apenas a anotação inválida; resetar `nodes`/`edges`/`annotations` no início do carregamento de um novo `mapId`.
- Sem migração de banco; nenhum dado é apagado.
