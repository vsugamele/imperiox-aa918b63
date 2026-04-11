

# Plano: Corrigir Dados no Comando + Garantir Jornada nos Leads

## Problemas encontrados

### 1. Aba Comando — KPI "Pix Gerados" sem detalhes
A query de vendas do dia (linha 39 de `ProjetoComando.tsx`) só seleciona `id, status, created_at`. Faltam `produto_nome`, `valor`, `plataforma`, `lead_id`. Por isso o KPI mostra "1" mas não diz de qual produto, valor ou data.

### 2. Aba Comando — Nome do lead não aparece
Linha 209 usa `l.name` mas a coluna no banco é `nome`. Resultado: nome sempre vazio, mostra só "—".

### 3. Aba Comando — Ordenação errada dos leads
Linha 37 ordena por `created_at` mas a coluna real é `criado_em`. Pode causar erro silencioso ou ordem incorreta.

### 4. Leads — Jornada e vendas ESTÃO sendo salvos
Confirmei nos dados: as vendas têm `produto_nome`, `valor`, `plataforma` corretos. O campo `data.interacoes` nos leads acumula os eventos com produto e valor. A timeline da Jornada carrega de `imphq_events`, `imphq_clicks` e `imphq_vendas`. **Os dados estão sendo persistidos corretamente.** O problema visível é mais no Comando que não mostra os detalhes.

## Solução

### ProjetoComando.tsx — 4 correções

| Problema | Fix |
|---|---|
| Query vendas do dia sem dados | Adicionar `produto_nome, valor, plataforma, lead_id` no select da linha 39 |
| `l.name` → `l.nome` | Corrigir referência na linha 209 |
| Ordenação `created_at` → `criado_em` | Corrigir na linha 37 |
| KPI sem detalhe | Adicionar seção expansível abaixo dos KPIs mostrando lista dos Pix/Vendas do dia com produto, valor, horário e plataforma |

### Seção "Detalhes do Dia" (nova)
Abaixo dos KPIs, adicionar um card com a lista das vendas de hoje mostrando:
- Nome do produto
- Valor (R$)
- Status (aprovado/pix/pendente)
- Plataforma
- Horário

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/projeto/ProjetoComando.tsx` | Corrigir query, campo nome, ordenação + adicionar detalhes das vendas do dia |

