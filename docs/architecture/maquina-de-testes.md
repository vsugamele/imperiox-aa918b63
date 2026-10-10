# Máquina de Testes de Criativos — agentes, lógica e estrutura

> Objetivo: achar o caminho do dinheiro por volume e disciplina, não por sorte. Cada projeto roda um ciclo semanal
> fechado (medir → pesquisar → decidir → produzir → revisar → lançar → julgar → aprender), com agentes que têm um
> trabalho só, falam por tabelas e agem sozinhos dentro de tetos definidos pelos sócios.
>
> Versão 1 · 10/10/2026 · base: inventário do que já roda no Império (seção 5).

---

## 1. Princípios

1. **A verdade é a venda do Império, não o pixel.** O Purchase do Meta veio ~3x inflado no JP. Toda decisão de cortar
   ou escalar usa `imphq_vendas` (webhook do checkout) ligado ao anúncio pela UTM.
2. **Volume antes de genialidade.** 1 em cada 10–20 criativos funciona. Meta: **20 criativos novos por semana por
   projeto** em teste.
3. **Metade explora, metade aproveita.** Toda leva tem variações do que já vendeu e ângulos/formatos nunca testados.
4. **Regra numérica, não opinião.** Matar, manter e escalar seguem números fixos (seção 3). Humano muda o número, não
   o caso.
5. **Autonomia com teto.** Dentro do teto diário de verba, o sistema pausa, duplica e sobe verba sozinho. Fora do teto,
   pede aprovação. Tudo aparece em "A IA fez".
6. **Um agente, um trabalho, uma tabela de saída.** Nenhum agente chama outro direto: um escreve, o próximo lê.

---

## 2. Os agentes

```
            ┌───────────── sexta ─────────────┐
            ▼                                 │
 [1 Medidor] ──► [3 Estrategista] ──► [4 Fábrica] ──► [5 Revisor] ──► [6 Lançador]
      ▲               ▲                                                   │
      │          [2 Minerador]                                            ▼
      │                                                            (anúncios no ar)
      │                                                                   │
 [8 Professor] ◄───────────── [7 Gestor de tráfego] ◄─────────────────────┘
      │                              (diário)
      └──► [9 Relator] → WhatsApp Imperio X (2x/dia) + resumo de sexta
```

| # | Agente | Trabalho (uma frase) | Entrada | Saída | Quando | Já existe | Falta |
|---|--------|----------------------|---------|-------|--------|-----------|-------|
| 1 | **Medidor** | Diz quanto cada anúncio gastou e vendeu de verdade, e o lucro do dia por projeto | `imphq_ads_spend` (Zernio), `imphq_vendas` (checkout) | leituras por anúncio + P&L diário | a cada 6h | `zernio-ads-sync`, `_shared/test-live.ts`, `funnel-live`, `funnel-brain-tick` | gasto de **todos** os projetos (hoje só JP desde 05/10); P&L diário por projeto; CPA máximo cadastrado por produto |
| 2 | **Minerador** | Traz o que os concorrentes estão escalando e deixa lido e classificado | fontes por projeto (`imphq_mining_sources`) | `imphq_referencias` com ângulo, formato, transcrição | diário 06:15 + pipeline 10 min | `ref-mining`, `ref-pipeline`, `ref-dissect`, `jev-classify` | fontes cadastradas para cada projeto |
| 3 | **Estrategista** | Decide a próxima leva: quais ângulos × formatos × ganchos testar | placar (8), biblioteca de ângulos, referências (2), vencedores e cansados (7) | **brief da leva** (20 itens) em `imphq_creative_batches` | segunda 07:00 (ou quando o 7 pedir variações) | `imphq_copy_library` (165 itens), `method-scoreboard`, 152 skills, 19 mentes, `angle-classifier` | a função que monta o brief sozinha com a regra 10/6/4 (seção 3.4) |
| 4 | **Fábrica** | Transforma cada item do brief em copy + imagem (depois vídeo) | brief (3), identidade do projeto | peças em `imphq_creative_assets` | logo após o brief | `creative-factory` (gpt-image-1), `creative-image-gen`, Kie, skills de copy | rodar em lote a partir do brief; vídeo (fase 2) |
| 5 | **Revisor** | Reprova o que pode bloquear a conta ou envergonhar a marca | peças (4) | nota + aprovado/reprovado com motivo | logo após a fábrica | — | **novo**: checklist de política Meta (promessa de resultado, antes/depois, saúde), legibilidade no celular, marca, coerência ângulo↔página |
| 6 | **Lançador** | Sobe a leva aprovada numa campanha de teste padrão | peças aprovadas (5) | ordem de teste `imphq_test_orders/variants` + anúncios no ar com UTM padrão | depois da revisão (ou com o clique de 1 sócio) | `imphq_test_orders`, `test-report-wa`, `zernio-ads-toggle` | criar anúncio pelo Zernio (o token direto do Meta venceu em 26/06); hoje subir é manual |
| 7 | **Gestor de tráfego** | Aplica as regras de matar, manter, escalar e detectar cansaço | leituras (1), parâmetros da esteira (`imphq_scale_rounds`) | ações em `imphq_ai_actions` executadas pelo `imperius-executor` | diário 09:00 + checagem a cada 6h | `traffic-agent` (TRF1.1), `imperius-executor`, `ads-rules-engine` (antigo) | **autonomia**: as 5 pausas propostas desde 08/10 estão paradas; desligar o `ads-rules-engine` antigo para não haver dois juízes |
| 8 | **Professor** | Transforma resultado em peso: o que ganhou ganha mais espaço na próxima leva | ações + resultados (7), placar | placar por ângulo, formato, método e mente, com peso para o 3 | sexta 18:00 | `imperius-learn`, `method-scoreboard`, `ab-test-promoter` | o placar virar peso na escolha do Estrategista; registrar o "porquê" de cada vencedor |
| 9 | **Relator** | Conta para os sócios o que aconteceu, sem pedir decisão que a regra já resolve | tudo acima | WhatsApp Imperio X | 10h e 19h + resumo de sexta | `test-report-wa`, `imperius-daily-digest` | resumo semanal (vencedores, mortos, próxima leva, lucro) |

**Humanos (Vinicius e Bruno):** definem tetos e CPA máximo por produto (uma vez), aprovam o que passa do teto, e dão
o "ok" na leva quando o Revisor marca dúvida. Não aprovam pausa nem escala dentro do teto.

---

## 3. A lógica (regras numéricas)

### 3.1 CPA máximo por produto (o número que manda em tudo)

```
CPA_max = ticket_liquido + (take_rate_bump × ticket_bump) [+ backend_esperado, opcional]
```

- **JP · Código dos Cortes Perfeitos:** R$47 + 27% × ~R$45 ≈ **R$59** (sem contar a formação de R$797 no backend).
- Cadastro em `imphq_scale_rounds` (já existe para o JP desde 07/10). Cada produto novo precisa do seu.

### 3.2 Vida de um criativo em teste

| Situação (vendas reais do Império) | Decisão | Quem executa |
|---|---|---|
| CTR < 0,8% depois de 1.000 impressões | **mata cedo** (sinal barato: ninguém para no anúncio) | Gestor, sozinho |
| gastou ≥ 1,5 × CPA_max (JP ≈ R$90) e 0 vendas | **mata** | Gestor, sozinho |
| vendeu com CPA ≤ CPA_max | **vivo**: continua no teste | — |
| vivo há 3 dias com CPA ≤ CPA_max e ≥ 3 vendas | **promove**: duplica para a campanha de escala | Gestor, sozinho (dentro do teto) |
| CPA entre 1× e 1,5× CPA_max | **observa** mais 1 dia | — |

### 3.3 Escala e cansaço

- **Escala:** +20% de verba por dia no anúncio promovido, enquanto o CPA dos últimos 3 dias ≤ CPA_max e o total do
  projeto ≤ teto diário.
- **Cansaço:** CTR dos últimos 2 dias 30% abaixo dos 3 primeiros dias, ou frequência > 2,5 → o Gestor pede ao
  Estrategista **5 variações do vencedor** (mesmo ângulo, outro gancho/formato) antes de ele morrer.
- **Teto estourado:** nada sobe sozinho; o Relator pede aprovação com a conta pronta ("subir R$X dá Y vendas ao CPA Z").

### 3.4 Composição de toda leva (20 criativos)

| Bloco | Qtde | De onde vem |
|---|---|---|
| Variações dos vencedores | 10 | top 3 do placar: mesmo ângulo, ganchos e formatos diferentes |
| Ângulos novos | 6 | biblioteca (`imphq_copy_library`) + ângulos que os concorrentes escalam (Minerador), priorizando os nunca testados |
| Formatos novos | 4 | formato que funcionou no mercado e não testamos (print de conversa, depoimento, antes/depois permitido, carrossel, UGC) |

Sem vencedor ainda (projeto novo): 14 ângulos novos + 6 formatos.

### 3.5 O que aprende (Professor)

- Placar por **ângulo, categoria, formato, método (skill/mente) e gancho**: anúncios, gasto, vendas reais, CPA.
- Peso para a próxima leva = vendas reais ÷ gasto, suavizado (ângulo com 1 venda não vira dogma).
- Cada vencedor ganha uma nota "por que funcionou", escrita a partir da peça e do público, para o Estrategista reusar a
  lógica e não só copiar a peça.

---

## 4. Calendário da semana (por projeto)

| Dia | O que acontece | Agentes |
|---|---|---|
| **Segunda 07:00** | brief da leva → fábrica → revisão → lançamento | 3 → 4 → 5 → 6 |
| **Todo dia 09:00 + a cada 6h** | leitura, matar/manter/promover, pedido de variações se cansar | 1 → 7 |
| **Todo dia 06:15 + 10 min** | mineração e leitura das referências | 2 |
| **10h e 19h** | relatório no Imperio X | 9 |
| **Sexta 18:00** | placar atualizado, vencedores com "porquê", resumo da semana e prévia da próxima leva | 8 → 9 |

---

## 5. Estrutura de dados (reaproveitando o que existe)

| Tabela | Papel no ciclo | Estado hoje |
|---|---|---|
| `imphq_scale_rounds` | parâmetros por projeto: CPA_max, payout, teto | só JP (1 registro) |
| `imphq_ads_spend` | gasto por anúncio/dia (Zernio) | só JP desde 05/10 |
| `imphq_vendas` | vendas reais com UTM | ok (bumps corrigidos em FUN1.3) |
| `imphq_mining_sources` / `imphq_referencias` | mercado | ok; falta cadastrar fontes |
| `imphq_copy_library` | 165 ângulos/objeções/provas/mecanismos | ok |
| `imphq_creative_batches` | **brief da leva** (20 itens: ângulo, formato, gancho, método, origem) | existe, vazia |
| `imphq_creative_assets` | peças geradas + nota do Revisor | existe, vazia |
| `imphq_test_orders` / `imphq_test_variants` | leva no ar, com método e ângulo por anúncio | ok (1 teste JP) |
| `imphq_ai_actions` | decisões (pausar, duplicar, verba) e execução | ok; 5 pausas paradas |
| `imphq_ai_policy` | autonomia e kill switch por tipo de ação | ok (`imperius-learn`) |

Nenhuma tabela nova é necessária para a v1. O elo que falta é **lógica** (Estrategista, Revisor, Lançador via Zernio)
e **configuração** (tetos, CPA_max, fontes, autonomia).

---

## 6. Ordem de construção (stories sugeridas)

1. **OPS1.1 Medidor completo**: gasto de todos os projetos no Império + P&L diário por projeto + CPA_max por produto.
2. **OPS1.2 Gestor autônomo**: `traffic-agent` executa sozinho dentro do teto (pausar, promover, +20%), desliga o
   `ads-rules-engine` antigo, regra de cansaço pede variações.
3. **OPS1.3 Estrategista**: função `batch-brief` monta a leva de 20 pela regra 10/6/4 a partir do placar, biblioteca e
   referências.
4. **OPS1.4 Fábrica em lote + Revisor**: `creative-factory` processa o brief inteiro; checklist de política e marca
   com nota.
5. **OPS1.5 Lançador**: sobe a leva aprovada pelo Zernio com UTM padrão e cria a ordem de teste.
6. **OPS1.6 Professor + resumo de sexta**: peso no placar, "por que ganhou", relatório semanal.
7. **Fase 2 · vídeo** (Kie/Higgsfield) na Fábrica, para SlimSoda VSL.

---

## 7. Decisões dos sócios (uma vez por projeto)

- [ ] Teto de verba diária por projeto (ex.: JP R$300/dia).
- [ ] CPA máximo por produto (JP CCP sugerido: R$59).
- [ ] Autonomia: o sistema pode **pausar** e **promover/subir 20%** sozinho dentro do teto? (sim/não)
- [ ] Lançamento: a leva sobe sozinha após o Revisor, ou com 1 clique de um sócio?
- [ ] Fontes de mineração por projeto (palavras e páginas de concorrentes).
