

## Problemas Identificados

### 1. Pix gerado não salva produto no lead
Ao receber um webhook com evento `pix_gerado`, o sistema cria/atualiza o lead mas **nunca salva o nome do produto** no registro do lead. O produto só aparece dentro de `data.interacoes` (JSONB aninhado), mas não há campo dedicado visível. O lead fica com `produto_data: null`.

**Causa raiz**: Na criação do lead (linha ~323) e na atualização (linha ~551), o campo `produto` não é persistido. Apenas `compra_aprovada` salva em `imphq_vendas`, mas `pix_gerado` não cria venda — e o produto se perde.

**Solução**: No bloco de atualização do lead (linha 551-553 do webhook-pagamento), além de salvar `ultimo_evento`, salvar também `produto` e `valor` no campo `data` do lead para TODOS os eventos (não só compra). Isso garante que ao abrir o lead, o produto do Pix gerado aparece.

### 2. Usuários não aparecem em Configurações
O `admin-users` edge function filtra usuários que têm role em `imphq_user_roles`. Atualmente só existem 3 registros (todos admin). Os membros da equipe (`imphq_team_members`) como Viniicus e Bruno **não possuem registro em `imphq_user_roles`**, por isso não aparecem na lista.

**Causa raiz**: Os membros da equipe foram cadastrados em `imphq_team_members` mas nunca tiveram uma role atribuída em `imphq_user_roles`. O filtro do edge function exclui quem não tem role.

**Solução**: Modificar o `admin-users` edge function para também incluir usuários que existem em `imphq_team_members`, fazendo um JOIN/merge entre as duas fontes. Assim, membros da equipe aparecem mesmo sem role explícita (exibindo "user" como padrão).

---

## Plano de Implementação

### Passo 1 — Atualizar `webhook-pagamento` para salvar produto no lead
No bloco de atualização do lead (`data.interacoes`), adicionar `produto` e `valor` como campos de topo no JSONB `data`:
```
data: { ...currentData, interacoes, ultimo_evento: evento, ultimo_produto: produto, ultimo_valor: valor }
```
Também no bloco de criação de lead novo (linha ~323), incluir `produto` no campo `data`:
```
data: { produto, valor, ultimo_evento: evento, ... }
```

### Passo 2 — Atualizar `admin-users` para incluir membros da equipe
Modificar a ação `list` do edge function para:
1. Buscar `imphq_team_members` (email dos membros)
2. Incluir na lista final os auth.users que estão em `imphq_team_members` OU em `imphq_user_roles`
3. Exibir role padrão "user" para quem está em team_members mas não tem role explícita

### Passo 3 — Atualizar frontend do lead para exibir produto
Na tabela/detalhe de leads, exibir `data.ultimo_produto` quando disponível, para que o produto do Pix gerado seja visível.

