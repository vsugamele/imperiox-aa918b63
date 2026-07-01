# One Click 2.0 — Produtos do Projeto + Modo Organizar

Dois ajustes no fluxo do One Click pra resolver o caso "JP Freitas — Código dos Cortes Perfeitos".

---

## 1. Nome do produto vem do projeto selecionado

Hoje o campo "Nome do produto" é texto livre. Vai virar **Select dinâmico**:

- Ao escolher um projeto existente em "Projeto destino", o modal carrega `imphq_projects.briefing.produtos[]` (mesma fonte do `ProjetoBriefing`) e popula um dropdown com os produtos já cadastrados.
- Opção fixa no topo: **"➕ Novo produto"** → libera o input de texto livre (comportamento atual).
- Se projeto destino = "Criar novo projeto" → input texto livre direto (sem dropdown).
- Ao escolher um produto existente, autofill de `ticket`, `promessa` e `nicho` se já existirem no briefing.

## 2. Novo preset "🔍 Organizar Existente" (modo auditoria + completar gaps)

Novo botão de preset ao lado de Completo / VSL Launch / X1 Express.

Quando ativado e o usuário escolhe **projeto + produto existentes**:

### Fase A — Inventário (sem gerar nada)
Edge Function nova `ecosystem-inventory` varre o que já existe pra aquele `projeto_id` + `produto`:

| Ativo | Fonte |
|---|---|
| Avatar | `imphq_projects.briefing.avatares_por_produto[produto]` |
| VSL | `imphq_swipes` filtrado por projeto+formato=vsl, ou `imphq_skill_outputs` slug=vsl-filemon-e3 |
| LP | `imphq_swipes` formato=lp ou `skill_outputs` slug=lp-persuasiva-v2 |
| Ângulos | `skill_outputs` slug=angulos-filemon |
| Reels | `skill_outputs` slug=roteiros-virais-reels |
| Imagens | `imphq_creative_assets` por projeto |
| WhatsApp X1 | `imphq_wa_campaign_templates` ou `skill_outputs` sales-closer |
| Fluxos pós-venda | `imphq_flows` filtrado por projeto |
| Hub | `imphq_funis` tipo=hub |

Retorna mapa `{ etapa: 'ok' | 'faltando' | 'fraco' }` (fraco = existe mas score < 60 na última auditoria, ou >90d sem update).

### Fase B — UI do modal mostra checklist
Lista cada etapa com ✅ (existe) / ⚠️ (fraco) / ❌ (faltando), e pré-seleciona automaticamente só as **faltando** + **fracas** pra geração. Usuário pode marcar/desmarcar.

### Fase C — Gera só o que falta
Reusa `ecosystem-from-name` passando `etapas` filtradas e flag `modo: "complementar"` (pra não recriar avatar se já existe — reaproveita o do briefing).

### Fase D — Hub + Auditor (já existe)
Monta no Hub agregando os ativos antigos + novos. Auditor Imperius roda no final mostrando score consolidado.

---

## Detalhes técnicos

**Frontend** (`OneClickModal.tsx`):
- Estado novo: `produtosDoProjeto: {nome, ticket?, promessa?, nicho?}[]`, `modo: 'criar' | 'organizar'`, `inventario: Record<Step, 'ok'|'faltando'|'fraco'>`.
- `useEffect` no `destino` busca briefing do projeto e popula dropdown de produtos.
- Quando `modo === 'organizar'`: ao confirmar projeto+produto, chama `ecosystem-inventory` ANTES de mostrar etapas; renderiza checklist com ícones de status.

**Backend**:
- Nova Edge Function `ecosystem-inventory` (read-only, retorna JSON do mapa).
- `ecosystem-from-name`: aceitar `modo: 'complementar'` → pula avatar se já existir no briefing, pula etapas com flag `skip_if_exists`.

**Sem mudança de schema** — usa tabelas existentes.

---

## Fora de escopo (pode vir depois)
- Edição inline dos ativos antigos detectados.
- Versionamento ("substituir" vs "manter as duas").
- Detecção de "fraco" via auditor real (v1 usa heurística simples: idade > 90d).
