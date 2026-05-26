## Problema

No modal de Estatísticas do distribuidor, hoje você precisa **colar o JID na mão** (`12036...@g.us`). Mas a edge function `whatsapp-api` já tem a action `fetch_groups` que lista todos os grupos de uma instância Evolution — é o que o `CampaignManager` já usa pra selecionar grupos. Basta plugar isso aqui.

## O que vai mudar

**`src/components/whatsapp/GroupDistributor.tsx`** — no modal `showStats`:

1. **Seletor de chip (provider)**: dropdown carregado de `imphq_wa_providers` (Evolution, ativos). Persiste a última escolha em `localStorage` (`wa.distributor.lastProviderId`).

2. **Combobox de grupos**: ao escolher o provider, invoca `whatsapp-api` com `{ action: "fetch_groups", provider_id }` e popula uma lista pesquisável (Command + Popover) com `subject` + JID em mono pequeno. Selecionar = preenche `newGroupJid` e abre direto o botão "+ Grupo" (ou adiciona na hora).

3. **Botão "↻"** ao lado pra refazer o fetch sem trocar de provider.

4. **Fallback**: o input de JID continua existindo, escondido atrás de um link "colar JID manualmente" — pra casos em que o grupo não aparece (ex.: a sessão ainda não sincronizou).

5. **Reuso na seção de Rotação semanal**: o mesmo seletor pode preencher `newWeek.group_jid` quando o usuário vai adicionar a próxima semana. Mesmo provider, mesma lista cacheada em estado local.

## Arquivos tocados

- `src/components/whatsapp/GroupDistributor.tsx` (UI + fetch)

Sem mudanças de backend nem de banco — a action `fetch_groups` e a tabela `imphq_wa_providers` já existem.

## Resultado esperado

Abrir o modal, escolher o chip uma vez, e adicionar grupos clicando neles em vez de colar JID. Funciona tanto pra "Adicionar grupo" quanto pra "Nova semana" da rotação.
