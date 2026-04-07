

# Plano: Agregar todas imagens do sistema em Referencias

## Objetivo

Fazer a pagina Referencias funcionar como hub central de todas as imagens do sistema, puxando automaticamente de `imphq_content_library` (midia dos projetos — fotos expert, anuncios, produtos, etc.) alem das referencias manuais ja existentes.

## Situacao atual

- **Referencias** (`imphq_referencias`): referencias manuais com upload, score, tipo, pasta
- **Content Library** (`imphq_content_library`): midias dos projetos com `content_category` (expert, produtos, complementar, anuncios, reels, stories, feed)
- O botao "Importar do Projeto" so importa `imphq_media_content` com category=anuncios (tabela que pode nem existir mais)
- Nao ha visao unificada de todas as imagens do sistema

## Mudancas

### 1. Carregar `imphq_content_library` junto com `imphq_referencias`

No `load()`, alem de buscar `imphq_referencias`, buscar tambem `imphq_content_library` (apenas file_type=image e video). Mapear os items para o formato `Ref` com campo `source: "library" | "manual"` para distinguir.

Itens da library serao read-only (nao editaveis/deletaveis direto de Referencias — sao gerenciados no projeto).

### 2. Adicionar filtro por origem/categoria

Novos filtros na toolbar:
- **Origem**: Todos | Minhas Refs | Projetos
- **Categoria do projeto**: Expert | Produtos | Anuncios | Reels | Stories | Feed (quando origem = Projetos)

### 3. Substituir `importFromProject` por visualizacao direta

Em vez de importar (copiar dados), exibir os itens da library diretamente na grid. O botao "Importar do Projeto" vira desnecessario pois os dados ja aparecem em tempo real.

Manter o botao mas mudar para "Salvar como Referencia" — ao clicar num item da library, poder salva-lo como referencia manual com score/tags/notas.

### 4. Agrupar visualmente por projeto

Quando nao ha filtro de projeto ativo, mostrar um header separador entre projetos: "📁 JP Freitas" com contagem de itens. Dentro de cada projeto, separar por content_category (📸 Expert, 📣 Anuncios, etc.).

### 5. Filtro por produto

Adicionar Select de produto na toolbar. Os produtos vem de `imphq_content_library.tags` ou do campo `produto` da referencia.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/Referencias.tsx` | Buscar content_library, unificar com refs, novos filtros (origem, categoria), headers por projeto, "Salvar como Ref" |

## Ordem

1. Expandir `load()` para buscar `imphq_content_library`
2. Mapear items da library para formato Ref unificado
3. Adicionar filtros de origem e categoria
4. Ajustar grid para mostrar badge de origem e headers por projeto
5. Acao "Salvar como Referencia" para itens da library

