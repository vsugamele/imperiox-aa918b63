---
name: market-intel
description: >
  Sistema completo de inteligência de mercado para infoprodutos brasileiros.
  Use esta skill SEMPRE que o usuário quiser qualquer uma destas coisas:
  pesquisar nichos ou sub-nichos, encontrar micro-nichos escondidos, mapear produtos
  para criar, espionar concorrentes e anúncios, descobrir ângulos de copy,
  estruturar um funil com bump e upsell, definir mecanismo único de posicionamento,
  criar mapa profundo de produtos a partir de temas do usuário, montar sequência
  de lançamento, pesquisar via Google Dorks, buscar na Meta Ads Library,
  fazer web fetch de páginas de venda, gerar relatório de mercado em Excel,
  ou quando o usuário pedir: "pesquisa de mercado", "minerar ofertas",
  "encontrar nichos", "ver o que está vendendo", "espionar concorrência",
  "analisar nicho", "montar mapa de produtos", "criar oferta", "definir copy",
  "funil completo", "mecanismo único", "sem efeito rebote", "ângulo de copy",
  ou qualquer variação dessas intenções. Nunca ignore esta skill nestes casos.
---

# Market Intel v2 — Inteligência de Mercado para Infoprodutos

Esta skill executa pesquisa real (web_search + web_fetch), processa os dados
e entrega análise estruturada. Claude não inventa dados — pesquisa, cruza fontes
e entrega o que encontrou com score baseado em critérios objetivos.

---

## Modos de Operação

Identifique o modo antes de executar. Leia `references/intake.md` para detalhes.

| Modo | Quando usar | O que fazer |
|------|------------|-------------|
| **DISCOVERY** | "o que está vendendo", "qual nicho entrar" | Camadas 1 + 4 → Excel visão geral |
| **DEEP DIVE** | "aprofunde neste nicho", "sub-nichos" | Todas as 4 camadas → Excel mapa 4 níveis |
| **SPY** | "espione a concorrência", "analise esse produto" | Camadas 2 + 3 → Relatório de funil |
| **MAPA** | "monte um mapa de produtos", temas específicos do usuário | Protocolo Mapa → Excel completo 4 abas |
| **COPY** | "ângulos de copy", "como vender isso", "hook" | Protocolo Copy → Biblioteca de ângulos |
| **VALIDAÇÃO** | "valide essa ideia", "tem mercado pra isso?" | Camadas 1 + 2 → Score + decisão |

---

## Protocolo de Pesquisa — 4 Camadas

### CAMADA 1 — Google Dorks (Varredura de Mercado)

```
# Ofertas existentes
site:hotmart.com "{nicho}"
site:kiwify.app "{nicho}"
site:monetizze.com.br "{nicho}"
site:braip.com "{nicho}"
site:ticto.app "{nicho}"

# Validar demanda real
"{nicho}" "comprei" OR "recomendo" OR "funcionou" site:reddit.com
"{nicho}" "curso" OR "ebook" OR "método" avaliação 2025

# Espionar funis
"{nicho}" "order bump" OR "oferta especial" site:pay.hotmart.com
inurl:checkout "{nicho}" site:kiwify.app

# Encontrar sub-nichos
"{nicho}" "para quem tem" OR "especialmente para" OR "indicado para"
"{nicho}" "não funciona para" OR "quem não deve" (revela gaps)
```

### CAMADA 2 — Meta Ads Library

Fetch direto é bloqueado. Usar uma destas alternativas:

**Opção A — Dork de anúncios:**
```
"{nicho}" anúncio facebook instagram "saiba mais" OR "acesse agora" 2025
"{nicho}" "sponsored" site:facebook.com
```

**Opção B — Usuário cola o conteúdo:**
Pedir ao usuário para abrir e colar:
`facebook.com/ads/library/?country=BR&q={NICHO}&active_status=active`

**O que analisar:**
- Anunciante com 5+ anúncios ativos = produto convertendo
- Anúncio com 30+ dias rodando = validado
- Múltiplos anunciantes no mesmo ângulo = nicho quente

### CAMADA 3 — Web Fetch de Páginas de Venda

Para cada oferta encontrada, fazer `web_fetch` (limit 3000 tokens) e extrair:

```
HEADLINE       → ângulo (dor / resultado / curiosidade / mecanismo)?
PROMESSA       → específica? tem prazo?
PROVA SOCIAL   → números, depoimentos, antes/depois?
BUMP           → existe? preço? copy?
UPSELL         → existe? como é ativado?
TICKET         → quanto custa o principal?
GARANTIA       → quantos dias?
URGÊNCIA       → timer, vagas, bônus?
```

### CAMADA 4 — Descida de Níveis (Micro/Nano-Nichos)

```
NÍVEL 1 → nicho: "emagrecimento"
  ↓
NÍVEL 2 → sub-nicho: "emagrecimento feminino 40+"
  ↓
NÍVEL 3 → micro-nicho: "emagrecimento feminino menopausa sem academia"
  ↓
NÍVEL 4 → nano-público: "Mulher 45-55 com hipotireoidismo tratado que emagrece devagar"
  ↓
PRODUTO → "Tireoide em Equilíbrio: protocolo para quem faz tudo certo e não emagrece"
```

Dorks para descer:
```
"{sub-nicho}" "minha situação" OR "eu tenho" OR "sofro de"
"{sub-nicho}" fórum problema específico
"{sub-nicho}" "para mim não funciona porque"
```

---

## Protocolo MAPA (modo especial)

Quando o usuário traz **temas ou ideias de produtos**, ativar este protocolo.

### O que fazer:

**1. Identificar o Mecanismo Único**
Antes de mapear produtos, definir o ângulo estratégico central:
- Qual é a causa raiz que explica todos os temas?
- Como conectar os temas numa narrativa sequencial?
- Qual é a promessa diferenciada vs. concorrência?

Exemplo real desta sessão:
> Temas: emagrecimento sem rebote, lipedema, jejum, desparasitação, suplementação
> Mecanismo Único: "O metabolismo bloqueado é a causa de tudo. Desparasitação limpa o caminho. Suplementação ativa o motor. Jejum potencializa. Lipedema é o caso especial."

**2. Construir a Narrativa de Conexão**
Cada tema vira uma etapa da jornada, não um produto solto:
```
Problema raiz → Desbloqueio → Amplificador → Resultado permanente
(desparasitação) → (suplementação) → (jejum) → (sem rebote)
```

**3. Mapear em 4 Níveis por Tema**
Para cada tema do usuário, criar:
- Sub-tema (segmentação)
- Micro (problema específico)
- Nano-público (quem exatamente, com situação de vida)
- Dor central que sente
- Nome da oferta + formato
- Ticket + Bump + Upsell
- Ângulo de copy baseado no mecanismo único

**4. Definir Sequência de Lançamento**
Ordenar os produtos por:
1. Menor risco / menor criação → valida o ângulo
2. Constrói autoridade e lista
3. Produto âncora (maior ticket)
4. Expansão para tendências
5. Bundle / ascensão

Leia `references/mapa-protocol.md` para o template completo.

---

## Protocolo COPY (modo especial)

Quando o usuário quer ângulos, hooks ou headlines. Leia `references/copy-library.md`.

Os 12 ângulos disponíveis e quando usar cada um:

| Ângulo | Melhor para | CTR esperado |
|--------|------------|-------------|
| Dor Aguda Específica | Saúde, Relacionamento | 2.5–4% |
| Resultado + Prazo + Prova | Emagrecimento, Renda | 3–5% |
| Segredo / Info Proibida | Espiritualidade, IA | 4–7% |
| Anti-Esforço | Emagrecimento, Renda | 3–5% |
| Identidade / Transformação | Dev. Pessoal, Espirit. | 1.5–2.5% |
| Curiosidade Interrompida | Relacionamento, Orgânico | 5–9% |
| Prova Social Hiper-Específica | Todos, Retargeting | 2–3% |
| Inimigo Externo | Saúde Alternativa | 2–4% |
| Pergunta que Dói | Todos, Tráfego Frio | 3–5% |
| Mecanismo Único | Saúde Premium, Ticket Alto | 1.5–2% |
| História Herói | Finanças, Emagrecimento | 2–3% |
| Autoridade de Terceiro | Saúde, Parentalidade | 1.5–2% |

---

## Outputs — O Que Entregar

| Pedido | Output |
|--------|--------|
| Pesquisa rápida | Tabela markdown na conversa |
| Mapa completo de produtos | Excel 4 abas |
| Análise de funil espionado | Relatório markdown estruturado |
| Árvore de sub-nichos | Excel ou árvore visual |
| Biblioteca de copy | Excel ângulos + hooks prontos |
| Sequência de lançamento | Excel com fases + tickets |

Leia `references/outputs.md` para os templates exatos.

---

## Regras de Execução

- **Mínimo 6 buscas** por pesquisa completa
- **Nunca inventar** dados de volume, temperatura ou EPC — se não encontrou, declara
- **Sempre cruzar** pelo menos 2 fontes antes de afirmar
- **Sempre extrair** pelo menos 1 ideia concreta de produto por nicho
- **Pontuar** com score /10 — critérios em `references/scoring.md`
- **Excel** quando resultado tiver 5+ oportunidades ou usuário pedir relatório

---

## Referências

| Arquivo | Quando ler |
|---------|-----------|
| `references/intake.md` | Sempre — para identificar modo e parâmetros |
| `references/mapa-protocol.md` | Modo MAPA — template das 4 abas Excel |
| `references/copy-library.md` | Modo COPY — 12 ângulos com exemplos prontos |
| `references/scoring.md` | Ao pontuar qualquer oportunidade |
| `references/outputs.md` | Para formatar a entrega corretamente |
| `references/platforms.md` | Dados de plataformas + limitações de fetch |


---

## Referência: intake.md

# Intake — Identificar Modo e Parâmetros

## Passo 1 — Classificar o Pedido

Leia o pedido e identifique o modo. Se ambíguo, infira pelo verbo:

| Verbo / Frase | Modo |
|---------------|------|
| "o que está vendendo", "nichos quentes", "onde entrar" | DISCOVERY |
| "aprofunde", "sub-nichos", "micro-nichos", "desce mais" | DEEP DIVE |
| "espione", "analise esse produto/concorrente", "como eles vendem" | SPY |
| temas/ideias do usuário, "mapa de produtos", "o que criar" | MAPA |
| "ângulo de copy", "hook", "headline", "como vender isso" | COPY |
| "tem mercado?", "valide essa ideia", "devo criar isso?" | VALIDAÇÃO |

## Passo 2 — Extrair Parâmetros

Monte internamente antes de pesquisar:

```
NICHO:        [extraído ou informado]
PÚBLICO:      [se mencionado — ex: mulheres 40+, mães, CLT]
MODO:         [DISCOVERY / DEEP DIVE / SPY / MAPA / COPY / VALIDAÇÃO]
PROFUNDIDADE: [rápida (conversa) / completa (Excel)]
TEMAS:        [lista de temas se modo MAPA]
ESTRATÉGIA:   [mecanismo único se já definido pelo usuário]
```

## Passo 3 — Perguntar só se necessário

Regra: **máximo 1 pergunta**, só se realmente impossível inferir.

- Sem nicho e sem contexto → "Qual nicho ou tema você quer pesquisar?"
- Com nicho mas modo ambíguo → inferir pelo contexto, não perguntar
- Com temas no modo MAPA → executar direto, não perguntar

## Passo 4 — Extrair Estratégia do Contexto

No modo MAPA, antes de mapear produtos, verificar:

1. O usuário já definiu um ângulo estratégico? (ex: "o metabolismo é a chave")
2. Há um mecanismo único implícito nos temas? (ex: desparasitação + jejum + metabolismo = causa raiz)
3. Qual é a promessa diferenciada possível? (vs. o que o mercado já diz)

Se identificar um mecanismo único, **nomear explicitamente antes de mapear os produtos**.
Isso diferencia a oferta de tudo que já existe.

## Exemplos Reais

**Pedido:** "pesquisa o mercado de emagrecimento"
→ Modo: DISCOVERY | Nicho: emagrecimento | Profundidade: completa

**Pedido:** "me dê sub-nichos de espiritualidade"
→ Modo: DEEP DIVE | Nicho: espiritualidade | Profundidade: completa

**Pedido:** "emagrecimento sem efeito rebote, lipedema, jejum, desparasitação"
→ Modo: MAPA | Temas: [rebote, lipedema, jejum, desparasitação]
→ Mecanismo Único identificado: metabolismo bloqueado como causa raiz

**Pedido:** "como eu vendo esse produto sobre menopausa?"
→ Modo: COPY | Nicho: menopausa / saúde feminina


---

## Referência: mapa-protocol.md

# Protocolo MAPA — Como Montar o Mapa Profundo de Produtos

Usar quando: usuário traz temas, ideias ou produtos e quer um mapa estratégico completo.

---

## Estrutura do Excel — 4 Abas Obrigatórias

### ABA 1 — Estratégia Central

**Objetivo:** Definir o posicionamento ANTES de listar produtos.

Blocos a construir:

**Bloco A — A Tese Central**
Tabela comparando O Que Todos Dizem vs. O Que Você Vai Dizer:

| Elemento | Conteúdo |
|----------|----------|
| ❌ O que todos dizem | Promessa genérica do mercado |
| ✅ O que você vai dizer | Ângulo diferenciado |
| 🔑 O Mecanismo Único | A lógica que explica tudo |
| 🎯 A Promessa Final | Resultado claro + diferente + permanente |

**Bloco B — Como os Temas se Conectam**
Cada tema vira uma etapa da jornada:

| Tema | Papel na Narrativa | O que faz | Como falar no copy | Impacto no funil |
|------|-------------------|-----------|-------------------|-----------------|

**Regra de ouro:** Os temas não são produtos soltos — são capítulos da mesma história.
A narrativa conecta o problema raiz → desbloqueio → amplificador → resultado permanente.

---

### ABA 2 — Mapa de Produtos (4 Níveis)

Colunas obrigatórias:

```
TEMA Principal | SUB-TEMA Nível 2 | MICRO Nível 3 | NANO-PÚBLICO Nível 4 |
DOR Central | NOME DA OFERTA + FORMATO | TICKET | BUMP (+30%) |
UPSELL (+18%) | ÂNGULO DE COPY (mecanismo único) | SEM APARECER? | SCORE /10
```

**Como preencher o Nano-Público (Nível 4):**
Não é uma demografia. É uma situação de vida:
- ❌ Errado: "Mulher 40 anos"
- ✅ Certo: "Mulher 45, hipotireoidismo tratado, faz tudo certo e não emagrece, já desistiu 3 vezes"

**Como preencher o Ângulo de Copy:**
Sempre usar o mecanismo único definido na Aba 1.
Formato: "O [problema] não é culpa sua. É [causa raiz do mecanismo]. [Solução]."

**Scoring por produto:**
- 9.5–10.0 = atacar imediatamente
- 9.0–9.4 = alta prioridade
- 8.5–8.9 = testar com orçamento baixo
- Abaixo de 8.5 = aprofundar pesquisa antes

---

### ABA 3 — Funis e Copy

Para cada produto principal, uma linha com:

```
PRODUTO | HOOK (3 segundos) | HEADLINE VSL/PÁGINA |
DOR AGITADA (30 segundos) | MECANISMO ÚNICO (revelação) |
PROMESSA FINAL | BUMP COPY | UPSELL COPY | PLATAFORMA IDEAL
```

**Estrutura do Hook (3 segundos):**
```
Padrão A — Pergunta que dói: "Você já tentou [X] e [problema]?"
Padrão B — Declaração chocante: "O motivo real por que [problema] não é [crença comum]"
Padrão C — Resultado + contraintuitivo: "Perdi [X] sem [sacrifício esperado]"
Padrão D — Identificação de público: "Se você tem [condição específica], isso é para você"
```

**Estrutura da Dor Agitada (30 segundos):**
1. Nomear a situação exata (espelho — ela se reconhece)
2. Mostrar que ela tentou e não é culpa dela
3. Revelar que há uma causa oculta que ninguém contou

**Estrutura do Mecanismo Único (revelação):**
1. Nomear a causa raiz de forma nova
2. Explicar a lógica com clareza
3. Mostrar por que as soluções anteriores não funcionaram (não é culpa dela)
4. Apresentar o produto como a solução correta

---

### ABA 4 — Sequência de Lançamento

Colunas:
```
FASE | PRODUTO | POR QUE ESSE PRIMEIRO | TEMPO DE CRIAÇÃO |
PLATAFORMA | TICKET PRINCIPAL | TICKET MÉDIO COM FUNIL | OBJETIVO DA FASE
```

**Ordem padrão de lançamento:**

| Fase | Critério de Escolha | Objetivo |
|------|--------------------|----|
| 1 — VALIDAR | Menor criação + menor risco. Testa o ângulo. | ROAS >1.5 em 7 dias |
| 2 — AUTORIDADE | Diferenciador único. Constrói lista aquecida. | Base de leads para fase 3 |
| 3 — PRINCIPAL | Maior ticket. Menor concorrência. Lista quente. | Produto âncora do portfólio |
| 4 — EXPANSÃO | Tendência de mercado. Aproveita onda. | Capturar novo público |
| 5 — ASCENSÃO | Bundle dos produtos. Afiliados escalam. | Alto ticket para base fiel |

---

## Regras do Protocolo MAPA

1. **Sempre começar pela Estratégia Central** — produto sem posicionamento vira commodity
2. **Mecanismo Único primeiro** — definir antes de listar qualquer produto
3. **Nano-público, não demografia** — situação de vida, não idade e gênero
4. **Ângulo de copy saindo do mecanismo** — não copy genérico
5. **Sequência importa** — a ordem dos produtos define a velocidade de validação
6. **Sem aparecer é padrão** — todos os produtos devem ter opção 100% sem câmera

## Ferramentas de Criação (sempre incluir)

Para cada produto, sugerir:
- ChatGPT → conteúdo do produto
- Canva → design do PDF / slides
- ElevenLabs ($5/mês) → narração IA para áudios e VSLs
- OBS Studio (grátis) → gravação de tela sem câmera
- Google Sheets → planilhas e trackers
- Kiwify / Hotmart → plataforma de venda

Custo total médio: R$0 a R$27/mês.


---

## Referência: copy-library.md

# Biblioteca de Copy — 12 Ângulos com Exemplos Prontos

## Regra de Uso

1. Identificar o nicho e o nano-público
2. Consultar a matriz (qual ângulo funciona melhor)
3. Preencher o template com os dados do produto
4. Adaptar para o formato (anúncio, VSL, página de vendas)

---

## Os 12 Ângulos

### 1. Dor Aguda Específica
**Lógica:** Nomear a dor com precisão cirúrgica. A pessoa sente que você está descrevendo ela.
**Gatilho:** Empatia + Reconhecimento (Cialdini: Liking)
**Melhor para:** Saúde, Relacionamento, Parentalidade
**CTR:** 2.5–4% | **Conversão:** 1.5–3%

Template:
```
Hook: "Você [situação exata] e [consequência que ela sente]?"
Headline: "Essa [dor] que você não consegue explicar para ninguém tem nome — e tem solução."
```

Exemplo (desparasitação):
```
Hook: "Você faz dieta, faz jejum, e o peso simplesmente não sai?"
Headline: "O Motivo Oculto Por Que Sua Dieta Nunca Funcionou (e o que fazer)"
```

---

### 2. Resultado + Prazo + Prova Social
**Lógica:** Número concreto + prazo específico + prova real. Quanto mais específico, mais crível.
**Gatilho:** Prova Social + Ultra Especificidade (4U)
**Melhor para:** Emagrecimento, Renda extra, Desenv. pessoal
**CTR:** 3–5% | **Conversão:** 2–4%

Template:
```
Hook: "[número] [público] [resultado] em [prazo] — sem [sacrifício]"
Headline: "O método que fez [número] [público] [resultado] em [prazo] — revelado"
```

Exemplo (jejum):
```
Hook: "2.300 mulheres regularam o metabolismo em 21 dias — sem passar fome"
Headline: "O protocolo que 2.300 mulheres usaram para emagrecer sem efeito rebote"
```

---

### 3. Segredo / Informação Proibida
**Lógica:** Apresenta algo que a maioria não sabe. Cria curiosidade irresistível.
**Gatilho:** Curiosidade + Novidade (dopamina)
**Melhor para:** Saúde alternativa, Lei da Atração, IA, Finanças
**CTR:** 4–7% | **Conversão:** 1.5–2.5%

Template:
```
Hook: "A [entidade] não quer que você saiba que [revelação]"
Headline: "O segredo que [indústria] esconde sobre [problema]"
```

Exemplo (metabolismo):
```
Hook: "O que a indústria das dietas não quer que você saiba sobre o efeito rebote"
Headline: "Por Que Toda Dieta que Você Fez Era Errada — e a Causa Real do Ioiô"
```

---

### 4. Anti-Esforço / Anti-Sacrifício
**Lógica:** Contraria a crença de que precisa de disciplina, força de vontade ou sacrifício.
**Gatilho:** Alívio de dor + Permissão para tentar novamente
**Melhor para:** Emagrecimento, Renda extra, Aprendizado
**CTR:** 3–5% | **Conversão:** 2–4%

Template:
```
Hook: "Não sou disciplinada, não malho e não faço dieta — e [resultado]"
Headline: "Como [resultado] sem [sacrifício 1], sem [sacrifício 2] — funciona mesmo"
```

Exemplo (lipedema):
```
Hook: "Parei de lutar contra meu corpo e comecei a tratar o problema real"
Headline: "Lipedema Não Se Trata com Dieta: o Protocolo que a Medicina Convencional Ignora"
```

---

### 5. Identidade / Transformação
**Lógica:** Não vende produto — vende quem a pessoa vai se tornar.
**Gatilho:** Identidade (Star-Story-Solution)
**Melhor para:** Desenv. pessoal, Relacionamento, Espiritualidade
**CTR:** 1.5–2.5% | **Conversão:** 3–5%

Template:
```
Hook: "Você não precisa mudar o que faz. Você precisa mudar quem você é."
Headline: "Em [prazo] você não vai reconhecer a versão de você que vai ver no espelho"
```

---

### 6. Curiosidade Interrompida
**Lógica:** Começa uma história e para no cliffhanger. Obriga o clique.
**Gatilho:** Efeito Zeigarnik (tensão de incompletude)
**Melhor para:** Relacionamento, Espiritualidade, Orgânico/Reels
**CTR:** 5–9% | **Conversão:** 1–2%

Template:
```
Hook: "Estava prestes a [desistir/perder tudo] quando [descoberta inesperada]..."
```

Exemplo (pós-Ozempic):
```
Hook: "Parei a caneta depois de 6 meses. O peso começou a voltar. Então encontrei..."
```

---

### 7. Prova Social Hiper-Específica
**Lógica:** Depoimento real com nome + situação + número + prazo. Quanto mais específico, mais confia.
**Gatilho:** Prova Social + Credibilidade (Cialdini)
**Melhor para:** Todos os nichos. Especial para retargeting.
**CTR:** 2–3% | **Conversão:** 4–7%

Template:
```
Hook: "[Nome], [idade], [situação]: '[resultado concreto em prazo]' — depoimento real"
Headline: "Veja o que aconteceu com [número] pessoas que seguiram o protocolo"
```

---

### 8. Inimigo Externo
**Lógica:** Cria um vilão comum — indústria, sistema, médicos. O produto é a rebeldia.
**Gatilho:** Rebeldia + Pertencimento + Raiva coletiva
**Melhor para:** Saúde alternativa, Finanças, Natureba
**CTR:** 2–4% | **Conversão:** 2–3%

Template:
```
Hook: "A indústria da [setor] não quer que você saiba que [verdade inconveniente]"
Headline: "Por que [autoridade] tem medo de te contar a verdade sobre [problema]"
```

---

### 9. Pergunta que Dói
**Lógica:** Uma pergunta que faz a pessoa dizer "sim, esse sou eu." Autodiagnóstico imediato.
**Gatilho:** Reconhecimento + Mirror Effect
**Melhor para:** Todos os nichos. Excelente em card/carrossel/email.
**CTR:** 3–5% | **Conversão:** 2–3%

Template:
```
Hook: "Você já [tentou X] e [mesmo assim Y]?"
Headline: "Por que pessoas [merecedoras/que se esforçam] continuam [problema]?"
```

Exemplo (jejum feminino):
```
Hook: "Você já tentou jejum intermitente e ficou com compulsão à noite?"
Headline: "Por Que o Jejum Piora Quando Você Tem Desequilíbrio Hormonal"
```

---

### 10. Mecanismo Único
**Lógica:** Uma lógica ou descoberta nova que explica o problema diferente de todos os outros.
**Gatilho:** Novidade + Lógica + Autoridade científica
**Melhor para:** Saúde, IA, Financeiro. Tickets altos.
**CTR:** 1.5–2% | **Conversão:** 3–5%

Template:
```
Hook: "O problema não é [crença comum]. É [mecanismo novo] — e ele tem solução"
Headline: "O [mecanismo] que impede [público] de [resultado] — e como reverter"
```

Exemplo (metabolismo bloqueado):
```
Hook: "Você não emagrece porque seu metabolismo está bloqueado — não é culpa sua"
Headline: "O Mecanismo Metabólico que Sabota Qualquer Dieta (e como desbloqueá-lo)"
```

---

### 11. História Herói (Villão → Herói)
**Lógica:** Você era o vilão (errava tudo), virou herói. Audiência se identifica e acredita.
**Gatilho:** Identificação + Humildade + Jornada real
**Melhor para:** Finanças pessoais, Emagrecimento, Relacionamento
**CTR:** 2–3% | **Conversão:** 3–6%

Template:
```
Hook: "Eu tinha [situação péssima] — e então [virada]"
Headline: "Como [saí de X] para [resultado Y] — o método que ninguém me contou"
```

---

### 12. Autoridade de Terceiro
**Lógica:** Usa credencial externa — pesquisa, universidade, especialista. Não você, eles.
**Gatilho:** Autoridade + Credibilidade heurística
**Melhor para:** Saúde, Parentalidade, B2B / ticket alto
**CTR:** 1.5–2% | **Conversão:** 3–5%

Template:
```
Hook: "Um estudo da [instituição] confirmou o que [público] sabe há anos..."
Headline: "O que os maiores [especialistas] descobriram sobre [problema]"
```

---

## Matriz de Melhor Ângulo por Nicho

| Nicho | 1º Ângulo | 2º Ângulo | Evitar |
|-------|-----------|-----------|--------|
| Emagrecimento Feminino | Dor Aguda | Resultado+Prova | — |
| Emagrecimento Mecanismo | Mecanismo Único | Inimigo Externo | — |
| Lipedema | Dor Aguda | Mecanismo Único | Anti-Esforço |
| Desparasitação | Segredo | Mecanismo Único | — |
| Jejum (falhou antes) | Anti-Esforço | Pergunta que Dói | — |
| Jejum Feminino/Hormonal | Mecanismo Único | Dor Aguda | — |
| Pós-Ozempic | Curiosidade Interrompida | Mecanismo Único | — |
| Sem Efeito Rebote | Pergunta que Dói | Mecanismo Único | — |
| Suplementação Natural | Mecanismo Único | Inimigo Externo | — |
| Lei da Atração | Segredo | Identidade | Inimigo Externo |
| Renda Extra / Afiliado | Anti-Esforço | Resultado+Prova | — |
| Relacionamento | Dor Aguda | Curiosidade | — |
| Parentalidade / Bebê | Dor Aguda | Prova Social | — |
| IA / ChatGPT | Resultado+Prova | Segredo | — |


---

## Referência: scoring.md

# Scoring — Critérios de Pontuação /10

## Cálculo do Score

Somar os pontos abaixo. Só pontuar o que foi verificado via pesquisa real.

| Critério | Peso | 0 pts | 1 pt | 2 pts |
|----------|------|-------|------|-------|
| Demanda comprovada | 25% | Sem evidência | Interesse médio | Alta busca + fóruns ativos |
| Anúncios ativos | 20% | Nenhum | 1–5 anúncios | 5+, rodando 30+ dias |
| Saturação | 15% | Muito saturado | Média | Baixa — espaço para entrar |
| Ticket viável | 15% | Abaixo de R$37 | R$37–97 | Acima de R$97 |
| Sem aparecer possível | 10% | Impossível | Com adaptações | 100% sem câmera |
| Funil com bump/upsell | 10% | Sem funil | Bump só | Bump + upsell completo |
| Especificidade do nano-público | 5% | Genérico | Segmentado | Hiper-específico (situação de vida) |

## Interpretação

| Score | Decisão |
|-------|---------|
| 9.5–10.0 | 🚀 ATACAR AGORA |
| 9.0–9.4 | ⚡ ALTA PRIORIDADE — testar |
| 8.0–8.9 | 📋 CONSIDERAR — pesquisa mais |
| Abaixo de 8.0 | ⚠️ EVITAR ou reformular |

## Flags Complementares

Adicionar ao output quando aplicável:

- 🟢 **EVERGREEN** — demanda constante o ano todo
- 🟡 **SAZONAL** — pico em épocas específicas
- 💎 **ESCONDIDO** — poucos concorrentes, público muito engajado
- ⚡ **TENDÊNCIA** — crescimento nos últimos 90 dias
- 🔴 **SATURADO** — mais de 20 anunciantes no mesmo ângulo
- 🆕 **EMERGENTE** — mercado novo, ainda sem líder claro
- 🔗 **NARRATIVA** — produto que se conecta a outros do portfólio


---

## Referência: outputs.md

# Outputs — Templates de Entrega

## Quando gerar Excel vs. resposta na conversa

| Situação | Output |
|----------|--------|
| 1–4 nichos, pesquisa rápida | Tabela markdown na conversa |
| 5+ nichos ou sub-nichos | Excel com abas |
| Modo MAPA (temas do usuário) | Excel 4 abas obrigatório |
| Funil espionado | Relatório markdown estruturado |
| Pedido explícito de arquivo | Excel |

---

## Template 1 — Resposta Rápida (Conversa)

```markdown
## 🔍 Pesquisa: [NICHO]

**Resumo:** [2 frases sobre estado atual do mercado]

| Oportunidade | Score | Saturação | Plataforma | Sem Aparecer? | Ação |
|---|---|---|---|---|---|
| [nome] | X/10 | 🟢/🟡/🔴 | [plat] | ✅/⚠️ | [veredicto] |

**Produto sugerido:** [nome + formato]
**Bump ideal:** [ideia + R$XX]
**Upsell ideal:** [ideia + R$XX]
**Hook do anúncio:** "[texto]"

**Fontes consultadas:** [lista]
**Próximos passos:** 1. [...] 2. [...] 3. [...]
```

---

## Template 2 — Funil Espionado (SPY)

```markdown
## 🕵️ Análise: [PRODUTO/CONCORRENTE]

**Plataforma:** | **Ticket:** R$XX | **Anúncio ativo há:** X dias

### Estrutura do Funil
- **Anúncio:** [ângulo, formato, copy do headline]
- **Captura:** [tem? isca digital?]
- **VSL/Página:** [tipo, promessa principal]
- **Order Bump:** [tem? preço? copy?]
- **Upsell:** [tem? preço? argumento?]
- **Downsell:** [tem?]
- **Garantia:** X dias

### Pontos Fortes
- [o que funciona bem]

### Gaps — Onde Você Entra
- [o que está faltando / como diferenciar]

### Seu Ângulo de Entrada
[Como entrar com diferenciação real]
```

---

## Template 3 — Árvore de Sub-nichos

```markdown
## 🌳 Árvore: [NICHO PRINCIPAL]

### Nível 1 → [Nicho]
  ├── Nível 2 → [Sub-nicho A]
  │   ├── Nível 3 → [Micro A1] | Score: X/10 | Produto: [ideia]
  │   └── Nível 3 → [Micro A2] | Score: X/10 | Produto: [ideia]
  └── Nível 2 → [Sub-nicho B]
      ├── Nível 3 → [Micro B1] | Score: X/10 | Produto: [ideia]
      └── Nível 3 → [Micro B2] | Score: X/10 | Produto: [ideia]

### Top 3 para Atacar
1. **[nome]** — [motivo] — Produto: [ideia específica]
2. **[nome]** — [motivo] — Produto: [ideia específica]
3. **[nome]** — [motivo] — Produto: [ideia específica]
```

---

## Template 4 — Excel MAPA (4 abas)

Gerar via Python/openpyxl com as 4 abas:

**Aba 1 — Estratégia Central**
- Bloco A: tese central (O que todos dizem vs. você)
- Bloco B: conexão dos temas na narrativa

**Aba 2 — Mapa de Produtos**
Colunas: Tema | Sub-tema | Micro | Nano-público | Dor | Oferta | Ticket | Bump | Upsell | Ângulo copy | Sem aparecer? | Score

**Aba 3 — Funis e Copy**
Colunas: Produto | Hook 3s | Headline VSL | Dor agitada | Mecanismo único | Promessa | Bump copy | Upsell copy | Plataforma

**Aba 4 — Sequência de Lançamento**
Colunas: Fase | Produto | Por que primeiro | Tempo criação | Plataforma | Ticket | Ticket médio c/ funil | Objetivo da fase

**Paleta de cores padrão:**
- Header principal: #1A1410 (fundo escuro, texto branco)
- Dor / urgência: #C8410A / #FDECEA
- Produto / oferta: #2D6A4F / #E8F5EE
- Copy / ângulo: #6B3FA0 / #F0EAFB
- Ticket / financeiro: #B5850A / #FDF6E3
- Score alto (9.5+): #2D6A4F / #E8F5EE
- Alternância de linhas: #FFFFFF / #F9F6F1

---

## Sempre Incluir no Final

```
**Próximos passos:**
1. [ação concreta]
2. [ação concreta]
3. [ação concreta]

**Fontes consultadas:** [URLs ou plataformas]
```


---

## Referência: platforms.md

# Plataformas — Dados e Limitações

## Comparativo de Plataformas

| Plataforma | Taxa | Bump Nativo | Saque Mín. | Velocidade | Afiliado | Melhor Para |
|-----------|------|------------|-----------|-----------|---------|------------|
| **Hotmart** | 9.9%+R$1 | ✅ Completo | R$50 | D+14 (Pix D+1) | ✅ Marketplace | Produtos R$97+, escala, afiliados |
| **Kiwify** | 8.99%+R$2.49 | ✅ Excelente | R$0 | D+15 (Pix instant.) | ✅ Marketplace | Tráfego frio, checkout alto conv. |
| **Monetizze** | 8.9%+R$1.99 | ✅ Bom | R$50 | D+14 (antecip. D+2) | ✅ Marketplace | Físico+digital, suplemento |
| **Ticto** | ~7%+fixo | ✅ Bom | R$30 | D+7 (Pix D+1) | ✅ Disponível | Afiliados exp., CPA alto |
| **Hubla** | ~5%+fixo | ❌ | R$100 | D+15 | ⚠️ Limitado | Membros mensais, comunidades |
| **Braip** | ~8% var. | ✅ Disponível | R$50 | D+14 | ✅ Marketplace | Público C/D, boleto, físico |
| **Eduzz** | 7.9% var. | ⚠️ Básico | R$50 | D+30 | ✅ Academia360 | Cursos premium, B2B |
| **Lastlink** | Grátis/R$99 | ❌ | R$50 | D+7 | ❌ | Venda direta simples |

## Nichos Fortes por Plataforma

- **Kiwify** → Emagrecimento, Espiritualidade, Relacionamento, Pets, Parentalidade, Saúde
- **Hotmart** → Desenv. pessoal, Negócios, Cursos premium, Lei da Atração, IA
- **Monetizze** → Saúde física, Suplementos, Emagrecimento + físico
- **Ticto** → Marketing digital, Copy, Negócios, Afiliados avançados
- **Hubla** → Comunidades, Membros recorrentes, Grupos exclusivos, Suporte
- **Braip** → Público popular, Emagrecimento massa, Suplemento+ebook, Boleto

## Meta Ads Library — 3 Caminhos

### ❌ Fetch direto — BLOQUEADO permanentemente
`web_fetch` na URL da biblioteca retorna erro de permissão. Não tentar.

### ✅ Caminho 1 — Manual (zero custo, funciona agora)
Pedir ao usuário para abrir e colar o resultado:
```
facebook.com/ads/library/?country=BR&q={NICHO}&active_status=active&ad_type=ALL
```
Claude analisa o texto colado com o template SPY de outputs.md.

### ✅ Caminho 2 — Dorks de anúncios (alternativa imediata)
```
"{nicho}" anúncio facebook instagram "saiba mais" OR "acesse agora" 2025
"{nicho}" "sponsored" site:facebook.com
"{nicho}" "compre agora" OR "garanta já" instagram
```

### ✅ Caminho 3 — API Oficial Meta (gratuito, programático)
Endpoint: `GET https://graph.facebook.com/v17/ads_archive`
Parâmetros: `access_token`, `ad_type=ALL`, `ad_reached_countries=BR`, `search_terms={NICHO}`
Campos: `id,ad_creation_time,ad_creative_body,ad_snapshot_url,page_name`
⚠️ Retorno parcial para infoprodutos comerciais no Brasil.

### ✅ Caminho 4 — Ferramentas de Spy
| Ferramenta | Custo | Melhor para |
|---|---|---|
| BigSpy | ~$9/mês | FB+IG+TikTok, filtro país/nicho |
| PowerAdSpy | ~$49/mês | Custo-benefício para BR |
| Minea | ~$49/mês | Infoprodutos + dropshipping |
| AdSpy | ~$149/mês | Copy completo + landing pages |

## Outras Limitações de Fetch

**Hotmart/Kiwify marketplace** — páginas com login bloqueiam fetch.
Workaround: `site:hotmart.com "{nicho}"` ou `site:pay.kiwify.app "{nicho}"`

**Regra:** Sempre tentar o fetch primeiro. Se bloqueado, usar dork equivalente.

## Indicadores de Temperatura Hotmart

| Temperatura | Significado |
|------------|-------------|
| 150°+ | Top de mercado, muito validado |
| 100–149° | Alto volume, escalando |
| 70–99° | Boa performance |
| 40–69° | Médio, testando |
| Abaixo de 40° | Baixo volume ou novo |
