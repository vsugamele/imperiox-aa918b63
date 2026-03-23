

# Plano: Edição na Empresa + Conexões Visuais no Funil + Busca de Projeto/Produtos

## 1. Edição inline na Empresa (`src/pages/Empresa.tsx`)

Atualmente, contas só podem ser adicionadas e removidas. Falta editar.

- Adicionar estado `editingConta` e abrir o dialog de criação no modo edição (pré-preenchido)
- Botão de lápis (Pencil) em cada linha da tabela
- Ao salvar, fazer `supabase.update()` em vez de `insert()`
- Reutilizar o mesmo dialog já existente com lógica dual-purpose (add/edit)

## 2. Conexões visuais interativas no Funil (`src/pages/Funis.tsx`)

Atualmente as conexões são feitas digitando índices num input texto (`connects_to: "1,2"`). Melhorias:

### 2a. Deletar conexões
- Tornar as linhas SVG dos conectores clicáveis (aumentar `pointer-events` na path)
- Ao clicar numa conexão, mostrar um botão de deletar (ou deletar direto com confirmação)
- Remover o índice do array `connects_to` da etapa de origem

### 2b. Criar conexões visualmente
- Adicionar um pequeno "dot" (ponto de conexão) no lado direito de cada card
- Ao clicar e arrastar desse ponto até outro card, criar a conexão (`connects_to`)
- Estado: `connectingFrom` (índice do card de origem) + detectar drop em outro card
- Manter o input de texto como fallback para edição manual

## 3. Busca de Projeto e Produtos no Funil

Na view de lista e no canvas, permitir buscar/filtrar:

- Adicionar campo `Input` de busca textual na listagem de funis (filtra por nome do funil ou nome do projeto)
- No canvas, adicionar busca/select de produtos do projeto vinculado para referência rápida (exibir produtos do briefing no header do canvas se houver `project_id`)

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/Empresa.tsx` | Dialog dual-purpose add/edit, botão editar na tabela |
| `src/pages/Funis.tsx` | Conexões clicáveis/deletáveis, drag-to-connect, busca textual, exibir produtos do projeto |

