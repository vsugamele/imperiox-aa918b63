# 07 — Esteira de Escala DTC (verba de anúncio direto)

Metodologia DTC Affiliate (@gbifi), trazida do AffHub. Serve para decidir **onde pôr e tirar verba** em anúncio direto (Meta), com regra fixa em cada fase. Fonte da verdade das regras no Império: `supabase/functions/_shared/scale-ladder.ts`. Pelo MCP: `evaluate_scale`. No mapa do projeto: playbook `esteira-escala-dtc`.

## Antes de tudo: 3 números

| Parâmetro | O que é | Exemplo |
|---|---|---|
| **Payout** | Quanto entra por venda (comissão ou margem bruta). É o breakeven do CPA. | 70 |
| **CPA alvo** | Quanto se quer pagar por venda. | 45 |
| **ICs por venda** | Checkouts iniciados para cada venda (padrão 8). | 8 |

Deles saem:
- **Teto de custo por IC (qualificado)** = CPA alvo ÷ ICs por venda → 5,63
- **Teto "mais textos"** = 1,75 × o teto acima → 9,84
- **Lance inicial do P3** = 60% do CPA alvo → 27
- **Teto econômico** = 80% do payout → 56
- **Cost cap do P4** = 70% do CPA alvo → 31,50
- **Verba de referência**: P1 ≈ 10 × CPA alvo; P2 ≈ 15 × CPA alvo

## Zonas do CPA

| Zona | Faixa | Leitura |
|---|---|---|
| 🟢 ESCALA | CPA ≤ alvo | Duplica, sobe lance |
| 🟩 LUCRATIVA | alvo < CPA ≤ 80% do payout | Margem boa |
| 🟡 MAGRA | 80% do payout < CPA ≤ payout | Só com volume |
| 🔴 PREJUÍZO | CPA > payout | Mata |

## P1 — Teste de concepts (ABO 1-5-3, 2 dias)

- 1 conjunto = 1 **concept** (1 ângulo × 1 avatar), 3 anúncios com o mesmo concept, verba fixa (~40/conjunto/dia).
- **2 dias sem mexer.** Veredito no fim do dia 2 pelo **custo por checkout iniciado (IC)**.
- Cada concept leva uma **hipótese escrita**: o que precisa ser verdade para ele vender.

| Veredito | Regra | Ação |
|---|---|---|
| QUALIFICADO | Teve venda, ou custo/IC ≤ teto qualificado | Vai para o P2 |
| MAIS TEXTOS | custo/IC ≤ teto "mais textos" | Produz mais primary texts e roda de novo |
| MATA | custo/IC acima do teto, ou gastou 2× o teto "mais textos" sem nenhum IC | Mata o concept |
| CEDO | Sem IC e gasto baixo | Espera completar os 2 dias |

**Placar de hipóteses**: qualificado = hipótese CONFIRMADA; mais textos = PARCIAL; morto = REFUTADA.
Hipótese refutada **não volta com criativo novo**, só se a premissa mudar. Hipótese confirmada vira eixo de variação: avatar → headline → hook empilhado → fatia de público.
**O que se leva para a semana seguinte é o placar, não o criativo vencedor.**

## P2 — Rodada de primary text (ABO 1-5-10, 3 dias)

- Para cada texto vencedor do P1: 5 conjuntos idênticos, mesmo texto, até 10 adformats.
- **Dias 1 e 2 não julgam.** No dia 2 há um checkpoint (custo por IC e por pageview contra alvo e breakeven), só como sinal.
- **Dia 3, CPA acumulado:** ≤ alvo **APROVADO** (vai ao P3); ≤ 1,5× alvo **ESTENDE +3 dias**; acima **REPROVADO** (volta ao P1 com texto novo).
- Por conjunto no dia 3: ESCALA/LUCRATIVA **duplica** na mesma campanha; MAGRA **mantém**; PREJUÍZO ou gasto sem venda **pausa**. Pausar conjunto não mata o concept.

## P3 — Escala (CBO perpétuo com bid cap)

- 1 conjunto por ângulo, dura meses. Lance inicial = 60% do CPA alvo.
- **Rotina de 10 segundos, todo dia, antes de qualquer clique:**
  - Gastou ≥ 95% da verba ontem → o freio é **a verba**: sobe ~20%. Não mexe no lance.
  - Gastou menos → o freio é **o lance**: sobe ~17% e espera 48 h. Não mexe na verba.
  - **Nunca verba e lance no mesmo dia.**
- **Escada do lance:** sobe ~17,5%, espera 48 h; se o gasto não cresceu, **para** e volta ao lance anterior (achou o teto).
- Ângulo com CPA 7 dias acima do payout: **REVISA**. Ângulo 7+ dias sem gastar: **→ cemitério (P4)**.

## P4 — Cemitério (CBO 1-1-10 com cost cap)

- Montado uma vez, não mexe: cost cap = 70% do CPA alvo, verba fixa, até 10 ângulos.
- Só entra quem escalou no P3 e ficou 7+ dias sem gastar.
- Gasto zero na maioria das semanas **é o esperado** (DORMINDO).
- Vendendo barato de vez em quando: **CATANDO**, deixa.
- Gastou sem venda: o cost cap segura, observa.
- **3 dias seguidos dentro do CPA: volta ao P3** com conjunto novo.

## Como a IA deve usar

1. Sem os 3 parâmetros, **pergunte antes** de dar veredito.
2. Para qualquer decisão de verba, rode `evaluate_scale` com os números reais e responda com veredito + ação, citando a fase.
3. Nunca recomende mexer em verba e lance no mesmo dia, nem julgar o P1 antes do dia 2 ou o P2 antes do dia 3.
4. Ao propor novos concepts, comece pelo placar de hipóteses da rodada anterior.

## Onde os números ficam

Nas etapas do playbook no mapa do projeto (Parâmetros, P1 a P4), o painel da etapa tem a seção **Esteira de Escala**: lança os números (ou puxa gasto, checkouts iniciados e compras por conjunto do sync de anúncios), mostra o veredito ao vivo e salva a rodada com histórico. Pelo MCP, `get_scale_rounds` devolve as rodadas salvas e o **placar de hipóteses acumulado** do projeto.
