---
name: metodo-hw
description: Aplica o Método H&W (Playbook CBO + Trilha de Copy Missões 01–05 + Fundamentos do DR) no dia a dia do Império — revisar e classificar criativos (porta, ponto da rota, carga, pouso), diagnosticar o painel (hook/hold/connect/IC), simular cortes e escala CBO, multiplicar um vencedor (Molde V00–V05) e escrever microlead. Use SEMPRE que o pedido for "revisa esse criativo", "por que esse anúncio não vende", "o que cortar", "monta a próxima leva", "multiplica o vencedor", "como está o teste", "escreve uma abertura para a VSL", ou qualquer decisão de criativo/tráfego de JP, SlimSoda, LinfaFlow, MemoFlow. NÃO use para suporte de aluno, financeiro ou páginas.
---

# Método H&W no Império

Referência completa: `docs/architecture/metodo-hw-na-imperio.md` (o que é cada régua e por quê) e
`docs/architecture/maquina-de-testes.md` (os 9 agentes). Código: `supabase/functions/_shared/hw-*.ts`,
`cbo-policy.ts`, `winner-mold.ts`, `microlead.ts`.

## Regras de ouro (não negociáveis)

1. **A venda do Império manda, não o pixel.** Corte e escala usam `imphq_vendas` ligado ao anúncio pela UTM.
2. **Nada roda sem decisão.** As ferramentas abaixo leem, simulam, classificam e escrevem rascunho. Pausar, escalar,
   subir anúncio, mudar a política do projeto ou mexer em página = pedir OK ao Vinicius/Bruno (exceto o que a
   autonomia do projeto já permite).
3. **Um vencedor é 3 vendas** com CPA ≤ payout, lidas depois de 48h. Uma venda é sinal, não prova.
4. **Uma mudança por vez.** Em variação de vencedor, o script fica travado.

## Ferramentas (MCP do Império, `project-mcp`)

| Pedido | Ferramenta | O que devolve |
|---|---|---|
| "como aplicar o método aqui?" / antes de qualquer decisão | `get_hw_method` | vocabulário, checklist, faixas, escada CBO do payout, fila do molde, microlead |
| "revisa/classifica esse teste" ou uma copy solta | `review_creatives` | aprovado/nota, reprovações, correções permitidas, porta/ponto/carga/pouso |
| etiquetar à mão | `set_method_tags` | grava e avisa porta repetida, porta vazia, ponto 5 no frio |
| "por que não vende?" / "como está o teste?" | `diagnose_ads` | hook, hold, CTR, CPC, connect, IC por anúncio + estágio que falhou |
| "o que cortar / escalar?" | `cbo_plan` | simulação da escada CBO e receita da P2 (não executa) |
| "qual porta/carga vende?" | `get_method_scoreboard` com `por: porta \| carga \| ponto_rota \| pouso` | placar por régua |
| "multiplica o vencedor" | `winner_mold` (`desmontar` → `onda`) | V00 e briefs da próxima onda |
| "abertura nova para a VSL" | `microlead_draft` | rascunho 7 etapas + checagem + pesos do split |

## Roteiros

**Revisar antes de subir (Revisor):** `review_creatives` → se reprovou, diga o motivo em uma linha por peça. Correções
que pode fazer sozinho: número redondo → exato, "ela/minha vizinha" → "você", ligar a frase ao objeto da imagem.
Ângulo, mecanismo e promessa não mudam sem o dono da copy.

**Montar uma leva (P1):** 5 criativos, cada um numa **porta** diferente (direta, voz dela, quebra de crença, narrativa,
descoberta), todos nos **pontos 1 ou 2** se for tráfego frio, primeiro quadro com uma das 4 **cargas**
(nunca "bloco" de produto/preço). Rode `set_method_tags` e leia os avisos da leva.

**Ler o painel (72h):** até 48h só valem os cortes da escada. Em T48h, `diagnose_ads`: responda por estágio —
carga (hook < 20%), pouso (hold baixo vs pares), porta (CTR baixo + CPC caro = ponto 5 no frio), página (connect < 60%
ou CTR bom sem IC), checkout (IC sem venda). Diga a correção, não só "pausar".

**Cortar e escalar:** `cbo_plan` para a simulação; apresente cortes e validados. Executar só com OK (ou pela autonomia
configurada). JP: payout ≈ R$59 → cortes ≈ R$19 (sem IC) / R$27 (<2 IC) / R$50 (sem venda).

**Multiplicar:** criativo com 3 vendas → `winner_mold` `desmontar`; depois `onda` (mesma variação para todos os
campeões). Música/legenda/corte não é variação. Variação que morre: registre a dimensão.

**Microlead (VSL):** `microlead_draft` → revisar → subir no split com ~10% contra o controle, uma por vez, 3–4 dias,
decide pela venda.

## Ao responder

- Português, direto, números com a fonte (vendas do Império, gasto do Zernio).
- Sempre feche com o próximo passo concreto e quem decide.
