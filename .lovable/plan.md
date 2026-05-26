# Reduzir sobrecarga cognitiva em /projetos/:id

## Diagnóstico

A página tem **19 abas** numa única tira horizontal: Comando, Identidade, Expert, Avatar, KPIs, Pesquisa, Mídia, Docs, Concorrentes, Calendário, Finanças, Emails, Conteúdo, Fluxogramas, Painel, Insights, Analytics, Instagram. Mesmo com `flex-wrap`, vira uma parede de chips dourados sem hierarquia — o usuário precisa ler cada label toda vez para achar onde algo está. É a fonte principal da sensação de "tanto dado".

## Solução (escopo: só UX da navegação do projeto, sem mexer no conteúdo das abas)

### 1. Agrupar as 19 abas em 5 pilares semânticos

Substituir a tira única por uma **navegação em 2 níveis**: pilares no topo + sub-abas só do pilar ativo.

```
[ 🎯 Comando ] [ 🧠 Inteligência ] [ 📊 Performance ] [ ✍️ Produção ] [ ⚙️ Infra ]
                       ↓ (ao clicar em Inteligência)
   Avatar · Expert · Pesquisa · Concorrentes · Insights
```

Mapeamento:
- **🎯 Comando** — Comando, Identidade, Painel
- **🧠 Inteligência** — Avatar, Expert, Pesquisa, Concorrentes, Insights
- **📊 Performance** — KPIs, Finanças, Analytics, Instagram
- **✍️ Produção** — Conteúdo, Emails, Mídia, Calendário, Fluxogramas
- **⚙️ Infra** — Docs, Analytics-Integrações (extrair futuramente)

No carregamento, abre direto no pilar Comando + sub-aba Comando (comportamento atual preservado).

### 2. Command Palette (Ctrl/Cmd+K)

Atalho global dentro do projeto que abre um input com todas as 19 seções listadas e busca fuzzy. Clicar pula direto pra aba certa. Resolve o "sei o que quero mas não acho onde clicar".

### 3. Persistência da última aba

Salvar `ultimo_pilar` + `ultima_subaba` no `localStorage` por projeto. Quando o usuário volta, cai onde estava. Acaba o "tenho que reachar tudo de novo".

### 4. Indicador visual sutil de novidade

Quando uma seção recebe dado novo desde a última visita (ex: nova venda em Finanças, novo insight Imperius), pontinho dourado no pilar. Decide o que olhar primeiro sem precisar varrer tudo.

## Arquivos afetados

- `src/pages/ProjetoDetalhe.tsx` — reestruturar `<Tabs>` em 2 níveis, adicionar state de pilar
- `src/components/ProjectCommandPalette.tsx` *(novo)* — dialog com `cmdk`, lista as 19 seções
- `src/hooks/useProjectTabState.ts` *(novo)* — persistência localStorage + indicadores de novidade

Nenhuma mudança em conteúdo das abas, queries Supabase, ou edge functions. Puro frontend de navegação.

## Resultado esperado

Tela inicial mostra 5 pilares claros em vez de 19 chips. O usuário escolhe a área mental ("quero ver performance"), e só então vê as opções daquele contexto. Ctrl+K para acesso direto quando ele sabe exatamente onde quer ir.
