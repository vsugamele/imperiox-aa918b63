# Handoff — 02/10/2026: estratégias, dono/prazo, resumo diário e fila Aprovar

## O que foi feito nesta sessão (tudo no main, gates verdes)

| Story | Commit | Resumo |
|---|---|---|
| STR1.1 | `29147b31` | Biblioteca de 7 estratégias (playbooks) com 55 etapas, catálogo de 25 métricas, planejador/gravador que desenha a estratégia no mapa sem duplicar etapas, MCP `list_playbooks`/`apply_playbook`, tela `/estrategias` |
| UX1.1 | `064e6938` | Etapa com `step_status`, `owner_member_id`, `due_date` em colunas; Hoje com filtro por pessoa, chips de dono/prazo; card e painel do mapa; MCP `assign_step` + filtro `responsavel` |
| UX1.2 | `39b1b0e8`, `7e025160` | Seção "Dia de cada um" no `daily-briefing-wa` (grupo Imperio X, 9h e 21h BRT), `dry_run`; donos gravados (Vinicius 6, Bruno 18); nome "Viniicus" corrigido; envio de teste feito |
| UX1.3 | `9c908924` | Fila única `/aprovar` (etapas para revisar, ações da IA, conteúdo pronto, respostas da IA); expiração de propostas da IA após 7 dias (1.320 expiradas); scout não repropõe expiradas por 30 dias; contador do Imperius corrigido |

Stories com detalhes: `docs/stories/STR1.1-…`, `UX1.1-…`, `UX1.2-…`, `UX1.3-…`.

## Estado atual
- Branch local `feat/operacao-diaria`; push direto no main com `git push origin HEAD:refs/heads/main` (autorizado pelo Vinicius). Vercel publica o main em https://imperiox.vercel.app.
- Edge functions publicadas nesta sessão: `project-mcp`, `daily-briefing-wa`, `imperius-scout`.
- Migrações aplicadas: `20261002_imphq_playbooks.sql`, `20261002_imphq_map_nodes_owner_status.sql`, `20261002_imphq_ai_actions_expire.sql`.
- Cron novo: `imphq-expire-ai-actions` (06:15 UTC).
- Status da etapa: coluna `step_status` é a fonte; as escritas também gravam a marcação `[agent_status:…]` nas notas por compatibilidade. Leitor único: `readStepStatus` em `_shared/map-contract.ts`.
- Regra do quadro diário em `_shared/today-board.ts` (tela Hoje e resumo do WhatsApp usam a mesma).

## Próximos passos (ordem combinada com o Vinicius)
1. **Animações com significado** (itens 7 e 8 da lista de UX): partículas nas setas do mapa proporcionais ao volume real (sessões/conversas/vendas — ver `useCompanyMapLiveStats`, `FlowLiveOverlay`), etapa travada pulsando, toast + contador animado em venda nova (realtime `imphq_vendas`), skeletons no lugar de spinners.
2. MCP `get_approvals`/`decide_approval` e `get_briefing` (resumo do projeto em uma chamada).
3. Menu enxuto (Hoje, Mapa, Estratégias, Projetos, Inbox, Aprovar, Números; resto em "Mais"/Ctrl+K), Ctrl+K com ações, Hoje/Aprovar bons no celular, "Diário do projeto".
4. Épica STR1: aplicar estratégias no piloto SlimSoda (sugestão: Anúncio direto + Canal orgânico Instagram; **decisão do Vinicius**), STR1.2 valor real × meta por etapa e alertas em Hoje, STR1.3 experimentos, STR1.4 canal ponta a ponta com GeeLark, STR1.6 auditoria SEO, STR1.7 diagnóstico semanal.

## Pendências e bloqueios conhecidos
- Conferência visual logado de `/estrategias`, `/aprovar` e Hoje (a prévia local exige login; validado por testes de renderização).
- JP: sync do Facebook com erro desde junho; UTM só em 34/71 vendas; 5 checkouts faltando; Ticto `abandoned_cart` classificado como "Outro".
- SlimSoda: conta de anúncio não conectada; quiz 404; advertoriais (`slimsoda-two`) sem tracker; peças com marca de terceiros (Oprah, TODAY/NBC).
- `geelark-publisher` precisa de deploy + `GEELARK_API_TOKEN` + listar aparelhos (Vinicius).
- `useProjectPulse.ts` consulta `last_intent_at`, que não existe.
- ElevenLabs precisa de recarga; `wa-audio-transcribe` sem pausa por cota.
- Segurança fica para o fim, quando o app estiver pronto (decisão do Vinicius).

## Armadilhas do ambiente (Windows + Git Bash)
- `npx supabase db query --linked -f <caminho relativo>`; a saída começa com "Initialising login role..." (cortar antes do `{` ao ler JSON com `--output-format json`). SQL de várias linhas sempre por arquivo.
- Deploy: `npx supabase functions deploy <nome> --project-ref tkbivipqiewkfnhktmqq`.
- Patch com python em heredoc às vezes quebra no Bash tool: escrever o script num arquivo e rodar.
- `npx -y deno@2 check <arquivo>`: linha de base de erros antigos — `project-mcp` 9, `daily-briefing-wa` 13. Não aumentar.
- Ao importar módulo novo de `_shared` no `project-mcp`, injetá-lo no harness `src/test/map-agent-status-mcp.test.ts`.
- Em testes, linhas com animação de saída (AnimatePresence) precisam de `waitFor` para sumir.
- Sem chave do MCP nesta máquina: validar a lógica do MCP rodando o código de `_shared` com Deno sobre dados reais.
- Outra sessão/ferramenta está alterando arquivos do JP nesta pasta (`wa-ai-reply`, `crmBridgeJP`, `conversation-policy`, `instagram-*`, `wa-*`, story JP1.5, `jp-service-*`). Não incluir esses arquivos em commits alheios a eles.
- Nunca imprimir chaves do `.env` nem digitar senhas.
