# Método H&W dentro do Império — como os materiais viram regra, campo e agente

> Fonte: materiais internos da H&W / DTC Affiliate Pro (Playbook do Tráfego Inicial · Método CBO; Trilha de Copy,
> Missões 01 a 05; Fundamentos do DR). Material interno, **não distribuir**: aqui ficam só os conceitos resumidos e
> onde cada um entra no sistema. Complementa [maquina-de-testes.md](maquina-de-testes.md) (os 9 agentes).
>
> Versão 1 · 10/10/2026 · nada disto está rodando: é o desenho para implementar.

---

## 1. A ideia em uma frase

Os materiais ensinam **um piloto humano** a escolher, ler, adaptar e multiplicar criativos. No Império, cada uma dessas
decisões vira um **campo** (para medir), uma **checagem** (para o Revisor), um **diagnóstico** (para o Medidor/Gestor) ou
um **passo de produção** (para o Estrategista/Fábrica). O piloto continua existindo: ele ajusta os números, não o caso.

---

## 2. O vocabulário vira campo (taxonomia de cada criativo)

Hoje cada anúncio de teste (`imphq_test_variants`) guarda `angulo`, `metodo` e `copy_lib_id`. Os materiais trazem
cinco réguas que explicam **por que** um criativo vence ou morre. Cada uma vira um campo, preenchido pelo Estrategista
ao montar a leva e conferido pelo classificador (Jev/TypeSafe, como já fazemos com ângulo).

| Campo | Valores | De onde vem | Para que serve |
|---|---|---|---|
| `ponto_rota` | 1 não vê o problema · 2 sente o problema · 3 sabe que existe saída · 4 conhece o produto · 5 está pronta | Missão 01 (níveis de consciência) | No frio, só 1 e 2 abrem a rota. Criativo de ponto 5 no frio = CTR baixo e CPC caro |
| `carga` | objeto estranho · rosto com emoção · cena da vida dela · contradição · **bloco** (produto/preço/logo) | Missão 02 (primeiro segundo) | O primeiro quadro decide o hook rate. "Bloco" é sinal de alerta |
| `porta` | direta · voz dela · quebra de crença · narrativa · descoberta | Missão 04 | Testar **papéis**, não sinônimos. Cada porta casa com um ponto da rota |
| `pouso` | pousou · bateu (vendeu cedo) · tombou (promessa de outra pessoa) · apagou (mistério vazio) | Missão 03 | Diagnostica a segunda frase. Hook rate bom + hold baixo = pouso ruim |
| `molde` | `campeao_id` + `variacao` (V00–V05) + `dimensao` (quem fala · onde · tom visual · pessoa+cenário) | Missão 05 | Rastreia a família de um vencedor e **qual dimensão** venceu ou morreu |

Com isso o **Professor** (agente 8) passa a responder: "nesta oferta, porta *voz dela* com carga *cena da vida dela* no
ponto 2 vende a CPA X", e não só "o ângulo 07 vendeu".

Mapa de portas por ponto (regra fixa para o Estrategista): narrativa e descoberta → ponto 1; direta, voz dela e quebra
de crença → ponto 2.

---

## 3. O Revisor ganha um checklist (agente 5)

Antes de qualquer peça subir, o Revisor aplica três blocos de perguntas. Cada pergunta é sim/não, avaliada pelo modelo
de classificação (como o `angle-classifier`, com confiança mínima), e a peça só passa com todos os "sim" obrigatórios.

**A. Teste do print (primeiro quadro, sem som)**
1. Tem uma das quatro cargas? (se não: **bloco**, reprova)
2. Funciona sem som e sem legenda?
3. A pessoa do público se reconheceria ali?
4. O que aparece tem a ver com o que a página/VSL vai falar? (se não: **carro sem endereço**, reprova)

**B. Abertura (hook + aterrissagem)**
1. A primeira frase faz ela pensar "isso é comigo"? (qualificação)
2. A pergunta que ficou aberta cabe numa linha? (dívida)
3. A página/VSL responde essa pergunta nos primeiros minutos? (a dívida tem fundo)
4. A segunda frase promete algo **para ela**, e não para outra pessoa?
5. Tem número exato ou ligação com o que está na imagem?
   → Se 4 ou 5 falham, o Revisor **corrige sozinho** só três coisas: número redondo → exato, "ela" → "você", e a ponte
   com o objeto da tela. Ângulo, mecanismo e promessa não mudam.

**C. Cartão de bolso + compliance**
1. Uma ideia, uma emoção, uma promessa, uma ação (Regra do Um)
2. Solta uma corrente (método, ela mesma ou o mundo) e o vilão **nunca é ela**
3. Tem prova que ela conseguiria conferir
4. Entende em 3 segundos, sem reler
5. Compliance Meta: sem atributo pessoal ("você é diabético?"), sem claim de cura/reversão, sem promessa com prazo
   ("perca 30 kg em 30 dias"); urgência e escassez só se forem verdade

A nota e os motivos ficam em `imphq_creative_assets.metadata.revisao`; reprovado não sobe.

---

## 4. A telemetria vira diagnóstico automático (Medidor + Gestor)

`imphq_ads_spend` já traz impressões, `video_3s_views`, `video_thruplay`, `link_clicks`, `landing_page_views`,
`init_checkout`, CPM e CTR. O Medidor calcula as métricas do método e o Gestor escreve o **diagnóstico** junto de cada
decisão (no relatório e em "A IA fez"), em vez de só "pausar".

| Métrica | Conta | Leitura do método | Correção sugerida |
|---|---|---|---|
| Hook rate | 3s ÷ impressões | < 20% bloco · 20–30% fraco · > 30% carro | trocar a **carga** do primeiro quadro |
| Hold rate | ThruPlay ÷ 3s | hook bom + hold baixo = a aterrissagem não segurou | ajustar a **segunda frase** (pouso) |
| CTR + CPC | cliques ÷ impressões | CTR baixo e CPC caro = criativo de ponto 5 no frio | subir criativo de ponto 1/2 |
| Connect rate | visitas na página ÷ cliques | baixo = a porta emperrou (página lenta ou pixel atrasado) | olhar página e pixel (hoje JP ≈ 50%: pixel só carrega após toque/20s) |
| CTR bom, pouca venda | — | promessa que a página não sustenta (desvio de rota) | alinhar anúncio ao mecanismo / 1ª tela da página continuar o anúncio |
| IC sem venda | IC ÷ vendas | algo trava no checkout | olhar checkout/oferta |

Faixas são ilustrativas: comparar sempre criativos **da mesma oferta** entre si (o próprio material avisa).
Ordem de leitura para validar (Playbook): **ROI → vendas → checkout (IC) → cliques → CPM**. Não validar por uma venda.

---

## 5. O Gestor de tráfego ganha a política "Método CBO" (agente 7)

O `traffic-agent` hoje decide por múltiplos do CPA alvo (pausa sozinho ≥ 3×, propõe ≥ 2×). O Playbook traz uma escada
mais fina, ligada ao payout e ao IC. Vira uma **política selecionável por projeto** em `imphq_scale_rounds.params`
(`politica: "cpa_alvo" | "cbo_hw"`), sem apagar a atual.

**P1 · teste (estrutura 1-50-1, CBO, sem bid, 5 criativos × 10 conjuntos, 5 portas/ângulos diferentes)**

| Situação | Corte (fração do payout) | JP · payout ≈ R$59 |
|---|---|---|
| Nenhum IC | ~32% do payout | ≈ R$19 |
| Menos de 2 IC | ~45% do payout | ≈ R$27 |
| 2+ IC: deixa rodar até o limite | ~85% do payout | ≈ R$50 sem venda → corta |
| CPC acima do teto | teto definido por projeto | corta, **salvo venda + ROAS** (resultado prevalece) |

Regras de leitura: não mexer antes de 48h (exceto os cortes acima); validar pelo consolidado (referência da Missão 05:
**3 vendas** com CPA dentro do payout).

**P2 · escala (o Gestor recomenda; quem monta é o Lançador quando existir)**
- Uma estrutura 1-5-1 por criativo validado (4 validados → 1-5-4).
- Orçamento de referência: 10× o ticket/CPA. Bid: 70–100% do CPA.
- Bid travado: 4 campanhas extras com bid subindo ~23% a cada degrau.
- Criativo muito validado na P1 (ex.: 4 vendas boas): a própria P1 vira escala sem bid, +30% só na virada do dia, e
  abre-se uma P1 nova ao lado.
- Subir só com estabilidade; se o aumento derrubar o resultado, reduzir/lateralizar. Escala é para lucro, não gasto.

**Conta**: conta nova começa em 1-1-1; mesma estrutura em 3 contas para comparar no nível da conta; conta limitando
gasto → pagamento adiantado (aviso ao sócio, nunca automático).

**Formato**: o Playbook é de imagem → advertorial. Vídeo → VSL: considerar CPC ~30% e IC ~50% mais caros (os cortes do
projeto de VSL sobem na mesma proporção).

---

## 6. A Fábrica aprende a multiplicar (Estrategista + Fábrica, agentes 3 e 4)

**Leva de teste (P1):** 5 criativos por estrutura, cada um numa **porta** diferente e no ponto 1 ou 2 da rota. "Cinco
frases parecidas são uma porta só": o Estrategista recusa duas peças com a mesma porta na mesma leva.

**Molde vencedor (Missão 05) — quando um criativo valida (3 vendas):**
1. **V00 · desmontar**: script transcrito palavra por palavra (o `ref-pipeline` já transcreve), quem fala, onde, tom
   visual. Fica salvo como molde (`imphq_creative_batches.briefing` com `tipo: "molde"`).
2. **V01** outra pessoa do mesmo tipo · **V02** tipo oposto · **V03** outro cenário · **V04** pessoa + cenário (só
   depois de ler V01–V03) · **V05** luz/cor (segundo ciclo).
3. **Script travado**: nenhuma palavra de copy muda; uma dimensão por variação.
4. **Em ondas**: o V01 de todos os campeões, depois o V02 de todos. Assim o Professor descobre se a mudança funciona
   em geral.
5. Variação que valida vira **controle** e ganha a própria fila. A que morre registra **qual dimensão** morreu.
6. Música, legenda ou corte no fim **não** contam como variação (o Meta vê o mesmo anúncio).

**Cansaço:** quando o Gestor detecta fadiga num campeão, a fila V0x dele já deve estar pronta (a próxima onda nasce
antes do campeão cair).

---

## 7. Microlead (só projetos com VSL, ex.: SlimSoda)

A segunda porta é a página: uma abertura de 1–2 min (300–400 palavras) antes da lead da VSL, em 7 etapas (formato
viral do nicho · ângulo · avatar coerente · pré-hook + hook · prova em cada take · prova demonstrativa · transição sem a
palavra "vídeo"). O Império já tem o split de página com pesos (FUN1.2): **controle 60–70% · reservas 15–20% · cada
microlead nova ~10%**, uma variável por vez, 3–4 dias, decide pela venda (apoio: retenção no 1º minuto ≥ 58–60% e
quantos chegam ao pitch).

---

## 8. Ritmo 72h (encaixa no calendário da máquina)

| Hora | O que | Quem |
|---|---|---|
| T0 | sobe a leva (5 portas, pontos 1/2, Revisor aprovado) | Lançador |
| T0–48h | só cortes duros da escada da P1; nada mais muda | Gestor |
| T48h | leitura: hook rate, hold, CTR, connect, IC, vendas | Medidor |
| T72h | corrige a rota: corta os piores, registra porta/carga/pouso vencedores, abre V01 do validado | Gestor → Estrategista |

---

## 9. Ordem de implementação (código; nada roda sem decisão dos sócios)

| # | Story | O que entrega | Depende de |
|---|---|---|---|
| 1 | **MHW1.1 Taxonomia** | campos `ponto_rota`, `carga`, `porta`, `pouso`, `molde` nos testes + classificador + placar por eles | — |
| 2 | **MHW1.2 Revisor** | checklist A/B/C com nota, correções automáticas permitidas e bloqueio | 1 |
| 3 | **MHW1.3 Diagnóstico** | hook/hold/connect/IC calculados e o diagnóstico escrito em cada decisão | — |
| 4 | **MHW1.4 Política CBO** | escada de cortes por fração do payout + IC + teto de CPC + regra 48h, selecionável por projeto | 3 |
| 5 | **MHW1.5 Molde** | V00 (desmontar) e fila V01–V05 em ondas na Fábrica | 1 |
| 6 | **MHW1.6 Microlead** | roteiro de 7 etapas + teste contra controle no split | projeto com VSL |

## 10. Decisões dos sócios

- [ ] Política padrão por projeto: `cpa_alvo` (atual) ou `cbo_hw`?
- [ ] Payout de referência por produto (JP CCP ≈ R$59 com bump) e teto de CPC.
- [ ] O Revisor pode **corrigir sozinho** número/pronome/ponte com a imagem, ou só apontar?
- [ ] A regra "não mexer antes de 48h" vale para pausas automáticas também (exceto prejuízo claro)?
