

# Plano: Corrigir Tarefas + Proteger API Keys com Senha

## Problemas Identificados no Tarefas

Analisando os dados reais do banco, encontrei 3 bugs críticos:

1. **Detecção de "Concluído" quebrada**: O código procura colunas com título `"feito"`, mas as colunas reais são `"Concluído"` (board agentes) e `"done"` (boards humanas/criativos/campanhas). Resultado: nenhuma tarefa é marcada como concluída.

2. **Adicionar tarefa rápida falha**: Procura coluna `"backlog"` no board `"geral"`, mas esse board não existe. Os boards reais são: agentes, humanas, criativos, campanhas. Resultado: erro "Coluna 'backlog' não encontrada".

3. **Desmarcar tarefa falha**: Procura coluna `"backlog"` no board da tarefa, mas no board "agentes" a primeira coluna é `"A Fazer"`. Resultado: não consegue desmarcar.

## Correções Planejadas

### `src/pages/Tarefas.tsx`

- **isDone**: Aceitar `"feito"`, `"done"` e `"concluído"` (case-insensitive)
- **addQuickTask**: Procurar primeira coluna de qualquer board disponível (backlog ou "A Fazer"), permitir escolher board/projeto
- **toggleDone (un-done)**: Procurar primeira coluna do board (`"backlog"` ou `"A Fazer"`)
- Adicionar seletor de prioridade e data no quick-add
- Adicionar botão de editar/excluir tarefa

### `src/pages/Configuracoes.tsx` — Senha nas API Keys

- Adicionar PIN/senha `464321` para acessar a aba "APIs & Keys"
- Ao entrar na aba, exibir campo de senha antes de mostrar as chaves
- Após digitar corretamente, libera visualização (sessão atual)
- Senha armazenada como constante no código (conforme solicitado)

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/pages/Tarefas.tsx` | Corrigir detecção de done, quick-add e toggle |
| `src/pages/Configuracoes.tsx` | Adicionar proteção por senha na aba API Keys |

