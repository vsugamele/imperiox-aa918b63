# Backlog — mudanças anotadas para depois

Itens pedidos pelo Vinicius para fazer **depois** do que está em andamento. Cada um vira story quando entrar.

## Depois do LIVE1.1 (painel ao vivo)
1. **LIVE1.2–1.4** — leituras a cada 15 min e alertas, fontes (sync da Meta, tracker no checkout, webhooks), IA. Detalhe em `EPIC-LIVE1-painel-ao-vivo.md`.

## Achados do LIVE1.1 nos dados reais (para o LIVE1.3 — fontes)
- `imphq_ads_spend.checkouts_iniciados` chega sempre 0; o número real está em `init_checkout` (já tratado na leitura). Corrigir no sync para gravar nas duas ou padronizar.
- JP em julho: pixel com centenas de compras/dia e webhook com ~1 → o checkout não estava mandando as vendas ao Império. Conferir a integração do checkout do JP e reimportar o período se possível.
- Sync do JP via Zernio rodou até 19/08 com gasto zero (campanhas paradas?) e o sync direto da Meta parou em 06/06. Decidir uma fonte única de gasto.
- `InitiateCheckout` do tracker chega sem `project_id`.

## Mapa difícil de entender (03/10/2026)
> "Ainda acho difícil no mapa entender os passos, resultados, métricas, caminho principal, alternativas."

O que o mapa precisa deixar óbvio, para qualquer pessoa, sem abrir cada etapa:
- **Passos:** ordem clara (1, 2, 3…) e em que fase cada um está (preparação, aquisição, conversão, medição).
- **Resultado de cada passo:** o que ele entrega (contrato "SAÍDA" / "PRONTO QUANDO") visível no card, não só no painel.
- **Métricas:** valor real × meta no próprio card (verde/amarelo/vermelho), usando a métrica do playbook (STR1.2 ainda não feito).
- **Caminho principal × alternativas:** destacar o fluxo que leva à venda (seta grossa, numerado) e mostrar desvios (recuperação, downsell, cemitério do P4) como ramos secundários.
- **Onde está travado:** etapa bloqueando o caminho principal em evidência (dono, prazo, o que falta).

Ideias para avaliar quando entrar (com o Vinicius, antes de construir):
- Visão "Caminho" (linear, de cima para baixo, só o principal) ao lado da visão "Mapa" (livre).
- Legenda fixa e filtros: só caminho principal / só pendências / só métricas fora da meta.
- Cada playbook marca suas etapas como principal ou alternativa (campo no passo do playbook) para o mapa saber desenhar.
- Card compacto padrão: nº do passo · nome · dono · status · métrica × meta · próximo resultado esperado.
