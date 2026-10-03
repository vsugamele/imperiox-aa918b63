# Épico LAUNCH1 — Lançador de projetos

**Pedido do Vinicius (03/10/2026):** "vamos fazer um canal de YouTube de cripto pegando isso e isso e colocamos pra rodar; hoje é um projeto de lei da atração que vai ter YouTube, SEO, tráfego direto e X1, e você vai ter todas as estratégias, técnicas, acessos, ferramentas e sites pra rodar". Precisa ser robusto.

## O que já existe (base)
| Peça | Onde | Estado |
|---|---|---|
| Projetos e mapa de operação | `imphq_projects`, `imphq_company_maps/nodes` | ok |
| Biblioteca de estratégias | `_shared/playbook-library.ts` (8 playbooks), `/estrategias`, MCP `apply_playbook`, CLI `scripts/playbook.mjs` | X1, anúncio direto, esteira de escala, webinar, lançamentos, orgânico genérico, SEO |
| Regras de decisão | `_shared/scale-ladder.ts`, `today-board.ts`, `approval-queue.ts` | ok |
| Operação diária | Hoje, Aprovar, resumo no WhatsApp, MCP `get_briefing` | ok |
| Esteira de conteúdo | GeeLark (`content.mjs`, `geelark-publisher`) | sem deploy/token |
| Conhecimento da IA | `claude-skills/` + skills locais | copy, avatar, VSL, esteira |

## O que falta (lacunas)
1. **Ferramentas de operação no catálogo**: `imphq_capabilities` tem 73 itens, todos bibliotecas de design/código. Nenhuma ferramenta de operação (YouTube Studio, vidIQ, ElevenLabs, GeeLark, Meta Ads, Search Console, Evolution, Ticto…), nem quais acessos cada canal exige.
2. **Acessos por projeto**: não há registro do que está conectado ou falta em cada projeto (conta do YouTube, pixel, número de WhatsApp, domínio). Só o status; senha nunca entra no Império.
3. **Playbook de YouTube**: só o "Canal orgânico ({plataforma})" genérico; falta YouTube long-form + Shorts (nicho, palavras-chave, roteiro, thumbnail, produção com IA, SEO do vídeo, retenção/CTR, monetização).
4. **Lançador**: não existe o caminho "ideia → projeto + mapa + estratégias aplicadas + checklist de acessos + donos e prazos" numa chamada só (CLI e MCP), com plano antes de gravar.
5. **Métricas de YouTube** no catálogo (views, CTR da thumbnail, retenção, inscritos) — sem fonte ainda.

## Stories
- [x] **LAUNCH1.1 — Kit de operação**: ferramentas de operação no catálogo (`imphq_capabilities`, categoria por canal) + requisitos de acesso por canal + `imphq_project_access` (projeto × acesso: falta / em andamento / conectado / não se aplica; sem segredo) + CLI/MCP para ler e marcar.
- [ ] **LAUNCH1.2 — Playbook YouTube** (long-form + Shorts) com contrato, métricas e ferramentas de cada etapa; métricas de YouTube no catálogo.
- [ ] **LAUNCH1.3 — Lançador**: `scripts/launch.mjs` + MCP `launch_project`: cria projeto e mapa, aplica os playbooks dos canais escolhidos, gera o checklist de acessos e as tarefas humanas (com dono e prazo), tudo com plano antes (`--confirmar` para gravar) e snapshot.
- [ ] **LAUNCH1.4 — Ensaio**: rodar o lançador em modo plano com os exemplos do Vinicius (canal de YouTube de cripto; lei da atração com YouTube + SEO + anúncio direto + X1) para validar o esqueleto. Nada é criado sem pedido.

**Esclarecimento (03/10):** lei da atração e cripto são exemplos da intenção, não projetos a criar agora. O esqueleto é genérico: todo projeto novo começa pelo mesmo processo. Mercado padrão: EUA (EN). Nenhum acesso existe ainda nos exemplos; o lançador parte do zero.

## Fronteira (o que só humano faz)
Criar contas (YouTube, Google, Meta, domínio), aceitar termos, digitar senhas, conectar OAuth e pagar ferramentas. O Império registra e cobra o acesso como tarefa com dono; quando conectado, as rotinas usam.
