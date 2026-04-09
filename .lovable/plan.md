

# Plano: Minimap + Importador de HTML/CSS/Imagem no Fluxograma

## 1. Minimap

Renderizar um pequeno `<canvas>` ou `<div>` no canto inferior direito do canvas (estilo Google Docs / Figma) que mostra uma visao reduzida de todos os nos. Um retangulo semitransparente indica a area visivel (viewport). Clicar/arrastar no minimap atualiza o `pan` para navegar rapidamente.

**Implementacao**: Componente interno `FlowMinimap` que recebe `nodes`, `pan`, `zoom`, `canvasSize` e `viewportSize`. Renderiza nos como retangulos coloridos em escala reduzida (~150x100px). O viewport indicator e um retangulo com borda primaria.

## 2. Importador de HTML/CSS/Imagem

Botao "Importar" na toolbar que abre um dialog com 2 opcoes:

**a) HTML/CSS**: Upload de arquivo `.html`. O front faz parse do DOM (via `DOMParser`) para extrair `<div>`, `<section>`, `<h1-h6>`, listas, etc. e converte em nos do fluxograma automaticamente:
- Cada secao/div principal vira um no "etapa"
- Headers viram titulo do no
- Paragrafos viram subtitulo
- Posiciona automaticamente em grid (top-down, left-to-right)

**b) Imagem**: Upload de PNG/JPG. A imagem e adicionada como um no especial tipo "imagem" (novo tipo) com a imagem renderizada dentro. Usa Supabase Storage para upload e exibe a URL no no.

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/ProjetoFlowcharts.tsx` | Adicionar `FlowMinimap` + botao Importar + dialog de importacao + novo tipo "imagem" |

## Ordem

1. Implementar minimap com viewport indicator
2. Adicionar dialog de importacao com parse HTML e upload de imagem
3. Novo tipo de no "imagem" para exibir imagens importadas

