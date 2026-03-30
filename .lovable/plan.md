

# Plano: Clarity por Produto, Clarity Autônomo, Chat WhatsApp com Paginação

## 3 melhorias

---

### 1. Clarity por produto (não só por projeto)

**Problema**: Hoje o `clarity_id` é um campo único no projeto. Se o projeto tem múltiplos produtos (ex: tripwire, core, premium), cada um com sua landing page, precisaria de um Clarity ID por produto/página.

**Solução**: No campo de produtos dentro do Briefing (`ProjetoBriefing.tsx`), adicionar um campo `clarity_id` em cada item do array de produtos. O campo no nível do projeto continua como fallback/global. Assim cada produto pode ter seu próprio heatmap.

**Arquivo**: `src/components/projeto/ProjetoBriefing.tsx` — adicionar campo Clarity ID no form de cada produto

---

### 2. Clarity com análise automática via IA

**Problema**: Hoje o Clarity é só um link externo. O usuário quer que a IA analise os dados sem precisar abrir o dashboard manualmente.

**Solução**: A API do Clarity não é pública para extração direta. Mas podemos fazer algo prático:
- Adicionar um botão **"🤖 Analisar com IA"** ao lado do link do Clarity no Briefing
- Ao clicar, abre um campo onde o usuário cola o resumo/screenshot/dados do Clarity
- A IA (via Mentes) analisa e sugere melhorias na página
- Alternativamente, se o usuário tiver o script `imptrack.js` coletando eventos em `imphq_events`, podemos analisar PageViews, scroll depth, cliques por URL — dados já disponíveis no banco

**Arquivo**: `src/components/projeto/ProjetoBriefing.tsx` — botão "Analisar Comportamento" que puxa `imphq_events` filtrados pela URL do produto e gera insights

---

### 3. Chat WhatsApp — paginação de mensagens

**Problema**: O `ChatView.tsx` carrega **todas** as mensagens da conversa sem limite (`select("*")`). Com muitas mensagens isso fica lento e pesado.

**Solução**: Implementar paginação com "carregar mais":
- Query inicial: últimas 50 mensagens (`.order("created_at", { ascending: false }).limit(50)`)
- Reverter a ordem no frontend para exibir cronologicamente
- Botão **"Carregar anteriores"** no topo do chat que busca mais 50
- Manter o polling de 8s apenas para mensagens novas (`.gt("created_at", lastTimestamp)`)

**Arquivo**: `src/components/whatsapp/ChatView.tsx` — limit 50, botão carregar mais, polling incremental

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Campo `clarity_id` por produto + botão "Analisar Comportamento" com dados de `imphq_events` |
| `src/components/whatsapp/ChatView.tsx` | Paginação (limit 50), botão "Carregar anteriores", polling incremental |

