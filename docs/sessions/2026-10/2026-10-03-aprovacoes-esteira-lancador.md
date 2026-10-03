# Handoff — 02 e 03/10/2026: MCP de aprovações, Esteira de Escala e Lançador de projetos

## O que foi feito (tudo no main, gates verdes)
| Story | Resumo |
|---|---|
| QL1.2 | KPI "leads quentes" lia coluna inexistente; agora `data->>last_intent_at` |
| MCP2.1 | MCP `get_approvals`, `decide_approval` (nunca aprova ação da IA nem responde cliente), `get_briefing` |
| STR1.8 | Esteira de Escala DTC (do AffHub) como conhecimento: playbook `esteira-escala-dtc`, motor `_shared/scale-ladder.ts`, MCP `evaluate_scale`, `claude-skills/07-esteira-escala.md`, métrica `custo_por_ic` |
| STR1.9 | Números da esteira na etapa do mapa (`StepScaleLadder`), `imphq_scale_rounds`, puxar do sync de anúncios, histórico, MCP `get_scale_rounds`; CLI `scripts/playbook.mjs`; **esteira aplicada na SlimSoda** |
| LAUNCH1.1 | Kit de operação: 6 canais, 17 acessos (evidência + inferência), 13 ferramentas de operação no catálogo, `imphq_project_access`, CLI `scripts/launch.mjs` (canais, seed-tools, kit, acesso), MCP `get_project_kit`/`set_project_access` |
| LAUNCH1.2 | Playbook `youtube-canal` (longos + Shorts, 12 etapas) e métricas de YouTube |
| LAUNCH1.3 | Lançador: `scripts/launch.mjs novo` (plano / `--ensaio` / `--confirmar`) e MCP `launch_project` |

## Como usar o lançador
```bash
node scripts/launch.mjs novo --nome "Crypto Signals" --canais "youtube"
node scripts/launch.mjs novo --nome "Crypto Signals" --canais "youtube" --ensaio
node scripts/launch.mjs novo --nome "Crypto Signals" --canais "youtube" --confirmar
node scripts/launch.mjs kit --project crypto_signals
node scripts/launch.mjs acesso --project crypto_signals --acesso google_conta --status conectado --dono Vinicius
```

## Estado atual
- Branch `feat/operacao-diaria`; push direto no main liberado pelo Vinicius nesta sessão; deploy de function funcionou daqui.
- Migrações aplicadas: `20261002_imphq_scale_rounds.sql`, `20261003_imphq_project_access.sql`. Biblioteca de playbooks regravada (9 playbooks).
- AffHub = repo `vsugamele/imphafilliate`, Supabase `sxiqbhcnkzrrenzgncss` (na conta do Vinicius). Ainda não trazidos: 61 criativos, 53 dissecações, 28 anúncios de concorrentes.
- Lei da atração e cripto foram **exemplos** do Vinicius para o esqueleto: nenhum projeto foi criado (só plano e ensaio).

## Próximos passos sugeridos
1. LAUNCH1.4: usar o lançador de verdade quando o Vinicius pedir um projeto; criar os acessos humanos (conta Google, domínio, BM) e ir marcando no kit.
2. Fontes de métrica de YouTube (YouTube Analytics API) e Search Console: hoje as métricas existem no catálogo, sem dado.
3. Trazer criativos, dissecações e concorrentes do AffHub para a tela de Criativos.
4. Conferência visual logado: painel da esteira na etapa (SlimSoda), `/estrategias`, `/aprovar`.

## Pendências conhecidas
- Sync de anúncios do JP sem dado desde 19/08; SlimSoda sem conta de anúncio, domínio próprio e pixel (o kit mostra 2/6).
- `geelark-publisher` sem deploy/token; ElevenLabs sem crédito.
- Segurança fica para o fim (repo público com `.env` versionado e chave da Evolution no `OPERACAO.md`).

## Armadilhas
- Heredoc com `\n` dentro de Python no Bash tool vira quebra de linha real: para código com `\n`, usar Edit/Write.
- `supabase db query` com várias instruções devolve só o resultado da última.
- `deno check` do `project-mcp`: linha de base 9 erros antigos. Módulo novo de `_shared` no `project-mcp` precisa entrar nos dois harnesses (`map-agent-status-mcp.test.ts`, `mcp-approvals-briefing.test.ts`).
