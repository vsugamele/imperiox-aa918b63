

# Plano: Melhorar Cofre de Ferramentas + Evoluir Referencias como Media Library

2 blocos de trabalho.

---

## Bloco 1: Melhorar visualizacao do Cofre

### Problemas atuais
- Cards usam icone generico `Globe` para tudo
- Sem favicon/imagem do site
- Sem filtro por projeto
- Sem cor visual por categoria (so badge de texto)
- Nao puxa links dos projetos automaticamente

### Mudancas em `Cofre.tsx`

1. **Favicon automatico**: Usar `https://www.google.com/s2/favicons?domain=DOMINIO&sz=32` para mostrar o icone real do site no card (fallback para `Globe` se sem URL)

2. **Campo `icon_url`**: Adicionar coluna `icon_url` na tabela `imphq_tools_vault` para upload de icone customizado (via FileUpload). Se preenchido, usa ele; senao, usa favicon do Google

3. **Cor por categoria**: Aplicar `border-l-4` colorido nos cards (igual ao Referencias), cada categoria com sua cor (rose para social, amber para ads, etc.)

4. **Filtro por projeto**: Adicionar Select de projeto ao lado do filtro de categoria. Agrupar por projeto quando filtrado

5. **Importar links dos projetos**: Botao "Importar do Projeto" que le `project.data.links` de cada projeto e cria entradas automaticas no cofre com `project_id` preenchido

6. **Campo produto**: Adicionar coluna `produto` (text) para associar ferramenta a um produto especifico

### Migracao SQL
- `ALTER TABLE imphq_tools_vault ADD COLUMN icon_url text, ADD COLUMN produto text;`

---

## Bloco 2: Evoluir Referencias como biblioteca de midia de ads

### Problema atual
Referencias funciona como swipe file generico — nao tem conceito de "pasta", nao sincroniza com midia dos projetos, nao tem upload facil de screenshots de anuncios

### Mudancas em `Referencias.tsx`

1. **Campo `pasta`**: Adicionar coluna `pasta` (text) na tabela `imphq_referencias` para organizar em pastas customizaveis (ex: "Anuncios Meta Jan/26", "Criativos Produto X"). Filtro por pasta na UI

2. **Campo `produto`**: Adicionar coluna `produto` (text) para associar referencia a um produto especifico

3. **Filtro por pasta**: Adicionar sidebar ou select com as pastas existentes (extraidas dos dados). Botao para criar nova pasta

4. **Upload em massa**: Botao "Upload Multiplo" que aceita varios arquivos de uma vez e cria uma referencia para cada, pre-preenchendo projeto e pasta selecionados

5. **Sincronizar com projeto**: Botao "Importar do Projeto" que puxa conteudos do tipo "anuncios" da tabela `imphq_media_content` (usada no ProjetoMidia) e cria referencias automaticas com `project_id` preenchido

6. **View melhorada**: Adicionar toggle grid/lista. Na view lista, mostrar thumbnail pequeno + titulo + projeto + pasta + tags numa linha

### Migracao SQL
- `ALTER TABLE imphq_referencias ADD COLUMN pasta text, ADD COLUMN produto text;`

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar `icon_url`, `produto` em vault + `pasta`, `produto` em referencias |
| `src/pages/Cofre.tsx` | Favicon, cor por categoria, filtro projeto, campo produto, importar links |
| `src/pages/Referencias.tsx` | Filtro pasta, campo produto, upload multiplo, importar do projeto, toggle grid/lista |

## Ordem

1. Migracao SQL (ambas tabelas)
2. Cofre.tsx (favicon + cores + filtros + importar)
3. Referencias.tsx (pasta + produto + upload multiplo + importar + view toggle)

