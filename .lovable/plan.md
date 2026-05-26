# Header com KPIs ao vivo + atalho rápido para Comando

## Diagnóstico

A página de projeto tem hoje:
- Header bonito (ícone, nome, categoria, pipeline) mas **sem dado de negócio** — você sabe qual projeto está vendo, não sabe se ele está vendendo.
- Aba "Comando" (`ProjetoComando.tsx`) já tem todas as queries certas: receita do dia/mês, leads hoje, vendas aprovadas, hot leads. **Mas só aparece quando você clica na aba**, então em qualquer outra seção (Finanças, Avatar, etc.) você fica cego pro pulso do projeto.

## Solução

### 1. KPI Strip no header (sempre visível)

Faixa fina logo abaixo do nome do projeto, presente em **todas as abas**. 5 métricas ao vivo:

```
💰 R$ 12.4k hoje  ·  📈 R$ 87.5k mês  ·  🎯 ROAS 3.2x  ·  🔥 4 hot leads  ·  📥 23 leads hoje
```

- Tipografia DM Sans pequena, valores em gold, labels em muted.
- Indicador de delta vs ontem (▲ +18% em verde, ▼ -12% em vermelho).
- Cada item é clicável e pula direto pra aba correspondente (Finanças, CRM/leads, etc.) via `goToTab()` que já existe.
- Atualiza a cada 60s (1 query agregada por projeto, escopo igual ao que ProjetoComando já faz).

### 2. Novo hook `useProjectPulse(projectId)`

Encapsula as queries em uma única função, retorna `{ revenueToday, revenueMonth, roas, hotLeads, leadsToday, deltaRevenue, loading }`. Reutilizado pelo Strip e pela aba Comando (evita duplicar query).

### 3. Skeleton sutil enquanto carrega

Strip mostra dashes `—` em vez de saltar de 0 pro valor real.

## Arquivos afetados

- `src/components/projeto/ProjectKPIStrip.tsx` *(novo)* — componente visual da faixa.
- `src/hooks/useProjectPulse.ts` *(novo)* — query agregada + refetch 60s.
- `src/pages/ProjetoDetalhe.tsx` — inserir `<ProjectKPIStrip>` logo após o divisor do header e antes dos pilares; passar `onNavigate={goToTab}`.

Nada de migração, nada de edge function. Reaproveita 100% das tabelas que `ProjetoComando` já lê.

## Resultado esperado

Em qualquer aba do projeto você vê na hora: quanto vendeu hoje, quanto vendeu no mês, se tem lead quente esperando resposta, e se o tráfego está convertendo. O "tanto dado" vira "o pulso está aqui, sempre, em uma linha".

## Próximos passos (não entram agora)

A opção "Dashboard de projeto resumido" que você marcou na verdade é justamente o que a aba **Comando** já faz. Sugestão: depois deste KPI Strip rodando, fazer uma passada na aba Comando para enxugar (remover cards redundantes, destacar os 3 mais críticos no topo). Faço como segundo turno.
