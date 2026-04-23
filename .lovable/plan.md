

## Análise das 4 perguntas + plano de evolução

### 1. Diagnóstico Yoshitani — está funcionando?

**Funciona, mas com limitações sérias.** Olhei a lógica em `FinancasAds.tsx`:

**O que está certo:**
- Tendência 7/5/3 calculada corretamente (CPA 3d < 5d < 7d = MELHORANDO).
- Normaliza nome de campanha removendo `[DD/MM]` pra não duplicar quando renomeia.
- Detecta gargalo (Anúncio / Página / Checkout / Técnico) e sugere manobra.

**O que está quebrado (visível no seu print):**
- **Campanhas novas (3-5 dias) sempre aparecem como "INSTÁVEL"** porque exige `cpa3 && cpa5 && cpa7` simultâneos. Sua campanha "[NOVA PAGINA] 21/04" tem só 2 dias → marca instável mesmo estando OK.
- **CPA 7d = R$ 36 mas marca PAUSE IMEDIATO** — porque `metaCpa = cpa7 * 0.8` quando não há compras suficientes, criando meta artificial absurdamente baixa. Campanha com 10 compras e CPA R$ 36 não devia receber pause.
- **"$/Checkout", "LP→CKO", "CKO→Venda" mostram "—"** porque depende de `checkouts_iniciados` vir do Facebook — e geralmente não vem (só vem `compras` e `landing_page_views`). Sem isso, 3 dos 4 diagnósticos de gargalo ficam cegos.
- **Meta CPA não tem âncora real**: devia vir do **ticket médio do produto × margem alvo** (ex: ticket R$ 297, margem 60% → CPA teto R$ 178), não de "80% do CPA atual".
- **Não considera idade da campanha** — campanha com 1 dia não pode ser comparada com campanha de 14 dias.

**Correções propostas (Sprint A):**
- Adicionar campo `meta_cpa` no produto (ou calcular: `ticket_medio × 0.4`).
- Período mínimo: 7 dias e ≥3 compras pra dar veredito "PAUSE". Antes disso = "OBSERVANDO".
- Fallback quando `checkouts_iniciados` = 0: usar **CPA vs meta + frequência + CTR** como sinais, não invocar gargalo de checkout/página.
- Badge "CAMPANHA NOVA (Xd)" pra campanhas <7 dias.
- Tooltip explicando cada veredito ("Por que PAUSE?").

---

### 2. Painel Expert + IA pra Stories diários

**Hoje:** o Painel mostra o plano mensal já gerado. Stories aparecem por sequência, **mas não há gerador de ideias diárias com base em contexto fresco.**

**Plano (Sprint B):**
- **Botão "Gerar 5 ideias de Stories pra hoje"** no topo do painel.
- Edge function consulta:
  - Avatar + dores top 3 do projeto
  - Vendas das últimas 24h (pra "comemorar" ou "puxar gancho")
  - Leads quentes do dia (pra fazer story sobre objeção comum)
  - Notícia do nicho (Firecrawl em fonte definida no briefing)
  - Conteúdo já postado nos últimos 7 dias (pra não repetir)
- Retorna 5 stories formatados: **Hook (3s) → Tensão → CTA**, prontos pra teleprompter.
- Botão "Adicionar ao plano de hoje" salva direto no `expert_logs`.
- **Modo "Stories de bastidor"**: gera ideias baseadas em algo que aconteceu hoje no negócio (ex: "Acabei de fechar 3 vendas em 1h — story sobre isso").

---

### 3. Aprofundamento de conteúdos

**Hoje:** ContentGenerator gera copy isolado, sem encadeamento estratégico.

**Plano (Sprint C):**
- **Modo "Cluster de Conteúdo"**: dado 1 dor central, gera 1 mês de conteúdo encadeado:
  - 4 Reels (um por semana, ângulo diferente da mesma dor)
  - 8 Stories de apoio (sequências de 3-5 stories cada)
  - 2 Posts educacionais
  - 1 Live de fechamento
  - 1 Email/WhatsApp de conversão
- **"Aprofundar este conteúdo"** em qualquer item do plano:
  - Gera roteiro completo (300-600 palavras) com gancho, desenvolvimento, prova, CTA
  - Sugere 3 B-rolls + thumbnail + 5 hooks alternativos pra teste
  - Cita a fonte (avatar/dor/concorrente) que embasou
- **Análise de performance**: depois de postado, o usuário marca "bombou" / "morreu" → IA usa esse feedback pra próximos clusters.

---

### 4. Como a IA constrói o Avatar hoje + como melhorar

**Como funciona hoje** (`generate_avatar_perfil` em `openflow-ai/index.ts`):

1. Recebe `projectContext` (briefing + pesquisa + dores + desejos + concorrentes que já estão salvos no projeto).
2. Manda pra Gemini com prompt: *"Você é psicólogo de consumo brasileiro. Com base nas pesquisas, dores, desejos e concorrentes, preencha o perfil psicológico completo."*
3. Tool calling com schema rígido pedindo: retrato, arquétipo, ferida central, padrão, contradição, desejo externo/interno, inimigo, resultado sonhado, trigger event, fase de consciência, crença bloqueadora/necessária, epifania central, camadas C1-C4 da psique.
4. Retorna JSON estruturado e salva.

**Problemas:**
- **Garbage in, garbage out**: se o briefing tá vazio ou genérico, o avatar vira clichê ("empreendedor frustrado que quer liberdade").
- **Não usa concorrentes escalados** mesmo eles estando no projeto — perde o melhor sinal de mercado.
- **Não usa transcrições/voyerismos reais** (frases literais de cliente).
- **Sem validação cruzada**: a IA não confronta o que ela mesma escreveu.
- **Single-shot**: uma chamada só, sem refinamento.

**Plano (Sprint D) — Avatar 3.0:**

**Etapa 1 — Coleta enriquecida (pré-IA):**
- Puxar **transcrições de voyerismo** (frases literais de cliente) se existirem.
- Puxar **dossiês de concorrentes escalados** (oferta + dor que atacam + arquétipo).
- Puxar **comentários reais** dos top 3 concorrentes via Firecrawl.
- Puxar **histórico de vendas** (quem comprou — perfil demográfico se houver).

**Etapa 2 — Pipeline em 3 passos (chain of thought):**
- **Passo 1 — Pesquisador**: extrai 20 frases literais que o avatar diria (com fonte: comentário X, transcrição Y).
- **Passo 2 — Psicólogo**: dado essas 20 frases, mapeia camadas C1-C4 e ferida central. **Cita evidência** pra cada conclusão.
- **Passo 3 — Crítico**: revisa o avatar gerado. Marca campos clichê/genéricos e regenera só esses.

**Etapa 3 — Score de confiança:**
- Cada campo do avatar ganha badge: 🟢 Validado por evidência | 🟡 Inferido | 🔴 Especulativo.
- Usuário vê onde IA chutou vs. onde tem base real.

**Etapa 4 — Avatar vivo:**
- Reprocessa quando: novo voyerismo importado, novo concorrente escalado, ou vendas cruzam X marcos.
- Mantém histórico de versões pra comparar evolução.

---

### Ordem sugerida de execução

| Sprint | Foco | Tamanho |
|---|---|---|
| **A** | Corrigir Yoshitani (meta CPA real, gate de período, fallback de gargalo) | Pequeno (1 arquivo) |
| **B** | Stories diários por IA no Painel Expert | Médio (1 edge function nova + UI) |
| **C** | Cluster de conteúdo + aprofundamento | Grande (refator do ContentGenerator) |
| **D** | Avatar 3.0 com pipeline em 3 passos + score de confiança | Grande (refator do `handleAvatarPerfil` + UI de evidências) |

**Pergunta:** começo por **A** (correção rápida do diagnóstico) e **B** (stories diários, alto valor)? Ou prefere atacar direto o Avatar 3.0 (D) que é mais estratégico mas demora mais?

