# 02/10/2026 — Catálogo, mapa, limpeza, base operacional e esteira GeeLark

## Feito e no main (último: `de8bbbeb`)
- JP1.3/JP1.4 publicados no Git (as functions já estavam no ar).
- W3.1: aba Ferramentas em /skills, skills ligadas às ferramentas (26 ligações), project-mcp v30 publicado e conferido.
- W2.1: Fluxo Master com checkout Ticto + Finalização Express R$ 37; 30 etapas reclassificadas (cópia `448660c9-…`).
- MAP1.3: funil "rodando" a partir de 10 sessões reais em 7 dias (`imphq_funnel_sessions`).
- QL1.1: rotas públicas /cockpit e /redesign removidas, redirect morto do kanban removido, abas do projeto sob demanda (764 kB → 83 kB).
- OP1.1: 7 rotinas duplicadas desativadas (briefing das 9h chegava em dobro).
- OP1.2: esteira GeeLark — tabelas, regras, cliente, worker `geelark-publisher`, CLI `scripts/content.mjs`.

## Depende do Vinicius
1. Publicar `project-mcp` (regra de sessões) e `geelark-publisher`.
2. Gravar `GEELARK_API_TOKEN` como secret no Supabase.
3. Lista de aparelhos/contas do GeeLark (ID do aparelho, plataforma, @, projeto, link da bio) e se o plano é Pro (métricas de conta).
4. Chave do MCP para conectar o project-mcp a esta máquina.
5. Decidir sobre /dashboard-classic (é a única tela que usa 18 componentes; tem link no rodapé do Dashboard).

## Próximos passos
- Primeiro teste real da esteira: 1 conta, 1 vídeo (`run --dry-run`, depois `run`), conferir tarefa e link; só então agendar o worker a cada 5 min.
- Métricas (analytics do GeeLark + coleta pública por URL + UTM → vendas), geração de vídeo em série, Drive.
- Achados sem correção: `useProjectPulse.ts` consulta coluna inexistente `last_intent_at` (400 em todo projeto); subtítulo do JP ainda diz "Curso fitness"; trava de saldo ElevenLabs na `wa-audio-transcribe`; quiz 404 da SlimSoda.

## Bloqueios
- Deploy de edge function pelo Claude é barrado pela permissão automática; o Vinicius roda no terminal.
