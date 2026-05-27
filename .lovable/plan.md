# Plano OpenFlow — JP Freitas

## Diagnóstico rápido
JP tem só **2 automações ativas** (Pix + carrinho), mas o catálogo já mostra padrões claros:

- **Tripwires de R$40–47:** Código dos Cortes Perfeitos (215 vendas / R$10k), Mentoria VIP Cachos (81/R$3,8k), Finalização Express (52/R$2,1k), Segredo do Corte (22/R$1,1k).
- **High-ticket:** JP Hair Education (19 vendas / R$13,8k — ticket ~R$728) e Master Cuts presencial (R$150).
- **Dinheiro deixado na mesa:** 39 Código Cortes expirados (R$1,8k), 19 Mentoria VIP expiradas, 10 Finalização expiradas, 21 Pix pendentes do Código.
- **Avatar:** cabeleireira de cachos/crespos, insegura com preço, salva mas não aplica, gatilhos de raiva/medo/ROI já mapeados no projeto.

## Fluxos a criar

### Recuperação (prioridade 1 — receita rápida)
1. **Pix expirado — Código dos Cortes** (`pagamento_expirado`, filtro produto): 3 toques WA (15min / 2h / 24h) com link Pix novo + prova social "+200 cabeleireiras já dentro".
2. **Boleto não pago D+1 / D+3 / D+5** (`boleto_gerado` + condição não comprou): sequência email+WA.
3. **Carrinho abandonado tripwire** (turbinar o existente): 3 toques (10min/1h/24h) com ângulo "raiva — quanto você perde por mês cobrando menos" (R$480/mês do dossiê).
4. **Recusado → Pix** (`pagamento_recusado`): WA imediato oferecendo Pix manual.

### Escada de valor (prioridade 2 — LTV)
5. **Compra Código → upsell Mentoria VIP** (`compra_aprovada` filtro Código): D+0 boas-vindas, D+2 case SA3, D+5 oferta Mentoria R$47 com bump.
6. **Compra Mentoria/Finalização → JP Hair Education** (`compra_aprovada` filtro tripwire ≠ JPHE): sequência de 7 dias quebrando objeção "já fiz cursos", CTA webinar/VSL JPHE.
7. **Compra JPHE → Master Cuts presencial** (`compra_aprovada` filtro JPHE): D+7 convite presencial com urgência de vagas.

### Pós-venda & retenção (prioridade 3)
8. **Primeiro acesso JPHE** (`primeiro_acesso`): boas-vindas premium, link da comunidade, checklist primeira semana.
9. **Reembolso/Chargeback** (`reembolso`): pesquisa 1-clique + reoferta tripwire daqui 30d.
10. **Assinatura JPHE — dunning** (`assinatura_cancelada` / falha cobrança): 3 toques recuperando o churn.

### Captação
11. **Novo lead sem compra D+3** (`lead_novo` + condição não comprou): nutrição em 4 mensagens com ângulos "medo/ROI/status/curiosidade" já prontos no avatar, fechando em Código R$47.

## Como vou construir
- Cada fluxo usa o **FlowEditor** existente, com provider WA do projeto e templates puxando variáveis `{{nome}}` `{{produto}}` `{{link}}`.
- Copy gerada via **"Gerar Narrativa com IA"** usando o avatar + ângulos já mapeados (raiva/medo/ROI/status/curiosidade do projeto).
- Filtros por `produto_nome` nos triggers de pagamento para não cruzar fluxos.
- Salvar mensagens-chave como **templates reutilizáveis** (`imphq_wa_templates`).

## Entregáveis
- 10–11 fluxos criados e ativos em `imphq_automacoes`.
- ~25 templates WA/email salvos com copy do tom Imperius.
- Diagrama de escada visível no OpenFlow do projeto.

## Próximo passo
Confirmar:
- Quer que eu **crie todos os 11** ou priorize os 4 de recuperação primeiro?
- Tom: **Imperius padrão** (estratégico/direto) ou **mais leve** para esse público de cabeleireiras?
